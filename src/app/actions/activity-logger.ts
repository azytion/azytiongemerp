'use server';

import { getDb } from '@/lib/db';

export type ActivityLog = {
    id: number;
    user_id: number;
    username?: string;
    action: string;
    entity_type: string;
    entity_id: number | null;
    old_values: string | null;
    new_values: string | null;
    ip_address: string | null;
    timestamp: string;
};

export type ActivityAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'VIEW' | 'SPLIT_LOT' | 'MERGE_LOT' | 'CREATE_SET' | 'BREAK_SET' | 'ARCHIVE' | 'UNARCHIVE';

export async function logActivity(
    userId: number,
    action: ActivityAction,
    entityType: string,
    entityId?: number,
    oldValues?: any,
    newValues?: any,
    ipAddress?: string
) {
    const db = await getDb();

    try {
        await db.prepare(`
            INSERT INTO user_activity_log 
            (user_id, action, entity_type, entity_id, old_values, new_values, ip_address)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            userId,
            action,
            entityType,
            entityId || null,
            oldValues ? JSON.stringify(oldValues) : null,
            newValues ? JSON.stringify(newValues) : null,
            ipAddress || null
        );

        return { success: true };
    } catch (error) {
        console.error('Error logging activity:', error);
        return { success: false, error: 'Failed to log activity' };
    }
}
