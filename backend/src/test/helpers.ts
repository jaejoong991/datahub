import type { FastifyInstance } from 'fastify';
import { sql } from 'kysely';
import { getDb } from '../lib/db.js';
import { hashPassword } from '../lib/crypto.js';

export type Role = 'admin' | 'finance' | 'sales' | 'warehouse';

const ROLES: readonly Role[] = ['admin', 'finance', 'sales', 'warehouse'];

// Password sama untuk semua user seed test — cukup satu hash per resetDb().
export const TEST_PASSWORD = 'TestPassword123!';

export interface TestUser {
  id: number;
  email: string;
  role: Role;
}

export interface SeedResult {
  shopId: number;
  users: Record<Role, TestUser>;
}

export function testUserEmail(role: Role): string {
  return `${role}@test.local`;
}

/* Tabel domain yang di-truncate antar test. SENGAJA TIDAK termasuk:
   - _migration            → riwayat migrasi, bukan data test.
   - subscription_plan     → data referensi dari migration 003, dipakai
                              seedTestUsers() untuk cari plan_id.
   - app_role              → data referensi dari migration 004, dipakai
                              endpoint /me untuk resolve role_label.
   mv_daily_sales adalah MATERIALIZED VIEW (bukan tabel) — TRUNCATE tidak
   berlaku untuknya, jadi tidak perlu disebut di sini.

   CASCADE menangani FK antar tabel di bawah (mis. shop → sales_order →
   sales_order_item), tapi daftar tetap eksplisit lengkap supaya jelas apa
   yang kena reset — update daftar ini kalau nambah tabel domain baru. */
const DOMAIN_TABLES = [
  'user_session',
  'activity_log',
  'api_call_log',
  'reconciliation_check',
  'raw_payload',
  'sync_state',
  'sales_order_item',
  'sales_order',
  'settlement',
  'stock_snapshot',
  'product',
  'erp_batch',
  'erp_sku_map',
  'shop_subscription',
  'channel_credential',
  'app_user',
  'shop',
] as const;

/* Kosongkan semua tabel domain — dipanggil di beforeEach/afterEach supaya
   tiap test mulai dari state bersih tanpa migrasi ulang. Aman dipanggil
   berkali-kali; RESTART IDENTITY supaya id kembali mulai dari 1. */
export async function resetDb(): Promise<void> {
  const db = getDb();
  await sql`truncate table ${sql.join(DOMAIN_TABLES.map((t) => sql.ref(t)))} restart identity cascade`.execute(db);
}

/* Bikin satu user per role (admin/finance/sales/warehouse) dengan password
   TEST_PASSWORD, plus satu shop aktif dengan subscription plan "Full" supaya
   /me dan route yang butuh active_shop_id jalan normal. Panggil setelah
   resetDb() di setiap test yang butuh user login. */
export async function seedTestUsers(): Promise<SeedResult> {
  const db = getDb();
  const passwordHash = await hashPassword(TEST_PASSWORD);

  const shop = await db.insertInto('shop')
    .values({
      channel: 'shopee',
      external_shop_id: 'test-shop-1',
      name: 'Test Shop',
      is_active: true,
      authorized_at: new Date(),
    } as any)
    .returning('id')
    .executeTakeFirstOrThrow();

  const plan = await db.selectFrom('subscription_plan')
    .select('id')
    .where('name', '=', 'Full')
    .executeTakeFirst();
  if (!plan) {
    throw new Error('seedTestUsers: subscription_plan "Full" tidak ditemukan — migrasi 003 sudah jalan?');
  }

  await db.insertInto('shop_subscription')
    .values({ shop_id: shop.id, plan_id: plan.id, active_since: new Date() } as any)
    .execute();

  const users = {} as Record<Role, TestUser>;
  for (const role of ROLES) {
    const email = testUserEmail(role);
    const row = await db.insertInto('app_user')
      .values({
        email,
        password_hash: passwordHash,
        full_name: `Test ${role[0].toUpperCase()}${role.slice(1)}`,
        role,
        is_active: true,
      } as any)
      .returning('id')
      .executeTakeFirstOrThrow();
    users[role] = { id: row.id, email, role };
  }

  return { shopId: shop.id, users };
}

/* Login sebagai user seed dari seedTestUsers() dan kembalikan cookie
   `session_id=...` siap pakai di header Cookie request berikutnya. Panggil
   seedTestUsers() dulu — user harus sudah ada di DB. */
export async function loginAs(app: FastifyInstance, role: Role): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/login',
    payload: { email: testUserEmail(role), password: TEST_PASSWORD },
  });
  if (res.statusCode !== 200) {
    throw new Error(`loginAs(${role}) gagal login: ${res.statusCode} ${res.body}`);
  }
  const cookie = res.cookies.find((c) => c.name === 'session_id');
  if (!cookie) {
    throw new Error(`loginAs(${role}): response /login tidak mengandung cookie session_id`);
  }
  return `session_id=${cookie.value}`;
}
