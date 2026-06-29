'use client';

import { useCallback, useState } from 'react';
import { useLoadEffect } from '@/hooks/useLoadEffect';
import { getTransactionsReport } from '@/app/actions/reports_comprehensive';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { ChartContainer } from '@/components/ui/ChartContainer';
import { TrendingUp, CreditCard, PieChart as PieIcon, Activity, Calendar, Info } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function SalesTrendsTab() {
    const [salesData, setSalesData] = useState<any[]>([]);
    const [paymentData, setPaymentData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        setLoading(true);
        const endDate = (() => { const _d = new Date(); return _d.getFullYear() + "-" + String(_d.getMonth()+1).padStart(2,"0") + "-" + String(_d.getDate()).padStart(2,"0"); })();
        const startDate = (() => { const _d = new Date(); _d.setDate(_d.getDate() - 30); return _d.getFullYear() + "-" + String(_d.getMonth()+1).padStart(2,"0") + "-" + String(_d.getDate()).padStart(2,"0"); })();

        const result = await getTransactionsReport({ start: startDate, end: endDate }, 1, 10000);
        const transactions = result.data || [];

        const dailyMap: Record<string, number> = {};
        const paymentMap: Record<string, number> = {};

        transactions.forEach((t: any) => {
            const day = t.date.split('T')[0];
            dailyMap[day] = (dailyMap[day] || 0) + t.total_amount;

            const method = t.payment_method || 'Unknown';
            paymentMap[method] = (paymentMap[method] || 0) + 1;
        });

        const dailyArray = Object.entries(dailyMap)
            .map(([date, amount]) => ({ date, amount }))
            .sort((a, b) => a.date.localeCompare(b.date));

        const paymentArray = Object.entries(paymentMap)
            .map(([name, value]) => ({ name, value }));

        setSalesData(dailyArray);
        setPaymentData(paymentArray);
        setLoading(false);
    }, []);

    useLoadEffect(() => loadData(), [loadData]);

    if (loading) return <div>Loading sales trends...</div>;

    const totalRevenue = salesData.reduce((acc, curr) => acc + curr.amount, 0);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Quick Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                <StatCard
                    title="Total Revenue (30d)"
                    value={formatCurrency(totalRevenue)}
                    subtitle="Aggregated gross sales"
                    icon={TrendingUp}
                    variant="green"
                />
                <StatCard
                    title="Daily Average"
                    value={formatCurrency(totalRevenue / (salesData.length || 1))}
                    subtitle="Average revenue per day"
                    icon={Activity}
                    variant="blue"
                />
                <StatCard
                    title="Peak Day"
                    value={salesData.length > 0 ? formatCurrency(Math.max(...salesData.map(d => d.amount))) : formatCurrency(0)}
                    subtitle="Highest single day revenue"
                    icon={Calendar}
                    variant="purple"
                />
            </div>

            {/* Sales Trends Area Chart */}
            <div className="card" style={{ padding: '1.5rem', height: '400px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <TrendingUp size={20} style={{ color: 'var(--primary)' }} />
                        Revenue Trend (Last 30 Days)
                    </h3>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Total Revenue</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--success)' }}>{formatCurrency(totalRevenue)}</div>
                    </div>
                </div>
                <ChartContainer height={300}>
                        <AreaChart data={salesData}>
                            <defs>
                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                            <XAxis
                                dataKey="date"
                                stroke="var(--muted)"
                                fontSize={10}
                                tickFormatter={(v) => formatDate(v).split(',')[0]}
                            />
                            <YAxis stroke="var(--muted)" fontSize={12} />
                            <Tooltip
                                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                labelFormatter={(v) => formatDate(v)}
                                formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                            />
                            <Area
                                type="monotone"
                                dataKey="amount"
                                stroke="var(--primary)"
                                fillOpacity={1}
                                fill="url(#colorRevenue)"
                                strokeWidth={2}
                            />
                        </AreaChart>
                </ChartContainer>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                {/* Payment Methods Pie Chart */}
                <div className="card" style={{ padding: '1.5rem', height: '350px', display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ fontSize: '1.125rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <PieIcon size={20} style={{ color: 'var(--primary)' }} />
                        Payment Methods
                    </h3>
                    <ChartContainer height={250}>
                            <PieChart>
                                <Pie
                                    data={paymentData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {paymentData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                    </ChartContainer>
                </div>

                <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                    <div style={{ padding: '1rem', background: 'var(--secondary)', borderRadius: '50%', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                        <CreditCard size={32} />
                    </div>
                    <h3 style={{ margin: 0 }}>Payment Analysis</h3>
                    <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
                        Distribution of transaction counts across different payment methods. Use this to optimize your checkout process.
                    </p>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                        <Info size={14} />
                        <span>Aggregated from {paymentData.reduce((acc, curr) => acc + curr.value, 0)} transactions.</span>
                    </div>
                </div>
            </div>
        </div>
    );
}


