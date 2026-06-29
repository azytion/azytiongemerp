'use client';

/* eslint-disable react-hooks/set-state-in-effect */
import { useRouter } from 'next/navigation';
import { useCallback, useTransition, useEffect, useState } from 'react';
import { getMemos, Memo } from '@/app/actions/memos';
import { PaginatedResult } from '@/app/actions/types';
import { Search, Filter, Plus, ArrowRight, Briefcase } from 'lucide-react';
import Link from 'next/link';
import { useLoadEffect } from '@/hooks/useLoadEffect';

// Simple debounce hook
function useDebounceValue<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

export default function ConsignmentTab() {
    const _router = useRouter();
    const [isPending, _startTransition] = useTransition();
    const [memosResult, setMemosResult] = useState<PaginatedResult<Memo> | null>(null);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);

    // Filters
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounceValue(search, 500);
    const [statusFilter, setStatusFilter] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        const res = await getMemos(debouncedSearch, statusFilter, page, 10);
        setMemosResult(res);
        setLoading(false);
    }, [debouncedSearch, statusFilter, page]);

    useLoadEffect(() => load(), [load]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, statusFilter]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', opacity: isPending ? 0.7 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '1rem', flex: 1, flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 260px', minWidth: 0, position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                        <input
                            type="text"
                            placeholder="Search Memo # or Customer name..."
                            className="input"
                            style={{ paddingLeft: '2.56rem', width: '100%', height: '42px' }}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <Filter size={18} style={{ color: 'var(--muted)' }} />
                        <select
                            className="input"
                            style={{ width: '160px', maxWidth: '100%', height: '42px' }}
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="partial">Partial</option>
                            <option value="returned">Returned</option>
                            <option value="sold">Sold</option>
                        </select>
                    </div>
                </div>

                <Link href="/memos/new" className="btn btn-primary" style={{ height: '42px', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    <Plus size={18} />
                    New Memo
                </Link>
            </div>

            {loading ? (
                <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--muted)' }}>
                    <div className="spinner" style={{ marginBottom: '1rem', marginLeft: 'auto', marginRight: 'auto' }}></div>
                    Loading consignments...
                </div>
            ) : !memosResult?.data.length ? (
                <div style={{ textAlign: 'center', padding: '5rem 2rem', backgroundColor: 'var(--surface)', borderRadius: '1rem', border: '1px dashed var(--border)' }}>
                    <Briefcase size={48} style={{ color: 'var(--muted)', marginBottom: '1rem', opacity: 0.5 }} />
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>No Consignments Found</div>
                    <p style={{ color: 'var(--muted)', maxWidth: '400px', margin: '0 auto' }}>
                        You haven&apos;t issued any goods on approval yet, or no results match your search.
                    </p>
                </div>
            ) : (
                <div className="card" style={{ overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--background-sunken)', fontSize: '0.9rem' }}>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Memo #</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Customer</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Date Out</th>
                                    <th style={{ padding: '1rem', textAlign: 'center' }}>Items</th>
                                    <th style={{ padding: '1rem', textAlign: 'right' }}>Potential Value</th>
                                    <th style={{ padding: '1rem', textAlign: 'center' }}>Status</th>
                                    <th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {memosResult.data.map((memo) => (
                                    <tr key={memo.id} className="table-row-hover" style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '1rem', fontWeight: 600 }}>{memo.memo_number}</td>
                                        <td style={{ padding: '1rem' }}>{memo.customer_name}</td>
                                        <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>{new Date(memo.date_out).toLocaleDateString()}</td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <span style={{ fontWeight: 600 }}>{memo.total_items}</span>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>
                                            ${(memo.total_amount || 0).toLocaleString()}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <span className={`badge badge-${getStatusColor(memo.status)}`}>
                                                {memo.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                            <Link href={`/memos/${memo.id}`} className="btn btn-sm btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                                                View <ArrowRight size={14} />
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {memosResult.totalPages > 1 && (
                        <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--background-sunken)', flexWrap: 'wrap', gap: '0.75rem' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                                Showing page {page} of {memosResult.totalPages}
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <button
                                    disabled={page === 1}
                                    onClick={() => setPage(p => p - 1)}
                                    className="btn btn-outline btn-sm"
                                >
                                    Previous
                                </button>
                                <button
                                    disabled={page === memosResult.totalPages}
                                    onClick={() => setPage(p => p + 1)}
                                    className="btn btn-outline btn-sm"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function getStatusColor(status: string) {
    switch (status) {
        case 'pending': return 'warning';
        case 'partial': return 'info';
        case 'returned': return 'success';
        case 'sold': return 'success';
        default: return 'secondary';
    }
}
