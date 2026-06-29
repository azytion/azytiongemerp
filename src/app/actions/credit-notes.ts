'use server';
import { nowLocalISO } from '@/lib/datetime';

import { getDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { postPurchaseReturnToJournal } from './ledger';
import { recordCreditNoteSync } from './credit-notes-logic';
import { authError, requireAnyRole, userIdFromSession } from './authz';

export type CreditNote = {
    id: number;
    credit_note_number: string;
    date: string;
    type: 'sales_return' | 'purchase_return';
    reference_invoice_id: number | null;
    reference_type: string | null;
    amount: number;
    reason: string | null;
    status: string;
    user_id: number | null;
    created_at: string;
};

export async function generateCreditNoteNumber() {
    const timestamp = nowLocalISO().replace(/[-:T.]/g, '').slice(0, 14);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `CN-${timestamp}-${random}`;
}

export async function processSalesReturn(
    saleId: number,
    returnItems: Array<{ product_id: number; quantity: number; price: number; discount: number }>,
    reason: string
) {
    let session;
    try {
        session = await requireAnyRole(['cashier', 'manager', 'admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db = await getDb();
    const actorId = userIdFromSession(session);

    try {
        const transaction = db.transaction(async () => {
            // Get sale information
            const sale = await db.prepare(`
                SELECT id, invoice_number, customer_id, total_amount, payment_method, payment_status
                FROM sales WHERE id = ?
            `).get(saleId) as any;

            if (!sale) throw new Error('Sale not found');

            // Get original sale items
            const saleItems = await db.prepare(`
                SELECT si.id, si.product_id, si.quantity, si.price, si.discount, p.name as product_name
                FROM sale_items si
                LEFT JOIN products p ON si.product_id = p.id
                WHERE si.sale_id = ?
            `).all(saleId) as any[];

            // Check how many items have already been returned for this sale
            const existingReturns = await db.prepare(`
                SELECT return_items FROM credit_notes
                WHERE reference_invoice_id = ? AND type = 'sales_return' AND status = 'active'
            `).all(saleId) as any[];

            // Build map of already-returned quantities per product
            const alreadyReturned: Record<number, number> = {};
            for (const cn of existingReturns) {
                if (cn.return_items) {
                    try {
                        const items = JSON.parse(cn.return_items);
                        for (const item of items) {
                            alreadyReturned[item.product_id] = (alreadyReturned[item.product_id] || 0) + item.quantity;
                        }
                    } catch { /* ignore */ }
                }
            }

            // Validate: check remaining returnable quantities
            for (const returnItem of returnItems) {
                const saleItem = saleItems.find(si => si.product_id === returnItem.product_id);
                if (!saleItem) throw new Error(`Product not found in original sale`);
                const alreadyReturnedQty = alreadyReturned[returnItem.product_id] || 0;
                const remainingReturnable = saleItem.quantity - alreadyReturnedQty;
                if (returnItem.quantity > remainingReturnable) {
                    throw new Error(`Cannot return ${returnItem.quantity} of "${saleItem.product_name}". Only ${remainingReturnable} remaining to return.`);
                }
            }

            // Calculate return amount
            const returnAmount = returnItems.reduce((sum, item) =>
                sum + (item.quantity * item.price) - (item.discount || 0), 0
            );

            // Build return items with product names for PDF
            const returnItemsWithNames = returnItems.map(ri => {
                const saleItem = saleItems.find(si => si.product_id === ri.product_id);
                return { ...ri, product_name: saleItem?.product_name || 'Unknown' };
            });

            // Generate credit note number
            const creditNoteNumber = `CN-SR-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

            // Create credit note with items stored
            const cnResult = await recordCreditNoteSync(db, {
                number: creditNoteNumber,
                type: 'sales_return',
                refId: saleId,
                refType: 'sale',
                amount: returnAmount,
                reason: reason,
                userId: actorId,
                returnItems: returnItemsWithNames,
            });

            const creditNoteId = cnResult.lastInsertRowid;

            // Create a return sale record so it appears in sales history
            const returnInvoiceNumber = `RET-${Date.now()}`;
            const returnedAt = nowLocalISO();
            const returnSaleResult = await db.prepare(`
                INSERT INTO sales (invoice_number, total_amount, received_cash, balance_to_return,
                    payment_method, customer_id, discount, user_id, date, payment_status, type)
                VALUES (?, ?, 0, ?, ?, ?, 0, ?, ?, 'returned', 'return')
            `).run(
                returnInvoiceNumber,
                -returnAmount,          // negative total = return
                returnAmount,           // balance_to_return = refund amount
                sale.payment_method,
                sale.customer_id,
                actorId,
                returnedAt
            );

            const returnSaleId = returnSaleResult.lastInsertRowid;

            // Insert return sale items (negative quantities)
            const insertReturnItem = await db.prepare(`
                INSERT INTO sale_items (sale_id, product_id, quantity, price, discount)
                VALUES (?, ?, ?, ?, ?)
            `);
            for (const item of returnItems) {
                await insertReturnItem.run(returnSaleId, item.product_id, -item.quantity, item.price, item.discount || 0);
            }

            // Update stock - add items back to inventory
            const updateStock = await db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
            for (const item of returnItems) {
                await updateStock.run(item.quantity, item.product_id);
            }

            // ── Cross-activity sync: adjust customer balance if original sale was Due ──
            // If the original sale had an unpaid/partial balance, reduce it by the return amount
            if (sale.customer_id && (sale.payment_status === 'unpaid' || sale.payment_status === 'partial' || sale.payment_method === 'Due')) {
                // Get current customer balance
                const customer = await db.prepare('SELECT balance FROM customers WHERE id = ?').get(sale.customer_id) as { balance: number } | undefined;
                if (customer && customer.balance > 0) {
                    // Reduce balance by return amount (but not below 0)
                    const reduction = Math.min(returnAmount, customer.balance);
                    if (reduction > 0) {
                        await db.prepare('UPDATE customers SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                            .run(reduction, sale.customer_id);
                    }
                }
            }

            return { creditNoteId, creditNoteNumber, returnAmount, returnSaleId, returnInvoiceNumber };
        });

        const result = await transaction();

        revalidatePath('/sales');
        revalidatePath('/products');
        return { success: true, data: result };

    } catch (error) {
        console.error('Error processing sales return:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Failed to process return' };
    }
}

export async function processPurchaseReturn(
    purchaseOrderId: number,
    returnItems: Array<{ product_id: number; quantity: number; price: number }>,
    reason: string
) {
    let session;
    try {
        session = await requireAnyRole(['manager', 'admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db = await getDb();
    const actorId = userIdFromSession(session);

    try {
        const transaction = db.transaction(async () => {
            // Get purchase order information
            const po = await db.prepare(`
                SELECT id, po_number, supplier_id, total_amount
                FROM purchase_orders WHERE id = ?
            `).get(purchaseOrderId) as any;

            if (!po) {
                throw new Error('Purchase order not found');
            }

            // Calculate return amount
            const returnAmount = returnItems.reduce((sum, item) =>
                sum + (item.quantity * item.price), 0
            );

            // Generate credit note number
            const creditNoteNumber = `CN-PR-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

            // Create credit note
            const cnResult = await recordCreditNoteSync(db, {
                number: creditNoteNumber,
                type: 'purchase_return',
                refId: purchaseOrderId,
                refType: 'purchase_order',
                amount: returnAmount,
                reason: reason,
                userId: actorId
            });

            const creditNoteId = cnResult.lastInsertRowid;

            // Update product stock - deduct items from inventory
            const updateStock = await db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
            for (const item of returnItems) {
                await updateStock.run(item.quantity, item.product_id);
            }

            // Update Supplier Balance (Reduce what we owe)
            if (po.supplier_id) {
                // Only reduce balance by the amount that was actually unpaid
                // If PO was already paid, no balance reduction needed
                const poStatus = po.status || 'received';
                if (poStatus !== 'paid') {
                    await db.prepare('UPDATE suppliers SET balance = balance - ? WHERE id = ?').run(returnAmount, po.supplier_id);
                }
            }

            // Mark purchase order as returned
            await db.prepare("UPDATE purchase_orders SET status = 'returned' WHERE id = ?").run(purchaseOrderId);

            // Post to Journal
            postPurchaseReturnToJournal(purchaseOrderId, returnAmount, `Purchase Return for PO #${po.po_number}: ${reason}`);

            return { creditNoteId, creditNoteNumber, returnAmount };
        });

        const result = await transaction();

        revalidatePath('/purchase-orders');
        revalidatePath('/inventory-management');
        revalidatePath('/products');
        revalidatePath('/finance');
        return { success: true, data: result };

    } catch (error) {
        console.error('Error processing purchase return:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Failed to process return' };
    }
}

import { PaginatedResult } from './types';

export type CreditNoteSummary = {
    totalCount: number;
    salesReturnsCount: number;
    purchaseReturnsCount: number;
    salesValue: number;
    purchaseValue: number;
    totalValue: number;
};

export async function getCreditNotes(
    type?: 'sales_return' | 'purchase_return',
    page: number = 1,
    pageSize: number = 15
): Promise<PaginatedResult<CreditNote> & { summary: CreditNoteSummary }> {
    try {
        await requireAnyRole(['cashier', 'manager', 'admin', 'super_admin']);
    } catch {
        const emptySummary: CreditNoteSummary = { totalCount: 0, salesReturnsCount: 0, purchaseReturnsCount: 0, salesValue: 0, purchaseValue: 0, totalValue: 0 };
        return { data: [], total: 0, page, pageSize, totalPages: 0, summary: emptySummary };
    }

    const db = await getDb();
    const offset = (page - 1) * pageSize;

    let baseSql = `FROM credit_notes cn LEFT JOIN users u ON cn.user_id = u.id`;
    const params: any[] = [];

    if (type) {
        baseSql += ` WHERE cn.type = ?`;
        params.push(type);
    }

    // Count total and calculate summary (global totals, ignoring pagination)
    const summarySql = `
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN type = 'sales_return' THEN 1 ELSE 0 END) as salesCount,
            SUM(CASE WHEN type = 'purchase_return' THEN 1 ELSE 0 END) as purchaseCount,
            SUM(CASE WHEN type = 'sales_return' THEN amount ELSE 0 END) as salesAmount,
            SUM(CASE WHEN type = 'purchase_return' THEN amount ELSE 0 END) as purchaseAmount,
            SUM(amount) as totalAmount
        FROM credit_notes
    `;
    const summary = await db.prepare(summarySql).get() as any;

    // Count filtered total for pagination
    const countSql = `SELECT COUNT(*) as totalCount ${baseSql}`;
    const { totalCount } = await db.prepare(countSql).get(...params) as { totalCount: number };

    // Get data
    const dataSql = `
        SELECT 
            cn.*,
            u.username as user_name
        ${baseSql}
        ORDER BY cn.created_at DESC
        LIMIT ? OFFSET ?
    `;
    const notes = await db.prepare(dataSql).all(...params, pageSize, offset) as CreditNote[];

    return {
        data: notes,
        total: totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
        summary: {
            totalCount: summary.total || 0,
            salesReturnsCount: summary.salesCount || 0,
            purchaseReturnsCount: summary.purchaseCount || 0,
            salesValue: summary.salesAmount || 0,
            purchaseValue: summary.purchaseAmount || 0,
            totalValue: summary.totalAmount || 0
        }
    };
}

export async function getCreditNote(id: number) {
    try {
        await requireAnyRole(['cashier', 'manager', 'admin', 'super_admin']);
    } catch {
        return null;
    }

    const db = await getDb();

    const note = await db.prepare(`
        SELECT 
            cn.*,
            u.username as user_name
        FROM credit_notes cn
        LEFT JOIN users u ON cn.user_id = u.id
        WHERE cn.id = ?
    `).get(id) as CreditNote | undefined;

    return note || null;
}

export async function getCreditNoteWithItems(id: number) {
    try {
        await requireAnyRole(['cashier', 'manager', 'admin', 'super_admin']);
    } catch {
        return null;
    }

    const db = await getDb();

    const note = await db.prepare(`
        SELECT 
            cn.*,
            u.username as user_name
        FROM credit_notes cn
        LEFT JOIN users u ON cn.user_id = u.id
        WHERE cn.id = ?
    `).get(id) as any;

    if (!note) return null;

    let items: any[] = [];
    let partyName = '';

    // Get items based on credit note type
    if (note.type === 'sales_return') {
        // Use stored return_items if available (new format)
        if (note.return_items) {
            try {
                items = JSON.parse(note.return_items);
            } catch { /* fall through to legacy fetch */ }
        }
        // Legacy fallback: fetch all items from original sale
        if (items.length === 0 && note.reference_invoice_id) {
            items = await db.prepare(`
                SELECT 
                    si.product_id,
                    si.quantity,
                    si.price,
                    p.name as product_name
                FROM sale_items si
                LEFT JOIN products p ON si.product_id = p.id
                WHERE si.sale_id = ?
            `).all(note.reference_invoice_id) as any[];
        }

        // Get customer name
        if (note.reference_invoice_id) {
            const sale = await db.prepare(`
                SELECT c.name as customer_name
                FROM sales s
                LEFT JOIN customers c ON s.customer_id = c.id
                WHERE s.id = ?
            `).get(note.reference_invoice_id) as any;
            partyName = sale?.customer_name || 'Walk-in Customer';
        }
    } else if (note.type === 'purchase_return' && note.reference_invoice_id) {
        // Get items from the original purchase order
        items = await db.prepare(`
            SELECT 
                poi.product_id,
                poi.quantity,
                poi.expected_price as price,
                p.name as product_name
            FROM purchase_order_items poi
            LEFT JOIN products p ON poi.product_id = p.id
            WHERE poi.po_id = ?
        `).all(note.reference_invoice_id) as any[];

        // Get supplier name
        const po = await db.prepare(`
            SELECT s.name as supplier_name
            FROM purchase_orders po
            LEFT JOIN suppliers s ON po.supplier_id = s.id
            WHERE po.id = ?
        `).get(note.reference_invoice_id) as any;

        partyName = po?.supplier_name || 'Unknown Supplier';
    }

    return {
        ...note,
        party_name: partyName,
        items
    };
}

export async function recordCreditNote(data: any) {
    try {
        await requireAnyRole(['manager', 'admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db = await getDb();
    return recordCreditNoteSync(db, data);
}

