# HANDOFF — Ecommerce Data Hub v0.4

---

## 1. Ringkasan

| | |
|---|---|
| App | Dashboard internal marketplace — read-only, < 20 user |
| Status | 29 pages, 30+ routes, Multi-channel, Role+Feature gates, SDK vendored, Vitest gate akses |
| Channel | Shopee, Tokopedia, Lazada, TikTok (DB ready) |
| ERP | **Accurate Online** (REST). Accurate 5 desktop → file import |
| SDK | `vendor/shopee-sdk/` — di-vendor, no external npm dep |
| Credential | DB (`channel_credential`) |
| Hosting | VPS Ubuntu + Dokploy |

## 2. Struktur

```
DataHub/
├── backend/
│   ├── migrations/           001-004
│   ├── vendor/shopee-sdk/    SDK local (MIT)
│   ├── src/lib/              env, db(Kysely), crypto, session, auth, rbac
│   ├── src/shopee/           client(SDK wrap), config(DB cred), token, spike
│   └── src/web/routes/       auth, sync, finance, sales, products, warehouse,
│                              admin(users/plans/roles/shops)
├── frontend/src/
│   ├── App.jsx               multi-shop, hash routing, RBAC, feature gates
│   ├── components/           DataTable, Chart(Recharts), Pagination, DateRangePicker, Shell
│   ├── pages/                29 pages (5 full + 24 placeholder)
│   ├── lib/nav.js            NAV + navFor + allowedPageIds — sumber tunggal menu
│   ├── lib/nav.test.js       9 test gate akses (Vitest)
│   ├── lib/api.js            mock/http, apiPost, apiPut, apiDelete
│   └── mocks/                login by email, mockSession
└── plan/                     PRD, TechSpec, HANDOFF, DEVLIST, layout-apps.html
```

## 3. Tech

| Layer | Teknologi |
|-------|-----------|
| FE | React 18, Vite 5, Recharts |
| FE test | Vitest 2.1 — `src/lib/nav.test.js` (gate akses) |
| BE | Node 26, TS 5.7, Fastify 5, Kysely 0.29 |
| DB | PostgreSQL 16 |
| Auth | Argon2, HttpOnly cookie (24h) |
| Shopee | vendor/shopee-sdk — 29 manager |

## 4. Jalankan

```bash
# Backend
cd backend && npm install && npm run dev  # → :3000

# Frontend mock
cd frontend && npm install && npm run dev  # → :5173

# Frontend + Backend
VITE_API_MODE=http VITE_API_BASE=http://localhost:3000 npm run dev

# Test frontend
cd frontend && npm run test:run   # sekali jalan
cd frontend && npm test           # watch mode

# Typecheck backend
cd backend && npm run lint                        # tsc --noEmit
```

Login: `admin@toko.id` / `admin123`

## 5. Arsitektur Akses (3 Lapis)

```
User Role (app_user.role) + Role Features (app_role.features) + Shop Features (subscription)
→ Menu + API access

Admin bypass semua — 29 menu, all API.
```

**Frontend** — `src/lib/nav.js` sumber tunggal:

- `navFor(role, roleFeatures, shopFeatures)` — admin full, non-admin **irisan** kedua daftar
- `allowedPageIds(role, roleFeatures, shopFeatures)` — page id yang boleh dibuka
- `adminOnly: true` di grup Sistem (users/plans/roles) — hanya admin, karena `/admin/*` = `requireRole(['admin'])`. Tanpa flag ini role apa pun yang punya `reader` melihat menu admin lalu kena 403
- `App.jsx` menurunkan `effectivePage = allowed.includes(page) ? page : allowed[0]` saat render — tidak ada `useEffect` yang menimpa `page`
- `allowed` kosong → tampil notice eksplisit, bukan fallback diam-diam ke halaman lain

⚠️ **WAJIB:** sidebar dan validasi page harus memakai argumen yang sama.
Bug historis: `navFor` dipanggil **2 argumen** di `App.jsx`, jadi shop features
masuk slot `roleFeatures` dan `shopFeatures` jatuh ke default `['reader']`.
Akibatnya hanya menu ber-feature `reader` yang lolos → menu tampil tapi
halaman dilempar balik ke `allowed[0]`. Dijaga oleh `nav.test.js`.

**Backend** — `src/lib/rbac.ts`:

- `requireFeature(['finance','order'])` — admin bypass, cek `app_role.features` lalu shop subscription features. Array = OR (cukup salah satu cocok)
- Feature key WAJIB sama di tiga tempat: `nav.js` NAV, `AdminRoles.jsx` ALL_FEATURES, `requireFeature(...)` di route

## 6. Seed

| Email | Role | PW |
|-------|------|----|
| admin@toko.id | Admin | admin123 |
| rina@toko.id | Finance | admin123 |
| dimas@toko.id | Sales | admin123 |
| agus@toko.id | Warehouse | admin123 |

2 shops: shopee (Full), tokopedia (Data Viewer)

Seed **idempotent** — `runSeed()` langsung return kalau `app_user` sudah ada isi.
Aman start instance kedua tanpa menimpa data.

Akun uji role kustom (dibuat manual via UI admin, **bukan** dari seed):

| Email | Role | Features role | PW |
|-------|------|---------------|----|
| budi@toko.id | penjaga_toko | reader, order, finance | admin123 |

Dipakai buat verifikasi gate: di shop 1 (Full) → `/finance/*` + `/sales/*` 200,
`/warehouse/*` 403, `/admin/*` 403. Setelah `POST /me/shop` ke shop 2 (Data
Viewer) → `/finance/*` jadi 403 `feature_not_enabled`, `/sync/state` tetap 200.

## 7. Endpoints

| Method | Path | Gate |
|--------|------|------|
| POST | /login, /logout | — |
| GET | /me, POST /me/shop | session |
| GET | /sync/* | admin |
| GET | /finance/*, /sales/*, /products/*, /warehouse/* | feature |
| CRUD | /admin/users, /subscription-plans, /shop-plans, /roles, /shops | admin |

## 8. Fitur Utama

- **27 fitur → 29 menu** — feature key NAV (`lib/nav.js`) = ALL_FEATURES (`AdminRoles.jsx`). Kecuali 3 menu grup Sistem: pakai key `reader` **plus** `adminOnly: true`, jadi tidak ikut aturan fitur biasa
- **Role CRUD** — custom role + checklist 27 fitur + auto-refresh
- **Subscription** — 6 plan, assign to shop + masa aktif, menu update real-time
- **Credential DB** — multi-channel tanpa env vars
- **SDK vendored** — vendor/shopee-sdk, gak depend npm

## 9. Yang Belum

1. Sync workers (pg-boss)
2. Sample data seed — `settlement` + `reconciliation_check` masih kosong, jadi
   `payout_date` / `check_date` belum bisa diverifikasi lewat API
3. Placeholder pages → isi data
4. Export CSV, Activity log
5. Accurate ERP (Fase 6)
6. Docker + Dokploy

### Temuan audit belum di-fix

| Sev | Lokasi | Masalah |
|-----|--------|---------|
| HIGH | `lib/api.js:80` → `pages/Exports.jsx:21` | Route `/exports` belum ada di backend → 404 di http mode (mock jalan, jadi tidak kelihatan saat demo) |
| HIGH | `AdminPlans.jsx:79-80` + `mocks/index.js:14-18` | Mock `shopFeatures` di-overwrite bukan di-merge — assign paket ke satu shop membuat fitur shop lain kolaps jadi `['reader']`. Mock-only |
| MED | `AdminPlans.jsx:196`, `:292` vs `:119` | `monthly_price` numeric → `"150000.00"` masuk `<input type="number">`. Locale beda untuk nilai sama: `:119` id-ID (`150.000`) vs `:292` default (`150,000`) |
| LOW | `AdminPlans.jsx:276` | `planId` number saat mount, string setelah dipilih. Aman sekarang (selalu lewat `Number()`), tapi tipe tidak homogen |

### Catatan keamanan — perlu ditangani

`backend/src/lib/rbac.ts:53` di dalam `requireFeature` ada `if (!shopId) return;`.
Kalau sesi tidak punya active shop, pemeriksaan fitur langganan **dilewati
sepenuhnya** dan request diteruskan. Saat ini belum bisa dipicu karena `/login`
selalu memilih shop aktif pertama dan id dimulai dari 1, tapi begitu ada user
tanpa shop yang ditugaskan, ini menjadi bypass gate langganan. Seharusnya
menolak dengan 403, bukan meloloskan.

## 10. Notes

- `DATABASE_URL=127.0.0.1:5433` — WAJIB (bukan localhost)
- Fastify preHandler WAJIB async
- Kysely insert → cast `as any`
- PostgreSQL 5433, BE 3000, FE 5173

### pg type parser — `backend/src/lib/db.ts`

Tipe `Database` di `db.ts` mendeklarasikan `id: number` dan kolom tanggal
`string`, tapi default node-postgres **tidak** cocok. Tanpa parser, tipe bohong
dan `tsc` tidak bisa menangkapnya. Dua parser terdaftar:

| Tipe PG | OID | Perilaku | Alasan |
|---------|-----|----------|--------|
| `bigint` | 20 | → `number`, throw kalau di luar `Number.MAX_SAFE_INTEGER` | Default = string. `'1' === 1` selalu false → gate akses & lookup shop salah |
| `date` | 1082 | → biarkan string `yyyy-MM-dd` | Default = `Date` → Fastify serialisasi ke ISO UTC; di GMT+7 `2026-07-26` jadi `2026-07-25T17:00:00.000Z`, **mundur sehari**. `<input type="date">` juga hanya terima `yyyy-MM-dd` |
| `timestamptz` | 1184 | **TIDAK diubah** → `Date` | Tipenya memang `Date` dan butuh komponen waktu (`created_at`, `synced_at`, `ordered_at`) |
| `numeric` | 1700 | **TIDAK diubah** → string | Tipenya memang string (`monthly_price`, `gross`, `net_payout`) — hindari presisi float untuk uang |

- **JANGAN** tambah cast `Number()` manual di route — parser sudah menjamin. Dua mekanisme = dua sumber kebenaran
- Kontrak `mocks/index.js` harus cocok: id **number**, tanggal string `yyyy-MM-dd`
- `count(*)` di route sudah `::int`, jadi `total` pagination tidak pernah string

### Dev server

- `tsx` **tanpa** `watch` tidak auto-reload → pakai `npm run dev` (`tsx watch`)
- Cek instance nyangkut: `lsof -ti:3000`. Dua backend jalan → yang kedua gagal
  bind, dan yang menjawab bisa jadi kode lama
- Verifikasi tanpa mengganggu server yang jalan: `PORT=3001 npx tsx src/index.ts`
  (seed idempotent, migrasi skip yang sudah applied)
