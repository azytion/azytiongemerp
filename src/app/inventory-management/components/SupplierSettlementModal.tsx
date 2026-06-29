'use client';

import { useState } from 'react';
import { settleSupplierBalance, Supplier } from '@/app/actions/suppliers';
import { postSupplierSettlement } from '@/app/actions/ledger';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { Loader2, X } from 'lucide-react';
import { useConfirm } from '@/components/ConfirmDialog';

interface SupplierSettlementModalProps {
    supplier: Supplier;
    onClose: () => void;
    onSuccess: () => void;
}

export default function SupplierSettlementModal({ supplier, onClose, onSuccess }: SupplierSettlementModalProps) {
    const [amount, setAmount] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [loading, setLoading] = useState(false);
    const { confirm } = useConfirm();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const val = parseFloat(amount);
        if (!val || val <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }
        if (val > supplier.balance) {
            if (!await confirm({ title: 'Excess Amount', message: `Amount exceeds balance of ${formatCurrency(supplier.balance)}. Continue?`, type: 'warning' })) return;
        }

        setLoading(true);
        const result = await settleSupplierBalance(supplier.id, val, paymentMethod);
        setLoading(false);

        if (result.success) {
            // Post to ledger
            try {
                await postSupplierSettlement(supplier.id, val, paymentMethod, supplier.name);
            } catch (e) { console.error('Ledger post failed:', e); }
            toast.success('Payment recorded successfully');
            onSuccess();
        } else {
            toast.error(result.error || 'Failed to record payment');
        }
    }

    return (
        <div className="modal-blur-overlay">
            <div className="modal-portal-content" style={{ maxWidth: '400px' }}>
                <div className="card" style={{ width: '100%', padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Pay Supplier</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Supplier</div>
                    <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>{supplier.name}</div>
                    <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Current Balance</span>
                        <span style={{ fontWeight: 'bold', fontSize: '1.25rem', color: supplier.balance > 0 ? 'var(--destructive)' : 'var(--success)' }}>
                            {formatCurrency(supplier.balance)}
                        </span>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--muted)', marginBottom: '0.5rem' }}>
                            Amount to Pay
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            className="input"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            autoFocus
                        />
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--muted)', marginBottom: '0.5rem' }}>
                            Payment Method
                        </label>
                        <select
                            className="input"
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                        >
                            <option value="Cash">Cash</option>
                            <option value="Bank">Bank Transfer</option>
                            <option value="Cheque">Cheque</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={onClose} className="btn btn-outline" disabled={loading}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? <Loader2 className="animate-spin" size={16} /> : 'Confirm Payment'}
                        </button>
                    </div>
                </form>
</div>
            </div>
        </div>
    );
}
