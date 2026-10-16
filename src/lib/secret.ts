import { scryptSync, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import os from 'node:os';

// Salt is public — it only prevents rainbow tables against the derived key
const SCRYPT_SALT = 'azytion-pos-key-v2';

function getKey(): Buffer {
    const secret = process.env.SECRET_KEY;
    if (process.env.NODE_ENV === 'production' && !secret) {
        // In production without SECRET_KEY, fall back to JWT_SECRET so encrypted
        // settings are still consistently decryptable across restarts.
        // If neither is set, the server will throw at JWT level first — so
        // this fallback is a last-resort safety net.
        const jwt = process.env.JWT_SECRET;
        if (jwt) return scryptSync(jwt, SCRYPT_SALT, 32);
        throw new Error('SECRET_KEY environment variable must be set in production');
    }
    // Dev: use SECRET_KEY > hostname > fixed default (for reproducibility on same machine)
    const id = secret || os.hostname() || 'azytion-pos-dev-host';
    return scryptSync(id, SCRYPT_SALT, 32);
}

export function encryptSecret(plain: string): string {
    const key = getKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(Buffer.from(plain, 'utf8')), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `enc:${iv.toString('base64')}:${enc.toString('base64')}:${tag.toString('base64')}`;
}

export function decryptSecret(val: string): string {
    if (!val || !val.startsWith('enc:')) return val || '';
    const parts = val.split(':');
    if (parts.length !== 4) return val;
    const iv = Buffer.from(parts[1], 'base64');
    const data = Buffer.from(parts[2], 'base64');
    const tag = Buffer.from(parts[3], 'base64');
    const key = getKey();
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(data), decipher.final()]);
    return dec.toString('utf8');
}

export const SENSITIVE_KEYS = new Set([
    'smtp_pass',
    'smtp_user',
    'smtp_password',
    'email_password',
    'api_key',
    'gemini_api_key',
    'openai_api_key',
    'webhook_secret',
    'jwt_secret_override',
]);
