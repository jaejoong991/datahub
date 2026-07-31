import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../index.js';
import { getDb, closeDb } from '../../../lib/db.js';
import { resetDb, seedTestUsers, loginAs, testUserEmail, TEST_PASSWORD } from '../../../test/helpers.js';

/* Integrasi login/session: cookie yang dipasang /login, guard authPreHandler
   di /me, dan invalidasi sesi lewat /logout. */
describe('auth routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    await resetDb();
    app = await buildApp();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('login dengan kredensial valid set cookie session_id HttpOnly, SameSite=Lax, tanpa Secure di NODE_ENV=test', async () => {
    await seedTestUsers();
    const res = await app.inject({
      method: 'POST',
      url: '/login',
      payload: { email: testUserEmail('admin'), password: TEST_PASSWORD },
    });

    expect(res.statusCode).toBe(200);
    const cookie = res.cookies.find((c) => c.name === 'session_id');
    expect(cookie).toBeDefined();
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('Lax');
    // Secure hanya diset saat NODE_ENV=production (lihat auth.ts) — di test
    // NODE_ENV='test', jadi flag Secure TIDAK boleh muncul.
    expect(cookie?.secure).toBeFalsy();
  });

  it('login dengan password salah balikin 422 dan TIDAK set cookie', async () => {
    await seedTestUsers();
    const res = await app.inject({
      method: 'POST',
      url: '/login',
      payload: { email: testUserEmail('admin'), password: 'password-salah-banget' },
    });

    expect(res.statusCode).toBe(422);
    expect(res.cookies.find((c) => c.name === 'session_id')).toBeUndefined();
  });

  it('login dengan body malformed (password kosong) balikin 422', async () => {
    await seedTestUsers();
    const res = await app.inject({
      method: 'POST',
      url: '/login',
      payload: { email: testUserEmail('admin'), password: '' },
    });

    expect(res.statusCode).toBe(422);
  });

  it('user is_active=false tidak bisa login', async () => {
    const { users } = await seedTestUsers();
    await getDb().updateTable('app_user')
      .set({ is_active: false })
      .where('id', '=', users.admin.id)
      .execute();

    const res = await app.inject({
      method: 'POST',
      url: '/login',
      payload: { email: testUserEmail('admin'), password: TEST_PASSWORD },
    });

    // auth.ts: cek is_active setelah verifyPassword sukses → 403 account_disabled.
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ code: 'account_disabled' });
    expect(res.cookies.find((c) => c.name === 'session_id')).toBeUndefined();
  });

  it('GET /me balikin 401 tanpa cookie', async () => {
    const res = await app.inject({ method: 'GET', url: '/me' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /me balikin 200 dengan cookie session valid', async () => {
    await seedTestUsers();
    const cookie = await loginAs(app, 'admin');

    const res = await app.inject({ method: 'GET', url: '/me', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ user: { role: 'admin' } });
  });

  it('POST /logout invalidasi sesi — /me setelahnya balikin 401', async () => {
    await seedTestUsers();
    const cookie = await loginAs(app, 'admin');

    const logoutRes = await app.inject({ method: 'POST', url: '/logout', headers: { cookie } });
    expect(logoutRes.statusCode).toBe(200);

    const meRes = await app.inject({ method: 'GET', url: '/me', headers: { cookie } });
    expect(meRes.statusCode).toBe(401);
  });

  it('session_id palsu/random balikin 401', async () => {
    await seedTestUsers();
    const forged = `session_id=${'a'.repeat(64)}`;

    const res = await app.inject({ method: 'GET', url: '/me', headers: { cookie: forged } });
    expect(res.statusCode).toBe(401);
  });

  /* Jalur berbeda dari cek is_active saat login: user bisa dinonaktifkan
     SETELAH sesinya terbit. authPreHandler cek ulang tiap request dan hapus
     sesinya, jadi pencabutan akses langsung berlaku — bukan nunggu sesi expired. */
  it('user yang dinonaktifkan saat sesi masih hidup langsung ditolak dan sesinya dihapus', async () => {
    await seedTestUsers();
    const cookie = await loginAs(app, 'finance');

    // Sesi valid dulu.
    const before = await app.inject({ method: 'GET', url: '/me', headers: { cookie } });
    expect(before.statusCode).toBe(200);

    // Admin menonaktifkan user-nya di tengah jalan.
    await getDb().updateTable('app_user')
      .set({ is_active: false })
      .where('email', '=', testUserEmail('finance'))
      .execute();

    const after = await app.inject({ method: 'GET', url: '/me', headers: { cookie } });
    expect(after.statusCode).toBe(401);
    expect(after.json().code).toBe('account_disabled');

    // Sesi harus benar-benar dihapus dari DB, bukan cuma ditolak sekali.
    const sessionId = cookie.replace('session_id=', '');
    const leftover = await getDb().selectFrom('user_session')
      .select('id').where('id', '=', sessionId).executeTakeFirst();
    expect(leftover).toBeUndefined();
  });

  /* Regresi: /me dulu melaporkan shops[0] sebagai active_shop_id tanpa
     menyimpannya ke sesi. Setelah shopId jadi fail-closed, itu bikin UI
     menampilkan toko aktif sementara semua route data balas 400. */
  it('/me menyembuhkan sesi tanpa toko aktif — memilih shop pertama dan menyimpannya', async () => {
    await seedTestUsers();
    const cookie = await loginAs(app, 'admin');
    const sessionId = cookie.replace('session_id=', '');

    // Sesi lama yang terbit saat belum ada shop aktif.
    await getDb().updateTable('user_session')
      .set({ shop_id: null }).where('id', '=', sessionId).execute();

    const me = await app.inject({ method: 'GET', url: '/me', headers: { cookie } });
    expect(me.statusCode).toBe(200);
    const reported = me.json().active_shop_id;
    expect(reported).not.toBeNull();

    // Yang dilaporkan harus benar-benar tersimpan, bukan cuma ditampilkan.
    const sess = await getDb().selectFrom('user_session')
      .select('shop_id').where('id', '=', sessionId).executeTakeFirst();
    expect(sess?.shop_id).toBe(reported);

    // Dan route data ikut jalan, bukan 400 no_active_shop.
    const data = await app.inject({ method: 'GET', url: '/sales/summary', headers: { cookie } });
    expect(data.statusCode).toBe(200);
  });

  it('POST /me/shop pindah active shop', async () => {
    const { shopId } = await seedTestUsers();
    const cookie = await loginAs(app, 'admin');

    // Bikin shop kedua yang aktif supaya ada tujuan pindah selain shop seed.
    const secondShop = await getDb().insertInto('shop')
      .values({
        channel: 'shopee',
        external_shop_id: 'test-shop-2',
        name: 'Test Shop 2',
        is_active: true,
        authorized_at: new Date(),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    expect(secondShop.id).not.toBe(shopId);

    const switchRes = await app.inject({
      method: 'POST',
      url: '/me/shop',
      headers: { cookie },
      payload: { shop_id: secondShop.id },
    });
    expect(switchRes.statusCode).toBe(200);
    expect(switchRes.json()).toMatchObject({ active_shop_id: secondShop.id });

    // Sesi harus kebawa pindah — /me sesudahnya melaporkan shop baru sebagai aktif.
    const meRes = await app.inject({ method: 'GET', url: '/me', headers: { cookie } });
    expect(meRes.statusCode).toBe(200);
    expect(meRes.json()).toMatchObject({ active_shop_id: secondShop.id });
  });
});
