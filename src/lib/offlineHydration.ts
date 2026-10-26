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
        // Sequential on purpose: parallel server actions exhaust small production MySQL pools
        // and make list pages 500, which then look like “empty cached data”.
        await hydrateSettings();
        await hydrateProducts();
        await hydrateCategories();
        await hydrateCustomers();
        await hydrateSuppliers();
        await hydrateBrokers();
        await hydratePurchaseOrders();
        await hydrateSales();
        await hydrateDashboardStats();
    } finally {
        isHydrating = false;
    }
}

async function hydrateProducts() {
    try {
        const { cacheProductsLocally } = await import('./productLocalCache');
        const { getProducts } = await import('@/app/actions/products');
        const pageSize = 200;
        const all: unknown[] = [];
        let page = 1;
        let totalPages = 1;
        do {
            const res = await getProducts('', null, page, pageSize, false);
            if (res?.data?.length) all.push(...res.data);
            totalPages = Math.max(1, Number(res?.totalPages) || 1);
            page += 1;
        } while (page <= totalPages && page <= 10);
        if (all.length) await cacheProductsLocally(all);
    } catch { /* silent — offline or error */ }
}

async function hydrateCustomers() {
    try {
        const { replaceCacheTable } = await import('./db/LocalDB');
        const { getCustomers } = await import('@/app/actions/customers');
        const res = await getCustomers('', 1, 200);
        await replaceCacheTable('customers', res?.data, 'customers_cached_at');
    } catch { /* silent */ }
}

async function hydrateSuppliers() {
    try {
        const { replaceCacheTable } = await import('./db/LocalDB');
        const { getSuppliers } = await import('@/app/actions/suppliers');
        const res = await getSuppliers('', 1, 200);
        await replaceCacheTable('suppliers', res?.data, 'suppliers_cached_at');
    } catch { /* silent */ }
}

async function hydrateBrokers() {
    try {
        const { replaceCacheTable } = await import('./db/LocalDB');
        const { getBrokers } = await import('@/app/actions/brokers');
        const res = await getBrokers();
        if (res?.success) await replaceCacheTable('brokers', res.brokers, 'brokers_cached_at');
    } catch { /* silent */ }
}

async function hydrateCategories() {
    try {
        const { replaceCacheTable } = await import('./db/LocalDB');
        const { getCategories } = await import('@/app/actions/categories');
        const res = await getCategories();
        await replaceCacheTable('categories', res?.data, 'categories_cached_at');
    } catch { /* silent */ }
}

async function hydrateSales() {
    try {
        const { replaceCacheTable } = await import('./db/LocalDB');
        const { getSales } = await import('@/app/actions/sales');
        const res = await getSales(1, 50);
        await replaceCacheTable('sales', res?.data, 'sales_cached_at');
    } catch { /* silent */ }
}

async function hydratePurchaseOrders() {
    try {
        const { replaceCacheTable } = await import('./db/LocalDB');
        const { getPurchaseOrders } = await import('@/app/actions/purchase-orders');
        const res = await getPurchaseOrders(null, 1, 100);
        await replaceCacheTable('purchaseOrders', res?.data, 'purchase_orders_cached_at');
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
        const { replaceCacheTable } = await import('./db/LocalDB');
        const { getSettings } = await import('@/app/actions/settings');
        const settings = await getSettings();
        if (settings && Object.keys(settings).length > 0) {
            const entries = Object.entries(settings).map(([key, value]) => ({ key, value: String(value) }));
            await replaceCacheTable('settings', entries, 'settings_cached_at');
        }
    } catch { /* silent */ }
}
