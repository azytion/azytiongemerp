'use client';

import { useEffect, useState } from 'react';
import { Download, X, Gem } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPWA() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showBanner, setShowBanner] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Don't show if already installed (running as standalone PWA)
        if (window.matchMedia('(display-mode: standalone)').matches) return;

        // Don't show if user dismissed recently (7 days)
        const lastDismissed = localStorage.getItem('pwa_install_dismissed');
        if (lastDismissed) {
            const daysSince = (Date.now() - parseInt(lastDismissed)) / (1000 * 60 * 60 * 24);
            if (daysSince < 7) return;
        }

        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            // Show banner after a short delay so it doesn't appear immediately on load
            setTimeout(() => setShowBanner(true), 3000);
        };

        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    async function handleInstall() {
        if (!deferredPrompt) return;
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setShowBanner(false);
            setDeferredPrompt(null);
        }
    }

    function handleDismiss() {
        setShowBanner(false);
        setDismissed(true);
        localStorage.setItem('pwa_install_dismissed', Date.now().toString());
    }

    if (!showBanner || dismissed) return null;

    return (
        <div
            role="dialog"
            aria-label="Install Azytion GemERP"
            style={{
                position: 'fixed',
                bottom: '4.5rem',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 9998,
                display: 'flex',
                alignItems: 'center',
                gap: '0.875rem',
                padding: '0.875rem 1.25rem',
                background: 'rgba(15, 15, 26, 0.97)',
                border: '1px solid rgba(212,175,55,0.35)',
                borderRadius: '16px',
                backdropFilter: 'blur(16px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                maxWidth: '420px',
                width: 'calc(100vw - 2rem)',
                animation: 'slideUp 0.3s ease-out',
            }}
        >
            <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: 'rgba(212,175,55,0.12)',
                border: '1px solid rgba(212,175,55,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
            }}>
                <Gem size={20} color="var(--primary)" />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--foreground)', marginBottom: '0.125rem' }}>
                    Install Azytion GemERP
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', lineHeight: 1.4 }}>
                    Add to home screen for faster access and offline use
                </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <button
                    onClick={handleInstall}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.375rem',
                        padding: '0.5rem 0.875rem',
                        background: 'rgba(212,175,55,0.15)',
                        border: '1px solid rgba(212,175,55,0.4)',
                        borderRadius: '99px',
                        color: '#D4AF37',
                        fontSize: '0.8125rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                    }}
                >
                    <Download size={13} />
                    Install
                </button>
                <button
                    onClick={handleDismiss}
                    aria-label="Dismiss install prompt"
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 32, height: 32,
                        background: 'transparent',
                        border: '1px solid var(--border)',
                        borderRadius: '50%',
                        color: 'var(--muted-foreground)',
                        cursor: 'pointer',
                        flexShrink: 0,
                    }}
                >
                    <X size={14} />
                </button>
            </div>

            <style>{`
                @keyframes slideUp {
                    from { opacity: 0; transform: translateX(-50%) translateY(12px); }
                    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
            `}</style>
        </div>
    );
}
