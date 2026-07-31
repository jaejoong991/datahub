# Development Checklist — Ecommerce Data Hub

**Status:** 28 Juli 2026  
**Frontend:** React v0.1 → v0.2  
**Backend:** Fastify + TypeScript v0.1 (struktur selesai, perlu DB)

---

## Foundation (Fase 0-1)

### Data layer
- [x] API abstraction (`api.js`) — mock & http mode
- [x] `useApi` hook — loading | ready | error states
- [x] Format utilities (`format.js`) — IDR, WIB, null → `—`
- [x] Mock data — semua endpoint, termasuk pagination meta

### Design system
- [x] Ulinary tokens — colors, typography, spacing
- [x] Theme `theme-graphite` (netral, cocok finance)
- [x] Primitives — `Money`, `Badge`, `Card`, `KpiCard`, `Notice`, `Icon`

### Auth
- [x] Login page — email + password, error states, loading spinner
- [x] Session check via `/me` — 401 → redirect login
- [x] Logout button — sidebar footer
- [x] Route guard — role-based page access

---

## Halaman Existing (Fase 2-4)

### Ringkasan / Sales Dashboard
- [x] KPI cards — bruto, order count, AOV, items sold
- [x] Delta % comparison (periode sebelumnya)
- [x] Sales trend chart — Recharts bar chart
- [x] Top products table — with pagination
- [x] Date range filter
- [x] Role filter — warehouse hide money

### Keuangan / Finance Module
- [x] Dual panel — released vs pending (TIDAK dijumlahkan)
- [x] KPI summary per panel
- [x] Released orders table — detail biaya per order
- [x] Pending orders table — null values render `—`
- [x] Fee breakdown table — persentase terhadap bruto
- [x] Toggle tanggal: order date vs payout date
- [x] Search by order number
- [x] Identity balance indicator (gross − fees = payout)
- [x] Warehouse role filter — server-side column removal

### Stok / Stock & Products
- [x] KPI cards — SKU aktif, stok rendah, stok habis
- [x] Product table — SKU, name, price, stock, threshold, condition
- [x] Stock type label (mencegah salah banding)
- [x] Condition badges — ok/low/out
- [x] Low stock & out of stock highlighting

### Gudang / Pick List
- [x] Card-based order list — per order card
- [x] No monetary values (server-side filter)
- [x] Urgency badges — "Kirim hari ini", "Terjadwal"
- [x] Item breakdown per order (SKU, name, qty)

### Sinkron / Sync Status
- [x] Token status — expiry info, re-authorize button
- [x] Sync jobs table — last success, status, error, retry
- [x] Reconciliation table — 7-day comparison, match/mismatch
- [x] API call stats — 24h calls, queue depth, failed jobs
- [x] Error messages displayed raw (admin needs them)

---

## Halaman Baru (Dibangun di sesi ini)

### Login & Auth
- [x] Login page — center card, email/password
- [x] Session management — `/me` check on mount
- [x] Logout — sidebar button
- [x] Mock mode: password "password" or skip link
- [x] HTTP mode: backend session cookie

### Components Baru
- [x] `DateRangePicker` — two date inputs + presets (7d, 30d, this month, last month)
- [x] `Pagination` — page nav, page size selector, total count
- [x] `Chart` (Recharts) — bar, line, composed, pie/donut
- [x] Modal — backdrop, form, confirmation dialog

### Admin: User Management
- [x] User table — name, email, role badge, status, created date
- [x] Add user modal — name, email, password, role dropdown
- [x] Edit user modal — pre-filled, password optional
- [x] Activate/deactivate — confirmation dialog
- [x] Duplicate email validation
- [x] Mock CRUD — 5 dummy users

---

## Belum Dibangun

### Halaman Baru
- [ ] **Order detail page** (F-23) — click-through from table
- [ ] **Stock history per SKU** (F-43) — line chart + snapshot table
- [ ] **Export CSV panel** (F-50, F-51) — slide-over, column selection
- [ ] **Export template** (F-52) — save/reuse column config
- [ ] **Activity log** (F-63) — audit trail table
- [ ] **Reconciliation payout** (F-35) — compare vs bank statement
- [ ] **ERP batch status** (Fase 6) — ADempiere integration

### UX Improvements
- [ ] DateRangePicker di halaman Keuangan & Stok
- [ ] Pagination di semua DataTable (Keuangan, Stok)
- [ ] Grafik donut biaya di Keuangan
- [ ] Inline edit threshold stok (F-42)
- [ ] Keyboard navigasi — arrow key di tabel

### Backend API (Dibangun)
- [x] Fastify + TypeScript project — package.json, tsconfig
- [x] Database schema — migration 001 (18 tabel)
- [x] Migration runner — SQL files, transaction-safe, `_migration` tracking
- [x] Seed data — 5 users (password: admin123), 1 shop, 4 sync states
- [x] Kysely DB connection + typed interfaces
- [x] Environment config — Zod-validated env vars
- [x] Auth — argon2 password hashing, AES-256-GCM token encryption
- [x] Session management — create, get, delete, cleanup
- [x] Auth preHandler — cookie-based session, 401 handling
- [x] RBAC — role checking, server-side money column filter
- [x] Structured logger — JSON-formatted, request_id support
- [x] Paginated response serializer — columns/rows/meta + role filtering
- [x] Route: `POST /login`, `POST /logout`, `GET /me`
- [x] Route: `GET /sync/state`, `/sync/jobs`, `/sync/reconciliation`
- [x] Route: `GET /finance/summary`, `/released`, `/pending`, `/fees`
- [x] Route: `GET /sales/summary`, `/sales/trend`, `/sales/top-products`
- [x] Route: `GET /products`, `/products/summary`
- [x] Route: `GET /warehouse/picklist`
- [x] Route: `GET/POST/PUT /admin/users`, `POST /admin/users/:id/toggle`
- [x] TypeScript build — `tsc --noEmit` passes ✅
- [x] Backend running on port 3000 — semua endpoint verified
- [x] PostgreSQL 16 (Homebrew, port 5433) — migrated + seeded
- [x] RBAC money filter — warehouse tidak lihat kolom uang ✅

### Backend (Belum dimulai)
- [ ] PostgreSQL database running (local Docker)
- [ ] Shopee integration — `ShopeeClient`, HMAC signing
- [ ] Token management — advisory lock, refresh, encryption
- [ ] Sync jobs — order, settlement, product, stock snapshot
- [ ] Reconciliation job — daily count comparison
- [ ] `pg-boss` queue — job scheduling, retry, dead-letter

### Infrastructure
- [ ] Docker Compose — app, worker, postgres, caddy
- [ ] CI/CD — build, test, deploy
- [ ] Backup — pg_dump harian, off-server storage
- [ ] Monitoring — health page, alerts (Telegram/email)

---

## Cara Pakai

```bash
cd datahub-web/datahub-web
npm run dev               # Mock mode (port 5173)
VITE_API_MODE=http npm run dev  # Backend mode
npm run build             # Production build
```
