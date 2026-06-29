'use server';


import { requireSession } from './authz';
import { getDb } from '@/lib/db';

export async function getTopSellingItems(limit = 10) {
    await requireSession();
    const db = await getDb();

    try {
        const check = await db.prepare(
            "SELECT TABLE_NAME as name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sale_items'"
        ).get();
        if (!check) return [];

        const items = await db.prepare(`
            SELECT p.name, 
                   COALESCE(SUM(si.quantity), 0) as total_qty, 
                   COALESCE(SUM(si.price * si.quantity), 0) as total_revenue
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            JOIN sales s ON si.sale_id = s.id
            WHERE s.status = 'completed' AND s.type = 'sale'
            GROUP BY si.product_id, p.name
            ORDER BY total_qty DESC
            LIMIT ?
        `).all(limit);
        return items;
    } catch (_e) {
        return [];
    }
}

export async function getInventoryValuation() {
    await requireSession();
    const db = await getDb();

    // Unified products + variants valuation with proper NULL handling
    const stats = await db.prepare(`
        SELECT 
            COUNT(id) as total_items,
            COALESCE(SUM(stock), 0) as total_stock,
            COALESCE(SUM(stock * cost_price), 0) as total_cost_value,
            COALESCE(SUM(stock * selling_price), 0) as total_retail_value
        FROM products
        WHERE (is_archived IS NULL OR is_archived = 0)
    `).get() as any;

    return {
        totalItems: stats.total_items || 0,
        totalStock: stats.total_stock || 0,
        costValue: stats.total_cost_value || 0,
        retailValue: stats.total_retail_value || 0,
        potentialProfit: (stats.total_retail_value || 0) - (stats.total_cost_value || 0)
    };
}

export async function getDailySalesTrend() {
    await requireSession();
    const db = await getDb();

    // Last 30 days global trend
    const trend = await db.prepare(`
        SELECT date(date) as day, SUM(total_amount) as total
        FROM sales
        WHERE status = 'completed' AND date >= date('now', '-30 days')
        GROUP BY day
        ORDER BY day ASC
    `).all();
    return trend;
}

export async function getRecentActivity(limit = 10) {
    await requireSession();
    const db = await getDb();

    try {
        const logs = await db.prepare(`
            SELECT 
                u.username, 
                l.action, 
                (l.action || ' ' || l.entity_type || (CASE WHEN l.entity_id IS NOT NULL THEN ' #' || l.entity_id ELSE '' END)) as description, 
                strftime('%Y-%m-%dT%H:%M:%SZ', l.timestamp) as timestamp
            FROM user_activity_log l
            LEFT JOIN users u ON l.user_id = u.id
            ORDER BY l.timestamp DESC
            LIMIT ?
        `).all(limit);
        return logs;
    } catch (_e) {
        return [];
    }
}



