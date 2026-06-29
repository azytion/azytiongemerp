'use server';

import { getDb } from '@/lib/db';
import JSZip from 'jszip';
import { nowLocalISO } from '@/lib/datetime';
import { revalidatePath } from 'next/cache';
import { authError, requireAnyRole } from './authz';
import { aoaToXlsxBuffer, rowsToXlsxBuffer, xlsxBufferToRows } from '@/lib/excel-utils';
import {
    getStatementReport, getTransactionsReport, getPayablesReport, getReceivablesReport,
    getItemListReport, getSupplierWiseReport, getReorderLevelReport, getPurchaseOrderReport,
    getSoldItemsReport, getTypeWiseReport, getBalanceSheetReport, getIncomeStatementReport,
    getCashFlowReport
} from './reports_comprehensive';
import {
    getCustomerListReport, getCustomerPurchaseHistoryReport, getCustomerOutstandingReport,
    getSupplierListReport, getSupplierPurchaseHistoryReport, getSupplierOutstandingReport,
    getSalesInvoicesReport, getPurchaseInvoicesReport, getCreditNotesReport,
    getChequesInHandReport, getTodayReceivedChequesReport, getTodayDatedChequesReport,
    getBouncedChequesReport, getReceivedPartyChequesReport, getReceivedOwnChequesReport,
    getGivenPartyChequesReport, getGivenOwnChequesReport
} from './reports_extended';

const INTERNAL_ACTION_TOKEN = Symbol('internal-action-token');

// Helper to convert array of objects to Excel Buffer
async function generateExcelBuffer(data: any[], sheetName: string = 'Sheet1'): Promise<Buffer> {
    try {
        if (!data || !Array.isArray(data)) {
            console.warn(`generateExcelBuffer received invalid data for ${sheetName}:`, typeof data);
            data = [];
        }

        // Preserve ISO timestamps as-is — do NOT format them to lose time precision.
        // Excel will display them as strings which is fine for data integrity.
        // Only format non-ISO date strings that are already human-readable.
        const formattedData = data.map(item => {
            const newItem = { ...item };
            for (const key in newItem) {
                const value = newItem[key];
                // Keep ISO datetime strings intact (they include time)
                // Only convert SQLite TIMESTAMP format (space separator) to ISO
                if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(value)) {
                    // Convert "2024-01-15 14:30:00" → "2024-01-15T14:30:00" for consistency
                    newItem[key] = value.replace(' ', 'T');
                }
            }
            return newItem;
        });

        return rowsToXlsxBuffer(formattedData, sheetName);
    } catch (e: any) {
        console.error(`Error in generateExcelBuffer for ${sheetName}:`, e);
        throw e;
    }
}

// Helper to get start and end of a month
function getMonthDateRange(year: number, month: number) { // month is 0-indexed (0=Jan)
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0); // Last day of month
    end.setHours(23, 59, 59, 999);
    return {
        start: start.toISOString(),
        end: end.toISOString(),
        startDate: start,
        endDate: end,
        label: `${String(month + 1).padStart(2, '0')}-${year}` // MM-YYYY
    };
}

export async function exportAllData(filter?: {
    type: 'alltime' | 'year' | 'month' | 'custom';
    year?: number;
    month?: number;
    startDate?: string;
    endDate?: string;
}, internalToken?: symbol) {
    if (internalToken !== INTERNAL_ACTION_TOKEN) {
        try {
            await requireAnyRole(['admin', 'super_admin']);
        } catch (error) {
            return authError(error);
        }
    }

    console.log('Starting All-in-One Export (Single-Store Mode)... Filter:', filter);
    const db = await getDb();
    const zip = new JSZip();

    const snapshotDate = nowLocalISO().split('T')[0].split('-').reverse().join('-');

    try {
        let filterStart: Date | null = null;
        let filterEnd: Date | null = null;

        if (filter?.type === 'year' && filter.year) {
            filterStart = new Date(filter.year, 0, 1);
            filterEnd = new Date(filter.year, 11, 31, 23, 59, 59, 999);
        } else if (filter?.type === 'month' && filter.year && filter.month !== undefined) {
            filterStart = new Date(filter.year, filter.month, 1);
            filterEnd = new Date(filter.year, filter.month + 1, 0, 23, 59, 59, 999);
        } else if (filter?.type === 'custom' && filter.startDate && filter.endDate) {
            filterStart = new Date(filter.startDate);
            filterStart.setHours(0, 0, 0, 0);
            filterEnd = new Date(filter.endDate);
            filterEnd.setHours(23, 59, 59, 999);
        }

        let minDateTs: number;
        let maxDateTs: number;

        if (filterStart && filterEnd) {
            minDateTs = filterStart.getTime();
            maxDateTs = filterEnd.getTime();
        } else {
            console.log('Querying date ranges from all temporal tables...');
            const dateQueries = [
                'SELECT MIN(date) as d FROM sales',
                'SELECT MAX(date) as d FROM sales',
                'SELECT MIN(date) as d FROM daybook',
                'SELECT MAX(date) as d FROM daybook',
                'SELECT MIN(date_created) as d FROM purchase_orders',
                'SELECT MAX(date_created) as d FROM purchase_orders',
                'SELECT MIN(created_at) as d FROM transactions',
                'SELECT MAX(created_at) as d FROM transactions',
                'SELECT MIN(date) as d FROM inventory_adjustments',
                'SELECT MAX(date) as d FROM inventory_adjustments',
                'SELECT MIN(date) as d FROM journal_entries',
                'SELECT MAX(date) as d FROM journal_entries',
                'SELECT MIN(timestamp) as d FROM user_activity_log',
                'SELECT MAX(timestamp) as d FROM user_activity_log'
            ];

            minDateTs = new Date().getTime();
            maxDateTs = new Date().getTime();
            let foundData = false;

            for (const q of dateQueries) {
                try {
                    const res = await db.prepare(q).get() as any;
                    if (res && res.d) {
                        const t = new Date(res.d).getTime();
                        if (!isNaN(t)) {
                            if (!foundData) {
                                minDateTs = t;
                                maxDateTs = t;
                                foundData = true;
                            } else {
                                if (t < minDateTs) minDateTs = t;
                                if (t > maxDateTs) maxDateTs = t;
                            }
                        }
                    }
                } catch (_e) { }
            }
        }

        const startYear = new Date(minDateTs).getFullYear();
        const startMonth = new Date(minDateTs).getMonth();
        const endYearGlobal = new Date(maxDateTs).getFullYear();
        const endMonthGlobal = new Date(maxDateTs).getMonth();

        const pathPrefix = '';
        let currentYear = startYear;
        let currentMonth = startMonth;

        while (currentYear < endYearGlobal || (currentYear === endYearGlobal && currentMonth <= endMonthGlobal)) {
            const { start: mStart, end: mEnd, label } = getMonthDateRange(currentYear, currentMonth);
            const monthLabel = label.replace('-', '-');

            let qStart = mStart;
            let qEnd = mEnd;

            if (filterStart) {
                const fsIso = filterStart.toISOString();
                if (fsIso > qStart) qStart = fsIso;
            }
            if (filterEnd) {
                const feIso = filterEnd.toISOString();
                if (feIso < qEnd) qEnd = feIso;
            }

            // SALES & SALE ITEMS
            try {
                const sales = await db.prepare(`SELECT * FROM sales WHERE (date BETWEEN ? AND ?)`).all(qStart, qEnd);
                zip.file(`${pathPrefix}Sales/Sales-${monthLabel}.xlsx`, await generateExcelBuffer(sales));

                if (sales.length > 0) {
                    const saleIds = sales.map((s: any) => s.id);
                    const items = await db.prepare(`SELECT * FROM sale_items WHERE sale_id IN (${saleIds.join(',')})`).all();
                    zip.file(`${pathPrefix}Sales/SaleItems/SaleItems-${monthLabel}.xlsx`, await generateExcelBuffer(items, 'SaleItems'));
                }
            } catch (_e) { }

            // MEMOS & MEMO ITEMS
            try {
                const memos = (await db.prepare(`SELECT * FROM memos WHERE (date_out BETWEEN ? AND ?)`).all(qStart, qEnd) as any[]);
                if (memos.length > 0) {
                    zip.file(`${pathPrefix}Inventory/Memos/Memos-${monthLabel}.xlsx`, await generateExcelBuffer(memos, 'Memos'));
                    const memoIds = memos.map((m: any) => m.id);
                    const mItems = await db.prepare(`SELECT * FROM memo_items WHERE memo_id IN (${memoIds.join(',')})`).all();
                    zip.file(`${pathPrefix}Inventory/Memos/Items/MemoItems-${monthLabel}.xlsx`, await generateExcelBuffer(mItems, 'MemoItems'));
                }
            } catch (_e) { }

            // FINANCE - DAYBOOK, TRANSACTIONS, CHEQUES, CREDIT NOTES, JOURNAL
            try {
                const daybook = await db.prepare(`SELECT * FROM daybook WHERE (date BETWEEN ? AND ?)`).all(qStart, qEnd);
                zip.file(`${pathPrefix}Finance/Daybook/Daybook-${monthLabel}.xlsx`, await generateExcelBuffer(daybook, 'Daybook'));
            } catch (_e) { }

            try {
                const transactions = await db.prepare(`SELECT * FROM transactions WHERE (created_at BETWEEN ? AND ?)`).all(qStart, qEnd);
                zip.file(`${pathPrefix}Finance/Ledger/Ledger-${monthLabel}.xlsx`, await generateExcelBuffer(transactions, 'Ledger'));
            } catch (_e) { }

            try {
                const cheques = await db.prepare(`SELECT * FROM cheques WHERE ((issue_date BETWEEN ? AND ?) OR (created_at BETWEEN ? AND ?))`).all(qStart, qEnd, qStart, qEnd);
                zip.file(`${pathPrefix}Finance/Cheques/Cheques-${monthLabel}.xlsx`, await generateExcelBuffer(cheques, 'Cheques'));

                if (cheques.length > 0) {
                    const chequeIds = cheques.map((c: any) => c.id);
                    const history = await db.prepare(`SELECT * FROM cheque_history WHERE cheque_id IN (${chequeIds.join(',')})`).all();
                    zip.file(`${pathPrefix}Finance/Cheques/History/ChequeHistory-${monthLabel}.xlsx`, await generateExcelBuffer(history, 'ChequeHistory'));
                }
            } catch (_e) { }

            try {
                const credits = await db.prepare(`SELECT * FROM credit_notes WHERE (date BETWEEN ? AND ?)`).all(qStart, qEnd);
                zip.file(`${pathPrefix}Finance/CreditNotes/CreditNotes-${monthLabel}.xlsx`, await generateExcelBuffer(credits, 'CreditNotes'));
            } catch (_e) { }

            try {
                const journalEntries = await db.prepare(`SELECT * FROM journal_entries WHERE (date BETWEEN ? AND ?)`).all(qStart, qEnd);
                zip.file(`${pathPrefix}Finance/Journal/Entries-${monthLabel}.xlsx`, await generateExcelBuffer(journalEntries, 'JournalEntries'));

                if (journalEntries.length > 0) {
                    const entryIds = journalEntries.map((je: any) => je.id);
                    const journalLines = await db.prepare(`SELECT * FROM journal_entry_lines WHERE journal_entry_id IN (${entryIds.join(',')})`).all();
                    zip.file(`${pathPrefix}Finance/Journal/Lines/JournalLines-${monthLabel}.xlsx`, await generateExcelBuffer(journalLines, 'JournalLines'));
                }
            } catch (_e) { }

            // INVENTORY - PO, ADJUSTMENTS
            try {
                const pos = await db.prepare(`SELECT * FROM purchase_orders WHERE (date_created BETWEEN ? AND ?)`).all(qStart, qEnd);
                zip.file(`${pathPrefix}Inventory/PurchaseOrders/PO-${monthLabel}.xlsx`, await generateExcelBuffer(pos, 'PurchaseOrders'));

                if (pos.length > 0) {
                    const poIds = pos.map((p: any) => p.id);
                    const poItems = await db.prepare(`SELECT * FROM purchase_order_items WHERE po_id IN (${poIds.join(',')})`).all();
                    zip.file(`${pathPrefix}Inventory/PurchaseOrders/POItems/POItems-${monthLabel}.xlsx`, await generateExcelBuffer(poItems, 'POItems'));
                }
            } catch (_e) { }

            try {
                const adjustments = await db.prepare(`SELECT * FROM inventory_adjustments WHERE (date BETWEEN ? AND ?)`).all(qStart, qEnd);
                zip.file(`${pathPrefix}Inventory/Adjustments/Adjustments-${monthLabel}.xlsx`, await generateExcelBuffer(adjustments, 'Adjustments'));
            } catch (_e) { }

            try {
                const logs = await db.prepare('SELECT al.* FROM user_activity_log al WHERE al.timestamp BETWEEN ? AND ?').all(qStart, qEnd);
                zip.file(`${pathPrefix}System/ActivityLog/ActivityLog-${monthLabel}.xlsx`, await generateExcelBuffer(logs, 'ActivityLog'));
            } catch (_e) { }

            currentMonth++;
            if (currentMonth > 11) {
                currentMonth = 0;
                currentYear++;
            }
        }

        // ============ REPORTS ============
        const fullRange = {
            start: new Date(minDateTs).toISOString(),
            end: new Date(maxDateTs).toISOString()
        };

        const reportStructure = [
            {
                folder: 'Main',
                reports: [
                    { name: 'Statement', fn: getStatementReport },
                    { name: 'Transactions', fn: getTransactionsReport },
                    { name: 'Payables', fn: getPayablesReport },
                    { name: 'Receivables', fn: getReceivablesReport }
                ]
            },
            {
                folder: 'Inventory',
                reports: [
                    { name: 'ItemList', fn: getItemListReport },
                    { name: 'SupplierWiseStock', fn: getSupplierWiseReport },
                    { name: 'ReorderLevel', fn: getReorderLevelReport },
                    { name: 'PurchaseOrders', fn: getPurchaseOrderReport },
                    { name: 'SoldItems', fn: getSoldItemsReport },
                    { name: 'TypeWise', fn: getTypeWiseReport }
                ]
            },
            {
                folder: 'Finance',
                reports: [
                    { name: 'BalanceSheet', fn: getBalanceSheetReport },
                    { name: 'IncomeStatement', fn: getIncomeStatementReport },
                    { name: 'CashFlow', fn: getCashFlowReport }
                ]
            },
            {
                folder: 'Customer',
                reports: [
                    { name: 'CustomerList', fn: getCustomerListReport },
                    { name: 'PurchaseHistory', fn: getCustomerPurchaseHistoryReport },
                    { name: 'Outstanding', fn: getCustomerOutstandingReport }
                ]
            },
            {
                folder: 'Supplier',
                reports: [
                    { name: 'SupplierList', fn: getSupplierListReport },
                    { name: 'PurchaseHistory', fn: getSupplierPurchaseHistoryReport },
                    { name: 'Outstanding', fn: getSupplierOutstandingReport }
                ]
            },
            {
                folder: 'Invoicing',
                reports: [
                    { name: 'SalesInvoices', fn: getSalesInvoicesReport },
                    { name: 'PurchaseInvoices', fn: getPurchaseInvoicesReport },
                    { name: 'CreditNotes', fn: getCreditNotesReport }
                ]
            },
            {
                folder: 'Cheques',
                reports: [
                    { name: 'ChequesInHand', fn: getChequesInHandReport },
                    { name: 'TodayReceived', fn: getTodayReceivedChequesReport },
                    { name: 'TodayDated', fn: getTodayDatedChequesReport },
                    { name: 'Bounced', fn: getBouncedChequesReport },
                    { name: 'ReceivedParty', fn: getReceivedPartyChequesReport },
                    { name: 'ReceivedOwn', fn: getReceivedOwnChequesReport },
                    { name: 'GivenParty', fn: getGivenPartyChequesReport },
                    { name: 'GivenOwn', fn: getGivenOwnChequesReport }
                ]
            },
            {
                folder: 'Analytics',
                reports: [
                    { name: 'CategoryAnalysis', fn: getTypeWiseReport },
                    { name: 'TopSellingItems', fn: getSoldItemsReport }
                ]
            }
        ];

        for (const section of reportStructure) {
            for (const r of section.reports) {
                try {
                    const rawResult = await (r.fn as any)(fullRange, 1, 1000000);
                    let data: any[] = [];
                    if (rawResult && typeof rawResult === 'object') {
                        if (Array.isArray(rawResult)) data = rawResult;
                        else if ((rawResult as any).data && Array.isArray((rawResult as any).data)) data = (rawResult as any).data;
                        else data = [rawResult];
                    }

                    if (r.name === 'BalanceSheet') {
                        const bs = rawResult as any;
                        const assets = bs.assets || [];
                        const liabilities = bs.liabilities || [];
                        const combined = [
                            { section: 'ASSETS', account: '', amount: '' },
                            ...assets.map((a: any) => ({ section: 'Asset', account: a.account, amount: a.amount })),
                            { section: '', account: '', amount: '' },
                            { section: 'LIABILITIES', account: '', amount: '' },
                            ...liabilities.map((l: any) => ({ section: 'Liability', account: l.account, amount: l.amount })),
                        ];
                        zip.file(`${pathPrefix}Reports/${section.folder}/${r.name}.xlsx`, await generateExcelBuffer(combined, 'BalanceSheet'));
                    } else {
                        zip.file(`${pathPrefix}Reports/${section.folder}/${r.name}.xlsx`, await generateExcelBuffer(data, r.name));
                    }
                } catch (reportErr) {
                    console.error(`Failed to generate report ${r.name}:`, reportErr);
                    zip.file(`${pathPrefix}Reports/${section.folder}/${r.name}.xlsx`, await generateExcelBuffer([], r.name));
                }
            }
        }

        // ============ MASTER GLOBAL SNAPSHOTS (Universal Data) ============
        const masterPrefix = '';

        try {
            const users = await db.prepare('SELECT * FROM users').all();
            zip.file(`${masterPrefix}System/Users-Snapshot-${snapshotDate}.xlsx`, await generateExcelBuffer(users, 'Users'));
        } catch (_e) { }

        try {
            const products = await db.prepare(`
                SELECT p.*, c.name as category_name, gd.carat_weight, gd.dimensions, gd.shape, gd.color, gd.clarity, 
                       gd.cut_grade, gd.origin, gd.treatment, gd.certificate_provider, 
                       gd.certificate_number, gd.certificate_url 
                FROM products p 
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN gem_details gd ON p.id = gd.product_id
            `).all();
            zip.file(`${masterPrefix}Inventory/Products-Snapshot-${snapshotDate}.xlsx`, await generateExcelBuffer(products, 'Products'));
        } catch (_e) { }

        try {
            const categories = await db.prepare('SELECT * FROM categories').all();
            zip.file(`${masterPrefix}Inventory/Categories-Snapshot-${snapshotDate}.xlsx`, await generateExcelBuffer(categories, 'Categories'));
        } catch (_e) { }

        try {
            const pos = await db.prepare('SELECT * FROM purchase_orders').all();
            zip.file(`${masterPrefix}Inventory/Purchases/PurchaseOrders-Snapshot-${snapshotDate}.xlsx`, await generateExcelBuffer(pos, 'PurchaseOrders'));
            const poItems = await db.prepare('SELECT * FROM purchase_order_items').all();
            zip.file(`${masterPrefix}Inventory/Purchases/POItems-Snapshot-${snapshotDate}.xlsx`, await generateExcelBuffer(poItems, 'POItems'));
        } catch (_e) { }

        try {
            const adjustments = await db.prepare('SELECT * FROM inventory_adjustments').all();
            zip.file(`${masterPrefix}Inventory/Adjustments-Snapshot-${snapshotDate}.xlsx`, await generateExcelBuffer(adjustments, 'Adjustments'));
        } catch (_e) { }

        try {
            const memos = await db.prepare('SELECT * FROM memos').all();
            zip.file(`${masterPrefix}Inventory/Memos/Memos-Snapshot-${snapshotDate}.xlsx`, await generateExcelBuffer(memos, 'Memos'));
            const mItems = await db.prepare('SELECT * FROM memo_items').all();
            zip.file(`${masterPrefix}Inventory/Memos/MemoItems-Snapshot-${snapshotDate}.xlsx`, await generateExcelBuffer(mItems, 'MemoItems'));
        } catch (_e) { }

        try {
            const customers = await db.prepare('SELECT * FROM customers').all();
            zip.file(`${masterPrefix}Relationships/Customers-Snapshot-${snapshotDate}.xlsx`, await generateExcelBuffer(customers, 'Customers'));
        } catch (_e) { }

        try {
            const suppliers = await db.prepare('SELECT * FROM suppliers').all();
            zip.file(`${masterPrefix}Relationships/Suppliers-Snapshot-${snapshotDate}.xlsx`, await generateExcelBuffer(suppliers, 'Suppliers'));
        } catch (_e) { }

        try {
            const brokers = await db.prepare('SELECT * FROM brokers').all();
            zip.file(`${masterPrefix}Relationships/Brokers-Snapshot-${snapshotDate}.xlsx`, await generateExcelBuffer(brokers, 'Brokers'));
        } catch (_e) { }

        try {
            const sales = await db.prepare(`
                SELECT s.*, c.name as customer_name, b.name as broker_name 
                FROM sales s 
                LEFT JOIN customers c ON s.customer_id = c.id 
                LEFT JOIN brokers b ON s.broker_id = b.id
            `).all();
            zip.file(`${masterPrefix}Sales/Sales-Snapshot-${snapshotDate}.xlsx`, await generateExcelBuffer(sales, 'Sales'));
            const saleItems = await db.prepare('SELECT * FROM sale_items').all();
            zip.file(`${masterPrefix}Sales/SaleItems-Snapshot-${snapshotDate}.xlsx`, await generateExcelBuffer(saleItems, 'SaleItems'));
            const heldOrders = await db.prepare('SELECT * FROM held_orders').all();
            zip.file(`${masterPrefix}Sales/HeldOrders-Snapshot-${snapshotDate}.xlsx`, await generateExcelBuffer(heldOrders, 'HeldOrders'));
        } catch (_e) { }

        try {
            const paymentAccounts = await db.prepare('SELECT * FROM payment_accounts').all();
            zip.file(`${masterPrefix}Finance/PaymentAccounts-Snapshot-${snapshotDate}.xlsx`, await generateExcelBuffer(paymentAccounts, 'PaymentAccounts'));
            const accounts = await db.prepare('SELECT * FROM accounts').all();
            zip.file(`${masterPrefix}Finance/LedgerAccounts-Snapshot-${snapshotDate}.xlsx`, await generateExcelBuffer(accounts, 'Accounts'));
            const transactions = await db.prepare('SELECT * FROM transactions').all();
            zip.file(`${masterPrefix}Finance/Transactions-Snapshot-${snapshotDate}.xlsx`, await generateExcelBuffer(transactions, 'Transactions'));
            const daybook = await db.prepare('SELECT * FROM daybook').all();
            zip.file(`${masterPrefix}Finance/Daybook-Snapshot-${snapshotDate}.xlsx`, await generateExcelBuffer(daybook, 'Daybook'));
        } catch (_e) { }

        try {
            const cheques = await db.prepare('SELECT * FROM cheques').all();
            zip.file(`${masterPrefix}Finance/Cheques-Snapshot-${snapshotDate}.xlsx`, await generateExcelBuffer(cheques, 'Cheques'));
            const history = await db.prepare('SELECT * FROM cheque_history').all();
            zip.file(`${masterPrefix}Finance/ChequeHistory-Snapshot-${snapshotDate}.xlsx`, await generateExcelBuffer(history, 'ChequeHistory'));
        } catch (_e) { }

        try {
            const creditNotes = await db.prepare('SELECT * FROM credit_notes').all();
            zip.file(`${masterPrefix}Finance/CreditNotes-Snapshot-${snapshotDate}.xlsx`, await generateExcelBuffer(creditNotes, 'CreditNotes'));
        } catch (_e) { }

        try {
            const journalEntries = await db.prepare('SELECT * FROM journal_entries').all();
            zip.file(`${masterPrefix}Finance/JournalEntries-Snapshot-${snapshotDate}.xlsx`, await generateExcelBuffer(journalEntries, 'JournalEntries'));
            const journalLines = await db.prepare('SELECT * FROM journal_entry_lines').all();
            zip.file(`${masterPrefix}Finance/JournalLines-Snapshot-${snapshotDate}.xlsx`, await generateExcelBuffer(journalLines, 'JournalLines'));
        } catch (_e) { }

        try {
            const settings = await db.prepare('SELECT * FROM settings').all();
            zip.file(`${masterPrefix}System/Settings-Snapshot-${snapshotDate}.xlsx`, await generateExcelBuffer(settings, 'Settings'));
            const discountRules = await db.prepare('SELECT * FROM pos_discount_rules').all();
            zip.file(`${masterPrefix}System/DiscountRules-Snapshot-${snapshotDate}.xlsx`, await generateExcelBuffer(discountRules, 'DiscountRules'));
            const activityLog = await db.prepare('SELECT * FROM user_activity_log LIMIT 10000').all();
            zip.file(`${masterPrefix}System/ActivityLog-Snapshot-${snapshotDate}.xlsx`, await generateExcelBuffer(activityLog, 'ActivityLog'));
        } catch (_e) { }

        const content = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE', compressionOptions: { level: 6 } });
        return { success: true, data: content };

    } catch (error: any) {
        console.error('Export error:', error);
        return { success: false, error: error.message };
    }
}

export async function downloadTemplates() {
    try {
        await requireAnyRole(['admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const zip = new JSZip();
    const templateStructure: Record<string, string[]> = {
        'System/Users': ['id', 'username', 'password_hash', 'role', 'pin', 'is_active', 'created_at', 'last_login'],
        'System/Settings': ['id', 'key', 'value', 'category', 'data_type', 'updated_at', 'updated_by'],
        'System/ActivityLog': ['id', 'user_id', 'action', 'entity_type', 'entity_id', 'old_values', 'new_values', 'ip_address', 'timestamp'],
        'System/POSSettings/DiscountRules': ['id', 'min_price', 'max_price', 'discount_type', 'discount_value', 'is_active', 'created_at'],

        'Inventory/Products': ['id', 'barcode', 'name', 'notes', 'category', 'category_id', 'cost_price', 'selling_price', 'stock', 'reorder_level', 'type', 'is_archived', 'image_url', 'pricing_method', 'carat_weight', 'dimensions', 'shape', 'color', 'clarity', 'cut_grade', 'origin', 'treatment', 'certificate_provider', 'certificate_number', 'certificate_url', 'created_at', 'updated_at'],
        'Inventory/Categories': ['id', 'name', 'description', 'created_at'],
        'Inventory/Memos': ['id', 'memo_number', 'customer_id', 'status', 'date_out', 'date_due', 'user_id', 'notes'],
        'Inventory/MemoItems': ['id', 'memo_id', 'product_id', 'variant_id', 'quantity', 'carat_weight', 'price_per_carat', 'total_price', 'status', 'item_returned', 'item_sold', 'returned_qty', 'returned_weight'],
        'Inventory/PurchaseOrders': ['id', 'po_number', 'supplier_id', 'user_id', 'date_created', 'expected_date', 'status', 'payment_status', 'total_amount', 'paid_amount', 'notes'],
        'Inventory/POItems': ['id', 'po_id', 'product_id', 'quantity', 'expected_price'],
        'Inventory/Adjustments': ['id', 'product_id', 'variant_id', 'adjustment_type', 'quantity', 'reason', 'notes', 'date', 'created_at'],

        'Relationships/Customers': ['id', 'name', 'phone', 'email', 'address', 'balance', 'created_at', 'updated_at'],
        'Relationships/Suppliers': ['id', 'name', 'phone', 'email', 'address', 'balance', 'created_at', 'updated_at'],
        'Relationships/Brokers': ['id', 'name', 'phone', 'email', 'address', 'notes', 'is_active', 'created_at', 'updated_at'],

        'Sales/Sales': ['id', 'invoice_number', 'user_id', 'customer_id', 'broker_id', 'broker_commission', 'date', 'total_amount', 'received_cash', 'balance_to_return', 'payment_method', 'payment_status', 'status', 'type', 'discount'],
        'Sales/SaleItems': ['id', 'sale_id', 'product_id', 'variant_id', 'quantity', 'price', 'discount'],
        'Sales/HeldOrders': ['id', 'name', 'customer_id', 'cart_json', 'date', 'user_id'],

        'Finance/PaymentAccounts': ['id', 'name', 'type', 'account_number', 'balance', 'currency', 'is_active', 'created_at'],
        'Finance/LedgerAccounts': ['id', 'account_code', 'account_name', 'account_type', 'parent_account_id', 'balance', 'is_active', 'created_at'],
        'Finance/Transactions': ['id', 'account_id', 'type', 'amount', 'description', 'reference_id', 'reference_type', 'balance_after', 'created_at', 'user_id'],
        'Finance/Daybook': ['id', 'date', 'time', 'transaction_type', 'description', 'debit', 'credit', 'balance', 'reference_id', 'reference_type', 'user_id', 'created_at'],
        'Finance/Cheques': ['id', 'user_id', 'cheque_number', 'bank_name', 'account_number', 'amount', 'issue_date', 'due_date', 'status', 'payee_name', 'reference_type', 'reference_id', 'notes', 'created_at'],
        'Finance/ChequeHistory': ['id', 'cheque_id', 'action', 'old_value', 'new_value', 'notes', 'user_id', 'timestamp'],
        'Finance/CreditNotes': ['id', 'credit_note_number', 'date', 'type', 'reference_invoice_id', 'reference_type', 'amount', 'reason', 'status', 'user_id', 'created_at'],
        'Finance/JournalEntries': ['id', 'entry_number', 'user_id', 'date', 'description', 'reference_type', 'reference_id', 'created_at'],
        'Finance/JournalLines': ['id', 'journal_entry_id', 'account_id', 'debit', 'credit', 'description'],
    };

    try {
        for (const [filePath, headers] of Object.entries(templateStructure)) {
            const buffer = await aoaToXlsxBuffer([headers], 'Template');
            zip.file(`${filePath}-Template.xlsx`, buffer);
        }

        const reportStructureDef: Record<string, string[]> = {
            'Main': ['Statement', 'Transactions', 'Payables', 'Receivables'],
            'Inventory': ['ItemList', 'SupplierWiseStock', 'ReorderLevel', 'PurchaseOrders', 'SoldItems', 'TypeWise'],
            'Finance': ['BalanceSheet', 'IncomeStatement', 'CashFlow'],
            'Customer': ['CustomerList', 'PurchaseHistory', 'Outstanding'],
            'Supplier': ['SupplierList', 'PurchaseHistory', 'Outstanding'],
            'Invoicing': ['SalesInvoices', 'PurchaseInvoices', 'CreditNotes'],
            'Cheques': ['ChequesInHand', 'TodayReceived', 'TodayDated', 'Bounced', 'ReceivedParty', 'ReceivedOwn', 'GivenParty', 'GivenOwn'],
            'Staff': [],
            'Analytics': ['CategoryAnalysis', 'TopSellingItems']
        };

        for (const [folder, files] of Object.entries(reportStructureDef)) {
            if (files.length === 0) {
                zip.file(`Reports/${folder}/_Placeholder.xlsx`, await generateExcelBuffer([{ Info: 'No reports defined for this section yet' }], 'Info'));
            } else {
                for (const fileName of files) {
                    zip.file(`Reports/${folder}/${fileName}.xlsx`, await generateExcelBuffer([], fileName));
                }
            }
        }

        const content = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE', compressionOptions: { level: 6 } });
        return { success: true, data: content };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// --- UNIVERSAL IMPORT ENGINE ---

const MYSQL_RESERVED_COLUMNS = new Set(['key', 'order', 'group', 'rank', 'status', 'type', 'date', 'time']);

function quoteSqlColumn(column: string): string {
    return MYSQL_RESERVED_COLUMNS.has(column.toLowerCase()) ? `\`${column}\`` : column;
}

/** Map legacy SQLite / offline-desktop column names to current MySQL schema. */
function mapLegacyImportRow(tableName: string, row: Record<string, unknown>) {
    if (row.description !== undefined && row.notes === undefined) {
        row.notes = row.description;
    }
    delete row.description;

    if (row.min_stock_level !== undefined && row.reorder_level === undefined) {
        row.reorder_level = row.min_stock_level;
    }
    delete row.min_stock_level;

    if (tableName === 'products' && row.is_active !== undefined && row.is_archived === undefined) {
        // Only treat as archived if is_active is explicitly 0/false — NOT if it's null/undefined
        const isExplicitlyInactive = row.is_active === 0 || row.is_active === '0' || row.is_active === false;
        row.is_archived = isExplicitlyInactive ? 1 : 0;
    }
    // Always default is_archived to 0 if not set — never let it be null/undefined
    if (tableName === 'products' && (row.is_archived === null || row.is_archived === undefined)) {
        row.is_archived = 0;
    }
    if (tableName === 'products') delete row.is_active;

    if (tableName === 'accounts') {
        if (row.account_number && !row.account_code) row.account_code = row.account_number;
        if (row.name && !row.account_name) row.account_name = row.name;
        if (row.type && !row.account_type) row.account_type = row.type;
        if (row.parent_id !== undefined && row.parent_account_id === undefined) row.parent_account_id = row.parent_id;
        delete row.account_number;
        delete row.name;
        delete row.type;
        delete row.parent_id;
        delete row.description;
    }

    if (tableName === 'sales') {
        if (row.discount_amount !== undefined && row.discount === undefined) row.discount = row.discount_amount;
        delete row.subtotal;
        delete row.tax_amount;
        delete row.discount_amount;
        delete row.change_amount;
        delete row.notes;
        delete row.created_at;
    }

    if (tableName === 'sale_items') {
        delete row.cost_price;
        delete row.notes;
    }

    if (tableName === 'held_orders') {
        if (row.cart_data_json && !row.cart_json) row.cart_json = row.cart_data_json;
        delete row.cart_data_json;
        delete row.created_at;
        delete row.updated_at;
    }

    if (tableName === 'purchase_orders') {
        delete row.created_at;
        delete row.updated_at;
    }

    if (tableName === 'purchase_order_items') {
        delete row.actual_price;
        delete row.received_quantity;
        delete row.created_at;
    }

    if (tableName === 'suppliers') {
        delete row.contact_person;
    }

    if (tableName === 'users') {
        delete row.updated_at;
    }

    if (tableName === 'pos_discount_rules') {
        delete row.name;
        delete row.start_date;
        delete row.end_date;
        delete row.priority;
    }

    if (tableName === 'journal_entries') {
        if (row.reference && !row.reference_type) row.reference_type = row.reference;
        delete row.reference;
        delete row.status;
        delete row.updated_at;
    }

    if (tableName === 'cheques') {
        if (row.type && !row.reference_type) row.reference_type = row.type;
        delete row.type;
        delete row.customer_id;
        delete row.supplier_id;
    }

    if (tableName === 'cheque_history') {
        if (row.status && !row.action) row.action = row.status;
        delete row.status;
    }

    if (tableName === 'inventory_adjustments') {
        delete row.user_id;
    }

    if (tableName === 'payment_accounts') {
        delete row.updated_at;
    }

    return row;
}

async function findByNameCaseInsensitive(
    db: Awaited<ReturnType<typeof getDb>>,
    table: string,
    name: string
) {
    return await db.prepare(`SELECT id FROM ${table} WHERE LOWER(name) = LOWER(?)`).get(name) as { id: number } | undefined;
}

function normalizeRow(row: any) {
    const normalized: any = {};
    for (const key of Object.keys(row)) {
        const normalizedKey = key.toLowerCase().trim().replace(/ /g, '_');
        let value = row[key];
        // Sanitize string "null"/"undefined" to actual null
        if (value === 'null' || value === 'undefined' || value === '') {
            value = null;
        }
        normalized[normalizedKey] = value;
    }
    return normalized;
}

function excelSerialDateToISO(serial: number) {
    // Excel's serial date epoch includes the 1900 leap-year bug; 25569 is 1970-01-01.
    const ms = Math.round((serial - 25569) * 86400 * 1000);
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeDateValue(value: unknown) {
    if (value === null || value === undefined || value === '') return value;
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value.toISOString();
    }
    if (typeof value === 'number') {
        return excelSerialDateToISO(value) || value;
    }

    const raw = String(value).trim();
    if (!raw) return null;

    const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
    let date = new Date(normalized);
    if (!Number.isNaN(date.getTime())) return date.toISOString();

    // Handles display dates exported/imported as "Apr 16, 2026".
    date = new Date(raw);
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

async function upsertTableData(db: any, tableName: string, data: any[]) {
    if (!data || data.length === 0) return { count: 0 };

    const columnRows = await db.prepare(
        `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`
    ).all(tableName) as { name: string }[];
    const validColumns = columnRows.map((c) => c.name);
    const hasId = validColumns.includes('id');

    // Use INSERT OR IGNORE + UPDATE to avoid cascade-deleting related rows
    // (INSERT OR REPLACE deletes+reinserts which triggers ON DELETE CASCADE)
    const quotedColumns = validColumns.map(quoteSqlColumn);

    let count = 0;
    let firstError = '';

    try {
        await db.transaction(async () => {
            // Prepare statements inside the transaction so they use the transaction connection
            const txInsertStmt = db.prepare(
                `INSERT OR IGNORE INTO ${tableName} (${quotedColumns.join(',')}) VALUES (${validColumns.map((k: string) => '@' + k).join(',')})`
            );
            const txUpdateStmt = hasId ? db.prepare(
                `UPDATE ${tableName} SET ${validColumns.filter((c: string) => c !== 'id').map((c: string) => `${quoteSqlColumn(c)} = @${c}`).join(', ')} WHERE id = @id`
            ) : null;

            for (const raw of data) {
                const row = mapLegacyImportRow(tableName, normalizeRow(raw));

                // Imported product backup rows may reference local image files that are
                // not present in the new installation. Keep imports image-neutral.
                if (tableName === 'products' || tableName === 'product_variants') {
                    row.image_url = null;
                }

                // Automatic Foreign Key Resolution
                // Resolve category by name (handles both 'category_name' from new exports and 'category' text field)
                const categoryName = row.category_name || (typeof row.category === 'string' ? row.category : null);
                if (typeof categoryName === 'string' && categoryName) {
                    const r = await findByNameCaseInsensitive(db, 'categories', categoryName);
                    if (r) {
                        row.category_id = r.id;
                        row.category = categoryName;
                    } else {
                        try {
                            const res = await db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)').run(categoryName);
                            if (res.changes > 0) {
                                row.category_id = res.lastInsertRowid;
                            } else {
                                const existing = await findByNameCaseInsensitive(db, 'categories', categoryName);
                                if (existing) row.category_id = existing.id;
                            }
                            row.category = categoryName;
                        } catch { /* category may already exist */ }
                    }
                }

                if (row.customer_name && !row.customer_id) {
                    const r = await findByNameCaseInsensitive(db, 'customers', String(row.customer_name));
                    if (r) row.customer_id = r.id;
                }

                if (row.supplier_name && !row.supplier_id) {
                    const r = await findByNameCaseInsensitive(db, 'suppliers', String(row.supplier_name));
                    if (r) row.supplier_id = r.id;
                }

                if (row.broker_name && !row.broker_id) {
                    const r = await findByNameCaseInsensitive(db, 'brokers', String(row.broker_name));
                    if (r) row.broker_id = r.id;
                }

                if (row.username && !row.user_id) {
                    const r = await db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(row.username) as { id: number } | undefined;
                    if (r) row.user_id = r.id;
                }

                if (row.account_name && !row.account_id) {
                    const r = await findByNameCaseInsensitive(db, 'payment_accounts', String(row.account_name));
                    if (r) row.account_id = r.id;
                }

                if (tableName === 'accounts' && row.account_code && !row.account_id) {
                    const r = await db.prepare('SELECT id FROM accounts WHERE account_code = ?').get(row.account_code) as { id: number } | undefined;
                    if (r) row.account_id = r.id;
                }

                if (row.product_barcode && !row.product_id) {
                    const r = await db.prepare('SELECT id FROM products WHERE barcode = ?').get(String(row.product_barcode));
                    if (r) row.product_id = r.id;
                }

                if (row.variant_barcode && !row.variant_id) {
                    const r = await db.prepare('SELECT id FROM product_variants WHERE barcode = ?').get(String(row.variant_barcode));
                    if (r) row.variant_id = r.id;
                }

                if (row.invoice_number && !row.sale_id) {
                    const r = await db.prepare('SELECT id FROM sales WHERE invoice_number = ?').get(String(row.invoice_number));
                    if (r) row.sale_id = r.id;
                }

                if (row.po_number && !row.po_id) {
                    const r = await db.prepare('SELECT id FROM purchase_orders WHERE po_number = ?').get(String(row.po_number));
                    if (r) row.po_id = r.id;
                }

                if (row.entry_number && !row.journal_entry_id) {
                    const r = await db.prepare('SELECT id FROM journal_entries WHERE entry_number = ?').get(String(row.entry_number));
                    if (r) row.journal_entry_id = r.id;
                }

                if (row.cheque_number && !row.cheque_id) {
                    const r = await db.prepare('SELECT id FROM cheques WHERE cheque_number = ?').get(String(row.cheque_number));
                    if (r) row.cheque_id = r.id;
                }

                // Final cleaning - only pick valid DB columns
                const clean: any = {};
                validColumns.forEach((c: string) => {
                    if (row[c] !== undefined) clean[c] = row[c];
                    else clean[c] = null;
                });

                for (const column of ['date', 'created_at', 'updated_at', 'timestamp', 'issue_date', 'due_date', 'date_created', 'expected_date', 'date_out', 'date_due']) {
                    if (column in clean) {
                        clean[column] = normalizeDateValue(clean[column]);
                    }
                }

                try {
                    // Try insert first; if row exists (has id), update instead
                    const insertResult = await txInsertStmt.run(clean);
                    let lastId: number;
                    if (insertResult.changes > 0) {
                        lastId = Number(clean.id || insertResult.lastInsertRowid);
                    } else if (txUpdateStmt && clean.id) {
                        await txUpdateStmt.run(clean);
                        lastId = Number(clean.id);
                    } else {
                        lastId = Number(clean.id || 0);
                    }

                    // SPECIAL: Gem Details Auto-Import
                    if (tableName === 'products' || tableName === 'product_variants') {
                        const gemFields = [
                            'carat_weight', 'dimensions', 'shape', 'color', 'clarity',
                            'cut_grade', 'origin', 'treatment', 'certificate_provider',
                            'certificate_number', 'certificate_url'
                        ];
                        const hasGemData = gemFields.some(f => row[f] !== undefined && row[f] !== null);

                        if (hasGemData) {
                            const productId = tableName === 'products' ? lastId : row.product_id;
                            const variantId = tableName === 'product_variants' ? lastId : null;

                            if (productId) {
                                // Logic to sync gem_details
                                const existingGem = await db.prepare('SELECT id FROM gem_details WHERE product_id = ? AND (variant_id = ? OR (variant_id IS NULL AND ? IS NULL))')
                                    .get(productId, variantId, variantId);

                                const gemData: any = { product_id: productId, variant_id: variantId };
                                gemFields.forEach(f => gemData[f] = row[f] ?? null);

                                if (existingGem) {
                                    const sets = gemFields.map(f => `${f} = ?`).join(', ');
                                    const params = gemFields.map(f => gemData[f]);
                                    await db.prepare(`UPDATE gem_details SET ${sets} WHERE id = ?`).run(...params, existingGem.id);
                                } else {
                                    const cols = ['product_id', 'variant_id', ...gemFields];
                                    const pld = cols.map(() => '?').join(', ');
                                    const vals = cols.map(c => gemData[c]);
                                    await db.prepare(`INSERT INTO gem_details (${cols.join(', ')}) VALUES (${pld})`).run(...vals);
                                }
                            }
                        }
                    }
                    count++;
                } catch (e: any) {
                    if (!firstError) firstError = e.message;
                }
            }
        })();
    } catch (err: any) {
        firstError = err.message;
    }

    return { count, error: firstError };
}

export async function importAllData(prevState: any, formData: FormData) {
    try {
        await requireAnyRole(['admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const file = formData.get('file') as File;
    if (!file) return { success: false, error: 'No file provided' };

    const db = await getDb();
    const stats: any = {};
    let matchedFiles = 0;
    let globalError = '';

    try {
        const zip = await JSZip.loadAsync(await file.arrayBuffer());
        const allPaths = Object.keys(zip.files).filter(p => !p.includes('MACOSX') && !p.startsWith('.') && !zip.files[p].dir);

        const runImport = async (label: string, regex: RegExp, table: string) => {
            const targets = allPaths.filter(p => regex.test(p));
            if (targets.length === 0) return;
            matchedFiles += targets.length;

            let total = 0;
            for (const path of targets) {
                const buf = await zip.files[path].async('nodebuffer');
                const json = await xlsxBufferToRows(buf);
                if (json.length === 0) continue;

                const { count, error } = await upsertTableData(db, table, json);
                total += count;
                if (error && !globalError) globalError = `[${table}] ${error}`;
            }
            if (total > 0) stats[label] = total;
        };

        // Execution Order (Dependencies first)
        await runImport('Users', /Users-.*\.xlsx$/i, 'users');
        await runImport('Settings', /Settings-.*\.xlsx$/i, 'settings');
        await runImport('Accounts', /PaymentAccounts-.*\.xlsx$/i, 'payment_accounts');
        await runImport('ChartOfAccounts', /(ChartOfAccounts|LedgerAccounts|Accounts)-.*\.xlsx$/i, 'accounts');
        await runImport('DiscountRules', /DiscountRules-.*\.xlsx$/i, 'pos_discount_rules');

        await runImport('Categories', /Categories-.*\.xlsx$/i, 'categories');
        await runImport('Customers', /Customers-.*\.xlsx$/i, 'customers');
        await runImport('Suppliers', /Suppliers-.*\.xlsx$/i, 'suppliers');
        await runImport('Brokers', /Brokers-.*\.xlsx$/i, 'brokers');
        await runImport('Products', /Products-.*\.xlsx$/i, 'products');
        await runImport('Memos', /Memos-.*\.xlsx$/i, 'memos');
        await runImport('MemoItems', /MemoItems-.*\.xlsx$/i, 'memo_items');

        // Results
        await runImport('Sales', /Sales-.*\.xlsx$/i, 'sales');
        await runImport('SaleItems', /SaleItems-.*\.xlsx$/i, 'sale_items');
        await runImport('HeldOrders', /HeldOrders-.*\.xlsx$/i, 'held_orders');

        await runImport('PO', /(PurchaseOrders|PO)-.*\.xlsx$/i, 'purchase_orders');
        await runImport('POItems', /POItems-.*\.xlsx$/i, 'purchase_order_items');

        await runImport('Ledger', /(Ledger|Transactions)-.*\.xlsx$/i, 'transactions');
        await runImport('JournalEntries', /JournalEntries-.*\.xlsx$/i, 'journal_entries');
        await runImport('JournalLines', /JournalLines-.*\.xlsx$/i, 'journal_entry_lines');

        await runImport('Daybook', /Daybook-.*\.xlsx$/i, 'daybook');
        await runImport('Cheques', /Cheques-.*\.xlsx$/i, 'cheques');
        await runImport('ChequeHistory', /ChequeHistory-.*\.xlsx$/i, 'cheque_history');
        await runImport('CreditNotes', /CreditNotes-.*\.xlsx$/i, 'credit_notes');
        await runImport('Adjustments', /Adjustments-.*\.xlsx$/i, 'inventory_adjustments');
        await runImport('ActivityLog', /ActivityLog-.*\.xlsx$/i, 'user_activity_log');

        revalidatePath('/', 'layout');

        const finalCount = Object.values(stats).reduce((a: any, b: any) => a + b, 0) as number;

        if (finalCount === 0) {
            if (matchedFiles > 0) return { success: false, error: `Found ${matchedFiles} files, but data import failed. ${globalError ? 'Reason: ' + globalError : 'The files seem to be empty or formatted incorrectly.'}` };
            return { success: false, error: 'No recognizable Excel files found in ZIP.' };
        }

        const summary = Object.entries(stats).map(([k, v]) => `${k}:${v}`).join(', ');
        return { success: true, message: `Successfully Imported! Items: ${summary}` };

    } catch (e: any) {
        return { success: false, error: e.message };
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// SEND BACKUP EMAIL — exports all data and emails it as a ZIP attachment
// updateLastRun: true = scheduled send (updates lastRun), false = manual send
// ─────────────────────────────────────────────────────────────────────────────
export async function sendBackupEmail(
    recipientEmail: string,
    updateLastRun: boolean = false
): Promise<{ success: boolean; error?: string }> {
    try {
        await requireAnyRole(['admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    return sendBackupEmailInternal(recipientEmail, updateLastRun);
}

export async function sendBackupEmailForCron(
    recipientEmail: string,
    updateLastRun: boolean = true
): Promise<{ success: boolean; error?: string }> {
    return sendBackupEmailInternal(recipientEmail, updateLastRun);
}

async function sendBackupEmailInternal(
    recipientEmail: string,
    updateLastRun: boolean
): Promise<{ success: boolean; error?: string }> {
    try {
        // Generate the full backup ZIP
        const exportResult = await exportAllData({ type: 'alltime' }, INTERNAL_ACTION_TOKEN);
        if (!exportResult.success || !exportResult.data) {
            return { success: false, error: exportResult.error || 'Failed to generate backup' };
        }

        const { sendEmail } = await import('./email');
        const { getSettings } = await import('./settings');
        const settings = await getSettings();
        const companyName = settings.company_name || 'ZATION GemERP';
        const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const isScheduled = updateLastRun;

        const html = `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
                <div style="background:#0B132B;padding:24px;text-align:center">
                    <h1 style="color:#D4AF37;margin:0;font-size:20px">${companyName}</h1>
                    <p style="color:#94A3B8;margin:8px 0 0;font-size:13px">${isScheduled ? 'Scheduled Data Backup' : 'Manual Data Backup'}</p>
                </div>
                <div style="padding:32px">
                    <p style="color:#374151;font-size:15px">Hello,</p>
                    <p style="color:#374151">Your ${isScheduled ? 'scheduled' : 'manual'} backup for <strong>${companyName}</strong> has been generated on <strong>${dateStr}</strong>.</p>
                    <p style="color:#374151">The backup ZIP file is attached to this email. It contains all your business data including products, sales, customers, suppliers, and financial records.</p>
                    <p style="color:#6B7280;font-size:13px">Store this backup in a safe location. To restore, use the Import Data feature in Settings → Data Management.</p>
                </div>
                <div style="background:#F9FAFB;padding:16px;text-align:center;border-top:1px solid #E5E7EB">
                    <p style="color:#9CA3AF;font-size:12px;margin:0">Powered By ZATION GemERP</p>
                </div>
            </div>
        `;

        const filename = `${companyName.replace(/[^a-z0-9]/gi, '_').toUpperCase()}-Backup-${new Date().toISOString().split('T')[0]}.zip`;

        const result = await sendEmail(
            recipientEmail,
            `${companyName} — ${isScheduled ? 'Scheduled' : 'Manual'} Backup ${dateStr}`,
            html,
            [{ filename, content: exportResult.data, encoding: 'base64' }]
        );

        if (result.success) {
            // Update config timestamps
            try {
                const { getSetting, updateSetting } = await import('./settings');
                const configStr = await getSetting('scheduled_backup_config');
                if (configStr) {
                    const config = JSON.parse(configStr);
                    const now = new Date().toISOString();

                    if (updateLastRun) {
                        // Scheduled send — update lastRun (used by cron to determine next run)
                        config.lastRun = now;
                    } else {
                        // Manual send — update lastManualSend only, do NOT touch lastRun
                        config.lastManualSend = now;
                    }

                    // Keep history of last 10 sends
                    if (!config.history) config.history = [];
                    config.history.unshift({
                        sentAt: now,
                        type: updateLastRun ? 'scheduled' : 'manual',
                        email: recipientEmail,
                    });
                    config.history = config.history.slice(0, 10);

                    await updateSetting('scheduled_backup_config', JSON.stringify(config), 'data');
                }
            } catch { /* ignore */ }
            return { success: true };
        } else {
            return { success: false, error: result.error || 'Failed to send email' };
        }
    } catch (error: any) {
        console.error('Backup email error:', error);
        return { success: false, error: error.message || 'Failed to send backup email' };
    }
}

