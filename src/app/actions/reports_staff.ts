'use server';


import { requireSession } from './authz';
import { getDb } from '@/lib/db';

export type StaffSalesSummary = {
    userId: number;
    username: string;
    role: string;
    totalSales: number;
    transactionCount: number;
    averageTransactionValue: number;
    totalProfit: number;
};

export async function getStaffSalesReport(startDate?: string, endDate?: string) {
    await requireSession();
    const db = await getDb();

    let dateFilter = '';
    const params: any[] = [];

    if (startDate && endDate) {
        dateFilter = 'WHERE s.date BETWEEN ? AND ?';
        params.push(startDate, endDate);
    }

    const sql = `
        SELECT 
            u.id as userId,
            u.username,
            u.role,
            SUM(s.total_amount) as totalSales,
            COUNT(s.id) as transactionCount,
            AVG(s.total_amount) as averageTransactionValue,
            SUM(
                (SELECT SUM(si.quantity * (si.price - p.cost_price))
                 FROM sale_items si
                 JOIN products p ON si.product_id = p.id
                 WHERE si.sale_id = s.id)
            ) as totalProfit
        FROM users u
        LEFT JOIN sales s ON u.id = s.user_id AND s.status = 'completed' AND s.type = 'sale'
        ${dateFilter ? dateFilter + ' AND' : 'WHERE'} u.role != 'super_admin'
          AND u.is_active = 1
          AND u.username NOT LIKE '[%'
        GROUP BY u.id
        ORDER BY totalSales DESC
    `;

    try {
        const results = await db.prepare(sql).all(...params) as StaffSalesSummary[];
        return results;
    } catch (error) {
        console.error('Failed to fetch staff sales report:', error);
        return [];
    }
}

export async function getStaffProductivityStats() {
    await requireSession();
    const db = await getDb();

    // Get sales per staff in the last 30 days (no time_entries dependency)
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    const monthAgoStr = monthAgo.toISOString();

    const sql = `
        SELECT 
            u.id,
            u.username,
            u.role,
            COUNT(s.id) as transactionCount,
            COALESCE(SUM(s.total_amount), 0) as totalSales,
            COALESCE(AVG(s.total_amount), 0) as avgTransactionValue
        FROM users u
        LEFT JOIN sales s ON u.id = s.user_id AND s.date > ? AND s.status = 'completed' AND s.type = 'sale'
        WHERE u.role != 'super_admin'
          AND u.is_active = 1
          AND u.username NOT LIKE '[%'
        GROUP BY u.id
        ORDER BY totalSales DESC
    `;

    try {
        const results = await db.prepare(sql).all(monthAgoStr) as any[];
        return results.map(r => ({
            ...r,
            totalHours: 0,
            shiftCount: 0,
            avgShiftHours: 0,
            salesPerHour: 0,
            hasTimeData: false
        }));
    } catch (error) {
        console.error('Failed to fetch staff productivity stats:', error);
        return [];
    }
}



