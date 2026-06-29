import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { initDb } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        // Always require the setup secret — in all environments
        const configuredSecret = process.env.SETUP_SECRET;
        // Only accept via header — never via query param (query params appear in server logs)
        const providedSecret = request.headers.get('x-setup-secret');

        if (!configuredSecret || !providedSecret || providedSecret !== configuredSecret) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await initDb();
        return NextResponse.json({ message: 'Database initialized successfully' });
    } catch {
        // Never expose internal error details
        return NextResponse.json({ error: 'Failed to initialize database' }, { status: 500 });
    }
}
