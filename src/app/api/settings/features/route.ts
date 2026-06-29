import { NextResponse } from 'next/server';
import { getSession } from '@/app/actions/auth';
import { getDb } from '@/lib/db';

export async function GET() {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const db = await getDb();
        const rows = await db.prepare(
            "SELECT `key`, value FROM settings WHERE `key` LIKE 'feature_%'"
        ).all() as { key: string; value: string }[];

        const result: Record<string, string> = {};
        for (const row of rows) {
            result[row.key] = row.value;
        }
        return NextResponse.json(result);
    } catch {
        return NextResponse.json({});
    }
}
