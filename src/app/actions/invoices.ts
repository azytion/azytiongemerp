'use server';


import { requireSession } from './authz';
import { getDb } from '@/lib/db';

export async function getSaleForInvoice(saleId: number) {
    await requireSession();
    const db = await getDb();

    const sale = await db.prepare(`
        SELECT 
            s.*,
            c.name as customer_name,
            c.email as customer_email,
            c.phone as customer_phone,
            c.address as customer_address,
            u.username as cashier_name
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN users u ON s.user_id = u.id
        WHERE s.id = ?
    `).get(saleId) as any;

    if (!sale) return null;

    const items = await db.prepare(`
        SELECT 
            si.*,
            p.name as product_name,
            p.barcode
        FROM sale_items si
        LEFT JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ?
    `).all(saleId) as any[];

    return { ...sale, items };
}

export async function getCompanyInfo() {
    await requireSession();
    const db = await getDb();
    const settings = await db.prepare('SELECT key, value FROM settings WHERE category = "company"').all() as any[];

    const settingsMap: Record<string, string> = {};
    settings.forEach(s => settingsMap[s.key] = s.value);

    return {
        name: settingsMap.company_name || 'POS SYSTEM',
        address: settingsMap.company_address || '',
        phone: settingsMap.company_phone || '',
        email: settingsMap.company_email || '',
        website: settingsMap.company_website || '',
        taxId: settingsMap.company_tax_id || ''
    };
}
