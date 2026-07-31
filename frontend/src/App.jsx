import { useEffect, useState, useCallback } from 'react';
import {
  BrowserRouter, Routes, Route, Navigate, Outlet, Link,
  useLocation, useNavigate,
} from 'react-router-dom';
import { api, API_MODE, logout as apiLogout, switchShop as apiSwitchShop } from './lib/api.js';
import { useApi } from './lib/useApi.js';
import { mockSession } from './mocks/index.js';
import { Sidebar, Topbar } from './components/Shell.jsx';
import { NAV, allowedPageIds, pathForPage } from './lib/nav.js';
import { Loading, ErrorState } from './components/states.jsx';
import { Notice } from './components/primitives.jsx';
import Login from './pages/Login.jsx';
import Ringkasan from './pages/Ringkasan.jsx';
import Keuangan from './pages/Keuangan.jsx';
import Stok from './pages/Stok.jsx';
import Gudang from './pages/Gudang.jsx';
import Sinkron from './pages/Sinkron.jsx';
import AdminUsers from './pages/AdminUsers.jsx';
import AdminPlans from './pages/AdminPlans.jsx';
import AdminRoles from './pages/AdminRoles.jsx';
import Exports from './pages/Exports.jsx';
import { Vouchers, Discounts, Bundles, AddOns, FlashSales, TopPicks,
         LiveStream, Videos, Ads, AMS, Returns, Media, Categories,
         AccountHealth, GlobalProduct, TieredWH, FBS, FirstMile,
} from './pages/Placeholder.jsx';

const PAGES = {
  ringkasan:      { kicker: 'Transaksi',   title: 'Order (Pesanan)',         Component: Ringkasan },
  keuangan:       { kicker: 'Transaksi',   title: 'Keuangan & Escrow',       Component: Keuangan },
  stok:           { kicker: 'Operasional', title: 'Stok & Gudang',          Component: Stok },
  katalog_stok:   { kicker: 'Katalog',     title: 'Produk & Varian',        Component: Stok },
  gudang:         { kicker: 'Operasional', title: 'Logistik & Kirim',        Component: Gudang },
  exports:        { kicker: 'Dasar',       title: 'Export CSV',             Component: Exports },
  vouchers:       { kicker: 'Promosi',     title: 'Voucher Diskon',         Component: Vouchers },
  discounts:      { kicker: 'Promosi',     title: 'Diskon Produk',          Component: Discounts },
  bundles:        { kicker: 'Promosi',     title: 'Bundle Deal',            Component: Bundles },
  addons:         { kicker: 'Promosi',     title: 'Add-On Deal',            Component: AddOns },
  flashsales:     { kicker: 'Promosi',     title: 'Flash Sale',             Component: FlashSales },
  toppicks:       { kicker: 'Promosi',     title: 'Top Picks',              Component: TopPicks },
  livestream:     { kicker: 'Promosi',     title: 'Live Streaming',          Component: LiveStream },
  videos:         { kicker: 'Promosi',     title: 'Video Produk',            Component: Videos },
  ads:            { kicker: 'Iklan',       title: 'Iklan Shopee',            Component: Ads },
  ams:            { kicker: 'Iklan',       title: 'Affiliate AMS',           Component: AMS },
  returns:        { kicker: 'Transaksi',   title: 'Retur & Refund',          Component: Returns },
  media:          { kicker: 'Katalog',     title: 'Media & Upload',          Component: Media },
  categories:     { kicker: 'Katalog',     title: 'Kategori Toko',           Component: Categories },
  account_health: { kicker: 'Laporan',     title: 'Kesehatan Toko',          Component: AccountHealth },
  global_product: { kicker: 'Khusus',      title: 'Cross-Border',            Component: GlobalProduct },
  sales_legacy:   { kicker: 'Khusus',      title: 'Sales (Legacy)',           Component: Vouchers },
  erp:            { kicker: 'Integrasi',   title: 'Integrasi Accurate',       Component: Vouchers },
  tiered_wh:      { kicker: 'Operasional', title: 'Multi-Warehouse',         Component: TieredWH },
  fbs:            { kicker: 'Operasional', title: 'Fulfillment Shopee',      Component: FBS },
  firstmile:      { kicker: 'Operasional', title: 'First Mile Pickup',       Component: FirstMile },
  sinkron:        { kicker: 'Dasar',       title: 'Dashboard & Status',      Component: Sinkron },
  users:          { kicker: 'Sistem',      title: 'Pengguna',                Component: AdminUsers },
  plans:          { kicker: 'Sistem',      title: 'Langganan',               Component: AdminPlans },
  roles:          { kicker: 'Sistem',      title: 'Role & Akses',            Component: AdminRoles },
};

/* Semua page id yang dikenal, urut sesuai NAV. Route didaftarkan dari daftar
   ini (lihat <Routes> di AppRoot) supaya menu (Sidebar via navFor) dan route
   yang sungguhan ada TIDAK PERNAH didaftarkan dua kali secara terpisah. */
const PAGE_IDS = NAV.flatMap((g) => g.items.map((i) => i.id));

/* Landing page default kalau URL "/" diakses. Dipertahankan dari perilaku
   pre-router (useState awal = 'keuangan'): kalau role tidak punya akses ke
   Keuangan, jatuh ke halaman pertama yang diizinkan (allowed[0]) — sama
   seperti fallback effectivePage yang lama. */
const DEFAULT_PAGE_ID = 'keuangan';

/* Peran ditentukan server lewat /me. Pengalih di bawah hanya untuk mode mock,
   supaya klien bisa melihat perbedaan tampilan tiap peran. Hapus DevBar
   sebelum produksi. */
function DevBar({ role, onRole }) {
  if (API_MODE !== 'mock') return null;
  return (
    <div className="devbar">
      <strong style={{ fontWeight: 600 }}>Mode contoh</strong>
      <span style={{ opacity: .7 }}>data dari src/mocks · tanpa backend</span>
      <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        Lihat sebagai
        <select value={role} onChange={(e) => onRole(e.target.value)}>
          <option value="finance">Finance</option>
          <option value="sales">Sales</option>
          <option value="warehouse">Gudang</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <span className="grow">Set VITE_API_MODE=http untuk memakai backend</span>
    </div>
  );
}

/** Halaman di luar wewenang role saat ini. Ini pengecekan sisi KLIEN untuk
 *  defense-in-depth + UX (mencegah URL yang diketik langsung menampilkan
 *  konten yang menunya sendiri tidak pernah dirender) — bukan satu-satunya
 *  gerbang. Otorisasi sesungguhnya tetap ditegakkan di server lewat RBAC
 *  (requireFeature/requireRole di backend/src/web/routes/); endpoint API
 *  akan menolak dengan 403 terlepas dari apa yang dirender di sini. */
function AccessDenied() {
  return (
    <div className="page">
      <Notice tone="danger" icon="lock" title="Akses ditolak">
        Peran Anda tidak memiliki izin untuk membuka halaman ini. Kalau menurut
        Anda ini keliru, hubungi admin untuk meninjau ulang role & akses.
      </Notice>
    </div>
  );
}

function NotFoundPage({ homePath }) {
  return (
    <div className="page">
      <Notice tone="warning" icon="help" title="Halaman tidak ditemukan">
        URL ini tidak dikenal aplikasi. <Link to={homePath}>Kembali ke beranda</Link>.
      </Notice>
    </div>
  );
}

/** Shell tata letak: Sidebar + Topbar bersama, konten tiap route lewat <Outlet/>.
 *  kicker/title Topbar diturunkan dari URL aktif (bukan state terpisah) supaya
 *  selalu sinkron dengan route yang benar-benar cocok. */
function Shell({
  role, user, shops, activeShopId, features, sync, shopError,
  onNavigate, onShopChange, onLogout, children,
}) {
  const location = useLocation();
  const currentId = location.pathname.slice(1);
  const { kicker, title } = PAGES[currentId] ?? PAGES.ringkasan;
  const activeShop = shops.find((s) => s.id === activeShopId);

  return (
    <div className="shell">
      <Sidebar
        role={role}
        user={user}
        shops={shops} activeShopId={activeShopId}
        features={features}
        page={currentId} onNavigate={onNavigate}
        onShopChange={onShopChange}
        onLogout={onLogout}
      />
      <main className="main">
        <Topbar kicker={kicker} title={title} sync={sync} shopName={activeShop?.name} />
        {shopError && (
          <div className="page">
            <Notice tone="danger" icon="error" title="Gagal mengganti toko">{shopError}</Notice>
          </div>
        )}
        {children ?? <Outlet />}
      </main>
    </div>
  );
}

function AppRoot() {
  const [session, setSession] = useState(null); // null=loading, 'login'=perlu login, {user,shop}=terautentikasi
  const [sessionError, setSessionError] = useState(null);
  const [role, setRole] = useState('finance');
  const [appActiveShopId, setAppActiveShopId] = useState(null); // override shop ID
  const [shopError, setShopError] = useState(null);
  const navigate = useNavigate();

  const loadSession = useCallback(async () => {
    setSession(null);
    setSessionError(null);
    try {
      const data = await api.me();
      setRole(data.user.role);
      setSession({ user: data.user, shop: data.shop });
    } catch (err) {
      if (err.status === 401) {
        setSession('login');
      } else {
        setSessionError(err.message || 'Gagal memuat sesi.');
      }
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const me = useApi(api.me, { role });
  const sync = useApi(api.syncState, { role });

  function changeRole(next) {
    mockSession.role = next;
    setRole(next);
  }

  async function handleLogout() {
    await apiLogout();
    if (API_MODE === 'mock') mockSession.loggedIn = false;
    setSession('login');
  }

  // ——— render ———

  if (session === 'login') {
    /* Sengaja TIDAK menavigasi ke path "/login": URL saat ini dibiarkan apa
       adanya. Begitu loadSession() berhasil, komponen ini langsung diganti
       oleh <Routes> di bawah yang mencocokkan URL yang SAMA — jadi kalau
       user tadinya mengetik langsung /gudang lalu diminta login, dia
       mendarat di /gudang lagi setelah login, tanpa kode redirect-balik
       terpisah. Itulah cara "deep-link intent" dipertahankan lewat login. */
    return (
      <Login
        onLogin={loadSession}
        onSkip={API_MODE === 'mock' ? () => {
          mockSession.loggedIn = true;
          loadSession();
        } : undefined}
      />
    );
  }

  if (sessionError) {
    return (
      <div style={{ padding: 40 }}>
        <ErrorState error={new Error(sessionError)} onRetry={loadSession} />
      </div>
    );
  }

  if (!session || me.status === 'loading') {
    return <div style={{ padding: 40 }}><Loading rows={4} /></div>;
  }

  if (me.status === 'error') {
    return <div style={{ padding: 40 }}><ErrorState error={me.error} onRetry={me.reload} /></div>;
  }

  const shops = me.data.shops ?? [];
  const requestedShopId = appActiveShopId ?? me.data.active_shop_id ?? shops[0]?.id;
  /* Sengaja tanpa fallback ke shops[0]: kalau toko yang diminta tidak ada di
     daftar, menu memakai fitur toko lain sementara sesi backend ada di toko
     yang berbeda — menu tampil, API-nya 403. Lebih baik berhenti dan bilang
     apa yang salah. */
  const activeShop = shops.find(s => s.id === requestedShopId) ?? null;

  if (!activeShop) {
    return (
      <div style={{ padding: 40 }}>
        {shops.length === 0 ? (
          <Notice tone="warning" icon="storefront" title="Belum ada toko aktif">
            Akun ini belum terhubung ke toko aktif mana pun, jadi tidak ada data yang
            bisa dibuka. Minta admin menugaskan toko ke akun Anda.
          </Notice>
        ) : (
          <Notice tone="danger" icon="error" title="Toko tidak ditemukan">
            Toko dengan id <strong>{requestedShopId ?? '—'}</strong> tidak ada di daftar
            toko akun ini. Muat ulang halaman untuk mengambil daftar toko terbaru.
          </Notice>
        )}
      </div>
    );
  }

  const activeShopId = activeShop.id;
  const activeFeatures = activeShop.features ?? ['reader'];

  /* Satu sumber buat sidebar dan route mana saja yang boleh menampilkan
     konten sungguhan (lihat guard per-route di <Routes> bawah). */
  const allowed = allowedPageIds(role, me.data.user?.role_features, activeFeatures);

  function onShopChange(sid) {
    setShopError(null);
    setAppActiveShopId(sid);
    if (API_MODE === 'mock') {
      mockSession.activeShopId = sid;
      return;
    }
    /* Kalau server menolak, kembalikan ke toko dari sesi. Tanpa ini menu
       memakai fitur toko baru sementara sesi backend masih toko lama —
       menu tampil, API-nya 403. */
    apiSwitchShop(sid).catch((err) => {
      setAppActiveShopId(null);
      setShopError(err?.message ?? 'Gagal mengganti toko. Coba lagi.');
    });
  }

  if (allowed.length === 0) {
    // Tidak ada satu pun page yang boleh dibuka -> tidak ada yang bisa
    // dirutekan. Tampilkan shell + notice langsung, tanpa <Routes>.
    return (
      <>
        <DevBar role={role} onRole={changeRole} />
        <Shell
          role={role} user={me.data.user}
          shops={shops} activeShopId={activeShopId} features={activeFeatures}
          sync={sync.data} shopError={shopError}
          onNavigate={(id) => navigate(pathForPage(id))}
          onShopChange={onShopChange} onLogout={handleLogout}
        >
          <div className="page">
            <Notice tone="warning" icon="lock" title="Tidak ada modul yang bisa dibuka">
              Role <strong>{me.data.user?.role_label ?? role}</strong> tidak punya fitur yang
              tersedia di paket langganan toko <strong>{activeShop.name}</strong>. Minta admin
              menambah fitur role atau menaikkan paket toko.
            </Notice>
          </div>
        </Shell>
      </>
    );
  }

  const defaultId = allowed.includes(DEFAULT_PAGE_ID) ? DEFAULT_PAGE_ID : allowed[0];

  return (
    <>
      <DevBar role={role} onRole={changeRole} />
      <Routes>
        <Route
          element={(
            <Shell
              role={role} user={me.data.user}
              shops={shops} activeShopId={activeShopId} features={activeFeatures}
              sync={sync.data} shopError={shopError}
              onNavigate={(id) => navigate(pathForPage(id))}
              onShopChange={onShopChange} onLogout={handleLogout}
            />
          )}
        >
          {PAGE_IDS.map((id) => {
            const meta = PAGES[id];
            if (!meta) return null;
            const { Component } = meta;
            return (
              <Route
                key={id}
                path={id}
                element={allowed.includes(id)
                  ? <Component role={role} onPlanChange={me.reload} onRoleChange={me.reload} />
                  : <AccessDenied />}
              />
            );
          })}
          <Route index element={<Navigate to={pathForPage(defaultId)} replace />} />
          <Route path="*" element={<NotFoundPage homePath={pathForPage(defaultId)} />} />
        </Route>
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoot />
    </BrowserRouter>
  );
}
