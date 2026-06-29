'use client';

/**
 * useOfflineData — Cache-first / Network-first data fetching with IndexedDB fallback.
 *
 * Strategy:
 *  - If ONLINE: fetch from server, cache result, return fresh data
 *  - If OFFLINE: return cached data from IndexedDB with a stale flag
 *  - On reconnect: automatically refetch and update cache
 *
 * Usage:
 *   const { data, loading, isStale } = useOfflineData(
 *     'products_cache',
 *     () => getProducts('', undefined, 1, 2000),
 *     async () => localDB.products.toArray(),
 *     async (data) => { await localDB.products.clear(); await localDB.products.bulkPut(data); }
 *   );
 */

import { useState, useCallback, useRef } from 'react';
import { useLoadEffect } from './useLoadEffect';
import { useOnlineStatus } from './useOnlineStatus';

interface UseOfflineDataOptions<T> {
    /** Unique cache key for sync metadata */
    cacheKey: string;
    /** Server action to fetch fresh data */
    fetchFn: () => Promise<T>;
    /** Read from IndexedDB cache */
    readCache: () => Promise<T | null>;
    /** Write to IndexedDB cache */
    writeCache: (data: T) => Promise<void>;
    /** Max age in ms before cache is considered stale (default: 5 min) */
    maxAge?: number;
    /** Whether to skip fetching (e.g. when offline and no cache needed) */
    skip?: boolean;
}

interface UseOfflineDataResult<T> {
    data: T | null;
    loading: boolean;
    isStale: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    cachedAt: Date | null;
}

export function useOfflineData<T>({
    cacheKey,
    fetchFn,
    readCache,
    writeCache,
    maxAge = 5 * 60 * 1000,
    skip = false,
}: UseOfflineDataOptions<T>): UseOfflineDataResult<T> {
    const isOnline = useOnlineStatus();
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [isStale, setIsStale] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cachedAt, setCachedAt] = useState<Date | null>(null);
    const isFetching = useRef(false);

    const load = useCallback(async (forceNetwork = false) => {
        if (skip || isFetching.current) return;
        isFetching.current = true;
        setLoading(true);
        setError(null);

        try {
            // Always try to load cache first for instant display
            const cached = await readCache();
            if (cached) {
                setData(cached);
                setLoading(false);
            }

            // Check cache freshness
            const { getSyncMeta } = await import('@/lib/db/LocalDB');
            const ts = await getSyncMeta(cacheKey);
            const cacheAge = ts ? Date.now() - new Date(ts).getTime() : Infinity;
            const cacheIsFresh = cacheAge < maxAge;

            if (cached) {
                setCachedAt(ts ? new Date(ts) : null);
                setIsStale(!cacheIsFresh);
            }

            // Fetch from network if online and (cache is stale or forced)
            if (isOnline && (!cacheIsFresh || forceNetwork || !cached)) {
                try {
                    const fresh = await fetchFn();
                    setData(fresh);
                    setIsStale(false);
                    await writeCache(fresh);
                    const { setSyncMeta } = await import('@/lib/db/LocalDB');
                    await setSyncMeta(cacheKey, new Date().toISOString());
                    setCachedAt(new Date());
                } catch (_networkErr: any) {
                    // Network failed — use cache if available
                    if (!cached) {
                        setError('Unable to load data. Check your connection.');
                    } else {
                        setIsStale(true);
                    }
                }
            } else if (!cached) {
                setError('No cached data available. Connect to the internet to load data.');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load data');
        } finally {
            setLoading(false);
            isFetching.current = false;
        }
    }, [isOnline, cacheKey, fetchFn, readCache, writeCache, maxAge, skip]);

    useLoadEffect(() => load(), [load]);

    const refetch = useCallback(() => load(true), [load]);

    return { data, loading, isStale, error, refetch, cachedAt };
}
