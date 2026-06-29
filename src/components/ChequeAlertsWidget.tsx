'use client';

import { useEffect, useState } from 'react';
import { getCheques } from '@/app/actions/cheques';
import { formatCurrency } from '@/lib/utils';
import { FileText, AlertCircle, CheckCircle } from 'lucide-react';

export default function ChequeAlertsWidget() {
    const [cheques, setCheques] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            // Fetch all pending cheques for the dashboard widget
            // We pass a large pageSize to get all relevant cheques for the alert
            const result = await getCheques('pending', 1, 100);
            setCheques(result.data);
        } catch (error) {
            console.error('Error loading cheques for dashboard:', error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) return null;

    const today = new Date();
    const pendingCheques = cheques.filter(c => c.status === 'pending');
    const overdueCount = pendingCheques.filter(c => new Date(c.due_date) < today).length;
    const upcomingCount = pendingCheques.length - overdueCount;
    const pendingAmount = pendingCheques.reduce((sum, c) => sum + c.amount, 0);

    if (pendingCheques.length === 0) return null;

    return (
        <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText size={20} style={{ color: 'var(--primary)' }} />
                    Cheque Overview
                </h3>
                <a href="/finance" style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>Manage</a>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ padding: '1rem', backgroundColor: 'var(--secondary)', borderRadius: 'var(--radius)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>Pending Total</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary)' }}>{formatCurrency(pendingAmount)}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.25rem' }}>{pendingCheques.length} Cheques</div>
                </div>

                <div style={{
                    padding: '1rem',
                    backgroundColor: overdueCount > 0 ? '#fef2f2' : 'var(--secondary)',
                    borderRadius: 'var(--radius)',
                    border: overdueCount > 0 ? '1px solid #fee2e2' : 'none'
                }}>
                    <div style={{
                        fontSize: '0.75rem',
                        color: overdueCount > 0 ? '#991b1b' : 'var(--muted)',
                        marginBottom: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                    }}>
                        {overdueCount > 0 ? <AlertCircle size={12} /> : <CheckCircle size={12} />}
                        Status
                    </div>
                    <div style={{
                        fontSize: '1.25rem',
                        fontWeight: 'bold',
                        color: overdueCount > 0 ? '#dc2626' : 'var(--success)'
                    }}>
                        {overdueCount > 0 ? `${overdueCount} Overdue` : 'All On Track'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                        {upcomingCount} Upcoming
                    </div>
                </div>
            </div>

            {overdueCount > 0 && (
                <div style={{
                    marginTop: '1rem',
                    padding: '0.75rem',
                    backgroundColor: '#fff7ed',
                    border: '1px solid #ffedd5',
                    borderRadius: '0.5rem',
                    fontSize: '0.75rem',
                    color: '#9a3412',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <AlertCircle size={14} />
                    <span>Critical: Some cheques are past their due date!</span>
                </div>
            )}
        </div>
    );
}
