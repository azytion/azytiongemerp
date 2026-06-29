'use client';

import { useCallback, useState } from 'react';
import { useLoadEffect } from '@/hooks/useLoadEffect';
import { getStaffSalesReport, StaffSalesSummary } from '@/app/actions/reports_staff';
import { formatCurrency } from '@/lib/utils';
import { Users, TrendingUp, Award, ShoppingBag, DollarSign } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';

export default function StaffPerformanceDashboard() {
    const [stats, setStats] = useState<StaffSalesSummary[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        setLoading(true);
        const data = await getStaffSalesReport();
        setStats(data.filter((s: StaffSalesSummary) =>
          s.role !== 'super_admin' &&
          !s.username.startsWith('[') &&
          !s.username.includes('[Deleted]') &&
          !s.username.includes('[Purged]')
        ));
        setLoading(false);
    }, []);

    useLoadEffect(() => loadData(), [loadData]);

    if (loading) return <div>Loading staff performance...</div>;

    const topSeller = stats.length > 0 ? stats[0] : null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Top Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                <StatCard
                    title="Top Performer"
                    value={topSeller ? topSeller.username : 'N/A'}
                    subtitle={topSeller ? `${formatCurrency(topSeller.totalSales)} in sales` : formatCurrency(0)}
                    icon={Award}
                    variant="purple"
                    footerIcon={DollarSign}
                />

                <StatCard
                    title="Avg. Ticket Size"
                    value={formatCurrency(stats.reduce((acc, s) => acc + s.averageTransactionValue, 0) / (stats.length || 1))}
                    subtitle="System-wide average per sale"
                    icon={TrendingUp}
                    variant="green"
                    footerIcon={ShoppingBag}
                />
            </div>

            {/* Performance Table */}
            <div className="card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.125rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Users size={20} style={{ color: 'var(--primary)' }} />
                    Staff Performance Breakdown
                </h3>
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Staff Member</th>
                                <th>Role</th>
                                <th style={{ textAlign: 'right' }}>Transactions</th>
                                <th style={{ textAlign: 'right' }}>Avg. Ticket</th>
                                <th style={{ textAlign: 'right' }}>Total Sales</th>
                                <th style={{ textAlign: 'right' }}>Estimated Profit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.map(staff => (
                                <tr key={staff.userId}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '50%',
                                                backgroundColor: 'var(--secondary)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 'bold',
                                                color: 'var(--primary)',
                                                fontSize: '0.75rem'
                                            }}>
                                                {staff.username.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div style={{ fontWeight: '500' }}>{staff.username}</div>
                                        </div>
                                    </td>
                                    <td>
                                        <span style={{
                                            fontSize: '0.75rem',
                                            padding: '0.1rem 0.5rem',
                                            borderRadius: '1rem',
                                            backgroundColor: 'var(--secondary)',
                                            textTransform: 'capitalize'
                                        }}>
                                            {staff.role}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>{staff.transactionCount}</td>
                                    <td style={{ textAlign: 'right' }}>{formatCurrency(staff.averageTransactionValue)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: '600' }}>{formatCurrency(staff.totalSales)}</td>
                                    <td style={{ textAlign: 'right', color: 'var(--success)' }}>{formatCurrency(staff.totalProfit)}</td>
                                </tr>
                            ))}
                            {stats.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>No performance data available</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
