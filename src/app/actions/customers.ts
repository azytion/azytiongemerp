'use server';

import { getDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { postCustomerSettlement } from './ledger';
import { logDaybookEntry } from './daybook';
import { authError, requireAnyRole, requireSession, userIdFromSession } from './authz';

export type Customer = {
    id: number;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    balance: number;
    created_at: string;
    updated_at: string;
};

import { PaginatedResult } from './types';

export async function getCustomers(
    query: string = '',
    page: number = 1,
    pageSize: number = 10
): Promise<PaginatedResult<Customer>> {
    const db = await getDb();
    const offset = (page - 1) * pageSize;

    let baseSql = 'FROM customers';
    const params: any[] = [];

    if (query) {
        baseSql += ' WHERE name LIKE ? OR phone LIKE ?';
        params.push(`%${query}%`, `%${query}%`);
    }

    // Total count
    const totalCount = await db.prepare(`SELECT COUNT(*) as count ${baseSql}`).get(...params) as { count: number };

    // Paginated items
    const sql = `
        SELECT * ${baseSql}
        ORDER BY name ASC
        LIMIT ? OFFSET ?
    `;

    const customers = await db.prepare(sql).all(...params, Number(pageSize)|0, Number(offset)|0) as Customer[];

    return {
        data: customers,
        total: totalCount.count,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount.count / pageSize)
    };
}

export async function getCustomer(id: number) {
    await requireSession();
    const db = await getDb();
    return await db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as Customer | undefined;
}

export async function createCustomer(formData: FormData) {
    try {
        await requireAnyRole(['cashier', 'manager', 'admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db = await getDb();

    const customer = {
        name: formData.get('name') as string,
        phone: (formData.get('phone') as string) || null,
        email: (formData.get('email') as string) || null,
        address: (formData.get('address') as string) || null,
    };

    try {
        await db.prepare(`
      INSERT INTO customers (name, phone, email, address)
      VALUES (@name, @phone, @email, @address)
    `).run(customer);

        revalidatePath('/customers');
        return { success: true };
    } catch (error) {
        console.error('Failed to create customer:', error);
        return { success: false, error: 'Failed to create customer' };
    }
}

export async function updateCustomer(id: number, formData: FormData) {
    try {
        await requireAnyRole(['manager', 'admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db = await getDb();

    const customer = {
        id,
        name: formData.get('name') as string,
        phone: (formData.get('phone') as string) || null,
        email: (formData.get('email') as string) || null,
        address: (formData.get('address') as string) || null,
    };

    try {
        await db.prepare(`
      UPDATE customers 
      SET name = @name, phone = @phone, email = @email, address = @address, updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run(customer);

        revalidatePath('/customers');
        return { success: true };
    } catch (error) {
        console.error('Failed to update customer:', error);
        return { success: false, error: 'Failed to update customer' };
    }
}

export async function deleteCustomer(id: number) {
    try {
        await requireAnyRole(['admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db = await getDb();
    try {
        await db.prepare('DELETE FROM customers WHERE id = ?').run(id);
        revalidatePath('/customers');
        return { success: true };
    } catch (_error) {
        return { success: false, error: 'Failed to delete customer' };
    }
}

export type CustomerBalance = {
    id: number;
    name: string;
    phone: string | null;
    balance: number;
    last_payment?: string;
};

// Get all customers who owe money
export async function getCustomersWithBalance(): Promise<CustomerBalance[]> {
    const db = await getDb();

    // Select where balance > 0 (floating point safety)
    const customers = await db.prepare(`
        SELECT id, name, phone, balance 
        FROM customers 
        WHERE balance > 0.01 
        ORDER BY balance DESC
    `).all() as CustomerBalance[];

    return customers;
}

// Settle a customer's balance
export async function settleCustomerBalance(
    customerId: number,
    amount: number,
    paymentMethod: string = 'Cash',
    userId: number = 1
) {
    let session;
    try {
        session = await requireAnyRole(['cashier', 'manager', 'admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db = await getDb();
    const actorId = userIdFromSession(session, userId);

    if (amount <= 0) {
        return { success: false, error: 'Amount must be greater than 0' };
    }

    try {
        const customer = await db.prepare('SELECT name, balance FROM customers WHERE id = ?').get(customerId) as { name: string, balance: number };

        if (!customer) return { success: false, error: 'Customer not found' };
        if (customer.balance < 0.01) return { success: false, error: 'Customer has no due balance' };

        // Prevent over-payment? Or allow it as credit deposit?
        // User request didn't specify. Standard practice: allow overpayment as credit balance (negative balance).
        // My implementation of "balance" means "amount they owe". (Positive = Debt).
        // If they pay more, balance becomes negative (Surplus). This works fine.

        const transaction = db.transaction(async () => {
            // 1. Update Customer Balance (Subtract payment)
            await db.prepare(`
                UPDATE customers 
                SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `).run(amount, customerId);

            // 2. Update unpaid/partial sales to 'paid' using FIFO
            // Get all unpaid/partial sales for this customer, oldest first
            const unpaidSales = await db.prepare(`
                SELECT id, total_amount, received_cash, payment_status
                FROM sales
                WHERE customer_id = ? AND payment_status IN ('unpaid', 'partial')
                  AND (type IS NULL OR type = 'sale')
                ORDER BY date ASC
            `).all(customerId) as any[];

            let remaining = amount;
            for (const sale of unpaidSales) {
                if (remaining <= 0) break;
                const owed = sale.total_amount - (sale.received_cash || 0);
                if (owed <= 0) continue;
                if (remaining >= owed - 0.01) {
                    // Fully pays this sale
                    await db.prepare(`UPDATE sales SET payment_status = 'paid', received_cash = total_amount WHERE id = ?`).run(sale.id);
                    remaining -= owed;
                } else {
                    // Partially pays this sale
                    await db.prepare(`UPDATE sales SET payment_status = 'partial', received_cash = received_cash + ? WHERE id = ?`).run(remaining, sale.id);
                    remaining = 0;
                }
            }

            try {
                await db.prepare(`
                    INSERT INTO transactions (account_id, type, amount, reference_type, reference_id, description, user_id)
                    VALUES (3, 'income', ?, 'customer_settlement', ?, ?, ?)
                `).run(amount, customerId, `Payment from ${customer.name}`, actorId);
            } catch (_ignore) { /* ignore */ }

            return { customerName: customer.name };
        });

        const result = await transaction();

        // 4. Post to Ledger
        await postCustomerSettlement(customerId, amount, paymentMethod, result.customerName);

        // 5. Log Daybook
        await logDaybookEntry('income', amount, 'customer_settlement', customerId, `Payment from ${result.customerName}`, actorId);

        revalidatePath('/customers');
        revalidatePath('/finance');
        revalidatePath('/ledger');

        return { success: true };

    } catch (error) {
        console.error('Settlement Error:', error);
        return { success: false, error: 'Failed to process settlement' };
    }
}

export async function getCustomerTransactions(customerId: number) {
    await requireSession();
    const db = await getDb();

    // 1. Sales for this customer
    const sales = await db.prepare(`
        SELECT 
            id,
            date,
            invoice_number,
            payment_method,
            payment_status,
            total_amount,
            received_cash,
            'sale' as type
        FROM sales
        WHERE customer_id = ? AND (type IS NULL OR type = 'sale')
        ORDER BY date DESC
    `).all(customerId) as any[];

    // 2. Payments/settlements recorded in daybook
    const payments = await db.prepare(`
        SELECT
            id,
            date,
            description as invoice_number,
            'Cash' as payment_method,
            'completed' as payment_status,
            credit as total_amount,
            'payment' as type
        FROM daybook
        WHERE reference_type = 'customer_settlement' AND reference_id = ?
          AND credit > 0
        ORDER BY date DESC
    `).all(customerId) as any[];

    // Merge and sort newest first
    return [...sales, ...payments].sort((a: any, b: any) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );
}

export async function getCustomerAgingReport() {
    const db = await getDb();

    // Get customers with outstanding balances and their oldest unpaid sale
    const customers = await db.prepare(`
        SELECT
            c.id,
            c.name,
            c.phone,
            c.email,
            c.balance,
            MIN(s.date) as oldest_unpaid_date,
            COUNT(s.id) as unpaid_count,
            SUM(s.total_amount - COALESCE(s.received_cash, 0)) as total_outstanding
        FROM customers c
        LEFT JOIN sales s ON s.customer_id = c.id
            AND s.payment_status IN ('unpaid', 'partial')
            AND s.type = 'sale'
        WHERE c.balance > 0
        GROUP BY c.id
        ORDER BY c.balance DESC
    `).all() as any[];

    const now = new Date();

    return customers.map(c => {
        const oldestDate = c.oldest_unpaid_date ? new Date(c.oldest_unpaid_date) : null;
        const daysPast = oldestDate ? Math.floor((now.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

        let agingBucket = 'current';
        if (daysPast > 90) agingBucket = '90+';
        else if (daysPast > 60) agingBucket = '61-90';
        else if (daysPast > 30) agingBucket = '31-60';
        else if (daysPast > 0) agingBucket = '1-30';

        return { ...c, daysPast, agingBucket };
    });
}

export async function getCustomerPurchaseHistory(customerId: number, page: number = 1, pageSize: number = 10) {
    const db = await getDb();
    const offset = (page - 1) * pageSize;

    const total = (await db.prepare('SELECT COUNT(*) as c FROM sales WHERE customer_id = ? AND status = \'completed\'').get(customerId) as any).c;
    const data = await db.prepare(`
        SELECT id, invoice_number, date, total_amount, payment_method, payment_status, type
        FROM sales
        WHERE customer_id = ? AND status = 'completed'
        ORDER BY date DESC
        LIMIT ? OFFSET ?
    `).all(customerId, pageSize, offset) as any[];

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function sendDunningEmails() {
    const db = await getDb();
    const { sendEmail } = await import('./email');
    const { getSettings } = await import('./settings');
    const settings = await getSettings();
    const companyName = settings.company_name || 'Azytion GemERP';

    const customers = await db.prepare(`
        SELECT id, name, email, phone, balance
        FROM customers
        WHERE balance > 0 AND email IS NOT NULL AND email != ''
        ORDER BY balance DESC
    `).all() as { id: number; name: string; email: string; phone: string | null; balance: number }[];

    let sent = 0;
    let failed = 0;

    for (const customer of customers) {
        const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
          <div style="background:#1a1a2e;padding:24px;text-align:center">
            <h1 style="color:#D4AF37;margin:0;font-size:22px">${companyName}</h1>
          </div>
          <div style="padding:32px">
            <p style="color:#374151;font-size:16px">Dear <strong>${customer.name}</strong>,</p>
            <p style="color:#374151">This is a friendly reminder that you have an outstanding balance of <strong style="color:#dc2626">Rs ${customer.balance.toFixed(2)}</strong> with us.</p>
            <p style="color:#374151">Please settle your account at your earliest convenience. If you have already made a payment, please disregard this notice.</p>
            <p style="color:#374151">For any queries, please contact us directly.</p>
            <p style="color:#374151">Thank you for your continued business.</p>
          </div>
          <div style="background:#f9fafb;padding:16px;text-align:center;border-top:1px solid #e5e7eb">
            <p style="color:#9ca3af;font-size:12px;margin:0">Powered By Azytion</p>
          </div>
        </div>`;

        const result = await sendEmail(customer.email, `Payment Reminder — ${companyName}`, html);
        if (result.success) {
            sent++;
            // Log activity
            await db.prepare(`
                INSERT INTO user_activity_log (user_id, action, entity_type, entity_id, new_values)
                VALUES (1, 'DUNNING_EMAIL_SENT', 'customer', ?, ?)
            `).run(customer.id, JSON.stringify({ email: customer.email, balance: customer.balance }));
        } else {
            failed++;
        }
    }

    return { success: true, sent, failed, total: customers.length };
}
