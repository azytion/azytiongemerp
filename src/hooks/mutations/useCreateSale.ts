'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createSale, CartItem } from '@/app/actions/sales';
import { toast } from 'sonner';

export function useCreateSale() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: {
            items: CartItem[];
            totalAmount: number;
            cashReceived: number;
            customerId?: number | null;
            paymentMethod?: string;
            paymentDetails?: string | null;
            discountAmount?: number;
            userId?: number;
            brokerId?: number | null;
            brokerCommission?: number;
        }) => createSale(
            params.items,
            params.totalAmount,
            params.cashReceived,
            params.customerId,
            params.paymentMethod,
            params.paymentDetails,
            0, // redeemedPoints — loyalty removed
            params.discountAmount,
            params.userId || 1,
            params.brokerId,
            params.brokerCommission
        ),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['sales'] });
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            queryClient.invalidateQueries({ queryKey: ['daybook-entries'] });
            queryClient.invalidateQueries({ queryKey: ['daybook-summary'] });
            queryClient.invalidateQueries({ queryKey: ['cheques'] });
            queryClient.invalidateQueries({ queryKey: ['staff-performance'] });
            queryClient.invalidateQueries({ queryKey: ['finance'] });
        },
        onError: (error: unknown) => {
            const message = error instanceof Error ? error.message : 'Failed to create sale';
            toast.error(message);
        },
    });
}
