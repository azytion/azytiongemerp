'use server';

import { getDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { PaginatedResult } from './types';
import { logDaybookEntry } from './daybook';
import { logActivity } from './activity-logger';
import { postComplexSaleToJournal } from './ledger';
import { recordCreditNoteSync } from './credit-notes-logic';
import { nowLocalISO } from '@/lib/datetime';
import { authError, requireAnyRole, userIdFromSession } from './authz';

export type CartItem = {
    id: number;
    variant_id?: number | null;
    variant_name?: string | null;
    name: string;
    price: number;
    quantity: number;
    discount: number;
    memo_item_id?: number; // Linked to memo
    notes?: string; // Per-item special instructions
};

function salesDateMs(value: unknown): number {
    if (!value) return 0;
    if (value instanceof Date) return value.getTime();
    const raw = String(value).trim();
    if (!raw) return 0;

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const time = new Date(`${raw}T00:00:00`).getTime();
        return Number.isNaN(time) ? 0 : time;
    }

    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(raw)) {
        const time = new Date(`${raw.replace(' ', 'T')}Z`).getTime();
        return Number.isNaN(time) ? 0 : time;
    }

    const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
    let time = new Date(normalized).getTime();
    if (!Number.isNaN(time)) return time;

    // Handles imported display dates such as "Apr 16, 2026".
    time = new Date(raw).getTime();
    return Number.isNaN(time) ? 0 : time;
}

function parseSplitPayments(paymentDetails: string | null): { method: string; amount: number }[] {
    if (!paymentDetails) return [];
    try {
        const parsed = JSON.parse(paymentDetails);
        const payments = Array.isArray(parsed) ? parsed : parsed?.payments;
        if (!Array.isArray(payments)) return [];
        return payments
            .map((item) => ({ method: String(item.method || 'Cash'), amount: Number(item.amount) }))
            .filter((item) => Number.isFinite(item.amount) && item.amount > 0);
    } catch {
        return [];
    }
}

export async function createSale(
    items: CartItem[],
    totalAmount: number,
    cashReceived: number,
    customerId: number | null = null,
    paymentMethod: string = 'Cash',
    paymentDetails: string | null = null,
    _redeemedPoints: number = 0,
    discountAmount: number = 0,
    userId: number = 1,
    brokerId: number | null = null,
    brokerCommission: number = 0,
    clientSaleId: string | null = null
) {
    let session;
    try {
        session = await requireAnyRole(['cashier', 'manager', 'admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db = await getDb();
    const actorId = userIdFromSession(session, userId);

    if (items.length === 0) {
        return { success: false, error: 'Cart is empty' };
    }

    if (clientSaleId) {
        const existing = await db.prepare(
            'SELECT id, invoice_number FROM sales WHERE client_sale_id = ?'
        ).get(clientSaleId) as { id: number; invoice_number: string } | undefined;
        if (existing) {
            return {
                success: true,
                data: {
                    saleId: existing.id,
                    invoiceNumber: existing.invoice_number,
                    amountPaidNow: cashReceived,
                    remainingBalance: 0,
                },
            };
        }
    }

    try {
        // ── Pre-flight validations ──────────────────────────────────────────

        // 1. Stock validation — check BEFORE transaction to give clear errors
        for (const item of items) {
            if (item.memo_item_id) continue; // Memo items don't need stock check
            if (item.quantity < 0) continue; // Returns are negative, skip stock check

            const p = await db.prepare('SELECT stock, is_archived FROM products WHERE id = ?').get(item.id) as { stock: number; is_archived: number } | undefined;
            if (!p) return { success: false, error: `Product "${item.name}" not found` };
            if (p.is_archived === 1) return { success: false, error: `"${item.name}" is archived and cannot be sold` };
            if (p.stock < item.quantity) {
                return { success: false, error: `Insufficient stock for "${item.name}". Available: ${p.stock}` };
            }
        }

        // 2. Split payment validation
        if (paymentMethod === 'Split' && paymentDetails) {
            const splits = parseSplitPayments(paymentDetails);
            const splitTotal = splits.reduce((acc, s) => acc + s.amount, 0);
            const isReturn = totalAmount < -0.01;
            // Allow split underpayment only if customer is selected (remainder goes to Due)
            if (!isReturn && splitTotal < totalAmount - 0.01 && !customerId) {
                return { success: false, error: `Split payments total ${splitTotal.toFixed(2)} is less than order total ${totalAmount.toFixed(2)}. Select a customer for partial payment.` };
            }
        }

        // 3. Loyalty points validation removed — loyalty feature is disabled

        // ── Calculate paid amount ───────────────────────────────────────────
        let amountPaidNow = 0;

        if (paymentMethod === 'Due') {
            amountPaidNow = cashReceived;
        } else if (paymentMethod === 'Split' && paymentDetails) {
            const splits = parseSplitPayments(paymentDetails);
            amountPaidNow = splits.length > 0 ? splits.reduce((acc, curr) => acc + curr.amount, 0) : cashReceived;
        } else {
            amountPaidNow = totalAmount;
        }

        const remainingBalance = totalAmount - amountPaidNow;

        // Transaction for atomic operations
        const transaction = db.transaction(async () => {
            const invoiceNumber = `INV-${Date.now()}`;
            const isReturn = totalAmount < -0.01;
            const saleType = isReturn ? 'return' : 'sale';

            const balanceToReturn = isReturn ? Math.abs(totalAmount) : ((paymentMethod === 'Cash' && cashReceived > totalAmount) ? (cashReceived - totalAmount) : 0);

            let paymentStatus = isReturn ? 'returned' : 'paid';
            if (!isReturn && remainingBalance > 0.01) {
                paymentStatus = amountPaidNow > 0 ? 'partial' : 'unpaid';
            }

            const createdAt = nowLocalISO();

            // 1. Insert Sale
            const saleResult = await db.prepare(`
                INSERT INTO sales (invoice_number, client_sale_id, total_amount, received_cash, balance_to_return, payment_method, payment_details, customer_id, discount, user_id, date, payment_status, type, broker_id, broker_commission)
                VALUES (@invoice, @clientSaleId, @total, @received, @balance, @paymentMethod, @paymentDetails, @customerId, @discount, @userId, @createdAt, @paymentStatus, @type, @brokerId, @brokerCommission)
            `).run({
                invoice: invoiceNumber,
                clientSaleId: clientSaleId,
                total: totalAmount,
                received: amountPaidNow,
                balance: balanceToReturn,
                paymentMethod: paymentMethod,
                paymentDetails: paymentDetails,
                customerId: customerId,
                discount: discountAmount,
                userId: actorId,
                createdAt: createdAt,
                paymentStatus: paymentStatus,
                type: saleType,
                brokerId: brokerId,
                brokerCommission: brokerCommission
            });

            const saleId = saleResult.lastInsertRowid;

            // 2. Insert Items and Update Stock (or Memo Status)
            const insertItem = db.prepare(`
                INSERT INTO sale_items (sale_id, product_id, variant_id, quantity, price, discount)
                VALUES (@saleId, @productId, @variantId, @qty, @price, @discount)
            `);
            const updateProductStock = db.prepare(`UPDATE products SET stock = stock - @qty WHERE id = @productId`);

            // Memo specific statements
            const updateMemoItem = db.prepare(`UPDATE memo_items SET status = 'sold' WHERE id = @memoItemId`);
            const getMemoIdFromItem = db.prepare(`SELECT memo_id FROM memo_items WHERE id = ?`);
            const countPendingMemoItems = db.prepare(`SELECT COUNT(*) as count FROM memo_items WHERE memo_id = ? AND status = 'pending'`);
            const updateMemoStatus = db.prepare(`UPDATE memos SET status = 'sold' WHERE id = ?`);
            const updateMemoStatusPartial = db.prepare(`UPDATE memos SET status = 'partial' WHERE id = ?`);

            const processedMemos = new Set<number>();

            for (const item of items) {
                await insertItem.run({
                    saleId,
                    productId: item.id,
                    variantId: item.variant_id || null,
                    qty: item.quantity,
                    price: item.price,
                    discount: item.discount
                });

                if (item.memo_item_id) {
                    await updateMemoItem.run({ memoItemId: item.memo_item_id });

                    const memoIdRes = await getMemoIdFromItem.get(item.memo_item_id) as { memo_id: number };
                    if (memoIdRes) processedMemos.add(memoIdRes.memo_id);
                } else if (isReturn && item.quantity < 0) {
                    await db.prepare(`UPDATE products SET stock = stock + ? WHERE id = ?`).run(Math.abs(item.quantity), item.id);
                } else {
                    await updateProductStock.run({ qty: item.quantity, productId: item.id });
                }
            }

            for (const memoId of processedMemos) {
                const pending = await countPendingMemoItems.get(memoId) as { count: number };
                if (pending.count === 0) {
                    await updateMemoStatus.run(memoId);
                } else {
                    await updateMemoStatusPartial.run(memoId);
                }
            }


            // 3. Update Customer Balance (Add Due Amount)
            if (remainingBalance > 0.01) {
                if (!customerId) throw new Error("Customer Required for Due Payment");

                await db.prepare(`
                    UPDATE customers 
                    SET balance = COALESCE(balance, 0) + @amount, updated_at = CURRENT_TIMESTAMP
                    WHERE id = @customerId
                `).run({ amount: remainingBalance, customerId });
            }

            // 4. Create Credit Note if return
            if (isReturn) {
                const creditNoteNumber = `CN-SR-POS-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
                await recordCreditNoteSync(db, {
                    number: creditNoteNumber,
                    type: 'sales_return',
                    refId: Number(saleId),
                    refType: 'sale',
                    amount: Math.abs(totalAmount),
                    reason: 'POS Return',
                    userId: actorId
                });
            }

            return { saleId, invoiceNumber, amountPaidNow, remainingBalance };
        });

        const result = await transaction();

        // Log to Daybook
        await logDaybookEntry('sale', result.amountPaidNow, 'sale', Number(result.saleId), `Sale ${result.invoiceNumber}`, actorId);

        // Revalidate paths
        revalidatePath('/');
        revalidatePath('/products');
        revalidatePath('/sales');
        revalidatePath('/customers');
        revalidatePath('/finance');
        revalidatePath('/ledger');

        // 5. Post to Journal (Complex)
        await postComplexSaleToJournal(Number(result.saleId), totalAmount, result.amountPaidNow, paymentMethod);

        // Log Activity
        await logActivity(actorId, 'CREATE', 'sale', Number(result.saleId), undefined, { invoice: result.invoiceNumber, total: totalAmount, paid: result.amountPaidNow });

        // Auto-Archive Products with Zero Stock (Gemstone Inventory Management)
        try {
            const { archiveProduct } = await import('./products');
            for (const item of items) {
                // Skip memo items as they don't affect stock
                if (item.memo_item_id) continue;

                // Check current stock after sale
                const stockCheck = await db.prepare(`
                    SELECT COALESCE(stock, 0) as stock 
                    FROM products 
                    WHERE id = ?
                `).get(item.id) as { stock: number } | undefined;
                const currentStock = stockCheck?.stock || 0;

                // If stock is zero, archive the product
                if (currentStock === 0) {
                    await archiveProduct(item.id, 'sold_out');
                    console.log(`Auto-archived product ${item.id} (${item.name}) - sold out`);
                }
            }
        } catch (archiveError) {
            console.error('Failed to auto-archive products:', archiveError);
            // Don't fail the sale if archiving fails
        }

        return { success: true, data: result };

    } catch (error) { // ...
        console.error('Transaction Failed:', error);
        return { success: false, error: 'Transaction failed. Please try again.' };
    }
}

export async function getSales(page: number = 1, pageSize: number = 10, searchQuery: string = '', startDate?: string, endDate?: string): Promise<PaginatedResult<any>> {
    try {
        await requireAnyRole(['cashier', 'manager', 'admin', 'super_admin']);
    } catch {
        return { data: [], total: 0, page, pageSize, totalPages: 0 };
    }
    const db = await getDb();
    const offset = (page - 1) * pageSize;

    let baseQuery = `
        FROM sales s 
        LEFT JOIN customers c ON s.customer_id = c.id
        WHERE 1=1
    `;
    const params: any[] = [];

    if (searchQuery) {
        baseQuery += ` AND (s.invoice_number LIKE ? OR c.name LIKE ?)`;
        params.push(`%${searchQuery}%`, `%${searchQuery}%`);
    }

    // Fetch matching rows first, then normalize date filtering/sorting in JS.
    // Imported backup rows may contain display dates like "Apr 16, 2026";
    // SQLite text sorting places those above ISO timestamps, making them appear pinned.
    const salesSql = `
        SELECT s.*, 
        c.name as customer_name,
        b.name as broker_name,
        COALESCE((SELECT SUM(si.quantity * (si.price - COALESCE(p.cost_price, 0))) 
         FROM sale_items si 
         JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = s.id), 0) as profit
        ${baseQuery.replace('LEFT JOIN customers c ON s.customer_id = c.id', 'LEFT JOIN customers c ON s.customer_id = c.id LEFT JOIN brokers b ON s.broker_id = b.id')}
    `;

    const startMs = startDate ? salesDateMs(startDate) : 0;
    const endInput = endDate && endDate.length === 10 ? `${endDate}T23:59:59.999` : endDate;
    const endMs = endInput ? salesDateMs(endInput) : Number.POSITIVE_INFINITY;

    const allSales = (await db.prepare(salesSql).all(...params) as any[])
        .filter((sale) => {
            const time = salesDateMs(sale.date);
            return time >= startMs && time <= endMs;
        })
        .sort((a, b) => {
            const returnWeight = (sale: any) => sale.type === 'return' ? 1 : 0;
            const byDate = salesDateMs(b.date) - salesDateMs(a.date);
            if (byDate !== 0) return byDate;
            const byReturn = returnWeight(b) - returnWeight(a);
            if (byReturn !== 0) return byReturn;
            return Number(b.id || 0) - Number(a.id || 0);
        });

    const sales = allSales.slice(offset, offset + pageSize);

    return {
        data: sales,
        total: allSales.length,
        page,
        pageSize,
        totalPages: Math.ceil(allSales.length / pageSize)
    };
}

export async function getSaleDetails(saleId: number) {
    try {
        await requireAnyRole(['cashier', 'manager', 'admin', 'super_admin']);
    } catch {
        return null;
    }
    const db = await getDb();
    const sale = await db.prepare(`
        SELECT s.*, c.email as customer_email, c.phone as customer_phone, c.name as customer_name, 
               u.username as salesman_name, b.name as broker_name
        FROM sales s 
        LEFT JOIN customers c ON s.customer_id = c.id 
        LEFT JOIN users u ON s.user_id = u.id
        LEFT JOIN brokers b ON s.broker_id = b.id
        WHERE s.id = ?
    `).get(saleId) as any;

    if (!sale) return null;

    const items = await db.prepare(`
        SELECT si.*, p.name as product_name,
               g.carat_weight, g.shape, g.color, g.clarity, g.origin, g.treatment,
               g.certificate_number, g.certificate_provider
        FROM sale_items si 
        LEFT JOIN products p ON si.product_id = p.id 
        LEFT JOIN gem_details g ON g.product_id = si.product_id AND g.variant_id IS NULL
        WHERE si.sale_id = ?
        GROUP BY si.id
    `).all(saleId);

    return { sale, items };
}
