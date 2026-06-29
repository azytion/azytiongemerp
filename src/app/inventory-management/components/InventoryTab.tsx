'use client';

import { useCallback, useState } from 'react';
import { useLoadEffect } from '@/hooks/useLoadEffect';
import { getAdjustments } from '@/app/actions/inventory';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';

import { PaginatedResult } from '@/app/actions/types';
import { Pagination } from '@/components/ui/Pagination';

export default function InventoryTab() {
    const [result, setResult] = useState<PaginatedResult<any> | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const pageSize = 15;

    const loadData = useCallback(async () => {
        setLoading(true);
        const data = await getAdjustments(page, pageSize);
        setResult(data);
        setLoading(false);
    }, [page, pageSize]);

    useLoadEffect(() => loadData(), [loadData]);

    if (loading) {
        return <div style={{ padding: '2rem' }}>Loading...</div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <header style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '1rem'
            }}>
                <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Inventory Adjustments</h2>
                    <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Track manual stock changes, damages, and corrections</p>
                </div>
                <Link href="/inventory/new" className="btn btn-primary">
                    <Plus size={18} />
                    New Adjustment
                </Link>
            </header>

            <div className="card" style={{ padding: '1rem' }}>
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Product</th>
                                <th>Type</th>
                                <th>Reason</th>
                                <th style={{ textAlign: 'center' }}>Qty Change</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!result || result.data.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
                                        No adjustments recorded.
                                    </td>
                                </tr>
                            ) : (
                                result.data.map((adj: any) => (
                                    <tr key={adj.id}>
                                        <td style={{ fontSize: '0.875rem' }}>{formatDate(adj.date)}</td>
                                        <td style={{ fontWeight: 500 }}>{adj.product_name}</td>
                                        <td>
                                            <span style={{
                                                textTransform: 'capitalize',
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '4px',
                                                fontSize: '0.75rem',
                                                background: 'var(--secondary)',
                                                fontWeight: 600
                                            }}>
                                                {adj.adjustment_type}
                                            </span>
                                        </td>
                                        <td style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>{adj.reason || '-'}</td>
                                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: adj.quantity > 0 ? 'var(--primary)' : 'var(--destructive)' }}>
                                            {adj.quantity > 0 ? '+' : ''}{adj.quantity}
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
        </div>
    );
}
