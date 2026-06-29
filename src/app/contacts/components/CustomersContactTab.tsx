'use client';

/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback, useState, useEffect } from 'react';
import { getCustomers, deleteCustomer, Customer } from '@/app/actions/customers';
import { Plus, Search, Edit, Trash2, Phone, Mail, MapPin, FileText, Eye, Banknote, FileSpreadsheet, X, FileDown } from 'lucide-react';
import Link from 'next/link';
import { PaginatedResult } from '@/app/actions/types';
import { Pagination } from '@/components/ui/Pagination';
import { formatCurrency } from '@/lib/utils';
import CustomerStatementModal from '@/components/CustomerStatementModal';
import { DueCollectionModal } from '@/components/DueCollectionModal';
import { useConfirm } from '@/components/ConfirmDialog';
import { toast } from 'sonner';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import StaleBanner from '@/components/StaleBanner';
import { localDB, getSyncMeta } from '@/lib/db/LocalDB';
import { useLoadEffect } from '@/hooks/useLoadEffect';
import { downloadRowsAsXlsx } from '@/lib/excel-utils';

export default function CustomersContactTab() {
    const isOnline = useOnlineStatus();
    const [result, setResult] = useState<PaginatedResult<Customer> | null>(null);
    const [loading, setLoading] = useState(true);
    const [isStale, setIsStale] = useState(false);
    const [cachedAt, setCachedAt] = useState<Date | null>(null);
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [selectedStatementCustomerId, setSelectedStatementCustomerId] = useState<number | null>(null);
    const [isDueModalOpen, setIsDueModalOpen] = useState(false);
    const [_sendingStatement, _setSendingStatement] = useState<number | null>(null);
    const [deletingSelected, setDeletingSelected] = useState(false);
    const { confirm } = useConfirm();
    const pageSize = 15;

    useEffect(() => { setPage(1); }, [query]);

    const load = useCallback(async () => {
        setLoading(true);
        if (isOnline) {
            try {
                const res = await getCustomers(query, page, pageSize);
                setResult(res);
                setIsStale(false);
                // Update cache
                if (!query && page === 1) {
                    const full = await getCustomers('', 1, 2000);
                    if (full?.data) {
                        await localDB.customers.clear();
                        await localDB.customers.bulkPut(full.data as any);
                    }
                }
            } catch {
                await loadFromCache();
            }
        } else {
            await loadFromCache();
        }
        setLoading(false);
    }, [query, page, isOnline, pageSize]);

    useLoadEffect(() => load(), [load]);

    async function loadFromCache() {
        try {
            let all = await localDB.customers.orderBy('name').toArray();
            if (query) {
                const q = query.toLowerCase();
                all = all.filter(c => c.name?.toLowerCase().includes(q) || c.phone?.includes(q));
            }
            const total = all.length;
            const offset = (page - 1) * pageSize;
            setResult({ data: all.slice(offset, offset + pageSize) as any, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
            setIsStale(true);
            const ts = await getSyncMeta('customers_cached_at');
            setCachedAt(ts ? new Date(ts) : null);
        } catch {
            setResult({ data: [], total: 0, page: 1, pageSize, totalPages: 0 });
        }
    }

    async function handleDelete(id: number, name: string) {
        if (!await confirm({ title: 'Delete Customer', message: `Delete "${name}"? This cannot be undone.`, type: 'danger' })) return;
        try {
            await deleteCustomer(id);
            toast.success('Customer deleted');
            load();
        } catch { toast.error('Failed to delete customer'); }
    }

    async function handleBulkDelete() {
        if (selectedIds.length === 0) return;
        if (!await confirm({
            title: 'Delete Selected Customers',
            message: `Permanently delete ${selectedIds.length} selected customer${selectedIds.length === 1 ? '' : 's'}? This cannot be undone.`,
            confirmText: 'Delete',
            type: 'danger',
        })) return;

        setDeletingSelected(true);
        const results = await Promise.all(selectedIds.map(id => deleteCustomer(id)));
        const failed = results.filter((res: any) => res && res.success === false);
        setDeletingSelected(false);
        setSelectedIds([]);
        await load();
        if (failed.length) toast.error(`${failed.length} customer${failed.length === 1 ? '' : 's'} could not be deleted`);
        else toast.success('Selected customers deleted');
    }

    const allIds = result?.data.map(c => c.id) || [];
    const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.includes(id));

    function toggleSelectAll() {
        if (allSelected) setSelectedIds(prev => prev.filter(id => !allIds.includes(id)));
        else setSelectedIds(prev => [...new Set([...prev, ...allIds])]);
    }

    function toggleSelect(id: number) {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    }

    function handleExportExcel() {
        const data = result?.data || [];
        const toExport = selectedIds.length > 0 ? data.filter(c => selectedIds.includes(c.id)) : data;
        const rows = toExport.map(c => ({
            Name: c.name, Phone: c.phone || '', Email: c.email || '',
            Address: c.address || '', Balance: formatCurrency(c.balance || 0),
        }));
        void downloadRowsAsXlsx(rows, 'Customers', `Customers_${new Date().toISOString().split('T')[0]}.xlsx`);
    }

    async function handleExportPDF() {
        try {
            const { generateGenericReportPDF, buildCompanyInfo, downloadPDF } = await import('@/lib/pdf-generator');
            const { getSettings } = await import('@/app/actions/settings');
            const settings = await getSettings();
            const data = result?.data || [];
            const toExport = selectedIds.length > 0 ? data.filter(c => selectedIds.includes(c.id)) : data;
            const doc = generateGenericReportPDF(
                'Customer List',
                [{ label: 'Name' }, { label: 'Phone' }, { label: 'Email' }, { label: 'Address' }, { label: 'Balance', align: 'right' }],
                toExport.map(c => [c.name, c.phone || '—', c.email || '—', c.address || '—', formatCurrency(c.balance || 0)]),
                buildCompanyInfo(settings)
            );
            downloadPDF(doc, `Customers_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (e) { console.error(e); }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <style>{`
                @media (max-width: 480px) {
                    .cust-col-edit,
                    .cust-col-del { display: none; }
                }
            `}</style>
            {isStale && <StaleBanner cachedAt={cachedAt} onRefresh={load} refreshing={loading} />}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div className="search-bar" style={{ flex: 1, maxWidth: 340 }}>
                    <Search size={16} className="search-icon" />
                    <input type="text" placeholder="Search by name or phone..." value={query} onChange={e => setQuery(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {selectedIds.length > 0 && (
                        <button onClick={() => setSelectedIds([])} className="btn btn-ghost btn-sm" style={{ color: 'var(--muted-foreground)' }}>
                            <X size={14} /> {selectedIds.length} selected
                        </button>
                    )}
                    {selectedIds.length > 0 && (
                        <button onClick={handleBulkDelete} disabled={deletingSelected} className="btn btn-destructive btn-sm">
                            <Trash2 size={14} /> {deletingSelected ? 'Deleting...' : `Delete (${selectedIds.length})`}
                        </button>
                    )}
                    <button onClick={handleExportExcel} className="btn btn-secondary btn-sm"><FileSpreadsheet size={14} /> Excel</button>
                    <button onClick={handleExportPDF} className="btn btn-secondary btn-sm"><FileDown size={14} /> PDF</button>
                    <button onClick={() => setIsDueModalOpen(true)} className="btn btn-secondary btn-sm" style={{ color: 'var(--success)' }}>
                        <Banknote size={15} /> Due Settlement
                    </button>
                    <Link href="/customers/new" className="btn btn-primary btn-sm"><Plus size={15} /> Add Customer</Link>
                </div>
            </div>

            {loading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>Loading...</div>
            ) : (
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th style={{ width: 40 }}>
                                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} style={{ cursor: 'pointer' }} />
                                </th>
                                <th>Customer</th>
                                <th>Contact</th>
                                <th>Balance</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!result?.data.length ? (
                                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--muted-foreground)' }}>No customers found.</td></tr>
                            ) : result.data.map(customer => (
                                <tr key={customer.id} style={{ background: selectedIds.includes(customer.id) ? 'rgba(212,175,55,0.04)' : undefined }}>
                                    <td style={{ width: 40 }} onClick={e => e.stopPropagation()}>
                                        <input type="checkbox" checked={selectedIds.includes(customer.id)} onChange={() => toggleSelect(customer.id)} style={{ cursor: 'pointer' }} />
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-subtle)', border: '1px solid rgba(212,175,55,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.875rem', color: 'var(--primary)', flexShrink: 0 }}>
                                                {customer.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{customer.name}</div>
                                                {customer.address && (
                                                    <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.125rem' }}>
                                                        <MapPin size={10} />
                                                        <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{customer.address}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.8125rem' }}>
                                            {customer.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}><Phone size={12} color="var(--muted-foreground)" />{customer.phone}</div>}
                                            {customer.email && <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--muted-foreground)' }}><Mail size={12} color="var(--muted-foreground)" />{customer.email}</div>}
                                            {!customer.phone && !customer.email && <span style={{ color: 'var(--muted)' }}>—</span>}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: (customer.balance || 0) > 0 ? 'var(--destructive)' : (customer.balance || 0) < 0 ? 'var(--success)' : 'var(--muted-foreground)' }}>
                                            {formatCurrency(Math.abs(customer.balance || 0))}
                                            {(customer.balance || 0) > 0 && <span style={{ fontSize: '0.6875rem', fontWeight: 500, marginLeft: 4 }}>due</span>}
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.375rem' }}>
                                            <button onClick={() => setSelectedStatementCustomerId(customer.id)} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem' }} title="Statement"><FileText size={13} /></button>
                                            <Link href={`/customers/${customer.id}`} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem' }} title="View"><Eye size={13} /></Link>
                                            <Link href={`/customers/${customer.id}/edit`} className="btn btn-secondary btn-sm cust-col-edit" style={{ padding: '0.25rem 0.5rem' }} title="Edit"><Edit size={13} /></Link>
                                            <button onClick={() => handleDelete(customer.id, customer.name)} className="btn btn-ghost btn-sm cust-col-del" style={{ padding: '0.25rem 0.5rem', color: 'var(--destructive)' }} title="Delete"><Trash2 size={13} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {result && result.totalPages > 1 && (
                        <Pagination currentPage={page} totalPages={result.totalPages} onPageChange={setPage} totalItems={result.total} pageSize={pageSize} />
                    )}
                </div>
            )}

            {selectedStatementCustomerId && (
                <CustomerStatementModal customerId={selectedStatementCustomerId} onClose={() => setSelectedStatementCustomerId(null)} />
            )}
            {isDueModalOpen && <DueCollectionModal isOpen={isDueModalOpen} onClose={() => setIsDueModalOpen(false)} />}
        </div>
    );
}
