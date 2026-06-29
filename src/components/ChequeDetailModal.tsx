'use client';

/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from 'react';
import { getCheque, getChequeHistory, type Cheque, type ChequeHistory } from '@/app/actions/cheques';
import { formatDate, formatCurrency } from '@/lib/utils';
import { X, Clock, User, FileText, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface ChequeDetailModalProps {
    chequeId: number;
    onClose: () => void;
}

export default function ChequeDetailModal({ chequeId, onClose }: ChequeDetailModalProps) {
    const [cheque, setCheque] = useState<Cheque | null>(null);
    const [history, setHistory] = useState<ChequeHistory[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        setLoading(true);
        const [chequeData, historyData] = await Promise.all([
            getCheque(chequeId),
            getChequeHistory(chequeId)
        ]);
        setCheque(chequeData);
        setHistory(historyData);
        setLoading(false);
    }, [chequeId]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'var(--warning)';
            case 'cleared': return 'var(--success)';
            case 'bounced': return 'var(--destructive)';
            case 'cancelled': return 'var(--muted)';
            default: return 'var(--foreground)';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending': return <AlertCircle size={16} />;
            case 'cleared': return <CheckCircle size={16} />;
            case 'bounced': return <XCircle size={16} />;
            default: return <FileText size={16} />;
        }
    };

    const getActionIcon = (action: string) => {
        switch (action) {
            case 'created': return <FileText size={16} />;
            case 'status_change': return <Clock size={16} />;
            case 'deleted': return <XCircle size={16} />;
            default: return <FileText size={16} />;
        }
    };

    if (loading) {
        return (
            <div className="modal-blur-overlay" style={{ zIndex: 1000 }}>
                <div className="card" style={{ padding: '2rem', minWidth: '300px' }}>
                    Loading...
                </div>
            </div>
        );
    }

    if (!cheque) {
        return null;
    }

    return (
        <div
            className="modal-blur-overlay"
            style={{ zIndex: 1000 }}
            onClick={onClose}
        >
            <div
                className="card"
                style={{
                    maxWidth: '800px',
                    width: '100%',
                    maxHeight: '90dvh',
                    overflow: 'auto',
                    padding: 0,
                    margin: '0 0.75rem',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    padding: '1rem 1.25rem',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    position: 'sticky',
                    top: 0,
                    backgroundColor: 'var(--surface)',
                    zIndex: 1
                }}>
                    <div>
                        <h2 style={{ fontSize: 'clamp(1.125rem, 4vw, 1.5rem)', fontWeight: 'bold', margin: 0 }}>
                            Cheque Details
                        </h2>
                        <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                            {cheque.cheque_number}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="btn btn-outline"
                        style={{ padding: '0.5rem', borderRadius: '50%', flexShrink: 0 }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: 'clamp(1rem, 4vw, 2rem)' }}>
                    {/* Cheque Information */}
                    <div style={{ marginBottom: '2rem' }}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>
                            Cheque Information
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: '600' }}>
                                    Cheque Number
                                </label>
                                <p style={{ fontSize: '1rem', fontWeight: '500', marginTop: '0.25rem' }}>
                                    {cheque.cheque_number}
                                </p>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: '600' }}>
                                    Bank Name
                                </label>
                                <p style={{ fontSize: '1rem', fontWeight: '500', marginTop: '0.25rem' }}>
                                    {cheque.bank_name}
                                </p>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: '600' }}>
                                    Amount
                                </label>
                                <p style={{ fontSize: '1.25rem', fontWeight: 'bold', marginTop: '0.25rem', color: 'var(--primary)' }}>
                                    {formatCurrency(cheque.amount)}
                                </p>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: '600' }}>
                                    Status
                                </label>
                                <div style={{ marginTop: '0.25rem' }}>
                                    <span style={{
                                        padding: '0.25rem 0.75rem',
                                        borderRadius: '12px',
                                        fontSize: '0.75rem',
                                        fontWeight: '600',
                                        textTransform: 'uppercase',
                                        color: getStatusColor(cheque.status),
                                        border: `1px solid ${getStatusColor(cheque.status)}`,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.25rem'
                                    }}>
                                        {getStatusIcon(cheque.status)}
                                        {cheque.status}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: '600' }}>
                                    Issue Date
                                </label>
                                <p style={{ fontSize: '1rem', marginTop: '0.25rem' }}>
                                    {formatDate(cheque.issue_date)}
                                </p>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: '600' }}>
                                    Due Date
                                </label>
                                <p style={{ fontSize: '1rem', marginTop: '0.25rem' }}>
                                    {formatDate(cheque.due_date)}
                                    {new Date(cheque.due_date) < new Date() && cheque.status === 'pending' && (
                                        <span style={{ color: 'var(--destructive)', marginLeft: '0.5rem', fontSize: '0.75rem', fontWeight: '600' }}>
                                            (OVERDUE)
                                        </span>
                                    )}
                                </p>
                            </div>
                            {cheque.payee_name && (
                                <div>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: '600' }}>
                                        Payee Name
                                    </label>
                                    <p style={{ fontSize: '1rem', marginTop: '0.25rem' }}>
                                        {cheque.payee_name}
                                    </p>
                                </div>
                            )}
                            {cheque.account_number && (
                                <div>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: '600' }}>
                                        Account Number
                                    </label>
                                    <p style={{ fontSize: '1rem', marginTop: '0.25rem' }}>
                                        {cheque.account_number}
                                    </p>
                                </div>
                            )}
                            {cheque.cleared_date && (
                                <div>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: '600' }}>
                                        Cleared Date
                                    </label>
                                    <p style={{ fontSize: '1rem', marginTop: '0.25rem' }}>
                                        {formatDate(cheque.cleared_date)}
                                    </p>
                                </div>
                            )}
                        </div>
                        {cheque.notes && (
                            <div style={{ marginTop: '1rem' }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: '600' }}>
                                    Notes
                                </label>
                                <p style={{ fontSize: '0.875rem', marginTop: '0.25rem', padding: '0.75rem', backgroundColor: 'var(--secondary)', borderRadius: '0.5rem' }}>
                                    {cheque.notes}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* History Timeline */}
                    <div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Clock size={20} />
                            History Timeline
                        </h3>
                        {history.length === 0 ? (
                            <p style={{ color: 'var(--muted)', fontSize: '0.875rem', textAlign: 'center', padding: '2rem' }}>
                                No history available
                            </p>
                        ) : (
                            <div style={{ position: 'relative', paddingLeft: '2rem' }}>
                                {/* Timeline line */}
                                <div style={{
                                    position: 'absolute',
                                    left: '0.5rem',
                                    top: '0.5rem',
                                    bottom: '0.5rem',
                                    width: '2px',
                                    backgroundColor: 'var(--border)'
                                }} />

                                {history.map((entry, _index) => (
                                    <div key={entry.id} style={{ position: 'relative', marginBottom: '1.5rem' }}>
                                        {/* Timeline dot */}
                                        <div style={{
                                            position: 'absolute',
                                            left: '-1.5rem',
                                            top: '0.25rem',
                                            width: '1rem',
                                            height: '1rem',
                                            borderRadius: '50%',
                                            backgroundColor: 'var(--primary)',
                                            border: '2px solid var(--surface)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'white',
                                            fontSize: '0.625rem'
                                        }}>
                                            {getActionIcon(entry.action)}
                                        </div>

                                        <div style={{
                                            padding: '0.75rem 1rem',
                                            backgroundColor: 'var(--secondary)',
                                            borderRadius: '0.5rem',
                                            borderLeft: '3px solid var(--primary)'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                                                <div>
                                                    <p style={{ fontWeight: '600', fontSize: '0.875rem', textTransform: 'capitalize' }}>
                                                        {entry.action.replace('_', ' ')}
                                                    </p>
                                                    {entry.notes && (
                                                        <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                                                            {entry.notes}
                                                        </p>
                                                    )}
                                                </div>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                                                    {formatDate(entry.timestamp)}
                                                </span>
                                            </div>
                                            {(entry.old_value || entry.new_value) && (
                                                <div style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
                                                    {entry.old_value && (
                                                        <div style={{ color: 'var(--destructive)' }}>
                                                            <strong>From:</strong> {entry.old_value}
                                                        </div>
                                                    )}
                                                    {entry.new_value && (
                                                        <div style={{ color: 'var(--success)' }}>
                                                            <strong>To:</strong> {entry.new_value}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {entry.username && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--muted)' }}>
                                                    <User size={12} />
                                                    {entry.username}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
