'use client';

/* eslint-disable react-hooks/refs */
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { CloudOff, RefreshCw, Wifi, CheckCircle2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { getSyncMeta } from '@/lib/db/LocalDB';

export default function OfflineBanner() {
    const isOnline = useOnlineStatus();
    const { totalPending, runSync } = useOfflineSync();
    const [syncing, setSyncing] = useState(false);
    const [lastSynced, setLastSynced] = useState<string | null>(null);
    const [justSynced, setJustSynced] = useState(false);

    // Load last synced time from IndexedDB
    useEffect(() => {
        getSyncMeta('last_synced_at').then(val => {
            if (val) setLastSynced(val);
        }).catch(() => {});
    }, [totalPending]); // Refresh when pending count changes (after sync)

    // Show "synced!" flash when pending drops to 0 after being > 0
    const prevPending = usePrevious(totalPending);
    useEffect(() => {
        if (prevPending !== undefined && prevPending > 0 && totalPending === 0 && isOnline) {
            setJustSynced(true);
            const t = setTimeout(() => setJustSynced(false), 3000);
            return () => clearTimeout(t);
        }
    }, [totalPending, prevPending, isOnline]);

    const showOffline = !isOnline;
    const showPending = isOnline && totalPending > 0;
    const showSynced = isOnline && justSynced && totalPending === 0;

    if (!showOffline && !showPending && !showSynced) return null;

    async function handleSync() {
        setSyncing(true);
        await runSync();
        // Update last synced timestamp
        const { setSyncMeta } = await import('@/lib/db/LocalDB');
        await setSyncMeta('last_synced_at', new Date().toISOString());
        setLastSynced(new Date().toISOString());
        setSyncing(false);
    }

    const bannerBase: React.CSSProperties = {
        position: 'fixed',
        bottom: '1.25rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '0.625rem',
        padding: '0.625rem 1.125rem',
        background: 'rgba(15, 15, 26, 0.96)',
        borderRadius: '99px',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        fontSize: '0.8125rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        animation: 'bannerSlideUp 0.25s ease-out',
    };

    // ── Offline ──────────────────────────────────────────────────────────────
    if (showOffline) {
        return (
            <>
                <div
                    role="alert"
                    aria-live="assertive"
                    style={{
                        ...bannerBase,
                        border: '1px solid rgba(249,115,22,0.4)',
                        color: '#f97316',
                        pointerEvents: totalPending > 0 ? 'auto' : 'none',
                        userSelect: 'none',
                    }}
                >
                    <CloudOff size={14} />
                    <span>Offline — POS still works, changes will sync on reconnect</span>
                    {totalPending > 0 && (
                        <span style={{
                            background: 'rgba(249,115,22,0.2)',
                            border: '1px solid rgba(249,115,22,0.3)',
                            borderRadius: '99px',
                            padding: '0.1rem 0.5rem',
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                        }}>
                            {totalPending} pending
                        </span>
                    )}
                    {lastSynced && (
                        <span style={{ fontSize: '0.6875rem', color: 'rgba(249,115,22,0.6)', marginLeft: '0.25rem' }}>
                            Last sync: {formatRelativeTime(lastSynced)}
                        </span>
                    )}
                </div>
                <BannerStyles />
            </>
        );
    }

    // ── Online with pending ──────────────────────────────────────────────────
    if (showPending) {
        return (
            <>
                <div
                    role="status"
                    aria-live="polite"
                    style={{
                        ...bannerBase,
                        border: '1px solid rgba(212,175,55,0.3)',
                        color: '#D4AF37',
                    }}
                >
                    <Wifi size={14} />
                    <span>Back online — {totalPending} record{totalPending !== 1 ? 's' : ''} pending sync</span>
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                            padding: '0.25rem 0.75rem',
                            background: 'rgba(212,175,55,0.15)',
                            border: '1px solid rgba(212,175,55,0.3)',
                            borderRadius: '99px',
                            color: '#D4AF37',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: syncing ? 'not-allowed' : 'pointer',
                            opacity: syncing ? 0.6 : 1,
                        }}
                    >
                        <RefreshCw size={11} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
                        {syncing ? 'Syncing...' : 'Sync Now'}
                    </button>
                </div>
                <BannerStyles />
            </>
        );
    }

    // ── Just synced flash ────────────────────────────────────────────────────
    return (
        <>
            <div
                role="status"
                aria-live="polite"
                style={{
                    ...bannerBase,
                    border: '1px solid rgba(16,185,129,0.3)',
                    color: 'var(--success)',
                    pointerEvents: 'none',
                    userSelect: 'none',
                    animation: 'bannerSlideUp 0.25s ease-out, bannerFadeOut 0.5s ease-in 2.5s forwards',
                }}
            >
                <CheckCircle2 size={14} />
                <span>All records synced</span>
            </div>
            <BannerStyles />
        </>
    );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function BannerStyles() {
    return (
        <style>{`
            @keyframes bannerSlideUp {
                from { opacity: 0; transform: translateX(-50%) translateY(8px); }
                to   { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
            @keyframes bannerFadeOut {
                from { opacity: 1; }
                to   { opacity: 0; pointer-events: none; }
            }
            @keyframes spin {
                from { transform: rotate(0deg); }
                to   { transform: rotate(360deg); }
            }
        `}</style>
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
    } catch {
        return '';
    }
}

// Simple usePrevious hook
function usePrevious<T>(value: T): T | undefined {
    const ref = useRef<T | undefined>(undefined);
    const prev = ref.current;
    useEffect(() => { ref.current = value; });
    return prev;
}
