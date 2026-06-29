'use client';

import { useQuery } from '@tanstack/react-query';
import { getSales } from '@/app/actions/sales';

export function useSales(page: number = 1, pageSize: number = 10, searchQuery: string = '') {
    return useQuery({
        queryKey: ['sales', { page, pageSize, searchQuery }],
        queryFn: () => getSales(page, pageSize, searchQuery),
        staleTime: 1000 * 15, // 15 seconds
        refetchInterval: 1000 * 20, // Auto-refetch every 20 seconds
        refetchOnWindowFocus: true,
    });
}
