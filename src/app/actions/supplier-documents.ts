'use server';

import { getDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { authError, requireAnyRole } from './authz';

export type SupplierDocument = {
    id: number;
    product_id: number | null;
    supplier_id: number | null;
    document_name: string;
    document_url: string;
    document_type: string;
    uploaded_at: string;
    notes: string | null;
};

export async function uploadSupplierDocument(data: {
    product_id?: number | null;
    supplier_id?: number | null;
    document_name: string;
    document_url: string;
    document_type?: string;
    notes?: string | null;
}) {
    try {
        await requireAnyRole(['manager', 'admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db = await getDb();
    try {
        const result = await db.prepare(`
            INSERT INTO supplier_documents (product_id, supplier_id, document_name, document_url, document_type, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            data.product_id || null,
            data.supplier_id || null,
            data.document_name,
            data.document_url,
            data.document_type || 'invoice',
            data.notes || null
        );
        revalidatePath('/products');
        return { success: true, id: Number(result.lastInsertRowid) };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getSupplierDocuments(productId?: number, supplierId?: number): Promise<SupplierDocument[]> {
    await requireAnyRole(['cashier', 'manager', 'admin', 'super_admin']);
    const db = await getDb();
    let sql = 'SELECT * FROM supplier_documents WHERE 1=1';
    const params: any[] = [];
    if (productId) { sql += ' AND product_id = ?'; params.push(productId); }
    if (supplierId) { sql += ' AND supplier_id = ?'; params.push(supplierId); }
    sql += ' ORDER BY uploaded_at DESC';
    return await db.prepare(sql).all(...params) as SupplierDocument[];
}

export async function deleteSupplierDocument(id: number) {
    try {
        await requireAnyRole(['manager', 'admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db = await getDb();
    try {
        await db.prepare('DELETE FROM supplier_documents WHERE id = ?').run(id);
        revalidatePath('/products');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
