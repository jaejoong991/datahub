/* Data contoh. Bentuknya SAMA dengan yang diharapkan dari backend, jadi
   mengganti VITE_API_MODE ke "http" tidak menuntut perubahan komponen.

   Dua hal yang disengaja di sini:
   1. Baris keuangan dihitung dari fungsi, bukan diketik manual, supaya
      identitas bruto − biaya = payout SELALU seimbang (Tech Spec 5.2).
   2. Untuk peran gudang, kolom uang tidak dikirim sama sekali — bukan
      dikirim lalu disembunyikan. Ini meniru penyaringan di server. */

export const mockSession = { role: 'finance', loggedIn: false };

/* Fitur per shop di mock — bisa di-update oleh AdminPlans saat ganti plan.
   Default: shop 1 = Full, shop 2 = Data Viewer */
export function mockShopFeatures() {
  return mockSession.shopFeatures ?? {
    1: ['reader','order','finance','returns','product','media','category','warehouse','logistics','voucher','discount','export','account_health','erp'],
    2: ['reader'],
  };
}

/* Login mock — cocokkan email dengan user seed. Password: admin123. */
const USER_ROLES = {
  'admin@toko.id': 'admin',
  'rina@toko.id': 'finance',
  'dimas@toko.id': 'sales',
  'agus@toko.id': 'warehouse',
  'sari@toko.id': 'finance',
};

export function login(email, password) {
  if (!email || !password) return null;
  if (password !== 'admin123') return null;
  const role = USER_ROLES[email.toLowerCase()] || 'finance';
  mockSession.role = role;
  return { success: true, session_token: 'mock-token-123' };
}

const MONEY_COLUMNS = new Set([
  'gross', 'commission_fee', 'service_fee', 'admin_fee',
  'seller_voucher', 'refund_amount', 'net_payout', 'price',
]);

const USERS = {
  finance:   { name: 'Rina Ardiani',  initials: 'RA', role: 'finance',   role_label: 'Finance · Baca saja' },
  sales:     { name: 'Dimas Prakoso', initials: 'DP', role: 'sales',     role_label: 'Sales · Baca saja' },
  warehouse: { name: 'Agus Wijaya',   initials: 'AW', role: 'warehouse', role_label: 'Gudang · Baca saja' },
  admin:     { name: 'Dewi Lestari',  initials: 'DL', role: 'admin',     role_label: 'Admin' },
};

const role = () => mockSession.role;
const canSeeMoney = () => role() !== 'warehouse';

/** Menyaring kolom uang bila peran tidak berwenang. */
function filterColumns(columns) {
  return canSeeMoney() ? columns : columns.filter((c) => !MONEY_COLUMNS.has(c.id));
}

/** Menghapus field uang dari baris — bukan menyembunyikannya di UI. */
function filterRows(rows) {
  if (canSeeMoney()) return rows;
  return rows.map((r) => {
    const out = {};
    for (const [k, v] of Object.entries(r)) if (!MONEY_COLUMNS.has(k)) out[k] = v;
    return out;
  });
}

const RATES = { commission_fee: 0.07, service_fee: 0.05, admin_fee: 0.01, seller_voucher: 0.015 };

/** Membuat satu baris settlement yang identitasnya pasti seimbang. */
function settlementRow(external_order_id, payout_date, gross, refund_amount = 0) {
  const fees = {};
  let total = 0;
  for (const [k, rate] of Object.entries(RATES)) {
    fees[k] = Math.round(gross * rate);
    total += fees[k];
  }
  return {
    external_order_id, payout_date, gross, ...fees, refund_amount,
    net_payout: gross - total - refund_amount,
    is_released: true,
    has_refund: refund_amount > 0,
  };
}

const ROLE_FEATURES = {
  admin: ['reader','order','finance','returns','product','media','category','warehouse','logistics','tiered_wh','fbs','firstmile','voucher','discount','bundle','addon','flashsale','toppicks','livestream','video','ads','ams','export','account_health','global_product','sales','erp'],
  sales: ['order','product','sales'],
  finance: ['order','finance','returns','export'],
  warehouse: ['product','warehouse','logistics'],
};

export const me = () => {
  if (!mockSession.loggedIn) {
    const err = new Error('Sesi berakhir. Masuk kembali.');
    err.status = 401;
    err.code = 'unauthenticated';
    throw err;
  }
  const sf = mockShopFeatures();
  const shops = [
    { id: 1, name: 'Toko Nusantara', channel: 'shopee', features: sf[1] ?? ['reader'] },
    { id: 2, name: 'Toko Nusantara — Tokped', channel: 'tokopedia', features: sf[2] ?? ['reader'] },
  ];
  const r = role();
  return {
    user: { ...USERS[r], role_features: ROLE_FEATURES[r] ?? ['reader'] },
    active_shop_id: mockSession.activeShopId ?? 1,
    shops,
  };
};

export const syncState = () => ({
  last_success_at: new Date(Date.now() - 8 * 60_000).toISOString(),
  stale_threshold_minutes: 30,
  is_stale: false,
});

export const syncJobs = () => ({
  rows: [
    { resource: 'order',    label: 'Order',         last_success_at: new Date(Date.now() - 8 * 60_000).toISOString(),   status: 'ok',     consecutive_failures: 0, last_error: null },
    { resource: 'settlement', label: 'Keuangan',    last_success_at: new Date(Date.now() - 12 * 3600_000).toISOString(), status: 'failed', consecutive_failures: 3, last_error: 'error 10012 · invalid access_token' },
    { resource: 'product',  label: 'Produk',        last_success_at: new Date(Date.now() - 2.5 * 3600_000).toISOString(), status: 'ok',   consecutive_failures: 0, last_error: null },
    { resource: 'stock_snapshot', label: 'Snapshot stok', last_success_at: new Date(Date.now() - 15 * 3600_000).toISOString(), status: 'ok', consecutive_failures: 0, last_error: null },
  ],
  token: {
    expires_at: new Date(Date.now() + 3.5 * 3600_000).toISOString(),
    refresh_expires_at: new Date(Date.now() + 29 * 86400_000).toISOString(),
  },
  api_calls_24h: 3412,
  queue_depth: 0,
  failed_jobs: 1,
});

export const reconciliation = () => ({
  rows: [
    { check_date: '2026-07-27', local_count: 47, remote_count: 47, is_match: true },
    { check_date: '2026-07-26', local_count: 52, remote_count: 52, is_match: true },
    { check_date: '2026-07-25', local_count: 37, remote_count: 39, is_match: false },
    { check_date: '2026-07-24', local_count: 44, remote_count: 44, is_match: true },
    { check_date: '2026-07-23', local_count: 39, remote_count: 39, is_match: true },
  ],
});

export const settlementSummary = () => ({
  period: { from: '2026-07-01', to: '2026-07-27', basis: 'payout_date' },
  released: { order_count: 1089, gross: 162_400_000, total_fee: 24_360_000, net_payout: 138_040_000 },
  /* Sengaja null, bukan 0: biaya dan payout belum dikirim Shopee. */
  pending:  { order_count: 158, gross: 21_813_500, total_fee: null, net_payout: null },
  identity_balanced: true,
});

const RELEASED = [
  settlementRow('260726XYZ991', '2026-07-26', 412_500),
  settlementRow('260726XYZ947', '2026-07-26', 189_000),
  settlementRow('260725QQQ440', '2026-07-25', 276_000, 89_000),
  settlementRow('260724RRR118', '2026-07-24', 150_000),
  settlementRow('260724RRR102', '2026-07-24', 328_000),
  settlementRow('260723TTT880', '2026-07-23', 245_000),
];

const RELEASED_COLUMNS = [
  { id: 'external_order_id', label: 'Nomor order', align: 'left', mono: true },
  { id: 'payout_date',       label: 'Tgl pelepasan', align: 'left', mono: true },
  { id: 'gross',             label: 'Bruto', align: 'right' },
  { id: 'commission_fee',    label: 'Komisi', align: 'right' },
  { id: 'service_fee',       label: 'Biaya layanan', align: 'right' },
  { id: 'admin_fee',         label: 'Biaya admin', align: 'right' },
  { id: 'seller_voucher',    label: 'Voucher penjual', align: 'right' },
  { id: 'refund_amount',     label: 'Refund', align: 'right' },
  { id: 'net_payout',        label: 'Payout bersih', align: 'right', strong: true },
  { id: 'status',            label: 'Status', align: 'left' },
];

export const settlementReleased = (params) => {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 50;
  const filtered = filterRows(RELEASED);
  const start = (page - 1) * limit;
  return {
    columns: filterColumns(RELEASED_COLUMNS),
    rows: filtered.slice(start, start + limit),
    total: filtered.length,
    meta: { total: filtered.length, page, limit },
  };
};

const PENDING = [
  { external_order_id: '260727ABC123', eta: '2026-08-03', gross: 248_000, channel_status: 'Diproses' },
  { external_order_id: '260727ABC118', eta: '2026-08-03', gross: 150_000, channel_status: 'Dikirim' },
  { external_order_id: '260726XYZ903', eta: '2026-08-02', gross: 189_000, channel_status: 'Selesai, dana ditahan' },
  { external_order_id: '260726XYZ870', eta: '2026-08-02', gross: 96_000,  channel_status: 'Dikirim' },
].map((r) => ({
  ...r,
  /* null = belum tersedia. Komponen Money merender "—". */
  commission_fee: null, service_fee: null, admin_fee: null,
  seller_voucher: null, refund_amount: null, net_payout: null,
  is_released: false,
}));

export const settlementPending = (params) => {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 50;
  const filtered = filterRows(PENDING);
  const start = (page - 1) * limit;
  return {
    columns: filterColumns([
      { id: 'external_order_id', label: 'Nomor order', align: 'left', mono: true },
      { id: 'eta',               label: 'Perkiraan pelepasan', align: 'left', mono: true },
      { id: 'gross',             label: 'Bruto order', align: 'right' },
      { id: 'commission_fee',    label: 'Komisi', align: 'right' },
      { id: 'service_fee',       label: 'Biaya layanan', align: 'right' },
      { id: 'admin_fee',         label: 'Biaya admin', align: 'right' },
      { id: 'seller_voucher',    label: 'Voucher penjual', align: 'right' },
      { id: 'net_payout',        label: 'Payout bersih', align: 'right', strong: true },
      { id: 'status',            label: 'Status', align: 'left' },
    ]),
    rows: filtered.slice(start, start + limit),
    total: filtered.length,
    meta: { total: filtered.length, page, limit },
  };
};

export const feeBreakdown = () => ({
  gross: 162_400_000,
  rows: [
    { id: 'commission_fee', label: 'Komisi',             amount: 11_368_000, pct: 7.0, flagged: false },
    { id: 'service_fee',    label: 'Biaya layanan',      amount: 8_120_000,  pct: 5.0, flagged: false },
    { id: 'admin_fee',      label: 'Biaya administrasi', amount: 1_624_000,  pct: 1.0, flagged: false },
    { id: 'seller_voucher', label: 'Voucher penjual',    amount: 2_436_000,  pct: 1.5, flagged: false },
    { id: 'other_fee',      label: 'Biaya lain',         amount: 812_000,    pct: 0.5, flagged: true },
  ],
  total: { amount: 24_360_000, pct: 15.0 },
});

export const salesSummary = () => ({
  period: { from: '2026-07-01', to: '2026-07-27' },
  gross: 184_213_500,
  order_count: 1247,
  average_order_value: 147_800,
  items_sold: 2891,
  deltas: { gross: 12.4, order_count: 4.1, average_order_value: 3.8, items_sold: -3.1 },
  net_payout: 138_040_000,
});

const PRODUCTS_TOP = [
  { sku: 'KLP-L',  name: 'Kemeja Linen Putih · L',  qty: 184, gross: 27_600_000 },
  { sku: 'CCK-32', name: 'Celana Chino Krem · 32',  qty: 98,  gross: 19_600_000 },
  { sku: 'KLP-M',  name: 'Kemeja Linen Putih · M',  qty: 91,  gross: 13_650_000 },
  { sku: 'KPH-M',  name: 'Kaos Polos Hitam · M',    qty: 156, gross: 11_700_000 },
  { sku: 'TBK-01', name: 'Tote Bag Kanvas',         qty: 77,  gross: 6_160_000 },
];

export const salesTrend = () => ({
  max: 9_100_000,
  rows: [
    { report_date: '2026-07-21', gross: 6_240_000 },
    { report_date: '2026-07-22', gross: 5_840_250 },
    { report_date: '2026-07-23', gross: 7_115_000 },
    { report_date: '2026-07-24', gross: 8_240_100 },
    { report_date: '2026-07-25', gross: 6_180_400 },
    { report_date: '2026-07-26', gross: 9_100_000 },
    { report_date: '2026-07-27', gross: 5_940_200 },
  ],
});

export const topProducts = (params) => {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 50;
  const filtered = filterRows(PRODUCTS_TOP);
  const start = (page - 1) * limit;
  return {
    columns: filterColumns([
      { id: 'sku',      label: 'SKU', align: 'left', mono: true },
      { id: 'name',     label: 'Produk', align: 'left', wrap: true },
      { id: 'qty',      label: 'Qty', align: 'right' },
      { id: 'gross',    label: 'Nilai', align: 'right' },
    ]),
    rows: filtered.slice(start, start + limit),
    total: filtered.length,
    meta: { total: filtered.length, page, limit },
  };
};

export const stockSummary = () => ({
  sku_active: 214, sku_low: 12, sku_out: 3,
  stock_type_label: 'Stok tersedia',
  snapshot_at: '2026-07-26T16:50:00.000Z', // 23:50 WIB
});

const PRODUCTS_DATA = [
  { sku: 'KPH-M',  name: 'Kaos Polos Hitam · M',   price: 75_000,  stock: 0,  threshold: 5,  condition: 'out' },
  { sku: 'KLP-L',  name: 'Kemeja Linen Putih · L', price: 150_000, stock: 3,  threshold: 10, condition: 'low' },
  { sku: 'TBK-01', name: 'Tote Bag Kanvas',        price: 80_000,  stock: 8,  threshold: 10, condition: 'low' },
  { sku: 'KLP-M',  name: 'Kemeja Linen Putih · M', price: 150_000, stock: 46, threshold: 10, condition: 'ok' },
  { sku: 'CCK-32', name: 'Celana Chino Krem · 32', price: 200_000, stock: 84, threshold: 10, condition: 'ok' },
];

export const products = (params) => {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 50;
  const filtered = filterRows(PRODUCTS_DATA);
  const start = (page - 1) * limit;
  return {
    columns: filterColumns([
      { id: 'sku',       label: 'SKU', align: 'left', mono: true },
      { id: 'name',      label: 'Nama produk', align: 'left', wrap: true },
      { id: 'price',     label: 'Harga', align: 'right' },
      { id: 'stock',     label: 'Stok', align: 'right', strong: true },
      { id: 'threshold', label: 'Ambang', align: 'right' },
      { id: 'condition', label: 'Kondisi', align: 'left' },
    ]),
    rows: filtered.slice(start, start + limit),
    total: filtered.length,
    meta: { total: filtered.length, page, limit },
  };
};

const MOCK_PLANS = [
  { id: 1, name: 'Data Viewer', description: 'Lihat data', monthly_price: 0, features: ['reader'], is_active: true },
  { id: 2, name: 'Sales', description: 'Penjualan + Stok', monthly_price: 150000, features: ['reader', 'order', 'product'], is_active: true },
  { id: 3, name: 'Finance', description: '+ Keuangan + Export', monthly_price: 300000, features: ['reader', 'order', 'finance', 'returns', 'export'], is_active: true },
  { id: 4, name: 'Full', description: 'Semua modul + ERP', monthly_price: 500000, features: ['reader', 'order', 'finance', 'returns', 'product', 'media', 'category', 'warehouse', 'logistics', 'voucher', 'discount', 'export', 'account_health', 'erp'], is_active: true },
  { id: 5, name: 'Marketplace Pro', description: '+ Promosi + Iklan + Fulfillment', monthly_price: 1000000, features: ['reader', 'order', 'finance', 'returns', 'product', 'media', 'category', 'warehouse', 'logistics', 'tiered_wh', 'fbs', 'firstmile', 'voucher', 'discount', 'bundle', 'addon', 'flashsale', 'toppicks', 'livestream', 'video', 'ads', 'ams', 'export', 'account_health', 'global_product', 'erp'], is_active: true },
  { id: 6, name: 'Trial', description: '7 hari gratis', monthly_price: 0, features: ['reader', 'order', 'finance', 'returns', 'product', 'media', 'category', 'warehouse', 'logistics', 'tiered_wh', 'fbs', 'firstmile', 'voucher', 'discount', 'bundle', 'addon', 'flashsale', 'toppicks', 'livestream', 'video', 'ads', 'ams', 'export', 'account_health', 'global_product', 'erp'], is_active: false },
];

/* Update/edit plan di mock mode — function ini dipanggil oleh AdminPlans saat save */
export function __updatePlan(id, data) {
  const idx = MOCK_PLANS.findIndex(p => p.id === id);
  if (idx >= 0) MOCK_PLANS[idx] = { ...MOCK_PLANS[idx], ...data, features: [...data.features] };
}

export const adminPlans = () => ({ rows: MOCK_PLANS });

export const adminShopPlans = () => ({ rows: [
  { id: 1, shop_name: 'Toko Nusantara', channel: 'shopee', plan_id: 4, plan_name: 'Full', is_trial: false, active_since: '2026-06-01' },
  { id: 2, shop_name: 'Toko Nusantara — Tokped', channel: 'tokopedia', plan_id: 1, plan_name: 'Data Viewer', is_trial: true, active_since: '2026-07-28' },
]});

const MOCK_ROLES = [
  { name: 'sales', label: 'Sales', features: ['order', 'product'], is_system: true },
  { name: 'finance', label: 'Finance', features: ['order', 'finance', 'returns', 'export'], is_system: true },
  { name: 'warehouse', label: 'Gudang', features: ['product', 'warehouse', 'logistics'], is_system: true },
  { name: 'admin', label: 'Admin', features: ['reader', 'order', 'finance', 'returns', 'product', 'media', 'category', 'warehouse', 'logistics'], is_system: true },
];

export const adminRoles = () => ({ rows: MOCK_ROLES });

const MOCK_EXPORTS = [
  { id: 1, created_at: '2026-07-28 14:30', module: 'Keuangan', filters: 'Jul 2026', row_count: 1089, status: 'done' },
  { id: 2, created_at: '2026-07-29 09:15', module: 'Stok', filters: 'Semua SKU', row_count: 234, status: 'done' },
  { id: 3, created_at: '2026-07-30 11:00', module: 'Penjualan', filters: '7 hari', row_count: 85, status: 'running' },
];
export const exports = () => ({ rows: MOCK_EXPORTS });

export const pickList = () => ({
  rows: [
    { external_order_id: '260727ABC123', cutoff: 'Kirim sebelum 17:00', urgent: true,
      items: [{ sku: 'KLP-L', name: 'Kemeja Linen Putih · L', qty: 1 }, { sku: 'KPH-M', name: 'Kaos Polos Hitam · M', qty: 1 }] },
    { external_order_id: '260727ABC118', cutoff: 'Kirim sebelum 17:00', urgent: true,
      items: [{ sku: 'CCK-32', name: 'Celana Chino Krem · 32', qty: 1 }] },
    { external_order_id: '260727ABC090', cutoff: 'Besok', urgent: false,
      items: [{ sku: 'TBK-01', name: 'Tote Bag Kanvas', qty: 2 }, { sku: 'KLP-M', name: 'Kemeja Linen Putih · M', qty: 1 }] },
  ],
});

/* ============ Admin — user management ============ */
let MOCK_USERS = [
  { id: 1, email: 'rina@toko.id',     name: 'Rina Ardiani',  role: 'finance',   is_active: true,  created_at: '2026-06-01T08:00:00Z' },
  { id: 2, email: 'dimas@toko.id',    name: 'Dimas Prakoso', role: 'sales',     is_active: true,  created_at: '2026-06-01T08:00:00Z' },
  { id: 3, email: 'agus@toko.id',     name: 'Agus Wijaya',   role: 'warehouse', is_active: true,  created_at: '2026-06-10T09:00:00Z' },
  { id: 4, email: 'dewi@toko.id',     name: 'Dewi Lestari',  role: 'admin',     is_active: true,  created_at: '2026-06-01T08:00:00Z' },
  { id: 5, email: 'sari@toko.id',     name: 'Sari Utami',    role: 'finance',   is_active: false, created_at: '2026-06-15T10:00:00Z' },
];
let MOCK_USER_NEXT_ID = 6;

export const adminUsers = () => ({
  rows: MOCK_USERS.map(({ password_hash, ...u }) => u),
  total: MOCK_USERS.length,
});

export function createUser(data) {
  const exists = MOCK_USERS.find((u) => u.email === data.email);
  if (exists) {
    const err = new Error('Email sudah terdaftar.');
    err.status = 422;
    throw err;
  }
  const user = {
    id: MOCK_USER_NEXT_ID++,
    email: data.email,
    name: data.name,
    role: data.role || 'sales',
    is_active: true,
    created_at: new Date().toISOString(),
  };
  MOCK_USERS.push(user);
  return user;
}

export function updateUser(id, data) {
  const idx = MOCK_USERS.findIndex((u) => u.id === id);
  if (idx === -1) { const e = new Error('User tidak ditemukan.'); e.status = 404; throw e; }
  const dupe = MOCK_USERS.find((u) => u.email === data.email && u.id !== id);
  if (dupe) { const e = new Error('Email sudah terdaftar.'); e.status = 422; throw e; }
  MOCK_USERS[idx] = { ...MOCK_USERS[idx], ...data };
  const { password_hash, ...user } = MOCK_USERS[idx];
  return user;
}

export function toggleUserStatus(id) {
  const idx = MOCK_USERS.findIndex((u) => u.id === id);
  if (idx === -1) { const e = new Error('User tidak ditemukan.'); e.status = 404; throw e; }
  MOCK_USERS[idx].is_active = !MOCK_USERS[idx].is_active;
  const { password_hash, ...user } = MOCK_USERS[idx];
  return user;
}
