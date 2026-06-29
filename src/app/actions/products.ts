'use server';

import { getDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { logActivity } from '@/app/actions/activity-logger';
import { getSession } from './auth';
import { authError, requireAnyRole, userIdFromSession } from './authz';

export type Product = {
    id: number;
    barcode: string | null;
    name: string;
    category: string | null;
    category_id: number | null;
    stock: number;
    reorder_level: number;
    cost_price: number;
    selling_price: number;
    notes: string | null;
    image_url: string | null;
    created_at: string;
    updated_at: string;
    category_name?: string | null;
    pricing_method: 'per_piece' | 'per_carat';
    gem_details?: GemDetails | null;
    is_archived?: number;
    archived_at?: string | null;
    archived_reason?: string | null;
    type?: 'single' | 'lot' | 'jewelry' | 'set';
    parent_lot_id?: number | null;
    parent_set_id?: number | null;
    children?: Product[];
};

export type GemDetails = {
    id: number;
    product_id: number;
    variant_id: number | null;
    carat_weight: number;
    dimensions: string | null;
    shape: string | null;
    color: string | null;
    clarity: string | null;
    cut_grade: string | null;
    origin: string | null;
    treatment: string | null;
    certificate_provider: string | null;
    certificate_number: string | null;
    certificate_url: string | null;
    lot_origin_weight?: number | null;
    lot_tracking?: string | null;
};

import { PaginatedResult } from './types';

export async function getProducts(
    query: string = '',
    categoryId?: number,
    page: number = 1,
    pageSize: number = 10,
    includeArchived: boolean = false
): Promise<PaginatedResult<Product>> {
    const db = await getDb();
    const _session = await getSession();
    const offset = (page - 1) * pageSize;

    let baseSql = `
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN gem_details gd ON gd.product_id = p.id AND gd.variant_id IS NULL
        WHERE 1=1
    `;
    const params: any[] = [];

    // Exclude archived products by default
    if (!includeArchived) {
        baseSql += ` AND (p.is_archived IS NULL OR p.is_archived = 0)`;
    } else {
        // When includeArchived=true, show ONLY archived products
        baseSql += ` AND p.is_archived = 1`;
    }

    if (query) {
        baseSql += ` AND (p.name LIKE ? OR p.barcode LIKE ?)`;
        params.push(`%${query}%`, `%${query}%`);
    }

    if (categoryId) {
        baseSql += ` AND p.category_id = ?`;
        params.push(categoryId);
    }

    // Get total count
    const totalCount = await db.prepare(`SELECT COUNT(*) as count ${baseSql}`).get(...params) as { count: number };

    // Get paginated data
    const sql = `
        SELECT p.*, c.name as category_name,
               gd.id as gd_id, gd.carat_weight, gd.dimensions, gd.shape, gd.color,
               gd.clarity, gd.cut_grade, gd.origin, gd.treatment,
               gd.certificate_provider, gd.certificate_number, gd.certificate_url,
               gd.lot_origin_weight
        ${baseSql}
        ORDER BY p.name ASC
        LIMIT ? OFFSET ?
    `;

    const products = await db.prepare(sql).all(...params, pageSize, offset) as any[];

    // Build product objects
    const data = products.map(p => {
        // Build gem_details object from joined columns
        const gem_details = p.gd_id ? {
            id: p.gd_id,
            product_id: p.id,
            variant_id: null,
            carat_weight: p.carat_weight,
            dimensions: p.dimensions,
            shape: p.shape,
            color: p.color,
            clarity: p.clarity,
            cut_grade: p.cut_grade,
            origin: p.origin,
            treatment: p.treatment,
            certificate_provider: p.certificate_provider,
            certificate_number: p.certificate_number,
            certificate_url: p.certificate_url,
            lot_origin_weight: p.lot_origin_weight,
        } : null;

        return {
            ...p,
            category: p.category_name || p.category,
            pricing_method: p.pricing_method || 'per_piece',
            type: p.type || 'single',
            gem_details,
        };
    }) as Product[];

    return {
        data,
        total: totalCount.count,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount.count / pageSize)
    };
}

export async function getProduct(id: number) {
    const db = await getDb();
    const product = await db.prepare(`
        SELECT p.*, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = ?
    `).get(id) as any;

    if (!product) return undefined;

    // Fetch gem details
    const gemDetails = await db.prepare('SELECT * FROM gem_details WHERE product_id = ? AND variant_id IS NULL').get(product.id) as GemDetails;

    return {
        ...product,
        category: product.category_name || product.category,
        stock: product.stock,
        pricing_method: product.pricing_method || 'per_piece',
        type: product.type || 'single',
        parent_lot_id: product.parent_lot_id,
        parent_set_id: product.parent_set_id,
        gem_details: gemDetails || null,
        children: []
    } as Product;
}

export async function createProduct(formData: FormData) {
    let session;
    try {
        session = await requireAnyRole(['manager', 'admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db = await getDb();

    const product = {
        name: formData.get('name') as string,
        barcode: (formData.get('barcode') as string) || null,
        category_id: formData.get('category_id') ? Number(formData.get('category_id')) : null,
        stock: Number(formData.get('stock')) || 0,
        cost_price: Number(formData.get('cost_price')) || 0,
        selling_price: Number(formData.get('selling_price')) || 0,
        reorder_level: Number(formData.get('reorder_level')) || 5,
        notes: (formData.get('notes') as string) || null,
        has_variants: 0,
        image_url: (formData.get('image_url') as string) || null,
        pricing_method: (formData.get('pricing_method') as string) || 'per_piece',
        type: (formData.get('type') as string) || 'single',
        parent_lot_id: formData.get('parent_lot_id') ? Number(formData.get('parent_lot_id')) : null
    };

    const gemDetails = {
        carat_weight: Number(formData.get('gem_carat_weight')) || 0,
        dimensions: (formData.get('gem_dimensions') as string) || null,
        shape: (formData.get('gem_shape') as string) || null,
        color: (formData.get('gem_color') as string) || null,
        clarity: (formData.get('gem_clarity') as string) || null,
        cut_grade: (formData.get('gem_cut_grade') as string) || null,
        origin: (formData.get('gem_origin') as string) || null,
        treatment: (formData.get('gem_treatment') as string) || null,
        certificate_provider: (formData.get('gem_certificate_provider') as string) || null,
        certificate_number: (formData.get('gem_certificate_number') as string) || null,
        certificate_url: (formData.get('gem_certificate_url') as string) || null,
        lot_origin_weight: formData.get('lot_origin_weight') ? Number(formData.get('lot_origin_weight')) : null
    };

    try {
        const createProductTxn = db.transaction(async () => {
            const result = await db.prepare(`
                INSERT INTO products (
                    name, barcode, category_id, stock, cost_price, selling_price, reorder_level, 
                    notes, has_variants, image_url, pricing_method, type, parent_lot_id
                )
                VALUES (@name, @barcode, @category_id, @stock, @cost_price, @selling_price, @reorder_level, 
                    @notes, @has_variants, @image_url, @pricing_method, @type, @parent_lot_id)
            `).run(product);

            const pid = Number(result.lastInsertRowid);

            // Insert gem details
            await db.prepare(`
                INSERT INTO gem_details (
                    product_id, carat_weight, dimensions, shape, color, clarity, cut_grade, origin, 
                    treatment, certificate_provider, certificate_number, certificate_url, lot_origin_weight
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                pid, gemDetails.carat_weight, gemDetails.dimensions, gemDetails.shape, gemDetails.color,
                gemDetails.clarity, gemDetails.cut_grade, gemDetails.origin, gemDetails.treatment,
                gemDetails.certificate_provider, gemDetails.certificate_number, gemDetails.certificate_url,
                gemDetails.lot_origin_weight
            );

            return pid;
        });
        const productId = await createProductTxn();

        await logActivity(userIdFromSession(session), 'CREATE', 'product', productId, null, product);

        revalidatePath('/products');
        return { success: true };
    } catch (error) {
        console.error('Failed to create product:', error);
        return { success: false, error: 'Failed to create product' };
    }
}

export async function updateProduct(id: number, formData: FormData) {
    let session;
    try {
        session = await requireAnyRole(['manager', 'admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db = await getDb();

    // Get old values for logging
    const oldProduct = await db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
    const oldGem = await db.prepare('SELECT * FROM gem_details WHERE product_id = ? AND variant_id IS NULL').get(id) as any;

    const product = {
        id,
        name: (formData.get('name') as string) || oldProduct.name,
        barcode: (formData.get('barcode') as string) || oldProduct.barcode,
        category_id: formData.get('category_id') ? Number(formData.get('category_id')) : oldProduct.category_id,
        stock: formData.has('stock') ? Number(formData.get('stock')) : oldProduct.stock,
        cost_price: formData.has('cost_price') ? Number(formData.get('cost_price')) : oldProduct.cost_price,
        selling_price: formData.has('selling_price') ? Number(formData.get('selling_price')) : oldProduct.selling_price,
        reorder_level: formData.has('reorder_level') ? Number(formData.get('reorder_level')) : oldProduct.reorder_level,
        notes: formData.has('notes') ? (formData.get('notes') as string) : oldProduct.notes,
        image_url: formData.has('image_url') ? (formData.get('image_url') as string) : oldProduct.image_url,
        pricing_method: (formData.get('pricing_method') as string) || oldProduct.pricing_method,
        type: (formData.get('type') as string) || oldProduct.type
    };

    const gemDetails = {
        carat_weight: Number(formData.get('gem_carat_weight')) || 0,
        dimensions: (formData.get('gem_dimensions') as string) || null,
        shape: (formData.get('gem_shape') as string) || null,
        color: (formData.get('gem_color') as string) || null,
        clarity: (formData.get('gem_clarity') as string) || null,
        cut_grade: (formData.get('gem_cut_grade') as string) || null,
        origin: (formData.get('gem_origin') as string) || null,
        treatment: (formData.get('gem_treatment') as string) || null,
        certificate_provider: (formData.get('gem_certificate_provider') as string) || null,
        certificate_number: (formData.get('gem_certificate_number') as string) || null,
        certificate_url: (formData.get('gem_certificate_url') as string) || null,
        lot_origin_weight: formData.get('lot_origin_weight') ? Number(formData.get('lot_origin_weight')) : null
    };

    try {
        await db.transaction(async () => {
            // Update product fields 
            await db.prepare(`
                UPDATE products 
                SET name = @name, barcode = @barcode, category_id = @category_id, 
                    stock = @stock, reorder_level = @reorder_level,
                    cost_price = @cost_price, selling_price = @selling_price, 
                    notes = @notes, image_url = @image_url, pricing_method = @pricing_method,
                    type = @type,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = @id
            `).run(product);

            // Upsert gem details
            const existingGemDetails = await db.prepare('SELECT id FROM gem_details WHERE product_id = ? AND variant_id IS NULL').get(id) as any;

            if (existingGemDetails) {
                await db.prepare(`
                    UPDATE gem_details 
                    SET carat_weight = ?, dimensions = ?, shape = ?, color = ?, clarity = ?, 
                        cut_grade = ?, origin = ?, treatment = ?, certificate_provider = ?, 
                        certificate_number = ?, certificate_url = ?, lot_origin_weight = ?
                    WHERE id = ?
                `).run(
                    gemDetails.carat_weight, gemDetails.dimensions, gemDetails.shape, gemDetails.color,
                    gemDetails.clarity, gemDetails.cut_grade, gemDetails.origin, gemDetails.treatment,
                    gemDetails.certificate_provider, gemDetails.certificate_number, gemDetails.certificate_url,
                    gemDetails.lot_origin_weight,
                    existingGemDetails.id
                );
            } else {
                await db.prepare(`
                    INSERT INTO gem_details (
                        product_id, carat_weight, dimensions, shape, color, clarity, cut_grade, origin, 
                        treatment, certificate_provider, certificate_number, certificate_url, lot_origin_weight
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    id, gemDetails.carat_weight, gemDetails.dimensions, gemDetails.shape, gemDetails.color,
                    gemDetails.clarity, gemDetails.cut_grade, gemDetails.origin, gemDetails.treatment,
                    gemDetails.certificate_provider, gemDetails.certificate_number, gemDetails.certificate_url,
                    gemDetails.lot_origin_weight
                );
            }

        })();

        const userId = session?.sub ? Number(session.sub) : 1;
        await logActivity(userId as number, 'UPDATE', 'product', id, oldProduct, product);

        // Log gem grading changes
        const gradingFields = ['color', 'clarity', 'cut_grade', 'treatment'] as const;
        const changedGrading: Record<string, { old: any; new: any }> = {};
        for (const field of gradingFields) {
            const oldVal = oldProduct?.[field] ?? oldGem?.[field];
            const newVal = (gemDetails as any)[field];
            if (oldVal !== newVal && (oldVal || newVal)) {
                changedGrading[field] = { old: oldVal, new: newVal };
            }
        }
        if (Object.keys(changedGrading).length > 0) {
            await db.prepare(`
                INSERT INTO user_activity_log (user_id, action, entity_type, entity_id, old_values, new_values)
                VALUES (?, 'GEM_GRADING_UPDATE', 'product', ?, ?, ?)
            `).run(
                userId || 1,
                id,
                JSON.stringify(Object.fromEntries(Object.entries(changedGrading).map(([k, v]) => [k, v.old]))),
                JSON.stringify(Object.fromEntries(Object.entries(changedGrading).map(([k, v]) => [k, v.new])))
            );
        }

        revalidatePath('/products');
        revalidatePath('/inventory-management');
        return { success: true };
    } catch (error: any) {
        console.error('Failed to update product:', error);
        return { success: false, error: error.message || 'Failed to update product' };
    }
}

export async function deleteProduct(id: number) {
    let session;
    try {
        session = await requireAnyRole(['admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db = await getDb();
    try {
        const oldProduct = await db.prepare('SELECT * FROM products WHERE id = ?').get(id);
        await db.prepare('DELETE FROM products WHERE id = ?').run(id);

        await logActivity(userIdFromSession(session), 'DELETE', 'product', id, oldProduct, null);

        revalidatePath('/products');
        return { success: true };
    } catch (_error) {
        return { success: false, error: 'Failed to delete product' };
    }
}

export async function getProductStats(query: string = '', categoryId?: number) {
    const db = await getDb();
    let baseSql = `
        FROM products p
        WHERE (p.is_archived IS NULL OR p.is_archived = 0)
    `;
    const params: any[] = [];
    if (query) {
        baseSql += ` AND (p.name LIKE ? OR p.barcode LIKE ?)`;
        params.push(`%${query}%`, `%${query}%`);
    }
    if (categoryId) {
        baseSql += ` AND p.category_id = ?`;
        params.push(categoryId);
    }
    const row = await db.prepare(`
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN p.stock > 0 THEN 1 ELSE 0 END) as inStock,
            SUM(p.selling_price * p.stock) as totalValue,
            SUM(CASE WHEN p.stock > 0 AND p.stock <= COALESCE(p.reorder_level, 5) THEN 1 ELSE 0 END) as lowStock
        ${baseSql}
    `).get(...params) as any;
    return {
        total: row?.total || 0,
        inStock: row?.inStock || 0,
        totalValue: row?.totalValue || 0,
        lowStock: row?.lowStock || 0,
    };
}

export async function getProductByBarcode(barcode: string) {
    const db = await getDb();
    const product = await db.prepare(`
        SELECT p.*
        FROM products p 
        WHERE p.barcode = ?
    `).get(barcode) as any;

    if (!product) return null;

    return {
        ...product,
        match_type: 'product',
        pricing_method: product.pricing_method || 'per_piece'
    };
}

/**
 * Archive a product (typically when sold out)
 */
export async function archiveProduct(
    productId: number,
    reason: 'sold_out' | 'manual' | 'discontinued' = 'sold_out'
) {
    const db = await getDb();
    const session = await getSession();
    const userId = session?.sub ? Number(session.sub) : 1;

    try {
        await db.prepare(`
            UPDATE products 
            SET is_archived = 1, 
                archived_at = CURRENT_TIMESTAMP,
                archived_reason = ?
            WHERE id = ?
        `).run(reason, productId);

        await logActivity(userId, 'ARCHIVE', 'product', productId, undefined, { reason });

        revalidatePath('/products');
        revalidatePath('/inventory-management');

        return { success: true };
    } catch (error: any) {
        console.error('Failed to archive product:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Unarchive a product (restore to active inventory)
 */
export async function unarchiveProduct(productId: number) {
    const db = await getDb();
    const session = await getSession();
    const userId = session?.sub ? Number(session.sub) : 1;

    try {
        await db.prepare(`
            UPDATE products 
            SET is_archived = 0, 
                archived_at = NULL,
                archived_reason = NULL
            WHERE id = ?
        `).run(productId);

        await logActivity(userId, 'UNARCHIVE', 'product', productId, undefined, {});

        revalidatePath('/products');
        revalidatePath('/inventory-management');

        return { success: true };
    } catch (error: any) {
        console.error('Failed to unarchive product:', error);
        return { success: false, error: error.message };
    }
}

// ── Lot Management ────────────────────────────────────────────────────────────

export async function getGemLotProducts(search: string = ''): Promise<Product[]> {
    const db = await getDb();
    let sql = `
        SELECT p.*, c.name as category_name,
               gd.id as gd_id, gd.carat_weight, gd.shape, gd.color, gd.clarity,
               gd.cut_grade, gd.origin, gd.treatment, gd.lot_origin_weight, gd.lot_tracking,
               gd.certificate_number, gd.certificate_provider
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN gem_details gd ON gd.product_id = p.id AND gd.variant_id IS NULL
        WHERE (p.is_archived IS NULL OR p.is_archived = 0)
          AND gd.id IS NOT NULL
    `;
    const params: string[] = [];
    if (search) {
        sql += ` AND (p.name LIKE ? OR gd.origin LIKE ? OR gd.shape LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    sql += ` ORDER BY p.name ASC`;

    const rows = await db.prepare(sql).all(...params) as any[];
    return rows.map(row => ({
        ...row,
        pricing_method: row.pricing_method || 'per_piece',
        gem_details: row.gd_id ? {
            id: row.gd_id,
            product_id: row.id,
            variant_id: null,
            carat_weight: row.carat_weight,
            shape: row.shape,
            color: row.color,
            clarity: row.clarity,
            cut_grade: row.cut_grade,
            origin: row.origin,
            treatment: row.treatment,
            lot_origin_weight: row.lot_origin_weight,
            lot_tracking: row.lot_tracking,
            certificate_number: row.certificate_number,
            certificate_provider: row.certificate_provider,
            dimensions: null,
            certificate_url: null,
        } : null,
    }));
}

export async function getGemLotProductsPaginated(
    search: string = '',
    page: number = 1,
    pageSize: number = 20
): Promise<{ data: Product[]; total: number; totalPages: number }> {
    const db = await getDb();
    const offset = (page - 1) * pageSize;

    let baseSql = `
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN gem_details gd ON gd.product_id = p.id AND gd.variant_id IS NULL
        WHERE (p.is_archived IS NULL OR p.is_archived = 0)
          AND gd.id IS NOT NULL
    `;
    const params: string[] = [];
    if (search) {
        baseSql += ` AND (p.name LIKE ? OR gd.origin LIKE ? OR gd.shape LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const total = (await db.prepare(`SELECT COUNT(*) as c ${baseSql}`).get(...params) as any).c;
    const rows = await db.prepare(`
        SELECT p.*, c.name as category_name,
               gd.id as gd_id, gd.carat_weight, gd.shape, gd.color, gd.clarity,
               gd.cut_grade, gd.origin, gd.treatment, gd.lot_origin_weight, gd.lot_tracking,
               gd.certificate_number, gd.certificate_provider
        ${baseSql}
        ORDER BY p.name ASC
        LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset) as any[];

    const data = rows.map(row => ({
        ...row,
        pricing_method: row.pricing_method || 'per_piece',
        gem_details: row.gd_id ? {
            id: row.gd_id,
            product_id: row.id,
            variant_id: null,
            carat_weight: row.carat_weight,
            shape: row.shape,
            color: row.color,
            clarity: row.clarity,
            cut_grade: row.cut_grade,
            origin: row.origin,
            treatment: row.treatment,
            lot_origin_weight: row.lot_origin_weight,
            lot_tracking: row.lot_tracking,
            certificate_number: row.certificate_number,
            certificate_provider: row.certificate_provider,
            dimensions: null,
            certificate_url: null,
        } : null,
    }));

    return { data, total, totalPages: Math.ceil(total / pageSize) };
}

export async function getCertifiedProducts(
    query: string = '',
    provider: string = '',
    page: number = 1,
    pageSize: number = 24
): Promise<{ data: Product[]; total: number; totalPages: number; totalValue: number }> {
    const db = await getDb();
    const offset = (page - 1) * pageSize;

    let baseSql = `
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        INNER JOIN gem_details gd ON gd.product_id = p.id AND gd.variant_id IS NULL
        WHERE (p.is_archived IS NULL OR p.is_archived = 0)
          AND (gd.certificate_number IS NOT NULL OR gd.certificate_provider IS NOT NULL)
          AND (gd.certificate_number != '' OR gd.certificate_provider != '')
    `;
    const params: any[] = [];

    if (query) {
        baseSql += ` AND (p.name LIKE ? OR gd.certificate_number LIKE ?)`;
        params.push(`%${query}%`, `%${query}%`);
    }
    if (provider) {
        baseSql += ` AND gd.certificate_provider = ?`;
        params.push(provider);
    }

    const totalCount = (await db.prepare(`SELECT COUNT(*) as count ${baseSql}`).get(...params) as any).count;
    const totalValueRow = (await db.prepare(`SELECT COALESCE(SUM(p.selling_price * p.stock), 0) as v ${baseSql}`).get(...params) as any).v;

    const rows = await db.prepare(`
        SELECT p.*, c.name as category_name,
               gd.id as gd_id, gd.carat_weight, gd.dimensions, gd.shape, gd.color,
               gd.clarity, gd.cut_grade, gd.origin, gd.treatment,
               gd.certificate_provider, gd.certificate_number, gd.certificate_url,
               gd.lot_origin_weight
        ${baseSql}
        ORDER BY p.name ASC
        LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset) as any[];

    const data = rows.map(p => ({
        ...p,
        category: p.category_name || p.category,
        pricing_method: p.pricing_method || 'per_piece',
        type: p.type || 'single',
        gem_details: p.gd_id ? {
            id: p.gd_id, product_id: p.id, variant_id: null,
            carat_weight: p.carat_weight, dimensions: p.dimensions, shape: p.shape,
            color: p.color, clarity: p.clarity, cut_grade: p.cut_grade, origin: p.origin,
            treatment: p.treatment, certificate_provider: p.certificate_provider,
            certificate_number: p.certificate_number, certificate_url: p.certificate_url,
            lot_origin_weight: p.lot_origin_weight,
        } : null,
    })) as Product[];

    return { data, total: totalCount, totalPages: Math.ceil(totalCount / pageSize), totalValue: totalValueRow };
}

export async function addLotTrackingEntry(
    productId: number,
    entry: { date: string; action: string; weight_before?: number; weight_after?: number; notes?: string }
): Promise<{ success: boolean; error?: string }> {
    const db = await getDb();
    try {
        const gemRow = await db.prepare('SELECT lot_tracking FROM gem_details WHERE product_id = ? AND variant_id IS NULL').get(productId) as { lot_tracking: string | null } | undefined;
        if (!gemRow) return { success: false, error: 'No gem details found for this product' };

        const existing: any[] = gemRow.lot_tracking ? JSON.parse(gemRow.lot_tracking) : [];
        existing.push(entry);

        await db.prepare('UPDATE gem_details SET lot_tracking = ? WHERE product_id = ? AND variant_id IS NULL').run(JSON.stringify(existing), productId);

        // If weight_after is provided, update the carat_weight
        if (entry.weight_after !== undefined && entry.weight_after > 0) {
            await db.prepare('UPDATE gem_details SET carat_weight = ? WHERE product_id = ? AND variant_id IS NULL').run(entry.weight_after, productId);
        }

        revalidatePath('/inventory-management');
        revalidatePath('/products');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function getGemGradingHistory(productId: number) {
    const db = await getDb();
    const rows = await db.prepare(`
        SELECT ual.*, u.username
        FROM user_activity_log ual
        LEFT JOIN users u ON ual.user_id = u.id
        WHERE ual.action = 'GEM_GRADING_UPDATE' AND ual.entity_type = 'product' AND ual.entity_id = ?
        ORDER BY ual.timestamp DESC
    `).all(productId) as any[];
    return rows.map(r => ({
        ...r,
        old_values: r.old_values ? JSON.parse(r.old_values) : {},
        new_values: r.new_values ? JSON.parse(r.new_values) : {},
    }));
}
