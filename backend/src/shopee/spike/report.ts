/**
 * Bangun "satu halaman ringkasan" yang diminta Lampiran A.6: modul mana yang
 * dipastikan bisa, mana yang tidak bisa, mana yang perlu penyesuaian lingkup
 * — plus checklist 29-item yang sudah dicentang otomatis dari hasil probe.
 */
import type { ModuleVerdict, ProbeResult } from './types.js';
import { LAMPIRAN_A, SECTION_TITLES, type ChecklistItem } from './lampiran-a.js';
import type { PreflightResult } from './preflight.js';

/** Semua ProbeResult yang menjawab satu baris Lampiran A (id persis, atau id-suffix seperti "A.3.4-detail"). */
function resultsFor(results: ProbeResult[], id: string): ProbeResult[] {
  return results.filter((r) => r.id === id || r.id.startsWith(`${id}-`));
}

function checklistIcon(item: ChecklistItem, results: ProbeResult[]): string {
  const matches = resultsFor(results, item.id);
  if (matches.length === 0) return '⬜ (belum diuji)';
  if (matches.some((r) => r.status === 'ok')) return '✅';
  if (matches.every((r) => r.status === 'skipped')) return '⏭️ (dilewati)';
  return '❌';
}

function renderChecklist(results: ProbeResult[]): string {
  const lines: string[] = [];
  let currentSection: ChecklistItem['section'] | null = null;
  for (const item of LAMPIRAN_A) {
    if (item.section !== currentSection) {
      currentSection = item.section;
      lines.push(`\n### ${SECTION_TITLES[currentSection]}\n`);
    }
    const icon = checklistIcon(item, results);
    const matches = resultsFor(results, item.id);
    const detail = matches.find((r) => r.status === 'ok')?.detail ?? matches[0]?.detail ?? '';
    lines.push(`- [${icon.startsWith('✅') ? 'x' : ' '}] **${item.id}** ${item.text} — ${icon}${detail ? `\n  ${detail}` : ''}`);
  }
  return lines.join('\n');
}

function renderFieldTable(results: ProbeResult[], ids: string[]): string {
  const rows: string[] = ['| Field (istilah PRD) | Path di response | Ada? | Nilai contoh |', '|---|---|---|---|'];
  for (const id of ids) {
    const r = results.find((res) => res.id === id);
    for (const f of r?.fields ?? []) {
      const val = typeof f.value === 'object' ? '(objek/array — lihat raw JSON)' : String(f.value ?? '—');
      rows.push(`| ${f.label} | \`${f.path}\` | ${f.present ? '✅' : '❌'} | ${f.present ? val : '—'} |`);
    }
  }
  return rows.length > 2 ? rows.join('\n') : '_(tidak ada data — probe terkait di-skip atau gagal)_';
}

export interface Verdict {
  module: string;
  verdict: ModuleVerdict;
  reasoning: string;
}

function verdictBadge(v: ModuleVerdict): string {
  switch (v) {
    case 'CONFIRMED': return '✅ CONFIRMED — dipastikan bisa';
    case 'NOT_POSSIBLE': return '🛑 NOT POSSIBLE — tidak bisa';
    case 'NEEDS_SCOPE_CHANGE': return '⚠️ NEEDS SCOPE CHANGE — perlu penyesuaian lingkup';
    case 'UNVERIFIED': return '❔ UNVERIFIED — belum sempat diuji (tidak ada data sample)';
  }
}

function statusOf(results: ProbeResult[], id: string): ProbeResult['status'] | 'missing' {
  const matches = resultsFor(results, id);
  if (matches.length === 0) return 'missing';
  if (matches.some((r) => r.status === 'ok')) return 'ok';
  if (matches.every((r) => r.status === 'skipped')) return 'skipped';
  return 'fail';
}

export function computeVerdicts(results: ProbeResult[]): Verdict[] {
  const verdicts: Verdict[] = [];

  // Auth / koneksi (prasyarat F-01/F-02, bukan modul bisnis tapi menentukan semuanya).
  const authStatus = statusOf(results, 'A.1.3');
  verdicts.push({
    module: 'Auth & refresh token (F-01, F-02)',
    verdict: authStatus === 'ok' ? 'CONFIRMED' : authStatus === 'skipped' || authStatus === 'missing' ? 'UNVERIFIED' : 'NOT_POSSIBLE',
    reasoning: authStatus === 'ok' ? 'Refresh token berhasil ditukar — refresh terjadwal (F-02) layak dibangun seperti didesain.' : 'Refresh token gagal ditukar — cek scope aplikasi Shopee (harus include auth) sebelum lanjut F-01/F-02.',
  });

  // Order / Sales module.
  const orderCall = statusOf(results, 'A.2.2');
  const orderFields = statusOf(results, 'A.2.3');
  let orderVerdict: ModuleVerdict;
  if (orderCall === 'fail') orderVerdict = 'NOT_POSSIBLE';
  else if (orderCall === 'skipped' || orderCall === 'missing') orderVerdict = 'UNVERIFIED';
  else orderVerdict = orderFields === 'ok' ? 'CONFIRMED' : 'NEEDS_SCOPE_CHANGE';
  verdicts.push({
    module: 'Sales / Order (7.2, F-20–F-25)',
    verdict: orderVerdict,
    reasoning:
      orderVerdict === 'CONFIRMED'
        ? 'get_order_detail berhasil dan semua field wajib (SKU, qty, harga, diskon, total) ada terpisah.'
        : orderVerdict === 'UNVERIFIED'
          ? 'Tidak ada order di sandbox saat run ini — buat order test lalu ulangi spike sebelum menyimpulkan apa pun.'
          : orderVerdict === 'NOT_POSSIBLE'
            ? 'Panggilan get_order_detail sendiri gagal — cek A.2.2 untuk pesan error asli (kemungkinan besar scope order belum disetujui).'
            : 'Panggilan berhasil tapi ada field yang hilang — lihat tabel field A.2.3 untuk field mana yang perlu penyesuaian lingkup/mapping.',
  });

  // Finance module — DETERMINANT sesuai PRD 9.2 & Lampiran A "Jika A.3 gagal, hentikan".
  const escrowCall = statusOf(results, 'A.3.1');
  const escrowFieldsSeparate = statusOf(results, 'A.3.2');
  const releaseDate = statusOf(results, 'A.3.3');
  let financeVerdict: ModuleVerdict;
  if (escrowCall === 'fail') financeVerdict = 'NOT_POSSIBLE';
  else if (escrowCall === 'skipped' || escrowCall === 'missing') financeVerdict = 'UNVERIFIED';
  else financeVerdict = escrowFieldsSeparate === 'ok' && releaseDate === 'ok' ? 'CONFIRMED' : 'NEEDS_SCOPE_CHANGE';
  verdicts.push({
    module: 'Finance (7.3, F-30–F-35) — PENENTU per PRD 9.2',
    verdict: financeVerdict,
    reasoning:
      financeVerdict === 'CONFIRMED'
        ? 'get_escrow_detail berhasil, ke-8 komponen biaya terpisah, dan tanggal pelepasan dana tersedia. Modul Finance layak dijanjikan ke klien.'
        : financeVerdict === 'NOT_POSSIBLE'
          ? '🛑 get_escrow_detail GAGAL DIPANGGIL SAMA SEKALI. Sesuai Lampiran A: "hentikan dan diskusikan ulang lingkup dengan klien sebelum lanjut" — JANGAN janjikan modul Finance sebelum ini diperbaiki (kemungkinan besar: scope keuangan belum disetujui Shopee untuk app ini).'
          : financeVerdict === 'UNVERIFIED'
            ? 'Tidak ada order sample untuk diuji escrow-nya — tidak bisa menyimpulkan apa pun soal Finance dari run ini.'
            : 'Panggilan berhasil TAPI ada komponen biaya yang hilang/digabung atau tanggal pelepasan dana tidak ketemu — lihat tabel field A.3.2 & A.3.3. Modul Finance perlu penyesuaian lingkup (kolom mana yang benar-benar bisa ditampilkan) sebelum dijanjikan penuh sesuai F-30.',
  });

  // Product & stok / Gudang module.
  const productCall = statusOf(results, 'A.4.2');
  const productFields = statusOf(results, 'A.4.3');
  let productVerdict: ModuleVerdict;
  if (productCall === 'fail') productVerdict = 'NOT_POSSIBLE';
  else if (productCall === 'skipped' || productCall === 'missing') productVerdict = 'UNVERIFIED';
  else productVerdict = productFields === 'ok' ? 'CONFIRMED' : 'NEEDS_SCOPE_CHANGE';
  verdicts.push({
    module: 'Produk & Stok / Gudang (7.4, F-40–F-45)',
    verdict: productVerdict,
    reasoning:
      productVerdict === 'CONFIRMED'
        ? 'get_item_base_info berhasil dan field wajib (nama, SKU, harga, stok, status) ada. Lihat A.4.4 untuk field stok mana yang dipakai sebagai acuan F-42.'
        : productVerdict === 'UNVERIFIED'
          ? 'Tidak ada produk berstatus NORMAL di sandbox — buat listing test lalu ulangi spike.'
          : productVerdict === 'NOT_POSSIBLE'
            ? 'get_item_base_info gagal — lihat A.4.2 untuk pesan error asli.'
            : 'Panggilan berhasil tapi ada field wajib yang hilang — lihat tabel field A.4.3.',
  });

  return verdicts;
}

export function buildReport(preflightInfo: PreflightResult, results: ProbeResult[]): string {
  const now = new Date().toISOString();
  const okCount = results.filter((r) => r.status === 'ok').length;
  const failCount = results.filter((r) => r.status === 'fail').length;
  const skipCount = results.filter((r) => r.status === 'skipped').length;
  const verdicts = computeVerdicts(results);
  const orderCallsPerDay = results.find((r) => r.id === 'A.2.5')?.meta as
    | { orders_sampled: number; sample_window_days: number; calls_per_day_backfill: number; calls_per_month_backfill: number }
    | undefined;

  return `# Spike API Fase 0.5 — Ringkasan (Lampiran A)

Dibuat otomatis: ${now}
Toko: **${preflightInfo.shopName}** (shop_id=${preflightInfo.shopId}, ${preflightInfo.isSandbox ? 'SANDBOX' : '⚠️ PRODUCTION — bukan sandbox!'})
Probe: ${results.length} dijalankan — ${okCount} ok, ${failCount} gagal, ${skipCount} dilewati.

**Dasar keputusan lanjut/tidak per modul untuk merevisi PRD** (sesuai Lampiran A.6) — bukan asumsi.

---

## 1. Keputusan per modul

| Modul | Verdict | Alasan |
|---|---|---|
${verdicts.map((v) => `| ${v.module} | ${verdictBadge(v.verdict)} | ${v.reasoning} |`).join('\n')}

---

## 2. Estimasi volume panggilan API

${
  orderCallsPerDay
    ? `Order: ~${orderCallsPerDay.calls_per_day_backfill} panggilan get_order_list per hari data (backfill), ~${orderCallsPerDay.calls_per_month_backfill} per bulan (page_size=100, dari sample ${orderCallsPerDay.orders_sampled} order/${orderCallsPerDay.sample_window_days} hari). Ini di luar polling F-04 tiap 15 menit (96x/hari, terlepas ada order baru atau tidak) dan get_order_detail per order (limit 50 order_sn/panggilan).`
    : '_Tidak bisa dihitung — tidak ada order di sandbox saat run ini (lihat A.2.5)._'
}

---

## 3. Field escrow (A.3.2) — komponen biaya

${renderFieldTable(results, ['A.3.2a', 'A.3.2b', 'A.3.2c', 'A.3.2d', 'A.3.2e', 'A.3.2f', 'A.3.2g', 'A.3.2h'])}

⚠️ **Catatan biaya administrasi (A.3.2d):** Shopee tidak punya field bernama literal "biaya administrasi". Kandidat terbaik adalah \`seller_transaction_fee\` — verifikasi manual dengan tim Finance klien apakah ini definisi yang mereka maksud, JANGAN asumsikan otomatis benar.

## 4. Field order detail (A.2.3)

${renderFieldTable(results, ['A.2.3'])}

## 5. Field produk (A.4.3)

${renderFieldTable(results, ['A.4.3'])}

---

## 6. Checklist Lampiran A lengkap (29 item)
${renderChecklist(results)}

---

## 7. Bukti mentah (raw response)

Semua file JSON ada di \`backend/spike-output/\` (gitignored — lampirkan manual ke laporan klien / simpan sebagai fixture testing, JANGAN commit ke git karena bisa berisi data pembeli).

${results
  .filter((r) => r.savedAs)
  .map((r) => `- \`${r.savedAs}\` — ${r.id} (${r.status})`)
  .join('\n')}
`;
}
