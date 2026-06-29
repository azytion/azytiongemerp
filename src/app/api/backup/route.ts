import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { getJwtSecret } from '@/lib/runtime-paths';
import { getPool } from '@/lib/mysql-client';
import { getDb } from '@/lib/db';

export async function GET() {
    try {
        // Verify session JWT
        const cookieStore = await cookies();
        const token = cookieStore.get('session')?.value;
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const secret = new TextEncoder().encode(getJwtSecret());
        let payload: { sub?: string; role?: string } | null = null;
        try {
            const result = await jwtVerify(token, secret);
            payload = result.payload as { sub?: string; role?: string };
        } catch {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!payload || payload.role !== 'super_admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Cross-reference against DB to confirm user is still active and super_admin
        if (payload.sub) {
            const db = await getDb();
            const user = await db.prepare(
                "SELECT is_active, role FROM users WHERE id = ?"
            ).get(Number(payload.sub)) as { is_active: number; role: string } | undefined;

            if (!user || !user.is_active || user.role !== 'super_admin') {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        const pool = getPool();
        const [tables] = await pool.query<any[]>(
            `SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'`
        );

        const lines: string[] = [
            '-- ZATION GemERP MySQL backup',
            `-- Generated: ${new Date().toISOString()}`,
            'SET FOREIGN_KEY_CHECKS=0;',
            '',
        ];

        for (const { name } of tables) {
            const [createRows] = await pool.query<any[]>(`SHOW CREATE TABLE \`${name}\``);
            const createSql = createRows[0]?.['Create Table'];
            if (createSql) {
                lines.push(`DROP TABLE IF EXISTS \`${name}\`;`);
                lines.push(`${createSql};`);
                lines.push('');
            }

            const [rows] = await pool.query<any[]>(`SELECT * FROM \`${name}\``);
            if (rows.length > 0) {
                const columns = Object.keys(rows[0]);
                const colList = columns.map((c) => `\`${c}\``).join(', ');
                for (const row of rows) {
                    const values = columns.map((c) => {
                        const v = row[c];
                        if (v === null || v === undefined) return 'NULL';
                        if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace('T', ' ')}'`;
                        if (typeof v === 'number') return String(v);
                        return `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
                    }).join(', ');
                    lines.push(`INSERT INTO \`${name}\` (${colList}) VALUES (${values});`);
                }
                lines.push('');
            }
        }

        lines.push('SET FOREIGN_KEY_CHECKS=1;');

        const date = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
        const filename = `zpos_mysql_backup_${date}.sql`;
        const sql = lines.join('\n');

        return new NextResponse(sql, {
            headers: {
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Type': 'application/sql',
            },
        });
    } catch (error) {
        console.error('Backup failed:', error);
        return NextResponse.json({ error: 'Failed to create backup' }, { status: 500 });
    }
}
