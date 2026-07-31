import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { getEnv } from './env.js';
import { logInfo, logError } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

async function ensureMetaTable(client: pg.Client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migration (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

export async function runMigrations() {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) { logInfo('No migration files found'); return; }

  const client = new pg.Client({ connectionString: getEnv().DATABASE_URL });
  await client.connect();
  await ensureMetaTable(client);

  const { rows: applied } = await client.query<{ name: string }>('SELECT name FROM _migration');
  const appliedSet = new Set(applied.map(r => r.name));

  for (const file of files) {
    if (appliedSet.has(file)) { logInfo(`Skipping ${file} (already applied)`); continue; }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query("INSERT INTO _migration (name) VALUES ($1)", [file]);
      await client.query('COMMIT');
      logInfo(`Applied ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      logError(`Failed migration ${file}`, err);
      throw err;
    }
  }

  await client.end();
  logInfo('All migrations applied');
}

// Auto-execute when run directly (npx tsx src/lib/migrate.ts)
const mainUrl = process.argv[1];
if (mainUrl && (mainUrl.includes('migrate') || mainUrl.endsWith('/migrate.ts') || mainUrl.endsWith('\\migrate.ts'))) {
  runMigrations().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
