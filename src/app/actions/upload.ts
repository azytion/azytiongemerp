'use server';

import { writeFile, mkdir } from 'fs/promises';
import { randomUUID } from 'crypto';
import { getProductUploadDir, getAppUploadDir, getCompanyUploadDir } from '@/lib/runtime-paths';
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

/** Upload a company logo without storing its base64 bytes in the settings table. */
export async function uploadCompanyLogo(formData: FormData) {
    try {
        await requireAnyRole(['manager', 'admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const file = formData.get('file') as File | null;
    if (!file) return { success: false, error: 'No logo selected' };

    try {
        const extension = (file.name.split('.').pop() || '').toLowerCase();
        const allowedExtensions = new Set(['png', 'jpg', 'jpeg', 'webp']);
        if (!file.type.startsWith('image/') || !allowedExtensions.has(extension)) {
            return { success: false, error: 'Use a PNG, JPG, or WebP image' };
        }
        if (file.size > 2 * 1024 * 1024) {
            return { success: false, error: 'Logo is too large (maximum 2 MB)' };
        }

        const uploadDir = getCompanyUploadDir();
        await mkdir(uploadDir, { recursive: true });
        const fileName = `logo_${randomUUID()}.${extension}`;
        await writeFile(`${uploadDir}/${fileName}`, Buffer.from(await file.arrayBuffer()));

        return { success: true, imageUrl: `/uploads/company/${fileName}` };
    } catch (error) {
        console.error('Company logo upload error:', error);
        return { success: false, error: 'Failed to upload company logo' };
    }
}

/**
 * Upload an app branding image (icon, logos).
 * Saves to public/uploads/app/ with a fixed name so it can be referenced predictably.
 * Only super_admin can call this.
 */
export async function uploadAppImage(formData: FormData, slot: string) {
    try {
        await requireAnyRole(['super_admin']);
    } catch (error) {
        return authError(error);
    }

    // Validate slot name — must be a known key to prevent path traversal
    const VALID_SLOTS = new Set(['icon', 'logo_sidebar', 'logo_login', 'logo_light']);
    if (!VALID_SLOTS.has(slot)) {
        return { success: false, error: 'Invalid slot name' };
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
        if (typeof size === 'number' && size > 2 * 1024 * 1024) {
            return { success: false, error: 'File too large (max 2MB)' };
        }

        const ALLOWED = new Set(['png', 'jpg', 'jpeg', 'webp', 'svg']);
        const extension = (file.name.split('.').pop() || '').toLowerCase();
        if (!ALLOWED.has(extension)) {
            return { success: false, error: 'Unsupported format (png, jpg, webp, svg allowed)' };
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const uploadDir = getAppUploadDir();
        await mkdir(uploadDir, { recursive: true });

        // Use a versioned UUID filename so browsers don't cache the old image
        const fileName = `${slot}_${randomUUID()}.${extension}`;
        const filePath = `${uploadDir}/${fileName}`;
        await writeFile(filePath, buffer);

        return { success: true, imageUrl: `/api/uploads/app/${fileName}` };
    } catch (error: any) {
        console.error('App image upload error:', error);
        return { success: false, error: 'Failed to upload image' };
    }
}
