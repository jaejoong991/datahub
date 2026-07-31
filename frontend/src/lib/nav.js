/* Sumber tunggal daftar menu + aturan akses menu.
   Feature key WAJIB cocok dengan ALL_FEATURES di pages/AdminRoles.jsx
   dan dengan requireFeature(...) di backend/src/web/routes/. */

const DEFAULT_SHOP_FEATURES = ['reader'];

export const NAV = [
  { group: 'Dasar', items: [
    { id: 'sinkron',      name: 'Dashboard & Status', icon: 'sync',              features: ['reader'] },
    { id: 'exports',      name: 'Export CSV',         icon: 'download',           features: ['export'] },
  ]},
  { group: 'Transaksi', items: [
    { id: 'ringkasan', name: 'Order (Pesanan)',     icon: 'dashboard',        features: ['order'] },
    { id: 'keuangan',  name: 'Keuangan & Escrow',   icon: 'account_balance',  features: ['finance'] },
    { id: 'returns',   name: 'Retur & Refund',      icon: 'undo',             features: ['returns'] },
  ]},
  { group: 'Katalog', items: [
    { id: 'katalog_stok', name: 'Produk & Varian',       icon: 'inventory_2', features: ['product'] },
    { id: 'media',        name: 'Media (Gambar/Video)',   icon: 'image',       features: ['media'] },
    { id: 'categories',   name: 'Kategori Toko',          icon: 'category',    features: ['category'] },
  ]},
  { group: 'Operasional', items: [
    { id: 'stok',       name: 'Stok & Gudang',        icon: 'warehouse',      features: ['warehouse'] },
    { id: 'gudang',     name: 'Logistik & Kirim',      icon: 'local_shipping', features: ['logistics'] },
    { id: 'tiered_wh',  name: 'Multi-Warehouse',       icon: 'warehouse',      features: ['tiered_wh'] },
    { id: 'fbs',        name: 'Fulfillment Shopee',    icon: 'local_shipping', features: ['fbs'] },
    { id: 'firstmile',  name: 'First Mile Pickup',     icon: 'directions_car', features: ['firstmile'] },
  ]},
  { group: 'Promosi', items: [
    { id: 'vouchers',   name: 'Voucher Diskon',    icon: 'confirmation_number', features: ['voucher'] },
    { id: 'discounts',  name: 'Diskon Produk',     icon: 'percent',            features: ['discount'] },
    { id: 'bundles',    name: 'Bundle Deal',       icon: 'inventory',          features: ['bundle'] },
    { id: 'addons',     name: 'Add-On Deal',       icon: 'add_shopping_cart',  features: ['addon'] },
    { id: 'flashsales', name: 'Flash Sale',        icon: 'bolt',               features: ['flashsale'] },
    { id: 'toppicks',   name: 'Top Picks',         icon: 'stars',              features: ['toppicks'] },
    { id: 'livestream', name: 'Live Streaming',     icon: 'live_tv',            features: ['livestream'] },
    { id: 'videos',     name: 'Video Produk',       icon: 'videocam',           features: ['video'] },
  ]},
  { group: 'Iklan', items: [
    { id: 'ads', name: 'Iklan Shopee',   icon: 'campaign', features: ['ads'] },
    { id: 'ams', name: 'Affiliate AMS',  icon: 'group',    features: ['ams'] },
  ]},
  { group: 'Laporan', items: [
    { id: 'account_health', name: 'Kesehatan Toko', icon: 'health_and_safety', features: ['account_health'] },
  ]},
  { group: 'Khusus', items: [
    { id: 'global_product', name: 'Cross-Border',     icon: 'public',  features: ['global_product'] },
    { id: 'sales_legacy',   name: 'Sales (Legacy)',   icon: 'history', features: ['sales'] },
  ]},
  { group: 'Integrasi', items: [
    { id: 'erp', name: 'Integrasi Accurate', icon: 'account_tree', features: ['erp'] },
  ]},
  /* Sistem: backend /admin/* dijaga requireRole(['admin']), jadi menunya
     admin-only. Tanpa adminOnly, role apa pun yang punya 'reader' melihat
     menu ini lalu kena 403 saat dibuka. */
  { group: 'Sistem', items: [
    { id: 'users', name: 'Pengguna',      icon: 'manage_accounts',   features: ['reader'], adminOnly: true },
    { id: 'plans', name: 'Langganan',     icon: 'workspace_premium', features: ['reader'], adminOnly: true },
    { id: 'roles', name: 'Role & Akses',  icon: 'security',           features: ['reader'], adminOnly: true },
  ]},
];

/**
 * Menu group yang boleh dilihat: irisan role features ∩ shop subscription features.
 * Admin bypass semua.
 *
 * @param {string} role
 * @param {string[]} roleFeatures  app_role.features milik role user
 * @param {string[]} shopFeatures  features paket langganan shop aktif
 * @returns {Array<{group: string, items: Array<object>}>}
 */
export function navFor(role, roleFeatures = [], shopFeatures = DEFAULT_SHOP_FEATURES) {
  const isAdmin = role === 'admin';
  const shop = shopFeatures ?? DEFAULT_SHOP_FEATURES;
  const roleOwned = roleFeatures ?? [];

  return NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => {
      if (isAdmin) return true;
      if (i.adminOnly) return false;
      const hasRoleFeature = i.features.some(f => roleOwned.includes(f));
      const hasShopFeature = i.features.some(f => shop.includes(f));
      return hasRoleFeature && hasShopFeature;
    }),
  })).filter((g) => g.items.length > 0);
}

/**
 * Daftar page id yang boleh dibuka — persis sama dengan yang dirender Sidebar.
 * Dipakai App.jsx buat validasi page aktif; harus sepakat dengan navFor,
 * kalau tidak halaman yang menunya tampil malah dilempar balik.
 *
 * @param {string} role
 * @param {string[]} roleFeatures
 * @param {string[]} shopFeatures
 * @returns {string[]}
 */
export function allowedPageIds(role, roleFeatures, shopFeatures) {
  return navFor(role, roleFeatures, shopFeatures).flatMap(g => g.items.map(i => i.id));
}
