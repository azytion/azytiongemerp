/**
 * Initialize Azytion GemERP MySQL database from database/*.sql files.
 *
 * Usage:
 *   node scripts/init-mysql.mjs
 *   npm run db:init
 *
 * Env (optional): MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, DATABASE_URL
 */
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

const ROOT = process.cwd();
const SQL_DIR = path.join(ROOT, 'database');

const SQL_FILES = [
  '01_create_database.sql',
  '02_schema.sql',
  '03_indexes.sql',
  '04_seed_settings.sql',
  '05_seed_dev_users.sql',
];

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.join(ROOT, '.env'));
loadEnvFile(path.join(ROOT, '.env.local'));

if (process.env.DATABASE_URL?.startsWith('mysql://')) {
  try {
    const parsed = new URL(process.env.DATABASE_URL.trim());
    if (!process.env.MYSQL_HOST) process.env.MYSQL_HOST = parsed.hostname;
    if (!process.env.MYSQL_PORT) process.env.MYSQL_PORT = parsed.port || '3306';
    if (!process.env.MYSQL_USER && parsed.username) process.env.MYSQL_USER = decodeURIComponent(parsed.username);
    if (!process.env.MYSQL_PASSWORD && parsed.password) process.env.MYSQL_PASSWORD = decodeURIComponent(parsed.password);
    if (!process.env.MYSQL_DATABASE && parsed.pathname) {
      process.env.MYSQL_DATABASE = parsed.pathname.replace(/^\//, '');
    }
  } catch {}
}

const database = process.env.MYSQL_DATABASE || 'zationgemerp';

const config = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  multipleStatements: true,
};

function stripLeadingComments(sql) {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .trim();
}

function splitStatements(sql) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => stripLeadingComments(s))
    .filter((s) => s.length > 0);
}

async function runSqlFile(connection, fileName) {
  const filePath = path.join(SQL_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing SQL file: ${filePath}`);
  }

  let sql = fs.readFileSync(filePath, 'utf8');
  // Dynamically replace hardcoded `zationgemerp` with the target database name
  sql = sql.replace(/`zationgemerp`/g, `\`${database}\``);
  const statements = splitStatements(sql);
  console.log(`\n>> ${fileName} (${statements.length} statements)`);

  for (const stmt of statements) {
    try {
      await connection.query(stmt);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // If the database already exists or the user has no global CREATE DATABASE privilege, ignore and continue
      if (fileName === '01_create_database.sql' && /Access denied.*CREATE DATABASE/i.test(message)) {
        console.log(`  [Notice] Database '${database}' already created. Continuing...`);
        continue;
      }
      if (fileName === '03_indexes.sql' && /Duplicate key name/i.test(message)) {
        continue;
      }
      throw new Error(`${fileName}: ${message}\nStatement: ${stmt.slice(0, 120)}...`);
    }
  }
}

async function main() {
  console.log(`Connecting to MySQL at ${config.host}:${config.port} as ${config.user}...`);
  console.log(`Target Database: ${database}`);
  const connection = await mysql.createConnection(config);

  try {
    for (const file of SQL_FILES) {
      await runSqlFile(connection, file);
    }

    const [tables] = await connection.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?`,
      [database]
    );
    const [users] = await connection.query(
      `SELECT COUNT(*) AS cnt FROM \`${database}\`.users`
    );
    const [settings] = await connection.query(
      `SELECT COUNT(*) AS cnt FROM \`${database}\`.settings`
    );

    console.log('\nDatabase initialized successfully.');
    console.log(`  Database : ${database}`);
    console.log(`  Tables   : ${tables[0].cnt}`);
    console.log(`  Users    : ${users[0].cnt}`);
    console.log(`  Settings : ${settings[0].cnt}`);
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('\nDatabase init failed:', err.message || err);
  process.exit(1);
});
