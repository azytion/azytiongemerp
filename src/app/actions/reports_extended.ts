'use server';


import { requireSession } from './authz';
import { getDb } from '@/lib/db';

export interface DateRange {
    start: string;
    end: string;
}

// ============ CUSTOMER TAB REPORTS ============

export async function getCustomerListReport(dateRange?: DateRange, search?: string) {
    await requireSession();
    const db = await getDb();

    let searchClause = "";
    const params: any[] = [];
    if (search) {
        searchClause = ` WHERE (name LIKE ? OR email LIKE ? OR phone LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    return await db.prepare(`
        SELECT
            id as customer_id,
            name,
            email,
            phone,
            address,
            balance
        FROM customers
        ${searchClause}
        ORDER BY name ASC
    `).all(...params);
}

export async function getCustomerPurchaseHistoryReport(dateRange?: DateRange, search?: string) {
    await requireSession();
    const db = await getDb();

    let query = `
        SELECT
            c.id as customer_id,
            c.name as customer_name,
            s.id as sale_id,
            s.invoice_number,
            s.date,
            s.total_amount
        FROM sales s
        JOIN customers c ON s.customer_id = c.id
        WHERE 1=1
    `;

    const params: any[] = [];
    if (dateRange) {
        query += ` AND date(s.date) >= date(?) AND date(s.date) <= date(?)`;
        params.push(dateRange.start, dateRange.end);
    }
    if (search) {
        query += ` AND (c.name LIKE ? OR s.invoice_number LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY s.date DESC`;
    return await db.prepare(query).all(...params);
}

export async function getCustomerOutstandingReport(dateRange?: DateRange, search?: string) {
    await requireSession();
    const db = await getDb();

    let searchClause = "";
    const params: any[] = [];
    if (search) {
        searchClause = ` AND (name LIKE ? OR phone LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }

    return await db.prepare(`
        SELECT
            id as customer_id,
            name as customer,
            balance as amount_due,
            phone,
            email
        FROM customers
        WHERE balance > 0
        ${searchClause}
        ORDER BY balance DESC
        `).all(...params);
}

// ============ SUPPLIER TAB REPORTS ============

export async function getSupplierListReport(dateRange?: DateRange, search?: string) {
    await requireSession();
    const db = await getDb();

    let searchClause = "";
    const params: any[] = [];
    if (search) {
        searchClause = ` WHERE (name LIKE ? OR email LIKE ? OR phone LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    return await db.prepare(`
        SELECT
            id,
            name,
            email,
            phone,
            address
        FROM suppliers
        ${searchClause}
        ORDER BY name ASC
        `).all(...params);
}

export async function getSupplierPurchaseHistoryReport(dateRange?: DateRange, search?: string) {
    await requireSession();
    const db = await getDb();

    let query = `
        SELECT
            s.id as supplier_id,
            s.name as supplier_name,
            po.id as po_id,
            po.po_number as invoice,
            po.date_created as date,
            po.total_amount as amount
        FROM purchase_orders po
        JOIN suppliers s ON po.supplier_id = s.id
        WHERE 1=1
    `;

    const params: any[] = [];
    if (dateRange) {
        query += ` AND date(po.date_created) >= date(?) AND date(po.date_created) <= date(?)`;
        params.push(dateRange.start, dateRange.end);
    }
    if (search) {
        query += ` AND (s.name LIKE ? OR po.po_number LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY po.date_created DESC`;
    return await db.prepare(query).all(...params);
}

export async function getSupplierOutstandingReport(dateRange?: DateRange, search?: string) {
    await requireSession();
    const db = await getDb();

    let searchClause = "";
    const params: any[] = [];
    if (search) {
        searchClause = ` AND (s.name LIKE ?)`;
        params.push(`%${search}%`);
    }

    const query = `
        SELECT
            s.id as supplier_id,
            s.name as supplier,
            SUM(po.total_amount - COALESCE(po.paid_amount, 0)) as amount_due,
            MAX(po.date_created) as date
        FROM purchase_orders po
        JOIN suppliers s ON po.supplier_id = s.id
        WHERE po.status != 'cancelled'
        ${searchClause}
        GROUP BY s.id, s.name
        HAVING amount_due > 0.01
        ORDER BY amount_due DESC
        `;

    return await db.prepare(query).all(...params);
}

// ============ INVOICING TAB REPORTS ============

export async function getSalesInvoicesReport(dateRange?: DateRange, search?: string) {
    await requireSession();
    const db = await getDb();

    let query = `
        SELECT
            s.id as sale_id,
            s.invoice_number as invoice,
            s.date,
            c.id as customer_id,
            COALESCE(c.name, 'Walk-in') as customer,
            s.total_amount as amount,
            s.payment_method
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        WHERE s.status = 'completed'
        `;

    const params: any[] = [];
    if (dateRange) {
        query += ` AND date(s.date) >= date(?) AND date(s.date) <= date(?)`;
        params.push(dateRange.start, dateRange.end);
    }
    if (search) {
        query += ` AND (s.invoice_number LIKE ? OR c.name LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY s.date DESC`;
    return await db.prepare(query).all(...params);
}

export async function getPurchaseInvoicesReport(dateRange?: DateRange, search?: string) {
    await requireSession();
    const db = await getDb();

    let query = `
        SELECT
            po.id as po_id,
            po.po_number as invoice,
            po.date_created as date,
            s.id as supplier_id,
            s.name as supplier,
            po.total_amount as amount,
            'Purchase Order' as payment_method
        FROM purchase_orders po
        JOIN suppliers s ON po.supplier_id = s.id
        WHERE 1=1
    `;

    const params: any[] = [];
    if (dateRange) {
        query += ` AND date(po.date_created) >= date(?) AND date(po.date_created) <= date(?)`;
        params.push(dateRange.start, dateRange.end);
    }
    if (search) {
        query += ` AND (po.po_number LIKE ? OR s.name LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY po.date_created DESC`;
    return await db.prepare(query).all(...params);
}

export async function getCreditNotesReport(dateRange?: DateRange, search?: string) {
    await requireSession();
    const db = await getDb();

    let whereClause = "WHERE 1=1";
    const params: any[] = [];
    if (dateRange) {
        whereClause += ` AND date(cn.date) >= date(?) AND date(cn.date) <= date(?)`;
        params.push(dateRange.start, dateRange.end);
    }
    if (search) {
        whereClause += ` AND (cn.credit_note_number LIKE ? OR cn.type LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }

    const query = `
        SELECT
            cn.id as credit_note_id,
            cn.credit_note_number as note,
            cn.date,
            cn.type,
            cn.amount,
            cn.reference_invoice_id,
            cn.reference_type,
            cn.status,
            cn.reason
        FROM credit_notes cn
        ${whereClause}
        ORDER BY cn.date DESC
    `;

    return await db.prepare(query).all(...params);
}

// ============ CHEQUES TAB REPORTS ============

export async function getChequesInHandReport(dateRange?: DateRange, search?: string) {
    await requireSession();
    const db = await getDb();

    let whereClause = "WHERE status = 'pending'";
    const params: any[] = [];
    if (dateRange) {
        whereClause += ` AND date(due_date) >= date(?) AND date(due_date) <= date(?)`;
        params.push(dateRange.start, dateRange.end);
    }
    if (search) {
        whereClause += ` AND (cheque_number LIKE ? OR payee_name LIKE ? OR bank_name LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    return await db.prepare(`
        SELECT id, cheque_number, payee_name as customer_name, bank_name, amount, 
               due_date as cheque_date, issue_date, status, notes
        FROM cheques ${whereClause} ORDER BY due_date ASC
    `).all(...params);
}

export async function getTodayReceivedChequesReport(dateRange?: DateRange, search?: string) {
    await requireSession();
    const db = await getDb();

    let whereClause = "WHERE date(created_at) = date('now')";
    const params: any[] = [];
    if (search) {
        whereClause += ` AND (cheque_number LIKE ? OR payee_name LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }

    return await db.prepare(`
        SELECT id, cheque_number, payee_name as customer_name, bank_name, amount,
               due_date as cheque_date, issue_date, status
        FROM cheques ${whereClause} ORDER BY created_at DESC
    `).all(...params);
}

export async function getTodayDatedChequesReport(dateRange?: DateRange, search?: string) {
    await requireSession();
    const db = await getDb();

    let whereClause = "WHERE date(due_date) = date('now')";
    const params: any[] = [];
    if (search) {
        whereClause += ` AND (cheque_number LIKE ? OR payee_name LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }

    return await db.prepare(`
        SELECT id, cheque_number, payee_name as customer_name, bank_name, amount,
               due_date as cheque_date, issue_date, status
        FROM cheques ${whereClause} ORDER BY due_date ASC
    `).all(...params);
}

export async function getBouncedChequesReport(dateRange?: DateRange, search?: string) {
    await requireSession();
    const db = await getDb();

    let whereClause = "WHERE status = 'bounced'";
    const params: any[] = [];
    if (dateRange) {
        whereClause += ` AND date(due_date) >= date(?) AND date(due_date) <= date(?)`;
        params.push(dateRange.start, dateRange.end);
    }
    if (search) {
        whereClause += ` AND (cheque_number LIKE ? OR payee_name LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }

    return await db.prepare(`
        SELECT id, cheque_number, payee_name as customer_name, bank_name, amount,
               due_date as cheque_date, cleared_date as bounce_date, status
        FROM cheques ${whereClause} ORDER BY due_date DESC
    `).all(...params);
}

export async function getReceivedPartyChequesReport(dateRange?: DateRange, search?: string) {
    await requireSession();
    const db = await getDb();

    let whereClause = "WHERE reference_type IN ('sale', 'customer', 'party')";
    const params: any[] = [];
    if (search) {
        whereClause += ` AND (cheque_number LIKE ? OR payee_name LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }

    return await db.prepare(`
        SELECT id, cheque_number, payee_name as customer_name, bank_name, amount,
               due_date as cheque_date, issue_date, status
        FROM cheques ${whereClause} ORDER BY created_at DESC
    `).all(...params);
}

export async function getReceivedOwnChequesReport(dateRange?: DateRange, search?: string) {
    await requireSession();
    const db = await getDb();

    let whereClause = "WHERE reference_type IN ('own', 'internal')";
    const params: any[] = [];
    if (search) {
        whereClause += ` AND (cheque_number LIKE ? OR payee_name LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }

    return await db.prepare(`
        SELECT id, cheque_number, payee_name as customer_name, bank_name, amount,
               due_date as cheque_date, issue_date, status
        FROM cheques ${whereClause} ORDER BY created_at DESC
    `).all(...params);
}

export async function getGivenPartyChequesReport(dateRange?: DateRange, search?: string) {
    await requireSession();
    const db = await getDb();

    let whereClause = "WHERE reference_type IN ('purchase', 'supplier', 'party') AND payee_name IS NOT NULL";
    const params: any[] = [];
    if (search) {
        whereClause += ` AND (cheque_number LIKE ? OR payee_name LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }

    return await db.prepare(`
        SELECT id, cheque_number, payee_name as supplier_name, bank_name, amount,
               due_date as cheque_date, issue_date, status
        FROM cheques ${whereClause} ORDER BY created_at DESC
    `).all(...params);
}

export async function getGivenOwnChequesReport(dateRange?: DateRange, search?: string) {
    await requireSession();
    const db = await getDb();

    let whereClause = "WHERE payee_name IS NOT NULL AND reference_type NOT IN ('sale', 'customer', 'party')";
    const params: any[] = [];
    if (search) {
        whereClause += ` AND (cheque_number LIKE ? OR payee_name LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }

    return await db.prepare(`
        SELECT id, cheque_number, payee_name, bank_name, amount,
               due_date as cheque_date, issue_date, status
        FROM cheques ${whereClause} ORDER BY created_at DESC
    `).all(...params);
}

export async function getSupplierStatement(supplierId: number, startDate?: string, endDate?: string) {
    await requireSession();
    const db = await getDb();

    const supplier = await db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId) as any;
    if (!supplier) return null;

    let sql = `
        SELECT je.date, je.description, je.reference_type, je.reference_id, jel.debit, jel.credit 
        FROM journal_entries je 
        JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id 
        JOIN accounts a ON jel.account_id = a.id 
        WHERE a.account_code IN ('2100', '2110')
        AND je.reference_id IN(
            SELECT id FROM purchase_orders WHERE supplier_id = ?
                UNION 
            SELECT id FROM journal_entries WHERE reference_type = 'supplier_settlement' AND reference_id = ?
        )
        `;
    const params: any[] = [supplierId, supplierId];


    if (startDate) { sql += ' AND je.date >= ?'; params.push(startDate); }
    if (endDate) { sql += ' AND je.date <= ?'; params.push(endDate); }

    sql += ' ORDER BY je.date ASC, je.id ASC';

    const entries = await db.prepare(sql).all(...params) as any[];

    return { supplier, entries };
}



