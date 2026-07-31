// src/web/routes/__tests__/http-boundaries.test.ts
/* Test dua abstraksi boundary HTTP:
   A. resolveActiveShopId() (lib/auth.ts) — fail closed kalau sesi tidak
      punya toko aktif, bukan diam-diam fallback ke shop 1.
   B. parsePagination() (lib/pagination.ts) + setErrorHandler() (index.ts) —
      validasi query pagination dan pembungkus error global. */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../index.js';
import { closeDb, getDb } from '../../../lib/db.js';
import { resetDb, seedTestUsers, loginAs, type SeedResult } from '../../../test/helpers.js';

/* Rute yang dulu pakai `req.shopId ?? 1` — representatif dari tiap file
   (products/sales/finance/sync/warehouse), tidak perlu semua ~15 titik. */
const SHOP_SCOPED_ROUTES = [
  '/products/summary',
  '/sales/summary',
  '/finance/summary',
  '/sync/state',
  '/warehouse/picklist',
];

async function clearActiveShop(cookie: string): Promise<void> {
  const sessionId = cookie.replace('session_id=', '');
  await getDb().updateTable('user_session').set({ shop_id: null }).where('id', '=', sessionId).execute();
}

describe('A. Fail-closed active-shop resolution', () => {
  let app: FastifyInstance;
  let seed: SeedResult;

  beforeEach(async () => {
    await resetDb();
    app = await buildApp();
    seed = await seedTestUsers();
  });

  afterAll(async () => {
    await closeDb();
  });

  for (const url of SHOP_SCOPED_ROUTES) {
    it(`sesi DENGAN toko aktif → GET ${url} tetap 200`, async () => {
      // login otomatis assign shop aktif pertama (lihat auth.ts /login) — jalur normal.
      const cookie = await loginAs(app, 'admin');
      const res = await app.inject({ method: 'GET', url, headers: { cookie } });
      expect(res.statusCode).toBe(200);
    });

    it(`sesi TANPA toko aktif → GET ${url} balik 400 no_active_shop, BUKAN data shop 1`, async () => {
      const cookie = await loginAs(app, 'admin');
      await clearActiveShop(cookie); // paksa null — simulasikan sesi tanpa toko aktif.
      const res = await app.inject({ method: 'GET', url, headers: { cookie } });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ code: 'no_active_shop' });
    });
  }

  it('/sync/reconciliation tidak lagi hardcode shop_id=1 — sesi tanpa toko aktif → 400', async () => {
    const cookie = await loginAs(app, 'admin');
    await clearActiveShop(cookie);
    const res = await app.inject({ method: 'GET', url: '/sync/reconciliation', headers: { cookie } });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ code: 'no_active_shop' });
  });

  it('/sync/reconciliation dengan toko aktif → 200 (query jalan pakai shop_id sesi, bukan 1 hardcoded)', async () => {
    const cookie = await loginAs(app, 'admin');
    const res = await app.inject({ method: 'GET', url: '/sync/reconciliation', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ rows: [] });
  });

  it('/sync/reconciliation hanya mengembalikan baris milik shop aktif sesi, bukan shop lain', async () => {
    // Shop kedua dengan reconciliation_check-nya sendiri — kalau kode masih
    // hardcode shop_id=1 dan seed.shopId kebetulan 1, baris shop kedua ini
    // TIDAK BOLEH ikut nampil di respons shop pertama manapun.
    const otherShop = await getDb().insertInto('shop').values({
      channel: 'shopee', external_shop_id: 'other-shop', name: 'Toko Lain', is_active: true,
    }).returning('id').executeTakeFirstOrThrow();
    await getDb().insertInto('reconciliation_check').values({
      shop_id: otherShop.id, check_date: '2026-07-30', local_count: 5, remote_count: 5, is_match: true,
    }).execute();
    await getDb().insertInto('reconciliation_check').values({
      shop_id: seed.shopId, check_date: '2026-07-30', local_count: 3, remote_count: 3, is_match: true,
    }).execute();

    const cookie = await loginAs(app, 'admin'); // active shop = seed.shopId (auto-assign saat login)
    const res = await app.inject({ method: 'GET', url: '/sync/reconciliation', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const rows = res.json().rows as Array<{ shop_id: number; local_count: number }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].local_count).toBe(3);
  });
});

describe('B1. Pagination — parsePagination() dipakai di rute list', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    await resetDb();
    app = await buildApp();
    await seedTestUsers();
  });

  afterAll(async () => {
    await closeDb();
  });

  const PAGINATED_ROUTES = ['/products', '/sales/top-products', '/finance/released', '/finance/pending'];

  for (const url of PAGINATED_ROUTES) {
    it(`GET ${url}?limit=abc → 422 (non-numeric ditolak, bukan NaN ke SQL)`, async () => {
      const cookie = await loginAs(app, 'admin');
      const res = await app.inject({ method: 'GET', url: `${url}?limit=abc`, headers: { cookie } });
      expect(res.statusCode).toBe(422);
      expect(res.json()).toMatchObject({ code: 'validation_error' });
    });

    it(`GET ${url}?limit=999999999 → 200 tapi meta.limit di-clamp ke 100`, async () => {
      const cookie = await loginAs(app, 'admin');
      const res = await app.inject({ method: 'GET', url: `${url}?limit=999999999`, headers: { cookie } });
      expect(res.statusCode).toBe(200);
      expect(res.json().meta.limit).toBe(100);
    });

    it(`GET ${url}?page=0 → 422 (page harus >= 1)`, async () => {
      const cookie = await loginAs(app, 'admin');
      const res = await app.inject({ method: 'GET', url: `${url}?page=0`, headers: { cookie } });
      expect(res.statusCode).toBe(422);
    });

    it(`GET ${url} tanpa query → 200, default page=1 limit=50`, async () => {
      const cookie = await loginAs(app, 'admin');
      const res = await app.inject({ method: 'GET', url, headers: { cookie } });
      expect(res.statusCode).toBe(200);
      expect(res.json().meta).toMatchObject({ page: 1, limit: 50 });
    });
  }
});

describe('B2. Global error handler — setErrorHandler() di index.ts', () => {
  it('throw tak tertangkap di rute → 500 generik, pesan asli TIDAK bocor ke client', async () => {
    const app = await buildApp();
    app.get('/__test/boom', async () => {
      throw new Error('koneksi database gagal di host internal 10.0.0.5');
    });
    const res = await app.inject({ method: 'GET', url: '/__test/boom' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ code: 'internal_error' });
    expect(res.body).not.toContain('10.0.0.5');
    expect(res.body).not.toContain('koneksi database');
    await app.close();
  });

  it('error dengan statusCode 4xx eksplisit → status & message ASLI dipertahankan (bukan diseragamkan)', async () => {
    const app = await buildApp();
    app.get('/__test/teapot', async () => {
      const err = Object.assign(new Error('Custom four-oh-something'), { statusCode: 418 });
      throw err;
    });
    const res = await app.inject({ method: 'GET', url: '/__test/teapot' });
    expect(res.statusCode).toBe(418);
    expect(res.json().message).toBe('Custom four-oh-something');
    await app.close();
  });
});

describe('B3. POST /admin/users/:id/toggle — user tidak ada → 404 {message, code}, bukan 500', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    await resetDb();
    app = await buildApp();
    await seedTestUsers();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('id yang tidak ada di DB → 404 not_found, bukan throw yang jadi 500', async () => {
    const cookie = await loginAs(app, 'admin');
    const res = await app.inject({ method: 'POST', url: '/admin/users/999999/toggle', headers: { cookie } });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ code: 'not_found' });
  });
});
