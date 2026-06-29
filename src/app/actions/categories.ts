'use server';

import { getDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { logActivity } from './activity-logger';
import { authError, requireAnyRole, userIdFromSession } from './authz';

export type Category = {
    id: number;
    name: string;
    description?: string;
    created_at: string;
};

import { PaginatedResult } from './types';

export async function getCategories(
    query: string = '',
    page: number = 1,
    pageSize: number = 10
): Promise<PaginatedResult<Category>> {
    try {
        await requireAnyRole(['cashier', 'manager', 'admin', 'super_admin']);
    } catch {
        return { data: [], total: 0, page, pageSize, totalPages: 0 };
    }

    const db = await getDb();
    const offset = (page - 1) * pageSize;

    let baseSql = 'FROM categories';
    const params: any[] = [];

    if (query) {
        baseSql += ' WHERE name LIKE ? OR description LIKE ?';
        params.push(`%${query}%`, `%${query}%`);
    }

    // Total count
    const totalCount = await db.prepare(`SELECT COUNT(*) as count ${baseSql}`).get(...params) as { count: number };

    // Paginated items
    const sql = `
        SELECT * ${baseSql}
        ORDER BY name ASC
        LIMIT ? OFFSET ?
    `;

    const categories = await db.prepare(sql).all(...params, pageSize, offset) as Category[];

    return {
        data: categories,
        total: totalCount.count,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount.count / pageSize)
    };
}

export async function createCategory(formData: FormData) {
    let session;
    try {
        session = await requireAnyRole(['manager', 'admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db = await getDb();
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;

    if (!name) {
        return { success: false, error: 'Category name is required' };
    }

    try {
        const result = await db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)').run(name, description);
        await logActivity(userIdFromSession(session), 'CREATE', 'category', Number(result.lastInsertRowid), null, { name });
        revalidatePath('/products');
        return { success: true };
    } catch (_error) {
        return { success: false, error: 'Category already exists or database error' };
    }
}

export async function deleteCategory(id: number) {
    let session;
    try {
        session = await requireAnyRole(['admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db = await getDb();

    try {
        // Check if any products use this category
        const count = await db.prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ?').get(id) as { count: number };

        if (count.count > 0) {
            return { success: false, error: `Cannot delete category. ${count.count} product(s) are using it.` };
        }

        await db.prepare('DELETE FROM categories WHERE id = ?').run(id);
        await logActivity(userIdFromSession(session), 'DELETE', 'category', id);
        revalidatePath('/products');
        return { success: true };
    } catch (_error) {
        return { success: false, error: 'Failed to delete category' };
    }
}
