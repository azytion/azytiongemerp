import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { AsyncLocalStorage } from 'async_hooks';

const txStorage = new AsyncLocalStorage<PoolConnection>();

type MysqlGlobals = {
  pool?: Pool;
  initPromise?: Promise<void>;
  dbSingleton?: Database;
  schemaInitialized?: boolean;
};

const g = globalThis as typeof globalThis & { __zationMysql?: MysqlGlobals };

function mysqlGlobals(): MysqlGlobals {
  if (!g.__zationMysql) g.__zationMysql = {};
  return g.__zationMysql;
}

export function getMysqlConfig() {
  const url = process.env.DATABASE_URL?.trim();
  if (url?.startsWith('mysql://')) {
    // Parse URL and build config object so we can add required options
    // that aren't expressible in a URL string (multipleStatements, timezone, dateStrings)
    try {
      const parsed = new URL(url);
      return {
        host: parsed.hostname,
        port: Number(parsed.port || 3306),
        user: parsed.username ? decodeURIComponent(parsed.username) : 'root',
        password: parsed.password ? decodeURIComponent(parsed.password) : '',
        database: parsed.pathname.replace(/^\//, '') || 'zation_gempos',
        waitForConnections: true,
        connectionLimit: Number(process.env.MYSQL_POOL_SIZE || 20),
        queueLimit: 0,
        timezone: 'Z',
        dateStrings: true,
        multipleStatements: true,
      };
    } catch {
      // Fallback: return raw URL (loses extra options but avoids crash)
      return url;
    }
  }
  return {
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'zation_gempos',
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_POOL_SIZE || 20),
    queueLimit: 0,
    timezone: 'Z',
    dateStrings: true,
    multipleStatements: true,
  };
}

export function getPool(): Pool {
  const state = mysqlGlobals();
  if (!state.pool) {
    const config = getMysqlConfig();
    state.pool = typeof config === 'string' ? mysql.createPool(config) : mysql.createPool(config);
  }
  return state.pool;
}

function getExecutor(): Pool | PoolConnection {
  return txStorage.getStore() ?? getPool();
}

function sqliteFormatToMysql(fmt: string): string {
  return fmt.replace(/%M/g, '%i').replace(/%W/g, '%v');
}

/** Convert SQLite || string concatenation chains to MySQL CONCAT(). */
function convertSqlConcat(sql: string): string {
  const concatPattern =
    /((?:'[^']*'|[a-zA-Z_][\w.]*|\)|\?|CASE\s+WHEN[\s\S]+?END)\s*(?:\|\|\s*(?:'[^']*'|[a-zA-Z_][\w.]*|\?|CASE\s+WHEN[\s\S]+?END))+)/g;

  return sql.replace(concatPattern, (match) => {
    const parts = match.split(/\s*\|\|\s*/).map((p) => p.trim());
    return parts.length > 1 ? `CONCAT(${parts.join(', ')})` : match;
  });
}

/** Convert SQLite-style SQL to MySQL-compatible SQL. */
export function convertSql(sql: string): string {
  let s = sql;
  s = s.replace(/INSERT OR IGNORE INTO/gi, 'INSERT IGNORE INTO');
  s = s.replace(/INSERT OR REPLACE INTO/gi, 'INSERT INTO');
  s = s.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'INT AUTO_INCREMENT PRIMARY KEY');
  s = s.replace(/\bREAL\b/gi, 'DOUBLE');
  // SQLite case-insensitive compare → MySQL (utf8mb4_unicode_ci is case-insensitive by default; strip legacy COLLATE)
  s = s.replace(/\s+COLLATE\s+NOCASE/gi, '');
  s = s.replace(
    /WHERE\s+(\w+)\s*=\s*\?\s+COLLATE\s+NOCASE/gi,
    'WHERE LOWER($1) = LOWER(?)'
  );
  s = s.replace(
    /SELECT\s+name\s+FROM\s+sqlite_master\s+WHERE\s+type\s*=\s*'table'\s+AND\s+name\s*=\s*'([^']+)'/gi,
    "SELECT TABLE_NAME as name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '$1'"
  );
  s = s.replace(
    /strftime\s*\(\s*'([^']*)'\s*,\s*([^)]+)\)/gi,
    (_, fmt, col) => `DATE_FORMAT(${col.trim()}, '${sqliteFormatToMysql(fmt)}')`
  );
  s = s.replace(
    /datetime\s*\(\s*'now'\s*,\s*'-'\s*\|\|\s*\?\s*\|\|\s*'\s+days\s*'\s*\)/gi,
    'DATE_SUB(NOW(), INTERVAL ? DAY)'
  );
  s = s.replace(/datetime\s*\(\s*'now'\s*,\s*'-(\d+)\s+days?'\s*\)/gi, 'DATE_SUB(NOW(), INTERVAL $1 DAY)');
  s = s.replace(/datetime\s*\(\s*'now'\s*,\s*'-1 day'\s*\)/gi, 'DATE_SUB(NOW(), INTERVAL 1 DAY)');
  s = s.replace(/datetime\s*\(\s*'now'\s*\)/gi, 'NOW()');
  s = s.replace(/date\s*\(\s*'now'\s*,\s*'-(\d+)\s+days?'\s*\)/gi, 'DATE_SUB(CURDATE(), INTERVAL $1 DAY)');
  s = s.replace(/date\s*\(\s*'now'\s*,\s*'start of month'\s*\)/gi, "DATE_FORMAT(NOW(), '%Y-%m-01')");
  s = s.replace(/date\s*\(\s*'now'\s*,\s*'start of day'\s*\)/gi, 'CURDATE()');
  s = s.replace(/date\s*\(\s*'now'\s*\)/gi, 'CURDATE()');
  s = convertSqlConcat(s);
  // MySQL reserved word `key` in settings table
  s = s.replace(/\bsettings\s+WHERE\s+key\b/gi, 'settings WHERE `key`');
  s = s.replace(/\bsettings\s*\(\s*key\b/gi, 'settings (`key`');
  s = s.replace(/,\s*key\b/gi, ', `key`');
  s = s.replace(/SELECT key\b/gi, 'SELECT `key`');
  s = s.replace(/WHERE key =/gi, 'WHERE `key` =');
  s = s.replace(/\(key,/gi, '(`key`,');
  s = s.replace(/,\s*key,/gi, ', `key`,');
  // SQLite upsert → MySQL upsert
  s = s.replace(/ON CONFLICT\s*\([^)]+\)\s*DO UPDATE SET/gi, 'ON DUPLICATE KEY UPDATE');
  s = s.replace(/\bexcluded\.(\w+)/gi, 'VALUES($1)');
  // SQLite double-quoted strings → single quotes
  s = s.replace(/=\s*"([^"]*)"/g, "= '$1'");
  return s;
}

/** Detect duplicate-key errors from MySQL/MariaDB (and legacy SQLite code paths). */
export function isDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { code?: string; errno?: number };
  return err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === 'ER_DUP_ENTRY' || err.errno === 1062;
}

function paramsToBind(params: unknown[]): unknown {
  if (params.length === 0) return undefined;
  if (params.length === 1) return params[0];
  return params;
}

function normalizeParams(sql: string, params?: unknown): [string, unknown[]] {
  const converted = convertSql(sql);
  if (params === undefined || params === null) {
    return [converted, []];
  }

  let values: unknown[];

  if (Array.isArray(params)) {
    values = params;
  } else if (typeof params === 'object') {
    const keys = [...converted.matchAll(/@(\w+)/g)].map((m) => m[1]);
    const result: unknown[] = [];
    let normalized = converted;
    for (const key of keys) {
      normalized = normalized.replace(new RegExp(`@${key}\\b`), '?');
      result.push((params as Record<string, unknown>)[key]);
    }
    return [normalized, coerceLimitOffset(normalized, result)];
  } else {
    values = [params];
  }

  return [converted, coerceLimitOffset(converted, values)];
}

/**
 * MySQL2 rejects string values for LIMIT and OFFSET in prepared statements
 * (ER_WRONG_ARGUMENTS). Find LIMIT/OFFSET placeholders in the SQL and ensure
 * the corresponding values are integers.
 */
function coerceLimitOffset(sql: string, params: unknown[]): unknown[] {
  if (params.length === 0) return params;

  // Find positions of all ? in the SQL
  const positions: number[] = [];
  let idx = 0;
  while ((idx = sql.indexOf('?', idx)) !== -1) {
    positions.push(idx);
    idx++;
  }

  // Find the positions of LIMIT ? and OFFSET ? patterns
  const limitOffsetPattern = /\bLIMIT\s+\?|\bOFFSET\s+\?/gi;
  const limitOffsetPositions = new Set<number>();
  let match: RegExpExecArray | null;
  while ((match = limitOffsetPattern.exec(sql)) !== null) {
    // The ? is at the end of the match
    const qPos = match.index + match[0].lastIndexOf('?');
    limitOffsetPositions.add(qPos);
  }

  if (limitOffsetPositions.size === 0) return params;

  return params.map((value, i) => {
    const sqlPos = positions[i];
    if (sqlPos !== undefined && limitOffsetPositions.has(sqlPos)) {
      // Force to integer — null/undefined become 0
      const n = Number(value);
      return Number.isFinite(n) ? Math.floor(n) : 0;
    }
    return value;
  });
}

export type RunResult = {
  lastInsertRowid: number;
  changes: number;
};

export class Statement {
  constructor(
    private readonly sql: string,
    private readonly executor: Pool | PoolConnection = getExecutor()
  ) {}

  async get(...params: unknown[]): Promise<RowDataPacket | undefined> {
    const [sql, values] = normalizeParams(this.sql, paramsToBind(params));
    const [rows] = await this.executor.execute<RowDataPacket[]>(sql, values as never);
    return rows[0];
  }

  async all(...params: unknown[]): Promise<RowDataPacket[]> {
    const [sql, values] = normalizeParams(this.sql, paramsToBind(params));
    const [rows] = await this.executor.execute<RowDataPacket[]>(sql, values as never);
    return rows;
  }

  async run(...params: unknown[]): Promise<RunResult> {
    const [sql, values] = normalizeParams(this.sql, paramsToBind(params));
    const [result] = await this.executor.execute<ResultSetHeader>(sql, values as never);
    return {
      lastInsertRowid: Number(result.insertId || 0),
      changes: result.affectedRows,
    };
  }
}

export class Database {
  prepare(sql: string): Statement {
    return new Statement(sql, getExecutor());
  }

  async exec(sql: string): Promise<void> {
    const executor = getExecutor();
    await executor.query(convertSql(sql));
  }

  /**
   * SQLite-compatible transaction API.
   * Usage: const txn = db.transaction(async () => { ... }); await txn();
   */
  transaction<T>(fn: () => T | Promise<T>): () => Promise<T> {
    return async () => {
      const conn = await getPool().getConnection();
      try {
        await conn.beginTransaction();
        const result = await txStorage.run(conn, async () => fn());
        await conn.commit();
        return result;
      } catch (error) {
        await conn.rollback();
        throw error;
      } finally {
        conn.release();
      }
    };
  }
}

export async function getDb(): Promise<Database> {
  const state = mysqlGlobals();
  if (!state.initPromise) {
    state.initPromise = initializeDatabase();
  }
  await state.initPromise;
  if (!state.dbSingleton) {
    state.dbSingleton = new Database();
  }
  return state.dbSingleton;
}

export async function query<T extends RowDataPacket = RowDataPacket>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const [rows] = await getExecutor().execute<T[]>(convertSql(sql), params as never);
  return rows;
}

export async function queryOne<T extends RowDataPacket = RowDataPacket>(
  sql: string,
  params: unknown[] = []
): Promise<T | undefined> {
  const rows = await query<T>(sql, params);
  return rows[0];
}

export async function execute(sql: string, params: unknown[] = []): Promise<ResultSetHeader> {
  const [result] = await getExecutor().execute<ResultSetHeader>(convertSql(sql), params as never);
  return result;
}

export async function closeDb(): Promise<void> {
  const state = mysqlGlobals();
  if (state.pool) {
    await state.pool.end();
    state.pool = undefined;
    state.dbSingleton = undefined;
    state.initPromise = undefined;
    state.schemaInitialized = undefined;
  }
}

async function initializeDatabase(): Promise<void> {
  const state = mysqlGlobals();
  if (state.schemaInitialized) return;
  const { runSchemaInit } = await import('./mysql-init');
  await runSchemaInit();
  state.schemaInitialized = true;
}
