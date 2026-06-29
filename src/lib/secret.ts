import { scryptSync, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import os from 'node:os';

function getKey(): Buffer {
    // In a web app, we should use an environment variable for the secret key.
    // Falling back to hostname or a default for now, but recommend setting PROCESS.ENV.SECRET_KEY
    const id = process.env.SECRET_KEY || os.hostname() || 'zation-pos-host';
    return scryptSync(id, 'zation-pos-key', 32);
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
