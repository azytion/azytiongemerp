'use server';

import { requireSession } from './authz';
import { getDb } from '@/lib/db';
import { getSettings } from './settings';
import {
    ExchangeRateSnapshot,
    formatExchangeFromSnapshot,
    formatExchangeRateLine,
    getExchangeSnapshot
} from '@/lib/exchange-rates';

function getSaleExchangeSnapshot(sale: any, settings: Record<string, string>): ExchangeRateSnapshot | null {
    try {
        const details = typeof sale?.payment_details === 'string' ? JSON.parse(sale.payment_details) : sale?.payment_details;
        if (details?.exchange_rate?.baseCode && details?.exchange_rate?.targetCode) return details.exchange_rate;
    } catch {
        /* ignore legacy details */
    }
    return getExchangeSnapshot(settings);
}

function parseSaleDate(value: string | Date): Date {
    if (value instanceof Date) return value;
    const raw = String(value || '').trim();
    if (!raw) return new Date(NaN);
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(raw)) {
        return new Date(`${raw.replace(' ', 'T')}Z`);
    }
    if (raw.includes('Z') || raw.includes('+') || raw.lastIndexOf('-') > 10) {
        return new Date(raw);
    }
    return new Date(raw.replace(' ', 'T'));
}

function formatInvoiceDate(value: string | Date, timezone: string): string {
    const saleDate = parseSaleDate(value);
    if (Number.isNaN(saleDate.getTime())) return String(value || '');
    return new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    }).format(saleDate);
}

function parseSplitPayments(paymentDetails: string | null): { method: string; amount: number }[] {
    if (!paymentDetails) return [];
    try {
        const parsed = JSON.parse(paymentDetails);
        const payments = Array.isArray(parsed) ? parsed : parsed?.payments;
        if (!Array.isArray(payments)) return [];
        return payments
            .map((payment) => ({
                method: String(payment.method || 'Cash'),
                amount: Number(payment.amount) || 0,
            }))
            .filter((payment) => payment.amount > 0);
    } catch {
        return [];
    }
}

function buildGemDetails(item: any): string[] {
    const details: string[] = [];
    if (item.carat_weight) details.push(`${Number(item.carat_weight).toFixed(2)} ct`);
    if (item.shape) details.push(item.shape);
    if (item.color) details.push(item.color);
    if (item.clarity) details.push(item.clarity);
    if (item.origin) details.push(`Origin: ${item.origin}`);
    if (item.treatment && item.treatment !== 'None') details.push(`Treatment: ${item.treatment}`);
    if (item.certificate_provider || item.certificate_number) {
        details.push(`Cert: ${[item.certificate_provider, item.certificate_number].filter(Boolean).join(' ')}`);
    }
    return details;
}

async function constructReceiptMessage(saleId: number) {
    const db = await getDb();
    const settings = await getSettings();

    const sale = await db.prepare(`
        SELECT s.*,
               c.name as customer_name,
               c.phone as customer_phone,
               c.email as customer_email,
               u.username as salesman_name,
               b.name as broker_name
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN users u ON s.user_id = u.id
        LEFT JOIN brokers b ON s.broker_id = b.id
        WHERE s.id = ?
    `).get(saleId) as any;

    if (!sale) return null;

    const items = await db.prepare(`
        SELECT si.*,
               p.name as product_name,
               g.carat_weight,
               g.shape,
               g.color,
               g.clarity,
               g.origin,
               g.treatment,
               g.certificate_provider,
               g.certificate_number
        FROM sale_items si
        LEFT JOIN products p ON si.product_id = p.id
        LEFT JOIN gem_details g ON g.product_id = si.product_id AND g.variant_id IS NULL
        WHERE si.sale_id = ?
        GROUP BY si.id
        ORDER BY si.id
    `).all(saleId) as any[];

    const sym = settings.currency_symbol || settings.currency_code || '$';
    const fmt = (amount: number) => `${sym} ${Number(amount || 0).toFixed(2)}`;
    const timezone = settings.timezone || 'UTC';

    const companyName = settings.company_name || 'ZATION GemERP';
    const companyAddress = settings.company_address || '';
    const companyPhone = settings.company_phone || '';
    const companyPhone2 = settings.company_phone_2 || '';
    const companyEmail = settings.company_email || '';
    const companyWebsite = settings.company_website || '';
    const vatNumber = settings.vat_number || settings.company_vat_number || '';

    let message = `*SALES INVOICE*\n`;
    message += `*${companyName}*\n`;
    if (companyAddress) message += `${companyAddress}\n`;
    const phoneStr = [companyPhone, companyPhone2].filter(Boolean).join(' | ');
    if (phoneStr) message += `Tel: ${phoneStr}\n`;
    if (companyEmail) message += `Email: ${companyEmail}\n`;
    if (companyWebsite) message += `Website: ${companyWebsite}\n`;
    if (vatNumber) message += `VAT No: ${vatNumber}\n`;
    message += `\n`;

    message += `Invoice: ${sale.invoice_number}\n`;
    message += `Date: ${formatInvoiceDate(sale.date, timezone)}\n`;
    message += `Customer: ${sale.customer_name || 'Walk-in Customer'}\n`;
    if (sale.customer_phone) message += `Customer Phone: ${sale.customer_phone}\n`;
    if (sale.customer_email) message += `Customer Email: ${sale.customer_email}\n`;
    if (sale.salesman_name) message += `Salesman: ${sale.salesman_name}\n`;
    if (sale.broker_name) message += `Broker: ${sale.broker_name}\n`;
    message += `Payment: ${sale.payment_method || 'Cash'}\n`;
    message += `Status: ${(sale.payment_status || 'paid').toUpperCase()}\n\n`;

    message += `*Items:*\n`;
    message += `--------------------\n`;

    let totalQty = 0;
    let totalCarats = 0;
    items.forEach((item, index) => {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.price) || 0;
        const discount = Number(item.discount) || 0;
        const lineTotal = price * qty - discount;
        const gemDetails = buildGemDetails(item);

        message += `${index + 1}. ${item.product_name || 'Item'}\n`;
        if (gemDetails.length) message += `   ${gemDetails.join(' | ')}\n`;
        message += `   ${fmt(price)} x ${qty}`;
        if (discount > 0) message += ` - ${fmt(discount)}`;
        message += ` = ${fmt(lineTotal)}\n`;

        totalQty += qty;
        totalCarats += Number(item.carat_weight) || 0;
    });

    message += `--------------------\n`;

    const exchangeSnapshot = getSaleExchangeSnapshot(sale, settings);
    const exchangeTotal = formatExchangeFromSnapshot(Number(sale.total_amount), exchangeSnapshot);
    const exchangeLine = formatExchangeRateLine(exchangeSnapshot);
    const itemDiscounts = items.reduce((acc, item) => acc + (Number(item.discount) || 0), 0);
    const saleDiscount = Number(sale.discount || 0);
    const totalDiscount = saleDiscount >= itemDiscounts - 0.01 ? saleDiscount : saleDiscount + itemDiscounts;
    const subtotal = Number(sale.total_amount) + totalDiscount;

    message += `Items: ${items.length} line(s), ${totalQty} unit(s)\n`;
    if (totalCarats > 0) message += `Total Carats: ${totalCarats.toFixed(2)} ct\n`;
    message += `Subtotal: ${fmt(subtotal)}\n`;
    if (totalDiscount > 0) message += `Discount: -${fmt(totalDiscount)}\n`;
    if (sale.tax_amount && Number(sale.tax_amount) > 0) message += `Tax: ${fmt(Number(sale.tax_amount))}\n`;
    message += `*Total: ${fmt(Number(sale.total_amount))}*\n`;
    if (exchangeTotal) message += `Equivalent: ${exchangeTotal.formatted} ${exchangeTotal.code}\n`;
    if (exchangeLine) message += `Rate: ${exchangeLine}\n`;
    if (sale.broker_commission && Number(sale.broker_commission) > 0) {
        message += `Broker Commission: ${fmt(Number(sale.broker_commission))}\n`;
    }
    message += `--------------------\n`;

    const splitPayments = parseSplitPayments(sale.payment_details);
    if (splitPayments.length) {
        message += `Payments:\n`;
        splitPayments.forEach((payment) => {
            message += `- ${payment.method}: ${fmt(payment.amount)}\n`;
        });
    } else if (sale.received_cash !== null && sale.received_cash !== undefined) {
        message += `Paid: ${fmt(Number(sale.received_cash))}\n`;
    }

    const change = Number(sale.balance_to_return) || 0;
    if (change > 0) message += `Change: ${fmt(change)}\n`;

    const balanceDue = Math.max(0, Number(sale.total_amount || 0) - Number(sale.received_cash || 0));
    if (balanceDue > 0.01 && (sale.payment_status === 'partial' || sale.payment_status === 'unpaid' || sale.payment_method === 'Due')) {
        message += `Balance Due: ${fmt(balanceDue)}\n`;
    }

    const footer = settings.receipt_footer || 'Thank you for your business!';
    message += `\n${footer}\n`;
    message += `Powered By ZATION`;
    if (companyPhone) message += ` | ${companyPhone}`;
    message += `\n`;

    return message;
}

export async function getWhatsAppLink(saleId: number, phone: string) {
    await requireSession();
    const message = await constructReceiptMessage(saleId);
    if (!message) return { success: false, error: 'Sale not found' };

    const cleanPhone = phone.replace(/\D/g, '');
    const link = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

    return { success: true, link };
}
