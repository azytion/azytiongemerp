'use server';


import { requireSession } from './authz';
import { getDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { logActivity } from './settings'; // Assuming we have logging
import { getSession } from './auth';
import { recordCreditNoteSync } from './credit-notes-logic';

// --- HELD ORDERS ---

export async function saveHeldOrder(cart: any[], customerId: number | null, note: string) {
    await requireSession();
    const session = await getSession();
    if (!session) return { success: false, error: 'Unauthorized' };

    const db = await getDb();
    try {
        await db.prepare(`
            INSERT INTO held_orders (cart_json, customer_id, name, user_id)
            VALUES (?, ?, ?, ?)
        `).run(JSON.stringify(cart), customerId, note, session.sub); // sub is user id

        revalidatePath('/pos');
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: 'Failed to hold order' };
    }
}

export async function getHeldOrders() {
    await requireSession();
    const db = await getDb();
    const orders = await db.prepare(`
        SELECT h.*, c.name as customer_name, u.username as user_name
        FROM held_orders h
        LEFT JOIN customers c ON h.customer_id = c.id
        LEFT JOIN users u ON h.user_id = u.id
        ORDER BY h.date DESC
    `).all();
    return orders;
}

export async function retrieveHeldOrder(id: number) {
    await requireSession();
    const db = await getDb();
    try {
        const order = await db.prepare('SELECT * FROM held_orders WHERE id = ?').get(id) as any;
        if (!order) return { success: false, error: 'Order not found' };

        // We return the data so frontend can populate, THEN we delete it? 
        // Or we keep it until they checkout? 
        // Standard flow: Retrieve deletes it from "Held" list because it's now "Active" in POS.
        // If they cancel, they can hold it again.

        await db.prepare('DELETE FROM held_orders WHERE id = ?').run(id);

        revalidatePath('/pos');
        return { success: true, cart: JSON.parse(order.cart_json), customerId: order.customer_id, note: order.name };
    } catch (_e) {
        return { success: false, error: 'Failed to retrieve order' };
    }
}

export async function deleteHeldOrder(id: number) {
    await requireSession();
    const db = await getDb();
    await db.prepare('DELETE FROM held_orders WHERE id = ?').run(id);
    revalidatePath('/pos');
    return { success: true };
}

// --- REFUNDS ---

export async function refundSale(saleId: number, reason: string) {
    await requireSession();
    const session = await getSession();
    // Only Admin or Manager can refund? Or anyone? Let's check role.
    if (!session || (session.role !== 'admin' && session.role !== 'manager')) {
        return { success: false, error: 'Unauthorized. Only Admin/Manager can refund.' };
    }

    const db = await getDb();

    // Transaction for safety
    const refundTransaction = db.transaction(async () => {
        // 1. Get original sale
        const sale = await db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId) as any;
        if (!sale) throw new Error('Sale not found');
        if (sale.type === 'return') throw new Error('This is already a return record');
        if (sale.status === 'returned') throw new Error('Sale already refunded');

        // 2. Mark original sale as returned
        await db.prepare("UPDATE sales SET status = 'returned' WHERE id = ?").run(saleId);

        // 3. Restore Stock
        const items = await db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId) as any[];

        if (items.length > 0) {
            const updateProductStock = await db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');

            for (const item of items) {
                await updateProductStock.run(item.quantity, item.product_id);
            }
        } else {
            // Fallback: If no sale_items (legacy sales), we can't restore stock accurately automatically.
            // We could try parsing payment_details or just log a warning?
            // For now, we just proceed. Admin can manually adjust if needed.
        }

        // 4. Create financial record
        await db.prepare(`
            INSERT INTO daybook (date, time, transaction_type, description, credit, user_id)
            VALUES (CURRENT_DATE, CURRENT_TIME, 'refund', ?, ?, ?)
        `).run(`Refund for Invoice #${sale.invoice_number} - ${reason}`, sale.total_amount, session.sub);

        // 5. Create Credit Note
        const creditNoteNumber = `CN-SR-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
        await recordCreditNoteSync(db, {
            number: creditNoteNumber,
            type: 'sales_return',
            refId: saleId,
            refType: 'sale',
            amount: sale.total_amount,
            reason: reason,
            userId: Number(session.sub)
        });

        // Log it
        await logActivity(Number(session.sub), 'refund', 'sale', saleId, `Refunded ${sale.total_amount}`);
    });

    try {
        await refundTransaction();
        revalidatePath('/sales');
        revalidatePath('/finance');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
