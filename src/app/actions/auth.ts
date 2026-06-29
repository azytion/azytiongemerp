'use server';

import { getDb } from '@/lib/db';
import { SignJWT, jwtVerify } from 'jose';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { logActivity } from './activity-logger';
import { getJwtSecret } from '@/lib/runtime-paths';
import { checkRateLimit, resetRateLimit, LOGIN_RATE_LIMIT, SUPER_ADMIN_RATE_LIMIT } from '../../lib/rate-limit';

async function getSecretKey() {
    return new TextEncoder().encode(getJwtSecret());
}

/** Extract the best available client IP from request headers. */
async function getClientIp(): Promise<string> {
    try {
        const hdrs = await headers();
        return (
            hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            hdrs.get('x-real-ip') ||
            'unknown'
        );
    } catch {
        return 'unknown';
    }
}

/** Returns true if the string is a bcrypt hash ($2a$ or $2b$). */
function isBcryptHash(val: string): boolean {
    return val?.startsWith('$2a$') || val?.startsWith('$2b$') || val?.startsWith('$2y$');
}

/**
 * Verify a password against a stored hash.
 * Handles:
 *   - bcrypt hashes (normal case)
 *   - plaintext (legacy dev data only — auto-upgrades on success)
 */
async function verifyPassword(plain: string, stored: string): Promise<boolean> {
    if (!stored) return false;
    if (isBcryptHash(stored)) {
        const bcrypt = await import('bcryptjs');
        return bcrypt.compare(plain, stored);
    }
    // Plaintext match (only reaches here in dev with legacy data)
    return plain === stored;
}

/**
 * Hash a plaintext password with bcrypt (cost 12).
 * Internal helper only — NOT exported as a server action callable from the client.
 */
async function hashPassword(plain: string, cost: number = 12): Promise<string> {
    const bcrypt = await import('bcryptjs');
    return bcrypt.hash(plain, cost);
}

export async function login(formData: FormData) {
    // Preserve original casing for lookup — usernames are case-sensitive in the DB
    const username = (formData.get('username') as string || '').trim();
    const password = formData.get('password') as string;
    const rememberMe = formData.get('rememberMe') === 'true';

    if (!username || !password) {
        return { success: false, error: 'Username and password are required.' };
    }

    const ip = await getClientIp();

    // ── Per-account rate limiting ─────────────────────────────────────────────
    // Each username has its own counter — failures for one account never affect another.
    const isSuperAdminAttempt = username === 'zationlk';
    const rateLimitConfig = isSuperAdminAttempt ? SUPER_ADMIN_RATE_LIMIT : LOGIN_RATE_LIMIT;
    const maxAttempts     = isSuperAdminAttempt ? 5 : 10;

    const userKey    = `login:user:${username.toLowerCase()}`;
    const userResult = checkRateLimit(userKey, rateLimitConfig);

    if (!userResult.allowed) {
        const mins = Math.ceil(userResult.retryAfterMs / 60000);
        return {
            success: false,
            error: `Too many login attempts for this account. Try again in ${mins} minute${mins !== 1 ? 's' : ''}.`,
        };
    }

    try {
        const db = await getDb();

        // Dev-mode self-heal: ensure zationlk stays super_admin
        if (process.env.NODE_ENV !== 'production' && isSuperAdminAttempt) {
            try {
                await db.prepare(
                    "UPDATE users SET role = 'super_admin', is_active = 1 WHERE username = 'zationlk'"
                ).run();
            } catch (e) {
                console.error('Super admin self-heal check failed:', e);
            }
        }

        // Case-insensitive username lookup so 'Admin' and 'admin' both work
        const user = await db.prepare(
            'SELECT * FROM users WHERE LOWER(username) = LOWER(?)'
        ).get(username) as any;

        if (!user) {
            return { success: false, error: 'Invalid credentials.' };
        }

        if (!user.is_active) {
            return { success: false, error: 'This account has been deactivated. Contact your administrator.' };
        }

        // DB-level lock check
        if (user.lock_until) {
            const until = new Date(user.lock_until);
            if (!isNaN(until.getTime()) && new Date() < until) {
                const mins = Math.ceil((until.getTime() - Date.now()) / 60000);
                return {
                    success: false,
                    error: `Account temporarily locked. Try again in ${mins} minute${mins !== 1 ? 's' : ''}.`,
                };
            }
        }

        // ── Subscription check (non-super-admin only) ─────────────────────
        if (user.role !== 'super_admin') {
            try {
                const subStatus = await db.prepare(
                    "SELECT value FROM settings WHERE `key` = 'subscription_status'"
                ).get() as { value: string } | undefined;
                const subExpiry = await db.prepare(
                    "SELECT value FROM settings WHERE `key` = 'subscription_expiry'"
                ).get() as { value: string } | undefined;

                if (subStatus?.value === 'blocked') {
                    return { success: false, error: 'System access has been suspended. Please contact your administrator.' };
                }

                if (subExpiry?.value) {
                    const expiry = new Date(subExpiry.value);
                    const isLifetime = expiry.getFullYear() > 2100;
                    if (!isLifetime && expiry < new Date()) {
                        return { success: false, error: 'Your subscription has expired. Please contact your administrator to renew.' };
                    }
                }
            } catch {
                // If settings table not ready, allow login (first-time setup)
            }
        }

        // ── Password verification ─────────────────────────────────────────────
        const passwordValid = await verifyPassword(password, user.password_hash);

        if (!passwordValid) {
            try {
                const newAttempts = (user.failed_attempts || 0) + 1;
                if (newAttempts >= maxAttempts) {
                    const lockDuration = isSuperAdminAttempt ? 30 * 60 * 1000 : 15 * 60 * 1000;
                    const lockUntil    = new Date(Date.now() + lockDuration).toISOString();
                    await db.prepare(
                        'UPDATE users SET failed_attempts = ?, lock_until = ? WHERE id = ?'
                    ).run(newAttempts, lockUntil, user.id);
                    const mins = lockDuration / 60000;
                    return { success: false, error: `Too many failed attempts. Account locked for ${mins} minutes.` };
                } else {
                    await db.prepare(
                        'UPDATE users SET failed_attempts = ? WHERE id = ?'
                    ).run(newAttempts, user.id);
                    const remaining = maxAttempts - newAttempts;
                    return {
                        success: false,
                        error: `Invalid credentials. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
                    };
                }
            } catch {
                return { success: false, error: 'Invalid credentials.' };
            }
        }

        // ── Success ───────────────────────────────────────────────────────────
        resetRateLimit(userKey);

        // Auto-upgrade plaintext password to bcrypt on first successful login
        if (!isBcryptHash(user.password_hash)) {
            try {
                const newHash = await hashPassword(password);
                await db.prepare(
                    'UPDATE users SET password_hash = ? WHERE id = ?'
                ).run(newHash, user.id);
            } catch (e) {
                console.error('Password upgrade failed:', e);
            }
        }

        const token = await new SignJWT({
            sub:      user.id.toString(),
            username: user.username,
            role:     user.role,
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime(rememberMe ? '30d' : '24h')
            .sign(await getSecretKey());

        const cookieStore = await cookies();
        cookieStore.set('session', token, {
            httpOnly: true,
            secure:   process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path:     '/',
            // Remember Me ON  → 30 days persistent cookie
            // Remember Me OFF → 8 hours (short enough to expire if browser restores it,
            //                   but the sessionStorage check forces logout on browser reopen)
            maxAge: rememberMe ? 30 * 24 * 60 * 60 : 8 * 60 * 60,
        });

        // Clear failed attempts and lock on successful login
        await db.prepare(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP, failed_attempts = 0, lock_until = NULL WHERE id = ?'
        ).run(user.id);

        // Set short-lived subscription status cookies so middleware can enforce
        // subscription state without a DB call on every request
        if (user.role !== 'super_admin') {
            try {
                const subStatus = await db.prepare(
                    "SELECT value FROM settings WHERE `key` = 'subscription_status'"
                ).get() as { value: string } | undefined;
                const subExpiry = await db.prepare(
                    "SELECT value FROM settings WHERE `key` = 'subscription_expiry'"
                ).get() as { value: string } | undefined;

                const cookieOpts = {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax' as const,
                    path: '/',
                    maxAge: 60 * 60, // refresh every hour
                };
                cookieStore.set('sub_status', subStatus?.value || 'active', cookieOpts);

                const expiryVal = subExpiry?.value || '';
                const isLifetime = expiryVal && new Date(expiryVal).getFullYear() > 2100;
                cookieStore.set('sub_expiry', isLifetime ? 'lifetime' : (expiryVal || ''), cookieOpts);
            } catch {
                // Non-critical — subscription cookies are advisory only
            }
        }

        logActivity(user.id, 'LOGIN', 'user', user.id, null, null, ip).catch(() => {});

        return { success: true, role: user.role, rememberMe };
    } catch (err: any) {
        console.error('--- Server Action: Login Error ---', err);
        return { success: false, error: 'An unexpected error occurred. Please try again.' };
    }
}

export async function logout() {
    const cookieStore = await cookies();
    cookieStore.delete('session');
    cookieStore.delete('sub_status');
    cookieStore.delete('sub_expiry');
    redirect('/login');
}

export async function getSession() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('session')?.value;
        if (!token) return null;
        const { payload } = await jwtVerify(token, await getSecretKey());
        return payload;
    } catch (err) {
        console.error('--- Server Action: getSession Error ---', err);
        return null;
    }
}
