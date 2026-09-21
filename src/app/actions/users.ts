'use server';

import { getDb } from '@/lib/db';
import { isDuplicateKeyError } from '@/lib/mysql-client';
import { revalidatePath } from 'next/cache';
import { PaginatedResult } from './types';
import bcrypt from 'bcryptjs';
import { authError, requireAnyRole } from './authz';

// ── Constants ─────────────────────────────────────────────────────────────────
const PASSWORD_COST = 12; // bcrypt rounds for passwords
const PIN_COST      = 10; // bcrypt rounds for PINs (faster, short strings)

export type User = {
    id: number;
    username: string;
    role: 'admin' | 'manager' | 'cashier' | 'staff' | 'super_admin';
    created_at?: string;
    last_login?: string;
};

/** Normalize username: trim whitespace only. Preserve original casing. */
function normalizeUsername(u: string): string {
    return u.trim();
}

/** Returns true if the value is already a bcrypt hash. */
function isBcryptHash(val: string | null | undefined): boolean {
    return !!(val?.startsWith('$2a$') || val?.startsWith('$2b$') || val?.startsWith('$2y$'));
}

/** Hash a password with bcrypt. */
async function hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, PASSWORD_COST);
}

/** Hash a PIN with bcrypt (lower cost — PINs are short and checked at POS). */
async function hashPin(plain: string): Promise<string> {
    return bcrypt.hash(plain, PIN_COST);
}

// Fix getUsers — must require session, not just optionally use it
export async function getUsers(
    page: number = 1,
    pageSize: number = 20,
    search?: string,
    roleFilter?: string
): Promise<PaginatedResult<User>> {
    let session;
    try {
        session = await requireAnyRole(['admin', 'super_admin']);
    } catch (_error) {
        return { data: [], total: 0, page, pageSize, totalPages: 0 };
    }
    const isSuperAdmin = session?.role === 'super_admin';

    const db = await getDb();
    const offset = (page - 1) * pageSize;

    let countQuery = 'SELECT COUNT(*) as count FROM users u';
    let dataQuery = `
        SELECT u.id, u.username, u.role, u.created_at, u.last_login
        FROM users u
    `;

    const conditions: string[] = ['u.is_active = 1'];
    const queryParams: any[] = [];

    if (!isSuperAdmin) {
        conditions.push("u.role != 'super_admin'");
    }

    if (search && search.trim() !== '') {
        conditions.push('u.username LIKE ?');
        queryParams.push(`%${search.trim()}%`);
    }

    if (roleFilter && roleFilter !== 'all') {
        conditions.push('u.role = ?');
        queryParams.push(roleFilter);
    }

    if (conditions.length > 0) {
        const whereClause = ' WHERE ' + conditions.join(' AND ');
        countQuery += whereClause;
        dataQuery  += whereClause;
    }

    dataQuery += ' ORDER BY username ASC LIMIT ? OFFSET ?';

    const totalCount = await db.prepare(countQuery).get(...queryParams) as { count: number };
    const users      = await db.prepare(dataQuery).all(...queryParams, pageSize, offset) as User[];

    return {
        data: users,
        total: totalCount.count,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount.count / pageSize),
    };
}

export async function createUser(formData: FormData) {
    let session;
    try {
        session = await requireAnyRole(['admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db            = await getDb();
    const rawUsername   = formData.get('username') as string;
    const password      = formData.get('password') as string;
    const role          = formData.get('role') as string;
    const rawPin        = (formData.get('pin') as string) || null;

    if (!rawUsername || !password || !role) {
        return { success: false, error: 'All fields are required.' };
    }

    const username = normalizeUsername(rawUsername);

    if (password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters.' };
    }

    if (role === 'super_admin' && session?.role !== 'super_admin') {
        return { success: false, error: 'Unauthorized: Only Super Admins can create other Super Admins.' };
    }

    try {
        // Soft-deleted user with the same name? Rename it so INSERT doesn't conflict.
        const inactiveUser = await db.prepare(
            'SELECT id, username FROM users WHERE LOWER(username) = LOWER(?) AND is_active = 0'
        ).get(username) as { id: number; username: string } | undefined;

        if (inactiveUser) {
            const purgedName = `[Purged] ${inactiveUser.username} (${inactiveUser.id})`;
            await db.prepare('UPDATE users SET username = ? WHERE id = ?').run(purgedName, inactiveUser.id);
        }

        const passwordHash = await hashPassword(password);
        const pinHash      = rawPin ? await hashPin(rawPin) : null;

        await db.prepare(`
            INSERT INTO users (username, password_hash, role, pin)
            VALUES (@username, @password, @role, @pin)
        `).run({ username, password: passwordHash, role, pin: pinHash });

        revalidatePath('/settings/users');
        return { success: true };
    } catch (error: any) {
        if (isDuplicateKeyError(error)) {
            const msg = (error.message || '').toLowerCase();
            if (msg.includes('username')) return { success: false, error: `Username "${username}" is already taken.` };
            return { success: false, error: 'Conflict: Username or PIN already in use.' };
        }
        return { success: false, error: 'Failed to create user.' };
    }
}

export async function updateUser(formData: FormData) {
    let session;
    try {
        session = await requireAnyRole(['admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db         = await getDb();
    const id         = formData.get('id');
    const rawUsername = formData.get('username') as string;
    const role       = formData.get('role') as string;
    const password   = (formData.get('password') as string) || '';
    const rawPin     = (formData.get('pin') as string) || null;

    if (!id || !role || !rawUsername) {
        return { success: false, error: 'Invalid data.' };
    }

    const username = normalizeUsername(rawUsername);
    const isSuperAdmin = session?.role === 'super_admin';

    if (password && password.trim() !== '' && password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters.' };
    }

    try {
        const targetUser = await db.prepare(
            'SELECT id, role, username FROM users WHERE id = ?'
        ).get(id) as { id: number; role: string; username: string } | undefined;

        if (!targetUser) {
            return { success: false, error: 'User not found.' };
        }

        // The master super_admin account is always locked to 'azytionlk' + 'super_admin'
        if (targetUser.username === 'azytionlk') {
            if (password && password.trim() !== '') {
                const passwordHash = await hashPassword(password);
                const pinHash      = rawPin ? await hashPin(rawPin) : null;
                await db.prepare(
                    'UPDATE users SET role = \'super_admin\', password_hash = ?, pin = ?, is_active = 1 WHERE id = ?'
                ).run(passwordHash, pinHash, id);
            } else {
                const pinHash = rawPin ? await hashPin(rawPin) : null;
                await db.prepare(
                    'UPDATE users SET role = \'super_admin\', pin = ?, is_active = 1 WHERE id = ?'
                ).run(pinHash, id);
            }
            revalidatePath('/settings/users');
            return { success: true };
        }

        // Only super admins can touch super_admin-role accounts
        if (targetUser.role === 'super_admin' && !isSuperAdmin) {
            return { success: false, error: 'Unauthorized: Cannot modify Super Admin account.' };
        }
        if (role === 'super_admin' && !isSuperAdmin) {
            return { success: false, error: 'Unauthorized: Only Super Admins can assign the Super Admin role.' };
        }

        const pinHash = rawPin ? await hashPin(rawPin) : null;

        if (password && password.trim() !== '') {
            const passwordHash = await hashPassword(password);
            await db.prepare(
                'UPDATE users SET username = ?, role = ?, password_hash = ?, pin = ? WHERE id = ?'
            ).run(username, role, passwordHash, pinHash, id);
        } else {
            await db.prepare(
                'UPDATE users SET username = ?, role = ?, pin = ? WHERE id = ?'
            ).run(username, role, pinHash, id);
        }

        revalidatePath('/settings/users');
        return { success: true };
    } catch (error: any) {
        if (isDuplicateKeyError(error)) {
            const msg = (error.message || '').toLowerCase();
            if (msg.includes('username')) return { success: false, error: 'Username already exists.' };
            return { success: false, error: 'PIN already in use.' };
        }
        return { success: false, error: 'Failed to update user.' };
    }
}

export async function deleteUser(id: number) {
    try {
        await requireAnyRole(['admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db = await getDb();

    if (id === 1) {
        return { success: false, error: 'Cannot delete the default admin account.' };
    }

    const targetUser = await db.prepare(
        'SELECT role, username FROM users WHERE id = ?'
    ).get(id) as { role: string; username: string } | undefined;

    if (targetUser?.role === 'super_admin') {
        return { success: false, error: 'Super Admin accounts cannot be deleted.' };
    }
    if (targetUser?.username === 'azytionlk') {
        return { success: false, error: 'The master Super Admin account cannot be deleted.' };
    }

    try {
        const hasSales = await db.prepare(
            'SELECT COUNT(*) as c FROM sales WHERE user_id = ?'
        ).get(id) as { c: number };

        if (hasSales.c > 0) {
            await db.transaction(async () => {
                await db.prepare('UPDATE sales SET user_id = 1 WHERE user_id = ?').run(id);
                await db.prepare('DELETE FROM users WHERE id = ?').run(id);
            })();
        } else {
            await db.prepare('DELETE FROM users WHERE id = ?').run(id);
        }

        revalidatePath('/settings/users');
        return { success: true };
    } catch {
        return { success: false, error: 'Failed to delete user.' };
    }
}

/**
 * Verify a manager/admin PIN at the POS terminal.
 * Handles both bcrypt-hashed PINs (new) and legacy plaintext PINs (auto-upgrades on match).
 */
export async function verifyManagerPin(pin: string) {
    try {
        await requireAnyRole(['cashier', 'manager', 'admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    if (!pin) return { success: false, error: 'PIN is required.' };

    const db = await getDb();

    // Fetch all active manager/admin accounts that have a PIN set
    const candidates = await db.prepare(`
        SELECT id, pin
        FROM users
        WHERE role IN ('admin', 'manager', 'super_admin')
          AND is_active = 1
          AND pin IS NOT NULL
          AND pin != ''
    `).all() as { id: number; pin: string }[];

    for (const candidate of candidates) {
        let match = false;

        if (isBcryptHash(candidate.pin)) {
            match = await bcrypt.compare(pin, candidate.pin);
        } else {
            // Legacy plaintext PIN — compare directly
            match = candidate.pin === pin;
        }

        if (match) {
            // Auto-upgrade plaintext PIN to bcrypt hash
            if (!isBcryptHash(candidate.pin)) {
                try {
                    const pinHash = await hashPin(pin);
                    await db.prepare('UPDATE users SET pin = ? WHERE id = ?').run(pinHash, candidate.id);
                } catch (e) {
                    console.error('PIN hash upgrade failed:', e);
                }
            }
            return { success: true };
        }
    }

    return { success: false, error: 'Invalid PIN.' };
}
