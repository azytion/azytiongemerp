'use client';

/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react';
import { getProducts, deleteProduct, archiveProduct, unarchiveProduct } from '@/app/actions/products';
import { Plus, Search, Edit, Trash2, Package, Archive, ArchiveRestore, FileText, X } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';
import { toast } from 'sonner';
import { getSettings } from '@/app/actions/settings';
import { generateOfferLetterPDF, downloadPDF } from '@/lib/pdf-generator';

import { Pagination } from '@/components/ui/Pagination';
import { PaginatedResult } from '@/app/actions/types';
import { Product } from '@/app/actions/products';
import CreateSetModal from '@/components/inventory/CreateSetModal';
import { useConfirm } from '@/components/ConfirmDialog';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import StaleBanner from '@/components/StaleBanner';
import { localDB, getSyncMeta } from '@/lib/db/LocalDB';

export default function ProductsTab() {
    const isOnline = useOnlineStatus();
    const [productsResult, setProductsResult] = useState<PaginatedResult<Product>>({
        data: [], total: 0, page: 1, pageSize: 10, totalPages: 0
    });
    const [loading, setLoading] = useState(true);
    const [isStale, setIsStale] = useState(false);
    const [cachedAt, setCachedAt] = useState<Date | null>(null);
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);
    const [showArchived, setShowArchived] = useState(false);
    const [isCreateSetModalOpen, setIsCreateSetModalOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [generatingPDF, setGeneratingPDF] = useState(false);
    const [deletingSelected, setDeletingSelected] = useState(false);
    const { confirm } = useConfirm();

    useEffect(() => { setPage(1); }, [query, showArchived]);

    useEffect(() => {
        const timer = setTimeout(() => { loadData(); }, 300);
        return () => clearTimeout(timer);
    }, [query, page, showArchived, isOnline]);

    async function loadData() {
        setLoading(true);
        if (isOnline) {
            try {
                const result = await getProducts(query, undefined, page, 10, showArchived);
                setProductsResult(result);
                setIsStale(false);
                // Cache on unfiltered load
                if (!query && !showArchived && page === 1) {
                    const full = await getProducts('', undefined, 1, 2000, false);
                    if (full?.data) { await localDB.products.clear(); await localDB.products.bulkPut(full.data as any); }
                }
            } catch { await loadFromCache(); }
        } else {
            await loadFromCache();
        }
        setLoading(false);
    }

    async function loadFromCache() {
        try {
            let all = await localDB.products.toArray();
            if (!showArchived) all = all.filter(p => !p.is_archived);
            else all = all.filter(p => p.is_archived);
            if (query) { const q = query.toLowerCase(); all = all.filter(p => p.name?.toLowerCase().includes(q) || p.barcode?.includes(q)); }
            const total = all.length;
            const pageSize = 10;
            const offset = (page - 1) * pageSize;
            setProductsResult({ data: all.slice(offset, offset + pageSize) as any, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
            setIsStale(true);
            const ts = await getSyncMeta('products_cached_at');
            setCachedAt(ts ? new Date(ts) : null);
        } catch { setProductsResult({ data: [], total: 0, page: 1, pageSize: 10, totalPages: 0 }); }
    }

    async function handleDelete(id: number) {
        if (!await confirm({ title: 'Delete Product', message: 'Are you sure you want to delete this product?', type: 'danger' })) return;

        try {
            await deleteProduct(id);
            toast.success('Product deleted successfully');
            loadData();
        } catch (_error) {
            toast.error('Failed to delete product');
        }
    }

    async function handleBulkDelete() {
        if (selectedIds.length === 0) return;
        if (!await confirm({
            title: 'Delete Selected Products',
            message: `Permanently delete ${selectedIds.length} selected product${selectedIds.length === 1 ? '' : 's'}?`,
            confirmText: 'Delete',
            type: 'danger',
        })) return;

        setDeletingSelected(true);
        const results = await Promise.all(selectedIds.map(id => deleteProduct(id)));
        const failed = results.filter((res: any) => res && res.success === false);
        setDeletingSelected(false);
        setSelectedIds([]);
        await loadData();
        if (failed.length) toast.error(`${failed.length} product${failed.length === 1 ? '' : 's'} could not be deleted`);
        else toast.success('Selected products deleted');
    }

    async function handleArchive(id: number, name: string) {
        if (!await confirm({ title: 'Archive Product', message: `Archive "${name}"? It will be hidden from active inventory.`, type: 'warning' })) return;

        try {
            const result = await archiveProduct(id, 'manual');
            if (result.success) {
                toast.success('Product archived successfully');
                loadData();
            } else {
                toast.error(result.error || 'Failed to archive product');
            }
        } catch (_error) {
            toast.error('Failed to archive product');
        }
    }

    async function handleUnarchive(id: number, name: string) {
        if (!await confirm({ title: 'Restore Product', message: `Restore "${name}" to active inventory?`, type: 'info' })) return;

        try {
            const result = await unarchiveProduct(id);
            if (result.success) {
                toast.success('Product restored successfully');
                loadData();
            } else {
                toast.error(result.error || 'Failed to restore product');
            }
        } catch (_error) {
            toast.error('Failed to restore product');
        }
    }

    async function handleGenerateOfferLetter() {
        if (selectedIds.length === 0) return;
        try {
            setGeneratingPDF(true);
            const settings = await getSettings();

            // Fetch ALL selected products — not just current page
            let selectedProducts = productsResult.data.filter(p => selectedIds.includes(p.id));
            const missingIds = selectedIds.filter(id => !selectedProducts.find(p => p.id === id));
            if (missingIds.length > 0) {
                // Fetch remaining pages to get all selected products
                const allRes = await getProducts('', undefined, 1, 9999, showArchived);
                const extra = allRes.data.filter(p => missingIds.includes(p.id));
                selectedProducts = [...selectedProducts, ...extra];
            }

            if (selectedProducts.length === 0) {
                toast.error("Selected products not found.");
                return;
            }

            const doc = generateOfferLetterPDF(selectedProducts, {
                name: settings.company_name || 'Azytion GemERP',
                address: settings.company_address,
                phone: settings.company_phone,
                email: settings.company_email,
                website: settings.company_website,
                logo: settings.company_logo
            }, settings.currency_symbol || settings.currency_code || '$');

            downloadPDF(doc, `Gemstone_Offer_${new Date().toISOString().split('T')[0]}.pdf`);
            toast.success("Offer Letter generated successfully");
        } catch (error) {
            console.error(error);
            toast.error("Failed to generate PDF");
        } finally {
            setGeneratingPDF(false);
        }
    }

    function toggleSelect(id: number) {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {isStale && <StaleBanner cachedAt={cachedAt} onRefresh={loadData} refreshing={loading} />}
            <header style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '1rem'
            }}>
                <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Products</h2>
                    <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Manage your inventory and pricing</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {selectedIds.length > 0 && (
                        <div style={{ 
                            display: 'flex', 
                            gap: '0.5rem', 
                            background: 'var(--primary)', 
                            padding: '0.25rem 0.5rem', 
                            borderRadius: '0.5rem', 
                            alignItems: 'center', 
                            color: 'white',
                            flexWrap: 'wrap'
                        }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: 600, padding: '0 0.5rem' }}>{selectedIds.length} Selected</span>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    onClick={handleGenerateOfferLetter}
                                    disabled={generatingPDF}
                                    className="btn"
                                    style={{ background: 'white', color: 'var(--primary)', padding: '0.4rem 0.8rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                >
                                    <FileText size={14} />
                                    {generatingPDF ? 'Generating...' : 'Offer Letter'}
                                </button>
                                <button
                                    onClick={handleBulkDelete}
                                    disabled={deletingSelected}
                                    className="btn"
                                    style={{ background: 'var(--destructive)', color: 'white', padding: '0.4rem 0.8rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                >
                                    <Trash2 size={14} />
                                    {deletingSelected ? 'Deleting...' : 'Delete'}
                                </button>
                                <button
                                    onClick={() => setSelectedIds([])}
                                    className="btn"
                                    style={{ background: 'rgba(255,255,255,0.2)', color: 'white', padding: '0.4rem', borderRadius: '50%' }}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button onClick={() => setIsCreateSetModalOpen(true)} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Plus size={18} />
                            Form Set / Pair
                        </button>
                        <Link href="/products/new" className="btn btn-primary">
                            <Plus size={18} />
                            Add Product
                        </Link>
                    </div>
                </div>
            </header>

            <div className="filter-bar">
                <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
                    <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                    <input
                        type="text"
                        placeholder="Search by name, barcode..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="input"
                        style={{ paddingLeft: '2.5rem' }}
                    />
                </div>

                {/* Show Archived Toggle */}
                <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    background: showArchived ? 'var(--secondary)' : 'transparent',
                    border: '1px solid var(--border)',
                    transition: 'all 0.2s',
                    userSelect: 'none',
                    marginBottom: 0
                }}>
                    <input
                        type="checkbox"
                        checked={showArchived}
                        onChange={(e) => setShowArchived(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                    />
                    <Archive size={16} />
                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Show Archived</span>
                </label>
            </div>

            {loading ? (
                <div style={{ padding: '2rem' }}>Loading...</div>
            ) : (
                <div className="card" style={{ padding: '1rem' }}>
                    <div className="table-wrapper" style={{ overflowX: 'auto' }}>
                        <style>{`
                            @media (max-width: 640px) {
                                .prod-col-cost, .prod-col-profit, .prod-col-margin, .prod-col-cat { display: none; }
                            }
                        `}</style>
                        <table>
                            <thead>
                                <tr>
                                    <th style={{ width: '40px' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.length === productsResult.data.length && productsResult.data.length > 0}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedIds(productsResult.data.map(p => p.id));
                                                } else {
                                                    setSelectedIds([]);
                                                }
                                            }}
                                        />
                                    </th>
                                    <th>Name</th>
                                    <th className="prod-col-cat">Category</th>
                                    <th className="prod-col-cost" style={{ textAlign: 'right' }}>Cost</th>
                                    <th style={{ textAlign: 'right' }}>Price</th>
                                    <th className="prod-col-profit" style={{ textAlign: 'right' }}>Profit</th>
                                    <th className="prod-col-margin" style={{ textAlign: 'right' }}>Margin</th>
                                    <th style={{ textAlign: 'center' }}>Stock</th>
                                    {showArchived && <th style={{ textAlign: 'center' }}>Status</th>}
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {productsResult.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={showArchived ? 9 : 8} style={{ padding: 0 }}>
                                            <EmptyState
                                                icon={Package}
                                                title={showArchived ? "No Archived Products" : "No Products Found"}
                                                description={query ? `No products match "${query}"` : (showArchived ? "No products have been archived yet." : "Get started by adding your first product to inventory.")}
                                                action={!query && !showArchived && (
                                                    <Link href="/products/new" className="btn btn-primary">
                                                        <Plus size={16} /> Add Product
                                                    </Link>
                                                )}
                                            />
                                        </td>
                                    </tr>
                                ) : (
                                    productsResult.data.map((product) => {
                                        const profit = product.selling_price - product.cost_price;
                                        const margin = product.selling_price > 0 ? (profit / product.selling_price) * 100 : 0;
                                        let marginColor = 'var(--foreground)';
                                        if (margin >= 30) marginColor = 'var(--success)';
                                        else if (margin >= 15) marginColor = 'var(--warning)';
                                        else marginColor = 'var(--destructive)';

                                        const isArchived = product.is_archived === 1;

                                        return (
                                            <tr key={product.id} style={{
                                                opacity: isArchived ? 0.6 : 1,
                                                background: selectedIds.includes(product.id) ? 'rgba(59, 130, 246, 0.05)' : (isArchived ? 'var(--muted-background)' : 'transparent'),
                                                cursor: 'pointer'
                                            }}
                                                onClick={(e) => {
                                                    // Don't toggle if clicking a button or link
                                                    if ((e.target as HTMLElement).closest('button, a')) return;
                                                    toggleSelect(product.id);
                                                }}
                                            >
                                                <td onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.includes(product.id)}
                                                        onChange={() => toggleSelect(product.id)}
                                                    />
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: 500 }}>{product.name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{product.barcode}</div>
                                                </td>
                                                <td className="prod-col-cat">
                                                    <div style={{ padding: '0.25rem 0.5rem', background: 'var(--secondary)', borderRadius: '4px', fontSize: '0.75rem', display: 'inline-block' }}>
                                                        {product.category || 'Uncategorized'}
                                                    </div>
                                                </td>
                                                <td className="prod-col-cost" style={{ textAlign: 'right', color: 'var(--muted)' }}>{product.cost_price.toFixed(2)}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{product.selling_price.toFixed(2)}</td>
                                                <td className="prod-col-profit" style={{ textAlign: 'right', color: profit > 0 ? 'var(--success)' : (profit < 0 ? 'var(--destructive)' : 'var(--muted)') }}>
                                                    {profit.toFixed(2)}
                                                </td>
                                                <td className="prod-col-margin" style={{ textAlign: 'right', fontWeight: 'bold', color: marginColor }}>
                                                    {margin.toFixed(1)}%
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <span style={{
                                                        color: product.stock <= product.reorder_level ? 'var(--destructive)' : 'var(--primary)',
                                                        fontWeight: 'bold'
                                                    }}>
                                                        {product.stock}
                                                    </span>
                                                </td>
                                                {showArchived && (
                                                    <td style={{ textAlign: 'center' }}>
                                                        {isArchived ? (
                                                            <span style={{
                                                                padding: '0.25rem 0.5rem',
                                                                background: 'var(--muted)',
                                                                color: 'var(--muted-foreground)',
                                                                borderRadius: '0.25rem',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 500,
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '0.25rem'
                                                            }}>
                                                                <Archive size={12} />
                                                                {product.archived_reason || 'Archived'}
                                                            </span>
                                                        ) : (
                                                            <span style={{
                                                                padding: '0.25rem 0.5rem',
                                                                background: '#d1fae5',
                                                                color: '#065f46',
                                                                borderRadius: '0.25rem',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 500
                                                            }}>
                                                                Active
                                                            </span>
                                                        )}
                                                    </td>
                                                )}
                                                <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                                        {!isArchived && (
                                                            <>
                                                                <Link href={`/products/${product.id}/edit`} className="btn btn-outline" style={{ padding: '0.25rem', width: '2rem', height: '2rem' }}>
                                                                    <Edit size={16} />
                                                                </Link>
                                                                <button
                                                                    onClick={() => handleArchive(product.id, product.name)}
                                                                    className="btn btn-outline"
                                                                    style={{ padding: '0.25rem', width: '2rem', height: '2rem' }}
                                                                    title="Archive product"
                                                                >
                                                                    <Archive size={16} />
                                                                </button>
                                                            </>
                                                        )}
                                                        {isArchived && (
                                                            <button
                                                                onClick={() => handleUnarchive(product.id, product.name)}
                                                                className="btn btn-primary"
                                                                style={{ padding: '0.25rem 0.75rem', height: '2rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                                                title="Restore product"
                                                            >
                                                                <ArchiveRestore size={14} />
                                                                Restore
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleDelete(product.id)}
                                                            className="btn btn-destructive"
                                                            style={{ padding: '0.25rem', width: '2rem', height: '2rem', background: 'var(--destructive)', color: 'white' }}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <Pagination
                        currentPage={page}
                        totalPages={productsResult.totalPages}
                        onPageChange={setPage}
                        totalItems={productsResult.total}
                        pageSize={productsResult.pageSize}
                    />
                </div>
            )}

            <CreateSetModal
                isOpen={isCreateSetModalOpen}
                onClose={() => {
                    setIsCreateSetModalOpen(false);
                    loadData();
                }}
            />
        </div>
    );
}



