'use client';

import { useQuery } from '@tanstack/react-query';
import { getProducts } from '@/app/actions/products';

export function useProducts(search?: string, categoryId?: number) {
    return useQuery({
        queryKey: ['products', { search, categoryId }],
        queryFn: () => getProducts(search, categoryId),
        staleTime: 1000 * 20, // 20 seconds
        refetchInterval: 1000 * 30, // Auto-refetch every 30 seconds
        refetchOnWindowFocus: true,
    });
}
