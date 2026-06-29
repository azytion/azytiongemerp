'use server';

import { requireSession } from './authz';
import { todayLocalDate } from '@/lib/datetime';

import { getDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/app/actions/auth';
import { logDaybookEntry } from './daybook';
import { createJournalEntry } from './ledger';

export type Cheque = {
    id: number;
    cheque_number: string;
    bank_name: string;
    account_number: string | null;
    amount: number;
    issue_date: string;
    due_date: string;
    status: string;
    payee_name: string | null;
    reference_type: string | null;
    reference_id: number | null;
    notes: string | null;
    cleared_date: string | null;
    user_id: number | null;
    created_at: string;
    username?: string;
};

export type ChequeHistory = {
    id: number;
    cheque_id: number;
    action: string;
    old_value: string | null;
    new_value: string | null;
    notes: string | null;
    user_id: number | null;
    timestamp: string;
    username?: string;
};

async function logChequeHistory(
    chequeId: number,
    action: string,
    oldValue: string | null = null,
    newValue: string | null = null,
    notes: string | null = null
) {
    const db = await getDb();
    const session = await getSession();
    const userId = session?.sub ? Number(session.sub) : null;

    await db.prepare(`
        INSERT INTO cheque_history (cheque_id, action, old_value, new_value, notes, user_id)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(chequeId, action, oldValue, newValue, notes, userId);
}

export async function createCheque(formData: FormData) {
    await requireSession();
    const db = await getDb();

    try {
        const chequeNumber = formData.get('cheque_number') as string;
        const bankName = formData.get('bank_name') as string;
        const accountNumber = formData.get('account_number') as string | null;
        const amount = Number(formData.get('amount'));
        const issueDate = formData.get('issue_date') as string;
        const dueDate = formData.get('due_date') as string;
        const payeeName = formData.get('payee_name') as string | null;
        const notes = formData.get('notes') as string | null;

        const result = await db.prepare(`
            INSERT INTO cheques 
            (cheque_number, bank_name, account_number, amount, issue_date, due_date, payee_name, notes, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
        `).run(chequeNumber, bankName, accountNumber, amount, issueDate, dueDate, payeeName, notes);

        // Log creation in history
        await logChequeHistory(
            Number(result.lastInsertRowid),
            'created',
            null,
            JSON.stringify({ chequeNumber, bankName, amount, issueDate, dueDate, status: 'pending' }),
            'Cheque created'
        );

        revalidatePath('/cheques');
        return { success: true, data: { id: result.lastInsertRowid } };
    } catch (error) {
        console.error('Error creating cheque:', error);
        return { success: false, error: 'Failed to create cheque' };
    }
}

import { PaginatedResult } from './types';

export async function getCheques(
    status?: string,
    page: number = 1,
    pageSize: number = 50
): Promise<PaginatedResult<Cheque>> {
    const db = await getDb();
    const offset = (page - 1) * pageSize;

    let baseSql = `
        FROM cheques c
        LEFT JOIN users u ON c.user_id = u.id
    `;

    const params: any[] = [];

    if (status) {
        baseSql += ` WHERE c.status = ?`;
        params.push(status);
    }

    // Total count
    const totalCount = await db.prepare(`SELECT COUNT(*) as count ${baseSql}`).get(...params) as { count: number };

    // Paginated items
    const sql = `
        SELECT 
            c.*,
            u.username
        ${baseSql}
        ORDER BY c.due_date ASC
        LIMIT ? OFFSET ?
    `;

    const cheques = await db.prepare(sql).all(...params, Number(pageSize)|0, Number(offset)|0) as Cheque[];

    return {
        data: cheques,
        total: totalCount.count,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount.count / pageSize)
    };
}

export async function getCheque(id: number) {
    await requireSession();
    const db = await getDb();

    const cheque = await db.prepare(`
        SELECT 
            c.*,
            u.username
        FROM cheques c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.id = ?
    `).get(id) as Cheque | undefined;

    return cheque || null;
}

export async function updateChequeStatus(
    id: number,
    status: 'pending' | 'cleared' | 'bounced' | 'cancelled',
    clearedDate?: string
) {
    await requireSession();
    const db = await getDb();
    const session = await getSession();
    const userId = session?.sub ? Number(session.sub) : 1;

    try {
        // Get full cheque details for history and daybook
        const cheque = await db.prepare('SELECT * FROM cheques WHERE id = ?').get(id) as Cheque | undefined;
        if (!cheque) return { success: false, error: 'Cheque not found' };

        const oldStatus = cheque.status || 'unknown';

        if (status === 'cleared' && clearedDate) {
            await db.prepare(`
                UPDATE cheques 
                SET status = ?, cleared_date = ?
                WHERE id = ?
            `).run(status, clearedDate, id);

            // Log to Daybook on clearance
            const isReceived = cheque.reference_type === 'sale';
            const type = isReceived ? 'deposit' : 'withdrawal';
            const description = isReceived
                ? `Cheque Cleared: #${cheque.cheque_number} (From Customer)`
                : `Cheque Cleared: #${cheque.cheque_number} (To ${cheque.payee_name || 'Supplier'})`;

            await logDaybookEntry(
                type,
                cheque.amount,
                'cheque',
                id,
                description,
                userId
            );

            // Post to ledger: Debit Bank (1120), Credit Cheques In Hand (1115)
            try {
                const bankAcc = await db.prepare('SELECT id FROM accounts WHERE account_code = ?').get('1120') as { id: number } | undefined;
                const chequeAcc = await db.prepare('SELECT id FROM accounts WHERE account_code = ?').get('1115') as { id: number } | undefined;
                if (bankAcc && chequeAcc) {
                    await createJournalEntry(
                        clearedDate,
                        `Cheque Cleared: #${cheque.cheque_number}`,
                        [
                            { accountId: bankAcc.id, debit: cheque.amount, credit: 0, description: 'Cheque deposited to bank' },
                            { accountId: chequeAcc.id, debit: 0, credit: cheque.amount, description: 'Cheque cleared from hand' }
                        ],
                        'cheque',
                        id
                    );
                }
            } catch (e) { console.error('Cheque cleared journal entry failed:', e); }
        } else if (status === 'bounced') {
            await db.prepare(`
                UPDATE cheques 
                SET status = ?
                WHERE id = ?
            `).run(status, id);

            // Post to ledger: Debit Accounts Receivable (1140), Credit Cheques In Hand (1115)
            try {
                const receivableAcc = await db.prepare('SELECT id FROM accounts WHERE account_code = ?').get('1140') as { id: number } | undefined;
                const chequeAcc = await db.prepare('SELECT id FROM accounts WHERE account_code = ?').get('1115') as { id: number } | undefined;
                if (receivableAcc && chequeAcc) {
                    await createJournalEntry(
                        todayLocalDate(),
                        `Cheque Bounced: #${cheque.cheque_number}`,
                        [
                            { accountId: receivableAcc.id, debit: cheque.amount, credit: 0, description: 'Bounced cheque receivable' },
                            { accountId: chequeAcc.id, debit: 0, credit: cheque.amount, description: 'Cheque removed from hand' }
                        ],
                        'cheque',
                        id
                    );
                }
            } catch (e) { console.error('Cheque bounced journal entry failed:', e); }
        } else {
            await db.prepare(`
                UPDATE cheques 
                SET status = ?
                WHERE id = ?
            `).run(status, id);
        }

        // Log status change in history
        await logChequeHistory(
            id,
            'status_change',
            oldStatus,
            status,
            `Status changed from ${oldStatus} to ${status}`
        );

        revalidatePath('/cheques');
        revalidatePath('/finance');
        revalidatePath('/reports');
        return { success: true };
    } catch (error) {
        console.error('Error updating cheque status:', error);
        return { success: false, error: 'Failed to update status' };
    }
}

export async function getDueCheques() {
    await requireSession();
    const db = await getDb();

    const today = todayLocalDate();
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nw = nextWeek;
    const nextWeekStr = `${nw.getFullYear()}-${String(nw.getMonth()+1).padStart(2,'0')}-${String(nw.getDate()).padStart(2,'0')}`;

    const cheques = await db.prepare(`
        SELECT * FROM cheques
        WHERE status = 'pending'
        AND due_date BETWEEN ? AND ?
        ORDER BY due_date ASC
    `).all(today, nextWeekStr) as Cheque[];

    return cheques;
}

export async function getOverdueCheques() {
    await requireSession();
    const db = await getDb();

    const today = todayLocalDate();

    const cheques = await db.prepare(`
        SELECT * FROM cheques
        WHERE status = 'pending'
        AND due_date < ?
        ORDER BY due_date ASC
    `).all(today) as Cheque[];

    return cheques;
}

export async function deleteCheque(id: number) {
    await requireSession();
    const db = await getDb();

    try {
        // Get cheque details for history before deletion
        const cheque = await db.prepare('SELECT cheque_number, bank_name, amount FROM cheques WHERE id = ?').get(id) as any;

        if (cheque) {
            // Log deletion in history
            await logChequeHistory(
                id,
                'deleted',
                JSON.stringify({ cheque_number: cheque.cheque_number, bank_name: cheque.bank_name, amount: cheque.amount }),
                null,
                'Cheque deleted'
            );
        }

        await db.prepare('DELETE FROM cheques WHERE id = ?').run(id);
        revalidatePath('/cheques');
        return { success: true };
    } catch (error) {
        console.error('Error deleting cheque:', error);
        return { success: false, error: 'Failed to delete cheque' };
    }
}

export async function getChequeStats() {
    await requireSession();
    const db = await getDb();

    const stats = await db.prepare(`
        SELECT 
            COUNT(*) as total_cheques,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
            COUNT(CASE WHEN status = 'cleared' THEN 1 END) as cleared,
            COUNT(CASE WHEN status = 'bounced' THEN 1 END) as bounced,
            SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_amount,
            SUM(CASE WHEN status = 'cleared' THEN amount ELSE 0 END) as cleared_amount
        FROM cheques
    `).get() as any;

    return stats;
}

export async function getChequeHistory(chequeId: number) {
    await requireSession();
    const db = await getDb();

    const history = await db.prepare(`
        SELECT 
            ch.*,
            u.username
        FROM cheque_history ch
        LEFT JOIN users u ON ch.user_id = u.id
        WHERE ch.cheque_id = ?
        ORDER BY ch.timestamp DESC
    `).all(chequeId) as ChequeHistory[];

    return history;
}

