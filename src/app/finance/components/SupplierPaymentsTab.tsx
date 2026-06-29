'use client';

import { useCallback, useState } from 'react';
import { useLoadEffect } from '@/hooks/useLoadEffect';
import { getSuppliers, settleSupplierBalance, Supplier } from '@/app/actions/suppliers';
import { postSupplierSettlement } from '@/app/actions/ledger';
import { formatCurrency } from '@/lib/utils';
import { Search, Banknote, CreditCard, FileText, CheckCircle, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';

const PAYMENT_METHODS = [
    { id: 'Cash',   label: 'Cash',         icon: Banknote },
    { id: 'Bank',   label: 'Bank Transfer', icon: CreditCard },
    { id: 'Cheque', label: 'Cheque',        icon: FileText },
];

export default function SupplierPaymentsTab() {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<Supplier | null>(null);
    const [amount, setAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [processing, setProcessing] = useState(false);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;
    const { confirm } = useConfirm();

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getSuppliers('', 1, 500);
            setSuppliers(res.data.filter(s => (s.balance || 0) > 0));
        } catch { toast.error('Failed to load suppliers'); }
        setLoading(false);
    }, []);

    useLoadEffect(() => load(), [load]);

    const filtered = suppliers.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.phone && s.phone.includes(search))
    );
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    async function handleSettle() {
        if (!selected) return;
        const val = parseFloat(amount);
        if (isNaN(val) || val <= 0) { toast.error('Enter a valid amount'); return; }
        if (val > selected.balance && !await confirm({ title: 'Excess Amount', message: `Amount exceeds balance of ${formatCurrency(selected.balance)}. Continue?`, type: 'warning' })) return;

        setProcessing(true);
        const res = await settleSupplierBalance(selected.id, val, paymentMethod);
        if (res.success) {
            try { await postSupplierSettlement(selected.id, val, paymentMethod, selected.name); } catch { /* silent */ }
            toast.success(`Payment of ${formatCurrency(val)} to ${selected.name} recorded`);
            setSelected(null);
            setAmount('');
            load();
        } else {
            toast.error(res.error || 'Failed');
        }
        setProcessing(false);
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>Supplier Payments</h2>
                    <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
                        Record payments to suppliers for outstanding purchase orders
                    </p>
                </div>
                <div style={{ padding: '0.5rem 1rem', background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 'var(--radius-lg)', textAlign: 'right' }}>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', fontWeight: 600, textTransform: 'uppercase' }}>Total Payable</div>
                    <div style={{ fontWeight: 900, fontSize: '1.25rem', color: 'var(--destructive)', letterSpacing: '-0.02em' }}>
                        {formatCurrency(suppliers.reduce((s, sup) => s + (sup.balance || 0), 0))}
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '1.5rem', alignItems: 'start' }}>
                {/* Left: Supplier list */}
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
                            <input type="text" placeholder="Search supplier..." value={search}
                                onChange={e => { setSearch(e.target.value); setPage(1); }}
                                className="input" style={{ paddingLeft: '2.25rem', height: '2.25rem', fontSize: '0.8125rem' }} />
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>Loading...</div>
                    ) : paginated.length === 0 ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
                            <CheckCircle size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
                            <p style={{ fontWeight: 600 }}>No outstanding supplier balances</p>
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                                    <th style={{ padding: '0.625rem 1rem', textAlign: 'left', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Supplier</th>
                                    <th style={{ padding: '0.625rem 1rem', textAlign: 'right', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Balance Due</th>
                                    <th style={{ padding: '0.625rem 1rem', textAlign: 'center', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginated.map(s => (
                                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border)', background: selected?.id === s.id ? 'var(--primary-subtle)' : 'transparent' }}>
                                        <td style={{ padding: '0.875rem 1rem' }}>
                                            <div style={{ fontWeight: 600 }}>{s.name}</div>
                                            {s.phone && <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{s.phone}</div>}
                                        </td>
                                        <td style={{ padding: '0.875rem 1rem', textAlign: 'right', fontWeight: 700, color: 'var(--destructive)' }}>
                                            {formatCurrency(s.balance || 0)}
                                        </td>
                                        <td style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>
                                            <button className="btn btn-primary btn-sm"
                                                onClick={() => { setSelected(s); setAmount((s.balance || 0).toFixed(2)); }}>
                                                Pay Now
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {totalPages > 1 && (
                        <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border)' }}>
                            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={filtered.length} pageSize={PAGE_SIZE} />
                        </div>
                    )}
                </div>

                {/* Right: Payment form */}
                <div className="card" style={{ padding: '1.5rem', position: 'sticky', top: '1rem', minWidth: 0 }}>
                    {selected ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div>
                                <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>Paying To</div>
                                <div style={{ fontWeight: 800, fontSize: '1.0625rem' }}>{selected.name}</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', padding: '0.625rem 0.875rem', background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.15)', borderRadius: 'var(--radius)' }}>
                                    <span style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>Outstanding</span>
                                    <span style={{ fontWeight: 900, fontSize: '1.25rem', color: 'var(--destructive)' }}>{formatCurrency(selected.balance || 0)}</span>
                                </div>
                            </div>

                            <div>
                                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Payment Method</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
                                    {PAYMENT_METHODS.map(m => {
                                        const Icon = m.icon;
                                        const active = paymentMethod === m.id;
                                        return (
                                            <button key={m.id} onClick={() => setPaymentMethod(m.id)}
                                                style={{
                                                    padding: '0.625rem', borderRadius: 'var(--radius)',
                                                    border: `1px solid ${active ? 'var(--primary)' : 'var(--border-strong)'}`,
                                                    background: active ? 'var(--primary-subtle)' : 'transparent',
                                                    color: active ? 'var(--primary)' : 'var(--muted-foreground)',
                                                    cursor: 'pointer', fontFamily: 'var(--font-sans)',
                                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                                    fontSize: '0.8125rem', fontWeight: 600, transition: 'all 0.15s',
                                                }}>
                                                <Icon size={15} /> {m.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Amount Paying</div>
                                <input type="number" step="0.01" className="input"
                                    style={{ fontSize: '1.5rem', height: '3.5rem', textAlign: 'center', fontWeight: 800 }}
                                    value={amount} onChange={e => setAmount(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSettle()}
                                    placeholder="0.00" autoFocus />
                                <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                                    {[25, 50, 75, 100].map(pct => (
                                        <button key={pct} onClick={() => setAmount(((selected.balance || 0) * pct / 100).toFixed(2))}
                                            className="btn btn-secondary btn-sm" style={{ flex: '1 1 3.5rem', fontSize: '0.75rem' }}>
                                            {pct}%
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setSelected(null); setAmount(''); }}>
                                    Cancel
                                </button>
                                <button className="btn btn-primary" style={{ flex: 2 }} disabled={processing || !amount} onClick={handleSettle}>
                                    {processing ? 'Processing...' : `Pay ${amount ? formatCurrency(parseFloat(amount) || 0) : ''}`}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted-foreground)' }}>
                            <Users size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
                            <p style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Select a supplier</p>
                            <p style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>Click &quot;Pay Now&quot; on a supplier to record a payment</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
