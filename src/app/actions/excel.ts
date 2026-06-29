'use server';

import { getDb } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { authError, requireAnyRole } from './authz';
import { aoaToXlsxBuffer, rowsToXlsxBuffer, xlsxBufferToRows } from '@/lib/excel-utils';

export type EntityType = 'products' | 'customers' | 'suppliers' | 'users' | 'sales' | 'brokers' | 'memos';

export async function generateExcelTemplate(entityType: EntityType) {
    const headers: Record<EntityType, string[]> = {
        products: ['barcode', 'name', 'category', 'stock', 'reorder_level', 'cost_price', 'selling_price', 'carat_weight', 'shape', 'color', 'clarity', 'origin', 'certificate_number', 'notes'],
        customers: ['name', 'phone', 'email', 'address'],
        suppliers: ['name', 'phone', 'email', 'address'],
        users: ['username', 'password', 'role'],
        brokers: ['name', 'phone', 'email', 'address', 'notes'],
        sales: ['invoice_number', 'customer_name', 'broker_name', 'broker_commission', 'total_amount', 'received_cash', 'payment_method', 'date'],
        memos: ['memo_number', 'customer_name', 'status', 'date_out', 'date_due', 'notes']
    };

    const templateHeaders = headers[entityType];

    const sampleData: Record<EntityType, any[]> = {
        products: [['PROD001', 'Blue Sapphire', 'Gemstones', 1, 0, 5000.00, 7500.00, 2.5, 'Oval', 'Blue', 'VVS1', 'Sri Lanka', 'GIA-123', 'Sample notes']],
        customers: [['John Doe', '+1234567890', 'john@example.com', '123 Main St', 100]],
        suppliers: [['ABC Supplies', '+0987654321', 'abc@supplier.com', '456 Supply Ave']],
        users: [['newuser', 'password123', 'cashier']],
        brokers: [['Jane Broker', '+1122334455', 'jane@broker.com', '789 Broker St', 'Top broker']],
        sales: [['INV-001', 'John Doe', 'Jane Broker', 10.00, 100.00, 100.00, 'Cash', new Date().toISOString()]],
        memos: [['MEM-001', 'John Doe', 'pending', new Date().toISOString().split('T')[0], '', 'Sample memo notes']]
    };

    const buffer = await aoaToXlsxBuffer([templateHeaders, ...sampleData[entityType]], entityType);

    return {
        success: true,
        data: buffer,
        filename: `${entityType}_template.xlsx`
    };
}

export async function exportToExcel(entityType: EntityType, _filters?: any) {
    try {
        await requireAnyRole(['admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db = await getDb();

    try {
        let data: any[] = [];

        switch (entityType) {
            case 'products':
                data = await db.prepare(`
                    SELECT 
                        p.barcode, p.name, c.name as category, p.stock, p.reorder_level, 
                        p.cost_price, p.selling_price, 
                        gd.carat_weight, gd.shape, gd.color, gd.clarity, gd.origin, gd.certificate_number,
                        p.notes
                    FROM products p
                    LEFT JOIN categories c ON p.category_id = c.id
                    LEFT JOIN gem_details gd ON p.id = gd.product_id
                    ORDER BY p.name
                `).all();
                break;

            case 'customers':
                data = await db.prepare(`
                    SELECT name, phone, email, address
                    FROM customers
                    ORDER BY name
                `).all();
                break;

            case 'suppliers':
                data = await db.prepare(`
                    SELECT name, phone, email, address
                    FROM suppliers
                    ORDER BY name
                `).all();
                break;

            case 'users':
                data = await db.prepare(`
                    SELECT username, role, created_at
                    FROM users
                    ORDER BY username
                `).all();
                break;

            case 'sales':
                data = await db.prepare(`
                    SELECT 
                        s.invoice_number,
                        c.name as customer_name,
                        b.name as broker_name,
                        s.broker_commission,
                        s.total_amount,
                        s.received_cash,
                        s.balance_to_return,
                        s.payment_method,
                        s.date,
                        s.status,
                        s.type
                    FROM sales s
                    LEFT JOIN customers c ON s.customer_id = c.id
                    LEFT JOIN brokers b ON s.broker_id = b.id
                    ORDER BY s.date DESC
                `).all();
                break;

            case 'brokers':
                data = await db.prepare(`
                    SELECT name, phone, email, address, notes, is_active
                    FROM brokers
                    ORDER BY name
                `).all();
                break;

            case 'memos':
                data = await db.prepare(`
                    SELECT m.memo_number, c.name as customer_name, m.status, m.date_out, m.date_due, m.notes
                    FROM memos m
                    LEFT JOIN customers c ON m.customer_id = c.id
                    ORDER BY m.date_out DESC
                `).all();
                break;
        }

        const buffer = await rowsToXlsxBuffer(data, entityType);

        const timestamp = new Date().toISOString().split('T')[0];

        return {
            success: true,
            data: buffer,
            filename: `${entityType}_export_${timestamp}.xlsx`
        };

    } catch (error) {
        console.error('Error exporting to Excel:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Export failed'
        };
    }
}

export async function importFromExcel(entityType: EntityType, fileBuffer: Buffer) {
    try {
        await requireAnyRole(['admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db = await getDb();

    try {
        const data = await xlsxBufferToRows(fileBuffer);

        if (data.length === 0) {
            return { success: false, error: 'No data found in Excel file' };
        }

        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];

        const transaction = db.transaction(async () => {
            for (const row of data as any[]) {
                try {
                    switch (entityType) {
                        case 'products':
                            // Check if product exists
                            const existingProduct = await db.prepare('SELECT id FROM products WHERE barcode = ?').get(row.barcode);
                            if (existingProduct) {
                                skipped++;
                                continue;
                            }

                            // Resolve category_id from category name
                            let resolvedCategoryId: number | null = null;
                            if (row.category) {
                                const existingCat = await db.prepare('SELECT id FROM categories WHERE name = ?').get(row.category) as { id: number } | undefined;
                                if (existingCat) {
                                    resolvedCategoryId = existingCat.id;
                                } else {
                                    // Create the category
                                    const newCat = await db.prepare('INSERT INTO categories (name) VALUES (?)').run(row.category);
                                    resolvedCategoryId = Number(newCat.lastInsertRowid);
                                }
                            }

                            await db.prepare(`
                                INSERT INTO products (barcode, name, category_id, stock, reorder_level, cost_price, selling_price, notes)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                            `).run(
                                row.barcode || null,
                                row.name,
                                resolvedCategoryId,
                                row.stock || 0,
                                row.reorder_level || 5,
                                row.cost_price,
                                row.selling_price,
                                row.notes || null
                            );
                            imported++;
                            break;

                        case 'customers':
                            const existingCustomer = await db.prepare('SELECT id FROM customers WHERE name = ? AND phone = ?').get(row.name, row.phone);
                            if (existingCustomer) {
                                skipped++;
                                continue;
                            }

                            await db.prepare(`
                                INSERT INTO customers (name, phone, email, address)
                                VALUES (?, ?, ?, ?)
                            `).run(row.name, row.phone || null, row.email || null, row.address || null);
                            imported++;
                            break;

                        case 'suppliers':
                            const existingSupplier = await db.prepare('SELECT id FROM suppliers WHERE name = ?').get(row.name);
                            if (existingSupplier) {
                                skipped++;
                                continue;
                            }

                            await db.prepare(`
                                INSERT INTO suppliers (name, phone, email, address)
                                VALUES (?, ?, ?, ?)
                            `).run(row.name, row.phone || null, row.email || null, row.address || null);
                            imported++;
                            break;

                        case 'users':
                            const existingUser = await db.prepare('SELECT id FROM users WHERE username = ?').get(row.username);
                            if (existingUser) {
                                skipped++;
                                continue;
                            }

                            const passwordHash = bcrypt.hashSync(String(row.password || ''), 10);

                            await db.prepare(`
                                INSERT INTO users (username, password_hash, role)
                                VALUES (?, ?, ?)
                            `).run(row.username, passwordHash, row.role || 'cashier');
                            imported++;
                            break;

                        case 'brokers':
                            const existingBroker = await db.prepare('SELECT id FROM brokers WHERE name = ? AND phone = ?').get(row.name, row.phone);
                            if (existingBroker) {
                                skipped++;
                                continue;
                            }

                            await db.prepare(`
                                INSERT INTO brokers (name, phone, email, address, notes)
                                VALUES (?, ?, ?, ?, ?)
                            `).run(row.name, row.phone || null, row.email || null, row.address || null, row.notes || null);
                            imported++;
                            break;
                    }
                } catch (err) {
                    errors.push(`Row error: ${err instanceof Error ? err.message : 'Unknown error'}`);
                }
            }
        });

        await transaction();

        return {
            success: true,
            data: {
                imported,
                skipped,
                errors,
                total: data.length
            }
        };

    } catch (error) {
        console.error('Error importing from Excel:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Import failed'
        };
    }
}
