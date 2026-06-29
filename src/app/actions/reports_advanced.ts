'use server';


import { requireSession } from './authz';
import { getDb } from '@/lib/db';

export type ReportSummary = {
  totalSales: number;
  totalOrders: number;
  totalProfit: number;
  averageOrderValue: number;
};

export type DailySales = {
  date: string;
  count: number;
  total: number;
};

export async function getSalesReport(startDate?: string, endDate?: string) {
    await requireSession();
  const db = await getDb();

  const _now = new Date();
  const endD = new Date();
  const startD = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const end = endDate || localDate(endD);
  const start = startDate || localDate(startD);

  // 1. Summary Metrics
  const summary = await db.prepare(`
    SELECT 
      SUM(total_amount) as totalSales,
      COUNT(id) as totalOrders,
      AVG(total_amount) as averageOrderValue,
      SUM(total_amount - (
        SELECT SUM(si.quantity * p.cost_price)
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = sales.id
      )) as totalProfit
    FROM sales
    WHERE date(date) >= date(?) AND date(date) <= date(?) AND status = 'completed'
  `).get(start, end) as ReportSummary;

  // 2. Daily Breakdown (Chart Data)
  const chartData = await db.prepare(`
    SELECT 
      date(s.date) as date,
      COUNT(s.id) as count,
      SUM(s.total_amount) as total,
      SUM(
        COALESCE((
          SELECT SUM(si.quantity * (si.price - p.cost_price)) 
          FROM sale_items si 
          JOIN products p ON si.product_id = p.id 
          WHERE si.sale_id = s.id
        ), 0)
      ) as profit
    FROM sales s
    WHERE date(s.date) >= date(?) AND date(s.date) <= date(?) AND s.status = 'completed'
    GROUP BY date(s.date)
    ORDER BY date ASC
  `).all(start, end) as (DailySales & { profit: number })[];

  // 3. Top Products
  const topProducts = await db.prepare(`
    SELECT 
      p.name,
      SUM(si.quantity) as qty,
      SUM(si.quantity * si.price) as revenue,
      SUM(si.quantity * (si.price - p.cost_price)) as profit
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    JOIN sales s ON si.sale_id = s.id
    WHERE date(s.date) >= date(?) AND date(s.date) <= date(?) AND s.status = 'completed'
    GROUP BY p.id
    ORDER BY revenue DESC
    LIMIT 5
  `).all(start, end) as { name: string, qty: number, revenue: number, profit: number }[];

  return {
    summary: {
      totalSales: summary.totalSales || 0,
      totalOrders: summary.totalOrders || 0,
      totalProfit: summary.totalProfit || 0,
      averageOrderValue: summary.averageOrderValue || 0,
    },
    chartData,
    topProducts,
    dateRange: { start, end }
  };
}
