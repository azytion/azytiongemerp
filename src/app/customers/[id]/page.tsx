'use client';

import { useCallback, useState } from 'react';
import { useLoadEffect } from '@/hooks/useLoadEffect';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Edit, Phone, Mail, MapPin, DollarSign, ShoppingCart, FileText, Send } from 'lucide-react';
import Link from 'next/link';
import { getCustomer, getCustomerPurchaseHistory } from '@/app/actions/customers';
import { formatCurrency, formatDate } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from 'sonner';

export default function CustomerDetailPage() {
    const params = useParams();
    const _router = useRouter();
    const customerId = Number(params.id);

    const [customer, setCustomer] = useState<any>(null);
    const [sales, setSales] = useState<any[]>([]);
    const [totalSales, setTotalSales] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [sendingStatement, setSendingStatement] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [cust, hist] = await Promise.all([
                getCustomer(customerId),
                getCustomerPurchaseHistory(customerId, page, 10),
            ]);
            setCustomer(cust);
            setSales(hist.data);
            setTotalSales(hist.total);
            setTotalPages(hist.totalPages);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [customerId, page]);

    useLoadEffect(() => load(), [load]);

    async function handleSendStatement() {
        if (!customer?.email) { toast.error('No email address on file.'); return; }
        setSendingStatement(true);
        try {
            const { sendEmail } = await import('@/app/actions/email');
            const html = `
                <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
                    <h2>Account Statement</h2>
                    <p>Dear ${customer.name},</p>
                    <p>Your current account balance is: <strong>${formatCurrency(customer.balance || 0)}</strong></p>
                    <p>Thank you for your business.</p>
                </div>
            `;
            const res = await sendEmail(customer.email, `Account Statement — ${customer.name}`, html);
            if (res.success) toast.success(`Statement sent to ${customer.email}`);
            else toast.error('Failed: ' + res.error);
        } catch (e: any) { toast.error(e.message); }
        finally { setSendingStatement(false); }
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="skeleton" style={{ height: 36, width: 200, borderRadius: 'var(--radius)' }} />
                <div className="skeleton" style={{ height: 160, borderRadius: 'var(--radius-lg)' }} />
                <div className="skeleton" style={{ height: 300, borderRadius: 'var(--radius-lg)' }} />
            </div>
        );
    }

    if (!customer) {
        return <EmptyState icon={ShoppingCart} title="Customer Not Found" description="This customer does not exist." action={<Link href="/customers" className="btn btn-primary btn-sm">Back to Customers</Link>} />;
    }

    const totalSpent = sales.reduce((s, sale) => s + (sale.total_amount || 0), 0);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fade-in">
            {/* Header */}
            <header className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                    <Link href="/customers" className="btn btn-secondary btn-sm" style={{ padding: '0.5rem' }}>
                        <ArrowLeft size={16} />
                    </Link>
                    <div>
                        <h1 className="page-title">{customer.name}</h1>
                        <p className="page-subtitle">Customer profile & purchase history</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {customer.email && (
                        <button onClick={handleSendStatement} disabled={sendingStatement} className="btn btn-secondary btn-sm">
                            <Send size={14} /> {sendingStatement ? 'Sending...' : 'Send Statement'}
                        </button>
                    )}
                    <Link href={`/customers/${customerId}/edit`} className="btn btn-primary btn-sm">
                        <Edit size={14} /> Edit
                    </Link>
                </div>
            </header>

            {/* Profile + Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr)', gap: '1.25rem', alignItems: 'start' }}>
                {/* Profile Card */}
                <div className="card" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
                        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--primary-subtle)', border: '2px solid rgba(212,175,55,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.5rem', color: 'var(--primary)', flexShrink: 0 }}>
                            {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: '1.0625rem' }}>{customer.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.125rem' }}>
                                Customer since {formatDate(customer.created_at || '', { showTime: false })}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                        {customer.phone && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--foreground-2)' }}>
                                <Phone size={14} color="var(--muted-foreground)" /> {customer.phone}
                            </div>
                        )}
                        {customer.email && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--foreground-2)' }}>
                                <Mail size={14} color="var(--muted-foreground)" /> {customer.email}
                            </div>
                        )}
                        {customer.address && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--foreground-2)' }}>
                                <MapPin size={14} color="var(--muted-foreground)" /> {customer.address}
                            </div>
                        )}
                    </div>

                    {/* Balance */}
                    <div style={{ marginTop: '1.25rem', padding: '1rem', background: (customer.balance || 0) > 0 ? 'rgba(244,63,94,0.06)' : 'rgba(16,185,129,0.06)', border: `1px solid ${(customer.balance || 0) > 0 ? 'rgba(244,63,94,0.2)' : 'rgba(16,185,129,0.2)'}`, borderRadius: 'var(--radius-md)' }}>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.375rem' }}>
                            {(customer.balance || 0) > 0 ? 'Outstanding Balance' : 'Account Status'}
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 900, color: (customer.balance || 0) > 0 ? 'var(--destructive)' : 'var(--success)', letterSpacing: '-0.02em' }}>
                            {(customer.balance || 0) > 0 ? formatCurrency(customer.balance) : 'Clear'}
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                        {[
                            { label: 'Total Orders', value: totalSales.toString(), icon: ShoppingCart, color: 'var(--info)', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.15)' },
                            { label: 'Total Spent', value: formatCurrency(totalSpent), icon: DollarSign, color: 'var(--success)', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.15)' },
                        ].map((s, i) => (
                            <div key={i} className="card" style={{ padding: '1rem', border: `1px solid ${s.border}`, background: s.bg }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.375rem' }}>{s.label}</div>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>{s.value}</div>
                                    </div>
                                    <div style={{ width: 30, height: 30, background: 'rgba(255,255,255,0.06)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <s.icon size={15} color={s.color} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Purchase History */}
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                            <div style={{ width: 28, height: 28, background: 'rgba(59,130,246,0.1)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <FileText size={14} color="var(--info)" />
                            </div>
                            <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700 }}>Purchase History</h3>
                        </div>
                        {sales.length === 0 ? (
                            <div style={{ padding: '2.5rem' }}>
                                <EmptyState icon={ShoppingCart} title="No Purchases Yet" description="This customer hasn't made any purchases." />
                            </div>
                        ) : (
                            <>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                                            <th style={{ padding: '0.625rem 1rem', textAlign: 'left', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Invoice</th>
                                            <th style={{ padding: '0.625rem 1rem', textAlign: 'left', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Date</th>
                                            <th style={{ padding: '0.625rem 1rem', textAlign: 'center', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Method</th>
                                            <th style={{ padding: '0.625rem 1rem', textAlign: 'right', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Amount</th>
                                            <th style={{ padding: '0.625rem 1rem', textAlign: 'center', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sales.map((sale: any) => (
                                            <tr key={sale.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>{sale.invoice_number}</td>
                                                <td style={{ padding: '0.75rem 1rem', color: 'var(--muted-foreground)' }}>{formatDate(sale.date, { showTime: true })}</td>
                                                <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                                    <span className="badge badge-info" style={{ fontSize: '0.6875rem' }}>{sale.payment_method}</span>
                                                </td>
                                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(sale.total_amount)}</td>
                                                <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                                    <span className={`badge badge-${sale.payment_status === 'paid' || sale.payment_status === 'completed' ? 'success' : sale.payment_status === 'partial' ? 'warning' : 'error'}`} style={{ fontSize: '0.6875rem' }}>
                                                        {sale.payment_status || 'paid'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {totalPages > 1 && (
                                    <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border)' }}>
                                        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={totalSales} pageSize={10} />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
