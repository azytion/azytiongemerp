'use client';

/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react';
import { getSuppliers, deleteSupplier } from '@/app/actions/suppliers';
import { Plus, Search, Edit, Trash2, Phone, Mail, MapPin, FileText, FileSpreadsheet, FileDown, X } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';

import { PaginatedResult } from '@/app/actions/types';
import { Pagination } from '@/components/ui/Pagination';

import { formatCurrency } from '@/lib/utils';
import SupplierSettlementModal from './SupplierSettlementModal';
import { Supplier } from '@/app/actions/suppliers';
import SupplierStatementModal from '@/components/SupplierStatementModal';
import { useConfirm } from '@/components/ConfirmDialog';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import StaleBanner from '@/components/StaleBanner';
import { localDB, getSyncMeta } from '@/lib/db/LocalDB';
import { downloadRowsAsXlsx } from '@/lib/excel-utils';

export default function SuppliersTab() {
    const isOnline = useOnlineStatus();
    const [result, setResult] = useState<PaginatedResult<Supplier> | null>(null);
    const [loading, setLoading] = useState(true);
    const [isStale, setIsStale] = useState(false);
    const [cachedAt, setCachedAt] = useState<Date | null>(null);
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);
    const [settlingSupplier, setSettlingSupplier] = useState<Supplier | null>(null);
    const [selectedStatementSupplierId, setSelectedStatementSupplierId] = useState<number | null>(null);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [deletingSelected, setDeletingSelected] = useState(false);
    const pageSize = 10;
    const { confirm } = useConfirm();

    useEffect(() => {
        const timer = setTimeout(() => { setPage(1); loadData(1); }, 300);
        return () => clearTimeout(timer);
    }, [query]);

    useEffect(() => { if (page !== 1) loadData(page); }, [page]);
    useEffect(() => { loadData(page); }, [isOnline]);

    async function loadData(targetPage: number = page) {
        setLoading(true);
        if (isOnline) {
            try {
                const res = await getSuppliers(query, targetPage, pageSize);
                setResult(res);
                setIsStale(false);
                if (!query && targetPage === 1) {
                    const full = await getSuppliers('', 1, 2000);
                    if (full?.data) { await localDB.suppliers.clear(); await localDB.suppliers.bulkPut(full.data as any); }
                }
            } catch { await loadFromCache(targetPage); }
        } else {
            await loadFromCache(targetPage);
        }
        setLoading(false);
    }

    async function loadFromCache(targetPage: number) {
        try {
            let all = await localDB.suppliers.orderBy('name').toArray();
            if (query) { const q = query.toLowerCase(); all = all.filter(s => s.name?.toLowerCase().includes(q) || s.phone?.includes(q)); }
            const total = all.length;
            const offset = (targetPage - 1) * pageSize;
            setResult({ data: all.slice(offset, offset + pageSize) as any, total, page: targetPage, pageSize, totalPages: Math.ceil(total / pageSize) });
            setIsStale(true);
            const ts = await getSyncMeta('suppliers_cached_at');
            setCachedAt(ts ? new Date(ts) : null);
        } catch { setResult({ data: [], total: 0, page: 1, pageSize, totalPages: 0 }); }
    }

    async function handleDelete(id: number) {
        if (!await confirm({ title: 'Delete Supplier', message: 'Are you sure you want to delete this supplier?', type: 'danger' })) return;
        try {
            await deleteSupplier(id);
            toast.success('Supplier deleted successfully');
            loadData(page);
        } catch (_error) {
            toast.error('Failed to delete supplier');
        }
    }

    async function handleBulkDelete() {
        if (selectedIds.length === 0) return;
        if (!await confirm({
            title: 'Delete Selected Suppliers',
            message: `Permanently delete ${selectedIds.length} selected supplier${selectedIds.length === 1 ? '' : 's'}?`,
            confirmText: 'Delete',
            type: 'danger',
        })) return;

        setDeletingSelected(true);
        const results = await Promise.all(selectedIds.map(id => deleteSupplier(id)));
        const failed = results.filter((res: any) => res && res.success === false);
        setDeletingSelected(false);
        setSelectedIds([]);
        await loadData(page);
        if (failed.length) toast.error(`${failed.length} supplier${failed.length === 1 ? '' : 's'} could not be deleted`);
        else toast.success('Selected suppliers deleted');
    }

    const pageIds = result?.data.map((s: any) => s.id) || [];
    const allSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id));

    function toggleSelectAll() {
        if (allSelected) setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
        else setSelectedIds(prev => [...new Set([...prev, ...pageIds])]);
    }

    function toggleSelect(id: number) {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    }

    function handleExportExcel() {
        const data = result?.data || [];
        const rows = data.map((s: any) => ({
            Name: s.name, Phone: s.phone || '', Email: s.email || '',
            Address: s.address || '', Balance: formatCurrency(s.balance || 0),
        }));
        void downloadRowsAsXlsx(rows, 'Suppliers', `Suppliers_${new Date().toISOString().split('T')[0]}.xlsx`);
    }

    async function handleExportPDF() {
        try {
            const { generateGenericReportPDF, buildCompanyInfo, downloadPDF } = await import('@/lib/pdf-generator');
            const { getSettings } = await import('@/app/actions/settings');
            const settings = await getSettings();
            const data = result?.data || [];
            const doc = generateGenericReportPDF(
                'Supplier List',
                [{ label: 'Name' }, { label: 'Phone' }, { label: 'Email' }, { label: 'Address' }, { label: 'Balance', align: 'right' }],
                data.map((s: any) => [s.name, s.phone || '—', s.email || '—', s.address || '—', formatCurrency(s.balance || 0)]),
                buildCompanyInfo(settings)
            );
            downloadPDF(doc, `Suppliers_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (e) { console.error(e); }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {isStale && <StaleBanner cachedAt={cachedAt} onRefresh={() => loadData(page)} refreshing={loading} />}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Suppliers</h2>
                    <p style={{ color: 'var(--muted)' }}>Manage your vendor relationships</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {selectedIds.length > 0 && (
                        <>
                            <button onClick={() => setSelectedIds([])} className="btn btn-ghost btn-sm" style={{ color: 'var(--muted-foreground)' }}>
                                <X size={14} /> {selectedIds.length} selected
                            </button>
                            <button onClick={handleBulkDelete} disabled={deletingSelected} className="btn btn-destructive btn-sm">
                                <Trash2 size={14} /> {deletingSelected ? 'Deleting...' : `Delete (${selectedIds.length})`}
                            </button>
                        </>
                    )}
                    <button onClick={handleExportExcel} className="btn btn-secondary btn-sm"><FileSpreadsheet size={14} /> Excel</button>
                    <button onClick={handleExportPDF} className="btn btn-secondary btn-sm"><FileDown size={14} /> PDF</button>
                    <Link href="/suppliers/new" className="btn btn-primary btn-sm">
                        <Plus size={16} /> Add Supplier
                    </Link>
                </div>
            </header>

            <div className="card" style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 0 }}>
                    <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                    <input
                        type="text"
                        placeholder="Search by name or phone..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="input"
                        style={{ paddingLeft: '2.5rem' }}
                    />
                </div>
            </div>

            {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
            ) : (
                <div className="card" style={{ padding: '1rem' }}>
                    <div className="table-wrapper" style={{ overflowX: 'auto' }}>
                        <style>{`
                            @media (max-width: 640px) {
                                .supp-col-address { display: none; }
                            }
                        `}</style>
                        <table>
                            <thead>
                                <tr>
                                    <th style={{ width: 40 }}>
                                        <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} style={{ cursor: 'pointer' }} />
                                    </th>
                                    <th>Name</th>
                                    <th>Contact</th>
                                    <th className="supp-col-address">Address</th>
                                    <th style={{ textAlign: 'right' }}>Balance</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!result || result.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
                                            No suppliers found. Add your first supplier!
                                        </td>
                                    </tr>
                                ) : (
                                    result.data.map((supplier: any) => (
                                        <tr key={supplier.id} style={{ background: selectedIds.includes(supplier.id) ? 'rgba(212,175,55,0.04)' : undefined }}>
                                            <td style={{ width: 40 }} onClick={e => e.stopPropagation()}>
                                                <input type="checkbox" checked={selectedIds.includes(supplier.id)} onChange={() => toggleSelect(supplier.id)} style={{ cursor: 'pointer' }} />
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 500 }}>{supplier.name}</div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem' }}>
                                                    {supplier.phone && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <Phone size={14} color="var(--muted)" />
                                                            <span>{supplier.phone}</span>
                                                        </div>
                                                    )}
                                                    {supplier.email && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <Mail size={14} color="var(--muted)" />
                                                            <span>{supplier.email}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="supp-col-address">
                                                {supplier.address && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                                                        <MapPin size={14} color="var(--muted)" />
                                                        <span style={{ maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {supplier.address}
                                                        </span>
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: '600' }}>
                                                {supplier.balance > 0.01 ? (
                                                    <span style={{ color: 'var(--destructive)' }}>{formatCurrency(supplier.balance)}</span>
                                                ) : (
                                                    <span style={{ color: 'var(--success)' }}>{formatCurrency(0)}</span>
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                    {supplier.balance > 0.01 && (
                                                        <button
                                                            onClick={() => setSettlingSupplier(supplier)}
                                                            className="btn btn-outline"
                                                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--primary)', borderColor: 'var(--primary)' }}
                                                        >
                                                            Pay
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => setSelectedStatementSupplierId(supplier.id)}
                                                        className="btn btn-outline"
                                                        style={{ padding: '0.25rem', width: '2rem', height: '2rem' }}
                                                        title="View Statement"
                                                    >
                                                        <FileText size={16} />
                                                    </button>
                                                    <Link href={`/suppliers/${supplier.id}/edit`} className="btn btn-outline" style={{ padding: '0.25rem', width: '2rem', height: '2rem' }}>
                                                        <Edit size={16} />
                                                    </Link>
                                                    <button
                                                        onClick={() => handleDelete(supplier.id)}
                                                        className="btn btn-destructive"
                                                        style={{ padding: '0.25rem', width: '2rem', height: '2rem', background: 'var(--destructive)', color: 'white' }}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {result && (
                        <Pagination
                            currentPage={page}
                            totalPages={result.totalPages}
                            onPageChange={setPage}
                            totalItems={result.total}
                            pageSize={result.pageSize}
                        />
                    )}
                </div>
            )}

            {settlingSupplier && typeof window !== 'undefined' && createPortal(
                <SupplierSettlementModal
                    supplier={settlingSupplier}
                    onClose={() => setSettlingSupplier(null)}
                    onSuccess={() => {
                        setSettlingSupplier(null);
                        loadData(page);
                    }}
                />,
                document.body
            )}

            {selectedStatementSupplierId && typeof window !== 'undefined' && createPortal(
                <SupplierStatementModal
                    supplierId={selectedStatementSupplierId}
                    onClose={() => setSelectedStatementSupplierId(null)}
                />,
                document.body
            )}
        </div>
    );
}
