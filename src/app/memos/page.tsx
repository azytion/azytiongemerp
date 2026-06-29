'use client';

/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useTransition, useEffect, useState } from 'react';
import { getMemos, Memo } from '@/app/actions/memos';
import { PaginatedResult } from '@/app/actions/types';
import { Search, Filter, Plus, ClipboardList, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';
import { useLoadEffect } from '@/hooks/useLoadEffect';
import { formatCurrency } from '@/lib/utils';

function useDebounceValue<T>(value: T, delay: number): T {
  const [dv, setDv] = useState<T>(value);
  useEffect(() => {
    const h = setTimeout(() => setDv(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);
  return dv;
}

export default function MemoListPage() {
  const [, _startTransition] = useTransition();
  const [memosResult, setMemosResult] = useState<PaginatedResult<Memo> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounceValue(search, 500);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getMemos(debouncedSearch, statusFilter, page, 15);
    setMemosResult(res);
    setLoading(false);
  }, [debouncedSearch, statusFilter, page]);

  useLoadEffect(() => load(), [load]);
  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter]);

  const statusColors: Record<string, string> = {
    pending: 'warning', partial: 'info', returned: 'muted', sold: 'success',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }} className="animate-fade-in">
      {/* Header */}
      <header className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <div style={{
              width: 36, height: 36,
              background: 'rgba(139,92,246,0.1)',
              border: '1px solid rgba(139,92,246,0.2)',
              borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ClipboardList size={18} color="var(--accent-purple)" />
            </div>
            <h1 className="page-title">Consignments</h1>
          </div>
          <p className="page-subtitle">Manage goods sent out on approval (memo system)</p>
        </div>
        <Link href="/memos/new" className="btn btn-primary btn-sm">
          <Plus size={15} /> New Memo
        </Link>
      </header>

      {/* Filters */}
      <div className="filter-bar">
        <div className="search-bar" style={{ flex: 1, maxWidth: 340 }}>
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search memo # or customer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={15} color="var(--muted-foreground)" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ height: '2.5rem', minWidth: 140, borderRadius: 'var(--radius-full)', paddingRight: '2rem' }}
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
            <option value="returned">Returned</option>
            <option value="sold">Sold</option>
          </select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
          <Loader2 size={36} className="animate-spin" color="var(--primary)" />
        </div>
      ) : !memosResult?.data.length ? (
        <EmptyState
          icon={ClipboardList}
          title="No Memos Found"
          description="Create a new memo to start tracking consignment items."
          action={<Link href="/memos/new" className="btn btn-primary btn-sm"><Plus size={14} /> New Memo</Link>}
        />
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Memo #</th>
                <th>Customer</th>
                <th>Date Out</th>
                <th style={{ textAlign: 'center' }}>Items</th>
                <th style={{ textAlign: 'right' }}>Potential Value</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {memosResult.data.map((memo) => (
                <tr key={memo.id}>
                  <td style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
                    {memo.memo_number}
                  </td>
                  <td style={{ fontWeight: 500 }}>{memo.customer_name || <span style={{ color: 'var(--muted)' }}>Walk-in</span>}</td>
                  <td style={{ color: 'var(--muted-foreground)', fontSize: '0.8125rem' }}>
                    {new Date(memo.date_out).toLocaleDateString()}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{memo.total_items}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                    {formatCurrency(memo.total_amount || 0)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge badge-${statusColors[memo.status] || 'muted'}`}>
                      {memo.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link href={`/memos/${memo.id}`} className="btn btn-secondary btn-sm" style={{ gap: '0.375rem' }}>
                      View <ArrowRight size={13} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {memosResult.totalPages > 1 && (
            <div style={{
              padding: '0.875rem 1rem',
              borderTop: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
                Page {page} of {memosResult.totalPages} · {memosResult.total} total
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn btn-secondary btn-sm">
                  Previous
                </button>
                <button disabled={page === memosResult.totalPages} onClick={() => setPage(p => p + 1)} className="btn btn-secondary btn-sm">
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
