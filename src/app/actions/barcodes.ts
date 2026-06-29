'use server';

import { getDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { authError, requireAnyRole } from './authz';

export async function generateBarcode(productId: number) {
    try {
        await requireAnyRole(['manager', 'admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db = await getDb();

    try {
        // Generate unique barcode
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        const barcode = `PROD-${timestamp}-${random}`;

        // Update product with barcode
        await db.prepare('UPDATE products SET barcode = ? WHERE id = ?').run(barcode, productId);

        revalidatePath('/products');
        return { success: true, data: { barcode } };
    } catch (error) {
        console.error('Error generating barcode:', error);
        return { success: false, error: 'Failed to generate barcode' };
    }
}

export async function generateBulkBarcodes(productIds: number[]) {
    try {
        await requireAnyRole(['manager', 'admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db = await getDb();

    try {
        const barcodes: { productId: number; barcode: string }[] = [];

        for (const productId of productIds) {
            const timestamp = Date.now().toString(36);
            const random = Math.random().toString(36).substring(2, 6).toUpperCase();
            const barcode = `PROD-${timestamp}-${random}`;

            await db.prepare('UPDATE products SET barcode = ? WHERE id = ?').run(barcode, productId);
            barcodes.push({ productId, barcode });
        }

        revalidatePath('/products');
        return { success: true, data: { barcodes } };
    } catch (error) {
        console.error('Error generating bulk barcodes:', error);
        return { success: false, error: 'Failed to generate barcodes' };
    }
}

import { PaginatedResult } from './types';

export async function getProductsWithoutBarcodes(query: string = '', page: number = 1, pageSize: number = 10): Promise<PaginatedResult<any>> {
    try {
        await requireAnyRole(['cashier', 'manager', 'admin', 'super_admin']);
    } catch {
        return { data: [], total: 0, page, pageSize, totalPages: 0 };
    }
    const db = await getDb();
    const offset = (page - 1) * pageSize;

    let baseSql = `FROM products WHERE (barcode IS NULL OR barcode = '')`;
    const params: any[] = [];

    if (query) {
        baseSql += ` AND (name LIKE ?)`;
        params.push(`%${query}%`);
    }

    const { total } = await db.prepare(`SELECT COUNT(*) as total ${baseSql}`).get(...params) as { total: number };

    const products = await db.prepare(`
        SELECT id, name, selling_price as price 
        ${baseSql}
        ORDER BY name
        LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset) as any[];

    return {
        data: products,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
    };
}

export async function getProductsWithBarcodes(query: string = '', page: number = 1, pageSize: number = 12): Promise<PaginatedResult<any>> {
    try {
        await requireAnyRole(['cashier', 'manager', 'admin', 'super_admin']);
    } catch {
        return { data: [], total: 0, page, pageSize, totalPages: 0 };
    }
    const db = await getDb();
    const offset = (page - 1) * pageSize;

    let baseSql = `FROM products WHERE (barcode IS NOT NULL AND barcode != '')`;
    const params: any[] = [];

    if (query) {
        baseSql += ` AND (name LIKE ? OR barcode LIKE ?)`;
        params.push(`%${query}%`, `%${query}%`);
    }

    const { total } = await db.prepare(`SELECT COUNT(*) as total ${baseSql}`).get(...params) as { total: number };

    const products = await db.prepare(`
        SELECT p.id, p.name, p.barcode, p.selling_price as price,
               g.carat_weight, g.shape
        FROM products p
        LEFT JOIN gem_details g ON g.product_id = p.id AND g.variant_id IS NULL
        WHERE (p.barcode IS NOT NULL AND p.barcode != '')
        ${query ? 'AND (p.name LIKE ? OR p.barcode LIKE ?)' : ''}
        ORDER BY p.name
        LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset) as any[];

    return {
        data: products,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
    };
}
