/* Konfigurasi khusus test — SELALU menunjuk ke database `datahub_test`,
   terpisah total dari database dev (`datahub`) di Postgres yang sama.

   File ini murni data (tanpa side effect) supaya aman diimpor dari dua
   tempat yang berbeda konteks eksekusinya:
   - vitest.config.ts  → jadi `test.env`, di-suntik ke tiap worker sebelum
     modul apa pun (termasuk src/lib/env.ts) sempat membaca process.env.
   - globalSetup.ts    → dipakai proses utama Vitest untuk bikin database
     test & jalankan migrasi SEKALI sebelum worker manapun start. */

// Kalau proses sudah punya DATABASE_URL (mis. di-set oleh CI, yang menunjuk
// ke service container Postgres di localhost:5432), pakai itu sebagai basis.
// Kalau tidak ada (dev lokal), fallback ke Postgres compose di port 5434.
const DEFAULT_ADMIN_DATABASE_URL = 'postgres://datahub:datahub@localhost:5434/datahub';
const ADMIN_DATABASE_URL = process.env.DATABASE_URL ?? DEFAULT_ADMIN_DATABASE_URL;

// Ganti nama database di sebuah connection string, host/kredensial tetap sama.
function withDbName(connectionString: string, dbName: string): string {
  const url = new URL(connectionString);
  url.pathname = `/${dbName}`;
  return url.toString();
}

export const TEST_DB_NAME = 'datahub_test';

// Database test — dipakai oleh app code (lewat DATABASE_URL) selama test jalan.
// Diturunkan dari ADMIN_DATABASE_URL supaya host/port/kredensial otomatis
// ikut lingkungan (dev lokal port 5434, CI service container port 5432).
export const TEST_DATABASE_URL = withDbName(ADMIN_DATABASE_URL, TEST_DB_NAME);

// Database yang sudah pasti ada — dipakai globalSetup HANYA untuk
// mengeksekusi `CREATE DATABASE datahub_test` (tidak bisa CREATE DATABASE
// sambil connect ke database itu sendiri).
export const TEST_ADMIN_DATABASE_URL = ADMIN_DATABASE_URL;

export const TEST_ENV = {
  DATABASE_URL: TEST_DATABASE_URL,
  NODE_ENV: 'test',
  // Min 32 karakter (lihat src/lib/env.ts) — nilai dev sengaja tidak dipakai
  // supaya jelas ini konteks test kalau ke-log di suatu tempat.
  ENCRYPTION_KEY: 'test-encryption-key-32-bytes-long!!',
  APP_URL: 'http://localhost:3000',
  CORS_ORIGIN: 'http://localhost:5173',
} as const;
