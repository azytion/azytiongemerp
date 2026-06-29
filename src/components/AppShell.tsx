'use client';

import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import GemParticles from '@/components/effects/GemParticles';
import { MainContent } from '@/components/MainContent';
import { useState, useEffect } from 'react';
import KeyboardShortcutsModal from '@/components/KeyboardShortcutsModal';

// Auth pages where sidebar should never appear
const AUTH_PATHS = ['/login', '/super-admin/login'];

interface AppShellProps {
    session: { role?: string; username?: string; [key: string]: any } | null;
    children: React.ReactNode;
}

export default function AppShell({ session, children }: AppShellProps) {
    const pathname = usePathname();
    const _router = useRouter();
    const isAuthPage = AUTH_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
    const showSidebar = !!session && !isAuthPage;
    const [shortcutsOpen, setShortcutsOpen] = useState(false);

    // Session persistence: enforce Remember Me behavior.
    // - Remember Me ON  → persistent session (30d cookie + localStorage flag)
    // - Remember Me OFF → session-only (8h cookie + sessionStorage flag)
    //
    // Problem: browsers with "restore tabs on restart" keep session cookies alive.
    // Solution: if sessionStorage has no flag AND localStorage has no flag,
    // the browser was closed/reopened without Remember Me → force logout.
    useEffect(() => {
        if (!session || isAuthPage) return;

        const inSession = sessionStorage.getItem('zation_pos_session_active');
        const inPersist = localStorage.getItem('zation_pos_session_active');

        if (!inSession && !inPersist) {
            // Neither flag exists → browser was closed without Remember Me
            // Clear the session and redirect to login
            fetch('/api/auth/logout', { method: 'POST', cache: 'no-store' }).catch(() => {});
            document.cookie = 'session=; Max-Age=0; path=/';
            window.location.replace('/login');
            return;
        }

        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        if (isStandalone && window.location.pathname === '/pos' && window.location.search.length === 0) {
            window.location.replace('/');
        }
    // Only run once on initial mount — not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Background data hydration — pre-cache all data for offline use
    useEffect(() => {
        if (!session) return;
        // Delay slightly so it doesn't compete with the initial page render.
        // A longer delay (5 s) also avoids hammering the DB during Fast Refresh cycles in dev.
        const timer = setTimeout(async () => {
            // Only hydrate if the tab is still active to avoid unnecessary DB load
            if (document.visibilityState === 'hidden') return;
            try {
                const { hydrateAllData } = await import('@/lib/offlineHydration');
                await hydrateAllData();
            } catch { /* silent — never block the UI */ }
        }, 5000);
        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run once on mount — hydrateAllData has its own interval guard

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
            if (e.key === '?' && !isInput) {
                e.preventDefault();
                setShortcutsOpen(prev => !prev);
            }
            if (e.key === 'Escape' && shortcutsOpen) {
                setShortcutsOpen(false);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [shortcutsOpen]);

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            {showSidebar && <Sidebar session={session} />}
            {showSidebar && <GemParticles />}
            <MainContent hasSession={showSidebar}>
                {children}
            </MainContent>
            <KeyboardShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
        </div>
    );
}
