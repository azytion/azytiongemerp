/**
 * Database entry point — MySQL backend.
 * Re-exports async API compatible with the former better-sqlite3 usage pattern.
 */
export {
  getDb,
  query,
  queryOne,
  execute,
  closeDb,
  convertSql,
  type Database,
  type Statement,
  type RunResult,
} from './mysql-client';

export { initDb, runSchemaInit } from './mysql-init';

/** No-op for MySQL (SQLite WAL checkpoint removed). */
export async function checkpointDb(): Promise<void> {
  /* MySQL does not use WAL checkpoints */
}

/** Returns configured database name for logging/backup metadata. */
export function getDbPath(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (url?.startsWith('mysql://')) {
    try {
      const parsed = new URL(url);
      return parsed.pathname.replace(/^\//, '') || 'zation_gempos';
    } catch {
      return 'zation_gempos';
    }
  }
  return process.env.MYSQL_DATABASE || 'zation_gempos';
}
