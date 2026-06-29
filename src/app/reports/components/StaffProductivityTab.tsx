'use client';

import { useCallback, useState } from 'react';
import { useLoadEffect } from '@/hooks/useLoadEffect';
import { getStaffSalesReport } from '@/app/actions/reports_staff';
import { formatCurrency } from '@/lib/utils';
import { Users, Zap, BarChart3 } from 'lucide-react';

export default function StaffProductivityTab() {
    const [stats, setStats] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        setLoading(true);
        const data = await getStaffSalesReport();
        setStats(data.filter((s: any) =>
            s.role !== 'super_admin' &&
            !s.username.startsWith('[')
        ));
        setLoading(false);
    }, []);

    useLoadEffect(() => loadData(), [loadData]);

    if (loading) return <div>Loading staff sales metrics...</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.125rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Zap size={20} style={{ color: 'var(--primary)' }} />
                    Staff Sales Performance
                </h3>
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Staff Member</th>
                                <th>Role</th>
                                <th style={{ textAlign: 'right' }}>Transactions</th>
                                <th style={{ textAlign: 'right' }}>Avg. Sale</th>
                                <th style={{ textAlign: 'right' }}>Total Sales</th>
                                <th style={{ textAlign: 'right' }}>Total Profit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
                                        No staff sales data available.
                                    </td>
                                </tr>
                            ) : stats.map(staff => (
                                <tr key={staff.userId}>
                                    <td style={{ fontWeight: 600 }}>{staff.username}</td>
                                    <td>
                                        <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: 99, background: 'var(--primary-subtle)', color: 'var(--primary)', fontWeight: 600, textTransform: 'capitalize' }}>
                                            {staff.role}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>{staff.transactionCount || 0}</td>
                                    <td style={{ textAlign: 'right' }}>{formatCurrency(staff.averageTransactionValue || 0)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(staff.totalSales || 0)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(staff.totalProfit || 0)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="card" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                        <Users size={20} style={{ color: 'var(--primary)' }} />
                        <h4 style={{ fontWeight: 'bold', margin: 0 }}>Staff Performance Tracking</h4>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--muted)', lineHeight: '1.6' }}>
                        Track each staff member&apos;s sales contribution, transaction count, and profit generation.
                        Use this data to identify top performers and areas for improvement.
                    </p>
                </div>
                <div className="card" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                        <BarChart3 size={20} style={{ color: 'var(--success)' }} />
                        <h4 style={{ fontWeight: 'bold', margin: 0 }}>Improving Sales</h4>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--muted)', lineHeight: '1.6' }}>
                        Compare average transaction values across staff to identify upselling opportunities.
                        Higher average transaction values indicate effective product recommendations.
                    </p>
                </div>
            </div>
        </div>
    );
}
