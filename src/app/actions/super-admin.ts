'use server';


import { requireSession } from './authz';
import { getDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/app/actions/auth';

export async function getSubscriptionInfo() {
    await requireSession();
    const session = await getSession();
    if (session?.role !== 'super_admin') {
        throw new Error('Unauthorized');
    }

    const db = await getDb();
    const settingsRes = await db.prepare("SELECT key, value FROM settings WHERE category = 'subscription'").all() as { key: string, value: string }[];
    const settings = settingsRes.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {} as Record<string, string>);

    return settings;
}

export async function updateSubscription(action: 'extend_1_month' | 'extend_1_year' | 'reduce_1_month' | 'reduce_1_year' | 'lifetime' | 'disable_lifetime' | 'block' | 'unblock' | 'set_active') {
    await requireSession();
    const session = await getSession();
    if (session?.role !== 'super_admin') {
        throw new Error('Unauthorized');
    }

    const db = await getDb();

    if (action === 'block') {
        await db.prepare("UPDATE settings SET value = 'blocked' WHERE key = 'subscription_status'").run();
    } else if (action === 'unblock' || action === 'set_active') {
        await db.prepare("UPDATE settings SET value = 'active' WHERE key = 'subscription_status'").run();

    } else if (action === 'lifetime') {
        // Set a far future date to simulate lifetime
        const lifetimeDate = new Date();
        lifetimeDate.setFullYear(lifetimeDate.getFullYear() + 100);
        await db.prepare("UPDATE settings SET value = ? WHERE key = 'subscription_expiry'").run(lifetimeDate.toISOString());
        await db.prepare("UPDATE settings SET value = 'active' WHERE key = 'subscription_status'").run();

        // Update subscription type
        const hasType = await db.prepare("SELECT key FROM settings WHERE key = 'subscription_type'").get();
        if (hasType) {
            await db.prepare("UPDATE settings SET value = 'Lifetime' WHERE key = 'subscription_type'").run();
        } else {
            await db.prepare("INSERT INTO settings (key, value, category) VALUES ('subscription_type', 'Lifetime', 'subscription')").run();
        }

    } else if (action === 'disable_lifetime') {
        // Reset to now (expired) and clear type
        await db.prepare("UPDATE settings SET value = ? WHERE key = 'subscription_expiry'").run(new Date().toISOString());
        await db.prepare("UPDATE settings SET value = 'active' WHERE key = 'subscription_status'").run();

        const hasType = await db.prepare("SELECT key FROM settings WHERE key = 'subscription_type'").get();
        if (hasType) {
            await db.prepare("UPDATE settings SET value = 'Standard' WHERE key = 'subscription_type'").run();
        } else {
            await db.prepare("INSERT INTO settings (key, value, category) VALUES ('subscription_type', 'Standard', 'subscription')").run();
        }

    } else if (action.startsWith('extend_') || action.startsWith('reduce_')) {
        const currentExpiryStr = (await db.prepare("SELECT value FROM settings WHERE key = 'subscription_expiry'").get() as any)?.value;
        let expiry = currentExpiryStr ? new Date(currentExpiryStr) : new Date();

        // If expired and extending, start from now. If reducing, we rely on current expiry.
        if (action.startsWith('extend_') && expiry < new Date()) {
            expiry = new Date();
        }

        if (action === 'extend_1_month') {
            expiry.setMonth(expiry.getMonth() + 1);
        } else if (action === 'extend_1_year') {
            expiry.setFullYear(expiry.getFullYear() + 1);
        } else if (action === 'reduce_1_month') {
            expiry.setMonth(expiry.getMonth() - 1);
        } else if (action === 'reduce_1_year') {
            expiry.setFullYear(expiry.getFullYear() - 1);
        }

        await db.prepare("UPDATE settings SET value = ? WHERE key = 'subscription_expiry'").run(expiry.toISOString());
        await db.prepare("UPDATE settings SET value = 'active' WHERE key = 'subscription_status'").run();

        // Update type (simple logic)
        const type = action.includes('month') ? 'Monthly' : 'Yearly';
        const hasType = await db.prepare("SELECT key FROM settings WHERE key = 'subscription_type'").get();
        if (hasType) {
            await db.prepare("UPDATE settings SET value = ? WHERE key = 'subscription_type'").run(type);
        } else {
            await db.prepare("INSERT INTO settings (key, value, category) VALUES ('subscription_type', ?, 'subscription')").run(type);
        }
    }

    revalidatePath('/super-admin');
    return { success: true };
}
