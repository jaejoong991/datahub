# Technical Specification — Ecommerce Data Hub

| | |
|---|---|
| **Versi** | 0.2 (draf) |
| **Perubahan v0.2** | Penambahan bagian 12: kesiapan fitur tulis ke Shopee (v2) |
| **Tanggal** | 27 Juli 2026 |
| **Dokumen terkait** | PRD Ecommerce Data Hub v0.3 |
| **Status** | Draf — beberapa detail menunggu hasil Fase 0.5 (spike API) |

> **Catatan:** nama endpoint, nama field, dan angka rate limit Shopee **tidak dicantumkan sebagai kepastian** dalam dokumen ini. Semuanya harus diverifikasi pada Fase 0.5 dan dicatat di Lampiran B. Yang dispesifikasikan di sini adalah struktur sistem, yang tidak berubah meski detail API berubah.

---

## 1. Prinsip desain

Lima keputusan yang mendasari seluruh dokumen ini:

1. **Shopee adalah sumber kebenaran.** Sistem ini cermin baca. Tidak ada operasi tulis ke Shopee di v1.
2. **Simpan mentah, olah belakangan.** Setiap respons API disimpan apa adanya sebelum diolah. Kalau logika pemetaan salah, data diproses ulang dari simpanan lokal — tidak menarik ulang dari API.
3. **Semua operasi idempotent.** Menjalankan job dua kali harus menghasilkan keadaan akhir yang identik.
4. **Angka harus bisa dibuktikan.** Setiap nilai di laporan harus dapat dilacak ke satu baris payload mentah.
5. **Sederhana lebih penting daripada canggih.** Satu pengguna organisasi, < 20 orang, satu toko. Tidak ada Kubernetes, tidak ada microservice, tidak ada Redis kalau Postgres cukup.

## 2. Arsitektur

Empat proses, satu database:

| Komponen | Tanggung jawab |
|---|---|
| **API/Web server** | Melayani UI, autentikasi, query laporan, memulai export |
| **Worker** | Menjalankan job sinkronisasi, export besar, kiriman ERP |
| **Scheduler** | Mendaftarkan job berkala (bagian dari worker, bukan proses terpisah) |
| **PostgreSQL** | Data operasional + antrian job + penyimpanan payload mentah |

Antrian job memakai **pg-boss** (antrian berbasis Postgres). Alasan: tidak perlu Redis, job survive restart, dan sudah menyediakan penjadwalan cron, retry, dan dead-letter. Untuk skala satu toko ini lebih dari cukup, dan menghilangkan satu komponen infrastruktur yang harus dipantau.

**Stack yang direkomendasikan** (bisa disesuaikan dengan keahlian tim):

- Runtime: Node.js + TypeScript
- HTTP: Fastify
- Akses DB: Kysely atau Drizzle (SQL-first — laporan di sini banyak agregasi, ORM justru menghalangi)
- Migrasi: file SQL bernomor, dijalankan lewat CLI migrasi
- Frontend: server-rendered (Astro/Nunjucks/Blade) atau React sederhana. **Untuk v1 pertimbangkan Metabase** di atas Postgres untuk dashboard dan tabel — hemat pekerjaan frontend berminggu-minggu, sedangkan aplikasi Anda fokus pada kualitas data.
- Container: Docker Compose

## 3. Integrasi Shopee

### 3.1 Autentikasi

Setiap panggilan ditandatangani HMAC-SHA256 dengan `partner_key`, atas string yang disusun dari `partner_id`, path endpoint, timestamp, dan (untuk endpoint bertoken) `access_token` serta `shop_id`. Susunan persisnya diverifikasi di Fase 0.5.

Implementasi wajib:

```
class ShopeeClient
  - sign(path, timestamp, token?, shopId?) -> string
  - call(path, params, opts) -> response
      · injeksi timestamp & signature
      · retry dengan exponential backoff + jitter untuk error 5xx dan rate limit
      · TIDAK retry untuk error validasi 4xx
      · catat setiap panggilan ke api_call_log (path, durasi, status)
      · timeout eksplisit (mis. 30 detik)
```

Semua panggilan wajib lewat satu kelas ini. Tidak ada `fetch` ke Shopee yang tersebar di kode lain — kalau tidak, penerapan rate limit dan logging jadi tidak konsisten.

### 3.2 Siklus hidup token — bagian paling rawan

Fakta yang menentukan desain: `access_token` berumur pendek (hitungan jam), dan `refresh_token` **berubah setiap kali dipakai**. Kalau dua proses me-refresh bersamaan, salah satu hasilnya tidak terpakai dan token yang tersimpan bisa jadi tidak valid.

Aturan implementasi:

1. Token hanya dibaca dan ditulis lewat satu fungsi `getValidToken(shopId)`.
2. Fungsi itu mengambil **Postgres advisory lock** per toko sebelum refresh:
   ```sql
   SELECT pg_advisory_xact_lock(hashtext('shopee_token_' || :shop_id));
   ```
3. Setelah lock didapat, **baca ulang** token dari DB — mungkin proses lain sudah me-refresh.
4. Refresh proaktif ketika sisa umur < 30 menit, bukan menunggu kedaluwarsa.
5. Job terjadwal me-refresh setiap 1 jam sebagai jaring pengaman, tidak bergantung pada trafik.
6. Setiap kegagalan refresh mengirim alert. Tiga kegagalan berturut-turut = alert prioritas tinggi.
7. Token disimpan terenkripsi (lihat 9.2).

**Prosedur pemulihan wajib didokumentasikan:** jika refresh token kedaluwarsa (mis. server mati berminggu-minggu), otorisasi harus dilakukan ulang manual oleh pemilik toko. Sediakan halaman admin yang menghasilkan link otorisasi, dan tulis prosedurnya di README.

### 3.3 Rate limit

Semua panggilan melewati satu token-bucket limiter di sisi kita, dengan batas dipasang **di bawah** batas resmi Shopee. Angka pastinya diisi setelah Fase 0.5. Job berjalan dengan konkurensi terbatas (mulai dari 2 worker) dan job berat seperti backfill memakai antrian prioritas rendah agar tidak menghambat sinkronisasi rutin.

## 4. Model data

### 4.1 Konvensi

| Hal | Keputusan | Alasan |
|---|---|---|
| Uang | `numeric(18,2)` | Presisi eksak. **Jangan** `float`/`double` — pembulatan akan membuat rekonsiliasi gagal |
| Waktu | `timestamptz`, disimpan UTC | Shopee mengirim Unix epoch; konversi sekali di lapisan pemetaan |
| Tanggal laporan | Kolom terpisah, hasil konversi ke `Asia/Jakarta` | Lihat 4.3 |
| ID internal | `bigint generated always as identity` | ID eksternal tetap disimpan terpisah |
| Kanal | Kolom `channel` di semua tabel data | Menyiapkan kanal lain tanpa migrasi nama tabel |
| Enum | `text` + `CHECK`, bukan tipe enum Postgres | Menambah nilai baru tidak perlu migrasi tipe |

### 4.2 Skema

```sql
-- ============ Koneksi kanal ============
CREATE TABLE shop (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  channel         text NOT NULL CHECK (channel IN ('shopee')),
  external_shop_id text NOT NULL,
  name            text NOT NULL,
  access_token_enc  bytea,
  refresh_token_enc bytea,
  token_expires_at  timestamptz,
  refresh_expires_at timestamptz,
  is_active       boolean NOT NULL DEFAULT true,
  authorized_at   timestamptz,
  UNIQUE (channel, external_shop_id)
);

-- ============ Penyimpanan mentah ============
CREATE TABLE raw_payload (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id      bigint NOT NULL REFERENCES shop(id),
  resource     text   NOT NULL,          -- 'order' | 'escrow' | 'product'
  external_id  text   NOT NULL,
  payload      jsonb  NOT NULL,
  payload_hash text   NOT NULL,          -- sha256, untuk melewati payload identik
  fetched_at   timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (shop_id, resource, external_id, payload_hash)
);
CREATE INDEX ON raw_payload (shop_id, resource, processed_at)
  WHERE processed_at IS NULL;

-- ============ Status sinkronisasi ============
CREATE TABLE sync_state (
  shop_id       bigint NOT NULL REFERENCES shop(id),
  resource      text   NOT NULL,
  cursor_value  text,                    -- timestamp/page terakhir
  last_success_at timestamptz,
  last_error    text,
  last_error_at timestamptz,
  consecutive_failures int NOT NULL DEFAULT 0,
  PRIMARY KEY (shop_id, resource)
);

-- ============ Order ============
CREATE TABLE sales_order (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id        bigint NOT NULL REFERENCES shop(id),
  external_order_id text NOT NULL,
  channel_status text NOT NULL,          -- status asli dari Shopee
  status         text NOT NULL,          -- status kanonik kita (lihat 5.1)
  ordered_at     timestamptz NOT NULL,
  report_date    date NOT NULL,          -- (ordered_at AT TIME ZONE 'Asia/Jakarta')::date
  paid_at        timestamptz,
  completed_at   timestamptz,
  cancelled_at   timestamptz,
  gross_amount   numeric(18,2) NOT NULL DEFAULT 0,
  buyer_ref      text,                   -- username/ID tersamar, BUKAN data pribadi
  channel_updated_at timestamptz,
  synced_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, external_order_id)
);
CREATE INDEX ON sales_order (shop_id, report_date);
CREATE INDEX ON sales_order (shop_id, status);

CREATE TABLE sales_order_item (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id      bigint NOT NULL REFERENCES sales_order(id) ON DELETE CASCADE,
  external_item_id text NOT NULL,
  external_variant_id text,
  sku           text,
  product_name  text,
  qty           integer NOT NULL,
  unit_price    numeric(18,2) NOT NULL,
  discount      numeric(18,2) NOT NULL DEFAULT 0,
  line_total    numeric(18,2) NOT NULL,
  UNIQUE (order_id, external_item_id, external_variant_id)
);
CREATE INDEX ON sales_order_item (sku);

-- ============ Keuangan (datang belakangan, bisa berubah) ============
CREATE TABLE settlement (
  order_id         bigint PRIMARY KEY REFERENCES sales_order(id) ON DELETE CASCADE,
  gross            numeric(18,2) NOT NULL DEFAULT 0,
  commission_fee   numeric(18,2) NOT NULL DEFAULT 0,
  service_fee      numeric(18,2) NOT NULL DEFAULT 0,
  admin_fee        numeric(18,2) NOT NULL DEFAULT 0,
  seller_voucher   numeric(18,2) NOT NULL DEFAULT 0,
  platform_voucher numeric(18,2) NOT NULL DEFAULT 0,
  shipping_charged numeric(18,2) NOT NULL DEFAULT 0,
  shipping_subsidy numeric(18,2) NOT NULL DEFAULT 0,
  other_fee        numeric(18,2) NOT NULL DEFAULT 0,
  other_fee_detail jsonb,               -- komponen yang belum dipetakan eksplisit
  net_payout       numeric(18,2) NOT NULL DEFAULT 0,
  refund_amount    numeric(18,2) NOT NULL DEFAULT 0,
  payout_date      date,
  is_released      boolean NOT NULL DEFAULT false,
  synced_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON settlement (payout_date);

-- ============ Produk & stok ============
CREATE TABLE product (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id       bigint NOT NULL REFERENCES shop(id),
  external_item_id text NOT NULL,
  external_variant_id text,
  sku           text,
  name          text NOT NULL,
  variant_name  text,
  price         numeric(18,2),
  stock         integer,
  stock_type    text,                    -- jenis stok yang dipakai; lihat 5.3
  listing_status text,
  low_stock_threshold integer,
  channel_updated_at timestamptz,
  synced_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, external_item_id, external_variant_id)
);

CREATE TABLE stock_snapshot (
  shop_id    bigint NOT NULL REFERENCES shop(id),
  product_id bigint NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  taken_on   date   NOT NULL,
  stock      integer NOT NULL,
  PRIMARY KEY (product_id, taken_on)
);

-- ============ Pengguna & akses ============
CREATE TABLE app_user (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,           -- argon2id
  full_name     text NOT NULL,
  role          text NOT NULL CHECK (role IN ('sales','finance','warehouse','admin')),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE activity_log (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    bigint REFERENCES app_user(id),
  action     text NOT NULL,              -- 'login' | 'view_report' | 'export' | ...
  detail     jsonb,
  ip         inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ Operasional ============
CREATE TABLE api_call_log (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id     bigint REFERENCES shop(id),
  path        text NOT NULL,
  http_status integer,
  error_code  text,
  duration_ms integer,
  called_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reconciliation_check (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id      bigint NOT NULL REFERENCES shop(id),
  check_date   date   NOT NULL,
  local_count  integer NOT NULL,
  remote_count integer NOT NULL,
  is_match     boolean NOT NULL,
  detail       jsonb,
  checked_at   timestamptz NOT NULL DEFAULT now()
);
```

### 4.3 Zona waktu — sumber kesalahan yang paling sering

Menyimpan UTC lalu mengelompokkan laporan dengan `date_trunc('day', ordered_at)` akan menggeser batas hari 7 jam dan membuat total harian **tidak cocok** dengan laporan Shopee. Karena itu kolom `report_date` di-*materialisasi* saat pemetaan:

```sql
report_date := (ordered_at AT TIME ZONE 'Asia/Jakarta')::date
```

Semua agregasi harian, mingguan, dan bulanan memakai `report_date`, bukan `ordered_at`. Ini juga membuat query bisa memakai index.

### 4.4 Tampilan agregat

Dashboard tidak melakukan agregasi langsung ke tabel order. Gunakan materialized view yang di-refresh di akhir setiap job sinkronisasi:

```sql
CREATE MATERIALIZED VIEW mv_daily_sales AS
SELECT o.shop_id, o.report_date,
       count(*)                        AS order_count,
       sum(o.gross_amount)             AS gross_amount,
       sum(s.net_payout)               AS net_payout,
       sum(s.commission_fee + s.service_fee + s.admin_fee) AS total_fee
FROM sales_order o
LEFT JOIN settlement s ON s.order_id = o.id
WHERE o.status <> 'cancelled'
GROUP BY 1, 2;

CREATE UNIQUE INDEX ON mv_daily_sales (shop_id, report_date);
-- refresh: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_sales;
```

## 5. Pemetaan data

### 5.1 Status order

Status Shopee dipetakan ke status kanonik agar UI dan laporan tidak bergantung pada istilah kanal. **`channel_status` asli tetap disimpan** untuk penelusuran.

| Status kanonik | Arti |
|---|---|
| `pending_payment` | Belum dibayar |
| `processing` | Sudah dibayar, belum dikirim |
| `shipped` | Sudah dikirim |
| `completed` | Selesai |
| `cancelled` | Dibatalkan |
| `returned` | Retur/refund |
| `unknown` | Status baru yang belum dikenal |

Tabel pemetaan didefinisikan di satu file konstanta. **Status yang tidak dikenal dipetakan ke `unknown` dan memicu alert** — jangan pernah dilempar sebagai error yang menghentikan sinkronisasi, dan jangan pernah diam-diam dianggap `completed`.

### 5.2 Aturan perhitungan keuangan

Tiga aturan yang wajib ditegakkan di kode dan di UI:

1. **Pendapatan bersih hanya dihitung dari tabel `settlement`**, tidak pernah dari `sales_order`.
2. **Order dengan `is_released = false` tidak boleh masuk total payout.** UI menampilkannya terpisah sebagai "menunggu pelepasan dana".
3. **Komponen biaya yang belum dikenali masuk ke `other_fee` + `other_fee_detail`**, tidak dibuang. Kalau `other_fee` mulai membesar, itu tanda ada komponen baru yang perlu dipetakan — pasang alert bila melewati ambang tertentu terhadap bruto.

Identitas yang harus selalu berlaku (diuji otomatis):

```
gross - commission_fee - service_fee - admin_fee - seller_voucher
      - shipping_charged + shipping_subsidy - other_fee - refund_amount
      = net_payout                              (toleransi 0)
```

Jika identitas ini gagal untuk suatu order, tandai order tersebut dan alert. Ini deteksi dini paling efektif terhadap kesalahan pemetaan.

### 5.3 Jenis stok

Shopee dapat membedakan beberapa jenis stok (mis. total, tersedia, dialokasikan). Pilih **satu** jenis sebagai angka acuan, catat pilihan itu di Lampiran B, dan tampilkan labelnya di UI (mis. "Stok tersedia") agar tim Gudang tidak salah membandingkan dengan Seller Centre.

## 6. Strategi sinkronisasi

### 6.1 Daftar job

| Job | Jadwal | Cakupan |
|---|---|---|
| `token:refresh` | tiap 1 jam | Semua toko aktif |
| `order:sync-recent` | tiap 15 menit | Order dengan perubahan 3 hari terakhir |
| `order:sync-daily` | 01:00 WIB | Order 30 hari terakhir (menangkap perubahan status) |
| `settlement:sync` | 02:00 WIB | Order berstatus selesai yang `is_released = false` atau belum punya settlement |
| `product:sync` | tiap 6 jam | Semua produk |
| `stock:snapshot` | 23:50 WIB | Snapshot stok semua produk |
| `reconcile:daily` | 03:00 WIB | Bandingkan jumlah order lokal vs Shopee 7 hari terakhir |
| `mv:refresh` | setelah setiap sync order/settlement | Refresh materialized view |
| `backfill:orders` | manual | Rentang tanggal ditentukan admin, prioritas rendah |

### 6.2 Pola setiap job sinkronisasi

Wajib mengikuti pola dua tahap — **fetch dipisah dari parse**:

```
Tahap 1 — FETCH
  ambil lock per (shop, resource)     -- pg_try_advisory_lock, skip jika sedang jalan
  tentukan jendela waktu dari sync_state, mundurkan 1 jam sebagai overlap
  loop halaman:
    panggil API
    hitung hash payload
    INSERT ... ON CONFLICT DO NOTHING ke raw_payload
  perbarui sync_state.cursor_value
  daftarkan job parse

Tahap 2 — PARSE
  ambil raw_payload WHERE processed_at IS NULL
  untuk setiap payload, dalam satu transaksi:
    upsert sales_order        (ON CONFLICT (shop_id, external_order_id) DO UPDATE)
    hapus lalu insert ulang sales_order_item milik order tsb
    tandai processed_at
  gagal parse satu payload TIDAK menghentikan yang lain
    -> catat error, lanjut, alert bila jumlah gagal > ambang
```

Keuntungan pemisahan ini: kalau pemetaan Anda salah, cukup jalankan ulang tahap 2 (`UPDATE raw_payload SET processed_at = NULL WHERE ...`) tanpa memanggil API lagi. Ini akan Anda pakai lebih sering dari perkiraan.

### 6.3 Jendela waktu & overlap

Jangan pernah memakai cursor tanpa overlap. Setiap job mundur 1 jam dari `last_success_at` untuk mengantisipasi jeda propagasi dan clock skew. Karena semua operasi idempotent, mengambil data yang sama dua kali tidak berbahaya — kehilangan data sangat berbahaya.

### 6.4 Webhook (opsional)

Jika Push Mechanism dipakai: verifikasi signature, **simpan payload ke `raw_payload` lalu selesai**. Jangan memproses di dalam handler HTTP. Webhook hanya mempercepat, tidak menggantikan polling — polling tetap jalan sebagai jaring pengaman.

### 6.5 Rekonsiliasi otomatis

Job harian menghitung jumlah order per tanggal di sisi lokal, membandingkan dengan jumlah dari API untuk rentang yang sama, dan menyimpan hasilnya ke `reconciliation_check`. Selisih apa pun memicu alert dan ditampilkan di halaman status. Ini yang membuat Anda tahu ada data hilang sebelum Finance yang menemukannya.

## 7. Lapisan aplikasi

### 7.1 Kendali akses

Peran menentukan modul **dan kolom** yang dapat dilihat:

| Peran | Modul | Catatan |
|---|---|---|
| `sales` | Penjualan, produk, stok (baca) | Tanpa modul keuangan |
| `finance` | Penjualan, keuangan | |
| `warehouse` | Stok, produk, daftar order | **Kolom nilai uang dihapus di sisi server** |
| `admin` | Semua + halaman sistem | |

Penerapan kritis: penyaringan kolom untuk `warehouse` dilakukan **di query/serializer server**, bukan dengan menyembunyikan kolom di frontend. Kalau hanya disembunyikan di UI, data tetap terkirim ke browser dan bisa dilihat siapa pun yang membuka network tab.

### 7.2 Export CSV

- Export ≤ 50.000 baris: streaming langsung sebagai respons HTTP (jangan pernah menyusun seluruh isi di memori).
- Lebih besar: job background, hasil disimpan sebagai file dengan masa berlaku, pengguna diberi notifikasi.
- Encoding **UTF-8 with BOM** agar terbuka rapi di Excel Indonesia.
- Definisi kolom disimpan sebagai konfigurasi (nama kolom, field sumber, format), bukan di-hardcode — inilah yang membuat F-51/F-52 mungkin tanpa menulis ulang kode.
- Setiap export dicatat ke `activity_log`: siapa, kapan, filter apa, berapa baris.

### 7.3 Indikator kesegaran data

Setiap halaman laporan menampilkan waktu `last_success_at` dari `sync_state` yang relevan, dengan penanda visual jika lebih lama dari 2× interval jadwal. Pengguna harus selalu tahu seberapa baru angka yang dilihatnya — ini murah dibuat dan mencegah keputusan berdasarkan data basi.

## 8. Integrasi ADempiere (Fase 6)

### 8.1 Batasan arsitektural

Menulis **hanya** ke tabel staging `I_*`, dan dokumen dibuat dalam status **draft**. Tidak pernah menulis ke `C_Order`, `C_Invoice`, `M_InOut`, atau `Fact_Acct`. Proses *complete* dan posting dijalankan manual oleh Finance dari dalam ADempiere.

Lingkup v1 fase ini: **jurnal ringkas harian** (`I_GLJournal`), satu dokumen per hari. Bukan invoice per transaksi.

### 8.2 Tabel tambahan

```sql
CREATE TABLE erp_sku_map (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id     bigint NOT NULL REFERENCES shop(id),
  sku         text   NOT NULL,
  erp_product_value text NOT NULL,      -- M_Product.Value
  UNIQUE (shop_id, sku)
);

CREATE TABLE erp_batch (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id       bigint NOT NULL REFERENCES shop(id),
  reference     text NOT NULL UNIQUE,    -- 'SHP-2026-07-27'
  period_date   date NOT NULL,
  status        text NOT NULL CHECK (status IN
                  ('draft','blocked','sent','completed','failed')),
  row_count     integer,
  total_amount  numeric(18,2),
  blocked_reason jsonb,                  -- daftar SKU tak terpetakan
  sent_at       timestamptz,
  confirmed_at  timestamptz,
  UNIQUE (shop_id, period_date)
);
```

`UNIQUE (shop_id, period_date)` adalah pengaman utama terhadap pembukuan ganda — satu periode hanya bisa punya satu batch, di level database, bukan hanya di level aplikasi.

### 8.3 Alur

```
1. Pilih periode -> hitung agregat dari settlement
2. Validasi: semua SKU ada di erp_sku_map?
     tidak -> status 'blocked', tampilkan daftar SKU, BERHENTI (jangan kirim sebagian)
3. Susun baris jurnal sesuai struktur akun yang disepakati akuntan klien
4. Kirim ke I_GLJournal (SQL insert atau ADInterface) dengan reference batch
5. status -> 'sent'
6. Finance meng-complete dokumen di ADempiere
7. Admin menandai batch 'completed' di aplikasi (atau deteksi otomatis via query DB ADempiere read-only)
```

Pola jurnal (struktur akun final ditentukan akuntan klien, bukan pengembang):

| Akun | Debit | Kredit |
|---|---|---|
| Piutang Shopee (akun perantara) | payout bersih | |
| Beban komisi & biaya marketplace | total biaya | |
| Pendapatan penjualan | | bruto |

Saat payout benar-benar masuk rekening, Finance menjurnal pelunasan piutang perantara tersebut. Akun perantara yang tidak pernah nol adalah indikator ada payout yang belum tercatat — ini fitur, bukan efek samping.

## 9. Operasional & keamanan

### 9.1 Observability

- **Log terstruktur** (JSON) dengan `request_id` / `job_id` di setiap baris.
- **Alert** via email dan Telegram untuk: kegagalan refresh token, job gagal berulang, selisih rekonsiliasi, status order tak dikenal, identitas keuangan (5.2) tidak seimbang, `other_fee` melewati ambang.
- **Halaman status admin**: kondisi setiap `sync_state`, hasil rekonsiliasi terakhir, jumlah panggilan API 24 jam terakhir, kedalaman antrian job.
- Aturan penting: **kegagalan senyap dilarang.** Setiap jalur error harus berujung pada alert atau baris di halaman status.

### 9.2 Keamanan

- Token dan `partner_key` dienkripsi AES-256-GCM; kunci dari environment variable atau secret manager, **tidak** di repo. Dokumentasikan prosedur rotasi kunci.
- Password pengguna: argon2id.
- Session: cookie `HttpOnly`, `Secure`, `SameSite=Lax`.
- HTTPS wajib. Disarankan akses dibatasi ke jaringan/VPN kantor.
- Penyaringan (redaction) otomatis untuk token dan data pribadi di semua log.
- Data pembeli disimpan seminimal mungkin. Alamat pengiriman hanya jika tim Gudang benar-benar membutuhkannya (pertanyaan terbuka PRD #4); jika tidak, jangan disimpan sama sekali — data yang tidak ada tidak bisa bocor.
- Kewajiban UU PDP berlaku; klien sebagai pengendali data, pengembang sebagai pemroses. Perlu kesepakatan tertulis.

### 9.3 Deployment & backup

- Docker Compose: `app`, `worker`, `postgres`, `caddy` (TLS otomatis), opsional `metabase`.
- Migrasi database dijalankan otomatis saat startup, hanya maju (tidak ada rollback otomatis).
- Backup `pg_dump` harian, retensi 30 hari, disimpan **di luar server aplikasi**.
- **Uji restore** setidaknya sekali sebelum go-live. Backup yang belum pernah direstore belum terbukti ada.
- Environment terpisah: `sandbox` (kredensial sandbox Shopee) dan `production`. Jangan pernah menguji dengan kredensial produksi.

### 9.4 Strategi pengujian

| Jenis | Cakupan |
|---|---|
| Unit | Pembuatan signature, pemetaan status, konversi zona waktu, perhitungan `report_date`, identitas keuangan 5.2 |
| Fixture | Respons JSON asli yang disimpan pada Fase 0.5, dipakai sebagai input pengujian pemetaan |
| Integrasi | Jalankan parse dua kali pada payload sama → jumlah baris harus identik (uji idempotency, **wajib**) |
| Rekonsiliasi | Data satu bulan → total harus sama dengan laporan Shopee, selisih Rp 0 |

Uji idempotency itu tidak bisa ditawar. Jalankan di CI. Kalau lolos, sebagian besar kelas bug terburuk di sistem seperti ini sudah tertutup.

## 10. Struktur repositori

```
/src
  /shopee        client, signature, token, pemetaan  <- satu-satunya kode spesifik Shopee
  /sync          definisi job, jendela waktu, cursor
  /domain        model kanonik, aturan keuangan, aturan status
  /reports       query agregasi, definisi kolom export
  /erp           adempiere: pemetaan sku, penyusun jurnal, pengirim batch
  /web           route, auth, rbac, serializer
  /lib           db, crypto, logger, alert, queue
/migrations      001_*.sql, 002_*.sql, ...
/fixtures        respons JSON dari Fase 0.5
/docs            runbook, prosedur otorisasi ulang, Lampiran B
```

Aturan tunggal yang menjaga arsitektur ini tetap sehat: **kode di luar `/src/shopee` tidak boleh mengetahui bentuk data Shopee.** Kalau `/src/reports` mulai membaca field bernama seperti field Shopee, kanal kedua nanti akan menyakitkan.

## 11. Keputusan terbuka

| # | Keputusan | Menunggu |
|---|---|---|
| T-1 | Angka rate limit dan konkurensi worker | Fase 0.5 |
| T-2 | Jenis stok yang dipakai sebagai acuan | Fase 0.5 + konfirmasi tim Gudang |
| T-3 | Daftar lengkap komponen biaya yang dipetakan eksplisit | Fase 0.5 |
| T-4 | Frontend sendiri vs Metabase untuk v1 | Volume order & kebutuhan tampilan klien |
| T-5 | Struktur akun jurnal ADempiere | Akuntan klien |
| T-6 | Metode kirim ke ADempiere: SQL ke `I_*` vs ADInterface | Versi ADempiere & konfigurasi klien |
| T-7 | Kedalaman backfill historis | PRD pertanyaan terbuka #2 |
| T-8 | Penyimpanan alamat pengiriman | PRD pertanyaan terbuka #4 |
| T-9 | Pemegang stok resmi per SKU (prasyarat fitur tulis) | Keputusan klien, lihat 12.7 |
| T-10 | Operasi tulis mana yang benar-benar dibutuhkan, dan mana yang lebih baik tetap manual | Umpan balik pemakaian v1 |
| T-11 | Besaran buffer stok per kanal | Analisis pola oversell setelah v1 berjalan |

## 12. Kesiapan fitur tulis (v2 — tidak dibangun di v1)

Bagian ini menetapkan apa yang **harus** disiapkan sekarang dan apa yang **sengaja tidak** dibangun sekarang. Tujuannya: ketika fitur tulis dibutuhkan, tidak ada bagian arsitektur yang harus dirombak.

### 12.1 Mengapa menulis bukan sekadar "kebalikan dari membaca"

Satu perbedaan mengubah segalanya: **operasi baca aman diulang, operasi tulis tidak.**

Seluruh strategi keandalan di v1 bersandar pada "kalau gagal, ulangi saja" — dan itu aman karena membaca dua kali tidak berakibat apa pun. Pada operasi tulis, kegagalan jaringan menjadi ambigu: request timeout **tidak berarti** perubahan tidak diterapkan. Bisa jadi Shopee sudah memprosesnya dan hanya responsnya yang hilang. Retry otomatis dalam situasi ini akan menerapkan perubahan dua kali.

Aturan absolut untuk semua kode tulis: **jangan pernah retry buta.** Ketika sebuah tulis gagal atau timeout, langkahnya adalah **baca ulang keadaan di Shopee**, bandingkan dengan yang diinginkan, baru putuskan perlu diulang atau tidak.

### 12.2 Peringkat risiko operasi tulis

| Operasi | Risiko | Catatan |
|---|---|---|
| Update stok | **Tinggi** | Salah angka → oversell (order tidak bisa dipenuhi) atau kehilangan penjualan |
| Update harga | **Sangat tinggi** | Kesalahan langsung merugikan uang, dan pembeli bisa langsung memanfaatkannya |
| Proses order / atur pengiriman | Sedang | Kesalahan biasanya masih bisa dikoreksi manual |
| Batalkan order | Tinggi | Sulit dibatalkan kembali, berdampak ke reputasi toko |
| Balas chat | Rendah–sedang | Salah kirim tidak fatal tapi memalukan |

Urutan implementasi yang disarankan bila fase ini dijalankan: **proses order lebih dulu, stok kedua, harga paling akhir** (atau tidak pernah — sering kali lebih baik tetap manual).

### 12.3 Utamakan nilai absolut, bukan delta

Ini keputusan desain paling penting untuk fitur tulis. Ada dua cara mengubah stok:

- **Delta**: "kurangi 3". Tidak idempotent — dijalankan dua kali menghasilkan −6. Berbahaya.
- **Absolut**: "set stok menjadi 47". Idempotent secara alami — dijalankan dua kali hasilnya tetap 47.

**Selalu pakai bentuk absolut.** Ini membuat sifat idempotent didapat gratis dari bentuk perintahnya, bukan dari mekanisme tambahan. Kalau suatu endpoint hanya menerima delta, bungkus dengan pola baca–hitung–tulis di bawah lock, dan verifikasi hasilnya dengan baca ulang.

### 12.4 Pola outbox + verifikasi

Setiap niat perubahan dicatat sebagai baris perintah di database sebelum dikirim, lalu diverifikasi setelah dikirim:

```
1. INTENT   — simpan perintah (status 'pending'), termasuk nilai target absolut
              dan snapshot nilai saat ini sebagai pembanding
2. APPROVE  — (untuk operasi berisiko) menunggu persetujuan manusia
3. DISPATCH — ambil advisory lock per objek (mis. per SKU)
              status -> 'in_flight', catat waktu kirim
              panggil API
4. VERIFY   — SELALU baca ulang objek dari Shopee setelah tulis
              cocok dengan target?  -> 'confirmed'
              tidak cocok           -> 'failed', alert, JANGAN retry otomatis
5. TIMEOUT  — perintah 'in_flight' lebih lama dari batas waktu
              -> job verifikasi membaca keadaan nyata, bukan mengirim ulang
```

Yang menjadikan ini aman bukan pencatatannya, melainkan **langkah 4**. Tanpa verifikasi baca-ulang, Anda tidak pernah benar-benar tahu apa yang terjadi di Shopee.

### 12.5 Struktur tabel (dipasang saat v2)

```sql
CREATE TABLE write_command (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id      bigint NOT NULL REFERENCES shop(id),
  command_type text NOT NULL,            -- 'set_stock' | 'ship_order' | ...
  target_ref   text NOT NULL,            -- sku / external_order_id
  payload      jsonb NOT NULL,           -- nilai target (absolut)
  before_value jsonb,                    -- keadaan sebelum, untuk audit & rollback manual
  status       text NOT NULL CHECK (status IN
                 ('pending','awaiting_approval','in_flight',
                  'confirmed','failed','cancelled')),
  requested_by bigint REFERENCES app_user(id),
  approved_by  bigint REFERENCES app_user(id),
  attempt_count integer NOT NULL DEFAULT 0,
  dispatched_at timestamptz,
  verified_at   timestamptz,
  error_detail  jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Hanya satu perintah aktif per objek: pengaman anti-tabrakan di level database
CREATE UNIQUE INDEX ON write_command (shop_id, command_type, target_ref)
  WHERE status IN ('pending','awaiting_approval','in_flight');
```

Index partial itu penting: dua perintah `set_stock` untuk SKU yang sama tidak mungkin berjalan bersamaan, dijamin oleh database.

### 12.6 Pengaman operasional wajib

Semuanya harus ada **sebelum** operasi tulis pertama diaktifkan di produksi:

- **Kill switch global.** Satu flag yang menghentikan semua operasi tulis, tanpa perlu deploy. Kalau Anda tidak bisa menghentikannya dalam 10 detik, jangan aktifkan.
- **Mode dry-run.** Perintah tercatat dan divalidasi tapi tidak dikirim. Wajib dipakai minimal satu minggu sebelum aktivasi nyata; bandingkan apa yang *akan* dikirim dengan apa yang seharusnya.
- **Rate limit terpisah untuk tulis.** Kuota tulis tidak boleh menguras kuota baca — sinkronisasi data harus tetap jalan bahkan saat antrian tulis padat.
- **Batas jumlah per periode.** Mis. maksimum 200 perubahan stok per jam. Melewati batas → berhenti dan alert. Ini yang membatasi kerusakan ketika ada bug loop.
- **Pemeriksaan kewajaran (sanity check) sebelum kirim.** Tolak jika perubahan tidak masuk akal: stok berubah > 90%, harga berubah > 50%, atau nilai target nol/negatif. Tolak dulu, tanya manusia.
- **Peran baru `operator`.** Wewenang tulis tidak menempel pada peran pembaca. Untuk harga, terapkan kontrol ganda: pemohon dan penyetuju harus orang berbeda.
- **Audit penuh.** Setiap perintah tercatat dengan nilai sebelum dan sesudah, siapa yang meminta, siapa yang menyetujui. Ini juga yang memungkinkan pemulihan manual.

### 12.7 Soal "sumber kebenaran" — pertanyaan yang harus dijawab dulu

Begitu sistem ini menulis stok, timbul pertanyaan yang belum ada di v1: **siapa pemegang stok yang benar?**

Selama ini jawabannya Shopee. Kalau sistem Anda mulai mendorong stok, jawabannya harus berubah menjadi ADempiere (atau sistem Anda), dan **Shopee menjadi tujuan, bukan sumber**. Ini bukan pilihan yang bisa setengah-setengah: kalau kedua sisi dianggap benar, keduanya akan saling menimpa dan stok akan berayun tak terkendali.

Konsekuensinya, sebelum fitur tulis stok dibangun:

1. Tentukan satu sistem sebagai pemegang stok resmi, per SKU (tabel `stock_owner`, bukan pengaturan global — sebagian SKU mungkin tetap dikelola manual di Shopee).
2. Tentukan **buffer stok** per kanal: jangan pernah mendorong angka penuh. Sisakan penyangga agar selisih waktu sinkronisasi tidak langsung menyebabkan oversell.
3. Tetap jalankan snapshot dan rekonsiliasi. Setelah menulis, selisih antara nilai yang diinginkan dan nilai nyata di Shopee adalah metrik yang harus dipantau terus-menerus.

Kalau pertanyaan nomor 1 belum bisa dijawab tegas oleh klien, fitur tulis stok belum layak dibangun — apa pun kesiapan teknisnya.

### 12.8 Yang disiapkan sekarang vs nanti

**Dikerjakan di v1 (biaya tambahan hampir nol):**

- [x] Lapisan `/src/shopee` terisolasi, agar penambahan modul tulis tidak menyentuh kode laporan
- [x] `ShopeeClient` sebagai satu-satunya jalur panggilan API, dengan hook rate limit dan logging yang sudah terpasang
- [x] `activity_log` sudah ada sejak awal — audit tulis nanti tinggal menambah jenis aksi
- [x] Kolom `channel` di semua tabel data
- [x] Snapshot stok harian — nanti menjadi dasar deteksi penyimpangan setelah tulis
- [x] **Jangan pernah menganggap data lokal sebagai otoritatif** di kode mana pun. Kalau kebiasaan ini terbentuk di v1, fitur tulis akan mewarisi asumsi yang salah.

**Sengaja TIDAK dikerjakan di v1:**

- Tabel `write_command`, mekanisme outbox, dan alur persetujuan
- Peran `operator` dan kontrol ganda
- Kill switch dan mode dry-run
- Pengajuan scope tulis ke Shopee

Alasannya: kerangka tulis yang dibangun sebelum kebutuhan nyatanya diketahui hampir selalu salah bentuk — dan kerangka yang salah lebih berbahaya daripada tidak ada kerangka, karena orang cenderung mempercayainya. Yang perlu dijaga sekarang hanyalah agar tidak ada keputusan di v1 yang **menghalangi** penambahan itu nanti.

### 12.9 Prasyarat sebelum fase tulis dimulai

1. Scope tulis disetujui Shopee (pengajuan terpisah dari scope baca).
2. Spike khusus tulis di sandbox: uji perilaku saat timeout, apakah endpoint mendukung kunci idempotency, dan bagaimana bentuk error konflik.
3. Klien menetapkan pemegang stok resmi per SKU (12.7).
4. Sinkronisasi baca sudah berjalan stabil minimal 3 bulan tanpa selisih rekonsiliasi.
5. Semua pengaman di 12.6 sudah terpasang dan diuji.

Prasyarat nomor 4 bukan formalitas. Fitur tulis yang dibangun di atas data baca yang belum terbukti akurat akan mendorong angka yang salah ke toko yang sesungguhnya.



Tabel ini sengaja dibiarkan kosong. Isi saat spike, dan jadikan ini rujukan tunggal untuk detail API — jangan biarkan detailnya hanya ada di ingatan atau tersebar di komentar kode.

| Kebutuhan | Endpoint | Field yang dipakai | Batas/catatan | Terverifikasi |
|---|---|---|---|---|
| Otorisasi toko | | | | ☐ |
| Refresh token | | | umur token: | ☐ |
| Daftar order | | | maks rentang & page size: | ☐ |
| Detail order | | | | ☐ |
| Rincian escrow | | | komponen biaya tersedia: | ☐ |
| Daftar produk | | | | ☐ |
| Detail produk/varian | | | jenis stok: | ☐ |
| Rate limit | — | — | angka: | ☐ |
| Webhook | | event tersedia: | | ☐ |
