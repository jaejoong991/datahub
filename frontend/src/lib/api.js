/* Lapisan data tunggal. Komponen TIDAK memanggil fetch langsung.
   VITE_API_MODE=mock -> data contoh dari src/mocks (tanpa backend)
   VITE_API_MODE=http -> panggil backend di VITE_API_BASE

   Nama field mengikuti skema kanonik Tech Spec 4.2 (gross, commission_fee,
   net_payout, is_released, ...). Nama field mentah Shopee tidak boleh muncul
   di sini — penerjemahannya tugas backend. */

import * as mock from '../mocks/index.js';

const MODE = import.meta.env.VITE_API_MODE ?? 'mock';
const BASE = import.meta.env.VITE_API_BASE ?? '/api';

class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function http(path, params) {
  const url = new URL(BASE + path, window.location.origin);
  Object.entries(params ?? {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });
  const res = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'include' });
  if (res.status === 401) throw new ApiError('Sesi berakhir. Masuk kembali.', 401, 'unauthenticated');
  if (res.status === 403) throw new ApiError('Halaman ini di luar wewenang akun Anda.', 403, 'forbidden');
  if (!res.ok) {
    let detail = null;
    try { detail = await res.json(); } catch { /* respons bukan JSON */ }
    throw new ApiError(detail?.message ?? 'Data tidak dapat dimuat.', res.status, detail?.code);
  }
  return res.json();
}

async function httpPost(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new ApiError('Sesi berakhir. Masuk kembali.', 401, 'unauthenticated');
  if (res.status === 422) {
    let detail = null;
    try { detail = await res.json(); } catch { /* skip */ }
    throw new ApiError(detail?.message ?? 'Email atau password salah.', 422, 'validation_error');
  }
  if (!res.ok) {
    let detail = null;
    try { detail = await res.json(); } catch { /* skip */ }
    throw new ApiError(detail?.message ?? 'Gagal memproses permintaan.', res.status, detail?.code);
  }
  return res.json();
}

/* Menambah endpoint = tambah satu baris di sini, plus mock-nya. */
const routes = {
  me:                 { path: '/me',                   mock: mock.me },
  syncState:          { path: '/sync/state',           mock: mock.syncState },
  syncJobs:           { path: '/sync/jobs',            mock: mock.syncJobs },
  reconciliation:     { path: '/sync/reconciliation',  mock: mock.reconciliation },
  settlementSummary:  { path: '/finance/summary',      mock: mock.settlementSummary },
  settlementReleased: { path: '/finance/released',     mock: mock.settlementReleased },
  settlementPending:  { path: '/finance/pending',      mock: mock.settlementPending },
  feeBreakdown:       { path: '/finance/fees',         mock: mock.feeBreakdown },
  salesSummary:       { path: '/sales/summary',        mock: mock.salesSummary },
  salesTrend:         { path: '/sales/trend',          mock: mock.salesTrend },
  topProducts:        { path: '/sales/top-products',   mock: mock.topProducts },
  products:           { path: '/products',             mock: mock.products },
  stockSummary:       { path: '/products/summary',     mock: mock.stockSummary },
  pickList:           { path: '/warehouse/picklist',   mock: mock.pickList },
  adminUsers:         { path: '/admin/users',          mock: mock.adminUsers },
  adminPlans:         { path: '/admin/subscription-plans',    mock: mock.adminPlans },
  adminShopPlans:     { path: '/admin/shop-plans',            mock: mock.adminShopPlans },
  adminRoles:         { path: '/admin/roles',                  mock: mock.adminRoles },
  exports:            { path: '/exports',                      mock: mock.exports },
};

function makeCall(name) {
  const route = routes[name];
  return async function call(params) {
    if (MODE === 'mock') {
      await new Promise((r) => setTimeout(r, 220)); // meniru latensi jaringan
      return route.mock(params ?? {});
    }
    return http(route.path, params);
  };
}

// Login POST — endpoint terpisah karena method POST, bukan GET
export async function login(email, password) {
  if (MODE === 'mock') {
    await new Promise((r) => setTimeout(r, 400));
    const result = mock.login(email, password);
    if (!result) throw new ApiError('Email atau password salah.', 422, 'invalid_credentials');
    return result;
  }
  return httpPost('/login', { email, password });
}

export async function logout() {
  if (MODE === 'mock') {
    return { success: true };
  }
  return httpPost('/logout', {});
}

/* Generic POST & PUT untuk admin — path lengkap dari / */
export async function apiPost(path, body) {
  if (MODE === 'mock') {
    await new Promise((r) => setTimeout(r, 200));
    return { success: true };
  }
  return httpPost(path, body);
}

export async function apiDelete(path) {
  if (MODE === 'mock') { await new Promise(r => setTimeout(r, 200)); return { success: true }; }
  const res = await fetch(BASE + path, { method: 'DELETE', headers: { Accept: 'application/json' }, credentials: 'include' });
  if (!res.ok) { let d=null; try{d=await res.json()}catch{} throw new ApiError(d?.message??'Gagal.',res.status,d?.code); }
  return res.json();
}

export async function apiPut(path, body) {
  if (MODE === 'mock') {
    await new Promise((r) => setTimeout(r, 200));
    return { success: true };
  }
  const res = await fetch(BASE + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = null;
    try { detail = await res.json(); } catch { /* skip */ }
    throw new ApiError(detail?.message ?? 'Gagal.', res.status, detail?.code);
  }
  return res.json();
}

export async function switchShop(shopId) {
  if (MODE === 'mock') {
    await new Promise((r) => setTimeout(r, 100));
    return { active_shop_id: shopId };
  }
  return httpPost('/me/shop', { shop_id: shopId });
}

/* Admin: user CRUD */
export async function createUser(data) {
  if (MODE === 'mock') {
    await new Promise((r) => setTimeout(r, 300));
    return mock.createUser(data);
  }
  return httpPost('/admin/users', data);
}

export async function updateUser(id, data) {
  if (MODE === 'mock') {
    await new Promise((r) => setTimeout(r, 300));
    return mock.updateUser(id, data);
  }
  return apiPut(`/admin/users/${id}`, data);
}

export async function toggleUserStatus(id) {
  if (MODE === 'mock') {
    await new Promise((r) => setTimeout(r, 200));
    return mock.toggleUserStatus(id);
  }
  return httpPost(`/admin/users/${id}/toggle`, {});
}

export const api = Object.fromEntries(
  Object.keys(routes).map((name) => [name, makeCall(name)]),
);

export { ApiError, MODE as API_MODE };
