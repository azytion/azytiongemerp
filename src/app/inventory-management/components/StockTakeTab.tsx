'use client';

import { useState } from 'react';
import { Play, Save, Search, Filter, AlertTriangle } from 'lucide-react';
import { getProducts } from '@/app/actions/products';
import { reconcileStock, StockTakeItem } from '@/app/actions/inventory';
import StockTakePrintButton from './StockTakePrintButton';
import { useConfirm } from '@/components/ConfirmDialog';
import { toast } from 'sonner';

export default function StockTakeTab() {
    const [isActive, setIsActive] = useState(false);
    const [products, setProducts] = useState<any[]>([]);
    const [counts, setCounts] = useState<Record<number, number>>({});
    const [loading, setLoading] = useState(false);
    const [filterDiscrepancies, setFilterDiscrepancies] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const { confirm } = useConfirm();

    const startStockTake = async () => {
        setLoading(true);
        // Load all products (snapshot)
        const res = await getProducts('', undefined, 1, 1000);
        const allProducts = res.data;
        setProducts(allProducts);
        // Initialize counts with system stock
        const initialCounts: Record<number, number> = {};
        allProducts.forEach((p: any) => initialCounts[p.id] = p.stock);
        setCounts(initialCounts);
        setIsActive(true);
        setLoading(false);
    };

    const handleCountChange = (id: number, val: string) => {
        const num = parseInt(val) || 0;
        setCounts(prev => ({ ...prev, [id]: num }));
    };

    const getDiscrepancies = () => {
        return products.filter(p => counts[p.id] !== p.stock);
    };

    const displayedProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode.includes(searchQuery);
        if (filterDiscrepancies) {
            return matchesSearch && counts[p.id] !== p.stock;
        }
        return matchesSearch;
    });

    const handleFinalize = async () => {
        if (!await confirm({ title: 'Finalize Stock Take', message: 'Are you sure you want to update inventory levels for all changed items?', type: 'warning' })) return;

        setLoading(true);
        const discrepancies = getDiscrepancies();
        const itemsToReconcile: StockTakeItem[] = discrepancies.map(p => ({
            productId: p.id,
            systemStock: p.stock,
            actualStock: counts[p.id]
        }));

        if (itemsToReconcile.length === 0) {
            toast.info('No changes to save.');
            setLoading(false);
            return;
        }

        const result = await reconcileStock(itemsToReconcile, 1); // UserId 1 for now
        if (result.success) {
            toast.success(`Stock take complete. Updated ${result.count} items.`);
            setIsActive(false);
            setProducts([]);
            setCounts({});
        } else {
            toast.error('Error: ' + result.error);
        }
        setLoading(false);
    };

    if (!isActive) {
        return (
            <div style={{ padding: '3rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
                <div style={{ background: '#e0f2fe', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: '#0284c7' }}>
                    <Play size={40} style={{ marginLeft: '4px' }} />
                </div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Start Stock Take</h2>
                <p style={{ color: 'var(--muted)', marginBottom: '2rem' }}>
                    Begin a new stock take session. The system will load current inventory levels.
                    You can then enter physical counts and reconcile differences.
                </p>
                <button onClick={startStockTake} disabled={loading} className="btn btn-primary" style={{ fontSize: '1.1rem', padding: '0.75rem 2rem' }}>
                    {loading ? 'Initializing...' : 'Start Session'}
                </button>
            </div>
        );
    }

    const discrepancyCount = getDiscrepancies().length;

    return (
        <div style={{ minHeight: 'min(620px, calc(100vh - 200px))', display: 'flex', flexDirection: 'column' }}>
            {/* Header / Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>Stock Take In Progress</h2>
                    <div style={{ background: filterDiscrepancies ? '#fee2e2' : 'var(--secondary)', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.875rem', color: filterDiscrepancies ? '#991b1b' : 'inherit', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <AlertTriangle size={14} /> {discrepancyCount} Differences
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <StockTakePrintButton
                        items={products.map(p => ({
                            product_name: p.name,
                            barcode: p.barcode,
                            expected_qty: p.stock,
                            actual_qty: counts[p.id] ?? p.stock,
                            purchase_price: p.purchase_price || 0
                        }))}
                        date={(() => { const _d = new Date(); return _d.getFullYear() + "-" + String(_d.getMonth()+1).padStart(2,"0") + "-" + String(_d.getDate()).padStart(2,"0"); })()}
                    />
                    <button onClick={() => setIsActive(false)} className="btn btn-outline">Cancel</button>
                    <button onClick={handleFinalize} className="btn btn-primary" disabled={loading}>
                        <Save size={16} style={{ marginRight: '0.5rem' }} /> Finalize & Update
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ position: 'relative', width: '300px', maxWidth: '100%', flex: '1 1 260px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                    <input
                        className="input"
                        placeholder="Search product..."
                        style={{ paddingLeft: '2.5rem', width: '100%' }}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flex: '0 1 auto', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setFilterDiscrepancies(!filterDiscrepancies)}
                        className={`btn ${filterDiscrepancies ? 'btn-primary' : 'btn-outline'}`}
                        style={{ display: 'flex', gap: '0.5rem' }}
                    >
                        <Filter size={16} /> {filterDiscrepancies ? 'Showing Differences' : 'Show All'}
                    </button>
                </div>
            </div>

            {/* Table */}
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '0.75rem' }}>Product</th>
                            <th style={{ padding: '0.75rem' }}>Expected</th>
                            <th style={{ padding: '0.75rem', width: '150px' }}>Actual (Counted)</th>
                            <th style={{ padding: '0.75rem', textAlign: 'right' }}>Diff</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayedProducts.map(product => {
                            const actual = counts[product.id] ?? product.stock;
                            const diff = actual - product.stock;
                            const isDiff = diff !== 0;

                            return (
                                <tr key={product.id} style={{
                                    borderBottom: '1px solid var(--border)',
                                    borderLeft: isDiff ? '4px solid #f97316' : 'transparent',
                                    background: isDiff ? 'rgba(249, 115, 22, 0.05)' : 'transparent'
                                }}>
                                    <td style={{ padding: '0.75rem' }}>
                                        <div style={{ fontWeight: 500 }}>{product.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{product.barcode}</div>
                                    </td>
                                    <td style={{ padding: '0.75rem' }}>{product.stock}</td>
                                    <td style={{ padding: '0.75rem' }}>
                                        <input
                                            type="number"
                                            className="input"
                                            style={{ width: '100px', borderColor: isDiff ? '#f97316' : 'var(--border)' }}
                                            value={actual}
                                            onChange={(e) => handleCountChange(product.id, e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                        />
                                    </td>
                                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold', color: diff < 0 ? 'var(--destructive)' : diff > 0 ? '#10b981' : 'var(--muted)' }}>
                                        {diff > 0 ? '+' : ''}{diff}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

