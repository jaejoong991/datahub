/* Pin kemampuan BARU yang dibawa migrasi routing (react-router-dom):
   - deep link: buka URL halaman langsung, tanpa lewat klik Sidebar dulu.
   - guard per-route: URL yang menunya sendiri tidak pernah dirender untuk
     role tersebut tetap menampilkan "Akses ditolak", bukan konten
     sungguhan -- lihat juga App.nav.test.jsx > "page-access gating" untuk
     kasus lain dari guard yang sama.
   - tombol back/forward browser bekerja seperti navigasi web pada umumnya.
   Tidak me-mock src/lib/api.js, sama seperti App.nav.test.jsx: memakai
   jalur mock sungguhan lewat mockSession. */
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';
import { me as mockMe, mockSession } from './mocks/index.js';
import { allowedPageIds, pathForPage } from './lib/nav.js';

function resetMockSession() {
  mockSession.loggedIn = false;
  mockSession.role = 'finance';
  delete mockSession.activeShopId;
  delete mockSession.shopFeatures;
}

/** Data sesi persis yang akan didapat App.jsx dari api.me() untuk `role`. */
function sessionDataFor(role) {
  mockSession.loggedIn = true;
  mockSession.role = role;
  const data = mockMe();
  const shop = data.shops.find((s) => s.id === data.active_shop_id);
  return { data, shop };
}

beforeEach(() => {
  resetMockSession();
  window.history.pushState({}, '', '/');
});

afterEach(() => {
  cleanup();
});

describe('App — deep link', () => {
  test('membuka URL halaman langsung merender halaman itu, tanpa klik Sidebar', async () => {
    const role = 'warehouse';
    const { data, shop } = sessionDataFor(role);
    const allowed = allowedPageIds(role, data.user.role_features, shop.features);
    // 'stok' bukan landing page default ('keuangan' tidak diizinkan untuk
    // warehouse) -- jadi ini betul-betul menguji deep link, bukan kebetulan
    // mendarat di halaman yang sama dengan redirect "/" bawaan.
    expect(allowed).toContain('stok');

    window.history.pushState({}, '', pathForPage('stok'));

    render(<App />);

    // Tunggu shell (sidebar) settle dulu -- role default AppRoot ('finance')
    // sempat berbeda dari role sesi sungguhan sampai loadSession() selesai,
    // yang bikin shell sempat unmount/remount sekali di awal (bukan perilaku
    // baru dari router; sudah ada sebelum migrasi, lihat App.jsx). Query
    // heading sebelum settle bisa menangkap elemen dari render sekali-pakai
    // itu.
    await screen.findByRole('navigation');
    expect(await screen.findByRole('heading', { level: 1, name: 'Stok & Gudang' })).toBeInTheDocument();
  });
});

describe('App — guard route', () => {
  test('URL halaman yang tidak diizinkan menampilkan Akses ditolak, bukan komponen halaman', async () => {
    const role = 'sales';
    const { data, shop } = sessionDataFor(role);
    const allowed = allowedPageIds(role, data.user.role_features, shop.features);
    expect(allowed).not.toContain('users'); // Sistem/users: adminOnly

    window.history.pushState({}, '', pathForPage('users'));

    render(<App />);

    await screen.findByRole('navigation'); // settle dulu, lihat komentar di test deep link
    expect(await screen.findByText('Akses ditolak')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('App — back/forward', () => {
  test('tombol back/forward browser berpindah antar halaman yang sudah dikunjungi', async () => {
    const user = userEvent.setup();
    /* role 'finance' dipakai dengan sengaja (bukan 'admin'): AppRoot punya
       useState role awal 'finance' yang lalu ditimpa loadSession() begitu
       sesi sungguhan diketahui (lihat App.jsx). Kalau role sesi BEDA dari
       default itu, ada satu momen role berubah -> key useApi(api.me,{role})
       ikut berubah -> hook itu reset ke status 'loading' sesaat -> seluruh
       shell (termasuk Sidebar) unmount/remount sekali. Ini bug laten yang
       sudah ada SEBELUM migrasi routing (bukan sesuatu yang router
       perkenalkan) dan di luar cakupan tugas ini untuk diperbaiki -- tapi
       kalau role test beda dari 'finance', jeda unmount itu bisa jatuh di
       tengah-tengah klik kedua di bawah dan membuat tombol yang sudah
       "dipegang" dari query pertama jadi elemen basi (terlepas dari DOM).
       Pakai 'finance' (= default) supaya tidak ada perpindahan role sama
       sekali, dan race ini tidak ikut teruji di sini. */
    sessionDataFor('finance');

    render(<App />);

    const nav = await screen.findByRole('navigation');
    await user.click(within(nav).getByRole('button', { name: 'Keuangan & Escrow' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Keuangan & Escrow' })).toBeInTheDocument();

    await user.click(within(nav).getByRole('button', { name: 'Retur & Refund' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Retur & Refund' })).toBeInTheDocument();

    // Tombol back browser -> harus kembali ke Keuangan, bukan cuma URL yang
    // berubah tanpa konten ikut berubah.
    act(() => { window.history.back(); });
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Keuangan & Escrow' })).toBeInTheDocument();
    });

    // Tombol forward browser -> maju lagi ke Retur & Refund.
    act(() => { window.history.forward(); });
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Retur & Refund' })).toBeInTheDocument();
    });
  });
});

describe('App — 404', () => {
  test('URL yang tidak dikenal menampilkan halaman tidak ditemukan', async () => {
    sessionDataFor('finance');

    window.history.pushState({}, '', '/halaman-tidak-ada');

    render(<App />);

    await screen.findByRole('navigation'); // settle dulu, lihat komentar di test deep link
    expect(await screen.findByText('Halaman tidak ditemukan')).toBeInTheDocument();
  });
});
