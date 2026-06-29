import Dexie, { type EntityTable } from 'dexie';

// ── Cached entity types ──────────────────────────────────────────────────────

export interface LocalProduct {
    id: number;
    name: string;
    selling_price: number;
    cost_price: number;
    stock: number;
    category_id?: number | null;
    category?: string | null;
    category_name?: string | null;
    barcode?: string | null;
    image_url?: string | null;
    reorder_level?: number;
    pricing_method?: string | null;
    gem_details?: any;
    description?: string | null;
    notes?: string | null;
    is_archived?: number;
    created_at?: string;
    updated_at?: string;
}

export interface LocalCustomer {
    id: number;
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    balance: number;
    created_at?: string;
    updated_at?: string;
}

export interface LocalSupplier {
    id: number;
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    balance: number;
    created_at?: string;
}

export interface LocalBroker {
    id: number;
    name: string;
    phone?: string | null;
    email?: string | null;
    commission_rate?: number;
}

export interface LocalCategory {
    id: number;
    name: string;
    description?: string | null;
}

export interface LocalSale {
    id: number;
    invoice_number: string;
    date: string;
    total_amount: number;
    received_cash: number;
    payment_method: string;
    payment_status: string;
    customer_id?: number | null;
    customer_name?: string | null;
    type?: string;
    status?: string;
    discount?: number;
    broker_id?: number | null;
}

export interface LocalPurchaseOrder {
    id: number;
    po_number: string;
    date: string;
    supplier_id?: number | null;
    supplier_name?: string | null;
    total_amount: number;
    paid_amount?: number;
    payment_status: string;
    status: string;
    notes?: string | null;
}

export interface LocalDashboardStats {
    key: string;   // 'main_stats'
    data: any;
    cachedAt: string;
}

// ── Offline sale queue ───────────────────────────────────────────────────────

export interface OfflineSale {
    id?: number;
    items: any[];
    totalAmount: number;
    cashReceived: number;
    customerId: number | null;
    paymentMethod: string;
    paymentDetails: string | null;
    redeemedPoints: number;
    discountAmount: number;
    userId: number;
    brokerId: number | null;
    brokerCommission: number;
    createdAt: string;
    synced: number; // 0 = pending, 1 = synced, 2 = failed
    syncError?: string;
}

// ── Generic offline write queue ──────────────────────────────────────────────

export type OfflineWriteType =
    | 'create_customer'
    | 'update_customer'
    | 'delete_customer'
    | 'create_supplier'
    | 'update_supplier'
    | 'delete_supplier'
    | 'create_broker'
    | 'update_broker'
    | 'delete_broker'
    | 'create_product'
    | 'update_product'
    | 'delete_product'
    | 'create_category'
    | 'update_category'
    | 'delete_category'
    | 'create_purchase_order'
    | 'update_purchase_order'
    | 'settle_customer_balance'
    | 'settle_supplier_balance'
    | 'update_settings'
    | 'create_cheque'
    | 'update_cheque_status';

export interface OfflineWrite {
    id?: number;
    type: OfflineWriteType;
    payload: any;
    createdAt: string;
    synced: number;         // 0 = pending, 1 = synced, 2 = failed
    syncError?: string;
    retryCount: number;
}

// ── Sync metadata ────────────────────────────────────────────────────────────

export interface SyncMeta {
    key: string;
    value: string;
}

// ── Database class ───────────────────────────────────────────────────────────

export class PosLocalDB extends Dexie {
    products!: EntityTable<LocalProduct, 'id'>;
    customers!: EntityTable<LocalCustomer, 'id'>;
    suppliers!: EntityTable<LocalSupplier, 'id'>;
    brokers!: EntityTable<LocalBroker, 'id'>;
    categories!: EntityTable<LocalCategory, 'id'>;
    sales!: EntityTable<LocalSale, 'id'>;
    purchaseOrders!: EntityTable<LocalPurchaseOrder, 'id'>;
    dashboardStats!: EntityTable<LocalDashboardStats, 'key'>;
    settings!: EntityTable<{ key: string; value: string }, 'key'>;
    offlineSales!: EntityTable<OfflineSale, 'id'>;
    offlineWrites!: EntityTable<OfflineWrite, 'id'>;
    syncMeta!: EntityTable<SyncMeta, 'key'>;

    constructor() {
        super('PosLocalDB');

        // Version 3: original schema
        this.version(3).stores({
            products: 'id, name, barcode, category_id',
            customers: 'id, name, phone, email',
            categories: 'id, name',
            settings: 'key',
            offlineSales: '++id, synced, createdAt, brokerId',
        });

        // Version 4: add offline write queue + sync metadata
        this.version(4).stores({
            products: 'id, name, barcode, category_id',
            customers: 'id, name, phone, email',
            categories: 'id, name',
            settings: 'key',
            offlineSales: '++id, synced, createdAt, brokerId',
            offlineWrites: '++id, type, synced, createdAt',
            syncMeta: 'key',
        });

        // Version 5: add suppliers, brokers, sales, purchase orders, dashboard stats
        this.version(5).stores({
            products: 'id, name, barcode, category_id',
            customers: 'id, name, phone, email',
            suppliers: 'id, name, phone',
            brokers: 'id, name',
            categories: 'id, name',
            sales: 'id, date, invoice_number, customer_id, payment_status',
            purchaseOrders: 'id, date, po_number, supplier_id, payment_status',
            dashboardStats: 'key',
            settings: 'key',
            offlineSales: '++id, synced, createdAt, brokerId',
            offlineWrites: '++id, type, synced, createdAt',
            syncMeta: 'key',
        });
    }
}

// Lazy singleton — only instantiated on first access in the browser.
// This prevents Turbopack HMR from losing the module factory when the
// module is statically imported by client components in the layout chain.
let _localDB: PosLocalDB | null = null;
export const localDB: PosLocalDB = new Proxy({} as PosLocalDB, {
    get(_target, prop) {
        if (!_localDB) {
            _localDB = new PosLocalDB();
        }
        const val = (_localDB as any)[prop];
        return typeof val === 'function' ? val.bind(_localDB) : val;
    },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

export async function queueOfflineWrite(type: OfflineWriteType, payload: any): Promise<number> {
    const id = await localDB.offlineWrites.add({
        type,
        payload,
        createdAt: new Date().toISOString(),
        synced: 0,
        retryCount: 0,
    });
    if (typeof id !== 'number') {
        throw new Error('Offline write was queued without a numeric id');
    }
    return id;
}

export async function getPendingWriteCount(): Promise<number> {
    const [sales, writes] = await Promise.all([
        localDB.offlineSales.where('synced').equals(0).count(),
        localDB.offlineWrites.where('synced').equals(0).count(),
    ]);
    return sales + writes;
}

export async function setSyncMeta(key: string, value: string): Promise<void> {
    await localDB.syncMeta.put({ key, value });
}

export async function getSyncMeta(key: string): Promise<string | null> {
    const row = await localDB.syncMeta.get(key);
    return row?.value ?? null;
}

/** Returns true if the cached data for a given key is still fresh (within maxAgeMs) */
export async function isCacheFresh(key: string, maxAgeMs: number = 5 * 60 * 1000): Promise<boolean> {
    const ts = await getSyncMeta(key);
    if (!ts) return false;
    return Date.now() - new Date(ts).getTime() < maxAgeMs;
}
