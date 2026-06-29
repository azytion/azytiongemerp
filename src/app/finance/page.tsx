'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Book, BookOpen, FileText, TrendingDown, Wallet } from 'lucide-react';
import DaybookTab from './components/DaybookTab';
import LedgerTab from './components/LedgerTab';
import ChequesTab from './components/ChequesTab';
import CreditNotesTab from './components/CreditNotesTab';
import ReportsTab from './components/ReportsTab';
import AccountsTab from './components/AccountsTab';

export default function FinancePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    type FinanceTab = 'daybook' | 'accounts' | 'ledger' | 'cheques' | 'credit-notes' | 'reports';
    const FINANCE_TABS: FinanceTab[] = ['daybook', 'accounts', 'ledger', 'cheques', 'credit-notes', 'reports'];
    const tabParam = searchParams.get('tab');
    const activeTab: FinanceTab = tabParam && FINANCE_TABS.includes(tabParam as FinanceTab)
        ? (tabParam as FinanceTab)
        : 'daybook';

    const handleTabChange = (tabId: FinanceTab) => {
        router.push(`/finance?tab=${tabId}`, { scroll: false });
    };

    const tabs = [
        { id: 'daybook' as const,      label: 'Daybook',      icon: Book },
        { id: 'accounts' as const,     label: 'Accounts',     icon: Wallet },
        { id: 'ledger' as const,       label: 'Ledger',       icon: BookOpen },
        { id: 'cheques' as const,      label: 'Cheques',      icon: FileText },
        { id: 'credit-notes' as const, label: 'Credit Notes', icon: TrendingDown },
        { id: 'reports' as const,      label: 'Reports',      icon: FileText },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fade-in">
            <header className="page-header">
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                        <div style={{ width: 36, height: 36, background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Book size={18} color="var(--primary)" />
                        </div>
                        <h1 className="page-title">Finance</h1>
                    </div>
                    <p className="page-subtitle">Manage financial records, ledger, and transactions</p>
                </div>
            </header>

            {/* Tabs */}
            <div className="page-tabs">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id)}
                            className={`page-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                        >
                            <Icon size={16} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <div>
                {activeTab === 'daybook' && <DaybookTab />}
                {activeTab === 'accounts' && <AccountsTab />}
                {activeTab === 'ledger' && <LedgerTab />}
                {activeTab === 'cheques' && <ChequesTab />}
                {activeTab === 'credit-notes' && <CreditNotesTab />}
                {activeTab === 'reports' && <ReportsTab />}
            </div>
        </div>
    );
}
