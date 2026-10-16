import { localDB, setSyncMeta } from '@/lib/db/LocalDB';

/** Strip server-only / join columns and coerce types for IndexedDB. */
export function sanitizeProductForLocalCache(p: Record<string, unknown>) {
    const id = Number(p.id);
    if (!Number.isFinite(id)) {
        throw new Error(`Invalid product id: ${String(p.id)}`);
    }
    return {
        id,
        name: String(p.name ?? ''),
        selling_price: Number(p.selling_price) || 0,
        cost_price: Number(p.cost_price) || 0,
        stock: Number(p.stock) || 0,
        category_id: p.category_id != null && p.category_id !== '' ? Number(p.category_id) : null,
        category: p.category != null ? String(p.category) : null,
        category_name: p.category_name != null ? String(p.category_name) : null,
        barcode: p.barcode != null && p.barcode !== '' ? String(p.barcode) : null,
        image_url: p.image_url != null ? String(p.image_url) : null,
        reorder_level: p.reorder_level != null ? Number(p.reorder_level) : undefined,
        pricing_method: p.pricing_method != null ? String(p.pricing_method) : 'per_piece',
        gem_details: p.gem_details ?? undefined,
        notes: p.notes != null ? String(p.notes) : undefined,
        is_archived: p.is_archived != null ? Number(p.is_archived) : undefined,
        created_at: p.created_at != null ? String(p.created_at) : undefined,
        updated_at: p.updated_at != null ? String(p.updated_at) : undefined,
    };
}

export function dedupeProductsById<T extends { id: number }>(items: T[]): T[] {
    const map = new Map<number, T>();
    for (const item of items) {
        if (item?.id != null && Number.isFinite(Number(item.id))) {
            map.set(Number(item.id), item);
        }
    }
    return Array.from(map.values());
}

/** Persist products for offline use; never throws — failures are logged only. */
export async function cacheProductsLocally(products: unknown[]): Promise<void> {
    try {
        const deduped = dedupeProductsById(
            products.map((p) => sanitizeProductForLocalCache(p as Record<string, unknown>)) as { id: number }[]
        );
        await localDB.products.clear();
        if (deduped.length > 0) {
            await localDB.products.bulkPut(deduped as any);
        }
        await setSyncMeta('products_cached_at', new Date().toISOString());
    } catch (err) {
        console.warn('Product local cache update failed:', err);
    }
}
