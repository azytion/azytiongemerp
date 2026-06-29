'use client';

import { useState } from 'react';
import { Product } from '@/app/actions/products';
import { splitLot, SplitItemRequest } from '@/app/actions/inventory';
import { toast } from 'sonner';
import { X, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SplitLotModalProps {
    isOpen: boolean;
    onClose: () => void;
    lot: Product;
}

export default function SplitLotModal({ isOpen, onClose, lot }: SplitLotModalProps) {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [splitItems, setSplitItems] = useState<SplitItemRequest[]>([
        { carat_weight: 0, selling_price: 0, name_suffix: 'A', pricing_method: 'per_piece' }
    ]);

    if (!isOpen) return null;

    const availableWeight = (lot.gem_details?.carat_weight || 0);
    const allocatedWeight = splitItems.reduce((sum, item) => sum + (Number(item.carat_weight) || 0), 0);
    const remainingWeight = availableWeight - allocatedWeight;

    const handleAddItem = () => {
        const nextSuffix = String.fromCharCode(65 + splitItems.length); // A, B, C...
        setSplitItems([...splitItems, {
            carat_weight: 0,
            selling_price: 0,
            name_suffix: nextSuffix,
            pricing_method: lot.pricing_method // Default to parent's method
        }]);
    };

    const handleRemoveItem = (index: number) => {
        setSplitItems(splitItems.filter((_, i) => i !== index));
    };

    const handleChange = (index: number, field: keyof SplitItemRequest, value: string | number) => {
        const newItems = [...splitItems];
        newItems[index] = { ...newItems[index], [field]: value };
        setSplitItems(newItems);
    };

    const handleSubmit = async () => {
        if (allocatedWeight > availableWeight) {
            toast.error(`Allocated weight (${allocatedWeight}ct) exceeds lot weight (${availableWeight}ct)`);
            return;
        }

        if (splitItems.some(i => i.carat_weight <= 0)) {
            toast.error('All split items must have a valid weight');
            return;
        }

        setSubmitting(true);
        try {
            const result = await splitLot(lot.id, splitItems);
            if (result.success) {
                toast.success('Lot split successfully');
                onClose();
                router.refresh();
            } else {
                toast.error(result.error || 'Failed to split lot');
            }
        } catch (_e) {
            toast.error('An unexpected error occurred');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-blur-overlay" style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1400,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
            <div className="card modal-card lot-action-modal" style={{ width: 'min(800px, calc(100vw - 2rem))', maxHeight: '90dvh', display: 'flex', flexDirection: 'column', padding: 0 }}>
                <div className="lot-action-modal__header" style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Split Lot: {lot.name}</h2>
                    <button type="button" onClick={onClose} className="btn-close"><X size={20} /></button>
                </div>

                <div style={{ padding: '1rem', overflowY: 'auto', flex: 1 }}>
                    <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span>Total Lot Weight:</span>
                            <strong>{availableWeight.toFixed(2)} ct</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: remainingWeight < 0 ? 'var(--error)' : 'var(--success)' }}>
                            <span>Remaining Weight:</span>
                            <strong>{remainingWeight.toFixed(2)} ct</strong>
                        </div>
                    </div>

                    <div className="table-wrapper" style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '420px' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ padding: '0.5rem' }}>Suffix</th>
                                    <th style={{ padding: '0.5rem' }}>Weight (ct)</th>
                                    <th style={{ padding: '0.5rem' }}>Price</th>
                                    <th style={{ padding: '0.5rem' }}>Method</th>
                                    <th style={{ padding: '0.5rem' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {splitItems.map((item, index) => (
                                    <tr key={index} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '0.5rem' }}>
                                            <input
                                                className="input"
                                                value={item.name_suffix || ''}
                                                onChange={(e) => handleChange(index, 'name_suffix', e.target.value)}
                                                style={{ width: '60px' }}
                                            />
                                        </td>
                                        <td style={{ padding: '0.5rem' }}>
                                            <input
                                                type="number"
                                                className="input"
                                                value={item.carat_weight}
                                                onChange={(e) => handleChange(index, 'carat_weight', parseFloat(e.target.value))}
                                                style={{ width: '80px' }}
                                                step="0.01"
                                            />
                                        </td>
                                        <td style={{ padding: '0.5rem' }}>
                                            <input
                                                type="number"
                                                className="input"
                                                value={item.selling_price}
                                                onChange={(e) => handleChange(index, 'selling_price', parseFloat(e.target.value))}
                                                style={{ width: '100px' }}
                                            />
                                        </td>
                                        <td style={{ padding: '0.5rem' }}>
                                            <select
                                                className="input"
                                                value={item.pricing_method}
                                                onChange={(e) => handleChange(index, 'pricing_method', e.target.value as any)}
                                            >
                                                <option value="per_piece">Piece</option>
                                                <option value="per_carat">Carat</option>
                                            </select>
                                        </td>
                                        <td style={{ padding: '0.5rem' }}>
                                            <button type="button" onClick={() => handleRemoveItem(index)} className="btn btn-ghost" style={{ color: 'var(--error)' }}>
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <button type="button" onClick={handleAddItem} className="btn btn-outline" style={{ marginTop: '1rem', width: '100%' }}>
                        <Plus size={16} /> Add Item
                    </button>
                </div>

                <div className="modal-action-row" style={{ padding: '1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
                    <button type="button" onClick={handleSubmit} disabled={submitting || remainingWeight < 0} className="btn btn-primary">
                        {submitting ? 'Splitting...' : 'Confirm Split'}
                    </button>
                </div>
            </div>
        </div>
    );
}
