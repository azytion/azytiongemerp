import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

const BUNDLED_ICON = path.join(process.cwd(), 'public', 'azytion-app-icon-512.png');

function contentTypeFor(filePath: string) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.svg') return 'image/svg+xml';
    if (ext === '.webp') return 'image/webp';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.ico') return 'image/x-icon';
    return 'image/png';
}

export async function GET() {
    try {
        const buffer = await readFile(BUNDLED_ICON);

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': contentTypeFor(BUNDLED_ICON),
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch {
        return NextResponse.json({ error: 'Icon not found' }, { status: 404 });
    }
}
