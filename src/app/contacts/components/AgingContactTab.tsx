'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Users, DollarSign, Clock, Mail, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { getCustomerAgingReport, sendDunningEmails } from '@/app/actions/customers';
import Link from 'next/link';
import { toast } from 'sonner';

const BUCKET_COLORS: Record<string, { bg: string; color: string; border: string; label: string }> = {
    'current': { bg: 'rgba(16,185,129,0.08)', color: 'var(--success)', border: 'rgba(16,185,129,0.2)', label: 'Current' },
    '1-30':    { bg: 'rgba(245,158,11,0.08)', color: 'var(--warning)', border: 'rgba(245,158,11,0.2)', label: '1–30 Days' },
    '31-60':   { bg: 'rgba(251,146,60,0.08)', color: '#fb923c', border: 'rgba(251,146,60,0.2)', label: '31–60 Days' },
    '61-90':   { bg: 'rgba(244,63,94,0.08)', color: 'var(--destructive)', border: 'rgba(244,63,94,0.2)', label: '61–90 Days' },
    '90+':     { bg: 'rgba(244,63,94,0.15)', color: 'var(--destructive)', border: 'rgba(244,63,94,0.35)', label: '90+ Days' },
};

export default function AgingContactTab() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [sendingDunning, setSendingDunning] = useState(false);

    useEffect(() => {
        getCustomerAgingReport().then(d => { setData(d); setLoading(false); });
    }, []);

    const totalOutstanding = data.reduce((s, c) => s + (c.balance || 0), 0);
    const overdue90 = data.filter(c => c.agingBucket === '90+').reduce((s, c) => s + c.balance, 0);
    const overdue30 = data.filter(c => ['31-60', '61-90', '90+'].includes(c.agingBucket)).reduce((s, c) => s + c.balance, 0);

    const bucketSummary = Object.entries(BUCKET_COLORS).map(([key, style]) => ({
        key, ...style,
        count: data.filter(c => c.agingBucket === key).length,
        amount: data.filter(c => c.agingBucket === key).reduce((s, c) => s + c.balance, 0),
    }));

    async function handleSendDunning() {
        setSendingDunning(true);
        try {
            const res = await sendDunningEmails();
            if (res.success) toast.success(`Dunning emails sent: ${res.sent} sent, ${res.failed} failed`);
            else toast.error('Failed to send dunning emails');
        } catch (e: any) {
            toast.error('Error: ' + e.message);
        } finally {
            setSendingDunning(false);
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary btn-sm" disabled={sendingDunning || data.length === 0} onClick={handleSendDunning}>
                    {sendingDunning ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                    {sendingDunning ? 'Sending...' : 'Send Dunning Emails'}
                </button>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                {[
                    { label: 'Total Outstanding', value: formatCurrency(totalOutstanding), icon: DollarSign, color: 'var(--primary)', bg: 'var(--primary-subtle)', border: 'rgba(212,175,55,0.15)' },
                    { label: 'Customers with Dues', value: data.length.toString(), icon: Users, color: 'var(--info)', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.15)' },
                    { label: 'Overdue 30+ Days', value: formatCurrency(overdue30), icon: Clock, color: 'var(--warning)', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.15)' },
                    { label: 'Critical (90+ Days)', value: formatCurrency(overdue90), icon: AlertTriangle, color: 'var(--destructive)', bg: 'rgba(244,63,94,0.08)', border: 'rgba(244,63,94,0.15)' },
                ].map((s, i) => (
                    <div key={i} className="card" style={{ padding: '1.125rem', border: `1px solid ${s.border}`, background: s.bg }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.375rem' }}>{s.label}</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>{s.value}</div>
                            </div>
                            <div style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.06)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <s.icon size={16} color={s.color} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Bucket summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
                {bucketSummary.map(b => (
                    <div key={b.key} style={{ padding: '1rem', background: b.bg, border: `1px solid ${b.border}`, borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: b.color, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.375rem' }}>{b.label}</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--foreground)' }}>{b.count}</div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: b.color, marginTop: '0.25rem' }}>{formatCurrency(b.amount)}</div>
                    </div>
                ))}
            </div>

            {/* Table */}
            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 'var(--radius)' }} />)}
                </div>
            ) : data.length === 0 ? (
                <EmptyState icon={Users} title="No Outstanding Balances" description="All customers are up to date with their payments." />
            ) : (
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Customer</th>
                                <th>Contact</th>
                                <th style={{ textAlign: 'center' }}>Aging</th>
                                <th style={{ textAlign: 'right' }}>Days Overdue</th>
                                <th style={{ textAlign: 'right' }}>Outstanding</th>
                                <th style={{ textAlign: 'center' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map(c => {
                                const bucket = BUCKET_COLORS[c.agingBucket] || BUCKET_COLORS['current'];
                                return (
                                    <tr key={c.id}>
                                        <td><div style={{ fontWeight: 600 }}>{c.name}</div></td>
                                        <td style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>{c.phone || c.email || '—'}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.625rem', background: bucket.bg, color: bucket.color, border: `1px solid ${bucket.border}`, borderRadius: 99, fontSize: '0.6875rem', fontWeight: 700 }}>
                                                {bucket.label}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 600, color: c.daysPast > 30 ? 'var(--destructive)' : 'var(--muted-foreground)' }}>
                                            {c.daysPast > 0 ? `${c.daysPast}d` : '—'}
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--destructive)', fontSize: '0.9375rem' }}>
                                            {formatCurrency(c.balance)}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <Link href={`/customers/${c.id}`} className="btn btn-secondary btn-sm" style={{ fontSize: '0.75rem' }}>View</Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
