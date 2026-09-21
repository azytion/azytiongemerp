import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const APP_KEYS = [
    'app_name', 'app_tagline', 'app_description',
    'app_icon', 'app_logo_sidebar', 'app_logo_login', 'app_logo_light',
    'app_owner_phone', 'app_owner_phone_2',
    'app_owner_email', 'app_owner_website', 'app_copyright',
];

function normalizeAppImageUrl(key: string, value: string) {
    if (!key.startsWith('app_logo_') && key !== 'app_icon') return value;
    return value.replace(/^\/uploads\/app\//, '/api/uploads/app/');
}

// Public endpoint — returns only non-sensitive app branding keys.
// No auth required so the login page can fetch branding before the user logs in.
export async function GET() {
    try {
        const db = await getDb();
        const placeholders = APP_KEYS.map(() => '?').join(', ');
        const rows = await db.prepare(
            `SELECT \`key\`, value FROM settings WHERE \`key\` IN (${placeholders})`
        ).all(...APP_KEYS) as { key: string; value: string }[];

        const result: Record<string, string> = {};
        rows.forEach(r => { result[r.key] = normalizeAppImageUrl(r.key, r.value); });

        return NextResponse.json(result, {
            headers: { 'Cache-Control': 'no-store, max-age=0' },
        });
    } catch {
        return NextResponse.json({});
    }
}
