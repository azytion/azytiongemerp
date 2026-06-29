
import { getDb } from '../lib/db';

type WeightRange = '0-0.49' | '0.50-0.99' | '1.00-1.99' | '2.00-4.99' | '5.00+';

type GemStockGroup = {
    category: string;
    shape: string;
    ranges: Record<WeightRange, {
        count: number;
        weight: number;
        value: number;
    }>;
    total: {
        count: number;
        weight: number;
        value: number;
    }
};

async function verifyGemReport() {
    const db = await getDb();
    const testPrefix = `TEST_REP_${Date.now()}`;

    console.log('1. Seeding Gem Data...');

    // Create Category
    const catRes = await db.prepare("INSERT INTO categories (name) VALUES (?)").run(`${testPrefix}_Sapphire`);
    const catId = catRes.lastInsertRowid;

    // Helper to create product
    const createGem = (weight: number, shape: string, pricePerCarat: number, qty: number) => {
        const pRes = await db.prepare(`
            INSERT INTO products (name, category_id, stock, cost_price, selling_price, pricing_method)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(`${testPrefix}_Gem`, catId, qty, 100, pricePerCarat, 'per_carat');
        const pid = pRes.lastInsertRowid;

        await db.prepare(`
            INSERT INTO gem_details (product_id, carat_weight, shape)
            VALUES (?, ?, ?)
        `).run(pid, weight, shape);

        return pid;
    };

    // Create gems in different ranges
    const _p1 = createGem(0.4, 'Round', 1000, 2); // Range 0-0.49
    const _p2 = createGem(1.5, 'Oval', 2000, 1);   // Range 1.00-1.99
    const _p3 = createGem(6.0, 'Oval', 5000, 1);   // Range 5.00+

    console.log('2. Running Report Logic...');

    // --- Logic from reports_gem.ts ---
    const products = await db.prepare(`
        SELECT 
            p.id, p.name, p.category_id, c.name as category_name,
            p.cost_price, p.selling_price, p.stock, p.pricing_method,
            g.carat_weight, g.shape
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN gem_details g ON (g.product_id = p.id AND g.variant_id IS NULL)
        WHERE (p.category_id = ?) 
    `).all(catId) as any[];

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

    const groups: Map<string, GemStockGroup> = new Map();

    for (const item of products) {
        const category = item.category_name || 'Uncategorized';
        const shape = item.shape || 'Other';
        const key = `${category}|${shape}`;

        if (!groups.has(key)) {
            groups.set(key, initGroup(category, shape));
        }

        const group = groups.get(key)!;
        const weightPerPiece = item.carat_weight || 0;
        const totalWeight = weightPerPiece * item.stock;

        let totalValue = 0;
        if (item.pricing_method === 'per_carat') {
            totalValue = item.selling_price * totalWeight;
        } else {
            totalValue = item.selling_price * item.stock;
        }

        const range = getRange(weightPerPiece);

        group.ranges[range].count += item.stock;
        group.ranges[range].weight += totalWeight;
        group.ranges[range].value += totalValue;
    }
    // ---------------------------------

    console.log('3. Verifying Results...');
    let passed = true;

    // Check Round Group
    const roundKey = `${testPrefix}_Sapphire|Round`;
    const roundGroup = groups.get(roundKey);
    if (!roundGroup) {
        console.error('FAIL: Round group missing');
        passed = false;
    } else {
        if (roundGroup.ranges['0-0.49'].count !== 2) {
            console.error(`FAIL: Round 0-0.49 count mismatch. Expected 2, got ${roundGroup.ranges['0-0.49'].count}`);
            passed = false;
        }
    }

    // Check Oval Group
    const ovalKey = `${testPrefix}_Sapphire|Oval`;
    const ovalGroup = groups.get(ovalKey);
    if (!ovalGroup) {
        console.error('FAIL: Oval group missing');
        passed = false;
    } else {
        if (ovalGroup.ranges['1.00-1.99'].count !== 1) console.error('FAIL: Oval 1.00-1.99 count mismatch');
        if (ovalGroup.ranges['5.00+'].count !== 1) console.error('FAIL: Oval 5.00+ count mismatch');
    }

    if (passed) {
        console.log('SUCCESS: Report aggregation logic verified!');
    }

    // Cleanup
    console.log('4. Cleanup...');
    await db.prepare("DELETE FROM gem_details WHERE product_id IN (SELECT id FROM products WHERE category_id = ?)").run(catId);
    await db.prepare("DELETE FROM products WHERE category_id = ?").run(catId);
    await db.prepare("DELETE FROM categories WHERE id = ?").run(catId);
}

verifyGemReport().catch(console.error);
