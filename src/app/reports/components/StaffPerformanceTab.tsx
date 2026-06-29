'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { ChartContainer } from '@/components/ui/ChartContainer';
import { TrendingUp, Clock } from 'lucide-react';
import { getStaffPerformance } from '@/app/actions/reports';

export default function StaffPerformanceTab() {
    const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('today');

    const { data = [], isLoading: loading } = useQuery({
        queryKey: ['staff-performance', dateRange],
        queryFn: () => getStaffPerformance(dateRange as 'today' | 'week' | 'month'),
        staleTime: 1000 * 15, // 15 seconds
        refetchInterval: 1000 * 30, // Auto-refetch every 30 seconds
        refetchOnWindowFocus: true,
    });

    if (loading) return <div className="p-8 text-center">Loading performance data...</div>;

    return (
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Staff Performance</h2>
                    <p style={{ color: 'var(--muted)' }}>Sales and efficiency metrics by team member</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--secondary)', padding: '0.25rem', borderRadius: 'var(--radius)' }}>
                    {(['today', 'week', 'month'] as const).map(r => (
                        <button
                            key={r}
                            onClick={() => setDateRange(r)}
                            className={dateRange === r ? 'btn btn-primary' : 'btn btn-ghost'}
                            style={{ textTransform: 'capitalize', padding: '0.5rem 1rem' }}
                        >
                            {r}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {data.map((user: any) => (
                    <div key={user.userId} className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                    {user.username.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <h3 style={{ fontWeight: 'bold' }}>{user.username}</h3>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>{user.role}</p>
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>${user.totalSales.toLocaleString()}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Total Sales</div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                            <div>
                                <div style={{ fontSize: '0.875rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <TrendingUp size={14} /> Transactions
                                </div>
                                <div style={{ fontWeight: 'bold' }}>{user.transactionCount}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.875rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <Clock size={14} /> Avg Value
                                </div>
                                <div style={{ fontWeight: 'bold' }}>${user.avgTransactionValue.toFixed(2)}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="card" style={{ padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '1.5rem' }}>Sales Comparison</h3>
                <ChartContainer height={320}>
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                        <XAxis dataKey="username" stroke="var(--muted)" />
                        <YAxis stroke="var(--muted)" />
                        <Tooltip
                            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }}
                        />
                        <Bar dataKey="totalSales" name="Total Sales" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ChartContainer>
            </div>
        </div>
    );
}
