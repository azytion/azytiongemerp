'use client';

import { useCallback } from 'react';
import { queueOfflineWrite, OfflineWriteType } from '@/lib/db/LocalDB';
import { toast } from 'sonner';

/**
 * Returns a wrapper that:
 *  - If online: calls the server action directly
 *  - If offline: queues the write in IndexedDB and shows a toast
 *
 * Usage:
 *   const offlineAction = useOfflineAction();
 *   const res = await offlineAction('create_customer', payload, () => createCustomer(fd));
 */
export function useOfflineAction() {
    return useCallback(async <T extends { success: boolean; error?: string }>(
        writeType: OfflineWriteType,
        payload: Record<string, any>,
        onlineAction: () => Promise<T>
    ): Promise<T | { success: boolean; queued: true; error?: string }> => {
        if (navigator.onLine) {
            return onlineAction();
        }

        // Offline — queue the write
        try {
            await queueOfflineWrite(writeType, payload);
            toast.warning('You\'re offline. This change will sync when you reconnect.', {
                duration: 4000,
            });
            return { success: true, queued: true };
        } catch (err: any) {
            toast.error('Failed to save offline: ' + err.message);
            return { success: false, queued: true, error: err.message };
        }
    }, []);
}
