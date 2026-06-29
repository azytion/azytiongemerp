'use server';


import { requireSession } from './authz';
import { getDb } from '@/lib/db';

export async function getDashboardStats() {
    await requireSession();
    const db = await getDb();

    // 1. Total Sales (Net)
    const totalSalesResult = await db.prepare(`
        SELECT 
            SUM(CASE WHEN type = 'sale' THEN total_amount ELSE 0 END) as gross_sales,
            SUM(CASE WHEN type = 'return' THEN ABS(total_amount) ELSE 0 END) as total_returns
        FROM sales 
        WHERE status = 'completed'
    `).get() as { gross_sales: number, total_returns: number };

    const totalSales = (totalSalesResult?.gross_sales || 0) - (totalSalesResult?.total_returns || 0);

    // 2. Total Profit (Net) — use COALESCE for NULL cost_price, handle variants
    const totalProfitResult = await db.prepare(`
        SELECT COALESCE(SUM(
            (si.price - COALESCE(p.cost_price, 0)) * si.quantity
            * (CASE WHEN s.type = 'return' THEN -1 ELSE 1 END)
        ), 0) as total_profit
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        JOIN products p ON si.product_id = p.id
        WHERE s.status = 'completed'
    `).get() as { total_profit: number };
    const totalProfit = totalProfitResult?.total_profit || 0;

    // 3. Counts
    const orderCountResult = await db.prepare("SELECT COUNT(*) as count FROM sales WHERE status = 'completed' AND type = 'sale'").get() as { count: number };
    const productCountResult = await db.prepare("SELECT COUNT(*) as count FROM products").get() as { count: number };
    const customerCountResult = await db.prepare("SELECT COUNT(*) as count FROM customers").get() as { count: number };

    // 4. Low Stock
    const setting = await db.prepare("SELECT value FROM settings WHERE key = 'low_stock_threshold'").get() as { value: string };
    const threshold = setting ? parseInt(setting.value) : 10;

    const lowStockResult = await db.prepare(`
        SELECT COUNT(*) as count 
        FROM products 
        WHERE stock <= ? AND (is_archived IS NULL OR is_archived = 0)
    `).get(threshold) as { count: number };

    // 4b. Low stock items list (top 5)
    const lowStockItems = await db.prepare(`
        SELECT id, name, stock, reorder_level, barcode
        FROM products
        WHERE stock <= ? AND stock >= 0 AND (is_archived IS NULL OR is_archived = 0)
        ORDER BY stock ASC
        LIMIT 5
    `).all(threshold) as any[];

    // 5. Recent Sales with customer name
    const recentSales = await db.prepare(`
        SELECT s.id, s.invoice_number, s.date, s.total_amount, s.payment_status,
               COALESCE(c.name, 'Walk-in') as customer_name
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        WHERE s.status = 'completed' AND s.type = 'sale'
        ORDER BY s.date DESC 
        LIMIT 5
    `).all();

    const profitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

    // 6. Today's Stats — compare against UTC date since we store UTC timestamps
    const todayStats = await db.prepare(`
        SELECT 
            COALESCE(SUM(CASE WHEN type = 'sale' THEN total_amount
                             WHEN type = 'return' THEN -ABS(total_amount)
                             ELSE 0 END), 0) as sales,
            COUNT(CASE WHEN type = 'sale' THEN 1 END) as count
        FROM sales 
        WHERE status = 'completed' 
        AND date(date) = date('now')
    `).get() as { sales: number, count: number };

    return {
        totalSales,
        todaySales: todayStats?.sales || 0,
        todayOrders: todayStats?.count || 0,
        totalProfit,
        profitMargin,
        orderCount: orderCountResult?.count || 0,
        productCount: productCountResult?.count || 0,
        customers: customerCountResult?.count || 0,
        lowStock: lowStockResult?.count || 0,
        lowStockItems: lowStockItems || [],
        recentSales,
        pendingCheques: await (async () => {
            try {
                const r = await db.prepare("SELECT COUNT(*) as count FROM cheques WHERE status = 'pending'").get() as { count: number };
                return r?.count || 0;
            } catch { return 0; }
        })(),
        todayDueCheques: await (async () => {
            try {
                const r = await db.prepare("SELECT COUNT(*) as count FROM cheques WHERE status = 'pending' AND due_date <= CURDATE()").get() as { count: number };
                return r?.count || 0;
            } catch { return 0; }
        })(),
    };
}

export async function getSalesTrend() {
    await requireSession();
    const db = await getDb();

    // Get last 7 days sales — returns subtract
    const result = await db.prepare(`
        SELECT 
            strftime('%Y-%m-%d', date) as day, 
            COALESCE(SUM(CASE WHEN type='sale' THEN total_amount
                              WHEN type='return' THEN -ABS(total_amount)
                              ELSE 0 END), 0) as total,
            COALESCE(SUM(
                CASE WHEN type='sale' THEN (
                    SELECT COALESCE(SUM(si.quantity * (si.price - COALESCE(p.cost_price, 0))), 0)
                    FROM sale_items si
                    JOIN products p ON si.product_id = p.id
                    WHERE si.sale_id = sales.id
                ) ELSE 0 END
            ), 0) as profit
        FROM sales 
        WHERE status = 'completed' 
        AND date(date) >= date('now', '-7 days')
        GROUP BY day 
        ORDER BY day ASC
    `).all() as { day: string, total: number, profit: number }[];

    return result;
}

export async function getStaffPerformance(range: 'today' | 'week' | 'month' = 'today') {
    await requireSession();
    const db = await getDb();

    let dateFilter = "date >= date('now', 'start of day')";
    if (range === 'week') dateFilter = "date >= date('now', '-7 days')";
    if (range === 'month') dateFilter = "date >= date('now', 'start of month')";

    const result = await db.prepare(`
        SELECT 
            u.id as userId,
            u.username,
            u.role,
            COUNT(s.id) as transactionCount,
            COALESCE(SUM(s.total_amount), 0) as totalSales,
            COALESCE(AVG(s.total_amount), 0) as avgTransactionValue
        FROM users u
        LEFT JOIN sales s ON u.id = s.user_id AND s.status = 'completed' AND s.type = 'sale' AND ${dateFilter}
        GROUP BY u.id
        ORDER BY totalSales DESC
    `).all();

    return result;
}




