'use server';


import { requireSession } from './authz';
import { getDb } from '@/lib/db';

export type WeightRange = '0-0.49' | '0.50-0.99' | '1.00-1.99' | '2.00-4.99' | '5.00+';

export type GemStockGroup = {
    category: string;
    shape: string; // 'Oval', 'Round', etc. (or 'Other' if mixed)
    ranges: Record<WeightRange, {
        count: number;
        weight: number;
        value: number; // Selling Price
    }>;
    total: {
        count: number;
        weight: number;
        value: number;
    }
};

export type GemStockReportData = {
    generated_at: string;
    groups: GemStockGroup[];
    grand_total: {
        count: number;
        weight: number;
        value: number;
    };
    currency_symbol: string;
};

export async function getGemStockReport(): Promise<GemStockReportData> {
    await requireSession();
    const db = await getDb();

    // Fetch settings for currency
    const settingsRes = await db.prepare("SELECT key, value FROM settings WHERE key = 'currency_symbol'").get() as { value: string } | undefined;
    const currencySymbol = settingsRes?.value || '$';

    // Query all in-stock products — gem details used when available
    const products = await db.prepare(`
        SELECT 
            p.id, p.name, p.category_id, c.name as category_name,
            COALESCE(p.cost_price, 0) as cost_price,
            COALESCE(p.selling_price, 0) as selling_price,
            COALESCE(p.stock, 0) as stock,
            COALESCE(p.pricing_method, 'per_piece') as pricing_method,
            g.carat_weight, g.shape, g.origin, g.color
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN gem_details g ON (g.product_id = p.id AND g.variant_id IS NULL)
        WHERE COALESCE(p.stock, 0) > 0
          AND (p.is_archived IS NULL OR p.is_archived = 0)
    `).all() as any[];

    const allItems = products.map(p => ({ ...p, is_variant: false }));

    // Aggregation Logic
    const groups: Map<string, GemStockGroup> = new Map();

    const getRange = (weight: number): WeightRange => {
        if (weight < 0.5) return '0-0.49';
        if (weight < 1.0) return '0.50-0.99';
        if (weight < 2.0) return '1.00-1.99';
        if (weight < 5.0) return '2.00-4.99';
        return '5.00+';
    };

    const initGroup = (category: string, shape: string): GemStockGroup => ({
        category,
        shape,
        ranges: {
            '0-0.49': { count: 0, weight: 0, value: 0 },
            '0.50-0.99': { count: 0, weight: 0, value: 0 },
            '1.00-1.99': { count: 0, weight: 0, value: 0 },
            '2.00-4.99': { count: 0, weight: 0, value: 0 },
            '5.00+': { count: 0, weight: 0, value: 0 },
        },
        total: { count: 0, weight: 0, value: 0 }
    });

    const grandTotal = { count: 0, weight: 0, value: 0 };

    for (const item of allItems) {
        const category = item.category_name || 'Uncategorized';
        const shape = item.shape || 'Other';
        const key = `${category}|${shape}`;

        if (!groups.has(key)) {
            groups.set(key, initGroup(category, shape));
        }

        const group = groups.get(key)!;
        const weightPerPiece = item.carat_weight || 0;
        const totalWeight = weightPerPiece * item.stock;

        // Calculate Value
        let totalValue = 0;
        if (item.pricing_method === 'per_carat') {
            totalValue = item.selling_price * totalWeight;
        } else {
            totalValue = item.selling_price * item.stock;
        }

        const range = getRange(weightPerPiece);

        // Update Range Stats
        group.ranges[range].count += item.stock;
        group.ranges[range].weight += totalWeight;
        group.ranges[range].value += totalValue;

        // Update Group Total
        group.total.count += item.stock;
        group.total.weight += totalWeight;
        group.total.value += totalValue;

        // Update Grand Total
        grandTotal.count += item.stock;
        grandTotal.weight += totalWeight;
        grandTotal.value += totalValue;
    }

    const sortedGroups = Array.from(groups.values()).sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return a.shape.localeCompare(b.shape);
    });

    return {
        generated_at: new Date().toLocaleString(),
        groups: sortedGroups,
        grand_total: grandTotal,
        currency_symbol: currencySymbol
    };
}

// ── Origin Breakdown Report ──────────────────────────────────────────────────
export async function getGemOriginReport() {
    await requireSession();
    const db = await getDb();

    const rows = await db.prepare(`
        SELECT
            COALESCE(g.origin, 'Unknown') as origin,
            COUNT(DISTINCT p.id) as product_count,
            COALESCE(SUM(p.stock), 0) as total_pieces,
            COALESCE(SUM(COALESCE(g.carat_weight, 0) * COALESCE(p.stock, 0)), 0) as total_weight,
            COALESCE(SUM(COALESCE(p.selling_price, 0) * COALESCE(p.stock, 0)), 0) as total_value,
            COALESCE(AVG(COALESCE(p.selling_price, 0)), 0) as avg_price
        FROM products p
        LEFT JOIN gem_details g ON g.product_id = p.id AND g.variant_id IS NULL
        WHERE (p.is_archived IS NULL OR p.is_archived = 0) AND COALESCE(p.stock, 0) > 0
        GROUP BY COALESCE(g.origin, 'Unknown')
        ORDER BY total_value DESC
    `).all() as any[];

    return rows;
}

// ── Carat Weight Analysis Report ─────────────────────────────────────────────
export async function getCaratAnalysisReport() {
    await requireSession();
    const db = await getDb();

    const rows = await db.prepare(`
        SELECT
            CASE
                WHEN g.carat_weight < 0.5  THEN '0.00 – 0.49 ct'
                WHEN g.carat_weight < 1.0  THEN '0.50 – 0.99 ct'
                WHEN g.carat_weight < 2.0  THEN '1.00 – 1.99 ct'
                WHEN g.carat_weight < 5.0  THEN '2.00 – 4.99 ct'
                WHEN g.carat_weight < 10.0 THEN '5.00 – 9.99 ct'
                ELSE '10.00+ ct'
            END as weight_range,
            COUNT(p.id) as product_count,
            COALESCE(SUM(p.stock), 0) as total_pieces,
            COALESCE(SUM(g.carat_weight * p.stock), 0) as total_carats,
            COALESCE(SUM(p.selling_price * p.stock), 0) as total_value,
            COALESCE(AVG(CASE WHEN COALESCE(g.carat_weight, 0) > 0 
                THEN COALESCE(p.selling_price, 0) / g.carat_weight 
                ELSE NULL END), 0) as avg_price_per_carat
        FROM products p
        LEFT JOIN gem_details g ON g.product_id = p.id AND g.variant_id IS NULL
        WHERE (p.is_archived IS NULL OR p.is_archived = 0)
          AND p.stock > 0
          AND g.carat_weight IS NOT NULL AND g.carat_weight > 0
        GROUP BY weight_range
        ORDER BY MIN(g.carat_weight)
    `).all() as any[];

    return rows;
}

// ── Treatment Analysis Report ─────────────────────────────────────────────────
export async function getGemTreatmentReport() {
    await requireSession();
    const db = await getDb();

    return await db.prepare(`
        SELECT
            COALESCE(g.treatment, 'Not Specified') as treatment,
            COUNT(p.id) as product_count,
            COALESCE(SUM(p.stock), 0) as total_pieces,
            COALESCE(SUM(g.carat_weight * p.stock), 0) as total_weight,
            COALESCE(SUM(p.selling_price * p.stock), 0) as total_value
        FROM products p
        LEFT JOIN gem_details g ON g.product_id = p.id AND g.variant_id IS NULL
        WHERE (p.is_archived IS NULL OR p.is_archived = 0) AND p.stock > 0
        GROUP BY COALESCE(g.treatment, 'Not Specified')
        ORDER BY total_value DESC
    `).all() as any[];
}



