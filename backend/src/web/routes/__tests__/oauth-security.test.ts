import { randomBytes } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../index.js';
import { closeDb } from '../../../lib/db.js';
import { resetDb, seedTestUsers, loginAs } from '../../../test/helpers.js';

const OAUTH_STATE_COOKIE = 'shopee_oauth_state';

/* Bikin nilai state 64 hex char, meniru format randomBytes(32).toString('hex')
   yang dipakai beginShopeeAuth() di auth.ts. */
function randomState(): string {
  return randomBytes(32).toString('hex');
}

describe('OAuth CSRF state — GET /auth/shopee/callback', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    await resetDb();
    app = await buildApp();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('no state param and no cookie → 400', async () => {
    // `code` disertakan supaya request ini jatuh ke branch validasi state,
    // bukan ke pengecekan "Missing code" yang jalan lebih dulu.
    const res = await app.inject({ method: 'GET', url: '/auth/shopee/callback?code=abc123' });
    expect(res.statusCode).toBe(400);
  });

  it('state query param tanpa cookie yang cocok → 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/auth/shopee/callback?code=abc123&state=${randomState()}`,
      // sengaja tanpa header cookie
    });
    expect(res.statusCode).toBe(400);
  });

  it('cookie state tidak cocok dengan query state → 400', async () => {
    const cookieState = randomState();
    const queryState = randomState(); // beda nilai, panjang sama (64 hex char)
    const res = await app.inject({
      method: 'GET',
      url: `/auth/shopee/callback?code=abc123&state=${queryState}`,
      headers: { cookie: `${OAUTH_STATE_COOKIE}=${cookieState}.1` },
    });
    expect(res.statusCode).toBe(400);
  });

  it('state dengan PANJANG beda dari cookie → 400, tidak throw (guard sebelum timingSafeEqual)', async () => {
    const cookieState = randomState(); // 64 char
    const shortState = 'short-state'; // panjang beda → timingSafeEqual akan throw kalau tanpa guard
    const res = await app.inject({
      method: 'GET',
      url: `/auth/shopee/callback?code=abc123&state=${shortState}`,
      headers: { cookie: `${OAUTH_STATE_COOKIE}=${cookieState}.1` },
    });
    // Kalau guard panjang hilang, timingSafeEqual throw → Fastify balikin 500,
    // bukan crash proses, tapi tetap bukan 400 yang benar. Assert 400 di sini
    // melindungi guard-nya supaya tidak regresi.
    expect(res.statusCode).toBe(400);
  });
});

describe('OAuth authz — GET /auth/shopee/authorize', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    await resetDb();
    app = await buildApp();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('tanpa login → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/shopee/authorize' });
    expect(res.statusCode).toBe(401);
  });

  it('login sebagai non-admin (sales) → 403', async () => {
    await seedTestUsers();
    const cookie = await loginAs(app, 'sales');
    const res = await app.inject({
      method: 'GET',
      url: '/auth/shopee/authorize',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(403);
  });

  // Happy path (admin + channel_credential valid → redirect ke Shopee) sengaja
  // TIDAK ditest di sini: butuh partner_id/partner_key Shopee asli di
  // channel_credential supaya getShopeeSDK()/getAuthorizationUrl() tidak
  // throw, dan memalsukannya cuma akan menguji mock, bukan kode nyata. Bagian
  // yang security-critical — gating auth/role di atas — sudah dicover.
});

describe('Rate limiting — POST /login (10 per 15 menit)', () => {
  afterAll(async () => {
    await closeDb();
  });

  it('request ke-11 dalam window kena 429', async () => {
    // App terpisah (buildApp() sendiri) supaya limiter (in-memory, per
    // instance @fastify/rate-limit) tidak numpuk quota-nya ke app dari
    // describe lain atau menghabiskan jatah test lain yang jalan setelah
    // ini — limiter kunci by IP dan reset per instance baru.
    const rateLimitApp = await buildApp();
    try {
      const payload = { email: 'nope@test.local', password: 'wrong-password' };
      let lastStatus = 0;
      for (let i = 0; i < 11; i++) {
        const res = await rateLimitApp.inject({ method: 'POST', url: '/login', payload });
        lastStatus = res.statusCode;
      }
      // 10 request pertama lolos rate-limit (masing-masing 422 karena
      // kredensial salah), request ke-11 harus kena limiter.
      expect(lastStatus).toBe(429);
    } finally {
      await rateLimitApp.close();
    }
  });
});
