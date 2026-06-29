'use client';

import { useQuery } from '@tanstack/react-query';
import { getCustomers } from '@/app/actions/customers';

export function useCustomers() {
    return useQuery({
        queryKey: ['customers'],
        queryFn: () => getCustomers(),
        staleTime: 1000 * 45, // 45 seconds
        refetchInterval: 1000 * 60, // Auto-refetch every 60 seconds
        refetchOnWindowFocus: true,
    });
}
