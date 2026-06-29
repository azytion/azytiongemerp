'use server';

import { getDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { logDaybookEntry } from './daybook';
import { authError, requireAnyRole, userIdFromSession } from './authz';

export type Supplier = {
    id: number;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    balance: number;
    created_at: string;
    updated_at: string;
};

import { postSupplierSettlement } from './ledger';

import { PaginatedResult } from './types';

export async function getSuppliers(
    query: string = '',
    page: number = 1,
    pageSize: number = 10
): Promise<PaginatedResult<Supplier>> {
    try {
        await requireAnyRole(['cashier', 'manager', 'admin', 'super_admin']);
    } catch {
        return { data: [], total: 0, page, pageSize, totalPages: 0 };
    }

    const db = await getDb();
    const offset = (page - 1) * pageSize;

    let baseSql = 'FROM suppliers';
    const params: any[] = [];

    if (query) {
        baseSql += ' WHERE name LIKE ? OR phone LIKE ?';
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

    const suppliers = await db.prepare(sql).all(...params, Number(pageSize)|0, Number(offset)|0) as Supplier[];

    return {
        data: suppliers,
        total: totalCount.count,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount.count / pageSize)
    };
}

export async function getSupplier(id: number) {
    try {
        await requireAnyRole(['cashier', 'manager', 'admin', 'super_admin']);
    } catch {
        return undefined;
    }
    const db = await getDb();
    return await db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id) as Supplier | undefined;
}

export async function createSupplier(formData: FormData) {
    try {
        await requireAnyRole(['manager', 'admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db = await getDb();

    const supplier = {
        name: formData.get('name') as string,
        phone: (formData.get('phone') as string) || null,
        email: (formData.get('email') as string) || null,
        address: (formData.get('address') as string) || null,
    };

    try {
        await db.prepare(`
      INSERT INTO suppliers (name, phone, email, address)
      VALUES (@name, @phone, @email, @address)
    `).run(supplier);

        revalidatePath('/suppliers');
        return { success: true };
    } catch {
        return { success: false, error: 'Failed to create supplier' };
    }
}

export async function updateSupplier(id: number, formData: FormData) {
    try {
        await requireAnyRole(['manager', 'admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db = await getDb();

    const supplier = {
        id,
        name: formData.get('name') as string,
        phone: (formData.get('phone') as string) || null,
        email: (formData.get('email') as string) || null,
        address: (formData.get('address') as string) || null,
    };

    try {
        await db.prepare(`
      UPDATE suppliers 
      SET name = @name, phone = @phone, email = @email, address = @address, updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run(supplier);

        revalidatePath('/suppliers');
        return { success: true };
    } catch {
        return { success: false, error: 'Failed to update supplier' };
    }
}

export async function deleteSupplier(id: number) {
    try {
        await requireAnyRole(['admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db = await getDb();
    try {
        await db.prepare('DELETE FROM suppliers WHERE id = ?').run(id);
        revalidatePath('/suppliers');
        return { success: true };
    } catch (_error) {
        return { success: false, error: 'Failed to delete supplier' };
    }
}

export async function settleSupplierBalance(supplierId: number, amount: number, paymentMethod: string) {
    let session;
    try {
        session = await requireAnyRole(['manager', 'admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db = await getDb();

    try {
        const supplier = await db.prepare('SELECT name, balance FROM suppliers WHERE id = ?').get(supplierId) as { name: string, balance: number } | undefined;
        if (!supplier) return { success: false, error: 'Supplier not found' };

        if (amount <= 0) return { success: false, error: 'Invalid amount' };

        const transaction = db.transaction(async () => {
            // Update balance
            await db.prepare('UPDATE suppliers SET balance = balance - ? WHERE id = ?').run(amount, supplierId);

            // Update PO payment status using FIFO — mark oldest unpaid POs as paid
            const unpaidPOs = await db.prepare(`
                SELECT id, total_amount
                FROM purchase_orders
                WHERE supplier_id = ? AND status IN ('received', 'partial')
                ORDER BY date_created ASC
            `).all(supplierId) as any[];

            let remaining = amount;
            for (const po of unpaidPOs) {
                if (remaining <= 0) break;
                if (remaining >= po.total_amount - 0.01) {
                    await db.prepare(`UPDATE purchase_orders SET status = 'paid' WHERE id = ?`).run(po.id);
                    remaining -= po.total_amount;
                } else {
                    await db.prepare(`UPDATE purchase_orders SET status = 'partial' WHERE id = ?`).run(po.id);
                    remaining = 0;
                }
            }

            // Post to ledger
            postSupplierSettlement(supplierId, amount, paymentMethod, supplier.name);
        });

        await transaction();

        const userId = userIdFromSession(session);

        await logDaybookEntry(
            'supplier_settlement',
            amount,
            'supplier',
            supplierId,
            `Payment to ${supplier.name} (${paymentMethod})`,
            userId
        );

        revalidatePath('/inventory-management');
        revalidatePath('/reports');
        return { success: true };
    } catch {
        return { success: false, error: 'Failed to settle balance' };
    }
}

export interface SupplierTransaction {
    id: string;
    date: string;
    type: 'purchase' | 'payment' | 'return';
    invoice_number?: string;
    payment_method?: string;
    amount: number;
    status?: string;
}

export async function getSupplierTransactions(supplierId: number): Promise<SupplierTransaction[]> {
    try {
        await requireAnyRole(['cashier', 'manager', 'admin', 'super_admin']);
    } catch {
        return [];
    }
    const db = await getDb();

    // 1. Purchase Orders
    const purchases = await db.prepare(`
        SELECT 
            id,
            date_created as date,
            po_number as invoice_number,
            total_amount as amount,
            status
        FROM purchase_orders 
        WHERE supplier_id = ?
        ORDER BY date_created DESC
    `).all(supplierId) as any[];

    // 2. Payments from daybook (supplier_settlement entries)
    const payments = await db.prepare(`
        SELECT 
            id,
            date,
            description,
            debit as amount
        FROM daybook
        WHERE reference_type = 'supplier_settlement' AND reference_id = ?
          AND debit > 0
        ORDER BY date DESC
    `).all(supplierId) as any[];

    const formattedPurchases = purchases.map(p => ({
        id: `po-${p.id}`,
        date: p.date,
        type: 'purchase' as const,
        invoice_number: p.invoice_number,
        amount: p.amount,
        status: p.status,
    }));

    const formattedPayments = payments.map(p => ({
        id: `pay-${p.id}`,
        date: p.date,
        type: 'payment' as const,
        invoice_number: p.description,
        amount: p.amount,
        status: 'completed',
    }));

    return [...formattedPurchases, ...formattedPayments].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );
}
