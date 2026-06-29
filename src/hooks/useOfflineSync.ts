'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { localDB, setSyncMeta } from '@/lib/db/LocalDB';
import { toast } from 'sonner';

async function syncOfflineSales(pendingSales: any[]) {
    const { createSale } = await import('@/app/actions/sales');
    let synced = 0;
    let failed = 0;

    for (const sale of pendingSales) {
        try {
            const res = await createSale(
                sale.items,
                sale.totalAmount,
                sale.cashReceived,
                sale.customerId,
                sale.paymentMethod,
                sale.paymentDetails,
                0,
                sale.discountAmount,
                sale.userId,
                sale.brokerId ?? null,
                sale.brokerCommission ?? 0,
                sale.clientSaleId ?? null
            );
            if (res.success) {
                await localDB.offlineSales.update(sale.id!, { synced: 1 });
                synced++;
            } else {
                await localDB.offlineSales.update(sale.id!, {
                    synced: 2,
                    syncError: res.error || 'Unknown error',
                });
                failed++;
            }
        } catch (err: any) {
            await localDB.offlineSales.update(sale.id!, {
                synced: 2,
                syncError: err.message,
            });
            failed++;
        }
    }

    return { synced, failed };
}

async function syncOfflineWrites(pendingWrites: any[]) {
    let synced = 0;
    let failed = 0;

    for (const write of pendingWrites) {
        if (write.retryCount >= 3) {
            await localDB.offlineWrites.update(write.id!, { synced: 2, syncError: 'Max retries exceeded' });
            failed++;
            continue;
        }

        try {
            let success = false;
            let error = '';

            switch (write.type) {
                case 'create_customer': {
                    const { createCustomer } = await import('@/app/actions/customers');
                    const fd = objectToFormData(write.payload);
                    const res = await createCustomer(fd);
                    success = res.success;
                    error = res.error || '';
                    break;
                }
                case 'update_customer': {
                    const { updateCustomer } = await import('@/app/actions/customers');
                    const fd = objectToFormData(write.payload);
                    const res = await updateCustomer(write.payload.id, fd);
                    success = res.success;
                    error = res.error || '';
                    break;
                }
                case 'delete_customer': {
                    const { deleteCustomer } = await import('@/app/actions/customers');
                    const res = await deleteCustomer(write.payload.id);
                    success = res.success;
                    error = res.error || '';
                    break;
                }
                case 'settle_customer_balance': {
                    const { settleCustomerBalance } = await import('@/app/actions/customers');
                    const res = await settleCustomerBalance(
                        write.payload.customerId,
                        write.payload.amount,
                        write.payload.paymentMethod,
                        write.payload.userId
                    );
                    success = res.success;
                    error = res.error || '';
                    break;
                }
                case 'settle_supplier_balance': {
                    const { settleSupplierBalance } = await import('@/app/actions/suppliers');
                    const res = await settleSupplierBalance(
                        write.payload.supplierId,
                        write.payload.amount,
                        write.payload.paymentMethod
                    );
                    success = res.success;
                    error = res.error || '';
                    break;
                }
                case 'create_supplier': {
                    const { createSupplier } = await import('@/app/actions/suppliers');
                    const fd = objectToFormData(write.payload);
                    const res = await createSupplier(fd);
                    success = res.success;
                    error = res.error || '';
                    break;
                }
                case 'update_supplier': {
                    const { updateSupplier } = await import('@/app/actions/suppliers');
                    const fd = objectToFormData(write.payload);
                    const res = await updateSupplier(write.payload.id, fd);
                    success = res.success;
                    error = res.error || '';
                    break;
                }
                case 'delete_supplier': {
                    const { deleteSupplier } = await import('@/app/actions/suppliers');
                    const res = await deleteSupplier(write.payload.id);
                    success = res.success;
                    error = res.error || '';
                    break;
                }
                case 'create_broker': {
                    const { createBroker } = await import('@/app/actions/brokers');
                    const fd = objectToFormData(write.payload);
                    const res = await createBroker(fd);
                    success = res.success;
                    error = res.error || '';
                    break;
                }
                case 'update_broker': {
                    const { updateBroker } = await import('@/app/actions/brokers');
                    const fd = objectToFormData(write.payload);
                    const res = await updateBroker(write.payload.id, fd);
                    success = res.success;
                    error = res.error || '';
                    break;
                }
                case 'delete_broker': {
                    const { deleteBroker } = await import('@/app/actions/brokers');
                    const res = await deleteBroker(write.payload.id);
                    success = res.success;
                    error = res.error || '';
                    break;
                }
                case 'create_product': {
                    const { createProduct } = await import('@/app/actions/products');
                    const fd = objectToFormData(write.payload);
                    const res = await createProduct(fd);
                    success = res.success;
                    error = res.error || '';
                    break;
                }
                case 'update_product': {
                    const { updateProduct } = await import('@/app/actions/products');
                    const fd = objectToFormData(write.payload);
                    const res = await updateProduct(write.payload.id, fd);
                    success = res.success;
                    error = res.error || '';
                    break;
                }
                case 'delete_product': {
                    const { deleteProduct } = await import('@/app/actions/products');
                    const res = await deleteProduct(write.payload.id);
                    success = res.success;
                    error = res.error || '';
                    break;
                }
                case 'create_category': {
                    const { createCategory } = await import('@/app/actions/categories');
                    const fd = objectToFormData(write.payload);
                    const res = await createCategory(fd);
                    success = res.success;
                    error = res.error || '';
                    break;
                }
                case 'delete_category': {
                    const { deleteCategory } = await import('@/app/actions/categories');
                    const res = await deleteCategory(write.payload.id);
                    success = res.success;
                    error = res.error || '';
                    break;
                }
                case 'create_purchase_order': {
                    const { createPurchaseOrder } = await import('@/app/actions/purchase-orders');
                    const res = await createPurchaseOrder(write.payload);
                    success = res.success;
                    error = res.error || '';
                    break;
                }
                case 'create_cheque': {
                    const { createCheque } = await import('@/app/actions/cheques');
                    const fd = objectToFormData(write.payload);
                    const res = await createCheque(fd);
                    success = res.success;
                    error = res.error || '';
                    break;
                }
                case 'update_cheque_status': {
                    const { updateChequeStatus } = await import('@/app/actions/cheques');
                    const res = await updateChequeStatus(
                        write.payload.id,
                        write.payload.status,
                        write.payload.notes
                    );
                    success = res.success;
                    error = res.error || '';
                    break;
                }
                case 'update_settings': {
                    const { updateSettings } = await import('@/app/actions/settings');
                    const res = await updateSettings(write.payload);
                    success = res.success;
                    error = res.error || '';
                    break;
                }
                default:
                    await localDB.offlineWrites.update(write.id!, {
                        synced: 2,
                        syncError: `Unknown type: ${write.type}`,
                    });
                    failed++;
                    continue;
            }

            if (success) {
                await localDB.offlineWrites.update(write.id!, { synced: 1 });
                synced++;
            } else {
                await localDB.offlineWrites.update(write.id!, {
                    retryCount: write.retryCount + 1,
                    syncError: error,
                });
                failed++;
            }
        } catch (err: any) {
            await localDB.offlineWrites.update(write.id!, {
                retryCount: write.retryCount + 1,
                syncError: err.message,
            });
            failed++;
        }
    }

    return { synced, failed };
}

function objectToFormData(obj: Record<string, any>): FormData {
    const fd = new FormData();
    for (const [key, value] of Object.entries(obj)) {
        if (value !== null && value !== undefined) {
            fd.append(key, String(value));
        }
    }
    return fd;
}

export function useOfflineSync() {
    const isSyncing = useRef(false);

    const pendingSales = useLiveQuery(
        () => localDB.offlineSales.where('synced').equals(0).toArray(),
        []
    );

    const pendingWrites = useLiveQuery(
        () => localDB.offlineWrites.where('synced').equals(0).toArray(),
        []
    );

    const totalPending = (pendingSales?.length ?? 0) + (pendingWrites?.length ?? 0);

    const runSync = useCallback(async () => {
        if (isSyncing.current) return;
        if (!navigator.onLine) return;

        const sales = pendingSales ?? [];
        const writes = pendingWrites ?? [];
        if (sales.length === 0 && writes.length === 0) return;

        isSyncing.current = true;
        const total = sales.length + writes.length;
        const toastId = toast.loading(`Syncing ${total} offline record${total !== 1 ? 's' : ''}...`);

        try {
            const [salesResult, writesResult] = await Promise.all([
                sales.length > 0 ? syncOfflineSales(sales) : { synced: 0, failed: 0 },
                writes.length > 0 ? syncOfflineWrites(writes) : { synced: 0, failed: 0 },
            ]);

            const totalSynced = salesResult.synced + writesResult.synced;
            const totalFailed = salesResult.failed + writesResult.failed;

            if (totalSynced > 0) {
                await setSyncMeta('last_synced_at', new Date().toISOString());
            }

            if (totalFailed === 0) {
                toast.success(
                    `${totalSynced} record${totalSynced !== 1 ? 's' : ''} synced successfully`,
                    { id: toastId }
                );
            } else {
                toast.warning(
                    `Synced ${totalSynced}, failed ${totalFailed}. Failed records will retry automatically.`,
                    { id: toastId, duration: 6000 }
                );
            }
        } catch {
            toast.error('Sync failed. Will retry when online.', { id: toastId });
        } finally {
            isSyncing.current = false;
        }
    }, [pendingSales, pendingWrites]);

    useEffect(() => {
        const handleOnline = () => {
            setTimeout(runSync, 1500);
        };
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [runSync]);

    useEffect(() => {
        if (navigator.onLine && totalPending > 0) {
            runSync();
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return {
        totalPending,
        pendingSales: pendingSales ?? [],
        pendingWrites: pendingWrites ?? [],
        runSync,
    };
}
