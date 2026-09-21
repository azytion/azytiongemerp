'use server';


import { requireSession, requireAnyRole } from './authz';
import { getDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { getSession } from './auth';
import { encryptSecret, decryptSecret, SENSITIVE_KEYS } from '@/lib/secret';
import { normalizeAppName } from '@/lib/branding';

export type Setting = {
    id: number;
    key: string;
    value: string;
    category: string;
    data_type: string;
    updated_at: string;
    updated_by: number | null;
};

export async function getSetting(key: string): Promise<string | null> {
    try {
        await requireSession();
    } catch {
        return null;
    }
    const db = await getDb();
    const setting = await db.prepare('SELECT value FROM settings WHERE `key` = ?').get(key) as { value: string } | undefined;
    if (!setting?.value) return null;
    const val = setting.value;
    const value = SENSITIVE_KEYS.has(key) ? decryptSecret(val) : val;
    return key === 'company_name' ? normalizeAppName(value) : value;
}

export async function getSettings(category?: string): Promise<Record<string, string>> {
    // getSettings is also called from QueryProvider on initial load (before session is
    // confirmed) and from cron/backup. Allow it to proceed without a hard auth throw —
    // it returns only non-sensitive keys; sensitive values are encrypted at rest.
    try {
        const db = await getDb();

        let query = 'SELECT `key`, value FROM settings';
        const params: string[] = [];

        if (category) {
            query += ' WHERE category = ?';
            params.push(category);
        }

        const settings = await db.prepare(query).all(...params) as { key: string; value: string }[];

        const session = await getSession();
        const result: Record<string, string> = {};
        settings.forEach(setting => {
            try {
                let value = SENSITIVE_KEYS.has(setting.key) ? decryptSecret(setting.value) : setting.value;
                if (!session && SENSITIVE_KEYS.has(setting.key)) {
                    value = '********';
                }
                result[setting.key] = setting.key === 'company_name' ? normalizeAppName(value) : value;
            } catch {
                result[setting.key] = setting.key === 'company_name' ? normalizeAppName(setting.value) : setting.value;
            }
        });

        return result;
    } catch (err) {
        console.error('--- Server Action: getSettings Error ---', err);
        return {};
    }
}

export async function getAllSettings(): Promise<Setting[]> {
    await requireSession();
    const db = await getDb();
    const settings = await db.prepare('SELECT * FROM settings ORDER BY category, `key`').all() as Setting[];
    return settings;
}

export async function saveInitialTimezone(timezone: string) {
    try {
        const session = await getSession();
        if (!session?.sub) {
            return { success: false, reason: 'unauthenticated' };
        }
        return await updateSetting('timezone', timezone, 'system');
    } catch {
        return { success: false };
    }
}

export async function updateSetting(key: string, value: string, category: string, userId: number = 1) {
    try {
        await requireSession();
    } catch {
        return { success: false, error: 'Unauthorized' };
    }
    const db = await getDb();

    try {
        const session = await getSession();
        // Allow updates if user is super_admin OR if the session is valid (for other settings)
        // If no session exists (e.g. initial setup), we might want to allow it or check a secret
        if (!session) {
            // For safety, if no session, only allow certain keys or require a setup flag
            // But usually, the user is logged in as admin to see settings page.
        }

        const isSuperAdmin = session?.role === 'super_admin';

        // Security: Restrict sensitive categories to Super Admin only
        const sensitiveCategories = ['subscription', 'features', 'app']; // 'app' is super_admin-only SaaS branding
        if (sensitiveCategories.includes(category) && !isSuperAdmin) {
            return { success: false, error: 'Unauthorized: Only Super Admins can modify these settings.' };
        }

        await db.prepare(`
            INSERT INTO settings (\`key\`, value, updated_at, updated_by, category)
            VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)
            ON DUPLICATE KEY UPDATE
                value = VALUES(value),
                updated_at = CURRENT_TIMESTAMP,
                updated_by = VALUES(updated_by)
        `).run(key, SENSITIVE_KEYS.has(key) ? encryptSecret(value) : value, userId, category);

        revalidatePath('/settings');
        if (key === 'timezone') {
            const { invalidateTimezoneCache } = await import('@/lib/datetime');
            invalidateTimezoneCache();
        }
        return { success: true };
    } catch (error) {
        console.error('Error updating setting:', error);
        return { success: false, error: 'Failed to update setting' };
    }
}

export async function updateSettings(settings: Record<string, string>, userId: number = 1) {
    try {
        await requireSession();
    } catch {
        return { success: false, error: 'Unauthorized' };
    }
    const db = await getDb();

    try {
        const session = await getSession();
        const isSuperAdmin = session?.role === 'super_admin';

        const result = db.transaction(async () => {
            for (const [key, value] of Object.entries(settings)) {
                // Determine category if possible, or use 'system' as default
                const current = await db.prepare('SELECT category FROM settings WHERE key = ?').get(key) as { category: string } | undefined;
                const category = current?.category || 'system';

                // Security: Restrict sensitive categories
                const sensitiveCategories = ['subscription', 'features', 'app'];
                if (sensitiveCategories.includes(category) && !isSuperAdmin) {
                    throw new Error('UNAUTHORIZED_SETTINGS_UPDATE');
                }

                // For app_* keys that may not yet exist in DB, use 'app' category
                const resolvedCategory = !current && key.startsWith('app_') ? 'app' : category;

                await db.prepare(`
                    INSERT INTO settings (\`key\`, value, updated_at, updated_by, category)
                    VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        value = VALUES(value),
                        updated_at = CURRENT_TIMESTAMP,
                        updated_by = VALUES(updated_by)
                `).run(key, SENSITIVE_KEYS.has(key) ? encryptSecret(value) : value, userId, resolvedCategory);
            }
        });

        await result();
        revalidatePath('/settings');
        // Invalidate timezone cache if timezone was changed
        if (Object.keys(settings).includes('timezone')) {
            const { invalidateTimezoneCache } = await import('@/lib/datetime');
            invalidateTimezoneCache();
        }
        return { success: true };
    } catch (error) {
        console.error('Error updating settings:', error);
        return { success: false, error: 'Failed to update settings' };
    }
}

export async function resetSettings(category?: string) {
    await requireAnyRole(['admin', 'super_admin']);
    const db = await getDb();

    const defaultSettings: Record<string, string> = {
        company_name: 'Azytion GemERP',
        company_address: '',
        company_phone: '+94752723544',
        company_email: 'azytionlk@gmail.com',
        company_website: 'www.azytion.com',
        company_tax_id: '',
        company_logo: '',
        tax_enabled: 'false',
        tax_rate: '0',
        tax_name: 'Tax',
        tax_inclusive: 'false',
        receipt_header: '',
        receipt_footer: 'Thank you for your business!',
        receipt_promotional_footer: 'Powered By Azytion | +94752723544',
        receipt_show_logo: 'true',
        receipt_show_barcode: 'true',
        receipt_paper_size: 'a4',
        currency_symbol: '$',
        currency_code: 'USD',
        exchange_rates_enabled: 'false',
        exchange_display_currency: '',
        exchange_rates: '[]',
        date_format: 'MM/DD/YYYY',
        time_format: '12h',
        low_stock_threshold: '10',
        email_notifications: 'true',
        low_stock_alerts: 'true'
    };

    try {
        if (category) {
            const categorySettings = await db.prepare('SELECT key FROM settings WHERE category = ?').all(category) as { key: string }[];

            for (const setting of categorySettings) {
                if (defaultSettings[setting.key] !== undefined) {
                    await db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(defaultSettings[setting.key], setting.key);
                }
            }
        } else {
            for (const [key, value] of Object.entries(defaultSettings)) {
                await db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(value, key);
            }
        }

        revalidatePath('/settings');
        return { success: true };
    } catch (error) {
        console.error('Error resetting settings:', error);
        return { success: false, error: 'Failed to reset settings' };
    }
}

export async function getSettingsByCategory() {
    await requireSession();
    const db = await getDb();
    const settings = await db.prepare('SELECT * FROM settings ORDER BY category, key').all() as Setting[];

    const grouped: Record<string, Setting[]> = {};
    settings.forEach(setting => {
        if (!grouped[setting.category]) {
            grouped[setting.category] = [];
        }
        grouped[setting.category].push(setting);
    });

    return grouped;
}

export async function logActivity(userId: number | null, action: string, entityType: string, entityId: number | null, details: string) {
    await requireSession();
    const db = await getDb();
    try {
        await db.prepare(`
            INSERT INTO user_activity_log (user_id, action, entity_type, entity_id, new_values, timestamp)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(userId, action, entityType, entityId, details);
        return { success: true };
    } catch (error) {
        console.error('Error logging activity:', error);
        // Don't throw for logging errors, just return false
        return { success: false };
    }
}
