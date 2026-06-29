'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users, Truck, Users2, TrendingDown } from 'lucide-react';
import SuppliersTab from '@/app/inventory-management/components/SuppliersTab';
import BrokersContactTab from './components/BrokersContactTab';
import CustomersContactTab from './components/CustomersContactTab';
import AgingContactTab from './components/AgingContactTab';

type TabId = 'customers' | 'suppliers' | 'brokers' | 'aging';
const VALID_TABS: TabId[] = ['customers', 'suppliers', 'brokers', 'aging'];

function ContactsPageInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const tabParam = searchParams.get('tab') as TabId | null;
    const activeTab: TabId = tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'customers';

    function handleTabChange(tab: TabId) {
        router.push(`/contacts?tab=${tab}`, { scroll: false });
    }

    const tabs = [
        { id: 'customers' as const, label: 'Customers',    icon: Users },
        { id: 'suppliers' as const, label: 'Suppliers',    icon: Truck },
        { id: 'brokers'   as const, label: 'Brokers',      icon: Users2 },
        { id: 'aging'     as const, label: 'Aging Report', icon: TrendingDown },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fade-in">
            <header className="page-header">
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                        <div style={{ width: 36, height: 36, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Users size={18} color="var(--info)" />
                        </div>
                        <h1 className="page-title">Contacts</h1>
                    </div>
                    <p className="page-subtitle">Manage customers, suppliers, and brokers in one place</p>
                </div>
            </header>

            <div className="page-tabs">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id)}
                            className={`page-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                        >
                            <Icon size={15} /> {tab.label}
                        </button>
                    );
                })}
            </div>

            {activeTab === 'customers' && <CustomersContactTab />}
            {activeTab === 'suppliers' && <SuppliersTab />}
            {activeTab === 'brokers'   && <BrokersContactTab />}
            {activeTab === 'aging'     && <AgingContactTab />}
        </div>
    );
}

export default function ContactsPage() {
    return (
        <Suspense>
            <ContactsPageInner />
        </Suspense>
    );
}
