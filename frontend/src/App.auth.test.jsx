/* Pin perilaku gerbang autentikasi App.jsx SEBELUM migrasi router:
   - api.me() berhasil  -> shell aplikasi (Sidebar/Topbar) dirender.
   - api.me() gagal 401 -> halaman Login dirender.
   src/lib/api.js di-mock utuh supaya deterministik, tidak lewat data mock
   sungguhan (itu tugas App.nav.test.jsx). */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import App from './App.jsx';
import { api } from './lib/api.js';

/* Hanya api.me yang di-mock supaya gerbang auth deterministik (resolve vs
   reject 401). Rute lain (dipakai halaman seperti Keuangan) tetap memakai
   implementasi asli, yang dalam mode mock cuma memanggil src/mocks/index.js
   -- jadi tidak perlu menstub satu-satu setiap endpoint di sini. */
vi.mock('./lib/api.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, api: { ...actual.api, me: vi.fn() } };
});

const SESSION_FINANCE = {
  user: {
    name: 'Rina Ardiani',
    initials: 'RA',
    role: 'finance',
    role_label: 'Finance · Baca saja',
    role_features: ['order', 'finance', 'returns', 'export'],
  },
  active_shop_id: 1,
  shops: [{
    id: 1,
    name: 'Toko Nusantara',
    channel: 'shopee',
    features: ['reader', 'order', 'finance', 'returns', 'product', 'media', 'category',
      'warehouse', 'logistics', 'voucher', 'discount', 'export', 'account_health', 'erp'],
  }],
};

describe('App — gerbang autentikasi', () => {
  beforeEach(() => {
    // App pakai <BrowserRouter> sungguhan sejak migrasi routing -- reset
    // path supaya tiap test mulai dari "/", tidak ketularan path dari test
    // lain (window.location jsdom dipakai bersama di seluruh file ini).
    window.history.pushState({}, '', '/');
  });

  afterEach(() => {
    // globals:false -> auto-cleanup bawaan @testing-library/react (yang
    // menempel ke afterEach global) tidak aktif. Panggil manual supaya tiap
    // test mulai dari DOM kosong.
    cleanup();
    vi.clearAllMocks();
  });

  test('me() berhasil -> shell aplikasi dirender (bukan Login)', async () => {
    api.me.mockResolvedValue(SESSION_FINANCE);

    render(<App />);

    expect(await screen.findByText('Rina Ardiani')).toBeInTheDocument();
    expect(screen.queryByText(/masuk dengan akun/i)).not.toBeInTheDocument();
  });

  test('me() gagal dengan status 401 -> halaman Login dirender', async () => {
    const err = new Error('Sesi berakhir. Masuk kembali.');
    err.status = 401;
    api.me.mockRejectedValue(err);

    render(<App />);

    expect(await screen.findByText(/masuk dengan akun/i)).toBeInTheDocument();
    expect(screen.queryByText('Rina Ardiani')).not.toBeInTheDocument();
  });

  test('me() gagal dengan error lain (bukan 401) -> tampil ErrorState, bukan Login', async () => {
    const err = new Error('Server sedang gangguan.');
    err.status = 500;
    api.me.mockRejectedValue(err);

    render(<App />);

    expect(await screen.findByText('Server sedang gangguan.')).toBeInTheDocument();
    expect(screen.queryByText(/masuk dengan akun/i)).not.toBeInTheDocument();
  });
});
