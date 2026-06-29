'use client';

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize: number;
}

export function Pagination({ currentPage, totalPages, onPageChange, totalItems, pageSize }: PaginationProps) {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Build page numbers to show
  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push('...');
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  const btnStyle = (active = false, disabled = false): React.CSSProperties => ({
    width: 32, height: 32,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid',
    borderColor: active ? 'var(--primary)' : 'var(--border-strong)',
    background: active ? 'var(--primary)' : 'transparent',
    color: active ? '#000' : disabled ? 'var(--muted)' : 'var(--foreground-2)',
    fontSize: '0.8125rem',
    fontWeight: active ? 700 : 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    transition: 'all var(--transition-fast)',
    fontFamily: 'var(--font-sans)',
  });

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0.875rem 0',
      marginTop: '0.5rem',
      borderTop: '1px solid var(--border)',
      flexWrap: 'wrap',
      gap: '0.75rem',
    }}>
      <div style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
        Showing <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>{startItem}</span>–<span style={{ fontWeight: 700, color: 'var(--foreground)' }}>{endItem}</span> of <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>{totalItems}</span>
      </div>

      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          style={btnStyle(false, currentPage === 1)}
          title="First"
        >
          <ChevronsLeft size={14} />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          style={btnStyle(false, currentPage === 1)}
          title="Previous"
        >
          <ChevronLeft size={14} />
        </button>

        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} style={{ width: 32, textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              style={btnStyle(p === currentPage)}
              onMouseEnter={e => { if (p !== currentPage) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
              onMouseLeave={e => { if (p !== currentPage) { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; } }}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          style={btnStyle(false, currentPage === totalPages)}
          title="Next"
        >
          <ChevronRight size={14} />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          style={btnStyle(false, currentPage === totalPages)}
          title="Last"
        >
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
}
