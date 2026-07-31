import pg from 'pg';
import { TEST_ADMIN_DATABASE_URL, TEST_DB_NAME, TEST_ENV } from './testEnv.js';

/* Vitest globalSetup jalan SEKALI di proses utama, SEBELUM worker manapun
   di-fork — dan env yang di-set lewat `test.env` di vitest.config.ts belum
   ter-suntik di proses ini (itu baru terjadi di dalam tiap worker). Jadi
   di sini kita urus infrastrukturnya sendiri:

   1. Pastikan database `datahub_test` ada (bikin kalau belum).
   2. Arahkan DATABASE_URL ke situ lalu jalankan migrasi sampai skema terbaru,
      supaya test tidak perlu migrasi sendiri-sendiri dan tidak race satu
      sama lain saat startup. */
export async function setup(): Promise<void> {
  const admin = new pg.Client({ connectionString: TEST_ADMIN_DATABASE_URL });
  await admin.connect();
  try {
    const { rows } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [TEST_DB_NAME]);
    if (rows.length === 0) {
      // Nama database fixed (bukan input user) — aman diinterpolasi. Identifier
      // di CREATE DATABASE tidak bisa diparameterisasi lewat placeholder $1.
      await admin.query(`CREATE DATABASE ${TEST_DB_NAME}`);
    }
  } finally {
    await admin.end();
  }

  // Set process.env DI PROSES INI sebelum import getEnv()/migrate.js — dotenv
  // (dipanggil dari dalam env.ts) tidak menimpa process.env yang sudah ada,
  // jadi urutan assignment-lalu-import ini wajib supaya tidak kebobolan
  // menyentuh DATABASE_URL dev dari .env.
  for (const [key, value] of Object.entries(TEST_ENV)) {
    process.env[key] = value;
  }

  const { runMigrations } = await import('../lib/migrate.js');
  await runMigrations();
}
