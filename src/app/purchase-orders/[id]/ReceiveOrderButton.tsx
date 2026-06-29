'use client';

import { useState } from 'react';
import { receivePurchaseOrder } from '@/app/actions/purchase-orders';
import { toast } from 'sonner';
import { Check, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useConfirm } from '@/components/ConfirmDialog';

export default function ReceiveOrderButton({ order }: { order: any }) {
    const [isOpen, setIsOpen] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [receivedItems, setReceivedItems] = useState(
        order.items.map((item: any) => ({
            product_id: item.product_id,
            product_name: item.product_name,
            quantity_received: item.quantity,
            expected: item.quantity,
            price: item.expected_price || 0
        }))
    );
    const [paidAmount, setPaidAmount] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const router = useRouter();
    const { confirm } = useConfirm();

    const totalValue = receivedItems.reduce((sum: number, item: any) => sum + (item.quantity_received * item.price), 0);

    async function handleReceive() {
        if (!await confirm({ title: 'Receive Order', message: 'Confirm receipt of goods? Inventory will be updated.', type: 'info' })) return;

        setProcessing(true);
        const amount = parseFloat(paidAmount);
        const finalPaid = isNaN(amount) ? 0 : amount;

        const result = await receivePurchaseOrder(
            order.id,
            receivedItems.map((i: any) => ({ product_id: i.product_id, quantity_received: i.quantity_received })),
            {
                paidAmount: finalPaid,
                paymentMethod
            }
        );

        setProcessing(false);
        if (result.success) {
            toast.success('Order received and inventory updated');
            setIsOpen(false);
            router.refresh();
        } else {
            toast.error(result.error || 'Failed to receive order');
        }
    }

    if (order.status !== 'pending') return null;

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="btn btn-primary no-print"
                style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
            >
                <Check size={18} /> Receive Items
            </button>

            {isOpen && (
                <div className="modal-blur-overlay" style={{ zIndex: 1000 }}>
                    <div className="card" style={{ width: '600px', maxWidth: '95vw', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Receive Inventory</h2>

                        <div style={{ marginBottom: '1rem' }}>
                            <table style={{ width: '100%', fontSize: '0.9rem' }}>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'left' }}>Product</th>
                                        <th style={{ textAlign: 'center' }}>Exp. Qty</th>
                                        <th style={{ textAlign: 'center' }}>Rec. Qty</th>
                                        <th style={{ textAlign: 'right' }}>Line Value</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {receivedItems.map((item: any, idx: number) => (
                                        <tr key={item.product_id}>
                                            <td style={{ padding: '0.5rem 0' }}>{item.product_name}</td>
                                            <td style={{ textAlign: 'center' }}>{item.expected}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <input
                                                    type="number"
                                                    className="input"
                                                    style={{ width: '60px', padding: '0.25rem', textAlign: 'center' }}
                                                    value={item.quantity_received}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value) || 0;
                                                        const newItems = [...receivedItems];
                                                        newItems[idx].quantity_received = val;
                                                        setReceivedItems(newItems);
                                                    }}
                                                />
                                            </td>
                                            <td style={{ textAlign: 'right' }}>{formatCurrency(item.quantity_received * item.price)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 'bold' }}>
                                <span>Total Value:</span>
                                <span>{formatCurrency(totalValue)}</span>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Payment</label>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <div style={{ flex: 1 }}>
                                        <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>Amount Paid Now</span>
                                        <input
                                            type="number"
                                            className="input"
                                            placeholder="0.00"
                                            value={paidAmount}
                                            onChange={(e) => setPaidAmount(e.target.value)}
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>Payment Method</span>
                                        <select
                                            className="input"
                                            value={paymentMethod}
                                            onChange={(e) => setPaymentMethod(e.target.value)}
                                        >
                                            <option value="Cash">Cash</option>
                                            <option value="Bank Transfer">Bank Transfer</option>
                                            <option value="Cheque">Cheque</option>
                                        </select>
                                    </div>
                                </div>
                                <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--muted)' }}>
                                    Remaining {formatCurrency(totalValue - (parseFloat(paidAmount) || 0))} will be recorded as Due (Accounts Payable).
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="btn btn-outline"
                                disabled={processing}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReceive}
                                className="btn btn-primary"
                                disabled={processing}
                            >
                                {processing ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                                Confirm Receipt
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
