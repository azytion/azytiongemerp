
import { getDb } from '../lib/db';

async function verifyGemInvoice() {
    const db = await getDb();
    const testPrefix = `TEST_${Date.now()}`;

    console.log('1. Creating test product with gem details...');
    // 1. Insert Product
    const productResult = await db.prepare(`
        INSERT INTO products (name, barcode, stock, cost_price, selling_price, pricing_method)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(`${testPrefix}_Sapphire`, `${testPrefix}_BC`, 1, 100, 200, 'per_carat');
    const productId = productResult.lastInsertRowid;

    // 2. Insert Gem Details
    await db.prepare(`
        INSERT INTO gem_details (product_id, carat_weight, shape, color, clarity, certificate_number)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(productId, 2.5, 'Oval', 'Royal Blue', 'VVS', 'GIA-123456');

    console.log('2. Creating test sale...');
    // 3. Insert Sale
    const saleResult = await db.prepare(`
        INSERT INTO sales (invoice_number, total_amount, payment_method)
        VALUES (?, ?, ?)
    `).run(`${testPrefix}_INV`, 500, 'Cash');
    const saleId = saleResult.lastInsertRowid;

    // 4. Insert Sale Item
    await db.prepare(`
        INSERT INTO sale_items (sale_id, product_id, quantity, price)
        VALUES (?, ?, ?, ?)
    `).run(saleId, productId, 1, 500);

    console.log('3. Running getSaleDetails Query...');
    // 5. Run the Query (Copied from src/app/actions/sales.ts)
    const items = await db.prepare(`
        SELECT si.*, p.name as product_name, v.name as variant_name,
               g.carat_weight, g.shape, g.color, g.clarity, g.origin, g.certificate_number
        FROM sale_items si 
        LEFT JOIN products p ON si.product_id = p.id 
        LEFT JOIN product_variants v ON si.variant_id = v.id 
        LEFT JOIN gem_details g ON (g.product_id = p.id AND (g.variant_id = si.variant_id OR (si.variant_id IS NULL AND g.variant_id IS NULL)))
        WHERE si.sale_id = ?
    `).all(saleId) as any[];

    console.log('4. Verification Results:');
    if (items.length > 0) {
        const item = items[0];
        console.log('Item Name:', item.product_name);
        console.log('Carat Weight:', item.carat_weight);
        console.log('Shape:', item.shape);
        console.log('Color:', item.color);

        if (item.carat_weight === 2.5 && item.shape === 'Oval' && item.color === 'Royal Blue') {
            console.log('SUCCESS: Gemstone details correctly retrieved!');
        } else {
            console.error('FAILURE: Gemstone details missing or incorrect.');
        }
    } else {
        console.error('FAILURE: No items found.');
    }

    // Cleanup
    console.log('5. Cleaning up...');
    await db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(saleId);
    await db.prepare('DELETE FROM sales WHERE id = ?').run(saleId);
    await db.prepare('DELETE FROM gem_details WHERE product_id = ?').run(productId);
    await db.prepare('DELETE FROM products WHERE id = ?').run(productId);
}

verifyGemInvoice().catch(console.error);
