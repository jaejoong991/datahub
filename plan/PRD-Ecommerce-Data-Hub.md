# PRD — Ecommerce Data Hub (nama sementara)

| | |
|---|---|
| **Versi** | 0.3 (draf) |
| **Tanggal** | 27 Juli 2026 |
| **Perubahan v0.2** | Fase 0.5 (spike API), urutan fase disesuaikan, penilaian risiko akses data keuangan direvisi, Lampiran A |
| **Perubahan v0.3** | Nama produk dibuat netral kanal, penambahan bagian 7.6 integrasi ADempiere sebagai Fase 6 |
| **Status** | Draf untuk direview klien |
| **Pemilik produk** | (isi) |
| **Klien / pengguna** | (isi nama perusahaan) |

---

## 1. Ringkasan

Aplikasi internal berbasis web yang menarik data dari Shopee Open Platform secara otomatis dan menyajikannya dalam satu tampilan yang dapat dilihat dan diekspor oleh tim Sales, Finance, dan Gudang — tanpa perlu membuka Shopee Seller Centre.

Aplikasi ini bersifat **read-only**: Shopee tetap menjadi sumber kebenaran (*source of truth*). Aplikasi tidak mengubah data apa pun di Shopee.

**Catatan penamaan:** nama produk dibuat generik ("Ecommerce Data Hub") karena arsitekturnya disiapkan untuk menampung kanal lain di masa depan. Namun **v1 hanya mendukung Shopee** — penambahan kanal lain tidak termasuk dalam lingkup ini (lihat bagian 4).

## 2. Masalah yang diselesaikan

Saat ini setiap tim harus masuk ke Shopee Seller Centre untuk mendapatkan data yang mereka butuhkan. Ini menimbulkan beberapa masalah:

- **Akses tidak terkontrol.** Semua orang memakai akun yang sama, atau punya akses ke menu yang bukan wewenangnya (mis. tim gudang bisa melihat data keuangan).
- **Data sulit diolah.** Format laporan bawaan Shopee tidak sesuai kebutuhan internal, sehingga tim melakukan salin-tempel manual ke Excel.
- **Tidak ada riwayat.** Data seperti stok hanya terlihat sebagai kondisi saat ini, tidak ada catatan perubahan dari waktu ke waktu.
- **Pekerjaan berulang.** Menarik laporan yang sama setiap hari/minggu memakan waktu dan rawan salah.

## 3. Tujuan

**Tujuan produk**

1. Satu tempat untuk melihat data penjualan, keuangan, dan stok dari Shopee.
2. Setiap tim hanya melihat data yang relevan dengan pekerjaannya.
3. Semua data dapat diekspor ke CSV dengan format yang bisa disesuaikan.
4. Menyimpan riwayat data sehingga tren dapat dianalisis.

**Kriteria keberhasilan**

| Metrik | Target |
|---|---|
| Selisih total nilai penjualan aplikasi vs laporan Shopee | Rp 0 pada rekonsiliasi bulanan |
| Keterlambatan data (data freshness) | ≤ 15 menit untuk order baru |
| Frekuensi tim membuka Shopee Seller Centre untuk data rutin | Turun ke ~0 dalam 1 bulan setelah rilis |
| Uptime sinkronisasi | ≥ 99% hari berjalan tanpa gap data |

## 4. Bukan tujuan (out of scope v1)

Penting disepakati sejak awal agar tidak melebar:

- ❌ Menulis/mengubah data di Shopee (update stok, ubah harga, proses order, cetak label pengiriman). Kemungkinan fitur tulis di masa depan sudah diantisipasi dalam desain teknis (Tech Spec bagian 12), namun **tidak dibangun di v1** dan punya prasyarat tersendiri.
- ❌ Integrasi marketplace lain (Tokopedia, TikTok Shop, Lazada) — arsitektur disiapkan, implementasi menyusul.
- ❌ Aplikasi multi-tenant / SaaS untuk banyak perusahaan.
- ❌ Balas chat pembeli, kelola iklan, atau kelola promosi.
- ❌ Integrasi otomatis dua arah ke sistem akuntansi/ERP. Pada v1 pertukaran data cukup lewat export CSV manual. Integrasi ADempiere terjadwal sebagai Fase 6 dengan lingkup terbatas (lihat 7.6).
- ❌ Aplikasi mobile native (web responsif sudah cukup).

## 5. Pengguna

| Peran | Kebutuhan utama | Data yang boleh dilihat |
|---|---|---|
| **Sales** | Performa penjualan, produk terlaris, tren harian/bulanan | Penjualan, produk, stok (baca) |
| **Finance** | Uang yang benar-benar masuk, rincian biaya & potongan, rekonsiliasi payout | Penjualan, settlement/keuangan |
| **Gudang** | Stok saat ini, barang yang perlu restock, order yang harus dikirim | Stok, produk, daftar order (tanpa nilai uang) |
| **Admin** | Kelola akun pengguna, pantau status sinkronisasi | Semua + halaman sistem |

Perkiraan jumlah pengguna: < 20 orang. Tidak ada akses dari luar organisasi.

## 6. User story

**Sales**
- Sebagai Sales, saya ingin melihat total penjualan hari ini, minggu ini, dan bulan ini agar bisa memantau target.
- Sebagai Sales, saya ingin melihat 20 produk terlaris pada rentang tanggal tertentu.
- Sebagai Sales, saya ingin mengekspor data penjualan per produk ke CSV untuk dipakai di rapat mingguan.

**Finance**
- Sebagai Finance, saya ingin melihat rincian per order: harga jual, komisi, biaya layanan, biaya admin, voucher penjual, ongkir, dan **payout bersih**.
- Sebagai Finance, saya ingin melihat daftar order yang sudah dilepas dananya (*released*) pada periode tertentu beserta total payout, agar bisa dicocokkan dengan mutasi bank.
- Sebagai Finance, saya ingin melihat order yang mengalami refund/retur beserta dampaknya ke pendapatan.
- Sebagai Finance, saya ingin mengekspor data tersebut ke CSV dengan format kolom yang dapat disesuaikan.

**Gudang**
- Sebagai tim Gudang, saya ingin melihat stok semua SKU dalam satu tabel yang bisa dicari dan diurutkan.
- Sebagai tim Gudang, saya ingin melihat SKU dengan stok di bawah batas tertentu agar bisa mengajukan restock.
- Sebagai tim Gudang, saya ingin melihat riwayat perubahan stok sebuah SKU.
- Sebagai tim Gudang, saya ingin melihat daftar order yang perlu dikirim beserta isi barangnya.

**Semua pengguna**
- Sebagai pengguna, saya ingin tahu kapan data terakhir disinkronkan, agar saya tahu apakah angka yang saya lihat sudah terbaru.

## 7. Kebutuhan fungsional

### 7.1 Koneksi & sinkronisasi

| ID | Kebutuhan | Prioritas |
|---|---|---|
| F-01 | Otorisasi toko Shopee satu kali oleh admin; token disimpan terenkripsi di database | Wajib |
| F-02 | Refresh token otomatis terjadwal, dengan pengamanan agar tidak ada refresh ganda | Wajib |
| F-03 | Notifikasi ke admin (email/Telegram) jika refresh token atau sinkronisasi gagal | Wajib |
| F-04 | Sinkronisasi order berkala (default tiap 15 menit) untuk order 7 hari terakhir | Wajib |
| F-05 | Sinkronisasi ulang harian untuk order 30 hari terakhir (menangkap perubahan status & settlement) | Wajib |
| F-06 | Halaman status sinkronisasi: waktu terakhir sukses, jumlah record, error terakhir | Wajib |
| F-07 | Tombol "sinkron sekarang" manual per modul | Sebaiknya |
| F-08 | Tarik data historis (backfill) untuk periode awal, dapat dijalankan admin | Wajib |
| F-09 | Menerima webhook Shopee untuk perubahan status order (mempercepat pembaruan) | Sebaiknya |
| F-10 | Mendukung lebih dari satu toko dalam satu akun Shopee | Sebaiknya |

### 7.2 Modul penjualan (Sales)

| ID | Kebutuhan | Prioritas |
|---|---|---|
| F-20 | Dashboard ringkasan: nilai penjualan, jumlah order, rata-rata nilai order, dengan filter rentang tanggal | Wajib |
| F-21 | Grafik tren penjualan harian | Wajib |
| F-22 | Tabel order: nomor order, tanggal, status, jumlah item, nilai — dengan pencarian & filter status | Wajib |
| F-23 | Detail order: daftar item, SKU, qty, harga satuan, diskon | Wajib |
| F-24 | Laporan penjualan per produk/SKU: qty terjual, nilai, dengan pengurutan | Wajib |
| F-25 | Perbandingan periode (mis. bulan ini vs bulan lalu) | Nice to have |

### 7.3 Modul keuangan (Finance)

| ID | Kebutuhan | Prioritas |
|---|---|---|
| F-30 | Tabel rincian keuangan per order: bruto, komisi, biaya layanan, biaya admin, voucher penjual, voucher platform, ongkir dibebankan, **payout bersih** | Wajib |
| F-31 | Ringkasan periode: total bruto, total seluruh biaya, total payout bersih | Wajib |
| F-32 | Filter berdasarkan tanggal pelepasan dana (payout date), bukan hanya tanggal order | Wajib |
| F-33 | Daftar order dengan refund/retur dan dampaknya terhadap pendapatan | Wajib |
| F-34 | Penanda order yang datanya belum lengkap (dana belum dilepas) agar tidak salah dihitung | Wajib |
| F-35 | Halaman rekonsiliasi: total payout per periode untuk dicocokkan dengan mutasi bank | Sebaiknya |

> **Catatan penting:** pendapatan bersih **tidak boleh** dihitung dari tabel order. Data biaya datang belakangan setelah dana dilepas Shopee dan masih bisa berubah, sehingga disimpan terpisah.

### 7.4 Modul stok & produk (Gudang)

| ID | Kebutuhan | Prioritas |
|---|---|---|
| F-40 | Tabel produk & varian: nama, SKU, harga, stok saat ini, status listing | Wajib |
| F-41 | Pencarian dan filter (berdasarkan nama, SKU, status) | Wajib |
| F-42 | Peringatan stok rendah dengan batas ambang yang dapat diatur per SKU atau global | Wajib |
| F-43 | Snapshot stok harian + riwayat perubahan stok per SKU | Wajib |
| F-44 | Daftar order yang perlu diproses/dikirim beserta isi barang, tanpa menampilkan nilai uang | Wajib |
| F-45 | Grafik pergerakan stok sebuah SKU | Nice to have |

### 7.5 Export CSV

| ID | Kebutuhan | Prioritas |
|---|---|---|
| F-50 | Setiap tabel dapat diekspor ke CSV sesuai filter yang sedang aktif | Wajib |
| F-51 | Pengguna dapat memilih kolom mana yang disertakan dan urutannya | Wajib |
| F-52 | Template export dapat disimpan dan dipakai ulang (mis. "Format Finance Bulanan") | Sebaiknya |
| F-53 | Format angka dan tanggal mengikuti kebutuhan lokal (pemisah, format tanggal, encoding UTF-8 with BOM agar rapi di Excel) | Wajib |
| F-54 | Export data besar diproses di background lalu diunduh setelah siap | Sebaiknya |
| F-55 | Export terjadwal dikirim otomatis via email | Nice to have |

> Format kolom akhir akan ditentukan bersama tiap tim setelah v1 berjalan. Karena itu pemilihan kolom dibuat fleksibel sejak awal, bukan di-hardcode.

### 7.6 Integrasi ADempiere (Fase 6, di luar v1)

Lingkup sengaja dibatasi pada **jurnal ringkas harian**, bukan invoice per transaksi.

| ID | Kebutuhan | Prioritas |
|---|---|---|
| F-70 | Tabel pemetaan SKU Shopee → `M_Product.Value` ADempiere, dapat dikelola dari UI | Wajib |
| F-71 | Pembuatan batch harian: satu berkas/jurnal per hari dengan nomor referensi unik (mis. `SHP-2026-07-27`) | Wajib |
| F-72 | Batch **ditolak seluruhnya** jika ada SKU yang belum terpetakan; daftar SKU bermasalah ditampilkan | Wajib |
| F-73 | Dokumen dikirim ke ADempiere dalam status **draft**; proses *complete* dilakukan manual oleh Finance | Wajib |
| F-74 | Tabel jembatan mencatat status setiap batch (belum dikirim / dikirim / sudah di-complete / gagal) | Wajib |
| F-75 | Halaman status pengiriman ERP per periode, untuk mencegah pengiriman ganda | Wajib |
| F-76 | Nomor referensi batch tersimpan di field ADempiere yang dapat dicari | Wajib |
| F-77 | Rekonsiliasi stok: perbandingan stok Shopee vs stok ADempiere beserta selisihnya (read-only) | Sebaiknya |
| F-78 | Pengiriman via web service (ADInterface) sebagai pengganti file, jika tersedia | Nice to have |

**Bukan lingkup Fase 6:** pembuatan sales order/invoice per transaksi, penulisan langsung ke tabel dokumen ADempiere, *complete* atau posting otomatis, dan penulisan balik dari ADempiere ke Shopee.



### 7.7 Pengguna & akses

| ID | Kebutuhan | Prioritas |
|---|---|---|
| F-60 | Login dengan email + password | Wajib |
| F-61 | Peran: Sales, Finance, Gudang, Admin — menentukan modul yang bisa diakses | Wajib |
| F-62 | Admin dapat membuat, menonaktifkan, dan mengubah peran pengguna | Wajib |
| F-63 | Log aktivitas: siapa mengakses dan mengekspor apa, kapan | Sebaiknya |

## 8. Kebutuhan non-fungsional

**Keandalan data**
- Sinkronisasi harus *idempotent*: dijalankan berulang tidak menghasilkan data ganda.
- Semua respons mentah dari Shopee disimpan agar data dapat diproses ulang jika logika pemetaan diperbaiki, tanpa menarik ulang dari API.
- Job rekonsiliasi harian membandingkan jumlah order di aplikasi dengan jumlah di Shopee, dan melaporkan selisih.

**Performa**
- Halaman tabel dan dashboard terbuka < 3 detik untuk data 1 tahun.
- Tabel menggunakan paginasi server-side.

**Batasan platform**
- Pemakaian API harus menghormati batas laju (*rate limit*) Shopee; semua panggilan lewat antrian dengan mekanisme *retry* dan *backoff*.

**Keamanan & kepatuhan**
- Kredensial dan token disimpan terenkripsi; tidak pernah muncul di log.
- Akses aplikasi lewat HTTPS. Disarankan dibatasi ke jaringan/VPN kantor.
- Data pembeli dibatasi seminimal mungkin — hanya yang benar-benar diperlukan gudang untuk pengiriman. Kewajiban UU PDP berlaku karena aplikasi menyimpan data pribadi pembeli.
- Backup database harian.

**Operasional**
- Halaman kesehatan sistem untuk admin.
- Notifikasi otomatis saat sinkronisasi gagal berturut-turut.

## 9. Asumsi

1. Aplikasi didaftarkan di Shopee Open Platform **atas nama badan usaha klien**, dengan tipe self-use, dan pengembang diberi akses teknis.
2. Scope API yang dibutuhkan (order, escrow/keuangan, produk) disetujui Shopee. Karena aplikasi bertipe self-use dan otorisasi diberikan langsung oleh pemilik toko, peluang mendapat akses data keuangan dinilai tinggi — namun **harus dibuktikan lewat Fase 0.5 sebelum modul Finance dijanjikan**.
3. Ketersediaan setiap field yang dibutuhkan (khususnya rincian komponen biaya secara terpisah, bukan digabung) diverifikasi pada Fase 0.5.
4. Klien menyediakan akses ke laporan resmi Shopee Seller Centre sebagai pembanding untuk verifikasi angka.
5. Jumlah toko awal: 1. Volume order: (isi perkiraan per hari) — memengaruhi kebutuhan infrastruktur.
6. Aplikasi berjalan di satu server (VPS) yang disediakan/disetujui klien.

## 10. Risiko

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Persetujuan partner Shopee lama atau ditolak | Proyek tertunda/berhenti | Ajukan pendaftaran **sebelum** pengembangan dimulai; kembangkan di sandbox |
| Scope API keuangan tidak diberikan | Modul Finance gagal | Buktikan di Fase 0.5; jangan janjikan modul Finance ke klien sebelum terbukti |
| Field yang dibutuhkan tidak tersedia atau digabung jadi satu angka | Laporan tidak sesuai kebutuhan; kode harus dirombak | Verifikasi field satu per satu di Fase 0.5, simpan contoh respons sebagai bukti |
| Otorisasi kedaluwarsa (server mati > masa berlaku refresh token) | Data berhenti mengalir | Refresh terjadwal + notifikasi kegagalan + prosedur otorisasi ulang yang terdokumentasi |
| Angka tidak cocok dengan laporan Shopee | Kepercayaan pengguna hilang | Rekonsiliasi wajib di fase 3 sebelum rilis ke Finance |
| Perubahan versi API Shopee | Sinkronisasi rusak | Connector terisolasi dalam satu modul; pantau pengumuman developer |
| Permintaan fitur melebar (push stok, marketplace lain) | Waktu meleset | Daftar "bukan tujuan" di dokumen ini disepakati bersama |

## 11. Rencana rilis

| Fase | Isi | Keluaran |
|---|---|---|
| **Fase 0** | Pendaftaran partner Shopee, setup sandbox | Kredensial partner aktif |
| **Fase 0.5** | **Spike API (2–3 hari).** Panggil manual semua endpoint yang dibutuhkan, verifikasi ketersediaan field, ukur jumlah panggilan per hari data. Lihat Lampiran A | **Keputusan lanjut/tidak** per modul, disertai contoh respons tersimpan |
| **Fase 1** | Autentikasi produksi, penyimpanan token, refresh terjadwal, notifikasi kegagalan | Koneksi stabil, terbukti bertahan > 1 minggu tanpa intervensi |
| **Fase 2** | Sinkronisasi order + modul penjualan + export CSV dasar | Rilis internal ke tim Sales |
| **Fase 3** | Modul produk & stok + snapshot harian + peringatan stok rendah | Rilis ke Gudang |
| **Fase 4** | Modul keuangan + rekonsiliasi terhadap laporan Shopee | Rilis ke Finance **setelah** selisih nol |
| **Fase 5** | Penyempurnaan export (template, kolom kustom), log aktivitas | Rilis lengkap v1 |
| **Fase 6** | Integrasi ADempiere: pemetaan SKU, jurnal ringkas harian status draft, halaman status batch | Finance dapat meng-complete jurnal harian dari ADempiere tanpa entri manual |
| **Berikutnya** | Ditentukan dari umpan balik pengguna | — |

**Alasan urutan ini:** order dikerjakan lebih dulu karena rincian biaya escrow ditarik per nomor order — tanpa data order, modul keuangan tidak mungkin dibangun. Modul stok ditaruh sebelum keuangan karena paling sederhana (tidak ada perubahan data belakangan) sehingga memberi hasil nyata ke klien dengan cepat, sementara modul keuangan yang paling rumit dikerjakan terakhir dengan waktu verifikasi yang cukup.

## 12. Pertanyaan terbuka

1. Berapa volume order per hari dan berapa banyak SKU aktif?
2. Seberapa jauh ke belakang data historis perlu ditarik (3 bulan? 1 tahun? sejak awal)?
3. ~~Sistem akuntansi apa yang dipakai?~~ **Terjawab: ADempiere.** Detail lanjutan di pertanyaan 9–12.
4. Apakah tim Gudang perlu melihat data pembeli/alamat pengiriman, atau cukup daftar SKU dan qty?
5. Apakah ada lebih dari satu toko Shopee?
6. Aplikasi di-hosting di server klien atau server pengembang?
7. Siapa yang bertanggung jawab memantau notifikasi kegagalan sinkronisasi?
8. Apakah ada kebutuhan target/KPI penjualan yang perlu ditampilkan (berarti perlu input manual)?
9. ADempiere versi berapa yang dipakai, dan apakah Accounting Processor aktif?
10. Struktur akun mana yang dipakai untuk penjualan marketplace? Khususnya: akun perantara untuk dana yang belum masuk rekening. Perlu ditentukan oleh akuntan klien.
11. Apakah ADempiere versi tersebut mendukung complete massal dokumen? Ini menentukan apakah jurnal ringkas atau invoice per transaksi yang realistis.
12. Apakah web service (ADInterface) sudah aktif di instance klien?

---

## Lampiran A — Daftar periksa Fase 0.5 (spike API)

Dikerjakan manual (curl / Postman / Bruno) di lingkungan sandbox, **sebelum menulis kode aplikasi**. Simpan setiap respons JSON ke file — nantinya dipakai sebagai fixture untuk testing.

### A.1 Autentikasi
- [ ] Signature HMAC berhasil dibuat dan diterima (satu panggilan apa pun berhasil)
- [ ] Alur otorisasi toko berhasil sampai mendapat access token & refresh token
- [ ] Refresh token berhasil ditukar menjadi token baru
- [ ] Catat: masa berlaku access token dan refresh token yang sebenarnya

### A.2 Order — wajib berhasil
- [ ] Ambil daftar order pada rentang tanggal tertentu
- [ ] Ambil detail order
- [ ] Pastikan tersedia: nomor order, tanggal, status, daftar item, SKU, qty, harga satuan, diskon per item, total
- [ ] Catat batas maksimum rentang tanggal per panggilan dan jumlah order per halaman
- [ ] Hitung: berapa panggilan untuk menarik 1 hari data? Untuk 1 bulan?

### A.3 Keuangan / escrow — penentu modul Finance
- [ ] Berhasil memanggil endpoint rincian escrow untuk sebuah order
- [ ] Pastikan komponen berikut **terpisah**, bukan digabung jadi satu angka:
  - [ ] harga bruto
  - [ ] komisi
  - [ ] biaya layanan
  - [ ] biaya administrasi
  - [ ] voucher/diskon yang dibebankan ke penjual
  - [ ] voucher yang dibebankan ke platform
  - [ ] ongkir dan subsidi ongkir
  - [ ] payout bersih
- [ ] Pastikan ada informasi tanggal dana dilepas (payout/release date)
- [ ] Uji satu order yang mengalami refund atau retur — apa yang berubah pada datanya?
- [ ] Cek apakah tersedia data settlement/mutasi dompet level periode (bukan hanya per order)

**Jika langkah A.3 gagal, hentikan dan diskusikan ulang lingkup dengan klien sebelum lanjut.**

### A.4 Produk & stok
- [ ] Ambil daftar produk
- [ ] Ambil detail produk beserta varian/model
- [ ] Pastikan tersedia: nama, SKU penjual, harga, stok, status listing
- [ ] Perhatikan perbedaan jenis stok jika ada (mis. stok total vs stok tersedia vs stok dialokasikan) — catat mana yang akan dipakai sebagai angka acuan

### A.5 Batas & keandalan
- [ ] Catat batas laju (rate limit) yang berlaku dan perilaku saat terlampaui
- [ ] Catat bentuk respons error dan kode error yang perlu ditangani
- [ ] Cek ketersediaan webhook/push mechanism dan event apa saja yang tersedia

### A.6 Keluaran Fase 0.5
Satu halaman ringkasan berisi: modul mana yang **dipastikan bisa**, mana yang **tidak bisa**, dan mana yang **perlu penyesuaian lingkup** — beserta perkiraan volume panggilan API harian. Dokumen ini yang menjadi dasar revisi PRD dan estimasi waktu, bukan asumsi.

---

*Dokumen ini adalah draf. Bagian "Bukan tujuan", "Asumsi", dan "Pertanyaan terbuka" sebaiknya dibahas dan disepakati bersama klien sebelum pengembangan dimulai.*
