'use server';

import { writeFile, mkdir } from 'fs/promises';
import { randomUUID } from 'crypto';
import { getProductUploadDir } from '@/lib/runtime-paths';
import { authError, requireAnyRole } from './authz';

export async function uploadProductImage(formData: FormData) {
    try {
        await requireAnyRole(['manager', 'admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const file = formData.get('file') as File;
    if (!file) {
        return { success: false, error: 'No file uploaded' };
    }

    try {
        const mime = (file as any).type as string | undefined;
        const size = (file as any).size as number | undefined;
        if (!mime || !mime.startsWith('image/')) {
            return { success: false, error: 'Only image files are allowed' };
        }
        if (typeof size === 'number' && size > 5 * 1024 * 1024) {
            return { success: false, error: 'File too large (max 5MB)' };
        }

        const ALLOWED = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);
        const extension = (file.name.split('.').pop() || '').toLowerCase();
        if (!ALLOWED.has(extension)) {
            return { success: false, error: 'Unsupported image format' };
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const uploadDir = getProductUploadDir();
        await mkdir(uploadDir, { recursive: true });

        const fileName = `${randomUUID()}.${extension}`;
        const filePath = `${uploadDir}/${fileName}`;
        await writeFile(filePath, buffer);

        return { success: true, imageUrl: `/uploads/products/${fileName}` };
    } catch (error: any) {
        console.error('Upload Error:', error);
        return { success: false, error: 'Failed to upload image' };
    }
}

export async function saveAIImageLocally(externalUrl: string) {
    try {
        await requireAnyRole(['manager', 'admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    try {
        const response = await fetch(externalUrl);
        if (!response.ok) throw new Error('Failed to fetch AI image');

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const uploadDir = getProductUploadDir();
        await mkdir(uploadDir, { recursive: true });

        const fileName = `ai_${randomUUID()}.png`;
        const filePath = `${uploadDir}/${fileName}`;
        await writeFile(filePath, buffer);

        return { success: true, imageUrl: `/uploads/products/${fileName}` };
    } catch (error: any) {
        console.error('Save AI Image Error:', error);
        return { success: false, error: 'Failed to save AI image locally' };
    }
}
