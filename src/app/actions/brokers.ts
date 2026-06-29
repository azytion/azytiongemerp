'use server';

import { getDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { authError, requireAnyRole } from './authz';

export type Broker = {
    id: number;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    notes: string | null;
    is_active: number;
    created_at: string;
    updated_at: string;
};

export async function getBrokers() {
    try {
        await requireAnyRole(['cashier', 'manager', 'admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db = await getDb();
    try {
        const brokers = await db.prepare('SELECT * FROM brokers ORDER BY name ASC').all() as Broker[];
        return { success: true, brokers };
    } catch {
        return { success: false, error: 'Failed to load brokers' };
    }
}

export async function createBroker(formData: FormData) {
    try {
        await requireAnyRole(['manager', 'admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db = await getDb();

    const name = formData.get('name') as string;
    const phone = formData.get('phone') as string;
    const email = formData.get('email') as string;
    const address = formData.get('address') as string;
    const notes = formData.get('notes') as string;

    try {
        await db.prepare(`
            INSERT INTO brokers (name, phone, email, address, notes)
            VALUES (?, ?, ?, ?, ?)
        `).run(name, phone || null, email || null, address || null, notes || null);

// Fix the stray comment that ended up in the code
        revalidatePath('/brokers');
        return { success: true };
    } catch {
        return { success: false, error: 'Failed to create broker' };
    }
}

export async function updateBroker(id: number, formData: FormData) {
    try {
        await requireAnyRole(['manager', 'admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db = await getDb();

    const name = formData.get('name') as string;
    const phone = formData.get('phone') as string;
    const email = formData.get('email') as string;
    const address = formData.get('address') as string;
    const notes = formData.get('notes') as string;
    const is_active = formData.get('is_active') === 'on' ? 1 : 0;

    try {
        await db.prepare(`
            UPDATE brokers 
            SET name = ?, phone = ?, email = ?, address = ?, notes = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(name, phone || null, email || null, address || null, notes || null, is_active, id);

        revalidatePath('/brokers');
        return { success: true };
    } catch {
        return { success: false, error: 'Failed to update broker' };
    }
}

export async function deleteBroker(id: number) {
    try {
        await requireAnyRole(['admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db = await getDb();
    try {
        // Check if broker is linked to any sales
        const linkedSales = await db.prepare('SELECT COUNT(*) as count FROM sales WHERE broker_id = ?').get(id) as { count: number };
        if (linkedSales.count > 0) {
            return { success: false, error: 'Cannot delete broker linked to sales records. Deactivate them instead.' };
        }

        await db.prepare('DELETE FROM brokers WHERE id = ?').run(id);
        revalidatePath('/brokers');
        return { success: true };
    } catch {
        return { success: false, error: 'Failed to delete broker' };
    }
}

export async function getBrokerCommissionReport(dateRange?: { start: string; end: string }, search?: string) {
    try {
        await requireAnyRole(['manager', 'admin', 'super_admin']);
    } catch (error) {
        return authError(error) as any;
    }
    const db = await getDb();

    let where = 'WHERE s.broker_id IS NOT NULL AND s.status = \'completed\'';
    const params: any[] = [];

    if (dateRange) {
        where += ' AND date(s.date) >= date(?) AND date(s.date) <= date(?)';
        params.push(dateRange.start, dateRange.end);
    }
    if (search) {
        where += ' AND b.name LIKE ?';
        params.push(`%${search}%`);
    }

    return await db.prepare(`
        SELECT
            b.id as broker_id,
            b.name as broker_name,
            b.phone as broker_phone,
            COUNT(s.id) as total_sales,
            SUM(s.total_amount) as total_sale_value,
            SUM(s.broker_commission) as total_commission,
            MAX(s.date) as last_sale_date
        FROM sales s
        JOIN brokers b ON s.broker_id = b.id
        ${where}
        GROUP BY b.id, b.name, b.phone
        ORDER BY total_commission DESC
    `).all(...params) as any[];
}

export async function getBrokerSalesDetail(brokerId: number, dateRange?: { start: string; end: string }) {
    try {
        await requireAnyRole(['manager', 'admin', 'super_admin']);
    } catch (error) {
        return authError(error) as any;
    }
    const db = await getDb();

    let where = 'WHERE s.broker_id = ? AND s.status = \'completed\'';
    const params: any[] = [brokerId];

    if (dateRange) {
        where += ' AND date(s.date) >= date(?) AND date(s.date) <= date(?)';
        params.push(dateRange.start, dateRange.end);
    }

    return await db.prepare(`
        SELECT
            s.id, s.invoice_number, s.date, s.total_amount,
            s.broker_commission,
            COALESCE(c.name, 'Walk-in') as customer_name
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        ${where}
        ORDER BY s.date DESC
    `).all(...params) as any[];
}
