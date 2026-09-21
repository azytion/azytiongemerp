import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { ensureChildPath, getAppUploadDir } from '@/lib/runtime-paths';

function contentTypeFor(filePath: string) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.svg') return 'image/svg+xml';
    if (ext === '.webp') return 'image/webp';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    return 'image/png';
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ filename: string }> }
) {
    try {
        const { filename } = await params;
        const filePath = ensureChildPath(getAppUploadDir(), filename);
        const buffer = await readFile(filePath);

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': contentTypeFor(filePath),
                'Cache-Control': 'no-store, max-age=0',
            },
        });
    } catch {
        return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }
}
