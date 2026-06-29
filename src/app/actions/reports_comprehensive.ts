'use server';


import { requireSession } from './authz';
import { getDb } from '@/lib/db';
import { PaginatedResult } from './types';

export interface DateRange {
    start: string;
    end: string;
}

// ============ MAIN TAB REPORTS ============

export async function getStatementReport(dateRange?: DateRange, page: number = 1, pageSize: number = 10, search?: string): Promise<PaginatedResult<any>> {
    await requireSession();
    const db = await getDb();
    const offset = (page - 1) * pageSize;

    let whereClause = "WHERE 1=1";
    const params: any[] = [];
    if (dateRange) {
        whereClause += ` AND date(date) >= date(?) AND date(date) <= date(?)`;
        params.push(dateRange.start, dateRange.end);
    }
    if (search) {
        whereClause += ` AND (transaction_type LIKE ? OR description LIKE ? OR reference_type LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const totalCount = await db.prepare(`SELECT COUNT(*) as count FROM daybook ${whereClause}`).get(...params) as { count: number };
    const query = `
        SELECT 
            date || 'T' || time as date,
            transaction_type as type, 
            COALESCE(reference_type || ' #' || reference_id, '-') as reference, 
            CASE WHEN credit > 0 THEN credit ELSE -debit END as amount,
            description
        FROM daybook
        ${whereClause}
        ORDER BY date DESC, time DESC
        LIMIT ? OFFSET ?
    `;

    const data = await db.prepare(query).all(...params, Number(pageSize)|0, Number(offset)|0);
    return {
        data,
        total: totalCount.count,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount.count / pageSize)
    };
}

export async function getAdjustmentReport(dateRange?: DateRange, page: number = 1, pageSize: number = 10, search?: string): Promise<PaginatedResult<any>> {
    await requireSession();
    const db = await getDb();
    const offset = (page - 1) * pageSize;

    let whereClause = "WHERE 1=1";
    const params: any[] = [];

    if (dateRange) {
        whereClause += ` AND date(ia.date) >= date(?) AND date(ia.date) <= date(?)`;
        params.push(dateRange.start, dateRange.end);
    }
    if (search) {
        whereClause += ` AND (p.name LIKE ? OR ia.reason LIKE ? OR ia.adjustment_type LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const totalCount = await db.prepare(`
        SELECT COUNT(*) as count 
        FROM inventory_adjustments ia
        JOIN products p ON ia.product_id = p.id
        ${whereClause}
    `).get(...params) as { count: number };

    const query = `
        SELECT ia.date, p.name as product, ia.adjustment_type as type, ia.quantity, ia.reason, ia.notes
        FROM inventory_adjustments ia
        JOIN products p ON ia.product_id = p.id
        ${whereClause}
        ORDER BY ia.date DESC
        LIMIT ? OFFSET ?
    `;

    const data = await db.prepare(query).all(...params, Number(pageSize)|0, Number(offset)|0);
    return {
        data,
        total: totalCount.count,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount.count / pageSize)
    };
}

export async function getActivityLogReport(dateRange?: DateRange, page: number = 1, pageSize: number = 10, search?: string): Promise<PaginatedResult<any>> {
    await requireSession();
    const db = await getDb();
    const offset = (page - 1) * pageSize;

    let whereClause = "WHERE 1=1";
    const params: any[] = [];

    if (dateRange) {
        whereClause += ` AND date(timestamp) >= date(?) AND date(timestamp) <= date(?)`;
        params.push(dateRange.start, dateRange.end);
    }
    if (search) {
        whereClause += ` AND (u.username LIKE ? OR al.action LIKE ? OR al.entity_type LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const totalCount = await db.prepare(`
        SELECT COUNT(*) as count 
        FROM user_activity_log al
        JOIN users u ON al.user_id = u.id
        ${whereClause}
    `).get(...params) as { count: number };

    const query = `
        SELECT al.timestamp as date, u.username as user, al.action, al.entity_type, al.entity_id, al.new_values as details
        FROM user_activity_log al
        JOIN users u ON al.user_id = u.id
        ${whereClause}
        ORDER BY al.timestamp DESC
        LIMIT ? OFFSET ?
    `;

    const data = await db.prepare(query).all(...params, Number(pageSize)|0, Number(offset)|0);
    return {
        data,
        total: totalCount.count,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount.count / pageSize)
    };
}

export async function getTransactionsReport(dateRange?: DateRange, page: number = 1, pageSize: number = 10, search?: string): Promise<PaginatedResult<any>> {
    await requireSession();
    const db = await getDb();
    const offset = (page - 1) * pageSize;

    let whereClause = "WHERE 1=1";
    const params: any[] = [];
    if (dateRange) {
        whereClause += ` AND date(date) >= date(?) AND date(date) <= date(?)`;
        params.push(dateRange.start, dateRange.end);
    }
    if (search) {
        whereClause += ` AND (invoice_number LIKE ? OR payment_method LIKE ? OR status LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const totalCount = await db.prepare(`SELECT COUNT(*) as count FROM sales ${whereClause}`).get(...params) as { count: number };
    const query = `
        SELECT s.id, s.date, s.invoice_number, s.total_amount, s.payment_method, 
               s.status, s.payment_status, s.type,
               COALESCE(c.name, 'Walk-in') as customer_name
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        ${whereClause}
        ORDER BY s.date DESC
        LIMIT ? OFFSET ?
    `;

    const data = await db.prepare(query).all(...params, Number(pageSize)|0, Number(offset)|0);
    return {
        data,
        total: totalCount.count,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount.count / pageSize)
    };
}

export async function getPayablesReport(dateRange?: DateRange, search?: string) {
    await requireSession();
    const db = await getDb();

    let searchClause = "WHERE po.status != 'cancelled'";
    const params: any[] = [];
    if (search) {
        searchClause += ` AND (s.name LIKE ? OR s.phone LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }

    const query = `
        SELECT 
            s.id as supplier_id,
            s.name as supplier,
            SUM(po.total_amount - COALESCE(po.paid_amount, 0)) as amount_due,
            MAX(po.date_created) as last_date,
            s.phone as contact
        FROM suppliers s
        JOIN purchase_orders po ON s.id = po.supplier_id
        ${searchClause}
        GROUP BY s.id, s.name
        HAVING amount_due > 0.01
        ORDER BY amount_due DESC
    `;

    return await db.prepare(query).all(...params);
}

export async function getReceivablesReport(dateRange?: DateRange, search?: string) {
    await requireSession();
    const db = await getDb();

    const params: any[] = [];
    let extraWhere = '';
    if (search) {
        extraWhere = ` AND (c.name LIKE ? OR c.phone LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }

    return await db.prepare(`
        SELECT 
            c.id as customer_id,
            c.name as customer,
            COALESCE(c.balance, 0) as amount_due,
            MAX(s.date) as last_date,
            c.phone as contact
        FROM customers c
        LEFT JOIN sales s ON c.id = s.customer_id AND s.status = 'completed'
        WHERE c.balance > 0.01
        ${extraWhere}
        GROUP BY c.id, c.name
        ORDER BY amount_due DESC
    `).all(...params);
}

// ============ FINANCE TAB REPORTS ============

export async function getBalanceSheetReport() {
    await requireSession();
    const db = await getDb();

    // ── ASSETS ──────────────────────────────────────────────────────────────
    const inventoryValue = (await db.prepare(`
        SELECT COALESCE(SUM(stock * COALESCE(cost_price, 0)), 0) as value 
        FROM products WHERE (is_archived IS NULL OR is_archived = 0)
    `).get() as any).value;

    // Cash in hand = total cash received from sales minus cash paid out for purchases
    const cashFromSales = (await db.prepare(`
        SELECT COALESCE(SUM(received_cash - COALESCE(balance_to_return, 0)), 0) as value 
        FROM sales WHERE status = 'completed' AND payment_method IN ('Cash', 'cash')
    `).get() as any).value;

    const cashPaidPurchases = (await db.prepare(`
        SELECT COALESCE(SUM(COALESCE(paid_amount, 0)), 0) as value 
        FROM purchase_orders WHERE status != 'cancelled'
    `).get() as any).value;

    const cashInHand = Math.max(0, cashFromSales - cashPaidPurchases);

    const accountsReceivable = (await db.prepare(`
        SELECT COALESCE(SUM(balance), 0) as value FROM customers WHERE balance > 0
    `).get() as any).value;

    const chequesInHand = (await db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as value FROM cheques WHERE status = 'pending'
    `).get() as any).value;

    // ── LIABILITIES ──────────────────────────────────────────────────────────
    const accountsPayable = (await db.prepare(`
        SELECT COALESCE(SUM(total_amount - COALESCE(paid_amount, 0)), 0) as value 
        FROM purchase_orders WHERE status NOT IN ('cancelled', 'received')
    `).get() as any).value;

    const customerDeposits = (await db.prepare(`
        SELECT COALESCE(SUM(ABS(balance)), 0) as value FROM customers WHERE balance < 0
    `).get() as any).value;

    // ── EQUITY ───────────────────────────────────────────────────────────────
    const totalRevenue = (await db.prepare(`
        SELECT COALESCE(SUM(CASE WHEN type='sale' THEN total_amount WHEN type='return' THEN -ABS(total_amount) ELSE 0 END), 0) as value 
        FROM sales WHERE status = 'completed'
    `).get() as any).value;

    const totalCOGS = (await db.prepare(`
        SELECT COALESCE(SUM(si.quantity * COALESCE(p.cost_price, 0)), 0) as value
        FROM sale_items si 
        JOIN products p ON si.product_id = p.id
        JOIN sales s ON si.sale_id = s.id 
        WHERE s.status = 'completed' AND s.type = 'sale'
    `).get() as any).value;

    const retainedEarnings = totalRevenue - totalCOGS;
    const totalInventory = inventoryValue;
    const totalAssets = totalInventory + cashInHand + accountsReceivable + chequesInHand;
    const totalLiabilities = accountsPayable + customerDeposits;
    const totalEquity = retainedEarnings;

    return {
        assets: [
            { account: 'Cash in Hand', amount: cashInHand },
            { account: 'Inventory (Cost Value)', amount: totalInventory },
            { account: 'Accounts Receivable', amount: accountsReceivable },
            { account: 'Cheques in Hand', amount: chequesInHand },
            { account: 'TOTAL ASSETS', amount: totalAssets },
        ],
        liabilities: [
            { account: 'Accounts Payable', amount: accountsPayable },
            { account: 'Customer Deposits', amount: customerDeposits },
            { account: 'TOTAL LIABILITIES', amount: totalLiabilities },
            { account: 'Retained Earnings', amount: retainedEarnings },
            { account: 'TOTAL EQUITY', amount: totalEquity },
            { account: 'TOTAL LIABILITIES + EQUITY', amount: totalLiabilities + totalEquity },
        ]
    };
}

// ============ INVENTORY TAB REPORTS ============

export async function getItemListReport(search?: string) {
    await requireSession();
    const db = await getDb();

    let searchClause = "WHERE 1=1";
    const params: any[] = [];
    if (search) {
        searchClause += ` AND (p.name LIKE ? OR p.barcode LIKE ? OR c.name LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    return await db.prepare(`
        SELECT 
            p.id as product_id,
            p.name,
            p.barcode,
            COALESCE(c.name, p.category, 'Uncategorized') as category,
            COALESCE(p.cost_price, 0) as cost_price,
            COALESCE(p.selling_price, 0) as selling_price,
            COALESCE(p.stock, 0) as stock,
            COALESCE(p.reorder_level, 0) as reorder_level
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        ${searchClause}
        AND (p.is_archived IS NULL OR p.is_archived = 0)
        ORDER BY p.name ASC
    `).all(...params);
}

export async function getSupplierWiseReport(search?: string) {
    await requireSession();
    const db = await getDb();

    let searchClause = "WHERE 1=1";
    const params: any[] = [];
    if (search) {
        searchClause += ` AND (s.name LIKE ?)`;
        params.push(`%${search}%`);
    }

    return await db.prepare(`
        SELECT 
            s.id as supplier_id,
            s.name as supplier_name,
            COUNT(DISTINCT po.id) as total_products,
            COALESCE(SUM(poi.quantity), 0) as total_stock
        FROM suppliers s
        LEFT JOIN purchase_orders po ON s.id = po.supplier_id AND po.status = 'received'
        LEFT JOIN purchase_order_items poi ON po.id = poi.po_id
        ${searchClause}
        GROUP BY s.id, s.name
        ORDER BY s.name ASC
    `).all(...params);
}

export async function getReorderLevelReport(search?: string) {
    await requireSession();
    const db = await getDb();

    let searchClause = "WHERE p.stock <= p.reorder_level AND (p.is_archived IS NULL OR p.is_archived = 0)";
    const params: any[] = [];
    if (search) {
        searchClause += ` AND (p.name LIKE ?)`;
        params.push(`%${search}%`);
    }

    return await db.prepare(`
        SELECT 
            p.name,
            COALESCE(p.stock, 0) as stock,
            COALESCE(p.reorder_level, 0) as reorder_level,
            (COALESCE(p.reorder_level, 0) - COALESCE(p.stock, 0)) as shortage
        FROM products p
        ${searchClause}
        ORDER BY shortage DESC
    `).all(...params);
}

export async function getPurchaseOrderReport(dateRange?: DateRange, page: number = 1, pageSize: number = 10, search?: string): Promise<PaginatedResult<any>> {
    await requireSession();
    const db = await getDb();
    const offset = (page - 1) * pageSize;

    let whereClause = "WHERE 1=1";
    const params: any[] = [];
    if (dateRange) {
        whereClause += ` AND date(po.date_created) >= date(?) AND date(po.date_created) <= date(?)`;
        params.push(dateRange.start, dateRange.end);
    }
    if (search) {
        whereClause += ` AND (po.po_number LIKE ? OR s.name LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }

    const totalCount = await db.prepare(`
        SELECT COUNT(*) as count 
        FROM purchase_orders po
        LEFT JOIN suppliers s ON po.supplier_id = s.id
        ${whereClause}
    `).get(...params) as { count: number };

    const query = `
        SELECT 
            po.id as po_id,
            po.po_number,
            po.date_created as date,
            s.name as supplier,
            po.total_amount as amount,
            po.status
        FROM purchase_orders po
        JOIN suppliers s ON po.supplier_id = s.id
        ${whereClause}
        ORDER BY po.date_created DESC
        LIMIT ? OFFSET ?
    `;

    const data = await db.prepare(query).all(...params, Number(pageSize)|0, Number(offset)|0);
    return {
        data,
        total: totalCount.count,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount.count / pageSize)
    };
}

export async function getSoldItemsReport(dateRange?: DateRange, page: number = 1, pageSize: number = 10, search?: string): Promise<PaginatedResult<any>> {
    await requireSession();
    const db = await getDb();
    const offset = (page - 1) * pageSize;

    let whereClause = "WHERE s.status = 'completed'";
    const params: any[] = [];
    if (dateRange) {
        whereClause += ` AND date(s.date) >= date(?) AND date(s.date) <= date(?)`;
        params.push(dateRange.start, dateRange.end);
    }
    if (search) {
        whereClause += ` AND (p.name LIKE ? OR s.invoice_number LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }

    const totalCountQuery = `SELECT COUNT(DISTINCT p.id) as count
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        JOIN sales s ON si.sale_id = s.id
        ${whereClause}`;
    const totalCount = await db.prepare(totalCountQuery).get(...params) as { count: number };

    const query = `
        SELECT 
            p.id as product_id,
            p.name as product_name,
            p.barcode,
            COALESCE(SUM(si.quantity), 0) as quantity,
            COALESCE(SUM(si.quantity * si.price), 0) as total_sale_value,
            s.invoice_number
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        JOIN sales s ON si.sale_id = s.id
        ${whereClause}
        GROUP BY p.id, p.name, s.invoice_number
        ORDER BY total_sale_value DESC
        LIMIT ? OFFSET ?
    `;

    const data = await db.prepare(query).all(...params, Number(pageSize)|0, Number(offset)|0);
    return {
        data,
        total: totalCount.count,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount.count / pageSize)
    };
}

export async function getTypeWiseReport(search?: string) {
    await requireSession();
    const db = await getDb();

    let searchClause = "WHERE 1=1";
    const params: any[] = [];
    if (search) {
        searchClause += ` AND (COALESCE(c.name, p.category, '') LIKE ?)`;
        params.push(`%${search}%`);
    }

    return await db.prepare(`
        SELECT 
            COALESCE(c.name, p.category, 'Uncategorized') as category,
            COUNT(p.id) as total_items,
            COALESCE(SUM(p.stock), 0) as total_stock,
            COALESCE(SUM(p.stock * p.selling_price), 0) as total_value
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        ${searchClause}
        AND (p.is_archived IS NULL OR p.is_archived = 0)
        GROUP BY COALESCE(c.name, p.category, 'Uncategorized')
        ORDER BY total_value DESC
    `).all(...params);
}

export async function getIncomeStatementReport(dateRange?: DateRange) {
    await requireSession();
    const db = await getDb();

    let dateWhere = '';
    let dateWhereS = '';
    const params: any[] = [];
    const paramsS: any[] = [];
    if (dateRange) {
        dateWhere = ` AND date(date) >= date(?) AND date(date) <= date(?)`;
        dateWhereS = ` AND date(s.date) >= date(?) AND date(s.date) <= date(?)`;
        params.push(dateRange.start, dateRange.end);
        paramsS.push(dateRange.start, dateRange.end);
    }

    const salesResult = await db.prepare(`
        SELECT 
            COALESCE(SUM(CASE WHEN type='sale' THEN total_amount ELSE 0 END), 0) as revenue,
            COALESCE(SUM(CASE WHEN type='return' THEN ABS(total_amount) ELSE 0 END), 0) as returns,
            COALESCE(SUM(COALESCE(discount, 0)), 0) as total_discounts
        FROM sales WHERE status = 'completed' ${dateWhere}
    `).get(...params) as any;

    const cogsResult = await db.prepare(`
        SELECT COALESCE(SUM(si.quantity * COALESCE(p.cost_price, 0)), 0) as cogs
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        JOIN sales s ON si.sale_id = s.id
        WHERE s.status = 'completed' AND s.type = 'sale' ${dateWhereS}
    `).get(...paramsS) as any;

    const commissions = await db.prepare(`
        SELECT COALESCE(SUM(COALESCE(broker_commission, 0)), 0) as value
        FROM sales WHERE status = 'completed' AND type = 'sale' ${dateWhere}
    `).get(...params) as any;

    const revenue = salesResult.revenue || 0;
    const returns = salesResult.returns || 0;
    const discounts = salesResult.total_discounts || 0;
    const netRevenue = revenue - returns - discounts;
    const cogs = cogsResult.cogs || 0;
    const grossProfit = netRevenue - cogs;
    const brokerCommissions = commissions.value || 0;
    const operatingProfit = grossProfit - brokerCommissions;

    return [
        { category: 'Gross Revenue', amount: revenue },
        { category: 'Less: Returns', amount: -returns },
        { category: 'Less: Discounts', amount: -discounts },
        { category: 'Net Revenue', amount: netRevenue },
        { category: 'Cost of Goods Sold', amount: -cogs },
        { category: 'Gross Profit', amount: grossProfit },
        { category: 'Less: Broker Commissions', amount: -brokerCommissions },
        { category: 'Operating Profit', amount: operatingProfit },
    ];
}

export async function getCashFlowReport(dateRange?: DateRange) {
    await requireSession();
    const db = await getDb();

    const params: any[] = [];
    let dateFilter = "";
    if (dateRange) {
        dateFilter = ` AND date(t.date) >= date(?) AND date(t.date) <= date(?)`;
        params.push(dateRange.start, dateRange.end);
    }

    const query = `
        SELECT 
            date,
            COALESCE(SUM(inflow), 0) as cash_inflow,
            COALESCE(SUM(outflow), 0) as cash_outflow,
            COALESCE(SUM(inflow - outflow), 0) as net_cash_flow
        FROM (
            SELECT 
                date(date) as date,
                COALESCE(received_cash - COALESCE(balance_to_return, 0), 0) as inflow,
                0 as outflow
            FROM sales
            WHERE status = 'completed' AND LOWER(payment_method) IN ('cash')
            
            UNION ALL
            
            SELECT 
                date(date_created) as date,
                0 as inflow,
                COALESCE(paid_amount, 0) as outflow
            FROM purchase_orders
            WHERE status != 'cancelled' AND COALESCE(paid_amount, 0) > 0
        ) t
        WHERE 1=1 ${dateFilter}
        GROUP BY date
        ORDER BY date DESC
    `;

    return await db.prepare(query).all(...params);
}

// ── Drill-down helpers ────────────────────────────────────────────────────────

export async function getSaleItemsDrillDown(saleId: number): Promise<any[]> {
    try {
        await requireSession();
    } catch {
        return [];
    }
    const db = await getDb();
    return await db.prepare(`
        SELECT si.quantity, si.price, si.discount,
               p.name as product_name, p.barcode,
               gd.carat_weight, gd.shape, gd.origin
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        LEFT JOIN gem_details gd ON gd.product_id = p.id AND gd.variant_id IS NULL
        WHERE si.sale_id = ?
        ORDER BY si.id
    `).all(saleId) as any[];
}

export async function getCustomerSalesDrillDown(customerId: number): Promise<any[]> {
    try {
        await requireSession();
    } catch {
        return [];
    }
    const db = await getDb();
    return await db.prepare(`
        SELECT s.invoice_number, s.date, s.total_amount, s.payment_method, s.payment_status,
               u.username as salesman
        FROM sales s
        LEFT JOIN users u ON s.user_id = u.id
        WHERE s.customer_id = ? AND s.type = 'sale'
        ORDER BY s.date DESC
        LIMIT 50
    `).all(customerId) as any[];
}

export async function getSupplierPurchasesDrillDown(supplierId: number): Promise<any[]> {
    try {
        await requireSession();
    } catch {
        return [];
    }
    const db = await getDb();
    return await db.prepare(`
        SELECT po.po_number, po.date_created, po.total_amount, po.status, po.payment_status
        FROM purchase_orders po
        WHERE po.supplier_id = ?
        ORDER BY po.date_created DESC
        LIMIT 50
    `).all(supplierId) as any[];
}

export async function getProductSalesDrillDown(productId: number): Promise<any[]> {
    try {
        await requireSession();
    } catch {
        return [];
    }
    const db = await getDb();
    return await db.prepare(`
        SELECT s.invoice_number, s.date, si.quantity, si.price, si.discount,
               c.name as customer_name
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        LEFT JOIN customers c ON s.customer_id = c.id
        WHERE si.product_id = ?
        ORDER BY s.date DESC
        LIMIT 50
    `).all(productId) as any[];
}

// ── Accounts / Payment Method Summary ────────────────────────────────────────
export async function getAccountsReport(dateRange?: DateRange) {
    await requireSession();
    const db = await getDb();

    let dateWhere = '';
    const params: any[] = [];
    if (dateRange) {
        dateWhere = ` AND date(s.date) >= date(?) AND date(s.date) <= date(?)`;
        params.push(dateRange.start, dateRange.end);
    }

    // Aggregate totals per payment method
    const totals = await db.prepare(`
        SELECT 
            payment_method as method,
            COUNT(*) as count,
            COALESCE(SUM(total_amount), 0) as total
        FROM sales
        WHERE status = 'completed' AND type = 'sale' ${dateWhere}
        GROUP BY payment_method
        ORDER BY total DESC
    `).all(...params) as any[];

    // For each method, get the transactions
    const methods = ['Cash', 'Bank', 'Cheque', 'Credit', 'Split', 'Due'];

    // Ensure all methods appear even if 0
    const methodMap = new Map<string, any>();
    for (const m of methods) {
        methodMap.set(m, { method: m, count: 0, total: 0, transactions: [] });
    }

    for (const row of totals) {
        const key = row.method || 'Cash';
        if (methodMap.has(key)) {
            methodMap.get(key).count = row.count;
            methodMap.get(key).total = row.total;
        } else {
            methodMap.set(key, { method: key, count: row.count, total: row.total, transactions: [] });
        }
    }

    // Fetch transactions per method
    for (const [method, entry] of methodMap.entries()) {
        const txParams: any[] = [method, ...params];
        entry.transactions = await db.prepare(`
            SELECT s.invoice_number, s.date, s.total_amount, s.payment_status,
                   COALESCE(c.name, 'Walk-in') as customer_name
            FROM sales s
            LEFT JOIN customers c ON s.customer_id = c.id
            WHERE s.status = 'completed' AND s.type = 'sale'
              AND s.payment_method = ? ${dateWhere}
            ORDER BY s.date DESC
            LIMIT 100
        `).all(...txParams);
    }

    return Array.from(methodMap.values());
}
