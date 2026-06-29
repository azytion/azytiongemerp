'use client';

/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { Product, getProducts } from '@/app/actions/products';
import { mergeLot } from '@/app/actions/inventory';
import { toast } from 'sonner';
import { X, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';

interface MergeLotModalProps {
    isOpen: boolean;
    onClose: () => void;
    targetLot: Product;
}

export default function MergeLotModal({ isOpen, onClose, targetLot }: MergeLotModalProps) {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(false);
    const [candidates, setCandidates] = useState<Product[]>([]);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadCandidates();
        }
    }, [isOpen]);

    async function loadCandidates() {
        setLoading(true);
        try {
            // detailed filter later, for now fetch all singles
            // In a real app, we'd have a specific API for "available for merge"
            // getProducts(query, categoryId, page, pageSize)
            const res = await getProducts(search, undefined, 1, 100);
            // client side filter for simplicity in prototype
            const valid = res.data.filter(p =>
                p.type === 'single' &&
                p.id !== targetLot.id &&
                !p.is_archived
            );
            setCandidates(valid);
        } catch (_e) {
            toast.error('Failed to load products');
        } finally {
            setLoading(false);
        }
    }

    const toggleSelection = (id: number) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleSubmit = async () => {
        if (selectedIds.length === 0) return;

        setSubmitting(true);
        try {
            const result = await mergeLot(targetLot.id, selectedIds);
            if (result.success) {
                toast.success(`Merged ${selectedIds.length} items into lot`);
                onClose();
                router.refresh();
                setSelectedIds([]);
            } else {
                toast.error(result.error || 'Failed to merge items');
            }
        } catch (_e) {
            toast.error('An unexpected error occurred');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-blur-overlay" style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1400,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
            <div className="card modal-card lot-action-modal" style={{ width: 'min(800px, calc(100vw - 2rem))', maxHeight: '90dvh', display: 'flex', flexDirection: 'column', padding: 0 }}>
                <div className="lot-action-modal__header" style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Merge Items into: {targetLot.name}</h2>
                    <button type="button" onClick={onClose} className="btn-close"><X size={20} /></button>
                </div>

                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)' }}>
                    <div className="input-group" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <Search size={20} style={{ color: 'var(--muted)' }} />
                        <input
                            className="input"
                            placeholder="Search items to merge..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && loadCandidates()}
                            style={{ border: 'none', padding: 0 }}
                        />
                        <button onClick={() => loadCandidates()} className="btn btn-sm btn-outline">Search</button>
                    </div>
                </div>

                <div className="table-wrapper" style={{ padding: '0', overflowY: 'auto', overflowX: 'auto', flex: 1 }}>
                    {loading ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>Loading...</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '400px' }}>
                            <thead style={{ background: 'var(--surface-hover)', position: 'sticky', top: 0 }}>
                                <tr style={{ textAlign: 'left' }}>
                                    <th style={{ padding: '0.75rem 1rem', width: '40px' }}></th>
                                    <th style={{ padding: '0.75rem 1rem' }}>Product</th>
                                    <th style={{ padding: '0.75rem 1rem' }}>Weight</th>
                                    <th style={{ padding: '0.75rem 1rem' }}>Price</th>
                                    <th style={{ padding: '0.75rem 1rem' }}>SKU</th>
                                </tr>
                            </thead>
                            <tbody>
                                {candidates.map(item => (
                                    <tr
                                        key={item.id}
                                        style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: selectedIds.includes(item.id) ? 'var(--primary-light)' : undefined }}
                                        onClick={() => toggleSelection(item.id)}
                                    >
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(item.id)}
                                                onChange={() => { }}
                                                style={{ cursor: 'pointer' }}
                                            />
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <div style={{ fontWeight: 500 }}>{item.name}</div>
                                            {item.parent_lot_id && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Split from #{item.parent_lot_id}</div>
                                            )}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            {item.gem_details?.carat_weight} ct
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            {formatCurrency(item.selling_price)}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace' }}>
                                            {item.barcode}
                                        </td>
                                    </tr>
                                ))}
                                {candidates.length === 0 && (
                                    <tr>
                                        <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
                                            No eligible single items found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="lot-action-modal__footer" style={{ padding: '1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
                        {selectedIds.length} items selected
                    </div>
                    <div className="modal-action-row" style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={onClose} className="btn btn-outline">Cancel</button>
                        <button onClick={handleSubmit} disabled={submitting || selectedIds.length === 0} className="btn btn-primary">
                            {submitting ? 'Merging...' : 'Merge Items'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
