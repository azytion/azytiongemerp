'use client';

import { useQuery } from '@tanstack/react-query';
import { getDaybookEntries } from '@/app/actions/daybook';
import { getCheques } from '@/app/actions/cheques';

export function useDaybook(date?: string) {
    return useQuery({
        queryKey: ['finance', 'daybook', { date }],
        queryFn: () => getDaybookEntries(date),
        staleTime: 1000 * 15, // 15 seconds
        refetchInterval: 1000 * 30, // Auto-refetch every 30 seconds
        refetchOnWindowFocus: true,
    });
}

export function useCheques() {
    return useQuery({
        queryKey: ['finance', 'cheques'],
        queryFn: () => getCheques(),
        staleTime: 1000 * 20, // 20 seconds
        refetchInterval: 1000 * 40, // Auto-refetch every 40 seconds
        refetchOnWindowFocus: true,
    });
}
