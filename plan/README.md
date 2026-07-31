# Ecommerce Data Hub — Frontend (v0.1)

Frontend awal untuk Data Hub Shopee. Sudah berupa aplikasi React sungguhan
dengan lapisan data terpisah, siap disambungkan ke backend tanpa mengubah
komponen.

## Menjalankan

```bash
npm install
npm run dev        # http://localhost:5173, memakai data contoh
```

Build produksi:

```bash
npm run build && npm run preview
```

## Menyambungkan ke backend

```bash
cp .env.example .env
# ubah isinya:
VITE_API_MODE=http
VITE_API_BASE=/api
```

Lalu jalankan dengan alamat backend:

```bash
API_TARGET=http://localhost:3000 npm run dev
```

Tidak ada komponen yang perlu diubah. Semua pemanggilan data melewati
`src/lib/api.js`; mengganti mode hanya mengubah sumber datanya.

## Endpoint yang diharapkan

Semua di bawah `VITE_API_BASE`, semuanya GET, autentikasi lewat cookie sesi.

| Endpoint | Dipakai oleh |
|---|---|
| `/me` | identitas + peran + toko aktif |
| `/sync/state` | indikator kesegaran data di header |
| `/sync/jobs` | halaman status sinkronisasi |
| `/sync/reconciliation` | tabel rekonsiliasi harian |
| `/finance/summary` | dua panel ringkasan keuangan |
| `/finance/released` | tabel order yang dananya sudah dilepas |
| `/finance/pending` | tabel order menunggu pelepasan |
| `/finance/fees` | rincian komponen biaya |
| `/sales/summary`, `/sales/trend`, `/sales/top-products` | halaman ringkasan |
| `/products`, `/products/summary` | halaman stok |
| `/warehouse/picklist` | daftar kirim |

Bentuk respons persis seperti fungsi di `src/mocks/index.js` — pakai berkas itu
sebagai kontrak. Nama field mengikuti skema kanonik Tech Spec 4.2
(`gross`, `commission_fee`, `net_payout`, `is_released`, …), bukan nama field
mentah Shopee.

### Kontrak penting untuk backend

**1. Kirim `null`, jangan `0`, untuk nilai yang belum ada.**
Order yang dananya belum dilepas harus mengirim `net_payout: null`. Frontend
merendernya sebagai `—`. Mengirim `0` akan membuat angka itu ikut terjumlah
di laporan dan tidak akan pernah cocok dengan mutasi bank.

**2. Tabel mengirim `columns` bersama `rows`.**

```json
{ "columns": [{ "id": "net_payout", "label": "Payout bersih", "align": "right" }],
  "rows": [{ "external_order_id": "...", "net_payout": 350625 }] }
```

Untuk peran gudang, kolom uang **tidak disertakan** di `columns` *dan* field-nya
**tidak dikirim** di `rows`. Penyaringan terjadi di server; frontend hanya
merender apa yang diterima. Menyembunyikan kolom di frontend bukan kendali akses.

**3. Ringkasan keuangan dipisah dua.**
`released` dan `pending` adalah objek terpisah dan tidak pernah dijumlahkan —
tidak di backend, tidak di frontend.

**4. Waktu dikirim sebagai ISO 8601 UTC.**
Konversi ke WIB dilakukan di `src/lib/format.js`. Pengelompokan tanggal untuk
laporan tetap tugas backend (kolom `report_date`, Tech Spec 4.3).

## Struktur

```
src/
  lib/format.js      satu-satunya tempat angka jadi teks (aturan "—" ada di sini)
  lib/api.js         satu-satunya tempat memanggil jaringan
  lib/useApi.js      hook data: loading | ready | error
  mocks/index.js     data contoh = kontrak respons backend
  components/        primitives, DataTable, Shell, states
  pages/             Ringkasan, Keuangan, Stok, Gudang, Sinkron
  styles/tokens/     token sistem desain (dari Claude Design — jangan diedit)
  styles/app.css     gaya aplikasi, semuanya memakai token
```

## Aturan yang ditegakkan oleh struktur kode

Ini bukan konvensi yang perlu diingat, tapi hal yang sulit dilanggar tanpa sengaja:

- Nilai uang hanya boleh dirender lewat komponen `<Money>`. Komponen itu
  mengubah `null` menjadi `—`; tidak ada jalur yang menghasilkan `Rp 0` untuk
  nilai yang belum ada. **Jangan** menulis `{row.net_payout}` langsung di JSX.
- Kolom tabel berasal dari server, bukan daftar tetap di frontend.
- Setiap badge status punya ikon dan teks, tidak pernah warna saja.
- Menu di luar wewenang tidak dirender, bukan dimatikan.

## Sistem desain

Token di `src/styles/tokens/` berasal dari proyek Claude Design (sistem
"Ulinary"). Kalau desainnya diperbarui, timpa folder itu — jangan mengedit
isinya, dan jangan menaruh penyesuaian aplikasi di dalamnya.

Tema default `theme-graphite` (diatur di `index.html`). Ulinary aslinya sistem
desain F&B dengan primary oranye "sunset", yang bertabrakan dengan semantik
peringatan di tabel angka. Preset lain yang tersedia: `theme-cobalt`,
`theme-indigo`, `theme-emerald`, `theme-sunset`.

## Belum dibangun

Layar login, panel export CSV, riwayat stok per SKU, detail order, dan halaman
batch ERP. Semuanya ada di dokumen Userflow & Wireframe dan masuk fase berikutnya.

`DevBar` (pengalih peran di bagian atas) hanya untuk mode contoh — hapus
sebelum produksi.
