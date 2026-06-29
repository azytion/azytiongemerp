'use client';

import { useCallback, useEffect, useState } from 'react';
import SalesTable from '@/components/SalesTable';
import { getSales } from '@/app/actions/sales';
import { PaginatedResult } from '@/app/actions/types';
import { Search, Filter, X, FileText, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import Link from 'next/link';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useLoadEffect } from '@/hooks/useLoadEffect';
import StaleBanner from '@/components/StaleBanner';
import { localDB, getSyncMeta } from '@/lib/db/LocalDB';

function useDebounceValue<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

function salesDateMs(value: unknown): number {
    if (!value) return 0;
    const raw = String(value).trim();
    if (!raw) return 0;

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const time = new Date(`${raw}T00:00:00`).getTime();
        return Number.isNaN(time) ? 0 : time;
    }

    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(raw)) {
        const time = new Date(`${raw.replace(' ', 'T')}Z`).getTime();
        return Number.isNaN(time) ? 0 : time;
    }

    const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
    let time = new Date(normalized).getTime();
    if (!Number.isNaN(time)) return time;
    time = new Date(raw).getTime();
    return Number.isNaN(time) ? 0 : time;
}

export default function SalesHistoryPage() {
    const isOnline = useOnlineStatus();
    const [salesResult, setSalesResult] = useState<PaginatedResult<any> | null>(null);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [isStale, setIsStale] = useState(false);
    const [cachedAt, setCachedAt] = useState<Date | null>(null);
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounceValue(search, 500);
    const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    const loadFromCache = useCallback(async (start?: string, end?: string) => {
        try {
            let all = await localDB.sales.toArray();

            // Apply date filter
            const startMs = start ? salesDateMs(start) : 0;
            const endInput = end && end.length === 10 ? `${end}T23:59:59.999` : end;
            const endMs = endInput ? salesDateMs(endInput) : Number.POSITIVE_INFINITY;
            all = all.filter(s => {
                const time = salesDateMs(s.date);
                return time >= startMs && time <= endMs;
            });

            // Apply search
            if (debouncedSearch) {
                const q = debouncedSearch.toLowerCase();
                all = all.filter(s =>
                    s.invoice_number?.toLowerCase().includes(q) ||
                    s.customer_name?.toLowerCase().includes(q)
                );
            }

            all.sort((a, b) => {
                const returnWeight = (sale: any) => sale.type === 'return' ? 1 : 0;
                const byDate = salesDateMs(b.date) - salesDateMs(a.date);
                if (byDate !== 0) return byDate;
                const byReturn = returnWeight(b) - returnWeight(a);
                if (byReturn !== 0) return byReturn;
                return Number(b.id || 0) - Number(a.id || 0);
            });

            const total = all.length;
            const pageSize = 15;
            const offset = (page - 1) * pageSize;
            const data = all.slice(offset, offset + pageSize);

            setSalesResult({
                data,
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
            });
            setIsStale(true);

            const ts = await getSyncMeta('sales_cached_at');
            setCachedAt(ts ? new Date(ts) : null);
        } catch {
            setSalesResult({ data: [], total: 0, page: 1, pageSize: 15, totalPages: 0 });
        }
    }, [debouncedSearch, page]);

    const load = useCallback(async () => {
        setLoading(true);
        let start: string | undefined;
        let end: string | undefined;
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        if (dateRange === 'today') {
            start = now.toISOString();
            end = new Date(now.getTime() + 86400000 - 1).toISOString();
        } else if (dateRange === 'week') {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(now.setDate(diff));
            monday.setHours(0, 0, 0, 0);
            start = monday.toISOString();
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            sunday.setHours(23, 59, 59, 999);
            end = sunday.toISOString();
        } else if (dateRange === 'month') {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            lastDay.setHours(23, 59, 59, 999);
            start = firstDay.toISOString();
            end = lastDay.toISOString();
        } else if (dateRange === 'custom') {
            if (customStart) start = customStart;
            if (customEnd) end = customEnd;
        }

        if (isOnline) {
            try {
                const res = await getSales(page, 15, debouncedSearch, start, end);
                setSalesResult(res);
                setIsStale(false);
                if (!debouncedSearch && dateRange === 'all' && page === 1) {
                    const full = await getSales(1, 500);
                    if (full?.data) {
                        await localDB.sales.clear();
                        await localDB.sales.bulkPut(full.data as any);
                    }
                }
            } catch {
                await loadFromCache(start, end);
            }
        } else {
            await loadFromCache(start, end);
        }
        setLoading(false);
    }, [debouncedSearch, dateRange, customStart, customEnd, page, isOnline, loadFromCache]);

    useLoadEffect(() => load(), [load]);

    const hasFilters = search || dateRange !== 'all';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }} className="animate-fade-in">
            <header className="page-header">
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                        <div style={{ width: 36, height: 36, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FileText size={18} color="var(--info)" />
                        </div>
                        <h1 className="page-title">Sales History</h1>
                    </div>
                    <p className="page-subtitle">View and manage all past transactions</p>
                </div>
                <Link href="/pos" className="btn btn-primary btn-sm">+ New Sale</Link>
            </header>

            {isStale && <StaleBanner cachedAt={cachedAt} onRefresh={load} refreshing={loading} />}

            <div className="filter-bar" style={{ flexWrap: 'wrap' }}>
                <div className="search-bar" style={{ flex: '1 1 200px', maxWidth: 340 }}>
                    <Search size={16} className="search-icon" />
                    <input type="text" placeholder="Search invoice or customer..." value={search} onChange={e => { setPage(1); setSearch(e.target.value); }} />
                    {search && (
                        <button onClick={() => { setPage(1); setSearch(''); }} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center' }}>
                            <X size={14} />
                        </button>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    <Filter size={15} color="var(--muted-foreground)" />
                    <select value={dateRange} onChange={e => { setPage(1); setDateRange(e.target.value as any); }} style={{ height: '2.5rem', minWidth: 130, borderRadius: 'var(--radius-full)', paddingRight: '2rem' }}>
                        <option value="all">All Time</option>
                        <option value="today">Today</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                        <option value="custom">Custom Range</option>
                    </select>
                </div>
                {dateRange === 'custom' && (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', flex: '1 1 100%' }}>
                        <input type="date" value={customStart} onChange={e => { setPage(1); setCustomStart(e.target.value); }} style={{ height: '2.5rem', borderRadius: 'var(--radius)', flex: '1 1 130px' }} />
                        <span style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem', flexShrink: 0 }}>to</span>
                        <input type="date" value={customEnd} onChange={e => { setPage(1); setCustomEnd(e.target.value); }} style={{ height: '2.5rem', borderRadius: 'var(--radius)', flex: '1 1 130px' }} />
                    </div>
                )}
                {hasFilters && (
                    <button onClick={() => { setPage(1); setSearch(''); setDateRange('all'); setCustomStart(''); setCustomEnd(''); }} className="btn btn-ghost btn-sm" style={{ color: 'var(--destructive)', flexShrink: 0 }}>
                        <X size={14} /> Clear
                    </button>
                )}
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
                    <Loader2 size={36} className="animate-spin" color="var(--primary)" />
                </div>
            ) : !salesResult?.data.length ? (
                <EmptyState icon={FileText} title="No Sales Found"
                    description={hasFilters ? 'Try adjusting your search or filters' : isOnline ? 'Sales will appear here once transactions are made' : 'No cached sales data available'}
                    action={hasFilters ? <button className="btn btn-outline btn-sm" onClick={() => { setPage(1); setSearch(''); setDateRange('all'); }}>Clear Filters</button> : undefined}
                />
            ) : (
                <SalesTable salesResult={salesResult} page={page} onPageChange={setPage} />
            )}
        </div>
    );
}
