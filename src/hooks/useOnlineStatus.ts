'use client';

/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useRef } from 'react';

/**
 * Returns true when the browser has network connectivity.
 *
 * Uses navigator.onLine as the primary signal, but debounces the
 * offline transition by 3 seconds to avoid false positives caused by:
 *  - Brief network blips
 *  - The initial page load / Fast Refresh cycle
 *  - Server-action 500 errors briefly affecting Chrome's network state
 *
 * Going back online is applied immediately (no delay).
 */
export function useOnlineStatus() {
    const [isOnline, setIsOnline] = useState(true); // Optimistic: assume online until proven otherwise

    const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        // Sync with actual browser state after mount (avoids SSR mismatch)
        setIsOnline(navigator.onLine);

        const handleOnline = () => {
            // Cancel any pending offline transition
            if (offlineTimerRef.current) {
                clearTimeout(offlineTimerRef.current);
                offlineTimerRef.current = null;
            }
            setIsOnline(true);
        };

        const handleOffline = () => {
            // Debounce offline: only mark offline after 3 s of sustained disconnection
            if (offlineTimerRef.current) return; // already waiting
            offlineTimerRef.current = setTimeout(() => {
                offlineTimerRef.current = null;
                // Re-check navigator.onLine at the moment the timer fires
                if (!navigator.onLine) {
                    setIsOnline(false);
                }
            }, 3000);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            if (offlineTimerRef.current) {
                clearTimeout(offlineTimerRef.current);
            }
        };
    }, []);

    return isOnline;
}
