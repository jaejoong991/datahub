import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../index.js';
import { closeDb } from '../lib/db.js';
import { resetDb, seedTestUsers, loginAs } from './helpers.js';

/* Test asap ini membuktikan harness-nya sendiri jalan: buildApp() bisa
   di-inject tanpa listen(), resetDb()/seedTestUsers() menyiapkan data, dan
   login mengembalikan cookie sungguhan. Test lain tinggal ikuti pola ini. */
describe('test harness smoke test', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    await resetDb();
    app = await buildApp();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('GET /health returns 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });

  it('POST /login with seeded admin returns 200 and Set-Cookie', async () => {
    await seedTestUsers();
    const cookie = await loginAs(app, 'admin');
    expect(cookie).toMatch(/^session_id=/);

    // loginAs() sudah assert status 200 & cookie ada — cek juga langsung di
    // response mentah untuk header Set-Cookie eksplisit sesuai task.
    const res = await app.inject({
      method: 'POST',
      url: '/login',
      payload: { email: 'admin@test.local', password: 'TestPassword123!' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();
  });
});
