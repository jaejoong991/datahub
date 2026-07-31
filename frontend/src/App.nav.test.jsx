/* Pin perilaku navigasi & RBAC App.jsx SEBELUM migrasi router.
   Tidak me-mock src/lib/api.js: memakai jalur mock sungguhan (VITE_API_MODE
   tidak diset -> default 'mock' di lib/api.js), persis seperti mode dev.
   mockSession (src/mocks/index.js) dipakai untuk mengatur peran + status
   login, sama seperti DevBar/hash-routing yang sudah ada di App.jsx. */
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';
import { me as mockMe, mockSession } from './mocks/index.js';
import { NAV, allowedPageIds, navFor, pathForPage } from './lib/nav.js';

const NAV_NAME_BY_ID = Object.fromEntries(NAV.flatMap((g) => g.items).map((i) => [i.id, i.name]));

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
  // App pakai <BrowserRouter> sungguhan (bukan hash router) sejak migrasi
  // routing -- window.location adalah objek jsdom yang sama di seluruh file
  // ini, jadi path harus direset manual tiap test supaya tidak ketularan
  // path dari test sebelumnya.
  window.history.pushState({}, '', '/');
});

afterEach(() => {
  // globals:false -> auto-cleanup @testing-library/react tidak aktif sendiri.
  cleanup();
});

describe('App — navigasi', () => {
  test('klik item sidebar mengganti halaman yang dirender', async () => {
    const user = userEvent.setup();
    sessionDataFor('finance');

    render(<App />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Keuangan & Escrow' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retur & Refund' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Retur & Refund' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Keuangan & Escrow' })).not.toBeInTheDocument();
  });
});

describe('App — menu sesuai RBAC (navFor)', () => {
  test.each(['sales', 'finance', 'warehouse', 'admin'])(
    'sidebar role=%s menampilkan persis item yang diizinkan navFor()',
    async (role) => {
      const { data, shop } = sessionDataFor(role);
      const expectedNames = navFor(role, data.user.role_features, shop.features)
        .flatMap((g) => g.items.map((i) => i.name));

      render(<App />);

      const nav = await screen.findByRole('navigation');
      const buttons = await within(nav).findAllByRole('button');
      expect(buttons).toHaveLength(expectedNames.length);

      for (const name of expectedNames) {
        expect(within(nav).getByRole('button', { name })).toBeInTheDocument();
      }
    },
  );
});

describe('App — page-access gating', () => {
  /* Sebelum router: satu-satunya jalur langsung ke sebuah halaman di luar
     klik Sidebar adalah shortcut hash "#role:page" (screenshot tooling mode
     mock). Migrasi routing menggantinya dengan URL sungguhan -- shortcut
     hash itu sendiri dihapus (lihat komentar di AppRoot/App.jsx: URL nyata
     membuatnya berlebihan, dan tidak dipakai oleh plan/screenshots/screenshots.sh
     yang sudah ada). Test ini diperbarui untuk menavigasi lewat URL asli,
     bukan lagi lewat hash -- perilaku yang dipin (halaman di luar
     allowedPageIds() tidak pernah menampilkan konten aslinya) tetap sama. */
  test('halaman di luar allowedPageIds() menampilkan Akses ditolak, bukan konten aslinya', async () => {
    const role = 'warehouse';
    const { data, shop } = sessionDataFor(role);
    const allowedIds = allowedPageIds(role, data.user.role_features, shop.features);
    const disallowedId = NAV.flatMap((g) => g.items.map((i) => i.id))
      .find((id) => !allowedIds.includes(id));

    // Sanity check fixture: role warehouse memang punya modul yang ditolak.
    expect(disallowedId).toBeDefined();

    // Ketik langsung URL yang menunya sendiri tidak pernah dirender untuk
    // role ini -- ini serangan permukaan baru yang diperkenalkan router.
    window.history.pushState({}, '', pathForPage(disallowedId));

    render(<App />);

    // Topbar (kicker/judul) tetap mengikuti URL -- itu cuma chrome, dan
    // struktur menu (judul, ikon) sudah publik lewat bundle JS juga. Yang
    // wajib TIDAK PERNAH tampil adalah isi/komponen halaman sungguhan.
    expect(await screen.findByRole('heading', { level: 1, name: NAV_NAME_BY_ID[disallowedId] })).toBeInTheDocument();
    expect(screen.getByText('Akses ditolak')).toBeInTheDocument();
    expect(screen.getByText(/tidak memiliki izin untuk membuka halaman ini/)).toBeInTheDocument();
  });
});

describe('App — halaman placeholder', () => {
  test('modul yang belum dibangun menampilkan placeholder, bukan crash', async () => {
    const user = userEvent.setup();
    sessionDataFor('admin'); // admin bisa lihat semua menu, termasuk yang masih placeholder

    render(<App />);

    await screen.findByRole('navigation');
    await user.click(screen.getByRole('button', { name: 'Voucher Diskon' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Voucher Diskon' })).toBeInTheDocument();
    expect(screen.getByText('Modul akan dibangun dengan data dari Shopee SDK.')).toBeInTheDocument();
  });
});
