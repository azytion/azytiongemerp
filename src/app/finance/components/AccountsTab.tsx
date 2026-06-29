'use client';

import { useCallback, useState } from 'react';
import { useLoadEffect } from '@/hooks/useLoadEffect';
import { formatCurrency, formatDate } from '@/lib/utils';
import { DollarSign, CreditCard, FileText, TrendingUp, Banknote, CheckSquare } from 'lucide-react';
import { getSettings } from '@/app/actions/settings';

interface AccountSummary {
    method: string;
    label: string;
    icon: React.ElementType;
    color: string;
    bg: string;
    total: number;
    count: number;
    transactions: any[];
}

const METHOD_META: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
    Cash:    { label: 'Cash',         icon: Banknote,     color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
    Bank:    { label: 'Bank Transfer',icon: CreditCard,   color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
    Cheque:  { label: 'Cheque',       icon: CheckSquare,  color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
    Split:   { label: 'Split',        icon: TrendingUp,   color: '#D4AF37', bg: 'rgba(212,175,55,0.1)' },
    Due:     { label: 'Due / Credit', icon: FileText,     color: '#F43F5E', bg: 'rgba(244,63,94,0.1)' },
};

async function getAccountsData(dateRange?: { start: string; end: string }) {
    const { getAccountsReport } = await import('@/app/actions/reports_comprehensive');
    return getAccountsReport(dateRange);
}

export default function AccountsTab() {
    const [accounts, setAccounts] = useState<AccountSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [_sym, setSym] = useState('Rs');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [data, settings] = await Promise.all([
                getAccountsData(dateRange.start && dateRange.end ? dateRange : undefined),
                getSettings(),
            ]);
            setSym(settings.currency_symbol || 'Rs');
            setAccounts(data as AccountSummary[]);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [dateRange]);

    useLoadEffect(() => load(), [load]);

    const totalRevenue = accounts.reduce((s, a) => s + a.total, 0);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Filter */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ flex: '1 1 160px' }}>
                    <label>From</label>
                    <input type="date" className="input" value={dateRange.start}
                        onChange={e => setDateRange(d => ({ ...d, start: e.target.value }))} />
                </div>
                <div className="form-group" style={{ flex: '1 1 160px' }}>
                    <label>To</label>
                    <input type="date" className="input" value={dateRange.end}
                        onChange={e => setDateRange(d => ({ ...d, end: e.target.value }))} />
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => setDateRange({ start: '', end: '' })}>
                    Clear
                </button>
            </div>

            {/* Total summary */}
            <div style={{ padding: '1rem 1.25rem', background: 'var(--primary-subtle)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 'var(--radius-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <DollarSign size={20} color="var(--primary)" />
                    <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Total Revenue (All Methods)</span>
                </div>
                <span style={{ fontWeight: 900, fontSize: '1.375rem', color: 'var(--primary)', letterSpacing: '-0.02em' }}>
                    {formatCurrency(totalRevenue)}
                </span>
            </div>

            {loading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>Loading...</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {accounts.map(acc => {
                        const meta = METHOD_META[acc.method] || { label: acc.method, icon: DollarSign, color: 'var(--primary)', bg: 'var(--primary-subtle)' };
                        const Icon = meta.icon;
                        const isOpen = expanded === acc.method;
                        const pct = totalRevenue > 0 ? (acc.total / totalRevenue) * 100 : 0;

                        return (
                            <div key={acc.method} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--surface)' }}>
                                {/* Header row */}
                                <div
                                    style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', cursor: 'pointer' }}
                                    onClick={() => setExpanded(isOpen ? null : acc.method)}
                                >
                                    <div style={{ width: 38, height: 38, borderRadius: 10, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Icon size={18} color={meta.color} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{meta.label}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.125rem' }}>
                                            {acc.count} transaction{acc.count !== 1 ? 's' : ''}
                                        </div>
                                    </div>
                                    {/* Progress bar */}
                                    <div style={{ flex: 2, maxWidth: 160 }}>
                                        <div style={{ height: 6, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${pct}%`, background: meta.color, borderRadius: 99, transition: 'width 0.4s' }} />
                                        </div>
                                        <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', marginTop: '0.25rem', textAlign: 'right' }}>{pct.toFixed(1)}%</div>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <div style={{ fontWeight: 900, fontSize: '1.125rem', color: meta.color, letterSpacing: '-0.02em' }}>
                                            {formatCurrency(acc.total)}
                                        </div>
                                    </div>
                                    <div style={{ color: 'var(--muted-foreground)', fontSize: '0.75rem' }}>{isOpen ? '▲' : '▼'}</div>
                                </div>

                                {/* Expanded transactions */}
                                {isOpen && (
                                    <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                                        {acc.transactions.length === 0 ? (
                                            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
                                                No transactions found.
                                            </div>
                                        ) : (
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                                <thead>
                                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                                        {['Invoice', 'Date', 'Customer', 'Amount', 'Status'].map(h => (
                                                            <th key={h} style={{ padding: '0.625rem 1rem', textAlign: h === 'Amount' ? 'right' : 'left', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {acc.transactions.slice(0, 50).map((tx: any, i: number) => (
                                                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                                            <td style={{ padding: '0.625rem 1rem', fontWeight: 600, color: 'var(--primary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{tx.invoice_number}</td>
                                                            <td style={{ padding: '0.625rem 1rem', color: 'var(--muted-foreground)' }}>{formatDate(tx.date, { showTime: true })}</td>
                                                            <td style={{ padding: '0.625rem 1rem' }}>{tx.customer_name || 'Walk-in'}</td>
                                                            <td style={{ padding: '0.625rem 1rem', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(tx.total_amount)}</td>
                                                            <td style={{ padding: '0.625rem 1rem' }}>
                                                                <span className={`badge badge-${tx.payment_status === 'paid' || tx.payment_status === 'completed' ? 'success' : tx.payment_status === 'partial' ? 'warning' : 'error'}`} style={{ fontSize: '0.6875rem' }}>
                                                                    {tx.payment_status || 'paid'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
