import { useEffect, useState, useCallback } from 'react';
import { api, API_MODE, logout as apiLogout, switchShop as apiSwitchShop } from './lib/api.js';
import { useApi } from './lib/useApi.js';
import { mockSession } from './mocks/index.js';
import { Sidebar, Topbar } from './components/Shell.jsx';
import { allowedPageIds } from './lib/nav.js';
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

export default function App() {
  const [session, setSession] = useState(null); // null=loading, 'login'=perlu login, {user,shop}=terautentikasi
  const [sessionError, setSessionError] = useState(null);
  const [role, setRole] = useState('finance');
  const [page, setPage] = useState('keuangan');
  const [appActiveShopId, setAppActiveShopId] = useState(null); // override shop ID
  const [shopError, setShopError] = useState(null);

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

  // Hash routing untuk screenshot: /#ringkasan, /#keuangan, /#stok, /#gudang, /#sinkron, /#users
  // Role override: /#warehouse:stok, /#finance:ringkasan
  useEffect(() => {
    if (!session || session === 'login') return;
    const hash = window.location.hash.replace('#', '');
    if (!hash) return;
    const parts = hash.split(':');
    const targetRole = parts.length > 1 ? parts[0] : null;
    const targetPage = parts.length > 1 ? parts[1] : parts[0];
    if (targetRole && API_MODE === 'mock') {
      mockSession.role = targetRole;
      setRole(targetRole);
    }
    const sid = me.data?.active_shop_id ?? 1;
    const shopFeatures = me.data?.shops?.find(s => s.id === sid)?.features;
    const allowed = allowedPageIds(targetRole || role, me.data?.user?.role_features, shopFeatures);
    if (allowed.includes(targetPage)) setPage(targetPage);
  }, [session, role]);

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
    // Auto-login di mock mode kalau ada hash → buat screenshot
    if (API_MODE === 'mock' && window.location.hash.length > 1) {
      mockSession.loggedIn = true;
      loadSession();
      return null;
    }
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

  /* Satu sumber buat sidebar dan konten. Page di luar daftar ini tidak pernah
     dirender, jadi tidak ada lagi kasus menu tampil tapi isinya dilempar balik. */
  const allowed = allowedPageIds(role, me.data.user?.role_features, activeFeatures);
  const effectivePage = allowed.includes(page) ? page : allowed[0];
  const { Component, kicker, title } = PAGES[effectivePage] ?? PAGES.ringkasan;

  return (
    <>
      <DevBar role={role} onRole={changeRole} />
      <div className="shell">
        <Sidebar
          role={role}
          user={me.data.user}
          shops={shops} activeShopId={activeShopId}
          features={activeFeatures}
          page={effectivePage} onNavigate={setPage}
          onShopChange={(sid) => {
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
          }}
          onLogout={handleLogout}
        />
        <main className="main">
          <Topbar kicker={kicker} title={title} sync={sync.data} shopName={activeShop.name} />
          {shopError && (
            <div className="page">
              <Notice tone="danger" icon="error" title="Gagal mengganti toko">{shopError}</Notice>
            </div>
          )}
          {allowed.length === 0 ? (
            <div className="page">
              <Notice tone="warning" icon="lock" title="Tidak ada modul yang bisa dibuka">
                Role <strong>{me.data.user?.role_label ?? role}</strong> tidak punya fitur yang
                tersedia di paket langganan toko <strong>{activeShop.name}</strong>. Minta admin
                menambah fitur role atau menaikkan paket toko.
              </Notice>
            </div>
          ) : (
            <Component role={role} onPlanChange={me.reload} onRoleChange={me.reload} />
          )}
        </main>
      </div>
    </>
  );
}
