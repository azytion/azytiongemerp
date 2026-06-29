import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { APP_NAME, normalizeAppName } from '@/lib/branding';

export async function GET() {
    try {
        const db = await getDb();
        const setting = await db.prepare('SELECT value FROM settings WHERE key = ?').get('company_name') as { value: string } | undefined;

        return NextResponse.json({ value: normalizeAppName(setting?.value) });
    } catch (_error) {
        return NextResponse.json({ value: APP_NAME });
    }
}
