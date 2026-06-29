'use client';

import { useCallback, useState } from 'react';
import { useLoadEffect } from '@/hooks/useLoadEffect';
import { getCheques, getChequeStats } from '@/app/actions/cheques';
import { getCustomers } from '@/app/actions/customers';
import { getDashboardStats } from '@/app/actions/reports';
import { getCreditNotes } from '@/app/actions/credit-notes';
import { getInventoryValuation } from '@/app/actions/analytics';
import { formatCurrency } from '@/lib/utils';
import { BarChart, TrendingUp, AlertTriangle, Landmark, Calendar, Users, ShoppingCart } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import FinancialReportPrintButton from './FinancialReportPrintButton';

export default function ReportsTab() {
    const [cheques, setCheques] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [businessStats, setBusinessStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        setLoading(true);
        const [chequesData, statsData, customersData, dashboardData, creditNotesData, inventoryData] = await Promise.all([
            getCheques(),
            getChequeStats(),
            getCustomers('', 1, 1000),
            getDashboardStats(),
            getCreditNotes(),
            getInventoryValuation()
        ]);
        setCheques(chequesData.data || []);
        setStats(statsData);
        setCustomers(customersData.data || []);

        setBusinessStats({
            ...dashboardData,
            returns: {
                sales: creditNotesData.summary?.salesValue || 0,
                purchase: creditNotesData.summary?.purchaseValue || 0
            },
            inventory: inventoryData
        });

        setLoading(false);
    }, []);

    useLoadEffect(() => loadData(), [loadData]);

    if (loading) return <div>Loading reports...</div>;

    // Aging Report Logic
    const today = new Date();
    const agingData = {
        upcoming: cheques.filter(c => new Date(c.due_date) > today && c.status === 'pending'),
        overdue: cheques.filter(c => new Date(c.due_date) <= today && c.status === 'pending'),
        cleared: cheques.filter(c => c.status === 'cleared'),
        bounced: cheques.filter(c => c.status === 'bounced'),
    };

    const agingAmounts = {
        upcoming: agingData.upcoming.reduce((sum, c) => sum + c.amount, 0),
        overdue: agingData.overdue.reduce((sum, c) => sum + c.amount, 0),
        cleared: agingData.cleared.reduce((sum, c) => sum + c.amount, 0),
        bounced: agingData.bounced.reduce((sum, c) => sum + c.amount, 0),
    };

    // Bank-wise Summary
    const bankSummary: Record<string, { count: number, amount: number }> = {};
    cheques.forEach(c => {
        if (!bankSummary[c.bank_name]) {
            bankSummary[c.bank_name] = { count: 0, amount: 0 };
        }
        bankSummary[c.bank_name].count++;
        bankSummary[c.bank_name].amount += c.amount;
    });

    // Receivables Logic
    const debtors = customers.filter(c => (c.balance || 0) > 0);
    const totalReceivables = debtors.reduce((sum, c) => sum + (c.balance || 0), 0);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <header>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Financial Reports</h2>
                    <p style={{ color: 'var(--muted)' }}>Detailed analysis of business performance and cash flow</p>
                </header>

                {businessStats && (
                    <FinancialReportPrintButton
                        stats={{
                            totalSales: businessStats.totalSales,
                            totalProfit: businessStats.totalProfit,
                            profitMargin: businessStats.profitMargin,
                            returns: businessStats.returns,
                            inventory: businessStats.inventory
                        }}
                        aging={agingData}
                        banks={bankSummary}
                        receivables={debtors}
                    />
                )}
            </div>

            {/* Business Performance Summary */}
            {businessStats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                    <StatCard
                        title="Balance (Returns Subtracted)"
                        value={formatCurrency(businessStats.totalSales)}
                        subtitle={`${businessStats.orderCount} total orders`}
                        icon={TrendingUp}
                        variant="blue"
                        footerIcon={ShoppingCart}
                    />

                    <StatCard
                        title="Total Net Profit"
                        value={formatCurrency(businessStats.totalProfit)}
                        subtitle={`${businessStats.profitMargin.toFixed(1)}% Profit Margin`}
                        icon={TrendingUp}
                        variant="green"
                        footerIcon={BarChart}
                    />

                    <StatCard
                        title="Sales Returns"
                        value={`-${formatCurrency(businessStats.returns.sales)}`}
                        subtitle="Total amount of credit notes issued"
                        icon={AlertTriangle}
                        variant="red"
                    />

                    <StatCard
                        title="Inventory Value (Cost)"
                        value={formatCurrency(businessStats.inventory.costValue)}
                        subtitle={`Valuation of ${businessStats.inventory.totalStock} items in stock`}
                        icon={Landmark}
                        variant="orange"
                    />
                </div>
            )}

            {/* Quick Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--warning)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div style={{ padding: '0.5rem', backgroundColor: '#fef3c7', borderRadius: '0.5rem', color: '#d97706' }}>
                            <Calendar size={20} />
                        </div>
                        <span style={{ fontWeight: '600', color: 'var(--muted)' }}>Pending Clearance</span>
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{formatCurrency(agingAmounts.upcoming + agingAmounts.overdue)}</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
                        {agingData.upcoming.length + agingData.overdue.length} cheques total
                    </div>
                </div>

                <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--destructive)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div style={{ padding: '0.5rem', backgroundColor: '#fee2e2', borderRadius: '0.5rem', color: '#dc2626' }}>
                            <AlertTriangle size={20} />
                        </div>
                        <span style={{ fontWeight: '600', color: 'var(--muted)' }}>Overdue Cheques</span>
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--destructive)' }}>{formatCurrency(agingAmounts.overdue)}</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
                        {agingData.overdue.length} cheques mission action
                    </div>
                </div>

                <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid #ef4444' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div style={{ padding: '0.5rem', backgroundColor: '#fef2f2', borderRadius: '0.5rem', color: '#ef4444' }}>
                            <TrendingUp size={20} />
                        </div>
                        <span style={{ fontWeight: '600', color: 'var(--muted)' }}>Bounced Rate</span>
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                        {stats.total_cheques > 0 ? ((stats.bounced / stats.total_cheques) * 100).toFixed(1) : 0}%
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
                        {stats.bounced} out of {stats.total_cheques} cheques
                    </div>
                </div>

                <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div style={{ padding: '0.5rem', backgroundColor: 'var(--secondary)', borderRadius: '0.5rem', color: 'var(--primary)' }}>
                            <Users size={20} />
                        </div>
                        <span style={{ fontWeight: '600', color: 'var(--muted)' }}>Total Receivables</span>
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>{formatCurrency(totalReceivables)}</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
                        Outstanding across {debtors.length} customers
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: '2rem' }}>
                {/* Aging Analysis Table */}
                <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.125rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <BarChart size={20} style={{ color: 'var(--primary)' }} />
                        Cheque Aging Analysis
                    </h3>
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Category</th>
                                    <th>Count</th>
                                    <th style={{ textAlign: 'right' }}>Total Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--warning)', marginRight: '0.5rem' }}></span> Upcoming</td>
                                    <td>{agingData.upcoming.length}</td>
                                    <td style={{ textAlign: 'right' }}>{formatCurrency(agingAmounts.upcoming)}</td>
                                </tr>
                                <tr>
                                    <td><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--destructive)', marginRight: '0.5rem' }}></span> Overdue</td>
                                    <td>{agingData.overdue.length}</td>
                                    <td style={{ textAlign: 'right', color: 'var(--destructive)' }}>{formatCurrency(agingAmounts.overdue)}</td>
                                </tr>
                                <tr>
                                    <td><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--success)', marginRight: '0.5rem' }}></span> Cleared</td>
                                    <td>{agingData.cleared.length}</td>
                                    <td style={{ textAlign: 'right' }}>{formatCurrency(agingAmounts.cleared)}</td>
                                </tr>
                                <tr>
                                    <td><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444', marginRight: '0.5rem' }}></span> Bounced</td>
                                    <td>{agingData.bounced.length}</td>
                                    <td style={{ textAlign: 'right' }}>{formatCurrency(agingAmounts.bounced)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Bank-wise Summary */}
                <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.125rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Landmark size={20} style={{ color: 'var(--primary)' }} />
                        Bank-wise Exposure
                    </h3>
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Bank Name</th>
                                    <th>Cheques</th>
                                    <th style={{ textAlign: 'right' }}>Exposure</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(bankSummary).map(([bank, data]) => (
                                    <tr key={bank}>
                                        <td style={{ fontWeight: '500' }}>{bank}</td>
                                        <td>{data.count}</td>
                                        <td style={{ textAlign: 'right', fontWeight: '600' }}>{formatCurrency(data.amount)}</td>
                                    </tr>
                                ))}
                                {Object.keys(bankSummary).length === 0 && (
                                    <tr>
                                        <td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>No data available</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Outstanding Receivables Section */}
            <div className="card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.125rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Users size={20} style={{ color: 'var(--primary)' }} />
                    Outstanding Receivables Breakdown
                </h3>
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Customer Name</th>
                                <th>Contact</th>
                                <th style={{ textAlign: 'right' }}>Outstanding Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {debtors.sort((a, b) => b.balance - a.balance).map(debtor => (
                                <tr key={debtor.id}>
                                    <td style={{ fontWeight: '500' }}>{debtor.name}</td>
                                    <td style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>{debtor.phone || debtor.email || 'N/A'}</td>
                                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--destructive)' }}>{formatCurrency(debtor.balance)}</td>
                                </tr>
                            ))}
                            {debtors.length === 0 && (
                                <tr>
                                    <td colSpan={3} style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
                                        No outstanding receivables. All customers are fully paid!
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {debtors.length > 0 && (
                            <tfoot>
                                <tr style={{ backgroundColor: 'var(--secondary)', fontWeight: 'bold' }}>
                                    <td colSpan={2}>TOTAL OUTSTANDING</td>
                                    <td style={{ textAlign: 'right', color: 'var(--destructive)' }}>{formatCurrency(totalReceivables)}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
}
