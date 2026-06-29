'use server';


import { requireSession } from './authz';
import { getDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import type { ActivityLog } from './activity-logger';
import { getSession } from './auth';
import { PaginatedResult } from './types';

export async function getActivityLog(filters?: {
    userId?: number;
    action?: string;
    entityType?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    page?: number;
    pageSize?: number;
}): Promise<PaginatedResult<ActivityLog>> {
    // Require at minimum a valid session
    let session;
    try {
        await requireSession();
        session = await getSession();
    } catch {
        return { data: [], total: 0, page: filters?.page || 1, pageSize: filters?.pageSize || 20, totalPages: 0 };
    }

    const db = await getDb();
    const isSuperAdmin = (session as any)?.role === 'super_admin';

    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 20;
    const offset = (page - 1) * pageSize;

    let baseSql = `
        FROM user_activity_log al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE 1=1
    `;

    const params: any[] = [];

    // Security: Only super_admin sees other super_admins
    if (!isSuperAdmin) {
        baseSql += ` AND u.role != 'super_admin'`;
    }

    if (filters?.userId) {
        baseSql += ` AND al.user_id = ?`;
        params.push(filters.userId);
    }

    if (filters?.action) {
        baseSql += ` AND al.action = ?`;
        params.push(filters.action);
    }

    if (filters?.entityType) {
        baseSql += ` AND al.entity_type = ?`;
        params.push(filters.entityType);
    }

    if (filters?.startDate) {
        baseSql += ` AND DATE(al.timestamp) >= ?`;
        params.push(filters.startDate);
    }

    if (filters?.endDate) {
        baseSql += ` AND DATE(al.timestamp) <= ?`;
        params.push(filters.endDate);
    }

    if (filters?.search && filters.search.trim() !== '') {
        baseSql += ` AND (u.username LIKE ? OR al.action LIKE ?)`;
        params.push(`%${filters.search.trim()}%`, `%${filters.search.trim()}%`);
    }

    const totalCount = await db.prepare(`SELECT COUNT(*) as count ${baseSql}`).get(...params) as { count: number };

    const sql = `
        SELECT 
            al.id, al.user_id, al.action, al.entity_type, al.entity_id, al.old_values, al.new_values, al.ip_address,
            DATE_FORMAT(al.timestamp, '%Y-%m-%dT%H:%i:%SZ') as timestamp,
            u.username
        ${baseSql}
        ORDER BY al.timestamp DESC
        LIMIT ? OFFSET ?
    `;

    const logs = await db.prepare(sql).all(...params, Number(pageSize)|0, Number(offset)|0) as ActivityLog[];

    return {
        data: logs,
        total: totalCount.count,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount.count / pageSize)
    };
}

export async function getUserActivity(userId: number, pageSize: number = 50) {
    await requireSession();
    return getActivityLog({ userId, pageSize });
}

export async function getEntityActivity(entityType: string, entityId: number) {
    await requireSession();
    const db = await getDb();
    const session = await getSession();
    const isSuperAdmin = (session as any)?.role === 'super_admin';

    let sql = `
        SELECT 
            al.id, al.user_id, al.action, al.entity_type, al.entity_id, al.old_values, al.new_values, al.ip_address,
            strftime('%Y-%m-%dT%H:%M:%SZ', al.timestamp) as timestamp,
            u.username
        FROM user_activity_log al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.entity_type = ? AND al.entity_id = ?
    `;

    if (!isSuperAdmin) {
        sql += ` AND u.role != 'super_admin'`;
    }

    sql += ` ORDER BY al.timestamp DESC`;

    const logs = await db.prepare(sql).all(entityType, entityId) as ActivityLog[];

    return logs;
}

export async function getActivityStats() {
    await requireSession();
    const db = await getDb();
    const session = await getSession();
    const isSuperAdmin = (session as any)?.role === 'super_admin';

    let baseSql = 'FROM user_activity_log al JOIN users u ON al.user_id = u.id WHERE 1=1';
    const params: any[] = [];

    if (!isSuperAdmin) {
        baseSql += " AND u.role != 'super_admin'";
    }

    const stats = await db.prepare(`
        SELECT 
            COUNT(*) as total_activities,
            COUNT(DISTINCT al.user_id) as active_users,
            COUNT(CASE WHEN al.action = 'CREATE' THEN 1 END) as creates,
            COUNT(CASE WHEN al.action = 'UPDATE' THEN 1 END) as updates,
            COUNT(CASE WHEN al.action = 'DELETE' THEN 1 END) as deletes,
            COUNT(CASE WHEN DATE(al.timestamp) = date('now') THEN 1 END) as today_activities
        ${baseSql}
    `).get(...params) as any;

    return stats;
}

export async function clearOldLogs(daysToKeep: number = 90) {
    await requireSession();
    const db = await getDb();

    try {
        const result = await db.prepare(`
            DELETE FROM user_activity_log 
            WHERE timestamp < datetime('now', '-' || ? || ' days')
        `).run(daysToKeep);

        revalidatePath('/activity-log');
        return { success: true, deleted: result.changes };
    } catch (error) {
        console.error('Error clearing old logs:', error);
        return { success: false, error: 'Failed to clear logs' };
    }
}



