'use client';

import { useQuery } from '@tanstack/react-query';
import { getAdjustments } from '@/app/actions/inventory';

export function useInventory(page: number = 1, pageSize: number = 100) {
    return useQuery({
        queryKey: ['inventory', { page, pageSize }],
        queryFn: () => getAdjustments(page, pageSize),
        staleTime: 1000 * 20, // 20 seconds
        refetchInterval: 1000 * 30, // Auto-refetch every 30 seconds
        refetchOnWindowFocus: true,
    });
}
