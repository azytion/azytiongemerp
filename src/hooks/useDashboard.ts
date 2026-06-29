'use client';

import { useQuery } from '@tanstack/react-query';
import { getDashboardStats } from '@/app/actions/reports';
import { localDB } from '@/lib/db/LocalDB';

async function getDashboardStatsWithCache() {
    if (navigator.onLine) {
        try {
            const stats = await getDashboardStats();
            // Cache for offline use
            if (stats) {
                await localDB.dashboardStats.put({
                    key: 'main_stats',
                    data: stats,
                    cachedAt: new Date().toISOString(),
                });
            }
            return stats;
        } catch {
            // Fall through to cache
        }
    }
    // Offline fallback
    const cached = await localDB.dashboardStats.get('main_stats');
    return cached?.data ?? null;
}

export function useDashboardStats() {
    return useQuery({
        queryKey: ['dashboard', 'stats'],
        queryFn: getDashboardStatsWithCache,
        staleTime: 1000 * 5,
        refetchInterval: navigator?.onLine ? 1000 * 10 : false,
        refetchOnWindowFocus: true,
        retry: 1,
    });
}
