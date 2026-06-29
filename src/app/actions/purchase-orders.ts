'use server';

import { requireSession } from './authz';
import { nowLocalISO } from '@/lib/datetime';

import { getDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { PaginatedResult } from './types';
import { getSession } from './auth';
import { logDaybookEntry } from './daybook';
import { postPurchaseToJournal } from './ledger';

export type PurchaseOrder = {
    id: number;
    po_number: string;
    supplier_id: number | null;
    supplier_name?: string;
    date_created: string;
    expected_date: string | null;
    status: 'pending' | 'received' | 'cancelled';
    total_amount: number;
    notes: string | null;
    user_id: number | null;
    supplier_phone?: string;
    supplier_email?: string;
    paid_amount?: number;
    payment_status?: string;
};

export type PurchaseOrderItem = {
    id: number;
    po_id: number;
    product_id: number;
    product_name?: string;
    quantity: number;
    expected_price: number | null;
};

export async function generatePONumber() {
    await requireSession();
    const timestamp = nowLocalISO().replace(/[-:T.]/g, '').slice(0, 14);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `PO-${timestamp}-${random}`;
}

export async function createPurchaseOrder(formData: FormData) {
    await requireSession();
    const db = await getDb();
    const session = await getSession();
    const currentUserId = session ? Number(session.sub) : 1;

    try {
        const supplierId = formData.get('supplier_id') ? Number(formData.get('supplier_id')) : null;
        const expectedDate = formData.get('expected_date') as string | null;
        const notes = formData.get('notes') as string | null;
        const itemsJson = formData.get('items') as string;

        if (!itemsJson) {
            return { success: false, error: 'No items provided' };
        }

        const items = JSON.parse(itemsJson) as Array<{
            product_id: number;
            quantity: number;
            expected_price: number;
        }>;

        if (items.length === 0) {
            return { success: false, error: 'At least one item is required' };
        }

        const totalAmount = items.reduce((sum, item) =>
            sum + (item.quantity * (item.expected_price || 0)), 0
        );

        const poNumber = await generatePONumber();

        const transaction = db.transaction(async () => {
            const poResult = await db.prepare(`
                INSERT INTO purchase_orders 
                (po_number, supplier_id, expected_date, total_amount, notes, user_id, status)
                VALUES (?, ?, ?, ?, ?, ?, 'pending')
            `).run(poNumber, supplierId, expectedDate, totalAmount, notes, currentUserId);

            const poId = poResult.lastInsertRowid;

            const insertItem = await db.prepare(`
                INSERT INTO purchase_order_items (po_id, product_id, quantity, expected_price)
                VALUES (?, ?, ?, ?)
            `);

            for (const item of items) {
                await insertItem.run(poId, item.product_id, item.quantity, item.expected_price);
            }

            return { poId, poNumber };
        });

        const result = await transaction();

        revalidatePath('/purchase-orders');
        return { success: true, data: result };

    } catch (error) {
        console.error('Error creating purchase order:', error);
        return { success: false, error: 'Failed to create purchase order' };
    }
}

export async function getPurchaseOrders(
    status?: string,
    page: number = 1,
    pageSize: number = 10
): Promise<PaginatedResult<PurchaseOrder>> {
    const db = await getDb();
    const offset = (page - 1) * pageSize;

    let baseSql = `
        FROM purchase_orders po
        LEFT JOIN suppliers s ON po.supplier_id = s.id
        LEFT JOIN users u ON po.user_id = u.id
        WHERE 1=1
    `;

    const params: any[] = [];

    if (status && status !== 'all') {
        baseSql += ` AND po.status = ?`;
        params.push(status);
    }

    const totalCount = await db.prepare(`SELECT COUNT(*) as count ${baseSql}`).get(...params) as { count: number };

    const sql = `
        SELECT 
            po.*,
            s.name as supplier_name,
            s.phone as supplier_phone,
            s.email as supplier_email,
            u.username as user_name
        ${baseSql}
        ORDER BY po.date_created DESC
        LIMIT ? OFFSET ?
    `;

    const orders = await db.prepare(sql).all(...params, Number(pageSize)|0, Number(offset)|0) as PurchaseOrder[];

    return {
        data: orders,
        total: totalCount.count,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount.count / pageSize)
    };
}

export async function getPurchaseOrder(id: number) {
    await requireSession();
    const db = await getDb();

    const po = await db.prepare(`
        SELECT 
            po.*,
            s.name as supplier_name,
            s.phone as supplier_phone,
            s.email as supplier_email,
            u.username as user_name
        FROM purchase_orders po
        LEFT JOIN suppliers s ON po.supplier_id = s.id
        LEFT JOIN users u ON po.user_id = u.id
        WHERE po.id = ?
    `).get(id) as PurchaseOrder | undefined;

    if (!po) {
        return null;
    }

    const items = await db.prepare(`
        SELECT 
            poi.*,
            p.name as product_name,
            p.barcode
        FROM purchase_order_items poi
        JOIN products p ON poi.product_id = p.id
        WHERE poi.po_id = ?
    `).all(id) as PurchaseOrderItem[];

    return { ...po, items };
}

export async function receivePurchaseOrder(poId: number, receivedItems: Array<{
    product_id: number;
    quantity_received: number;
}>, payment?: {
    paidAmount: number;
    paymentMethod: string;
}) {
    await requireSession();
    const db = await getDb();
    const session = await getSession();

    try {
        const po = await db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(poId) as PurchaseOrder | undefined;
        if (!po) return { success: false, error: 'PO not found' };

        const transaction = db.transaction(async () => {
            let totalReceivedValue = 0;

            const updateStock = await db.prepare(`
                UPDATE products 
                SET stock = stock + ? 
                WHERE id = ?
            `);
            const getItemPrice = await db.prepare('SELECT expected_price FROM purchase_order_items WHERE po_id = ? AND product_id = ?');

            for (const item of receivedItems) {
                await updateStock.run(item.quantity_received, item.product_id);

                const dbItem = await getItemPrice.get(poId, item.product_id) as { expected_price: number } | undefined;
                totalReceivedValue += (item.quantity_received * (dbItem?.expected_price || 0));
            }

            const paidAmount = payment?.paidAmount || 0;
            const paymentMethod = payment?.paymentMethod || 'Cash';
            const dueAmount = totalReceivedValue - paidAmount;

            let paymentStatus = 'paid';
            if (dueAmount > 0.01) {
                paymentStatus = (paidAmount > 0) ? 'partial' : 'pending';
            }

            await db.prepare(`
                UPDATE purchase_orders 
                SET status = 'received', paid_amount = ?, payment_status = ?
                WHERE id = ?
            `).run(paidAmount, paymentStatus, poId);

            if (po.supplier_id && dueAmount > 0.01) {
                await db.prepare(`
                    UPDATE suppliers 
                    SET balance = balance + ? 
                    WHERE id = ?
                `).run(dueAmount, po.supplier_id);
            }

            if (paidAmount > 0) {
                await logDaybookEntry(
                    'purchase',
                    paidAmount,
                    'purchase_order',
                    poId,
                    `Payment for PO ${po.po_number}`,
                    session?.sub ? Number(session.sub) : 1
                );
            }

            await postPurchaseToJournal(
                poId,
                totalReceivedValue,
                paidAmount,
                paymentMethod,
                `PO Received ${po.po_number}`
            );
        });

        await transaction();

        revalidatePath('/purchase-orders');
        revalidatePath('/products');
        revalidatePath('/reports');
        revalidatePath('/inventory-management');
        return { success: true };

    } catch (error: any) {
        console.error('Error receiving purchase order:', error);
        return { success: false, error: `Failed to receive purchase order: ${error.message}` };
    }
}

export async function cancelPurchaseOrder(poId: number) {
    await requireSession();
    const db = await getDb();

    try {
        await db.prepare(`
            UPDATE purchase_orders 
            SET status = 'cancelled' 
            WHERE id = ? AND status = 'pending'
        `).run(poId);

        revalidatePath('/purchase-orders');
        return { success: true };

    } catch (error) {
        console.error('Error cancelling purchase order:', error);
        return { success: false, error: 'Failed to cancel purchase order' };
    }
}

export async function deletePurchaseOrder(poId: number) {
    await requireSession();
    const db = await getDb();

    try {
        const po = await db.prepare('SELECT status FROM purchase_orders WHERE id = ?').get(poId) as { status: string } | undefined;

        if (!po) {
            return { success: false, error: 'Purchase order not found' };
        }

        if (po.status !== 'pending') {
            return { success: false, error: 'Can only delete pending orders' };
        }

        await db.prepare('DELETE FROM purchase_orders WHERE id = ?').run(poId);

        revalidatePath('/purchase-orders');
        return { success: true };

    } catch (error) {
        console.error('Error deleting purchase order:', error);
        return { success: false, error: 'Failed to delete purchase order' };
    }
}

