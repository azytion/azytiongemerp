'use server';


import { requireSession } from './authz';
import { getDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { getSession } from './auth';
import { logDaybookEntry } from './daybook';
import { PaginatedResult } from './types';
import { todayLocalDate } from '@/lib/datetime';

export type Account = {
    id: number;
    account_code: string;
    account_name: string;
    account_type: string;
    parent_account_id: number | null;
    balance: number;
    is_active: number;
    created_at: string;
};

export type JournalEntry = {
    id: number;
    entry_number: string;
    date: string;
    description: string | null;
    reference_type: string | null;
    reference_id: number | null;
    user_id: number | null;
    created_at: string;
};

// Initialize default chart of accounts
export async function initializeChartOfAccounts() {
    await requireSession();
    const db = await getDb();

    const defaultAccounts = [
        // Assets
        { code: '1000', name: 'Assets', type: 'asset', parent: null },
        { code: '1100', name: 'Current Assets', type: 'asset', parent: '1000' },
        { code: '1110', name: 'Cash', type: 'asset', parent: '1100' },
        { code: '1115', name: 'Cheques In Hand', type: 'asset', parent: '1100' },
        { code: '1120', name: 'Bank Account', type: 'asset', parent: '1100' },
        { code: '1130', name: 'Inventory', type: 'asset', parent: '1100' },
        { code: '1140', name: 'Accounts Receivable', type: 'asset', parent: '1100' },

        // Liabilities
        { code: '2000', name: 'Liabilities', type: 'liability', parent: null },
        { code: '2100', name: 'Current Liabilities', type: 'liability', parent: '2000' },
        { code: '2110', name: 'Accounts Payable', type: 'liability', parent: '2100' },

        // Equity
        { code: '3000', name: 'Equity', type: 'equity', parent: null },
        { code: '3100', name: 'Owner Equity', type: 'equity', parent: '3000' },

        // Revenue
        { code: '4000', name: 'Revenue', type: 'revenue', parent: null },
        { code: '4100', name: 'Sales Revenue', type: 'revenue', parent: '4000' },

        // Expenses
        { code: '5000', name: 'Expenses', type: 'expense', parent: null },
        { code: '5100', name: 'Cost of Goods Sold', type: 'expense', parent: '5000' },
        { code: '5200', name: 'Operating Expenses', type: 'expense', parent: '5000' },
    ];

    try {
        for (const acc of defaultAccounts) {
            const parentId = acc.parent
                ? await db.prepare('SELECT id FROM accounts WHERE account_code = ?').get(acc.parent) as { id: number } | undefined
                : null;

            await db.prepare(`
                INSERT OR IGNORE INTO accounts (account_code, account_name, account_type, parent_account_id)
                VALUES (?, ?, ?, ?)
            `).run(acc.code, acc.name, acc.type, parentId?.id || null);
        }

        return { success: true };
    } catch (error) {
        console.error('Error initializing accounts:', error);
        return { success: false, error: 'Failed to initialize accounts' };
    }
}

export async function getAccounts(
    page: number = 1,
    pageSize: number = 20
): Promise<PaginatedResult<Account>> {
    await requireSession();
    const db = await getDb();
    const offset = (page - 1) * pageSize;

    // Total count
    const totalCount = await db.prepare('SELECT COUNT(*) as count FROM accounts WHERE is_active = 1').get() as { count: number };

    // Auto-initialize if empty
    if (totalCount.count === 0 && page === 1) {
        await initializeChartOfAccounts();
    }

    // Compute live balances from journal entry lines (more accurate than stored balance)
    const accounts = await db.prepare(`
        SELECT 
            a.*,
            COALESCE(SUM(jel.debit - jel.credit), 0) as computed_balance
        FROM accounts a
        LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
        WHERE a.is_active = 1
        GROUP BY a.id
        ORDER BY a.account_code
        LIMIT ? OFFSET ?
    `).all(pageSize, offset) as any[];

    // Use computed_balance if stored balance is 0 but computed is not
    const enriched = accounts.map(acc => ({
        ...acc,
        balance: acc.computed_balance !== 0 ? acc.computed_balance : acc.balance,
    }));

    const retotalCount = await db.prepare('SELECT COUNT(*) as count FROM accounts WHERE is_active = 1').get() as { count: number };

    return {
        data: enriched,
        total: retotalCount.count,
        page,
        pageSize,
        totalPages: Math.ceil(retotalCount.count / pageSize)
    };
}

export async function createJournalEntry(
    date: string,
    description: string,
    lines: { accountId: number; debit: number; credit: number; description?: string }[],
    referenceType?: string,
    referenceId?: number
) {
    await requireSession();
    const db = await getDb();
    const session = await getSession();
    const currentUserId = session ? Number(session.sub) : 1;

    try {
        // Validate debits = credits
        const totalDebits = lines.reduce((sum, line) => sum + line.debit, 0);
        const totalCredits = lines.reduce((sum, line) => sum + line.credit, 0);

        if (Math.abs(totalDebits - totalCredits) > 0.01) {
            return { success: false, error: 'Debits must equal credits' };
        }

        const action = db.transaction(async () => {
            // Generate entry number
            const entryNumber = `JE-${Date.now()}`;

            // Create journal entry
            const entry = await db.prepare(`
                INSERT INTO journal_entries (entry_number, date, description, reference_type, reference_id, user_id)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(entryNumber, date, description, referenceType || null, referenceId || null, currentUserId);

            const entryId = entry.lastInsertRowid;

            // Create entry lines
            for (const line of lines) {
                await db.prepare(`
                    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
                    VALUES (?, ?, ?, ?, ?)
                `).run(entryId, line.accountId, line.debit, line.credit, line.description || null);

                // Update account balance (Global balance on accounts table)
                const netChange = line.debit - line.credit;
                await db.prepare(`
                    UPDATE accounts 
                    SET balance = balance + ?
                    WHERE id = ?
                `).run(netChange, line.accountId);
            }

            return { entryId, entryNumber };
        });

        const data = await action();

        // 4. Log to Daybook if any line involves Cash or Bank
        try {
            const cashAcc = await db.prepare('SELECT id FROM accounts WHERE account_code = ?').get('1110') as { id: number } | undefined;
            const bankAcc = await db.prepare('SELECT id FROM accounts WHERE account_code = ?').get('1120') as { id: number } | undefined;

            for (const line of lines) {
                if (line.accountId === cashAcc?.id || line.accountId === bankAcc?.id) {
                    const type = line.debit > 0 ? 'income' : 'expense';
                    const amount = line.debit > 0 ? line.debit : line.credit;
                    if (amount > 0) {
                        const accountName = line.accountId === cashAcc?.id ? 'Cash' : 'Bank';
                        await logDaybookEntry(
                            type,
                            amount,
                            'ledger',
                            Number(data.entryId),
                            `${description}${line.description ? ' - ' + line.description : ''} (${accountName})`,
                            currentUserId
                        );
                    }
                }
            }
        } catch (dbError) {
            console.error('Error logging to daybook from ledger:', dbError);
        }

        revalidatePath('/ledger');
        return { success: true, data };
    } catch (error) {
        console.error('Error creating journal entry:', error);
        return { success: false, error: 'Failed to create journal entry' };
    }
}

export async function getJournalEntries(
    page: number = 1,
    pageSize: number = 50
): Promise<PaginatedResult<JournalEntry>> {
    await requireSession();
    const db = await getDb();
    const offset = (page - 1) * pageSize;

    const totalCount = await db.prepare('SELECT COUNT(*) as count FROM journal_entries').get() as { count: number };

    const entries = await db.prepare(`
        SELECT * FROM journal_entries
        ORDER BY date DESC, created_at DESC
        LIMIT ? OFFSET ?
    `).all(pageSize, offset) as JournalEntry[];

    return {
        data: entries,
        total: totalCount.count,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount.count / pageSize)
    };
}

export async function getJournalEntry(id: number) {
    await requireSession();
    const db = await getDb();

    const entry = await db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(id) as JournalEntry | undefined;
    if (!entry) return null;

    const lines = await db.prepare(`
        SELECT 
            jel.*,
            a.account_code,
            a.account_name
        FROM journal_entry_lines jel
        LEFT JOIN accounts a ON jel.account_id = a.id
        WHERE jel.journal_entry_id = ?
    `).all(id) as any[];

    return { ...entry, lines };
}

export async function getTrialBalance() {
    await requireSession();
    const db = await getDb();

    // Compute live balances from journal entry lines
    const accounts = await db.prepare(`
        SELECT 
            a.account_code,
            a.account_name,
            a.account_type,
            COALESCE(SUM(jel.debit - jel.credit), 0) as balance
        FROM accounts a
        LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
        WHERE a.is_active = 1
        GROUP BY a.id
        HAVING balance != 0
        ORDER BY a.account_code
    `).all() as any[];

    const totalDebits = accounts
        .filter(a => a.balance > 0)
        .reduce((sum, a) => sum + a.balance, 0);

    const totalCredits = accounts
        .filter(a => a.balance < 0)
        .reduce((sum, a) => sum + Math.abs(a.balance), 0);

    return { accounts, totalDebits, totalCredits };
}

// Auto-post sale to journal (Simple Cash)
export async function postSaleToJournal(saleId: number, amount: number) {
    await requireSession();
    return postComplexSaleToJournal(saleId, amount, amount, 'Cash');
}

// Complex Sale Posting — maps payment method to correct ledger account
export async function postComplexSaleToJournal(saleId: number, totalAmount: number, paidAmount: number, paymentMethod: string) {
    await requireSession();
    const db = await getDb();

    const getAccId = async (code: string) => {
        const acc = await db.prepare('SELECT id FROM accounts WHERE account_code = ?').get(code) as { id: number } | undefined;
        return acc ? acc.id : null;
    };

    let cashId = await getAccId('1110');
    let bankId = await getAccId('1120');
    let chequeId = await getAccId('1115');
    let receivableId = await getAccId('1140');
    let revenueId = await getAccId('4100');

    if (!cashId || !receivableId || !revenueId) {
        await initializeChartOfAccounts();
        cashId = await getAccId('1110');
        bankId = await getAccId('1120');
        chequeId = await getAccId('1115');
        receivableId = await getAccId('1140');
        revenueId = await getAccId('4100');
    }

    if (!cashId) throw new Error("Chart of Accounts Error: Cash account (1110) not found.");
    if (!revenueId) throw new Error("Chart of Accounts Error: Sales Revenue (4100) not found.");

    // Map payment method to the correct debit account
    const pm = paymentMethod?.toLowerCase() || 'cash';
    let debitAccountId = cashId; // default: cash
    if (pm === 'bank') debitAccountId = bankId || cashId;
    else if (pm === 'cheque') debitAccountId = chequeId || cashId;
    else if (pm === 'due' || pm === 'credit') debitAccountId = receivableId || cashId;

    const lines = [];

    // 1. Debit payment account (paid amount)
    if (paidAmount > 0 && pm !== 'due' && pm !== 'credit') {
        lines.push({ accountId: debitAccountId, debit: paidAmount, credit: 0, description: `Payment Received (${paymentMethod})` });
    }

    // 2. Debit Receivable (unpaid balance or full amount for Due/Credit)
    const dueAmount = totalAmount - (pm === 'due' || pm === 'credit' ? 0 : paidAmount);
    if (dueAmount > 0.01 || pm === 'due' || pm === 'credit') {
        const actualDue = pm === 'due' || pm === 'credit' ? totalAmount : dueAmount;
        if (actualDue > 0.01 && receivableId) {
            lines.push({ accountId: receivableId, debit: actualDue, credit: 0, description: 'Amount Due' });
        }
    }

    // 3. Credit Revenue (total sale)
    lines.push({ accountId: revenueId, debit: 0, credit: totalAmount, description: 'Sales Revenue' });

    return createJournalEntry(
        todayLocalDate(),
        `Sale #${saleId} - ${paymentMethod}`,
        lines,
        'sale',
        saleId
    );
}

// Post Customer Settlement (Paying off Due)
export async function postCustomerSettlement(customerId: number, amount: number, paymentMethod: string, customerName: string) {
    await requireSession();
    const db = await getDb();
    const getAccId = async (code: string) => {
        const acc = await db.prepare('SELECT id FROM accounts WHERE account_code = ?').get(code) as { id: number } | undefined;
        return acc ? acc.id : null;
    };

    let cashId = await getAccId('1110');
    let receivableId = await getAccId('1140');

    if (!cashId || !receivableId) {
        await initializeChartOfAccounts();
        cashId = await getAccId('1110');
        receivableId = await getAccId('1140');
    }

    if (!cashId) throw new Error("Chart of Accounts Error: Cash account (1110) not found.");
    if (!receivableId) throw new Error("Chart of Accounts Error: Accounts Receivable (1140) not found.");

    return createJournalEntry(
        todayLocalDate(),
        `Settlement from ${customerName}`,
        [
            { accountId: cashId, debit: amount, credit: 0, description: `Settlement via ${paymentMethod}` },
            { accountId: receivableId, debit: 0, credit: amount, description: 'Receivable Paid' }
        ],
        'customer_payment',
        customerId
    );
}

// Post Purchase (Inventory Receipt)
export async function postPurchaseToJournal(poId: number, totalAmount: number, paidAmount: number, paymentMethod: string, summary: string) {
    await requireSession();
    const db = await getDb();

    const getAccId = async (code: string) => {
        const acc = await db.prepare('SELECT id FROM accounts WHERE account_code = ?').get(code) as { id: number } | undefined;
        return acc ? acc.id : null;
    };

    let cashId = await getAccId('1110');
    let inventoryId = await getAccId('1130');
    let payableId = await getAccId('2110');

    if (!cashId || !inventoryId || !payableId) {
        await initializeChartOfAccounts();
        cashId = await getAccId('1110');
        inventoryId = await getAccId('1130');
        payableId = await getAccId('2110');
    }

    if (!cashId) throw new Error("Chart of Accounts Error: Cash account (1110) not found.");
    if (!inventoryId) throw new Error("Chart of Accounts Error: Inventory account (1130) not found.");
    if (!payableId) throw new Error("Chart of Accounts Error: Accounts Payable (2110) not found.");

    const lines = [];

    // 1. Debit Inventory (Total Value)
    lines.push({ accountId: inventoryId, debit: totalAmount, credit: 0, description: 'Inventory Received' });

    // 2. Credit Cash (Paid Amount)
    if (paidAmount > 0) {
        lines.push({ accountId: cashId, debit: 0, credit: paidAmount, description: `Paid ${paymentMethod}` });
    }

    // 3. Credit Accounts Payable (Remaining)
    const dueAmount = totalAmount - paidAmount;
    if (dueAmount > 0.01) {
        lines.push({ accountId: payableId, debit: 0, credit: dueAmount, description: 'Amount Due' });
    }

    return createJournalEntry(
        todayLocalDate(),
        summary,
        lines,
        'purchase',
        poId
    );
}

// Post Supplier Settlement (Paying off Due)
export async function postSupplierSettlement(supplierId: number, amount: number, paymentMethod: string, supplierName: string) {
    await requireSession();
    const db = await getDb();
    const getAccId = async (code: string) => {
        const acc = await db.prepare('SELECT id FROM accounts WHERE account_code = ?').get(code) as { id: number } | undefined;
        return acc ? acc.id : null;
    };

    let cashId = await getAccId('1110');
    let payableId = await getAccId('2110');

    if (!cashId || !payableId) {
        await initializeChartOfAccounts();
        cashId = await getAccId('1110');
        payableId = await getAccId('2110');
    }

    if (!cashId) throw new Error("Chart of Accounts Error: Cash account (1110) not found.");
    if (!payableId) throw new Error("Chart of Accounts Error: Accounts Payable (2110) not found.");

    return createJournalEntry(
        todayLocalDate(),
        `Payment to ${supplierName}`,
        [
            { accountId: payableId, debit: amount, credit: 0, description: 'Payable Paid' },
            { accountId: cashId, debit: 0, credit: amount, description: `Payment via ${paymentMethod}` }
        ],
        'supplier_payment',
        supplierId
    );
}

// Post Purchase Return (Inventory Return to Supplier)
export async function postPurchaseReturnToJournal(poId: number, totalAmount: number, summary: string) {
    await requireSession();
    const db = await getDb();
    const getAccId = async (code: string) => {
        const acc = await db.prepare('SELECT id FROM accounts WHERE account_code = ?').get(code) as { id: number } | undefined;
        return acc ? acc.id : null;
    };

    let inventoryId = await getAccId('1130');
    let payableId = await getAccId('2110');

    if (!inventoryId || !payableId) {
        await initializeChartOfAccounts();
        inventoryId = await getAccId('1130');
        payableId = await getAccId('2110');
    }

    if (!inventoryId) throw new Error("Chart of Accounts Error: Inventory account (1130) not found.");
    if (!payableId) throw new Error("Chart of Accounts Error: Accounts Payable (2110) not found.");

    return createJournalEntry(
        todayLocalDate(),
        summary,
        [
            { accountId: payableId, debit: totalAmount, credit: 0, description: 'Payable Reduced (Return)' },
            { accountId: inventoryId, debit: 0, credit: totalAmount, description: 'Inventory Returned' }
        ],
        'purchase_return',
        poId
    );
}

