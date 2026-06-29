'use client';

import { useCallback, useState } from 'react';
import { useLoadEffect } from '@/hooks/useLoadEffect';
import { getCreditNotes } from '@/app/actions/credit-notes';
import { formatDate, formatCurrency } from '@/lib/utils';
import { FileText, TrendingUp, ShoppingCart, ArrowLeftRight, CreditCard } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { Pagination } from '@/components/ui/Pagination';
import { PaginatedResult } from '@/app/actions/types';
import { CreditNote, CreditNoteSummary } from '@/app/actions/credit-notes';
import CreditNotePrintButton from './CreditNotePrintButton';

export default function CreditNotesTab() {
    const [result, setResult] = useState<(PaginatedResult<CreditNote> & { summary: CreditNoteSummary }) | null>(null);
    const [loading, setLoading] = useState(true);
    const [type, setType] = useState<string>('');
    const [page, setPage] = useState(1);
    const pageSize = 15;

    const loadData = useCallback(async () => {
        setLoading(true);
        const typeFilter = type as 'sales_return' | 'purchase_return' | undefined;
        const notesData = await getCreditNotes(typeFilter, page, pageSize);
        setResult(notesData);
        setLoading(false);
    }, [type, page, pageSize]);

    useLoadEffect(() => loadData(), [loadData]);

    const getTypeColor = (noteType: string) => {
        return noteType === 'sales_return' ? 'var(--destructive)' : 'var(--primary)';
    };

    if (loading && !result) {
        return <div style={{ padding: '2rem' }}>Loading...</div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <header>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Credit Notes</h2>
                <p style={{ color: 'var(--muted)' }}>View all sales and purchase returns</p>
            </header>

            {/* Type Filter */}
            <div className="card" style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: '500', flexShrink: 0 }}>Filter by Type:</span>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => { setType(''); setPage(1); }}
                        className={!type ? 'btn btn-primary' : 'btn btn-outline'}
                        style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                    >
                        All
                    </button>
                    <button
                        onClick={() => { setType('sales_return'); setPage(1); }}
                        className={type === 'sales_return' ? 'btn btn-primary' : 'btn btn-outline'}
                        style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                    >
                        Sales Returns
                    </button>
                    <button
                        onClick={() => { setType('purchase_return'); setPage(1); }}
                        className={type === 'purchase_return' ? 'btn btn-primary' : 'btn btn-outline'}
                        style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                    >
                        Purchase Returns
                    </button>
                </div>
            </div>

            {/* Credit Notes Table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="card table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Credit Note #</th>
                                <th>Date</th>
                                <th style={{ textAlign: 'center' }}>Type</th>
                                <th>Reference</th>
                                <th style={{ textAlign: 'right' }}>Amount</th>
                                <th>Reason</th>
                                <th style={{ textAlign: 'center' }}>Status</th>
                                <th style={{ textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!result || result.data.length === 0 ? (
                                <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
                                        No credit notes found
                                    </td>
                                </tr>
                            ) : (
                                result.data.map((note) => (
                                    <tr key={note.id}>
                                        <td style={{ fontWeight: '500' }}>
                                            <FileText size={14} style={{ display: 'inline', marginRight: '0.5rem' }} />
                                            {note.credit_note_number}
                                        </td>
                                        <td>{formatDate(note.date)}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span style={{
                                                padding: '0.25rem 0.75rem',
                                                borderRadius: '12px',
                                                fontSize: '0.75rem',
                                                fontWeight: '600',
                                                textTransform: 'uppercase',
                                                color: getTypeColor(note.type),
                                                border: `1px solid ${getTypeColor(note.type)}`
                                            }}>
                                                {note.type === 'sales_return' ? 'Sales' : 'Purchase'}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
                                            {note.reference_type} #{note.reference_invoice_id || 'N/A'}
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: '500', color: 'var(--destructive)' }}>
                                            {formatCurrency(note.amount)}
                                        </td>
                                        <td style={{ fontSize: '0.875rem' }}>{note.reason || 'N/A'}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span style={{
                                                padding: '0.25rem 0.75rem',
                                                borderRadius: '12px',
                                                fontSize: '0.75rem',
                                                fontWeight: '600',
                                                textTransform: 'uppercase',
                                                color: 'var(--success)',
                                                border: '1px solid var(--success)'
                                            }}>
                                                {note.status}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <CreditNotePrintButton creditNoteId={note.id} />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {result && result.totalPages > 1 && (
                    <Pagination
                        currentPage={page}
                        totalPages={result.totalPages}
                        onPageChange={setPage}
                        totalItems={result.total}
                        pageSize={pageSize}
                    />
                )}
            </div>

            {/* Summary Stats */}
            {result && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                    <StatCard
                        title="Total Credit Notes"
                        value={result.summary.totalCount}
                        subtitle="Total count in system"
                        icon={CreditCard}
                        variant="indigo"
                    />
                    <StatCard
                        title="Sales Returns"
                        value={result.summary.salesReturnsCount}
                        subtitle="Customer returns handled"
                        icon={ShoppingCart}
                        variant="red"
                    />
                    <StatCard
                        title="Purchase Returns"
                        value={result.summary.purchaseReturnsCount}
                        subtitle="Returns to suppliers"
                        icon={ArrowLeftRight}
                        variant="blue"
                    />
                    <StatCard
                        title="Total Returns Value"
                        value={formatCurrency(result.summary.totalValue)}
                        subtitle="Aggregated amount"
                        icon={TrendingUp}
                        variant="purple"
                    />
                </div>
            )}
        </div>
    );
}
