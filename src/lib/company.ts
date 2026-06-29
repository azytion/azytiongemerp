import { getDb } from '@/lib/db';
import { APP_NAME, normalizeAppName } from '@/lib/branding';

export async function getCompanyName(): Promise<string> {
    try {
        const db = await getDb();
        const setting = await db.prepare('SELECT value FROM settings WHERE key = ?').get('company_name') as { value: string } | undefined;
        return normalizeAppName(setting?.value);
    } catch (_error) {
        return APP_NAME;
    }
}

export async function getCompanySettings() {
    try {
        const db = await getDb();
        const settings = await db.prepare(`
            SELECT key, value FROM settings 
            WHERE category = 'company'
        `).all() as { key: string; value: string }[];

        const settingsMap: Record<string, string> = {};
        settings.forEach(s => {
            settingsMap[s.key] = s.value;
        });

        return {
            name: normalizeAppName(settingsMap.company_name),
            address: settingsMap.company_address || '',
            phone: settingsMap.company_phone || '',
            email: settingsMap.company_email || '',
            website: settingsMap.company_website || '',
            taxId: settingsMap.company_tax_id || '',
            logo: settingsMap.company_logo || '',
        };
    } catch (_error) {
        return {
            name: APP_NAME,
            address: '',
            phone: '',
            email: '',
            website: '',
            taxId: '',
            logo: '',
        };
    }
}
