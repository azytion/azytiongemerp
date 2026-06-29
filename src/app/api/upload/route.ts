import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { getSession } from '@/app/actions/auth';
import { getUploadRoot } from '@/lib/runtime-paths';

const ALLOWED_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif']);
const ALLOWED_MIME_PREFIXES = ['image/', 'application/pdf'];
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
    const session = await getSession() as { role?: string } | null;
    if (!session || !['manager', 'admin', 'super_admin'].includes(session.role || '')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const mime = file.type || 'application/octet-stream';
        const extension = (file.name.split('.').pop() || '').toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(extension) || !ALLOWED_MIME_PREFIXES.some(prefix => mime.startsWith(prefix))) {
            return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
        }

        if (file.size > MAX_UPLOAD_BYTES) {
            return NextResponse.json({ error: 'File too large' }, { status: 400 });
        }

        const uploadDir = path.join(getUploadRoot(), 'documents');
        await mkdir(uploadDir, { recursive: true });

        const fileName = `${randomUUID()}.${extension}`;
        const filePath = path.join(uploadDir, fileName);
        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(filePath, buffer);

        return NextResponse.json({ url: `/uploads/documents/${fileName}` });
    } catch (error) {
        console.error('Upload API error:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
