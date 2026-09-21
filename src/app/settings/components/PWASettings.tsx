'use client';

import { useState, useEffect } from 'react';
import { Smartphone, Download, Wifi, WifiOff, RefreshCw, CheckCircle2, Clock, Trash2, Database, CloudOff } from 'lucide-react';
import { toast } from 'sonner';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export default function PWASettings() {
    const isOnline = useOnlineStatus();

    // Install prompt state
    const [installPrompt, setInstallPrompt] = useState<any>(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [installing, setInstalling] = useState(false);

    // Cache / offline state
    const [pendingCount, setPendingCount] = useState(0);
    const [syncing, setSyncing] = useState(false);
    const [lastSynced, setLastSynced] = useState<string | null>(null);
    const [cacheStats, setCacheStats] = useState<{ products: number; customers: number; suppliers: number; sales: number } | null>(null);
    const [loadingStats, setLoadingStats] = useState(true);
    const [clearingCache, setClearingCache] = useState(false);
    const [rehydrating, setRehydrating] = useState(false);

    // SW update state
    const [swUpdateAvailable, setSwUpdateAvailable] = useState(false);

    useEffect(() => {
        // Check if already installed as PWA
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true);
        }

        // Capture install prompt
        const handler = (e: Event) => {
            e.preventDefault();
            setInstallPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);

        // Check for SW update
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistration().then(reg => {
                if (reg?.waiting) setSwUpdateAvailable(true);
                reg?.addEventListener('updatefound', () => {
                    reg.installing?.addEventListener('statechange', function () {
                        if (this.state === 'installed' && navigator.serviceWorker.controller) {
                            setSwUpdateAvailable(true);
                        }
                    });
                });
            });
        }

        loadStats();

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    async function loadStats() {
        setLoadingStats(true);
        try {
            const { localDB, getSyncMeta, getPendingWriteCount } = await import('@/lib/db/LocalDB');
            const [products, customers, suppliers, sales, pending, ts] = await Promise.all([
                localDB.products.count(),
                localDB.customers.count(),
                localDB.suppliers.count(),
                localDB.sales.count(),
                getPendingWriteCount(),
                getSyncMeta('last_synced_at'),
            ]);
            setCacheStats({ products, customers, suppliers, sales });
            setPendingCount(pending);
            setLastSynced(ts);
        } catch { /* IndexedDB not available */ }
        setLoadingStats(false);
    }

    async function handleInstall() {
        if (!installPrompt) return;
        setInstalling(true);
        await installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        if (outcome === 'accepted') {
            setIsInstalled(true);
            setInstallPrompt(null);
            toast.success('Azytion GemERP installed successfully!');
        }
        setInstalling(false);
    }

    async function handleSyncNow() {
        if (!isOnline) { toast.error('No internet connection'); return; }
        setSyncing(true);
        try {
            // Trigger the global sync via a custom event
            window.dispatchEvent(new Event('online'));
            await new Promise(r => setTimeout(r, 2000));
            await loadStats();
            toast.success('Sync triggered successfully');
        } catch (e: any) {
            toast.error('Sync failed: ' + e.message);
        }
        setSyncing(false);
    }

    async function handleRehydrate() {
        if (!isOnline) { toast.error('No internet connection to refresh cache'); return; }
        setRehydrating(true);
        try {
            const { hydrateAllData } = await import('@/lib/offlineHydration');
            await hydrateAllData(true);
            await loadStats();
            toast.success('Offline cache refreshed successfully');
        } catch (e: any) {
            toast.error('Failed to refresh cache: ' + e.message);
        }
        setRehydrating(false);
    }

    async function handleClearCache() {
        setClearingCache(true);
        try {
            const { localDB } = await import('@/lib/db/LocalDB');
            await Promise.all([
                localDB.products.clear(),
                localDB.customers.clear(),
                localDB.suppliers.clear(),
                localDB.brokers.clear(),
                localDB.categories.clear(),
                localDB.sales.clear(),
                localDB.purchaseOrders.clear(),
                localDB.dashboardStats.clear(),
                localDB.settings.clear(),
                localDB.syncMeta.clear(),
            ]);
            await loadStats();
            toast.success('Offline cache cleared. Data will be re-cached on next load.');
        } catch (e: any) {
            toast.error('Failed to clear cache: ' + e.message);
        }
        setClearingCache(false);
    }

    async function handleApplyUpdate() {
        if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.getRegistration();
            reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload();
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 36, height: 36, background: 'var(--primary-subtle)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Smartphone size={18} color="var(--primary)" />
                </div>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>PWA & Offline Settings</h3>
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
                        Manage app installation, offline cache, and sync
                    </p>
                </div>
                {/* Live connection status */}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.75rem', background: isOnline ? 'rgba(16,185,129,0.08)' : 'rgba(249,115,22,0.08)', border: `1px solid ${isOnline ? 'rgba(16,185,129,0.25)' : 'rgba(249,115,22,0.25)'}`, borderRadius: '99px', fontSize: '0.75rem', fontWeight: 700, color: isOnline ? 'var(--success)' : '#f97316' }}>
                    {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
                    {isOnline ? 'Online' : 'Offline'}
                </div>
            </div>

            {/* SW Update Banner */}
            {swUpdateAvailable && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.25rem', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 'var(--radius-lg)', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--info)' }}>
                        <RefreshCw size={15} />
                        A new version of Azytion GemERP is available
                    </div>
                    <button onClick={handleApplyUpdate} className="btn btn-sm" style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: 'var(--info)' }}>
                        Update Now
                    </button>
                </div>
            )}

            {/* Install Card */}
            <div className="card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                    <Download size={16} color="var(--primary)" />
                    <h4 style={{ margin: 0, fontWeight: 700 }}>App Installation</h4>
                </div>

                {isInstalled ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius)' }}>
                        <CheckCircle2 size={20} color="var(--success)" />
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--success)' }}>Azytion GemERP is installed</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.125rem' }}>Running as a standalone app on this device</div>
                        </div>
                    </div>
                ) : installPrompt ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.25rem' }}>Install as a desktop / mobile app</div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
                                Add to your home screen or taskbar for faster access and a full-screen experience
                            </div>
                        </div>
                        <button onClick={handleInstall} disabled={installing} className="btn btn-primary btn-sm">
                            <Download size={14} />
                            {installing ? 'Installing...' : 'Install App'}
                        </button>
                    </div>
                ) : (
                    <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', padding: '0.75rem', background: 'var(--surface-2)', borderRadius: 'var(--radius)' }}>
                        <strong>How to install:</strong> In your browser, look for the install icon (⊕) in the address bar, or use the browser menu → &quot;Add to Home Screen&quot; / &quot;Install App&quot;.
                    </div>
                )}

                <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                    {[
                        { label: 'Works offline', desc: 'POS terminal and cached data available without internet' },
                        { label: 'No browser bar', desc: 'Full-screen experience like a native app' },
                        { label: 'Home screen icon', desc: 'Quick access from desktop or mobile home screen' },
                        { label: 'Same data', desc: 'All data still lives on your server — nothing changes' },
                    ].map((f, i) => (
                        <div key={i} style={{ padding: '0.75rem', background: 'var(--surface-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.8125rem', marginBottom: '0.25rem', color: 'var(--primary)' }}>✓ {f.label}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{f.desc}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Offline Cache Card */}
            <div className="card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <Database size={16} color="var(--info)" />
                        <h4 style={{ margin: 0, fontWeight: 700 }}>Offline Cache</h4>
                    </div>
                    {lastSynced && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                            <Clock size={11} />
                            Last synced: {formatRelativeTime(lastSynced)}
                        </div>
                    )}
                </div>

                <p style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
                    Azytion GemERP caches your data locally so pages load instantly and work when you&apos;re offline.
                    The cache is automatically refreshed every 5 minutes when online.
                </p>

                {/* Cache stats */}
                {loadingStats ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
                        {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 'var(--radius)' }} />)}
                    </div>
                ) : cacheStats ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                        {[
                            { label: 'Products', value: cacheStats.products, color: 'var(--primary)' },
                            { label: 'Customers', value: cacheStats.customers, color: 'var(--info)' },
                            { label: 'Suppliers', value: cacheStats.suppliers, color: 'var(--success)' },
                            { label: 'Sales', value: cacheStats.sales, color: 'var(--accent-purple)' },
                        ].map((s, i) => (
                            <div key={i} style={{ padding: '0.875rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color, letterSpacing: '-0.02em' }}>{s.value.toLocaleString()}</div>
                                <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '0.25rem' }}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                ) : null}

                {/* Pending sync */}
                {pendingCount > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: 'var(--radius)', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', fontWeight: 600, color: '#f97316' }}>
                            <CloudOff size={14} />
                            {pendingCount} offline record{pendingCount !== 1 ? 's' : ''} waiting to sync
                        </div>
                        <button onClick={handleSyncNow} disabled={syncing || !isOnline} className="btn btn-sm" style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', color: '#f97316' }}>
                            <RefreshCw size={11} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
                            {syncing ? 'Syncing...' : 'Sync Now'}
                        </button>
                    </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button onClick={handleRehydrate} disabled={rehydrating || !isOnline} className="btn btn-secondary btn-sm">
                        <RefreshCw size={13} style={{ animation: rehydrating ? 'spin 1s linear infinite' : 'none' }} />
                        {rehydrating ? 'Refreshing...' : 'Refresh Cache'}
                    </button>
                    <button onClick={handleClearCache} disabled={clearingCache} className="btn btn-sm" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', color: 'var(--destructive)' }}>
                        <Trash2 size={13} />
                        {clearingCache ? 'Clearing...' : 'Clear Cache'}
                    </button>
                </div>
            </div>

            {/* What works offline */}
            <div className="card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                    <WifiOff size={16} color="var(--warning)" />
                    <h4 style={{ margin: 0, fontWeight: 700 }}>Offline Capabilities</h4>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.625rem' }}>
                    {[
                        { works: true,  label: 'POS Terminal',         desc: 'Full sales processing, queued for sync' },
                        { works: true,  label: 'Products & Inventory', desc: 'Browse cached product catalog' },
                        { works: true,  label: 'Customers & Suppliers',desc: 'View cached contacts, create new (queued)' },
                        { works: true,  label: 'Sales History',        desc: 'Last 500 sales available offline' },
                        { works: true,  label: 'Purchase Orders',      desc: 'View cached purchase orders' },
                        { works: true,  label: 'Dashboard',            desc: 'Cached stats and charts' },
                        { works: false, label: 'Reports',              desc: 'Requires live server connection' },
                        { works: false, label: 'PDF Generation',       desc: 'Requires server processing' },
                        { works: false, label: 'Email & WhatsApp',     desc: 'Requires internet connection' },
                        { works: false, label: 'AI Features',          desc: 'Requires internet connection' },
                        { works: false, label: 'Backup & Restore',     desc: 'Requires server connection' },
                    ].map((item, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', padding: '0.625rem 0.75rem', background: item.works ? 'rgba(16,185,129,0.04)' : 'rgba(100,116,139,0.04)', border: `1px solid ${item.works ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.12)'}`, borderRadius: 'var(--radius)' }}>
                            <span style={{ fontSize: '0.875rem', flexShrink: 0, marginTop: '0.0625rem' }}>{item.works ? '✅' : '⚫'}</span>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{item.label}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.125rem' }}>{item.desc}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}

function formatRelativeTime(isoString: string): string {
    try {
        const diff = Date.now() - new Date(isoString).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    } catch { return ''; }
}
