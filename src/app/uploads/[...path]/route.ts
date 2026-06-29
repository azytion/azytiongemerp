import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { ensureChildPath, getUploadRoot, getJwtSecret } from '@/lib/runtime-paths';

async function requireUploadSession() {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    if (!token) return false;
    try {
        const secret = new TextEncoder().encode(getJwtSecret());
        await jwtVerify(token, secret);
        return true;
    } catch {
        return false;
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        if (!(await requireUploadSession())) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const { path: pathParts } = await params;
        const filePath = pathParts.join('/');
        const fullPath = ensureChildPath(getUploadRoot(), filePath);

        if (!existsSync(fullPath)) {
            return new NextResponse('Not Found', { status: 404 });
        }

        const fileBuffer = await readFile(fullPath);
        const extension = filePath.split('.').pop()?.toLowerCase();

        let contentType = 'application/octet-stream';
        if (extension === 'png') contentType = 'image/png';
        else if (extension === 'jpg' || extension === 'jpeg') contentType = 'image/jpeg';
        else if (extension === 'webp') contentType = 'image/webp';
        else if (extension === 'gif') contentType = 'image/gif';
        else if (extension === 'svg') contentType = 'image/svg+xml';

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': contentType,
                'X-Content-Type-Options': 'nosniff',
                'Cache-Control': 'private, max-age=3600',
            },
        });
    } catch (error) {
        console.error('Upload serve error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
