'use client';

/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { Gem, Plus, ChevronDown, ChevronRight, History, Loader2, X } from 'lucide-react';
import { getGemLotProductsPaginated, addLotTrackingEntry } from '@/app/actions/products';
import type { Product, GemDetails } from '@/app/actions/products';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';
import { Pagination } from '@/components/ui/Pagination';

interface LotTrackingEntry {
    date: string;
    action: string;
    weight_before?: number;
    weight_after?: number;
    notes?: string;
    user?: string;
}

interface LotProduct extends Omit<Product, 'gem_details'> {
    gem_details?: GemDetails | null;
    lot_tracking_parsed?: LotTrackingEntry[];
}

export default function LotManagementTab() {
    const [products, setProducts] = useState<LotProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const PAGE_SIZE = 20;
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [_editModal, _setEditModal] = useState<{ open: boolean; product: LotProduct | null }>({ open: false, product: null });
    const [addEntryModal, setAddEntryModal] = useState<{ open: boolean; productId: number | null }>({ open: false, productId: null });
    const [newEntry, setNewEntry] = useState<Partial<LotTrackingEntry>>({ action: 'weight_adjustment', notes: '' });
    const [saving, setSaving] = useState(false);

    useEffect(() => { setPage(1); }, [search]);
    useEffect(() => { load(); }, [search, page]);

    async function load() {
        setLoading(true);
        try {
            const res = await getGemLotProductsPaginated(search, page, PAGE_SIZE);
            setProducts(res.data);
            setTotal(res.total);
            setTotalPages(res.totalPages);
        } catch (e) {
            console.error(e);
            toast.error('Failed to load lot data');
        } finally {
            setLoading(false);
        }
    }

    async function handleAddEntry(productId: number) {
        if (!newEntry.action) return;
        setSaving(true);
        try {
            const res = await addLotTrackingEntry(productId, {
                date: new Date().toISOString(),
                action: newEntry.action || 'note',
                weight_before: newEntry.weight_before,
                weight_after: newEntry.weight_after,
                notes: newEntry.notes || '',
            });
            if (res.success) {
                toast.success('Entry added');
                setAddEntryModal({ open: false, productId: null });
                setNewEntry({ action: 'weight_adjustment', notes: '' });
                load();
            } else {
                toast.error(res.error || 'Failed to add entry');
            }
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Search */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="search-bar" style={{ flex: '1 1 240px', minWidth: 0 }}>
                    <Gem size={16} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search gemstone lots..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ paddingLeft: '2.5rem' }}
                    />
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
                    {total} lots
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                    <Loader2 size={28} className="animate-spin" color="var(--primary)" />
                </div>
            ) : products.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted-foreground)' }}>
                    <Gem size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                    <p>No gemstone lots found. Add gem details to products to track them here.</p>
                </div>
            ) : (
                <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {products.map(product => {
                        const gem = product.gem_details;
                        const tracking: LotTrackingEntry[] = gem?.lot_tracking ? JSON.parse(gem.lot_tracking) : [];
                        const isExpanded = expandedId === product.id;

                        return (
                            <div key={product.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--surface)' }}>
                                {/* Row Header */}
                                <div
                                    style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem 1rem', cursor: 'pointer', flexWrap: 'wrap' }}
                                    onClick={() => setExpandedId(isExpanded ? null : product.id)}
                                >
                                    <div style={{ color: 'var(--muted-foreground)' }}>
                                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </div>
                                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--primary-subtle)', border: '1px solid rgba(212,175,55,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Gem size={16} color="var(--primary)" />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.9375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.125rem' }}>
                                            {gem?.shape && <span>{gem.shape}</span>}
                                            {gem?.color && <span>{gem.color}</span>}
                                            {gem?.origin && <span>Origin: {gem.origin}</span>}
                                            {gem?.treatment && gem.treatment !== 'None' && <span style={{ color: 'var(--warning)' }}>⚠ {gem.treatment}</span>}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flex: '1 1 260px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                        {gem?.carat_weight && (
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Weight</div>
                                                <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{gem.carat_weight.toFixed(2)} ct</div>
                                            </div>
                                        )}
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Stock</div>
                                            <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{product.stock}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Value</div>
                                            <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--primary)' }}>{formatCurrency(product.selling_price * product.stock)}</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.375rem' }}>
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                style={{ padding: '0.375rem 0.625rem' }}
                                                onClick={e => { e.stopPropagation(); setAddEntryModal({ open: true, productId: product.id }); }}
                                                title="Add tracking entry"
                                            >
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded: Lot Tracking History */}
                                {isExpanded && (
                                    <div style={{ borderTop: '1px solid var(--border)', padding: '1rem', background: 'var(--surface-2)' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                                            {[
                                                { label: 'Origin Weight', value: gem?.lot_origin_weight ? `${gem.lot_origin_weight.toFixed(2)} ct` : '—' },
                                                { label: 'Current Weight', value: gem?.carat_weight ? `${gem.carat_weight.toFixed(2)} ct` : '—' },
                                                { label: 'Clarity', value: gem?.clarity || '—' },
                                                { label: 'Cut Grade', value: (gem as any)?.cut_grade || '—' },
                                            ].map((item, i) => (
                                                <div key={i} style={{ padding: '0.625rem 0.875rem', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                                                    <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>{item.label}</div>
                                                    <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{item.value}</div>
                                                </div>
                                            ))}
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                            <History size={14} color="var(--muted-foreground)" />
                                            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tracking History</span>
                                        </div>

                                        {tracking.length === 0 ? (
                                            <p style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)', fontStyle: 'italic' }}>No tracking entries yet. Click + to add one.</p>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                {tracking.map((entry, i) => (
                                                    <div key={i} style={{ display: 'flex', gap: '0.75rem', padding: '0.625rem 0.875rem', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: '0.8125rem' }}>
                                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', marginTop: 5, flexShrink: 0 }} />
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                                <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{entry.action.replace(/_/g, ' ')}</span>
                                                                <span style={{ color: 'var(--muted-foreground)', fontSize: '0.75rem', flexShrink: 0 }}>{new Date(entry.date).toLocaleDateString()}</span>
                                                            </div>
                                                            {(entry.weight_before !== undefined || entry.weight_after !== undefined) && (
                                                                <div style={{ color: 'var(--muted-foreground)', marginTop: '0.125rem' }}>
                                                                    {entry.weight_before !== undefined && <span>{entry.weight_before.toFixed(2)} ct</span>}
                                                                    {entry.weight_before !== undefined && entry.weight_after !== undefined && <span> → </span>}
                                                                    {entry.weight_after !== undefined && <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{entry.weight_after.toFixed(2)} ct</span>}
                                                                </div>
                                                            )}
                                                            {entry.notes && <div style={{ color: 'var(--muted-foreground)', marginTop: '0.125rem' }}>{entry.notes}</div>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                {totalPages > 1 && (
                    <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={total} pageSize={PAGE_SIZE} />
                )}
                </>
            )}

            {/* Add Entry Modal */}
            {addEntryModal.open && createPortal(
                <div className="modal-blur-overlay" style={{ zIndex: 99999 }}>
                    <div className="card" style={{ width: '100%', maxWidth: 440, padding: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h3 style={{ margin: 0 }}>Add Tracking Entry</h3>
                            <button className="btn-close" onClick={() => setAddEntryModal({ open: false, productId: null })}><X size={16} /></button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="form-group">
                                <label>Action Type</label>
                                <select className="input" value={newEntry.action} onChange={e => setNewEntry(n => ({ ...n, action: e.target.value }))}>
                                    <option value="weight_adjustment">Weight Adjustment</option>
                                    <option value="cutting">Cutting</option>
                                    <option value="polishing">Polishing</option>
                                    <option value="treatment">Treatment Applied</option>
                                    <option value="grading">Grading</option>
                                    <option value="certification">Certification</option>
                                    <option value="split">Lot Split</option>
                                    <option value="merge">Lot Merge</option>
                                    <option value="note">General Note</option>
                                </select>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div className="form-group">
                                    <label>Weight Before (ct)</label>
                                    <input type="number" step="0.01" className="input" placeholder="0.00" value={newEntry.weight_before || ''} onChange={e => setNewEntry(n => ({ ...n, weight_before: parseFloat(e.target.value) || undefined }))} />
                                </div>
                                <div className="form-group">
                                    <label>Weight After (ct)</label>
                                    <input type="number" step="0.01" className="input" placeholder="0.00" value={newEntry.weight_after || ''} onChange={e => setNewEntry(n => ({ ...n, weight_after: parseFloat(e.target.value) || undefined }))} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Notes</label>
                                <textarea className="input" rows={3} placeholder="Additional notes..." value={newEntry.notes || ''} onChange={e => setNewEntry(n => ({ ...n, notes: e.target.value }))} style={{ height: 'auto', minHeight: '4rem' }} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setAddEntryModal({ open: false, productId: null })}>Cancel</button>
                            <button className="btn btn-primary btn-sm" onClick={() => addEntryModal.productId && handleAddEntry(addEntryModal.productId)} disabled={saving}>
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                Add Entry
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
