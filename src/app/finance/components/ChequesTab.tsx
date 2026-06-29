'use client';

/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from 'react';
import { getCheques, getChequeStats, updateChequeStatus } from '@/app/actions/cheques';
import { formatDate, formatCurrency } from '@/lib/utils';
import { StatCard } from '@/components/ui/StatCard';
import { FileText, Plus, AlertCircle, CheckCircle, XCircle, Download } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ConfirmDialog';
import ChequeDetailModal from '@/components/ChequeDetailModal';
import ChequePrintButton from './ChequePrintButton';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import StaleBanner from '@/components/StaleBanner';
import { useLoadEffect } from '@/hooks/useLoadEffect';

import { useSidebar } from '@/components/SidebarProvider';

import { Pagination } from '@/components/ui/Pagination';

export default function ChequesTab() {
    const isOnline = useOnlineStatus();
    const { isMobile } = useSidebar();
    const [result, setResult] = useState<any>(null);
    const [stats, setStats] = useState<any>(null);
    const [filter, setFilter] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [isStale, setIsStale] = useState(false);
    const [page, setPage] = useState(1);
    const pageSize = 50;
    const [selectedChequeId, setSelectedChequeId] = useState<number | null>(null);
    const { confirm } = useConfirm();

    const loadData = useCallback(async (targetPage: number = page) => {
        setLoading(true);
        if (isOnline) {
            try {
                const [chequesResult, statsData] = await Promise.all([
                    getCheques(filter || undefined, targetPage, pageSize),
                    getChequeStats()
                ]);
                setResult(chequesResult);
                setStats(statsData);
                setIsStale(false);
            } catch {
                setIsStale(true);
                toast.error('Unable to load cheques — showing cached data');
            }
        } else {
            setIsStale(true);
            setResult((prev: typeof result) => prev ?? { data: [], total: 0, page: 1, pageSize, totalPages: 0 });
        }
        setLoading(false);
    }, [filter, isOnline, page, pageSize]);

    useEffect(() => { setPage(1); }, [filter, searchTerm, startDate, endDate, isOnline]);
    useLoadEffect(() => loadData(1), [filter, searchTerm, startDate, endDate, isOnline, loadData]);
    useLoadEffect(() => { if (page !== 1) loadData(page); }, [page, loadData]);

    const cheques = result?.data || [];

    async function handleStatusChange(id: number, status: string) {
        const clearedDate = status === 'cleared' ? (() => { const _d = new Date(); return _d.getFullYear() + "-" + String(_d.getMonth()+1).padStart(2,"0") + "-" + String(_d.getDate()).padStart(2,"0"); })() : undefined;
        const result = await updateChequeStatus(id, status as any, clearedDate);
        if (result.success) {
            loadData();
            toast.success(`Cheque marked as ${status}`);
        } else {
            toast.error(`Error: ${result.error}`);
        }
    }

    function exportToCSV() {
        // Prepare CSV data
        const headers = ['Cheque Number', 'Bank Name', 'Payee', 'Amount', 'Issue Date', 'Due Date', 'Status', 'Cleared Date', 'Notes'];
        const rows = cheques.map((c: any) => [
            c.cheque_number,
            c.bank_name,
            c.payee_name || '',
            c.amount,
            c.issue_date,
            c.due_date,
            c.status,
            c.cleared_date || '',
            c.notes || ''
        ]);

        // Create CSV content
        const csvContent = [
            headers.join(','),
            ...rows.map((row: any) => row.map((cell: any) => {
                // Escape commas and quotes in cell values
                const cellStr = String(cell);
                if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                    return `"${cellStr.replace(/"/g, '""')}"`;
                }
                return cellStr;
            }).join(','))
        ].join('\n');

        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `cheques_export_${(() => { const _d = new Date(); return _d.getFullYear() + "-" + String(_d.getMonth()+1).padStart(2,"0") + "-" + String(_d.getDate()).padStart(2,"0"); })()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success(`Exported ${cheques.length} cheque${cheques.length !== 1 ? 's' : ''} to CSV`);
    }

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

    if (loading) {
        return <div style={{ padding: '2rem' }}>Loading...</div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {isStale && <StaleBanner message="Cheques require a connection to load" onRefresh={() => loadData(page)} refreshing={loading} />}
            <header style={{ 
                display: 'flex', 
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between', 
                alignItems: isMobile ? 'flex-start' : 'center',
                gap: '1rem'
            }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                        Cheque Management
                    </h2>
                    <p style={{ color: 'var(--muted)' }}>Track post-dated cheques and payment status</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', width: isMobile ? '100%' : 'auto' }}>
                    <button
                        onClick={exportToCSV}
                        className="btn btn-outline"
                        disabled={cheques.length === 0}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: isMobile ? 1 : 'none', justifyContent: 'center' }}
                    >
                        <Download size={20} />
                        {isMobile ? 'Export' : 'Export CSV'}
                    </button>
                    <Link href="/cheques/new" className="btn btn-primary" style={{ flex: isMobile ? 1 : 'none', justifyContent: 'center' }}>
                        <Plus size={20} />
                        Add Cheque
                    </Link>
                </div>
            </header>

            {/* Stats */}
            {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                    <StatCard
                        title="Total Cheques"
                        value={stats.total_cheques}
                        icon={FileText}
                        variant="blue"
                        subtitle="All time entries"
                    />
                    <StatCard
                        title="Pending"
                        value={stats.pending}
                        icon={AlertCircle}
                        variant="orange"
                        subtitle={stats.pending_amount ? formatCurrency(stats.pending_amount) : formatCurrency(0)}
                    />
                    <StatCard
                        title="Cleared"
                        value={stats.cleared}
                        icon={CheckCircle}
                        variant="green"
                        subtitle={stats.cleared_amount ? formatCurrency(stats.cleared_amount) : formatCurrency(0)}
                    />
                    <StatCard
                        title="Bounced"
                        value={stats.bounced}
                        icon={XCircle}
                        variant="red"
                        subtitle="Action Required"
                    />
                </div>
            )}

            {/* Search and Date Range Filters */}
            <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', display: 'block' }}>
                            Search
                        </label>
                        <input
                            type="text"
                            placeholder="Cheque #, Bank, or Payee..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input"
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', display: 'block' }}>
                            From Date
                        </label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="input"
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', display: 'block' }}>
                            To Date
                        </label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="input"
                            style={{ width: '100%' }}
                        />
                    </div>
                </div>
                {(searchTerm || startDate || endDate) && (
                    <button
                        onClick={() => {
                            setSearchTerm('');
                            setStartDate('');
                            setEndDate('');
                        }}
                        className="btn btn-outline"
                        style={{ alignSelf: 'flex-start', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                    >
                        Clear Filters
                    </button>
                )}
            </div>

            {/* Status Filters */}
            <div className="card" style={{ padding: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                    onClick={() => setFilter('')}
                    className={!filter ? 'btn btn-primary' : 'btn btn-outline'}
                    style={{ padding: '0.5rem 1rem' }}
                >
                    All
                </button>
                <button
                    onClick={() => setFilter('pending')}
                    className={filter === 'pending' ? 'btn btn-primary' : 'btn btn-outline'}
                    style={{ padding: '0.5rem 1rem' }}
                >
                    Pending
                </button>
                <button
                    onClick={() => setFilter('cleared')}
                    className={filter === 'cleared' ? 'btn btn-primary' : 'btn btn-outline'}
                    style={{ padding: '0.5rem 1rem' }}
                >
                    Cleared
                </button>
                <button
                    onClick={() => setFilter('bounced')}
                    className={filter === 'bounced' ? 'btn btn-primary' : 'btn btn-outline'}
                    style={{ padding: '0.5rem 1rem' }}
                >
                    Bounced
                </button>
            </div>



            {/* Cheques Table */}
            <div className="card table-wrapper" style={{ overflowX: 'auto' }}>
                <style>{`
                    @media (max-width: 640px) {
                        .cheques-col-payee,
                        .cheques-col-issue { display: none; }
                    }
                `}</style>
                <table>
                    <thead>
                        <tr>
                            <th>Cheque #</th>
                            <th>Bank</th>
                            <th className="cheques-col-payee">Payee</th>
                            <th style={{ textAlign: 'right' }}>Amount</th>
                            <th className="cheques-col-issue">Issue Date</th>
                            <th>Due Date</th>
                            <th style={{ textAlign: 'center' }}>Status</th>
                            <th style={{ textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cheques.length === 0 ? (
                            <tr>
                                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
                                    No cheques found
                                </td>
                            </tr>
                        ) : (
                            cheques.map((cheque: any) => (
                                <tr
                                    key={cheque.id}
                                    style={{ transition: 'background-color 0.2s' }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--secondary)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                    <td
                                        style={{ fontWeight: '500', cursor: 'pointer' }}
                                        onClick={() => setSelectedChequeId(cheque.id)}
                                    >
                                        {cheque.cheque_number}
                                    </td>
                                    <td onClick={() => setSelectedChequeId(cheque.id)} style={{ cursor: 'pointer' }}>
                                        {cheque.bank_name}
                                    </td>
                                    <td className="cheques-col-payee" onClick={() => setSelectedChequeId(cheque.id)} style={{ cursor: 'pointer' }}>
                                        {cheque.payee_name || 'N/A'}
                                    </td>
                                    <td onClick={() => setSelectedChequeId(cheque.id)} style={{ textAlign: 'right', fontWeight: '500', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                        {formatCurrency(cheque.amount)}
                                    </td>
                                    <td className="cheques-col-issue" onClick={() => setSelectedChequeId(cheque.id)} style={{ fontSize: '0.875rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                        {formatDate(cheque.issue_date)}
                                    </td>
                                    <td onClick={() => setSelectedChequeId(cheque.id)} style={{ fontSize: '0.875rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                        {formatDate(cheque.due_date)}
                                        {new Date(cheque.due_date) < new Date() && cheque.status === 'pending' && (
                                            <span style={{ color: 'var(--destructive)', marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                                                (Overdue)
                                            </span>
                                        )}
                                    </td>
                                    <td onClick={() => setSelectedChequeId(cheque.id)} style={{ textAlign: 'center', cursor: 'pointer' }}>
                                        <span style={{
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '12px',
                                            fontSize: '0.75rem',
                                            fontWeight: '600',
                                            textTransform: 'uppercase',
                                            color: getStatusColor(cheque.status),
                                            border: `1px solid ${getStatusColor(cheque.status)}`,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.25rem',
                                            whiteSpace: 'nowrap',
                                        }}>
                                            {getStatusIcon(cheque.status)}
                                            {cheque.status}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
                                            <ChequePrintButton cheque={cheque} />
                                            {cheque.status === 'pending' && (
                                                <select
                                                    className="input"
                                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', minWidth: '120px' }}
                                                    onChange={async (e) => {
                                                        const val = e.target.value;
                                                        if (val) {
                                                            const userConfirmed = await confirm({
                                                                title: 'Update Cheque Status',
                                                                message: `Mark cheque as ${val}?`,
                                                                type: val === 'bounced' ? 'danger' : 'warning'
                                                            });
                                                            if (userConfirmed) {
                                                                handleStatusChange(cheque.id, val);
                                                            }
                                                        }
                                                        e.target.value = '';
                                                    }}
                                                >
                                                    <option value="">Update</option>
                                                    <option value="cleared">Cleared</option>
                                                    <option value="bounced">Bounced</option>
                                                    <option value="cancelled">Cancel</option>
                                                </select>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

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

            {/* Cheque Detail Modal */}
            {selectedChequeId && (
                <ChequeDetailModal
                    chequeId={selectedChequeId}
                    onClose={() => setSelectedChequeId(null)}
                />
            )}
        </div>
    );
}

