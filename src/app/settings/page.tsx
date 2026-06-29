'use client';

import { useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSettings } from '@/app/actions/settings';
import { getSession } from '@/app/actions/auth';
import { useLoadEffect } from '@/hooks/useLoadEffect';
import CompanySettings from './components/CompanySettings';
import TaxSettings from './components/TaxSettings';
import SystemSettings from './components/SystemSettings';
import EmailSettings from './components/EmailSettings';
import UsersSettings from './components/UsersSettings';
import BarcodesSettings from './components/BarcodesSettings';
import HardwareSettings from './components/HardwareSettings';
import POSSettings from './components/POSSettings';
import ActivityLogSettings from './components/ActivityLogSettings';
import FeatureSettings from './components/FeatureSettings';
import dynamic from 'next/dynamic';

const DataManagementTab = dynamic(() => import('./components/DataManagementTab'), {
  loading: () => (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
      <Loader2 size={24} className="animate-spin" color="var(--primary)" />
    </div>
  ),
  ssr: false
});

const PWASettings = dynamic(() => import('./components/PWASettings'), {
  loading: () => (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
      <Loader2 size={24} className="animate-spin" color="var(--primary)" />
    </div>
  ),
  ssr: false
});
import {
  Building2, Receipt, Settings as SettingsIcon, Mail, Users, Barcode,
  Database, FileText, Monitor, ShieldAlert, Loader2, Smartphone
} from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  type SettingsTab = 'company' | 'tax' | 'system' | 'notification' | 'users' | 'barcodes' | 'hardware' | 'data' | 'logs' | 'pos' | 'features' | 'pwa';
  const SETTINGS_TABS: SettingsTab[] = ['company', 'tax', 'system', 'notification', 'users', 'barcodes', 'hardware', 'data', 'logs', 'pos', 'features', 'pwa'];
  const tabParam = searchParams.get('tab');
  const activeTab: SettingsTab = tabParam && SETTINGS_TABS.includes(tabParam as SettingsTab)
    ? (tabParam as SettingsTab)
    : 'company';
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const handleTabChange = (tabId: SettingsTab) => {
    router.replace(`/settings?tab=${tabId}`, { scroll: false });
  };

  const loadData = useCallback(async () => {
    try {
        const [settingsData, sessionData] = await Promise.all([getSettings(), getSession()]);
        setSettings(settingsData);
        setSession(sessionData);
    } catch {
        // Offline fallback — load settings from IndexedDB cache
        try {
            const { localDB } = await import('@/lib/db/LocalDB');
            const cached = await localDB.settings.toArray();
            const settingsObj: Record<string, string> = {};
            cached.forEach(s => { settingsObj[s.key] = s.value; });
            if (Object.keys(settingsObj).length > 0) setSettings(settingsObj);
        } catch { /* ignore */ }
        const sessionData = await getSession().catch(() => null);
        setSession(sessionData);
    }
    setLoading(false);
  }, []);

  useLoadEffect(() => loadData(), [loadData]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <Loader2 size={32} className="animate-spin" color="var(--primary)" />
      </div>
    );
  }

  const isSuperAdmin = session?.role === 'super_admin';

  const allTabs = [
    { id: 'features' as const, label: 'Features', icon: ShieldAlert, roles: ['super_admin'] },
    { id: 'company' as const, label: 'Company', icon: Building2 },
    { id: 'pos' as const, label: 'POS', icon: Monitor },
    { id: 'tax' as const, label: 'Tax', icon: Receipt },
    { id: 'system' as const, label: 'System', icon: SettingsIcon },
    { id: 'notification' as const, label: 'Communication', icon: Mail },
    { id: 'users' as const, label: 'Users', icon: Users },
    { id: 'barcodes' as const, label: 'Barcodes', icon: Barcode },
    { id: 'hardware' as const, label: 'Hardware', icon: Monitor },
    { id: 'data' as const, label: 'Data Mgmt', icon: Database },
    { id: 'logs' as const, label: 'Activity Log', icon: FileText },
    { id: 'pwa' as const, label: 'PWA & Offline', icon: Smartphone },
  ];

  const tabs = allTabs.filter(tab => {
    if ((tab as any).roles && !(tab as any).roles.includes(session?.role)) return false;
    if (!isSuperAdmin) {
      if (tab.id === 'features') return false;
      if (tab.id === 'company' && settings.feature_company_enabled === 'false') return false;
      if (tab.id === 'notification' && settings.feature_notification_enabled === 'false') return false;
      if (tab.id === 'barcodes' && settings.feature_barcodes_enabled === 'false') return false;
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }} className="animate-fade-in">
      {/* Header */}
      <header className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <div style={{
              width: 36, height: 36,
              background: 'rgba(100,116,139,0.1)',
              border: '1px solid rgba(100,116,139,0.2)',
              borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <SettingsIcon size={18} color="var(--muted-foreground)" />
            </div>
            <h1 className="page-title">Settings</h1>
          </div>
          <p className="page-subtitle">Configure your POS system preferences</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="page-tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id as any)}
              className={`page-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="card" style={{ padding: '1.5rem' }}>
        {activeTab === 'features' && <FeatureSettings settings={settings} />}
        {activeTab === 'company' && <CompanySettings settings={settings} isSuperAdmin={isSuperAdmin} />}
        {activeTab === 'pos' && <POSSettings settings={settings} />}
        {activeTab === 'tax' && <TaxSettings settings={settings} />}
        {activeTab === 'system' && <SystemSettings settings={settings} />}
        {activeTab === 'notification' && <EmailSettings settings={settings} isSuperAdmin={isSuperAdmin} />}
        {activeTab === 'users' && <UsersSettings />}
        {activeTab === 'barcodes' && <BarcodesSettings />}
        {activeTab === 'hardware' && <HardwareSettings settings={settings} />}
        {activeTab === 'data' && <DataManagementTab />}
        {activeTab === 'logs' && <ActivityLogSettings />}
        {activeTab === 'pwa' && <PWASettings />}
      </div>
    </div>
  );
}
