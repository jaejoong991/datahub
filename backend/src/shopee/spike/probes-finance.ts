/**
 * A.3 — Keuangan / escrow. Ini PENENTU modul Finance (lihat PRD bagian 9
 * Asumsi #2 dan Lampiran A: "Jika langkah A.3 gagal, hentikan dan diskusikan
 * ulang lingkup dengan klien sebelum lanjut"). Field presence di sini, bukan
 * cuma HTTP 200, adalah bukti yang sebenarnya dicari Fase 0.5.
 *
 * Catatan jujur soal keterbatasan mapping field (baca sebelum percaya buta
 * pada label di bawah): Shopee TIDAK punya field bernama literal "biaya
 * administrasi" yang terpisah dari komisi/layanan. Field kandidat paling
 * dekat adalah `seller_transaction_fee`. Ini ditandai eksplisit di report,
 * BUKAN diam-diam dianggap cocok — kalau ternyata Shopee menggabungnya ke
 * commission_fee/service_fee, itu sendiri adalah temuan Fase 0.5 yang valid
 * (lihat Lampiran A: "field digabung jadi satu angka" = risiko yang memang
 * mau dibuktikan).
 */
import type ShopeeSDK from '../../../vendor/shopee-sdk/lib/sdk.js';
import { runProbe, skipProbe, recordDerived, recordFieldCheck } from './runner.js';
import type { ProbeContext } from './types.js';

const DAY_SECONDS = 86_400;

/** Sub-item checklist A.3.2 — satu field per baris di Lampiran A. */
const ESCROW_FIELD_SUBITEMS: { id: string; refLabel: string; fields: { label: string; path: string }[] }[] = [
  { id: 'A.3.2a', refLabel: 'harga bruto', fields: [{ label: 'harga bruto (buyer_total_amount)', path: 'response.order_income.buyer_total_amount' }] },
  { id: 'A.3.2b', refLabel: 'komisi', fields: [{ label: 'komisi (commission_fee)', path: 'response.order_income.commission_fee' }] },
  { id: 'A.3.2c', refLabel: 'biaya layanan', fields: [{ label: 'biaya layanan (service_fee)', path: 'response.order_income.service_fee' }] },
  {
    id: 'A.3.2d',
    refLabel: 'biaya administrasi',
    fields: [{ label: 'biaya administrasi — KANDIDAT TERBAIK, bukan nama field resmi (seller_transaction_fee)', path: 'response.order_income.seller_transaction_fee' }],
  },
  { id: 'A.3.2e', refLabel: 'voucher/diskon dibebankan ke penjual', fields: [{ label: 'voucher penjual (voucher_from_seller)', path: 'response.order_income.voucher_from_seller' }] },
  { id: 'A.3.2f', refLabel: 'voucher dibebankan ke platform', fields: [{ label: 'voucher platform (voucher_from_shopee)', path: 'response.order_income.voucher_from_shopee' }] },
  {
    id: 'A.3.2g',
    refLabel: 'ongkir dan subsidi ongkir',
    fields: [
      { label: 'ongkir aktual (actual_shipping_fee)', path: 'response.order_income.actual_shipping_fee' },
      { label: 'subsidi ongkir Shopee (shopee_shipping_rebate)', path: 'response.order_income.shopee_shipping_rebate' },
    ],
  },
  { id: 'A.3.2h', refLabel: 'payout bersih', fields: [{ label: 'payout bersih (escrow_amount)', path: 'response.order_income.escrow_amount' }] },
];

export async function runFinanceProbes(sdk: ShopeeSDK, ctx: ProbeContext): Promise<void> {
  if (!ctx.sampleOrderSn) {
    const skip = (id: string, ref: string, label: string) => skipProbe(ctx, { id, checklistRef: ref, module: 'Finance', label }, 'Tidak ada order_sn sample dari A.2 — tidak bisa uji escrow.');
    skip('A.3.1', 'Berhasil memanggil endpoint rincian escrow untuk sebuah order', 'Panggil get_escrow_detail');
    for (const s of ESCROW_FIELD_SUBITEMS) skip(s.id, s.refLabel, `Field: ${s.refLabel}`);
    skip('A.3.2', 'Pastikan komponen berikut terpisah, bukan digabung jadi satu angka', 'Ringkasan komponen escrow terpisah');
    return;
  }

  // A.3.1
  const escrowRaw = await runProbe(ctx, {
    id: 'A.3.1',
    checklistRef: 'Berhasil memanggil endpoint rincian escrow untuk sebuah order',
    module: 'Finance',
    label: `Rincian escrow order ${ctx.sampleOrderSn}`,
    call: () => sdk.payment.getEscrowDetail({ order_sn: ctx.sampleOrderSn as string }),
  });

  // A.3.2a–h — satu field per sub-checklist, tanpa panggilan API tambahan.
  for (const sub of ESCROW_FIELD_SUBITEMS) {
    recordFieldCheck(ctx, { id: sub.id, checklistRef: sub.refLabel, module: 'Finance', label: `Field escrow: ${sub.refLabel}` }, escrowRaw, sub.fields);
  }

  // A.3.2 (parent) — derived dari 8 sub-item + cek "tidak semuanya angka yang sama"
  // (indikasi kasar field digabung/di-alias, bukan bukti definitif).
  const subResults = ESCROW_FIELD_SUBITEMS.map((s) => ctx.results.find((r) => r.id === s.id));
  const allPresent = subResults.every((r) => r?.status === 'ok');
  const numericValues = subResults.flatMap((r) => (r?.fields ?? []).map((f) => f.value)).filter((v): v is number => typeof v === 'number');
  const distinctCount = new Set(numericValues).size;
  const suspiciousMerge = numericValues.length > 1 && distinctCount === 1;
  recordDerived(
    ctx,
    { id: 'A.3.2', checklistRef: 'Pastikan komponen berikut terpisah, bukan digabung jadi satu angka', module: 'Finance', label: 'Ringkasan: komponen escrow terpisah?' },
    allPresent && !suspiciousMerge ? 'ok' : 'fail',
    allPresent
      ? suspiciousMerge
        ? `Semua field ADA tapi nilainya identik (${numericValues[0]}) — kemungkinan placeholder/dummy sandbox atau memang digabung. Cek manual sebelum percaya angka ini terpisah beneran.`
        : 'Semua 8 komponen ada sebagai field numerik terpisah di response (lihat A.3.2a–h).'
      : `Field hilang: ${subResults.filter((r) => r?.status !== 'ok').map((r) => r?.checklistRef).join(', ')}.`,
  );

  // A.3.3 — informasi tanggal dana dilepas. TIDAK ADA di get_escrow_detail
  // (dicek: interface OrderIncome tidak punya field release/payout time) —
  // sumbernya get_escrow_list. Field dicek generik di response list, BUKAN
  // dipaksa harus match order sample (order sample mungkin belum released).
  await runProbe(ctx, {
    id: 'A.3.3',
    checklistRef: 'Pastikan ada informasi tanggal dana dilepas (payout/release date)',
    module: 'Finance',
    label: 'Tanggal pelepasan dana (get_escrow_list)',
    fields: [
      { label: 'order_sn pada daftar escrow', path: 'response.escrow_list[0].order_sn' },
      { label: 'payout_amount', path: 'response.escrow_list[0].payout_amount' },
      { label: 'escrow_release_time (tanggal dana dilepas)', path: 'response.escrow_list[0].escrow_release_time' },
    ],
    call: () =>
      sdk.payment.getEscrowList({
        release_time_from: Math.floor(Date.now() / 1000) - 90 * DAY_SECONDS,
        release_time_to: Math.floor(Date.now() / 1000),
        page_size: 20,
      }),
  });

  // A.3.4 — order dengan refund/retur, apa yang berubah.
  const returnListRaw = (await runProbe(ctx, {
    id: 'A.3.4-list',
    checklistRef: 'Uji satu order yang mengalami refund atau retur — apa yang berubah pada datanya?',
    module: 'Finance',
    label: 'Cari sample return (get_return_list)',
    call: () =>
      sdk.returns.getReturnList({
        page_no: 1,
        page_size: 20,
        create_time_from: Math.floor(Date.now() / 1000) - 90 * DAY_SECONDS,
        create_time_to: Math.floor(Date.now() / 1000),
      }),
  })) as { response?: { return?: { return_sn: string; order_sn: string; refund_amount: number }[] } } | undefined;

  const sampleReturn = returnListRaw?.response?.return?.[0];
  ctx.sampleReturnSn = sampleReturn?.return_sn;

  if (!sampleReturn) {
    recordDerived(
      ctx,
      { id: 'A.3.4', checklistRef: 'Uji satu order yang mengalami refund atau retur — apa yang berubah pada datanya?', module: 'Finance', label: 'Dampak refund/retur ke escrow' },
      'skipped',
      'Tidak ada return/refund dalam 90 hari terakhir di sandbox ini. Buat satu order + ajukan retur lewat Shopee Sandbox Simulator, lalu ulang spike ini — endpoint get_return_list & get_return_detail sudah terbukti bisa dipanggil (lihat A.3.4-list).',
    );
  } else {
    await runProbe(ctx, {
      id: 'A.3.4-detail',
      checklistRef: 'Uji satu order yang mengalami refund atau retur — apa yang berubah pada datanya?',
      module: 'Finance',
      label: `Detail return ${sampleReturn.return_sn}`,
      fields: [
        { label: 'order_sn terkait', path: 'response.order_sn' },
        { label: 'refund_amount', path: 'response.refund_amount' },
        { label: 'status retur', path: 'response.status' },
      ],
      call: () => sdk.returns.getReturnDetail({ return_sn: sampleReturn.return_sn }),
    });

    const escrowOfReturnedOrder = await runProbe(ctx, {
      id: 'A.3.4-escrow',
      checklistRef: 'Uji satu order yang mengalami refund atau retur — apa yang berubah pada datanya?',
      module: 'Finance',
      label: `Escrow order yang di-retur (${sampleReturn.order_sn}) — bandingkan dengan order normal`,
      fields: [
        { label: 'seller_return_refund', path: 'response.order_income.seller_return_refund' },
        { label: 'total_adjustment_amount', path: 'response.order_income.total_adjustment_amount' },
        { label: 'escrow_amount_after_adjustment', path: 'response.order_income.escrow_amount_after_adjustment' },
        { label: 'order_adjustment (daftar penyesuaian)', path: 'response.order_income.order_adjustment' },
      ],
      call: () => sdk.payment.getEscrowDetail({ order_sn: sampleReturn.order_sn }),
    });

    recordDerived(
      ctx,
      { id: 'A.3.4', checklistRef: 'Uji satu order yang mengalami refund atau retur — apa yang berubah pada datanya?', module: 'Finance', label: 'Dampak refund/retur ke escrow' },
      escrowOfReturnedOrder ? 'ok' : 'fail',
      escrowOfReturnedOrder
        ? `Dibandingkan dengan order normal (A.3.1–A.3.2): lihat field seller_return_refund/order_adjustment pada A.3.4-escrow untuk delta aktual.`
        : 'get_escrow_detail untuk order yang di-retur gagal — lihat A.3.4-escrow-error.json.',
    );
  }

  // A.3.5 — settlement/mutasi dompet level periode (bukan per order).
  await runProbe(ctx, {
    id: 'A.3.5',
    checklistRef: 'Cek apakah tersedia data settlement/mutasi dompet level periode (bukan hanya per order)',
    module: 'Finance',
    label: 'Mutasi dompet level periode (get_wallet_transaction_list)',
    fields: [
      { label: 'daftar transaksi dompet', path: 'response.transaction_list' },
    ],
    call: () =>
      sdk.payment.getWalletTransactionList({
        page_no: 1,
        page_size: 20,
        create_time_from: Math.floor(Date.now() / 1000) - 30 * DAY_SECONDS,
        create_time_to: Math.floor(Date.now() / 1000),
      }),
  });
  // Cadangan/pelengkap A.3.5 — ringkasan income per status, tanpa param wajib.
  // Catatan SDK: "Only applicable for local shops" untuk wallet transaction,
  // jadi kalau A.3.5 gagal untuk toko cross-border, income overview ini bisa
  // jadi alternatif — dicatat sebagai bukti tambahan, bukan pengganti.
  await runProbe(ctx, {
    id: 'A.3.5-overview',
    checklistRef: 'Cek apakah tersedia data settlement/mutasi dompet level periode (bukan hanya per order)',
    module: 'Finance',
    label: 'Ringkasan income per status (get_income_overview, pelengkap A.3.5)',
    call: () => sdk.payment.getIncomeOverview(),
  });
}
