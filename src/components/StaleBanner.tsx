'use client';

import { Clock, RefreshCw, WifiOff } from 'lucide-react';

interface StaleBannerProps {
    cachedAt?: Date | null;
    onRefresh?: () => void;
    refreshing?: boolean;
    message?: string;
}

export default function StaleBanner({ cachedAt, onRefresh, refreshing, message }: StaleBannerProps) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            padding: '0.625rem 1rem',
            background: 'rgba(245,158,11,0.06)',
            border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: 'var(--radius)',
            flexWrap: 'wrap',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--warning)' }}>
                <WifiOff size={13} />
                <span style={{ fontWeight: 600 }}>
                    {message || 'Viewing cached data'}
                </span>
                {cachedAt && (
                    <span style={{ color: 'var(--muted-foreground)', fontWeight: 400, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Clock size={11} />
                        {formatRelativeTime(cachedAt)}
                    </span>
                )}
            </div>
            {onRefresh && (
                <button
                    onClick={onRefresh}
                    disabled={refreshing}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        padding: '0.25rem 0.625rem',
                        background: 'rgba(245,158,11,0.1)',
                        border: '1px solid rgba(245,158,11,0.25)',
                        borderRadius: '99px',
                        color: 'var(--warning)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: refreshing ? 'not-allowed' : 'pointer',
                        opacity: refreshing ? 0.6 : 1,
                    }}
                >
                    <RefreshCw size={11} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                    {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
            )}
            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}

function formatRelativeTime(date: Date): string {
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}
