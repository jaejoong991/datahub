/**
 * Salinan literal Lampiran A dari PRD (plan/PRD-Ecommerce-Data-Hub.md,
 * "Lampiran A — Daftar periksa Fase 0.5"), 29 checkbox total — BUKAN 21.
 * Dihitung ulang dengan `grep -c '^\s*- \[ \]'` atas file PRD; kalau PRD
 * direvisi, jalankan grep yang sama dan sinkronkan daftar ini.
 *
 * report.ts memakai daftar ini sebagai sumber kebenaran urutan & teks
 * checklist, supaya laporan SELALU menampilkan ke-29 baris — termasuk yang
 * probe-nya di-skip atau belum sempat jalan — bukan cuma yang kebetulan ada
 * hasilnya.
 */

export interface ChecklistItem {
  id: string;
  section: 'A.1' | 'A.2' | 'A.3' | 'A.4' | 'A.5';
  text: string;
}

export const LAMPIRAN_A: ChecklistItem[] = [
  { id: 'A.1.1', section: 'A.1', text: 'Signature HMAC berhasil dibuat dan diterima (satu panggilan apa pun berhasil)' },
  { id: 'A.1.2', section: 'A.1', text: 'Alur otorisasi toko berhasil sampai mendapat access token & refresh token' },
  { id: 'A.1.3', section: 'A.1', text: 'Refresh token berhasil ditukar menjadi token baru' },
  { id: 'A.1.4', section: 'A.1', text: 'Catat: masa berlaku access token dan refresh token yang sebenarnya' },

  { id: 'A.2.1', section: 'A.2', text: 'Ambil daftar order pada rentang tanggal tertentu' },
  { id: 'A.2.2', section: 'A.2', text: 'Ambil detail order' },
  { id: 'A.2.3', section: 'A.2', text: 'Pastikan tersedia: nomor order, tanggal, status, daftar item, SKU, qty, harga satuan, diskon per item, total' },
  { id: 'A.2.4', section: 'A.2', text: 'Catat batas maksimum rentang tanggal per panggilan dan jumlah order per halaman' },
  { id: 'A.2.5', section: 'A.2', text: 'Hitung: berapa panggilan untuk menarik 1 hari data? Untuk 1 bulan?' },

  { id: 'A.3.1', section: 'A.3', text: 'Berhasil memanggil endpoint rincian escrow untuk sebuah order' },
  { id: 'A.3.2', section: 'A.3', text: 'Pastikan komponen berikut terpisah, bukan digabung jadi satu angka' },
  { id: 'A.3.2a', section: 'A.3', text: '— harga bruto' },
  { id: 'A.3.2b', section: 'A.3', text: '— komisi' },
  { id: 'A.3.2c', section: 'A.3', text: '— biaya layanan' },
  { id: 'A.3.2d', section: 'A.3', text: '— biaya administrasi' },
  { id: 'A.3.2e', section: 'A.3', text: '— voucher/diskon yang dibebankan ke penjual' },
  { id: 'A.3.2f', section: 'A.3', text: '— voucher yang dibebankan ke platform' },
  { id: 'A.3.2g', section: 'A.3', text: '— ongkir dan subsidi ongkir' },
  { id: 'A.3.2h', section: 'A.3', text: '— payout bersih' },
  { id: 'A.3.3', section: 'A.3', text: 'Pastikan ada informasi tanggal dana dilepas (payout/release date)' },
  { id: 'A.3.4', section: 'A.3', text: 'Uji satu order yang mengalami refund atau retur — apa yang berubah pada datanya?' },
  { id: 'A.3.5', section: 'A.3', text: 'Cek apakah tersedia data settlement/mutasi dompet level periode (bukan hanya per order)' },

  { id: 'A.4.1', section: 'A.4', text: 'Ambil daftar produk' },
  { id: 'A.4.2', section: 'A.4', text: 'Ambil detail produk beserta varian/model' },
  { id: 'A.4.3', section: 'A.4', text: 'Pastikan tersedia: nama, SKU penjual, harga, stok, status listing' },
  { id: 'A.4.4', section: 'A.4', text: 'Perhatikan perbedaan jenis stok jika ada (mis. stok total vs stok tersedia vs stok dialokasikan) — catat mana yang akan dipakai sebagai angka acuan' },

  { id: 'A.5.1', section: 'A.5', text: 'Catat batas laju (rate limit) yang berlaku dan perilaku saat terlampaui' },
  { id: 'A.5.2', section: 'A.5', text: 'Catat bentuk respons error dan kode error yang perlu ditangani' },
  { id: 'A.5.3', section: 'A.5', text: 'Cek ketersediaan webhook/push mechanism dan event apa saja yang tersedia' },
];

export const SECTION_TITLES: Record<ChecklistItem['section'], string> = {
  'A.1': 'A.1 Autentikasi',
  'A.2': 'A.2 Order — wajib berhasil',
  'A.3': 'A.3 Keuangan / escrow — penentu modul Finance',
  'A.4': 'A.4 Produk & stok',
  'A.5': 'A.5 Batas & keandalan',
};
