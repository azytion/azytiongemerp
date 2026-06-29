'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getCustomersWithBalance, settleCustomerBalance, CustomerBalance } from '@/app/actions/customers';
import { toast } from 'sonner';
import { X, Search, CheckCircle, Banknote, CreditCard, FileText } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

import { useSidebar } from '@/components/SidebarProvider';

const PAYMENT_METHODS = [
    { id: 'Cash',   label: 'Cash',          icon: Banknote },
    { id: 'Bank',   label: 'Bank Transfer',  icon: CreditCard },
    { id: 'Cheque', label: 'Cheque',         icon: FileText },
];

export function DueCollectionModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { isMobile } = useSidebar();
    const [customers, setCustomers] = useState<CustomerBalance[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerBalance | null>(null);
    const [amountToPay, setAmountToPay] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (isOpen) { loadCustomers(); }
    }, [isOpen]);

    async function loadCustomers() {
        setLoading(true);
        try {
            const data = await getCustomersWithBalance();
            setCustomers(data);
        } catch {
            toast.error('Failed to load customers');
        } finally {
            setLoading(false);
        }
    }

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.phone && c.phone.includes(searchTerm))
    );

    async function handleSettle() {
        if (!selectedCustomer) return;
        const amount = parseFloat(amountToPay);
        if (isNaN(amount) || amount <= 0) {
            toast.error('Enter a valid amount');
            return;
        }
        setProcessing(true);
        const res = await settleCustomerBalance(selectedCustomer.id, amount, paymentMethod);
        setProcessing(false);
        if (res.success) {
            toast.success(`Payment of ${formatCurrency(amount)} received via ${paymentMethod}`);
            setAmountToPay('');
            setSelectedCustomer(null);
            loadCustomers();
        } else {
            toast.error(res.error || 'Failed to process payment');
        }
    }

    if (!isOpen) return null;

    return createPortal(
        <div className="modal-blur-overlay" style={{ zIndex: 999999 }}>
            <div className="modal-portal-content due-collection-modal" style={{ maxWidth: '860px' }}>
                <div className="card modal-card" style={{ width: '100%', display: 'flex', flexDirection: 'column', padding: 0 }}>
                    {/* Header */}
                    <div className="due-collection-modal__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', margin: 0, fontSize: '1.0625rem', fontWeight: 700 }}>
                            <Banknote size={18} color="var(--success)" /> Customer Due Collection
                        </h2>
                        <button type="button" className="btn-close" onClick={onClose}><X size={16} /></button>
                    </div>

                    <div className="due-collection-modal__layout" style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                        {/* Left: Customer list */}
                        <div style={{ 
                            width: isMobile ? '100%' : 320, 
                            maxHeight: isMobile ? '38dvh' : 'none',
                            minHeight: 0,
                            borderRight: isMobile ? 'none' : '1px solid var(--border)', 
                            borderBottom: isMobile ? '1px solid var(--border)' : 'none',
                            display: 'flex', 
                            flexDirection: 'column', 
                            flexShrink: 0 
                        }}>
                            <div style={{ padding: '0.875rem', borderBottom: '1px solid var(--border)' }}>
                                <div style={{ position: 'relative' }}>
                                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
                                    <input type="text" placeholder="Search customer..." value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="input" style={{ paddingLeft: '2.25rem', height: '2.25rem', fontSize: '0.8125rem' }} autoFocus />
                                </div>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto' }}>
                                {loading ? (
                                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>Loading...</div>
                                ) : filteredCustomers.length === 0 ? (
                                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
                                        No customers with outstanding balance
                                    </div>
                                ) : filteredCustomers.map(c => (
                                    <div key={c.id} onClick={() => { setSelectedCustomer(c); setAmountToPay(c.balance.toFixed(2)); }}
                                        style={{
                                            padding: '0.875rem 1rem', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                                            background: selectedCustomer?.id === c.id ? 'var(--primary-subtle)' : 'transparent',
                                            borderLeft: selectedCustomer?.id === c.id ? '3px solid var(--primary)' : '3px solid transparent',
                                            transition: 'all 0.15s',
                                        }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{c.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.125rem' }}>{c.phone || '—'}</div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--destructive)' }}>{formatCurrency(c.balance)}</div>
                                                <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>outstanding</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--muted-foreground)', textAlign: 'center' }}>
                                {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''} with balance
                            </div>
                        </div>

                        {/* Right: Payment panel */}
                        <div style={{ flex: 1, minHeight: 0, padding: isMobile ? '1rem' : '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', overflowY: 'auto' }}>
                        {selectedCustomer ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                {/* Customer info */}
                                <div style={{ padding: '1rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                                    <div style={{ fontWeight: 800, fontSize: '1.125rem', marginBottom: '0.25rem' }}>{selectedCustomer.name}</div>
                                    {selectedCustomer.phone && <div style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>{selectedCustomer.phone}</div>}
                                    <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>Outstanding Balance</span>
                                        <span style={{ fontWeight: 900, fontSize: '1.5rem', color: 'var(--destructive)', letterSpacing: '-0.02em' }}>
                                            {formatCurrency(selectedCustomer.balance)}
                                        </span>
                                    </div>
                                </div>

                                {/* Payment method */}
                                <div>
                                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.5rem' }}>
                                        Payment Method
                                    </label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem' }}>
                                        {PAYMENT_METHODS.map(m => {
                                            const Icon = m.icon;
                                            const active = paymentMethod === m.id;
                                            return (
                                                <button key={m.id} onClick={() => setPaymentMethod(m.id)}
                                                    style={{
                                                        padding: '0.625rem 0.5rem', borderRadius: 'var(--radius)',
                                                        border: `1px solid ${active ? 'var(--primary)' : 'var(--border-strong)'}`,
                                                        background: active ? 'var(--primary-subtle)' : 'transparent',
                                                        color: active ? 'var(--primary)' : 'var(--muted-foreground)',
                                                        cursor: 'pointer', fontFamily: 'var(--font-sans)',
                                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
                                                        fontSize: '0.6875rem', fontWeight: 600, transition: 'all 0.15s',
                                                    }}>
                                                    <Icon size={16} />
                                                    {m.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Amount */}
                                <div>
                                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.5rem' }}>
                                        Amount Receiving
                                    </label>
                                    <input type="number" className="input"
                                        style={{ fontSize: '1.75rem', height: '4rem', textAlign: 'center', fontWeight: 800, letterSpacing: '-0.02em' }}
                                        value={amountToPay}
                                        onChange={e => setAmountToPay(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSettle()}
                                        placeholder="0.00" />
                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                                        {[25, 50, 75, 100].map(pct => (
                                            <button key={pct} onClick={() => setAmountToPay((selectedCustomer.balance * pct / 100).toFixed(2))}
                                                className="btn btn-secondary btn-sm" style={{ flex: '1 1 3.5rem', fontSize: '0.75rem' }}>
                                                {pct}%
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="modal-action-row" style={{ display: 'flex', gap: '0.75rem' }}>
                                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setSelectedCustomer(null); setAmountToPay(''); }}>
                                        Cancel
                                    </button>
                                    <button className="btn btn-primary" style={{ flex: 2 }} disabled={processing || !amountToPay} onClick={handleSettle}>
                                        {processing ? 'Processing...' : `Receive ${amountToPay ? formatCurrency(parseFloat(amountToPay) || 0) : 'Payment'}`}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', color: 'var(--muted-foreground)' }}>
                                <CheckCircle size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                                <p style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Select a customer</p>
                                <p style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>Choose a customer from the list to record their payment</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    </div>,
        document.body
    );
}

export default DueCollectionModal;
