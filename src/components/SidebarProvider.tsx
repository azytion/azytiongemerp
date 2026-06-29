'use client';

import { useState, useEffect, createContext, useContext, useSyncExternalStore } from 'react';

type SidebarContextType = {
    isCollapsed: boolean;
    isMobile: boolean;
    isMobileOpen: boolean;
    toggleSidebar: () => void;
    openMobileSidebar: () => void;
    closeMobileSidebar: () => void;
};

const SidebarContext = createContext<SidebarContextType>({
    isCollapsed: false,
    isMobile: false,
    isMobileOpen: false,
    toggleSidebar: () => { },
    openMobileSidebar: () => { },
    closeMobileSidebar: () => { },
});

export const useSidebar = () => useContext(SidebarContext);

function useIsClient() {
    return useSyncExternalStore(() => () => {}, () => true, () => false);
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
    const mounted = useIsClient();
    const [isCollapsed, setIsCollapsed] = useState(() => {
        if (typeof window === 'undefined') return false;
        if (window.innerWidth <= 768) return true;
        return localStorage.getItem('sidebar-collapsed') === 'true';
    });
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' ? window.innerWidth <= 768 : false
    );
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            const width = window.innerWidth;
            const mobile = width <= 768;
            setIsMobile(mobile);
            if (mobile) {
                setIsCollapsed(true);
            } else {
                const saved = localStorage.getItem('sidebar-collapsed');
                setIsCollapsed(saved === 'true');
            }
        };

        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const toggleSidebar = () => {
        if (isMobile) {
            setIsMobileOpen(prev => !prev);
        } else {
            setIsCollapsed(prev => {
                const newValue = !prev;
                localStorage.setItem('sidebar-collapsed', String(newValue));
                return newValue;
            });
        }
    };

    const openMobileSidebar = () => setIsMobileOpen(true);
    const closeMobileSidebar = () => setIsMobileOpen(false);

    if (!mounted) {
        return <div>{children}</div>;
    }

    return (
        <SidebarContext.Provider value={{ isCollapsed, isMobile, isMobileOpen, toggleSidebar, openMobileSidebar, closeMobileSidebar }}>
            {children}
        </SidebarContext.Provider>
    );
}

