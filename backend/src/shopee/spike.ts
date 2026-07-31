/**
 * Spike API (Fase 0.5 PRD, Lampiran A) — satu command untuk menghasilkan
 * SEMUA bukti yang diminta Lampiran A.6: contoh respons tersimpan per
 * endpoint, verifikasi field per field (bukan cuma HTTP 200), dan satu
 * laporan ringkasan modul CONFIRMED / NOT POSSIBLE / NEEDS SCOPE CHANGE.
 *
 * SYARAT sebelum menjalankan (lihat preflight.ts untuk pesan error detail):
 *   1. Postgres jalan (`docker compose up -d` dari root repo) & DATABASE_URL benar.
 *   2. Ada baris `shop` (channel='shopee') dengan kredensial partner di
 *      `channel_credential` (isi via SHOPEE_PARTNER_ID/SHOPEE_PARTNER_KEY di
 *      .env lalu `npm run seed`, atau lewat panel admin).
 *   3. Toko sudah diotorisasi ke Shopee sandbox — login sebagai admin di
 *      frontend, buka GET /auth/shopee/authorize, selesaikan consent.
 *
 * Jalankan:
 *   SHOPEE_SHOP_ID=1 npx tsx src/shopee/spike.ts
 *
 * Opsional:
 *   SHOPEE_SPIKE_TEST_RATE_LIMIT=true   # aktifkan burst test A.5.1 (lihat probes-reliability.ts)
 *
 * Hasil:
 *   - backend/spike-output/*.json   → raw response tiap probe (gitignored, JANGAN commit — bisa berisi data pembeli)
 *   - backend/spike-output/REPORT.md → satu halaman ringkasan Lampiran A.6
 *
 * Skrip ini TIDAK PERNAH memalsukan/mock data Shopee. Kalau kredensial atau
 * otorisasi belum ada, ia berhenti dengan instruksi — bukan lanjut dengan
 * data karangan.
 */
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { getShopeeSDK } from './client.js';
import { closeDb } from '../lib/db.js';
import { preflight } from './spike/preflight.js';
import { ensureOutputDir, OUTPUT_DIR } from './spike/util.js';
import { runAuthProbes } from './spike/probes-auth.js';
import { runOrderProbes } from './spike/probes-order.js';
import { runFinanceProbes } from './spike/probes-finance.js';
import { runProductProbes } from './spike/probes-product.js';
import { runReliabilityProbes } from './spike/probes-reliability.js';
import { buildReport, computeVerdicts } from './spike/report.js';
import type { ProbeContext } from './spike/types.js';

export {}; // module untuk top-level await

async function main(): Promise<number> {
  const info = await preflight(); // exit(1) sendiri kalau syarat belum lengkap
  console.log(`\n✓ Preflight lolos — shop "${info.shopName}" (id=${info.shopId}, ${info.isSandbox ? 'sandbox' : 'PRODUCTION'})\n`);

  await ensureOutputDir();
  const sdk = await getShopeeSDK(info.shopId);

  const ctx: ProbeContext = { shopId: info.shopId, results: [] };

  // A.1.2 derived: kalau kita sampai sini, preflight sudah membuktikan
  // access_token & refresh_token ada di DB (lihat DbTokenStore.get()).
  ctx.results.push({
    id: 'A.1.2',
    checklistRef: 'Alur otorisasi toko berhasil sampai mendapat access token & refresh token',
    module: 'Auth',
    label: 'Otorisasi toko (dibuktikan lewat preflight)',
    status: 'ok',
    detail: 'access_token & refresh_token tersimpan terenkripsi di tabel shop (lolos preflight sebelum probe apa pun jalan).',
  });

  console.log('Menjalankan probe...\n');
  await runAuthProbes(sdk, ctx);
  await runOrderProbes(sdk, ctx);
  await runFinanceProbes(sdk, ctx);
  await runProductProbes(sdk, ctx);
  await runReliabilityProbes(sdk, ctx);

  // A.1.1 derived: signature HMAC valid ⟺ ADA saja satu probe lain yang 'ok'.
  const anyOtherOk = ctx.results.some((r) => r.status === 'ok');
  ctx.results.unshift({
    id: 'A.1.1',
    checklistRef: 'Signature HMAC berhasil dibuat dan diterima (satu panggilan apa pun berhasil)',
    module: 'Auth',
    label: 'Signature HMAC valid',
    status: anyOtherOk ? 'ok' : 'fail',
    detail: anyOtherOk ? 'Dibuktikan otomatis: minimal satu probe lain berhasil, jadi signature diterima Shopee.' : 'Semua probe gagal — cek apakah kegagalannya soal signature/kredensial (lihat detail tiap probe) atau soal lain.',
  });

  for (const r of ctx.results) {
    const icon = r.status === 'ok' ? '✅' : r.status === 'skipped' ? '⏭️ ' : '❌';
    console.log(` ${icon} ${r.id.padEnd(12)} ${r.label} — ${r.detail}`);
  }

  const report = buildReport(info, ctx.results);
  const reportPath = path.join(OUTPUT_DIR, 'REPORT.md');
  await writeFile(reportPath, report, 'utf-8');
  console.log(`\n📄 Laporan lengkap: ${reportPath}`);
  console.log(`📁 Raw responses:   ${OUTPUT_DIR}/*.json (gitignored — jangan commit, bisa berisi data pembeli)\n`);

  const verdicts = computeVerdicts(ctx.results);
  console.log('=== Keputusan per modul ===');
  for (const v of verdicts) console.log(`  ${v.module}: ${v.verdict}`);

  // Exit non-zero HANYA kalau ada modul kritis yang jelas-jelas NOT_POSSIBLE
  // (sesuai arahan Lampiran A untuk A.3 khususnya: "hentikan dan diskusikan
  // ulang lingkup"). NEEDS_SCOPE_CHANGE / UNVERIFIED bukan kegagalan proses —
  // itu justru temuan yang harus dilaporkan, jadi tetap exit 0.
  const hasBlocker = verdicts.some((v) => v.verdict === 'NOT_POSSIBLE');
  return hasBlocker ? 1 : 0;
}

let exitCode = 0;
try {
  exitCode = await main();
} catch (e) {
  console.error('\n✗ Spike API berhenti karena error tak terduga:', e);
  exitCode = 1;
} finally {
  await closeDb();
}
process.exit(exitCode);
