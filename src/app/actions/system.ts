'use server';

import { closeDb, initDb, getDb } from '@/lib/db';
import path from 'path';
import fs from 'fs';
import { revalidatePath } from 'next/cache';
import { authError, requireAnyRole, requireMinRole } from './authz';
import { getProductUploadDir } from '@/lib/runtime-paths';

export async function restoreDatabase(formData: FormData) {
    try {
        await requireMinRole('super_admin');
    } catch (error) {
        return authError(error);
    }

    const file = formData.get('file') as File | null;
    if (!file) {
        return { success: false, error: 'No backup file provided.' };
    }

    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.db') || fileName.endsWith('.sqlite')) {
        return {
            success: false,
            error: 'SQLite database files (.db) from the old desktop app are not supported. Use Data Management → Import ZIP for Excel backups, or upload a MySQL .sql backup from Download Backup.',
        };
    }

    if (!fileName.endsWith('.sql')) {
        return {
            success: false,
            error: 'Unsupported file type. Upload a MySQL .sql backup (from Download Backup) or use Data Management to import Excel/ZIP exports.',
        };
    }

    try {
        const sql = await file.text();
        if (!sql.trim()) {
            return { success: false, error: 'The SQL backup file is empty.' };
        }

        const db = await getDb();
        await db.exec(sql);
        revalidatePath('/', 'layout');
        return { success: true };
    } catch (error) {
        console.error('Database restore failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to restore database',
        };
    }
}

export async function vacuumDatabase() {
    try {
        await requireAnyRole(['admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    try {
        const db = await getDb();
        const tables = await db.prepare(
            `SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()`
        ).all() as { name: string }[];

        for (const { name } of tables) {
            try {
                await db.prepare(`OPTIMIZE TABLE \`${name}\``).run();
            } catch {
                /* skip views / unsupported */
            }
        }
        return { success: true };
    } catch (error) {
        console.error('Optimize failed:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Failed to optimize database' };
    }
}

export async function resetSystem() {
    let session;
    try {
        // Restrict to super_admin only — this wipes ALL data
        session = await requireMinRole('super_admin');
    } catch (error) {
        return authError(error);
    }

    try {
        const db = await getDb();
        console.log('SAFE SYSTEM RESET INITIATED BY:', (session as { username?: string }).username);

        const tablesToWipe = [
            'gem_details', 'product_variants', 'product_stock',
            'products', 'categories',
            'memo_items', 'memos',
            'sale_items', 'held_orders', 'sales',
            'purchase_order_items', 'purchase_orders',
            'credit_notes', 'cheque_history', 'cheques',
            'journal_entry_lines', 'journal_entries',
            'transactions', 'daybook', 'payment_accounts', 'accounts',
            'inventory_adjustments',
            'pos_discount_rules',
            'customers', 'suppliers', 'supplier_documents', 'brokers',
            'user_activity_log',
        ];

        await db.exec('SET FOREIGN_KEY_CHECKS = 0');

        const wipeData = db.transaction(async () => {
            for (const table of tablesToWipe) {
                try {
                    const exists = await db.prepare(
                        `SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`
                    ).get(table);
                    if (exists) {
                        await db.prepare(`DELETE FROM \`${table}\``).run();
                        console.log(`Wiped table: ${table}`);
                    }
                } catch (tableError: unknown) {
                    console.error(`Error wiping table ${table}:`, tableError);
                }
            }
        });

        await wipeData();
        await db.exec('SET FOREIGN_KEY_CHECKS = 1');

        revalidatePath('/', 'layout');

        try {
            const uploadsDir = getProductUploadDir();
            if (fs.existsSync(uploadsDir)) {
                for (const file of fs.readdirSync(uploadsDir)) {
                    try {
                        fs.unlinkSync(path.join(uploadsDir, file));
                    } catch { /* skip locked files */ }
                }
            }
        } catch (e) {
            console.error('Failed to clear uploads:', e);
        }

        return { success: true };
    } catch (error) {
        console.error('Reset failed:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Reset failed' };
    }
}

export async function reinitializeDatabase() {
    try {
        await requireMinRole('super_admin');
    } catch (error) {
        return authError(error);
    }
    await closeDb();
    await initDb();
    return { success: true };
}
