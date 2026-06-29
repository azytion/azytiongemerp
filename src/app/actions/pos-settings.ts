'use server';

import { getDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { authError, requireAnyRole } from './authz';

export type DiscountRule = {
    id: number;
    min_price: number;
    max_price: number | null;
    discount_type: 'fixed' | 'percentage';
    discount_value: number;
    is_active: boolean;
};

export async function getDiscountRules(): Promise<DiscountRule[]> {
    const db = await getDb();
    const rules = await db.prepare('SELECT * FROM pos_discount_rules ORDER BY min_price ASC').all() as any[];
    return rules.map(r => ({
        ...r,
        is_active: r.is_active === 1
    }));
}

export async function addDiscountRule(rule: Omit<DiscountRule, 'id'>) {
    try {
        await requireAnyRole(['admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db = await getDb();

    try {
        await db.prepare(`
            INSERT INTO pos_discount_rules (min_price, max_price, discount_type, discount_value, is_active)
            VALUES (@min_price, @max_price, @discount_type, @discount_value, @is_active)
        `).run({
            min_price: rule.min_price,
            max_price: rule.max_price,
            discount_type: rule.discount_type,
            discount_value: rule.discount_value,
            is_active: rule.is_active ? 1 : 0
        });

        revalidatePath('/settings');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteDiscountRule(id: number) {
    try {
        await requireAnyRole(['admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db = await getDb();
    try {
        await db.prepare('DELETE FROM pos_discount_rules WHERE id = ?').run(id);
        revalidatePath('/settings');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function toggleDiscountRule(id: number, isActive: boolean) {
    try {
        await requireAnyRole(['admin', 'super_admin']);
    } catch (error) {
        return authError(error);
    }

    const db = await getDb();
    try {
        await db.prepare('UPDATE pos_discount_rules SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, id);
        revalidatePath('/settings');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
