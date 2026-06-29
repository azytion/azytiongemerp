'use client';

/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { Product, getProducts } from '@/app/actions/products';
import { createSet } from '@/app/actions/inventory';
import { toast } from 'sonner';
import { X, Search, Package, Diamond, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';

interface CreateSetModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function CreateSetModal({ isOpen, onClose }: CreateSetModalProps) {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(false);
    const [candidates, setCandidates] = useState<Product[]>([]);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [search, setSearch] = useState('');

    // Set Details
    const [setName, setSetName] = useState('');
    const [costPrice, setCostPrice] = useState<string>('');
    const [sellingPrice, setSellingPrice] = useState<string>('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadCandidates();
        }
    }, [isOpen]);

    async function loadCandidates() {
        setLoading(true);
        try {
            const res = await getProducts(search, undefined, 1, 100);
            // Available for set: singles not already in a set/lot and not archived
            const valid = res.data.filter(p =>
                p.type === 'single' &&
                !p.parent_lot_id &&
                !p.parent_set_id &&
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
        setSelectedIds(prev => {
            const isSelected = prev.includes(id);
            const newSelection = isSelected ? prev.filter(i => i !== id) : [...prev, id];

            // Auto-calculate suggested prices based on selection
            const selectedProducts = candidates.filter(p => newSelection.includes(p.id));
            const totalCost = selectedProducts.reduce((sum, p) => sum + p.cost_price, 0);
            const totalSelling = selectedProducts.reduce((sum, p) => sum + p.selling_price, 0);

            setCostPrice(totalCost > 0 ? totalCost.toString() : '');
            setSellingPrice(totalSelling > 0 ? totalSelling.toString() : '');

            // Suggest a name if not set
            if (!setName || setName.startsWith('New Set with')) {
                setSetName(`New Set with ${newSelection.length} items`);
            }

            return newSelection;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedIds.length < 2) {
            return toast.error('Please select at least 2 items to form a set');
        }
        if (!setName) return toast.error('Please enter a name for the set');

        setSubmitting(true);
        try {
            const result = await createSet(
                setName,
                selectedIds,
                Number(costPrice) || 0,
                Number(sellingPrice) || 0,
                notes
            );
            if (result.success) {
                toast.success(`Set "${setName}" created successfully`);
                onClose();
                router.refresh();
                // Reset form
                setSelectedIds([]);
                setSetName('');
                setCostPrice('');
                setSellingPrice('');
                setNotes('');
            } else {
                toast.error(result.error || 'Failed to create set');
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
            <style>{`
                @media (max-width: 640px) {
                    .inventory-builder-modal__layout {
                        grid-template-columns: 1fr !important;
                    }
                    .inventory-builder-modal__layout > div:first-child {
                        border-right: none !important;
                        border-bottom: 1px solid var(--border);
                        max-height: 45dvh;
                    }
                    .inventory-builder-modal__layout > div:last-child {
                        overflow-y: auto;
                    }
                }
            `}</style>
            <div className="card modal-card inventory-builder-modal" style={{ width: 'min(900px, calc(100vw - 2rem))', maxHeight: '90dvh', display: 'flex', flexDirection: 'column', padding: 0 }}>
                <div className="inventory-builder-modal__header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                        <div style={{ background: 'var(--primary)', color: 'white', padding: '0.5rem', borderRadius: '8px' }}>
                            <Package size={20} />
                        </div>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Create New Gem Set / Pair</h2>
                    </div>
                    <button type="button" onClick={onClose} className="btn-close"><X size={20} /></button>
                </div>

                <div className="inventory-builder-modal__layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) min(350px, 100%)', flex: 1, overflow: 'hidden' }}>
                    {/* Left side: Item Selection */}
                    <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', overflow: 'hidden' }}>
                        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)' }}>
                            <div className="input-group" style={{ display: 'flex', gap: '0.5rem', background: 'var(--surface-hover)', padding: '0.5rem 0.75rem', borderRadius: '8px', flexWrap: 'wrap' }}>
                                <Search size={20} style={{ color: 'var(--muted)' }} />
                                <input
                                    className="input"
                                    placeholder="Search available gemstones..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && loadCandidates()}
                                    style={{ border: 'none', background: 'transparent', padding: 0, flex: 1 }}
                                />
                                <button onClick={() => loadCandidates()} className="btn btn-sm btn-outline">Search</button>
                            </div>
                        </div>

                        <div className="table-wrapper" style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
                            {loading ? (
                                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
                                    <div style={{ marginBottom: '1rem' }}>Loading inventory...</div>
                                </div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '320px' }}>
                                    <thead style={{ background: 'var(--surface-hover)', position: 'sticky', top: 0, zIndex: 10 }}>
                                        <tr style={{ textAlign: 'left', fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            <th style={{ padding: '0.75rem 1rem', width: '40px' }}></th>
                                            <th style={{ padding: '0.75rem 1rem' }}>Product</th>
                                            <th style={{ padding: '0.75rem 1rem' }}>Weight</th>
                                            <th style={{ padding: '0.75rem 1rem' }}>Base Price</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {candidates.map(item => (
                                            <tr
                                                key={item.id}
                                                style={{
                                                    borderBottom: '1px solid var(--border)',
                                                    cursor: 'pointer',
                                                    background: selectedIds.includes(item.id) ? 'rgba(var(--primary-rgb), 0.05)' : undefined
                                                }}
                                                onClick={() => toggleSelection(item.id)}
                                            >
                                                <td style={{ padding: '0.75rem 1rem' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.includes(item.id)}
                                                        onChange={() => { }}
                                                        style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                                                    />
                                                </td>
                                                <td style={{ padding: '0.75rem 1rem' }}>
                                                    <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{item.name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{item.barcode || `#${item.id}`}</div>
                                                </td>
                                                <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem' }}>
                                                    {item.gem_details?.carat_weight} ct
                                                </td>
                                                <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', fontWeight: 500 }}>
                                                    {formatCurrency(item.selling_price)}
                                                </td>
                                            </tr>
                                        ))}
                                        {candidates.length === 0 && (
                                            <tr>
                                                <td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
                                                    <Info size={32} style={{ marginBottom: '0.5rem', opacity: 0.3 }} />
                                                    <div>No eligible items found.</div>
                                                    <div style={{ fontSize: '0.8rem' }}>Only single stones not in other sets/lots are shown.</div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    {/* Right side: Set Details Form */}
                    <div style={{ padding: '1.25rem', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto' }}>
                        <div style={{ background: 'var(--secondary)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.5rem', fontWeight: 600 }}>SELECTION SUMMARY</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{selectedIds.length} <span style={{ fontSize: '0.9rem', color: 'var(--muted)', fontWeight: 'normal' }}>Items selected</span></div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Combined Weight</div>
                                    <div style={{ fontWeight: 600 }}>{candidates.filter(p => selectedIds.includes(p.id)).reduce((sum, p) => sum + (p.gem_details?.carat_weight || 0), 0).toFixed(2)} ct</div>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label className="label" style={{ fontWeight: 600 }}>Set Name</label>
                                <input
                                    className="input"
                                    placeholder="e.g. Matched Sapphire Pair"
                                    value={setName}
                                    onChange={e => setSetName(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label className="label" style={{ fontWeight: 600 }}>Total Cost Price</label>
                                    <input
                                        type="number"
                                        className="input"
                                        value={costPrice}
                                        onChange={e => setCostPrice(e.target.value)}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label className="label" style={{ fontWeight: 600 }}>Total Selling Price</label>
                                    <input
                                        type="number"
                                        className="input"
                                        value={sellingPrice}
                                        onChange={e => setSellingPrice(e.target.value)}
                                        placeholder="0.00"
                                        required
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label className="label" style={{ fontWeight: 600 }}>Set Notes</label>
                                <textarea
                                    className="input"
                                    rows={3}
                                    placeholder="Matched for color and clarity..."
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    style={{ resize: 'none' }}
                                />
                            </div>

                            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={submitting || selectedIds.length < 2}
                                    style={{ width: '100%', padding: '0.875rem', gap: '0.5rem' }}
                                >
                                    <Diamond size={18} />
                                    {submitting ? 'Creating Set...' : 'Form Gem Set'}
                                </button>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="btn btn-outline"
                                    style={{ width: '100%' }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
