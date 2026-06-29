'use client';

import { useCallback, useState } from 'react';
import { useLoadEffect } from '@/hooks/useLoadEffect';
import { getInventoryValuation, getTopSellingItems } from '@/app/actions/analytics';
import { formatCurrency } from '@/lib/utils';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';
import { ChartContainer } from '@/components/ui/ChartContainer';
import { Box, BarChart3, Info, Landmark, TrendingUp, Activity } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';

export default function InventoryAnalyticsTab() {
    const [valuation, setValuation] = useState<any>(null);
    const [topItems, setTopItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        setLoading(true);
        const [val, top] = await Promise.all([
            getInventoryValuation(),
            getTopSellingItems()
        ]);
        setValuation(val || { totalItems: 0, totalStock: 0, costValue: 0, retailValue: 0, potentialProfit: 0 });
        setTopItems(top || []);
        setLoading(false);
    }, []);

    useLoadEffect(() => loadData(), [loadData]);

    if (loading) return <div>Loading inventory analytics...</div>;

    // Mock category breakdown as we don't have a specific "value by category" action yet
    // In a real scenario, we'd add an action for this. 
    // For now, let's use the top items to simulate distribution or just focus on the main stats.

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Quick Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                <StatCard
                    title="Total Cost Value"
                    value={formatCurrency(valuation.costValue)}
                    subtitle="Initial investment in stock"
                    icon={Landmark}
                    variant="orange"
                />
                <StatCard
                    title="Retail Value"
                    value={formatCurrency(valuation.retailValue)}
                    subtitle="Expected revenue from stock"
                    icon={TrendingUp}
                    variant="green"
                />
                <StatCard
                    title="Potential Profit"
                    value={formatCurrency(valuation.potentialProfit)}
                    subtitle="Gross profit if all sold"
                    icon={Activity}
                    variant="blue"
                />
                <StatCard
                    title="Total Items"
                    value={`${valuation.totalStock} units`}
                    subtitle="Physical stock count"
                    icon={Box}
                    variant="indigo"
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
                {/* Top Selling Bar Chart */}
                <div className="card" style={{ padding: '1.5rem', height: '400px', display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ fontSize: '1.125rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <BarChart3 size={20} style={{ color: 'var(--primary)' }} />
                        Top 10 Selling Products (Revenue)
                    </h3>
                    <ChartContainer height={300}>
                            <BarChart data={topItems.slice(0, 10)}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                <XAxis
                                    dataKey="name"
                                    stroke="var(--muted)"
                                    fontSize={12}
                                    tickFormatter={(v) => v.length > 10 ? v.substring(0, 10) + '...' : v}
                                />
                                <YAxis stroke="var(--muted)" fontSize={12} />
                                <Tooltip
                                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                    formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                                />
                                <Bar dataKey="total_revenue" name="Revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                    </ChartContainer>
                </div>

                <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h3 style={{ fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Box size={20} style={{ color: 'var(--primary)' }} />
                        Inventory Health
                    </h3>
                    <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
                        Summary of stock levels and valuation metrics. Use these figures for insurance and tax reporting.
                    </p>

                    <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ padding: '1rem', background: 'var(--secondary)', borderRadius: 'var(--radius)' }}>
                            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Profit Margin</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--success)' }}>
                                {valuation.retailValue > 0 ? ((valuation.potentialProfit / valuation.retailValue) * 100).toFixed(1) : 0}%
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--muted)', fontSize: '0.75rem' }}>
                            <Info size={14} />
                            Potential profit assumes all current stock is sold at marked retail price.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
