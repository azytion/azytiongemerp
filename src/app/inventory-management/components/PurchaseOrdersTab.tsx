'use client';

/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from 'react';
import { getPurchaseOrders, cancelPurchaseOrder, getPurchaseOrder, deletePurchaseOrder } from '@/app/actions/purchase-orders';
import { processPurchaseReturn } from '@/app/actions/credit-notes';
import { formatDate, formatCurrency } from '@/lib/utils';
import { StatCard } from '@/components/ui/StatCard';
import { Plus, Eye, X, CheckCircle, RotateCcw, ShoppingCart, Clock, Landmark, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { PaginatedResult } from '@/app/actions/types';
import { Pagination } from '@/components/ui/Pagination';
import Modal from '@/components/ui/Modal';
import InputModal from '@/components/ui/InputModal';
import { useConfirm } from '@/components/ConfirmDialog';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import StaleBanner from '@/components/StaleBanner';
import { localDB, getSyncMeta } from '@/lib/db/LocalDB';
import { useLoadEffect } from '@/hooks/useLoadEffect';

export default function PurchaseOrdersTab() {
    const isOnline = useOnlineStatus();
    const [result, setResult] = useState<PaginatedResult<any> | null>(null);
    const [loading, setLoading] = useState(true);
    const [isStale, setIsStale] = useState(false);
    const [cachedAt, setCachedAt] = useState<Date | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [page, setPage] = useState(1);
    const [returningPO, setReturningPO] = useState<any | null>(null);
    const [returnQtys, setReturnQtys] = useState<Record<number, number>>({});
    const [submittingReturn, setSubmittingReturn] = useState(false);
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
    const [pendingReturnItems, setPendingReturnItems] = useState<any[]>([]);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [deletingSelected, setDeletingSelected] = useState(false);
    const pageSize = 10;
    const { confirm } = useConfirm();

    useEffect(() => { setPage(1); }, [statusFilter]);

    const loadFromCache = useCallback(async () => {
        try {
            let all = await localDB.purchaseOrders.orderBy('date').reverse().toArray();
            if (statusFilter !== 'all') all = all.filter(po => po.status === statusFilter || po.payment_status === statusFilter);
            const total = all.length;
            const offset = (page - 1) * pageSize;
            setResult({ data: all.slice(offset, offset + pageSize) as any, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
            setIsStale(true);
            const ts = await getSyncMeta('purchase_orders_cached_at');
            setCachedAt(ts ? new Date(ts) : null);
        } catch { setResult({ data: [], total: 0, page: 1, pageSize, totalPages: 0 }); }
    }, [statusFilter, page, pageSize]);

    const loadData = useCallback(async () => {
        setLoading(true);
        if (isOnline) {
            try {
                const data = await getPurchaseOrders(statusFilter === 'all' ? undefined : statusFilter, page, pageSize);
                setResult(data);
                setIsStale(false);
                if (statusFilter === 'all' && page === 1) {
                    const full = await getPurchaseOrders(undefined, 1, 500);
                    if (full?.data) { await localDB.purchaseOrders.clear(); await localDB.purchaseOrders.bulkPut(full.data as any); }
                }
            } catch { await loadFromCache(); }
        } else {
            await loadFromCache();
        }
        setLoading(false);
    }, [isOnline, statusFilter, page, pageSize, loadFromCache]);

    useLoadEffect(() => loadData(), [loadData]);

    const orders = result?.data || [];

    async function handleCancel(id: number) {
        await cancelPurchaseOrder(id);
        loadData();
        toast.success("Purchase order cancelled");
    }

    async function handleDelete(id: number) {
        if (!await confirm({ title: 'Delete Purchase Order', message: 'Delete this pending purchase order?', confirmText: 'Delete', type: 'danger' })) return;
        const res = await deletePurchaseOrder(id);
        if (res.success) {
            toast.success('Purchase order deleted');
            await loadData();
        } else {
            toast.error(res.error || 'Failed to delete purchase order');
        }
    }

    const selectableIds = orders.filter(order => order.status === 'pending').map(order => order.id);
    const allSelected = selectableIds.length > 0 && selectableIds.every(id => selectedIds.includes(id));

    function toggleSelectAll() {
        if (allSelected) setSelectedIds(prev => prev.filter(id => !selectableIds.includes(id)));
        else setSelectedIds(prev => [...new Set([...prev, ...selectableIds])]);
    }

    function toggleSelect(id: number) {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    }

    async function handleBulkDelete() {
        if (selectedIds.length === 0) return;
        if (!await confirm({
            title: 'Delete Selected Purchase Orders',
            message: `Delete ${selectedIds.length} selected pending purchase order${selectedIds.length === 1 ? '' : 's'}?`,
            confirmText: 'Delete',
            type: 'danger',
        })) return;

        setDeletingSelected(true);
        const results = await Promise.all(selectedIds.map(id => deletePurchaseOrder(id)));
        const failed = results.filter((res: any) => res && res.success === false);
        setDeletingSelected(false);
        setSelectedIds([]);
        await loadData();
        if (failed.length) toast.error(`${failed.length} purchase order${failed.length === 1 ? '' : 's'} could not be deleted`);
        else toast.success('Selected purchase orders deleted');
    }

    async function handleReturnClick(order: any) {
        setLoading(true);
        const details = await getPurchaseOrder(order.id);
        setReturningPO(details);
        setReturnQtys({});
        setLoading(false);
    }

    async function handleProcessReturn() {
        if (!returningPO) return;
        const items = Object.entries(returnQtys)
            .filter(([_, qty]) => qty > 0)
            .map(([pid, qty]) => {
                const item = returningPO.items.find((i: any) => i.product_id === Number(pid));
                return {
                    product_id: Number(pid),
                    quantity: qty,
                    price: item?.expected_price || 0
                };
            });

        if (items.length === 0) {
            toast.error("Please select items to return");
            return;
        }

        setPendingReturnItems(items);
        setIsReturnModalOpen(true);
    }

    async function executeProcessReturn(reason: string) {
        if (!returningPO) return;

        setSubmittingReturn(true);
        const res = await processPurchaseReturn(returningPO.id, pendingReturnItems, reason || "Supplier Return");
        setSubmittingReturn(false);

        if (res.success) {
            toast.success("Purchase return processed successfully");
            setReturningPO(null);
            setPendingReturnItems([]);
            loadData();
        } else {
            toast.error(res.error || "Failed to process return");
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'var(--warning)';
            case 'received': return 'var(--success)';
            case 'cancelled': return 'var(--muted)';
            default: return 'var(--text)';
        }
    };

    if (loading && !returningPO) {
        return <div style={{ padding: '2rem' }}>Loading...</div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {isStale && <StaleBanner cachedAt={cachedAt} onRefresh={loadData} refreshing={loading} />}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Purchase Orders</h2>
                    <p style={{ color: 'var(--muted)' }}>Manage supplier purchase orders and track inventory</p>
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
                    <Link href="/purchase-orders/new" className="btn btn-primary">
                        <Plus size={20} />
                        Create PO
                    </Link>
                </div>
            </header>

            {/* Status Filter */}
            <div className="card" style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: '500', flexShrink: 0 }}>Filter by Status:</span>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {['all', 'pending', 'received', 'cancelled'].map(s => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={statusFilter === s ? 'btn btn-primary' : 'btn btn-outline'}
                            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', textTransform: 'capitalize' }}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Orders Table */}
            <div className="card table-wrapper" style={{ overflowX: 'auto' }}>
                <style>{`
                    @media (max-width: 640px) {
                        .po-col-created, .po-col-expected { display: none; }
                    }
                `}</style>
                <table>
                    <thead>
                        <tr>
                            <th style={{ width: 40 }}>
                                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} style={{ cursor: 'pointer' }} />
                            </th>
                            <th>PO Number</th>
                            <th>Supplier</th>
                            <th className="po-col-created">Created Date</th>
                            <th className="po-col-expected">Expected Date</th>
                            <th style={{ textAlign: 'center' }}>Status</th>
                            <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Total Amount</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.length === 0 ? (
                            <tr>
                                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
                                    No purchase orders found
                                </td>
                            </tr>
                        ) : (
                            orders.map((order) => (
                                <tr key={order.id} style={{ background: selectedIds.includes(order.id) ? 'rgba(212,175,55,0.04)' : undefined }}>
                                    <td style={{ width: 40 }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(order.id)}
                                            onChange={() => toggleSelect(order.id)}
                                            disabled={order.status !== 'pending'}
                                            style={{ cursor: order.status === 'pending' ? 'pointer' : 'not-allowed' }}
                                            title={order.status === 'pending' ? 'Select purchase order' : 'Only pending purchase orders can be deleted'}
                                        />
                                    </td>
                                    <td style={{ fontWeight: '500', whiteSpace: 'nowrap' }}>{order.po_number}</td>
                                    <td>{order.supplier_name || 'N/A'}</td>
                                    <td className="po-col-created" style={{ whiteSpace: 'nowrap' }}>{formatDate(order.date_created)}</td>
                                    <td className="po-col-expected" style={{ whiteSpace: 'nowrap' }}>{order.expected_date ? formatDate(order.expected_date) : 'N/A'}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span style={{
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '12px',
                                            fontSize: '0.75rem',
                                            fontWeight: '600',
                                            textTransform: 'uppercase',
                                            color: getStatusColor(order.status),
                                            border: `1px solid ${getStatusColor(order.status)}`,
                                            whiteSpace: 'nowrap',
                                        }}>
                                            {order.status}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: '500', whiteSpace: 'nowrap' }}>
                                        {formatCurrency(order.total_amount)}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                            <Link
                                                href={`/purchase-orders/${order.id}`}
                                                className="btn btn-outline"
                                                style={{ padding: '0.5rem' }}
                                                title="View Details"
                                            >
                                                <Eye size={16} />
                                            </Link>
                                            {order.status === 'received' && (
                                                <button
                                                    onClick={() => handleReturnClick(order)}
                                                    className="btn btn-outline"
                                                    style={{ padding: '0.5rem', color: 'var(--destructive)' }}
                                                    title="Return Items"
                                                >
                                                    <RotateCcw size={16} />
                                                </button>
                                            )}
                                            {order.status === 'pending' && (
                                                <button
                                                    onClick={() => handleDelete(order.id)}
                                                    className="btn btn-outline"
                                                    style={{ padding: '0.5rem', color: 'var(--destructive)' }}
                                                    title="Delete PO"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                            {order.status === 'pending' && (
                                                <button
                                                    onClick={async () => {
                                                            if (await confirm({ title: 'Cancel Purchase Order', message: 'Are you sure you want to cancel this PO?', type: 'danger' })) {
                                                                await handleCancel(order.id);
                                                            }
                                                    }}
                                                    className="btn btn-outline"
                                                    style={{ padding: '0.5rem', color: 'var(--warning)' }}
                                                    title="Cancel PO"
                                                >
                                                    <X size={16} />
                                                </button>
                                            )}
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

            {/* Summary Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                <StatCard
                    title="Total Orders"
                    value={orders.length}
                    icon={ShoppingCart}
                    variant="blue"
                    subtitle="All time orders"
                />
                <StatCard
                    title="Pending"
                    value={orders.filter(o => o.status === 'pending').length}
                    icon={Clock}
                    variant="orange"
                    subtitle="To be received"
                />
                <StatCard
                    title="Received"
                    value={orders.filter(o => o.status === 'received').length}
                    icon={CheckCircle}
                    variant="green"
                    subtitle="Fulfilled orders"
                />
                <StatCard
                    title="Total Value"
                    value={formatCurrency(orders.reduce((sum, o) => sum + o.total_amount, 0))}
                    icon={Landmark}
                    variant="purple"
                    subtitle="Liability / Paid"
                />
            </div>

            {/* Return Items Modal */}
            {returningPO && (
            <Modal
                isOpen={!!returningPO}
                onClose={() => setReturningPO(null)}
                title={`Return Items: ${returningPO?.po_number}`}
                maxWidth="600px"
            >
                {returningPO && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div>
                            <p style={{ fontSize: '0.875rem', color: 'var(--muted)', margin: 0 }}>
                                Select the quantity of each item you wish to return to the supplier ({returningPO.supplier_name}).
                            </p>
                        </div>

                        <div className="table-wrapper">
                            <table style={{ width: '100%', fontSize: '0.875rem' }}>
                                <thead style={{ background: 'var(--secondary)' }}>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '0.75rem' }}>Product</th>
                                        <th style={{ textAlign: 'right', padding: '0.75rem' }}>Unit Price</th>
                                        <th style={{ textAlign: 'center', padding: '0.75rem' }}>Ordered</th>
                                        <th style={{ textAlign: 'center', padding: '0.75rem' }}>Return Qty</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {returningPO.items.map((item: any) => (
                                        <tr key={item.id}>
                                            <td style={{ padding: '0.75rem' }}>{item.product_name}</td>
                                            <td style={{ textAlign: 'right', padding: '0.75rem' }}>{formatCurrency(item.expected_price)}</td>
                                            <td style={{ textAlign: 'center', padding: '0.75rem' }}>{item.quantity}</td>
                                            <td style={{ textAlign: 'center', padding: '0.75rem' }}>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={item.quantity}
                                                    value={returnQtys[item.product_id] || 0}
                                                    onChange={(e) => setReturnQtys({ ...returnQtys, [item.product_id]: parseInt(e.target.value) || 0 })}
                                                    style={{ width: '70px' }}
                                                    className="input"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem', flexWrap: 'wrap' }}>
                            <button onClick={() => setReturningPO(null)} className="btn btn-outline" disabled={submittingReturn}>Cancel</button>
                            <button
                                onClick={handleProcessReturn}
                                className="btn btn-destructive"
                                disabled={submittingReturn || Object.values(returnQtys).every(v => v === 0)}
                                style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                            >
                                {submittingReturn ? 'Processing...' : <><RotateCcw size={16} /> Process Return</>}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
            )}

            <InputModal
                isOpen={isReturnModalOpen}
                onClose={() => setIsReturnModalOpen(false)}
                onConfirm={executeProcessReturn}
                title="Return Reason"
                description="Why are these items being returned to the supplier?"
                placeholder="e.g. Damaged goods, Incorrect item, Overstock..."
                confirmLabel="Confirm Return"
            />
        </div>
    );
}
