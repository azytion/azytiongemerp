'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDaybookEntries, getDailySummary } from '@/app/actions/daybook';
import { formatCurrency } from '@/lib/utils';
import { StatCard } from '@/components/ui/StatCard';
import { Calendar, TrendingUp, TrendingDown, Activity, CheckCircle, Landmark } from 'lucide-react';
import DaybookPrintButton from './DaybookPrintButton';

import { Pagination } from '@/components/ui/Pagination';

export default function DaybookTab() {
    const [selectedDate, setSelectedDate] = useState(() => {
        // Use local date, not UTC
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    });
    const [page, setPage] = useState(1);
    const pageSize = 15;

    const { data: result, isLoading: entriesLoading } = useQuery({
        queryKey: ['daybook-entries', selectedDate, page],
        queryFn: () => getDaybookEntries(selectedDate, page, pageSize),
        staleTime: 1000 * 15,
        refetchInterval: 1000 * 30,
        refetchOnWindowFocus: true,
    });

    const entries = result?.data || [];

    const { data: summary, isLoading: summaryLoading } = useQuery({
        queryKey: ['daybook-summary', selectedDate],
        queryFn: () => getDailySummary(selectedDate),
        staleTime: 1000 * 15,
        refetchInterval: 1000 * 30,
        refetchOnWindowFocus: true,
    });

    const loading = entriesLoading || summaryLoading;

    if (loading && !result) {
        return <div style={{ padding: '2rem' }}>Loading...</div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <header>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                    Daybook
                </h2>
                <p style={{ color: 'var(--muted)' }}>Daily cash book with real-time transaction tracking</p>
            </header>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                {/* Date Selector */}
                <div className="card" style={{ padding: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Calendar size={20} />
                    <label className="label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Select Date:</label>
                    <input
                        type="date"
                        className="input"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        style={{ maxWidth: '400px' }}
                    />
                </div>

                {/* Print/Export Actions */}
                {entries.length > 0 && summary && (
                    <DaybookPrintButton
                        entries={entries}
                        date={selectedDate}
                        stats={summary}
                    />
                )}
            </div>

            {/* Daily Summary */}
            {summary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                    <StatCard
                        title="Opening Balance"
                        value={formatCurrency(summary.opening_balance)}
                        icon={Landmark}
                        variant="indigo"
                    />
                    <StatCard
                        title="Total Credit"
                        value={formatCurrency(summary.total_credit)}
                        icon={TrendingUp}
                        variant="green"
                        trend="Daily Income"
                    />
                    <StatCard
                        title="Total Debit"
                        value={formatCurrency(summary.total_debit)}
                        icon={TrendingDown}
                        variant="red"
                        trend="Daily Expense"
                    />
                    <StatCard
                        title="Closing Balance"
                        value={formatCurrency(summary.closing_balance)}
                        icon={CheckCircle}
                        variant="purple"
                        subtitle={summary.closing_balance >= 0 ? 'Positive' : 'Deficit'}
                    />
                    <StatCard
                        title="Net Change"
                        value={(summary.net_change >= 0 ? '+' : '') + formatCurrency(summary.net_change)}
                        icon={summary.net_change >= 0 ? TrendingUp : TrendingDown}
                        variant="blue"
                    />
                    <StatCard
                        title="Transactions"
                        value={summary.total_transactions}
                        icon={Activity}
                        variant="orange"
                        subtitle="Items Processed"
                    />
                </div>
            )}

            {/* Entries Table */}
            <div className="card table-wrapper" style={{ overflowX: 'auto' }}>
                <style>{`
                    @media (max-width: 640px) {
                        .daybook-col-ref { display: none; }
                    }
                `}</style>
                <table style={{ minWidth: '480px' }}>
                    <thead>
                        <tr>
                            <th style={{ whiteSpace: 'nowrap' }}>Time</th>
                            <th>Type</th>
                            <th>Description</th>
                            <th className="daybook-col-ref" style={{ textAlign: 'right' }}>Debit</th>
                            <th style={{ textAlign: 'right' }}>Credit</th>
                            <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
                                    No entries for this date
                                </td>
                            </tr>
                        ) : (
                            entries.map((entry) => (
                                <tr key={entry.id}>
                                    <td style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}>{entry.time}</td>
                                    <td>
                                        <span style={{
                                            padding: '0.2rem 0.5rem',
                                            borderRadius: '12px',
                                            fontSize: '0.7rem',
                                            fontWeight: '600',
                                            textTransform: 'uppercase',
                                            whiteSpace: 'nowrap',
                                            color: entry.credit > 0 ? 'var(--success)' : 'var(--destructive)',
                                            border: `1px solid ${entry.credit > 0 ? 'var(--success)' : 'var(--destructive)'}`
                                        }}>
                                            {entry.transaction_type}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: '0.875rem' }}>
                                        <div style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {entry.description || 'N/A'}
                                        </div>
                                        {entry.reference_type && (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                                                {entry.reference_type} #{entry.reference_id}
                                            </div>
                                        )}
                                    </td>
                                    <td className="daybook-col-ref" style={{ textAlign: 'right', color: entry.debit > 0 ? 'var(--destructive)' : 'var(--muted)', whiteSpace: 'nowrap' }}>
                                        {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                                    </td>
                                    <td style={{ textAlign: 'right', color: entry.credit > 0 ? 'var(--success)' : 'var(--muted)', whiteSpace: 'nowrap' }}>
                                        {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: '500', whiteSpace: 'nowrap' }}>
                                        {formatCurrency(entry.balance)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {result && (
                    <Pagination
                        currentPage={page}
                        totalPages={result.totalPages}
                        onPageChange={setPage}
                        totalItems={result.total}
                        pageSize={result.pageSize}
                    />
                )}
            </div>
        </div>
    );
}
