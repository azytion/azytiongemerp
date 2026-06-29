/**
 * offlineHydration.ts
 *
 * Background service that pre-caches all critical data into IndexedDB
 * when the app is online. Called once on app load and periodically.
 *
 * This ensures all pages have data available when offline.
 */

let isHydrating = false;
let lastHydration = 0;
const HYDRATION_INTERVAL = 5 * 60 * 1000; // 5 minutes

export async function hydrateAllData(force = false): Promise<void> {
    if (isHydrating) return;
    if (!navigator.onLine) return;
    if (!force && Date.now() - lastHydration < HYDRATION_INTERVAL) return;

    isHydrating = true;
    lastHydration = Date.now();

    try {
        // Run hydration in sequential batches to avoid exhausting the DB connection pool
        // Batch 1: core data needed for POS
        await Promise.allSettled([
            hydrateSettings(),
            hydrateProducts(),
            hydrateCategories(),
        ]);
        // Batch 2: contacts and orders
        await Promise.allSettled([
            hydrateCustomers(),
            hydrateSuppliers(),
            hydrateBrokers(),
        ]);
        // Batch 3: history and stats (lower priority)
        await Promise.allSettled([
            hydrateSales(),
            hydratePurchaseOrders(),
            hydrateDashboardStats(),
        ]);
    } finally {
        isHydrating = false;
    }
}

async function hydrateProducts() {
    try {
        const { localDB, setSyncMeta } = await import('./db/LocalDB');
        const { getProducts } = await import('@/app/actions/products');
        const res = await getProducts('', undefined, 1, 2000);
        if (res?.data) {
            await localDB.products.clear();
            await localDB.products.bulkPut(res.data as any);
            await setSyncMeta('products_cached_at', new Date().toISOString());
        }
    } catch { /* silent — offline or error */ }
}

async function hydrateCustomers() {
    try {
        const { localDB, setSyncMeta } = await import('./db/LocalDB');
        const { getCustomers } = await import('@/app/actions/customers');
        const res = await getCustomers('', 1, 2000);
        if (res?.data) {
            await localDB.customers.clear();
            await localDB.customers.bulkPut(res.data as any);
            await setSyncMeta('customers_cached_at', new Date().toISOString());
        }
    } catch { /* silent */ }
}

async function hydrateSuppliers() {
    try {
        const { localDB, setSyncMeta } = await import('./db/LocalDB');
        const { getSuppliers } = await import('@/app/actions/suppliers');
        const res = await getSuppliers('', 1, 2000);
        if (res?.data) {
            await localDB.suppliers.clear();
            await localDB.suppliers.bulkPut(res.data as any);
            await setSyncMeta('suppliers_cached_at', new Date().toISOString());
        }
    } catch { /* silent */ }
}

async function hydrateBrokers() {
    try {
        const { localDB, setSyncMeta } = await import('./db/LocalDB');
        const { getBrokers } = await import('@/app/actions/brokers');
        const res = await getBrokers();
        if (res?.success && res.brokers) {
            await localDB.brokers.clear();
            await localDB.brokers.bulkPut(res.brokers as any);
            await setSyncMeta('brokers_cached_at', new Date().toISOString());
        }
    } catch { /* silent */ }
}

async function hydrateCategories() {
    try {
        const { localDB, setSyncMeta } = await import('./db/LocalDB');
        const { getCategories } = await import('@/app/actions/categories');
        const res = await getCategories();
        if (res?.data) {
            await localDB.categories.clear();
            await localDB.categories.bulkPut(res.data as any);
            await setSyncMeta('categories_cached_at', new Date().toISOString());
        }
    } catch { /* silent */ }
}

async function hydrateSales() {
    try {
        const { localDB, setSyncMeta } = await import('./db/LocalDB');
        const { getSales } = await import('@/app/actions/sales');
        // Cache last 500 sales
        const res = await getSales(1, 500);
        if (res?.data) {
            await localDB.sales.clear();
            await localDB.sales.bulkPut(res.data as any);
            await setSyncMeta('sales_cached_at', new Date().toISOString());
        }
    } catch { /* silent */ }
}

async function hydratePurchaseOrders() {
    try {
        const { localDB, setSyncMeta } = await import('./db/LocalDB');
        const { getPurchaseOrders } = await import('@/app/actions/purchase-orders');
        const res = await getPurchaseOrders(undefined, 1, 500);
        if (res?.data) {
            await localDB.purchaseOrders.clear();
            await localDB.purchaseOrders.bulkPut(res.data as any);
            await setSyncMeta('purchase_orders_cached_at', new Date().toISOString());
        }
    } catch { /* silent */ }
}

async function hydrateDashboardStats() {
    try {
        const { localDB, setSyncMeta } = await import('./db/LocalDB');
        const { getDashboardStats } = await import('@/app/actions/reports');
        const stats = await getDashboardStats();
        if (stats) {
            await localDB.dashboardStats.put({
                key: 'main_stats',
                data: stats,
                cachedAt: new Date().toISOString(),
            });
            await setSyncMeta('dashboard_cached_at', new Date().toISOString());
        }
    } catch { /* silent */ }
}

async function hydrateSettings() {
    try {
        const { localDB, setSyncMeta } = await import('./db/LocalDB');
        const { getSettings } = await import('@/app/actions/settings');
        const settings = await getSettings();
        if (settings) {
            const entries = Object.entries(settings).map(([key, value]) => ({ key, value: String(value) }));
            await localDB.settings.clear();
            await localDB.settings.bulkPut(entries);
            await setSyncMeta('settings_cached_at', new Date().toISOString());
        }
    } catch { /* silent */ }
}
