// src/web/routes/__tests__/rbac.test.ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../index.js';
import { closeDb, getDb } from '../../../lib/db.js';
import { resetDb, seedTestUsers, loginAs, type Role, type SeedResult } from '../../../test/helpers.js';

/*
 * Truth table di bawah diturunkan LANGSUNG dari kode, bukan tebakan:
 * - migrations/004_roles.sql   → app_role.features per role
 * - migrations/003_subscription.sql → subscription_plan.features plan "Full"
 *   (plan yang dipakai seedTestUsers() untuk shop test)
 * - src/lib/rbac.ts requireFeature()/requireRole() → logikanya OR: lolos
 *   kalau role PUNYA SALAH SATU fitur yang diminta route DAN shop subscription
 *   juga punya salah satu fitur yang sama; role 'admin' bypass total.
 *
 * Role features (004_roles.sql):
 *   sales     → order, product
 *   finance   → order, finance, returns, export
 *   warehouse → product, warehouse, logistics
 *   admin     → semua fitur (lagipula requireFeature() bypass eksplisit utk admin)
 *
 * Shop test pakai plan "Full" (003_subscription.sql), yang mencakup reader,
 * order, finance, returns, product, media, category, warehouse, logistics,
 * voucher, discount, export, account_health, erp — superset dari semua fitur
 * role di atas. Jadi di test ini, hasil 200/403 murni ditentukan oleh fitur
 * ROLE; bagian pengecekan fitur shop tidak pernah jadi penghalang.
 */
type ExpectedStatus = 200 | 403;

const ROUTE_EXPECTATIONS: Array<{ url: string; note: string; expected: Record<Role, ExpectedStatus> }> = [
  {
    // requireFeature(['order','sales']) — sales & finance sama2 lolos lewat 'order'
    url: '/sales/summary',
    note: "requireFeature(['order','sales'])",
    expected: { admin: 200, finance: 200, sales: 200, warehouse: 403 },
  },
  {
    // requireFeature(['finance','order']) — sales lolos lewat 'order', bukan 'finance'
    url: '/finance/summary',
    note: "requireFeature(['finance','order'])",
    expected: { admin: 200, finance: 200, sales: 200, warehouse: 403 },
  },
  {
    // requireFeature(['finance']) — satu-satunya endpoint yang murni finance-only
    url: '/finance/fees',
    note: "requireFeature(['finance'])",
    expected: { admin: 200, finance: 200, sales: 403, warehouse: 403 },
  },
  {
    // requireFeature(['product','warehouse']) — sales lolos lewat 'product'
    url: '/products/summary',
    note: "requireFeature(['product','warehouse'])",
    expected: { admin: 200, finance: 403, sales: 200, warehouse: 200 },
  },
  {
    // requireFeature(['logistics','warehouse']) — hanya warehouse & admin
    url: '/warehouse/picklist',
    note: "requireFeature(['logistics','warehouse'])",
    expected: { admin: 200, finance: 403, sales: 403, warehouse: 200 },
  },
  {
    // requireRole(['admin']) DULU, baru requireFeature(['reader']) — role check
    // gagal duluan utk non-admin, feature check tidak pernah tercapai
    url: '/sync/jobs',
    note: "requireRole(['admin']) + requireFeature(['reader'])",
    expected: { admin: 200, finance: 403, sales: 403, warehouse: 403 },
  },
  {
    // requireRole(['admin']) — hanya admin
    url: '/admin/users',
    note: "requireRole(['admin'])",
    expected: { admin: 200, finance: 403, sales: 403, warehouse: 403 },
  },
];

const ALL_ROLES: readonly Role[] = ['admin', 'finance', 'sales', 'warehouse'];

describe('RBAC & feature gating — rute vs role', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    await resetDb();
    app = await buildApp();
    await seedTestUsers();
  });

  afterAll(async () => {
    await closeDb();
  });

  for (const { url, note, expected } of ROUTE_EXPECTATIONS) {
    describe(`GET ${url} (${note})`, () => {
      for (const role of ALL_ROLES) {
        it(`${role} → ${expected[role]}`, async () => {
          const cookie = await loginAs(app, role);
          const res = await app.inject({ method: 'GET', url, headers: { cookie } });
          expect(res.statusCode).toBe(expected[role]);
        });
      }
    });
  }
});

describe('rute admin-only — non-admin harus 403, bukan 200 ataupun 500', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    await resetDb();
    app = await buildApp();
    await seedTestUsers();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('sales login → GET /admin/users → 403 dengan body forbidden yang jelas', async () => {
    const cookie = await loginAs(app, 'sales');
    const res = await app.inject({ method: 'GET', url: '/admin/users', headers: { cookie } });
    expect(res.statusCode).toBe(403);
    expect(res.statusCode).not.toBe(200);
    expect(res.statusCode).toBeLessThan(500);
    expect(res.json()).toMatchObject({ code: 'forbidden' });
  });

  it('finance login → GET /admin/users → 403 dengan body forbidden yang jelas', async () => {
    const cookie = await loginAs(app, 'finance');
    const res = await app.inject({ method: 'GET', url: '/admin/users', headers: { cookie } });
    expect(res.statusCode).toBe(403);
    expect(res.statusCode).not.toBe(200);
    expect(res.statusCode).toBeLessThan(500);
    expect(res.json()).toMatchObject({ code: 'forbidden' });
  });
});

describe('filterColumnsForRole / filterRowsForRole — kolom uang tidak boleh sampai ke warehouse', () => {
  let app: FastifyInstance;
  let seed: SeedResult;

  beforeEach(async () => {
    await resetDb();
    app = await buildApp();
    seed = await seedTestUsers();
    // GET /products dipaginasi lewat paginatedResponse() dan kolom 'price'
    // ada di MONEY_COLUMN_IDS (lihat src/web/serializer.ts) — endpoint ini
    // yang dipakai untuk membuktikan strip-nya benar-benar jalan end-to-end,
    // bukan cuma di unit function.
    await getDb().insertInto('product').values({
      shop_id: seed.shopId,
      external_item_id: 'ext-1',
      sku: 'SKU-1',
      name: 'Produk A',
      price: '15000',
      stock: 5,
      low_stock_threshold: 2,
    } as any).execute();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('warehouse: kolom "price" hilang dari columns dan rows di GET /products', async () => {
    const cookie = await loginAs(app, 'warehouse');
    const res = await app.inject({ method: 'GET', url: '/products', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.columns.map((c: { id: string }) => c.id)).not.toContain('price');
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0]).not.toHaveProperty('price');
    // Kolom non-uang tetap utuh — bukti filternya presisi, bukan asal buang semua field.
    expect(body.rows[0]).toMatchObject({ sku: 'SKU-1', stock: 5 });
  });

  it('admin: kolom "price" TETAP ada di GET /products (pembanding — bukan strip global)', async () => {
    const cookie = await loginAs(app, 'admin');
    const res = await app.inject({ method: 'GET', url: '/products', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.columns.map((c: { id: string }) => c.id)).toContain('price');
    expect(body.rows[0]).toHaveProperty('price');
  });
});
