/* Pin perilaku lib/api.js: saat VITE_API_MODE tidak diset, semua panggilan
   harus lewat src/mocks/index.js, TIDAK PERNAH fetch() sungguhan. Ini modul
   .env yang tidak ada di repo test (lihat .env.example), jadi default
   `?? 'mock'` di api.js persis yang dites di sini. */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { api, login, logout } from './api.js';
import { mockSession } from '../mocks/index.js';

describe('api — mode mock (VITE_API_MODE tidak diset)', () => {
  beforeEach(() => {
    mockSession.loggedIn = true;
    mockSession.role = 'admin';
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockSession.loggedIn = false;
    mockSession.role = 'finance';
  });

  test('api.me() mengambil data dari src/mocks/index.js tanpa memanggil fetch', async () => {
    const data = await api.me();

    expect(fetch).not.toHaveBeenCalled();
    expect(data.user.role).toBe('admin');
  });

  test('api.syncState() mengambil data dari src/mocks/index.js tanpa memanggil fetch', async () => {
    const data = await api.syncState();

    expect(fetch).not.toHaveBeenCalled();
    expect(data).toHaveProperty('is_stale');
  });

  test('login() memakai mock.login() tanpa memanggil fetch', async () => {
    const result = await login('admin@toko.id', 'admin123');

    expect(fetch).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  test('logout() tidak memanggil fetch di mode mock', async () => {
    const result = await logout();

    expect(fetch).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  test('api.me() menolak dengan status 401 saat sesi belum login (perilaku mock apa adanya)', async () => {
    mockSession.loggedIn = false;

    await expect(api.me()).rejects.toMatchObject({ status: 401 });
    expect(fetch).not.toHaveBeenCalled();
  });
});
