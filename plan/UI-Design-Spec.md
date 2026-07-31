# UI Design Specification — Ecommerce Data Hub

| | |
|---|---|
| **Versi** | 0.1 (draf) |
| **Tanggal** | 28 Juli 2026 |
| **Dokumen terkait** | PRD v0.3, TechSpec v0.2, README Frontend v0.1 |
| **Status** | Analisis existing + spesifikasi halaman yang belum dibangun |

---

## 1. Audit Existing vs PRD

### 1.1 Coverage

| Modul | PRD ID | Status | Catatan |
|-------|--------|--------|---------|
| Ringkasan Sales | F-20, F-21, F-24 | ✅ Dibangun | KPI, bar chart, top products table |
| Tabel order | F-22 | ✅ Dibangun | Via DataTable di Ringkasan |
| Detail order | F-23 | ❌ Belum | Tidak ada click-through |
| Perbandingan periode | F-25 | ❌ Belum | Hanya delta % di KPI |
| Keuangan per order | F-30 | ✅ Dibangun | Dual panel released/pending |
| Ringkasan periode | F-31 | ✅ Dibangun | KPI summary per panel |
| Filter payout date | F-32 | ✅ Dibangun | Tab toggle ordered_at/payout_date |
| Refund/retur | F-33 | ✅ Dibangun | Badge di status kolom |
| Penanda unreleased | F-34 | ✅ Dibangun | Panel terpisah tegas |
| Rekonsiliasi payout | F-35 | ❌ Belum | Halaman perbandingan bank |
| Tabel produk & varian | F-40 | ✅ Dibangun | DataTable dengan kol lengkap |
| Pencarian & filter | F-41 | ✅ Dibangun | Search box (via toolbar) |
| Peringatan stok rendah | F-42 | ⚠️ Sebagian | Badge kondisi, belum bisa atur threshold per SKU |
| Snapshot & riwayat stok | F-43 | ❌ Belum | Snapshot tersimpan, tidak ada UI riwayat |
| Daftar kirim | F-44 | ✅ Dibangun | Card-based pick list |
| Grafik stok | F-45 | ❌ Belum | |
| Export CSV | F-50–F-55 | ❌ Belum | Hanya tombol alert() |
| Integrasi ADempiere | F-70–F-78 | ❌ Belum | Fase 6 |
| Login | F-60 | ❌ Belum | Langsung masuk app |
| Peran & RBAC | F-61 | ✅ Dibangun | Nav, filter columns, server-side filtering |
| Admin kelola user | F-62 | ❌ Belum | Tidak ada halaman admin |
| Log aktivitas | F-63 | ❌ Belum | Tabel activity_log ada di DB, tidak ada UI |
| Status sinkronisasi | F-06 | ✅ Dibangun | Halaman Sinkron + FreshnessPill |
| Token & auth | F-01, F-02 | ✅ Dibangun | Tampilkan status token |

### 1.2 Ringkasan: halaman yang perlu dibangun

| Halaman | Prioritas | Keterangan |
|---------|-----------|------------|
| **Login** | **WAJIB** (F-60) | Prasyarat semua akses |
| **Export CSV panel** | **WAJIB** (F-50, F-51) | Tombol ada, logic belum |
| **Riwayat stok per SKU** | **WAJIB** (F-43) | Modal/halaman detail stok |
| **Detail order** | **WAJIB** (F-23) | Click-through dari tabel order |
| **User management** | **WAJIB** (F-62) | Halaman admin |
| **Activity log** | SEBAIKNYA (F-63) | Halaman admin |
| **Rekonsiliasi payout** | SEBAIKNYA (F-35) | Halaman finance |
| **Threshold stok** | SEBAIKNYA (F-42) | Inline edit di tabel stok |
| **ERP batch** | Fase 6 | Halaman status batch |
| **Grafik stok** | NTH (F-45) | |
| **Perbandingan periode** | NTH (F-25) | |
| **Export template** | SEBAIKNYA (F-52) | Simpan konfigurasi kolom |

---

## 2. Visual Direction

### 2.1 Posisi

**Industrial / Precision Dashboard.** Bukan "cantik" — data harus bisa dipercaya.
Internal tool, < 20 user. Tidak perlu onboarding atau marketing. Yang perlu:
- Finance bisa rekonsiliasi tanpa ragu
- Gudang bisa scan stok cepat
- Admin bisa debug sinkronisasi

### 2.2 Tema: `theme-graphite` ✅

Existing pilihan sudah tepat. Alasan:
- Primary abu-abu gelap — netral, tidak bertabrakan dengan semantik warning/danger
- Warna hangat dari Ulinary (cream cast) cocok untuk baca lama di monitor
- Jika klien minta lebih berwarna: `theme-cobalt` atau `theme-indigo`
- **JANGAN** `theme-sunset` — oranye di UI + oranye di warning = ambigu

### 2.3 Layout konsisten

```
┌──────────────────────────────────────────────┐
│  DevBar (mock only — HAPUS sebelum prod)     │
├──────┬───────────────────────────────────────┤
│      │  Topbar                                │
│      │  [kicker] [title]    [Freshness] [CSV] │
│ Side ├───────────────────────────────────────┤
│ bar  │  Page content                          │
│      │  ┌─toolbar──────────────────────────┐  │
│      │  │ filters/search/tabs/date-range   │  │
│      │  └──────────────────────────────────┘  │
│      │  ┌─kpi cards row────────────────────┐  │
│      │  └──────────────────────────────────┘  │
│      │  ┌─card / table─────────────────────┐  │
│      │  │                                   │  │
│      │  │  Server-side pagination           │  │
│      │  └──────────────────────────────────┘  │
└──────┴───────────────────────────────────────┘
```

### 2.4 Komponen existing yang dipertahankan

| Komponen | Status | Catatan |
|----------|--------|---------|
| `Shell` (Sidebar, Topbar) | ✅ Dipakai | Sidebar sticky, role-based nav |
| `DataTable` | ✅ Dipakai | Server-driven columns, format built-in |
| `primitives.jsx` (Money, Badge, Card, KpiCard, Notice, Icon) | ✅ Dipakai | Money render null jadi — |
| `states.jsx` (Loading, ErrorState, Empty, Async) | ✅ Dipakai | Semua state tertangani |
| `useApi` hook | ✅ Dipakai | Status eksplisit |
| `format.js` | ✅ Dipakai | Satu-satunya tempat format angka/waktu |
| `api.js` | ✅ Dipakai | Mock/http modes, endpoint registry |

---

## 3. Halaman Baru — Spesifikasi

### 3.1 Login (F-60)

**Tujuan:** Autentikasi pengguna, gateway ke app.

**Layout:**
- Full-screen center card
- Brand "Ecommerce Data Hub" + ikon
- Email + password field
- "Masuk" button
- Link "Lupa password?" (placeholder — implementasi future)

**States:**
- Loading: tombol disabled, spinner
- Error: pesan error merah di atas form ("Email atau password salah")
- Success: redirect ke halaman sesuai peran

**Security:**
- No "remember me" — sesi cookie HttpOnly
- Rate limit notice setelah 5 gagal (ditentukan backend)
- Session timeout redirect ke sini

**Route protection:**
- Belum login → selalu redirect ke /login
- Setelah login → redirect ke / (halaman pertama sesuai peran)

### 3.2 Export CSV Panel (F-50, F-51, F-52)

**Tujuan:** Panel slide-over dari tombol Export di Topbar.

**Trigger:** Klik "Export CSV" di Topbar halaman mana pun.

**Layout:**
```
┌─ Slide-over panel ──────────────────────────┐
│ Export data                                  │
│                                              │
│ Format angka: [Indonesia (.) ▼]              │
│                                              │
│ Kolom yang disertakan:                       │
│ ☑ Nomor order    ☑ Bruto                     │
│ ☑ Tanggal order  ☑ Komisi                    │
│ ☑ Status         ☑ Payout                    │
│                                              │
│ Urutan: [Drag handle] atau [▲] [▼]           │
│                                              │
│ [Simpan sebagai template ▼] [Batal] [Export] │
└──────────────────────────────────────────────┘
```

**Default kolom:** Berdasarkan halaman tempat panel dibuka.
**Template:** Daftar template tersimpan + "Simpan sebagai template baru".
**Export besar (> 50rb baris):** Job background, notifikasi via badge di Topbar.

**States:**
- Loading template: skeleton
- Empty template: "Belum ada template tersimpan"
- Export siap: download link atau notifikasi
- Export gagal: pesan error + tombol coba lagi

### 3.3 Detail Order (F-23)

**Tujuan:** Layar detail order — dipanggil dari klik baris di tabel order.

**Akses:** Semua role kecuali Gudang (gudang lihat versi tanpa uang).

**Layout (halaman penuh):**

```
┌─ Topbar ─────────────────────────────────────┐
│  < Kembali ke daftar order  [Export]          │
├──────────────────────────────────────────────┤
│                                              │
│  Order #260726XYZ991                         │
│  Status: [Selesai] Dana: [Sudah dilepas]     │
│                                              │
│  ┌─ Informasi ─────────┐ ┌─ Keuangan ──────┐│
│  │ Tanggal: 26 Jul 26  │ │ Bruto: Rp 412.500││
│  │ Channel: Shopee     │ │ Komisi: Rp 28.875││
│  │ Status: completed   │ │ Biaya: ...       ││
│  │                     │ │ Payout: Rp 336... ││
│  └─────────────────────┘ └──────────────────┘│
│                                              │
│  ┌─ Item ───────────────────────────────────┐│
│  │ SKU     | Produk           | Qty | Harga ││
│  │ KLP-L   | Kemeja Linen · L | 1   | 150rb ││
│  │ KPH-M   | Kaos Polos Hitam | 2   | 75rb  ││
│  └──────────────────────────────────────────┘│
│                                              │
│  ┌─ Riwayat status ─────────────────────────┐│
│  │ 26 Jul 13:02 — Dibayar                   ││
│  │ 26 Jul 14:30 — Dikirim                   ││
│  │ 28 Jul 09:15 — Selesai, dana dilepas     ││
│  └──────────────────────────────────────────┘│
└──────────────────────────────────────────────┘
```

**States:**
- Loading: skeleton 3 panel
- Error: ErrorState dengan retry
- Not found: "Order tidak ditemukan"
- Warehouse role: panel keuangan tidak dirender

### 3.4 Riwayat Stok per SKU (F-43)

**Tujuan:** Grafik + tabel perubahan stok SKU tertentu.

**Akses:** Sales, Warehouse, Admin.

**Trigger:** Klik SKU di tabel stok.

**Layout (modal):**

```
┌─ Modal ──────────────────────────────────────┐
│  SKU: KLP-L · Kemeja Linen Putih · L         │
│  Stok saat ini: 3         Ambang: 10          │
│                                              │
│  ┌─ Grafik stok ────────────────────────────┐│
│  │  ▁▃▇▅▄▃▂▁▁▃▅▆▄▃▂▁ (line chart)          ││
│  │  [7h] [14h] [30h] [Kustom ▼]             ││
│  └──────────────────────────────────────────┘│
│                                              │
│  ┌─ Tabel snapshot ─────────────────────────┐│
│  │ Tanggal     | Stok | Perubahan           ││
│  │ 28 Jul 2026 | 3    | -5 (dari order)     ││
│  │ 27 Jul 2026 | 8    | -2                  ││
│  │ 26 Jul 2026 | 10   | (snapshot awal)     ││
│  └──────────────────────────────────────────┘│
│                                              │
│  [Atur ulang ambang stok: [10] ▼]            │
└──────────────────────────────────────────────┘
```

**States:**
- No data: "Data riwayat belum tersedia. Snapshot stok harian berjalan setiap 23:50 WIB."
- Single data point: tampilkan sebagai titik, tanpa garis.
- Loading: skeleton grafik.

### 3.5 User Management — Admin (F-62)

**Tujuan:** CRUD pengguna aplikasi.

**Akses:** Admin only.

**Layout:**
- Topbar + tombol "Tambah"
- Tabel: Nama | Email | Peran | Status | Aksi (edit, nonaktifkan)
- Modal form: Nama, Email, Password, Peran (dropdown), Aktif (checkbox)
- Konfirmasi sebelum nonaktifkan

**States:**
- Empty: "Belum ada pengguna. Tambah pengguna pertama."
- Edit: form terisi data existing
- Deactivate: konfirmasi "Nonaktifkan [nama]?"
- Error duplicate email: "Email sudah terdaftar"

### 3.6 Activity Log (F-63)

**Tujuan:** Audit trail siapa akses apa dan kapan.

**Akses:** Admin only.

**Layout:**
- Toolbar filter: rentang tanggal, peran, aksi
- Tabel: Waktu | Pengguna | Peran | Aksi | Detail

Aksi: login, view_report, export, user_create, user_deactivate, sync_manual.

**States:**
- Empty: "Belum ada aktivitas tercatat"
- Filter no result: "Tidak ada aktivitas yang cocok dengan filter"

### 3.7 Rekonsiliasi Payout (F-35)

**Tujuan:** Bandingkan total payout aplikasi vs mutasi bank.

**Akses:** Finance, Admin.

**Layout:**
- Pilih periode (bulan)
- Tabel: Tanggal | Total payout app | Total bank | Selisih
- Selisih 0 = hijau, selisih ≠ 0 = merah + klik lihat detail

Integrasi mutasi bank: upload CSV (manual). Otomatis nanti.

### 3.8 ERP Batch (Fase 6)

**Tujuan:** Lihat status pengiriman jurnal ke ADempiere.

**Akses:** Admin.

**Layout:**
- Tabel batch: Ref | Periode | Status | Jumlah row | Total | Aksi
- Filter: status, periode
- Status badge: draft, blocked (merah + tooltip SKU penyebab), sent, completed, failed
- Tombol "Buat batch baru"

---

## 4. Perbaikan UX Existing

### 4.1 Date Range Picker

**Masalah:** Semua halaman paket periode fixed. Tidak ada kontrol tanggal.

**Solusi:** Komponen DateRangePicker seragam:
- Dua input date (dari–sampai)
- Preset cepat: "7 hari", "30 hari", "Bulan ini", "Bulan lalu"
- Format WIB, konsisten dengan `report_date`

### 4.2 Grafik CSS -> Chart Library

**Masalah:** Bar chart Ringkasan pake CSS div. Tidak interaktif.

**Solusi:** Recharts — React-native, tree-shakeable:
- Ringkasan: bar + line combo
- Riwayat stok: line chart
- Finance: donut chart komposisi biaya

### 4.3 Search & Filter Standarisasi

Toolbar standar per halaman:
```
[DateRangePicker] [Search] [Status filter ▼] [Export CSV]
```

### 4.4 Pagination Server-side

Tambah pagination footer di DataTable:
```
« < Halaman 3 dari 91 > »   50 baris/halaman   Total: 1.247
```
- Page size default 50
- Total dari `meta.total` backend
- Skeleton saat pindah halaman

### 4.5 Keyboard Navigasi

- Tabel: arrow key antar baris, Enter buka detail
- Search: auto-focus saat toolbar dimuat
- Tab order logis

---

## 5. Komponen Baru

| Komponen | Untuk | Prioritas |
|----------|-------|-----------|
| `DateRangePicker` | Semua halaman | WAJIB |
| `SlideOver` | Export panel | WAJIB |
| `Pagination` | DataTable | WAJIB |
| `Chart` (Recharts) | Ringkasan, riwayat stok | WAJIB |
| `LoginForm` | Login page | WAJIB |
| `UserForm` | User management | WAJIB |
| `ActivityFeed` | Activity log | SEBAIKNYA |
| `BatchStatusTable` | ERP | Fase 6 |

---

## 6. Route Structure

| Path | Halaman | Role |
|------|---------|------|
| `/login` | Login | — |
| `/` | Redirect ke halaman pertama | semua |
| `/ringkasan` | Sales dashboard | sales, finance, admin |
| `/keuangan` | Finance module | finance, admin |
| `/order/:id` | Order detail | sales, finance, admin |
| `/stok` | Product & stock | sales, warehouse, admin |
| `/stok/:sku` | Stock history | sales, warehouse, admin |
| `/gudang` | Pick list | warehouse, admin |
| `/sinkron` | Sync status | admin |
| `/admin/users` | User management | admin |
| `/admin/logs` | Activity log | admin |
| `/admin/erp` | ERP batch status | admin (future) |

404 → redirect halaman pertama. No role → 403.

---

## 7. Urutan Implementasi

| # | Item | Dependensi |
|---|------|-----------|
| 1 | `DateRangePicker` | None |
| 2 | `Pagination` di DataTable | Backend pagination |
| 3 | Login page + route guard | Backend `/me` (udah di kontrak) |
| 4 | Chart wrapper (Recharts) | Install recharts |
| 5 | Order detail page | Backend detail order |
| 6 | Stock history modal | Backend snapshot per SKU |
| 7 | Export panel (SlideOver) | Backend export |
| 8 | User management | Backend CRUD user |
| 9 | Activity log | Backend log endpoint |
| 10 | Rekonsiliasi payout | Backend + upload bank statement |
| 11 | ERP batch (Fase 6) | Integrasi ADempiere |

**Foundation (1–4) kerjakan dulu** — semua halaman baru butuh DateRangePicker, pagination, login, chart proper.

---

## 8. Prinsip yang Wajib Dipertahankan

Dari kode existing:

1. **Nilai uang hanya lewat `<Money>`** — tidak pernah `{row.net_payout}` langsung
2. **Kolom tabel dari server** — bukan daftar tetap frontend
3. **Null ≠ 0** — `—` untuk nilai belum tersedia, bukan "Rp 0"
4. **Panel released & pending tidak dijumlahkan** — sengaja dipisah tegas
5. **Gudang tidak terima kolom uang** — filtering server, frontend cuma render
6. **Status badge = ikon + teks** — bukan warna saja
7. **Setiap halaman tampilkan indikator kesegaran data**
8. **Kegagalan senyap dilarang** — loading/error/empty state wajib
9. **Data fetching cuma lewat `api.js`** — no fetch langsung dari komponen
10. **Format angka/waktu cuma lewat `format.js`** — satu tempat, konsisten
