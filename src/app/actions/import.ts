'use server';

import { getDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { logActivity } from './settings';
import { authError, requireAnyRole, userIdFromSession } from './authz';

export async function importProducts(rows: any[], userId: number) {
    let session;
    try {
        session = await requireAnyRole(['admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db = await getDb();
    const actorId = userIdFromSession(session, userId);
    let successCount = 0;
    const errors: string[] = [];

    const result = db.transaction(async () => {
        try {
            for (const row of rows) {
                // Validation
                if (!row.name || !row.selling_price) {
                    errors.push(`Skipped row: Missing name or price for ${row.name || 'unknown item'}`);
                    continue;
                }

                const barcode = row.barcode || `GEN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

                // Check if exists
                const existing = await db.prepare('SELECT id FROM products WHERE barcode = ? OR name = ?').get(barcode, row.name);

                if (existing) {
                    // Update? or Skip? For simplicity, we skip duplicates in this version or could update stock.
                    // Let's UPDATE stock if it exists to make it useful for stock intake.
                    await db.prepare(`
                        UPDATE products 
                        SET stock = stock + ?, selling_price = ? 
                        WHERE id = ?
                    `).run(Number(row.stock || 0), Number(row.selling_price), (existing as any).id);
                } else {
                    // Insert
                    await db.prepare(`
                        INSERT INTO products (name, barcode, notes, category_id, cost_price, selling_price, stock, reorder_level, image_url)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        row.name,
                        barcode,
                        row.description || '',
                        null, // Category matching is complex, skipping for now or default null
                        Number(row.cost_price || 0),
                        Number(row.selling_price),
                        Number(row.stock || 0),
                        Number(row.min_stock_level || row.reorder_level || 5),
                        ''
                    );
                }
                successCount++;
            }
        } catch (error: any) {
            throw new Error(`Import failed: ${error.message}`);
        }
    });

    try {
        await result();
        await logActivity(actorId, 'IMPORT', 'PRODUCT', null, `Imported/Updated ${successCount} products`);
        revalidatePath('/inventory-management');
        return { success: true, count: successCount, errors };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function importCustomers(rows: any[], userId: number) {
    let session;
    try {
        session = await requireAnyRole(['admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db = await getDb();
    const actorId = userIdFromSession(session, userId);
    let successCount = 0;
    const errors: string[] = [];

    const result = db.transaction(async () => {
        try {
            for (const row of rows) {
                if (!row.name || !row.phone) {
                    errors.push(`Skipped row: Missing name or phone for ${row.name || 'unknown'}`);
                    continue;
                }

                const existing = await db.prepare('SELECT id FROM customers WHERE phone = ?').get(row.phone);

                if (!existing) {
                    await db.prepare(`
                        INSERT INTO customers (name, phone, email, address)
                        VALUES (?, ?, ?, ?)
                    `).run(
                        row.name,
                        row.phone,
                        row.email || '',
                        row.address || ''
                    );
                    successCount++;
                } else {
                    errors.push(`Skipped existing customer phone: ${row.phone}`);
                }
            }
        } catch (e: any) {
            throw new Error(`Import failed: ${e.message}`);
        }
    });

    try {
        await result();
        await logActivity(actorId, 'IMPORT', 'CUSTOMER', null, `Imported ${successCount} customers`);
        revalidatePath('/customers');
        return { success: true, count: successCount, errors };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
