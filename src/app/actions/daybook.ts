'use server';


import { requireSession } from './authz';
import { getDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { nowLocalISO } from '@/lib/datetime';

export type DaybookEntry = {
    id: number;
    date: string;
    time: string;
    transaction_type: string;
    reference_type: string | null;
    reference_id: number | null;
    description: string | null;
    debit: number;
    credit: number;
    balance: number;
    user_id: number | null;
    created_at: string;
    username?: string;
};

export async function logDaybookEntry(
    type: string,
    amount: number,
    referenceType?: string,
    referenceId?: number,
    description?: string,
    userId?: number
) {
    await requireSession();
    const db = await getDb();

    try {
        const now = new Date();
        const _localNow = nowLocalISO();
        // Format date and time in the configured local timezone
        const { getConfiguredTimezone } = await import('@/lib/datetime');
        const tz = getConfiguredTimezone();
        const dtf = new Intl.DateTimeFormat('en-CA', {
            timeZone: tz,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false,
        });
        const parts = dtf.formatToParts(now);
        const get = (type: string) => parts.find(p => p.type === type)?.value || '00';
        const date = `${get('year')}-${get('month')}-${get('day')}`;
        let hour = get('hour'); if (hour === '24') hour = '00';
        const time = `${hour}:${get('minute')}:${get('second')}`;

        // Get current balance
        const lastEntry = await db.prepare(`
            SELECT balance FROM daybook 
            ORDER BY created_at DESC LIMIT 1
        `).get() as { balance: number } | undefined;

        const currentBalance = lastEntry?.balance || 0;

        // Determine debit/credit
        // Credit increases balance (Money In), Debit decreases balance (Money Out)
        const creditTypes = ['sale', 'deposit', 'income', 'customer_settlement', 'received_cheque_clearance'];
        const debitTypes = ['purchase', 'refund', 'withdrawal', 'expense', 'supplier_settlement', 'given_cheque_clearance'];

        let debit = 0;
        let credit = 0;

        if (creditTypes.includes(type)) {
            credit = Math.abs(amount);
        } else if (debitTypes.includes(type)) {
            debit = Math.abs(amount);
        } else {
            // Fallback for types not in list: positive is credit, negative is debit
            if (amount >= 0) credit = amount;
            else debit = Math.abs(amount);
        }

        const newBalance = currentBalance + credit - debit;

        await db.prepare(`
            INSERT INTO daybook 
            (date, time, transaction_type, reference_type, reference_id, description, debit, credit, balance, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(date, time, type, referenceType || null, referenceId || null, description || null, debit, credit, newBalance, userId || null);

        revalidatePath('/daybook');
        return { success: true, data: { newBalance } };
    } catch {
        return { success: false, error: 'Failed to log entry' };
    }
}

import { PaginatedResult } from './types';

export async function getDaybookEntries(
    date?: string,
    page: number = 1,
    pageSize: number = 50
): Promise<PaginatedResult<DaybookEntry>> {
    try {
        await requireSession();
    } catch {
        return { data: [], total: 0, page, pageSize, totalPages: 0 };
    }

    const db = await getDb();
    const offset = (page - 1) * pageSize;

    let baseSql = `
        FROM daybook d
        WHERE 1=1
    `;

    const params: any[] = [];

    if (date) {
        baseSql += ` AND d.date = ?`;
        params.push(date);
    }

    // Total count
    const totalCount = await db.prepare(`SELECT COUNT(*) as count ${baseSql}`).get(...params) as { count: number };

    // Paginated items
    const sql = `
        SELECT d.*
        ${baseSql}
        ORDER BY d.date DESC, d.time DESC
        LIMIT ? OFFSET ?
    `;

    const entries = await db.prepare(sql).all(...params, pageSize, offset) as DaybookEntry[];

    return {
        data: entries,
        total: totalCount.count,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount.count / pageSize)
    };
}

export async function getDailySummary(date: string) {
    await requireSession();
    const db = await getDb();

    try {
        const summary = await db.prepare(`
            SELECT 
                MIN(balance) as opening_balance,
                MAX(balance) as closing_balance,
                SUM(debit) as total_debit,
                SUM(credit) as total_credit,
                COUNT(*) as total_transactions
            FROM daybook
            WHERE date = ?
        `).get(date) as any;

        // Get opening balance from previous day's closing
        const prevDay = new Date(date + 'T12:00:00'); // noon to avoid DST issues
        prevDay.setDate(prevDay.getDate() - 1);
        const prevDayStr = `${prevDay.getFullYear()}-${String(prevDay.getMonth() + 1).padStart(2, '0')}-${String(prevDay.getDate()).padStart(2, '0')}`;

        const prevClosing = await db.prepare(`
            SELECT balance FROM daybook 
            WHERE date = ?
            ORDER BY date DESC, time DESC LIMIT 1
        `).get(prevDayStr) as { balance: number } | undefined;

        return {
            date,
            opening_balance: prevClosing?.balance || 0,
            closing_balance: summary?.closing_balance || 0,
            total_debit: summary?.total_debit || 0,
            total_credit: summary?.total_credit || 0,
            total_transactions: summary?.total_transactions || 0,
            net_change: (summary?.total_credit || 0) - (summary?.total_debit || 0)
        };
    } catch (_error) {
        // Return empty summary if table doesn't exist or is empty
        return {
            date,
            opening_balance: 0,
            closing_balance: 0,
            total_debit: 0,
            total_credit: 0,
            total_transactions: 0,
            net_change: 0
        };
    }
}

export async function getMonthlyReport(month: number, year: number) {
    await requireSession();
    const db = await getDb();

    const entries = await db.prepare(`
        SELECT 
            date,
            SUM(debit) as total_debit,
            SUM(credit) as total_credit,
            COUNT(*) as transactions
        FROM daybook
        WHERE MONTH(date) = ? AND YEAR(date) = ?
        GROUP BY date
        ORDER BY date
    `).all(month, year) as any[];

    return entries;
}

export async function exportDaybookToExcel(startDate: string, endDate: string) {
    await requireSession();
    const db = await getDb();

    const entries = await db.prepare(`
        SELECT 
            d.date,
            d.time,
            d.transaction_type,
            d.reference_type,
            d.reference_id,
            d.description,
            d.debit,
            d.credit,
            d.balance
        FROM daybook d
        WHERE (d.date BETWEEN ? AND ?)
        ORDER BY d.date, d.time
    `).all(startDate, endDate) as any[];

    return entries;
}
