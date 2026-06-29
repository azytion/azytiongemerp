'use server';

import { requireSession } from './authz';

import { getDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { getSession } from './auth';

export type MemoItem = {
    id: number;
    memo_id: number;
    product_id: number;
    variant_id: number | null;
    quantity: number;
    carat_weight: number;
    price_per_carat: number;
    total_price: number;
    status: 'pending' | 'returned' | 'sold';
    returned_qty: number;
    returned_weight: number;
    product_name?: string;
    sku?: string;
};

export type Memo = {
    id: number;
    memo_number: string;
    customer_id: number;
    status: 'pending' | 'returned' | 'sold' | 'partial';
    date_out: string;
    date_due: string | null;
    user_id: number;
    notes: string | null;
    customer_name?: string;
    items?: MemoItem[];
    total_amount?: number;
    total_items?: number;
};

export async function getMemos(
    query: string = '',
    status: string = '',
    page: number = 1,
    pageSize: number = 20
) {
    await requireSession();
    const db = await getDb();
    const offset = (page - 1) * pageSize;

    let baseSql = `
        FROM memos m
        LEFT JOIN customers c ON m.customer_id = c.id
        WHERE 1=1
    `;
    const params: any[] = [];

    if (query) {
        baseSql += ` AND (m.memo_number LIKE ? OR c.name LIKE ?)`;
        params.push(`%${query}%`, `%${query}%`);
    }

    if (status) {
        baseSql += ` AND m.status = ?`;
        params.push(status);
    }

    const totalCount = await db.prepare(`SELECT COUNT(*) as count ${baseSql}`).get(...params) as { count: number };

    const sql = `
        SELECT m.*, c.name as customer_name,
        (SELECT COUNT(*) FROM memo_items WHERE memo_id = m.id) as total_items,
        (SELECT SUM(total_price) FROM memo_items WHERE memo_id = m.id) as total_amount
        ${baseSql}
        ORDER BY m.date_out DESC
        LIMIT ? OFFSET ?
    `;

    const memos = await db.prepare(sql).all(...params, pageSize, offset) as Memo[];

    return {
        data: memos,
        total: totalCount.count,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount.count / pageSize)
    };
}

export async function getMemo(id: number) {
    await requireSession();
    const db = await getDb();

    // Fetch Memo
    const memo = await db.prepare(`
        SELECT m.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone
        FROM memos m
        LEFT JOIN customers c ON m.customer_id = c.id
        WHERE m.id = ?
    `).get(id) as Memo & { customer_email: string, customer_phone: string };

    if (!memo) return null;

    // Fetch Items
    const items = await db.prepare(`
        SELECT mi.*, p.name as product_name, p.barcode
        FROM memo_items mi
        LEFT JOIN products p ON mi.product_id = p.id
        WHERE mi.memo_id = ?
    `).all(id) as MemoItem[];

    return { ...memo, items };
}

export async function createMemo(data: {
    customer_id: number;
    date_out: string;
    date_due?: string;
    notes?: string;
    items: {
        product_id: number;
        variant_id?: number | null;
        quantity: number;
        carat_weight: number;
        price_per_carat: number;
        total_price: number;
    }[];
}) {
    await requireSession();
    const db = await getDb();
    const session = await getSession();
    const userId = (session as any)?.sub ? parseInt((session as any).sub) : 1; // Fallback to 1 if no session

    // Generate Memo Number (e.g., MEMO-TIMESTAMP) - In production, use a sequence or better logic
    const memoNumber = `MEM-${Date.now().toString().slice(-6)}`;

    // Transaction to ensure atomicity
    const createTx = db.transaction(async () => {
        // 1. Create Memo Record
        const result = await db.prepare(`
            INSERT INTO memos (memo_number, customer_id, status, date_out, date_due, user_id, notes)
            VALUES (@memo_number, @customer_id, 'pending', @date_out, @date_due, @user_id, @notes)
        `).run({
            memo_number: memoNumber,
            customer_id: data.customer_id,
            date_out: data.date_out,
            date_due: data.date_due || null,
            user_id: userId,
            notes: data.notes || ''
        });

        const memoId = result.lastInsertRowid;

        // 2. Insert Items and Update Stock
        const insertItem = await db.prepare(`
            INSERT INTO memo_items (memo_id, product_id, variant_id, quantity, carat_weight, price_per_carat, total_price, status)
            VALUES (@memo_id, @product_id, @variant_id, @quantity, @carat_weight, @price_per_carat, @total_price, 'pending')
        `);

        // We also need to reduce stock for these items as they are "out"
        // For simplicity in this adaptation, we might treat "Out on Memo" as still in physical stock but "committed".
        // However, usually, if it's out, it's not available for other sales.
        // Let's decrement stock for now to prevent double selling.
        const updateStock = await db.prepare(`
            UPDATE products SET stock = stock - @qty WHERE id = @pid AND stock >= @qty
        `);

        for (const item of data.items) {
            await insertItem.run({
                memo_id: memoId,
                product_id: item.product_id,
                variant_id: item.variant_id || null,
                quantity: item.quantity,
                carat_weight: item.carat_weight,
                price_per_carat: item.price_per_carat,
                total_price: item.total_price
            });

            // Decrement Stock
            const stockResult = await updateStock.run({ qty: item.quantity, pid: item.product_id });
            if (stockResult.changes === 0) {
                throw new Error(`Insufficient stock for product ID ${item.product_id}`);
            }
        }

        return memoId;
    });

    try {
        const newMemoId = await createTx();
        revalidatePath('/memos');
        return { success: true, memoId: newMemoId };
    } catch (error: any) {
        console.error('Failed to create memo:', error);
        return { success: false, error: error.message };
    }
}

export async function returnMemoItems(memoId: number, itemsToReturn: { itemId: number, quantity?: number, carat_weight?: number }[]) {
    await requireSession();
    const db = await getDb();

    const returnTx = db.transaction(async () => {
        const updateItemStatus = await db.prepare(`
            UPDATE memo_items 
            SET status = @status, 
                returned_qty = returned_qty + @qty,
                returned_weight = returned_weight + @weight
            WHERE id = @itemId
        `);

        const getItem = await db.prepare('SELECT * FROM memo_items WHERE id = ?');
        const updateProductStock = await db.prepare('UPDATE products SET stock = stock + @qty WHERE id = @pid');

        // Also update carat weight in gem_details if it's a gemstone product recorded there
        // Note: For lots, we usually just update the main stock column if it's stored there.
        // If it's a specific stone, it's 1 qty and full weight.
        const updateGemWeight = await db.prepare(`
            UPDATE gem_details SET carat_weight = carat_weight + @weight 
            WHERE product_id = @pid AND variant_id IS NULL
        `);

        for (const item of itemsToReturn) {
            const memoItem = await getItem.get(item.itemId) as MemoItem;
            if (!memoItem) continue;

            const qtyToReturn = item.quantity ?? memoItem.quantity;
            const weightToReturn = item.carat_weight ?? memoItem.carat_weight;

            const newReturnedQty = memoItem.returned_qty + qtyToReturn;
            const newReturnedWeight = memoItem.returned_weight + weightToReturn;

            const isFullyReturned = newReturnedQty >= memoItem.quantity &&
                (!memoItem.carat_weight || newReturnedWeight >= memoItem.carat_weight);

            await updateItemStatus.run({
                itemId: item.itemId,
                status: isFullyReturned ? 'returned' : 'pending',
                qty: qtyToReturn,
                weight: weightToReturn
            });

            // Increment Stock
            await updateProductStock.run({ qty: qtyToReturn, pid: memoItem.product_id });

            // Increment Weight in gem_details if applicable
            if (weightToReturn > 0) {
                await updateGemWeight.run({ weight: weightToReturn, pid: memoItem.product_id });
            }
        }

        // Check if all items are returned/sold to update main memo status
        const pendingCount = await db.prepare("SELECT COUNT(*) as count FROM memo_items WHERE memo_id = ? AND status = 'pending'").get(memoId) as { count: number };

        if (pendingCount.count === 0) {
            // Check if any were sold or if all returned
            const soldCount = await db.prepare("SELECT COUNT(*) as count FROM memo_items WHERE memo_id = ? AND status = 'sold'").get(memoId) as { count: number };
            await db.prepare("UPDATE memos SET status = ? WHERE id = ?").run(soldCount.count > 0 ? 'sold' : 'returned', memoId);
        } else {
            await db.prepare("UPDATE memos SET status = 'partial' WHERE id = ?").run(memoId);
        }
    });

    try {
        await returnTx();
        revalidatePath('/memos');
        revalidatePath(`/memos/${memoId}`);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getMemoItemsForSale(memoId: number, itemIds: number[]) {
    await requireSession();
    const db = await getDb();

    // Fetch items with product details
    const placeholders = itemIds.map(() => '?').join(',');
    const items = await db.prepare(`
        SELECT mi.*, p.name as product_name, p.selling_price as product_price, 
               mi.price_per_carat, mi.carat_weight, mi.total_price, mi.product_id, mi.variant_id
        FROM memo_items mi
        JOIN products p ON mi.product_id = p.id
        WHERE mi.memo_id = ? AND mi.id IN (${placeholders}) AND mi.status = 'pending'
    `).all(memoId, ...itemIds) as any[];

    // Format for Cart use
    const cartItems = items.map(item => {
        // Calculate unit price for cart context
        const unitPrice = item.quantity > 0 ? (item.total_price / item.quantity) : 0;

        return {
            id: item.product_id,
            variant_id: item.variant_id,
            variant_name: null,
            name: `${item.product_name} (Memo #${memoId})`,
            price: unitPrice,
            quantity: item.quantity,
            discount: 0,
            memo_item_id: item.id
        };
    });

    return { success: true, cartItems };
}

