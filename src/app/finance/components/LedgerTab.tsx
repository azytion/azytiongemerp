'use client';

import { useCallback, useState } from 'react';
import { useLoadEffect } from '@/hooks/useLoadEffect';
import { getAccounts, getTrialBalance } from '@/app/actions/ledger';
import { formatCurrency } from '@/lib/utils';
import { StatCard } from '@/components/ui/StatCard';
import { Plus, TrendingUp, TrendingDown, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import LedgerPrintButton from './LedgerPrintButton';

import { PaginatedResult } from '@/app/actions/types';
import { Pagination } from '@/components/ui/Pagination';

export default function LedgerTab() {
    const [result, setResult] = useState<PaginatedResult<any> | null>(null);
    const [trialBalance, setTrialBalance] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const pageSize = 20;

    const loadData = useCallback(async () => {
        setLoading(true);
        const [accountsResult, tbData] = await Promise.all([
            getAccounts(page, pageSize),
            getTrialBalance()
        ]);

        setResult(accountsResult);
        setTrialBalance(tbData);
        setLoading(false);
    }, [page, pageSize]);

    useLoadEffect(() => loadData(), [loadData]);

    const accounts = result?.data || [];

    if (loading) {
        return <div style={{ padding: '2rem' }}>Loading...</div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                        Ledger & Accounting
                    </h2>
                    <p style={{ color: 'var(--muted)' }}>Chart of accounts and trial balance</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {trialBalance && accounts.length > 0 && (
                        <LedgerPrintButton
                            accountName="Trial Balance"
                            accountCode="ALL"
                            startDate=""
                            endDate={(() => { const _d = new Date(); return _d.getFullYear() + "-" + String(_d.getMonth()+1).padStart(2,"0") + "-" + String(_d.getDate()).padStart(2,"0"); })()}
                            entries={accounts.map(acc => ({
                                date: (() => { const _d = new Date(); return _d.getFullYear() + "-" + String(_d.getMonth()+1).padStart(2,"0") + "-" + String(_d.getDate()).padStart(2,"0"); })(),
                                description: acc.account_name,
                                reference: acc.account_code,
                                debit: acc.balance >= 0 ? acc.balance : 0,
                                credit: acc.balance < 0 ? Math.abs(acc.balance) : 0,
                                balance: acc.balance
                            }))}
                            openingBalance={0}
                            closingBalance={trialBalance.totalDebits - trialBalance.totalCredits}
                        />
                    )}
                    <Link href="/ledger/journal" className="btn btn-primary">
                        <Plus size={20} />
                        New Journal Entry
                    </Link>
                </div>
            </header>

            {/* Trial Balance Summary */}
            {trialBalance && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                    <StatCard
                        title="Total Debits"
                        value={formatCurrency(trialBalance.totalDebits)}
                        icon={TrendingUp}
                        variant="red"
                        subtitle="Total incoming entries"
                    />
                    <StatCard
                        title="Total Credits"
                        value={formatCurrency(trialBalance.totalCredits)}
                        icon={TrendingDown}
                        variant="green"
                        subtitle="Total outgoing entries"
                    />
                    <StatCard
                        title="Balance Status"
                        value={Math.abs(trialBalance.totalDebits - trialBalance.totalCredits) < 0.01 ? 'Balanced' : 'Unbalanced'}
                        icon={Math.abs(trialBalance.totalDebits - trialBalance.totalCredits) < 0.01 ? CheckCircle : XCircle}
                        variant="purple"
                        trend={Math.abs(trialBalance.totalDebits - trialBalance.totalCredits) >= 0.01 ? `Diff: ${formatCurrency(Math.abs(trialBalance.totalDebits - trialBalance.totalCredits))}` : undefined}
                        trendIcon={Math.abs(trialBalance.totalDebits - trialBalance.totalCredits) < 0.01 ? CheckCircle : XCircle}
                    />
                </div>
            )}

            {/* Chart of Accounts */}
            <div className="card table-wrapper" style={{ overflowX: 'auto' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', padding: '1rem', borderBottom: '1px solid var(--border)' }}>
                    Chart of Accounts
                </h3>
                <table style={{ minWidth: '360px' }}>
                    <thead>
                        <tr>
                            <th style={{ whiteSpace: 'nowrap' }}>Code</th>
                            <th>Account Name</th>
                            <th>Type</th>
                            <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {accounts.length === 0 ? (
                            <tr>
                                <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
                                    No accounts found. Initializing default chart of accounts...
                                </td>
                            </tr>
                        ) : (
                            accounts.map((account) => (
                                <tr key={account.id}>
                                    <td style={{ fontFamily: 'monospace', fontWeight: '500', whiteSpace: 'nowrap' }}>{account.account_code}</td>
                                    <td>{account.account_name}</td>
                                    <td>
                                        <span style={{
                                            padding: '0.2rem 0.5rem',
                                            borderRadius: '12px',
                                            fontSize: '0.7rem',
                                            fontWeight: '600',
                                            textTransform: 'uppercase',
                                            whiteSpace: 'nowrap',
                                            color: 'var(--primary)',
                                            border: '1px solid var(--primary)'
                                        }}>
                                            {account.account_type}
                                        </span>
                                    </td>
                                    <td style={{
                                        textAlign: 'right',
                                        fontWeight: '500',
                                        whiteSpace: 'nowrap',
                                        color: account.balance >= 0 ? 'var(--success)' : 'var(--destructive)'
                                    }}>
                                        {formatCurrency(Math.abs(account.balance))} {account.balance < 0 ? 'CR' : 'DR'}
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
    );
}


