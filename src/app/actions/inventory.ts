'use server';


import { requireSession } from './authz';
import { getDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { getSession } from './auth';
import { logActivity } from './settings';

export type AdjustmentType = 'correction' | 'damage' | 'loss' | 'return';

export type InventoryAdjustment = {
    id: number;
    product_id: number;
    variant_id?: number | null;
    product_name?: string;
    variant_name?: string | null;
    adjustment_type: AdjustmentType;
    quantity: number;
    reason: string | null;
    date: string;
    notes: string | null;
};

import { PaginatedResult } from './types';

export async function getAdjustments(
    page: number = 1,
    pageSize: number = 10
): Promise<PaginatedResult<InventoryAdjustment>> {
    const db = await getDb();
    const offset = (page - 1) * pageSize;

    const baseSql = `
        FROM inventory_adjustments ia
        JOIN products p ON ia.product_id = p.id
        LEFT JOIN product_variants v ON ia.variant_id = v.id
        WHERE 1=1
    `;

    const params: any[] = [];

    // Total count
    const totalCount = await db.prepare(`SELECT COUNT(*) as count ${baseSql}`).get(...params) as { count: number };

    // Paginated items
    const sql = `
        SELECT ia.*, p.name as product_name, v.name as variant_name
        ${baseSql}
        ORDER BY ia.date DESC
        LIMIT ? OFFSET ?
    `;

    const adjustments = await db.prepare(sql).all(...params, pageSize, offset) as InventoryAdjustment[];

    return {
        data: adjustments,
        total: totalCount.count,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount.count / pageSize)
    };
}

export async function createAdjustment(formData: FormData) {
    await requireSession();
    const db = await getDb();
    
    const productId = Number(formData.get('product_id'));
    const variantId = formData.get('variant_id') ? Number(formData.get('variant_id')) : null;
    const type = formData.get('adjustment_type') as AdjustmentType;
    const quantity = Number(formData.get('quantity'));
    const reason = (formData.get('reason') as string) || null;
    const notes = (formData.get('notes') as string) || null;

    if (!productId || !type || quantity === 0) {
        return { success: false, error: 'Invalid operation data' };
    }

    try {
        const transaction = db.transaction(async () => {
            // 1. Log Adjustment
            await db.prepare(`
                INSERT INTO inventory_adjustments (product_id, variant_id, adjustment_type, quantity, reason, notes)
                VALUES (@productId, @variantId, @type, @quantity, @reason, @notes)
            `).run({ productId, variantId, type, quantity, reason, notes });

            // 2. Update Stock
            let qtyChange = quantity;
            if (type === 'damage' || type === 'loss') {
                qtyChange = -Math.abs(quantity);
            } else if (type === 'return') {
                qtyChange = Math.abs(quantity);
            }

            if (variantId) {
                await db.prepare(`
                    UPDATE product_variants 
                    SET stock = stock + @qtyChange
                    WHERE id = @variantId
                `).run({ qtyChange, variantId });
            } else {
                await db.prepare(`
                    UPDATE products 
                    SET stock = stock + @qtyChange
                    WHERE id = @productId
                `).run({ qtyChange, productId });
            }
        });

        await transaction();

        revalidatePath('/inventory');
        revalidatePath('/products');
        return { success: true };
    } catch (error) {
        console.error('Failed to create adjustment:', error);
        return { success: false, error: 'Failed to create adjustment' };
    }
}

export type StockTakeItem = {
    productId: number;
    actualStock: number;
    systemStock: number;
    reason?: string;
};

export async function reconcileStock(items: StockTakeItem[], _userId: number) {
    await requireSession();
    const db = await getDb();
    let count = 0;

    try {
        const transaction = db.transaction(async () => {
            for (const item of items) {
                const diff = item.actualStock - item.systemStock;
                if (diff === 0) continue; // No change

                // 1. Create Adjustment Record
                const type: AdjustmentType = diff > 0 ? 'correction' : 'loss';

                await db.prepare(`
                    INSERT INTO inventory_adjustments (product_id, adjustment_type, quantity, reason, notes, date)
                    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `).run(
                    item.productId,
                    type,
                    diff,
                    'Stock Take Reconciliation',
                    `System: ${item.systemStock}, Counted: ${item.actualStock}`
                );

                // 2. Update Product Stock (Main product only in this simplified reconcileStock)
                await db.prepare(`
                    UPDATE products 
                    SET stock = ?
                    WHERE id = ?
                `).run(item.actualStock, item.productId);

                count++;
            }
        });

        await transaction();

        revalidatePath('/inventory-management');
        revalidatePath('/inventory');
        revalidatePath('/products');
        return { success: true, count };
    } catch (error: any) {
        console.error('Stock Take failed:', error);
        return { success: false, error: error.message };
    }
}

export type SplitItemRequest = {
    carat_weight: number;
    selling_price: number;
    cost_price?: number;
    name_suffix?: string; // e.g. "A", "B" -> "Ruby Lot A", "Ruby Lot B"
    pricing_method?: 'per_piece' | 'per_carat';
};

export async function splitLot(lotId: number, newItems: SplitItemRequest[]) {
    await requireSession();
    const db = await getDb();
    const session = await getSession();
    const userId = session?.sub ? Number(session.sub) : 1;

    try {
        const splitTxn = db.transaction(async () => {
            // 1. Fetch Parent Lot
            const lot = await db.prepare(`
                SELECT p.*, gd.carat_weight, gd.id as gem_details_id 
                FROM products p 
                LEFT JOIN gem_details gd ON p.id = gd.product_id
                WHERE p.id = ?
            `).get(lotId) as any;

            if (!lot) throw new Error('Lot not found');
            if (lot.type !== 'lot') throw new Error('Product is not a Lot');

            const currentWeight = lot.carat_weight || 0;
            const totalSplitWeight = newItems.reduce((sum, item) => sum + item.carat_weight, 0);

            if (totalSplitWeight > currentWeight) {
                throw new Error(`Insufficient weight in lot. Available: ${currentWeight}ct, Requested: ${totalSplitWeight}ct`);
            }

            // 2. Create Child Products
            const createdIds = [];

            // Prepare statements
            const insertProduct = db.prepare(`
                INSERT INTO products (
                    name, category_id, stock, cost_price, selling_price, reorder_level, 
                    has_variants, pricing_method, type, parent_lot_id, image_url, notes
                ) VALUES (
                    @name, @category_id, @stock, @cost_price, @selling_price, @reorder_level,
                    0, @pricing_method, 'single', @parent_lot_id, @image_url, @notes
                )
            `);

            const insertGemDetails = db.prepare(`
                INSERT INTO gem_details (
                    product_id, carat_weight, lot_origin_weight, shape, color, clarity, 
                    cut_grade, origin, treatment, certificate_provider
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                )
            `);

            let suffixIndex = 1;
            for (const item of newItems) {
                const itemName = item.name_suffix
                    ? `${lot.name} ${item.name_suffix}`
                    : `${lot.name} - Split ${suffixIndex++}`;

                const costPrice = item.cost_price ?? ((lot.cost_price / (lot.carat_weight || 1)) * item.carat_weight); // Approximation

                const newProduct = {
                    name: itemName,
                    category_id: lot.category_id,
                    stock: 1, // Single stone usually
                    cost_price: costPrice,
                    selling_price: item.selling_price,
                    reorder_level: 1,
                    pricing_method: item.pricing_method || 'per_piece',
                    parent_lot_id: lot.id,
                    image_url: lot.image_url,
                    notes: `Split from Lot #${lot.id}`
                };

                const res = await insertProduct.run(newProduct);
                const newId = Number(res.lastInsertRowid);
                createdIds.push(newId);

                const parentGemDetails = await db.prepare('SELECT * FROM gem_details WHERE id = ?').get(lot.gem_details_id) as any;

                await insertGemDetails.run(
                    newId,
                    item.carat_weight, 
                    lot.carat_weight,  
                    parentGemDetails?.shape,
                    parentGemDetails?.color,
                    parentGemDetails?.clarity,
                    parentGemDetails?.cut_grade,
                    parentGemDetails?.origin,
                    parentGemDetails?.treatment,
                    parentGemDetails?.certificate_provider
                );
            }

            // 3. Update Parent Lot
            const remainingWeight = currentWeight - totalSplitWeight;
            await db.prepare('UPDATE gem_details SET carat_weight = ? WHERE id = ?').run(remainingWeight, lot.gem_details_id);

            if (lot.pricing_method === 'per_piece') {
                const newCost = (lot.cost_price / currentWeight) * remainingWeight;
                await db.prepare('UPDATE products SET cost_price = ? WHERE id = ?').run(newCost, lot.id);
            }

            if (remainingWeight <= 0.001) {
                await db.prepare("UPDATE products SET is_archived = 1, archived_reason = 'split_fully', archived_at = CURRENT_TIMESTAMP WHERE id = ?").run(lot.id);
            }

            return createdIds;
        });
        const result = await splitTxn();

        const details = JSON.stringify({ weight_removed: newItems, created_ids: result });
        await logActivity(userId as number, 'SPLIT_LOT', 'product', lotId, details);

        revalidatePath('/products');
        revalidatePath(`/products/${lotId}`);
        return { success: true, createdIds: result };
    } catch (error: any) {
        console.error('Failed to split lot:', error);
        return { success: false, error: error.message };
    }
}

export async function mergeLot(targetLotId: number, sourceItemIds: number[]) {
    await requireSession();
    const db = await getDb();
    const session = await getSession();
    const userId = session?.sub ? Number(session.sub) : 1;

    try {
        const mergeTxn = db.transaction(async () => {
            // 1. Fetch Target Lot
            const lot = await db.prepare(`
                SELECT p.*, gd.carat_weight, gd.id as gem_details_id 
                FROM products p 
                LEFT JOIN gem_details gd ON p.id = gd.product_id
                WHERE p.id = ?
            `).get(targetLotId) as any;

            if (!lot) throw new Error('Target lot not found');
            if (lot.type !== 'lot') throw new Error('Target product is not a Lot');

            // 2. Fetch Source Items
            const placeholders = sourceItemIds.map(() => '?').join(',');
            const sourceItems = await db.prepare(`
                SELECT p.*, gd.carat_weight 
                FROM products p 
                LEFT JOIN gem_details gd ON p.id = gd.product_id
                WHERE p.id IN (${placeholders})
            `).all(...sourceItemIds) as any[];

            if (sourceItems.length !== sourceItemIds.length) {
                throw new Error('Some source items not found');
            }

            let totalWeightToAdd = 0;

            for (const item of sourceItems) {
                if (item.type !== 'single') throw new Error(`Item ${item.name} is not a single item`);

                totalWeightToAdd += (item.carat_weight || 0);

                // Archive source item
                await db.prepare(`
                    UPDATE products 
                    SET is_archived = 1, archived_reason = 'merged_into_lot', archived_at = CURRENT_TIMESTAMP 
                    WHERE id = ?
                `).run(item.id);

                // Update stock to 0
                await db.prepare('UPDATE products SET stock = 0 WHERE id = ?').run(item.id);
            }

            // 3. Update Target Lot
            const newWeight = (lot.carat_weight || 0) + totalWeightToAdd;
            await db.prepare('UPDATE gem_details SET carat_weight = ? WHERE id = ?').run(newWeight, lot.gem_details_id);

            if (lot.is_archived) {
                await db.prepare('UPDATE products SET is_archived = 0, archived_reason = NULL, archived_at = NULL WHERE id = ?').run(lot.id);
            }

            return { success: true, newWeight };
        });
        const result = await mergeTxn();

        const details = JSON.stringify({ merged_items: sourceItemIds, weight_added: result.newWeight });
        await logActivity(userId as number, 'MERGE_LOT', 'product', targetLotId, details);

        revalidatePath('/products');
        revalidatePath(`/products/${targetLotId}`);
        return { success: true };
    } catch (error: any) {
        console.error('Failed to merge lot:', error);
        return { success: false, error: error.message };
    }
}

export async function createSet(name: string, itemIds: number[], costPrice: number, sellingPrice: number, notes?: string) {
    await requireSession();
    const db = await getDb();
    const session = await getSession();
    const userId = session?.sub ? Number(session.sub) : 1;

    try {
        const createSetTxn = db.transaction(async () => {
            // 1. Calculate total weight from children
            const placeholders = itemIds.map(() => '?').join(',');
            const items = await db.prepare(`
                SELECT gd.carat_weight, p.category_id, p.image_url
                FROM products p
                LEFT JOIN gem_details gd ON p.id = gd.product_id
                WHERE p.id IN (${placeholders})
            `).all(...itemIds) as any[];

            if (items.length !== itemIds.length) {
                throw new Error('Some items not found');
            }

            const totalWeight = items.reduce((sum, item) => sum + (item.carat_weight || 0), 0);
            const firstItem = items[0];

            // 2. Create Set Product
            const setRes = await db.prepare(`
                INSERT INTO products (
                    name, category_id, stock, cost_price, selling_price, reorder_level,
                    has_variants, pricing_method, type, image_url, notes
                ) VALUES (?, ?, 1, ?, ?, 1, 0, 'per_piece', 'set', ?, ?)
            `).run(name, firstItem.category_id, costPrice, sellingPrice, firstItem.image_url, notes || `Set created from ${itemIds.length} items`);

            const newSetId = Number(setRes.lastInsertRowid);

            // 3. Create Gem Details for the Set
            await db.prepare(`
                INSERT INTO gem_details (product_id, carat_weight)
                VALUES (?, ?)
            `).run(newSetId, totalWeight);

            // 4. Update Children
            const updateChild = db.prepare('UPDATE products SET parent_set_id = ? WHERE id = ?');
            for (const id of itemIds) {
                await updateChild.run(newSetId, id);
            }

            return newSetId;
        });
        const setId = await createSetTxn();

        const details = JSON.stringify({ item_ids: itemIds, total_weight: 0 }); 
        await logActivity(userId as number, 'CREATE_SET', 'product', setId, details);

        revalidatePath('/products');
        revalidatePath('/inventory-management');
        return { success: true, setId };
    } catch (error: any) {
        console.error('Failed to create set:', error);
        return { success: false, error: error.message };
    }
}

export async function breakSet(setId: number) {
    await requireSession();
    const db = await getDb();
    const session = await getSession();
    const userId = session?.sub ? Number(session.sub) : 1;

    try {
        await db.transaction(async () => {
            // 1. Reset children
            await db.prepare('UPDATE products SET parent_set_id = NULL WHERE parent_set_id = ?').run(setId);

            // 2. Archive the set product
            await db.prepare(`
                UPDATE products 
                SET is_archived = 1, archived_reason = 'set_broken', archived_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `).run(setId);

            // 3. Set stock to 0
            await db.prepare('UPDATE products SET stock = 0 WHERE id = ?').run(setId);
        })();

        await logActivity(userId as number, 'BREAK_SET', 'product', setId, '');

        revalidatePath('/products');
        revalidatePath('/inventory-management');
        return { success: true };
    } catch (error: any) {
        console.error('Failed to break set:', error);
        return { success: false, error: error.message };
    }
}
