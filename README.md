# Ecommerce Data Hub

Dashboard internal untuk menarik data Shopee otomatis. Read-only, satu layar,
< 20 pengguna. V1 baru Shopee, arsitektur siap untuk kanal lain.

---

## Struktur

```
DataHub/
├── backend/       — Fastify API server (Node.js + TypeScript)
├── datahub-web/   — React frontend (Vite)
├── plan/          — Dokumen perencanaan (PRD, TechSpec, UI Design, checklist)
├── compose.yaml   — Postgres untuk pengembangan lokal
└── README.md
```

## Prasyarat

- Node.js 22+
- PostgreSQL 16

## Mulai

### Backend

```bash
cd backend
cp .env.example .env
# Edit DATABASE_URL kalau beda
npm install
npm run dev
# → http://localhost:3000
```

### Frontend (mock — tanpa backend)

```bash
cd datahub-web/datahub-web
npm install
npm run dev
# → http://localhost:5173, klik "Lewati login (data contoh)"
```

### Frontend + Backend

```bash
cd datahub-web/datahub-web
VITE_API_MODE=http npm run dev
```

## Login

Seed data (5 user contoh) hanya jalan otomatis saat `NODE_ENV=development`. Password
tidak lagi hardcoded — set `SEED_PASSWORD` di `.env` sebelum seed jalan, atau biarkan
kosong dan password random akan di-generate + di-log sekali ke console saat boot:

| Email | Peran |
|-------|-------|
| `admin@toko.id` | Admin |
| `rina@toko.id` | Finance |
| `dimas@toko.id` | Sales |
| `agus@toko.id` | Gudang |

Semua user seed memakai password yang sama (dari `SEED_PASSWORD` atau hasil generate).
Cek log backend saat pertama kali jalan untuk melihat passwordnya.

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | React 18, Vite 5, Recharts |
| Backend | Node.js 26, TypeScript, Fastify 5, Kysely |
| Database | PostgreSQL 16 |
| Auth | Argon2 password, HttpOnly cookie session |

## Dokumentasi

| Dokumen | Isi |
|---------|-----|
| `plan/PRD-Ecommerce-Data-Hub.md` | Kebutuhan produk v0.3 |
| `plan/TechSpec-Ecommerce-Data-Hub_1.md` | Spesifikasi teknis v0.2 |
| `plan/UI-Design-Spec.md` | Spesifikasi desain UI |
| `plan/DEVLIST.md` | Checklist progres |
| `plan/HANDOFF.md` | Handoff untuk model AI lain |
