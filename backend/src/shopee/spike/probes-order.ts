/**
 * A.2 — Order (wajib berhasil sebelum modul Sales bisa dijanjikan).
 */
import type ShopeeSDK from '../../../vendor/shopee-sdk/lib/sdk.js';
import { runProbe, skipProbe, recordDerived, recordFieldCheck } from './runner.js';
import type { ProbeContext } from './types.js';

const ORDER_LIST_RANGE_DAYS = 15; // batas maksimum Shopee per docstring SDK — lihat A.2.4
const DAY_SECONDS = 86_400;

export async function runOrderProbes(sdk: ShopeeSDK, ctx: ProbeContext): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const from = now - ORDER_LIST_RANGE_DAYS * DAY_SECONDS;

  // A.2.1 — daftar order pada rentang tanggal. Diambil dengan rentang maksimum
  // (15 hari) sekali jalan supaya A.2.5 (estimasi panggilan/hari) punya sample
  // yang lebih representatif daripada rentang 1 hari yang mungkin kosong.
  const listRaw = (await runProbe(ctx, {
    id: 'A.2.1',
    checklistRef: 'Ambil daftar order pada rentang tanggal tertentu',
    module: 'Order',
    label: `Daftar order, ${ORDER_LIST_RANGE_DAYS} hari terakhir`,
    call: () =>
      sdk.order.getOrderList({
        time_range_field: 'create_time',
        time_from: from,
        time_to: now,
        page_size: 100,
      }),
  })) as { response?: { order_list?: { order_sn: string }[]; more?: boolean } } | undefined;

  const orderList = listRaw?.response?.order_list ?? [];
  ctx.sampleOrderSn = orderList[0]?.order_sn;

  // A.2.4 — batas rentang tanggal & jumlah order per halaman.
  // Bagian "batas maksimum" DIDOKUMENTASIKAN dari SDK/Shopee API docs, bukan
  // diverifikasi lewat panggilan yang sengaja melebihi batas (spike ini tidak
  // menembak API dengan parameter tidak valid hanya untuk konfirmasi angka
  // yang sudah didokumentasikan resmi). Bagian "more"/halaman diambil dari
  // observasi panggilan A.2.1 di atas.
  recordDerived(
    ctx,
    {
      id: 'A.2.4',
      checklistRef: 'Catat batas maksimum rentang tanggal per panggilan dan jumlah order per halaman',
      module: 'Order',
      label: 'Batas rentang tanggal & page_size',
    },
    'ok',
    `Didokumentasikan (SDK/Shopee API): rentang tanggal maksimum per panggilan get_order_list = 15 hari; page_size 1–100. ` +
      `Observasi run ini: ${orderList.length} order dikembalikan pada page pertama (page_size=100), more=${listRaw?.response?.more ?? 'tidak diketahui'}.`,
  );

  // A.2.5 — estimasi panggilan per hari / per bulan data.
  if (orderList.length > 0) {
    const ordersPerDay = orderList.length / ORDER_LIST_RANGE_DAYS;
    const callsPerDayForBackfill = Math.max(1, Math.ceil(ordersPerDay / 100));
    const callsPerMonthForBackfill = Math.max(1, Math.ceil((ordersPerDay * 30) / 100));
    recordDerived(
      ctx,
      {
        id: 'A.2.5',
        checklistRef: 'Hitung: berapa panggilan untuk menarik 1 hari data? Untuk 1 bulan?',
        module: 'Order',
        label: 'Estimasi panggilan get_order_list per hari/bulan',
      },
      'ok',
      `~${ordersPerDay.toFixed(1)} order/hari (dari ${orderList.length} order dalam ${ORDER_LIST_RANGE_DAYS} hari, page pertama saja — ` +
        `angka riil lebih tinggi kalau more=true). Dengan page_size=100: ~${callsPerDayForBackfill} panggilan get_order_list untuk 1 hari, ` +
        `~${callsPerMonthForBackfill} panggilan untuk backfill 1 bulan. Ini di luar overhead get_order_detail per order ` +
        '(limit 50 order_sn/panggilan) dan polling F-04 (tiap 15 menit, terlepas dari ada order baru atau tidak).',
      { orders_sampled: orderList.length, sample_window_days: ORDER_LIST_RANGE_DAYS, calls_per_day_backfill: callsPerDayForBackfill, calls_per_month_backfill: callsPerMonthForBackfill },
    );
  } else {
    recordDerived(
      ctx,
      {
        id: 'A.2.5',
        checklistRef: 'Hitung: berapa panggilan untuk menarik 1 hari data? Untuk 1 bulan?',
        module: 'Order',
        label: 'Estimasi panggilan get_order_list per hari/bulan',
      },
      'skipped',
      `Tidak ada order sama sekali dalam ${ORDER_LIST_RANGE_DAYS} hari terakhir di sandbox — buat order test dulu (Shopee Sandbox Simulator) baru estimasi ini bisa dihitung.`,
    );
  }

  if (!ctx.sampleOrderSn) {
    skipProbe(
      ctx,
      { id: 'A.2.2', checklistRef: 'Ambil detail order', module: 'Order', label: 'Detail order' },
      'Tidak ada order_sn sample — daftar order (A.2.1) kosong.',
    );
    skipProbe(
      ctx,
      {
        id: 'A.2.3',
        checklistRef:
          'Pastikan tersedia: nomor order, tanggal, status, daftar item, SKU, qty, harga satuan, diskon per item, total',
        module: 'Order',
        label: 'Cek field detail order',
      },
      'Tidak ada order_sn sample — lihat A.2.2.',
    );
    return;
  }

  // A.2.2 — detail order, minta item_list secara eksplisit (optional field).
  const detailRaw = await runProbe(ctx, {
    id: 'A.2.2',
    checklistRef: 'Ambil detail order',
    module: 'Order',
    label: `Detail order ${ctx.sampleOrderSn}`,
    call: () =>
      sdk.order.getOrdersDetail({
        order_sn_list: [ctx.sampleOrderSn as string],
        response_optional_fields: 'item_list,total_amount',
      }),
  });

  // A.2.3 — verifikasi field wajib atas response YANG SAMA (tidak panggil API lagi).
  recordFieldCheck(
    ctx,
    {
      id: 'A.2.3',
      checklistRef:
        'Pastikan tersedia: nomor order, tanggal, status, daftar item, SKU, qty, harga satuan, diskon per item, total',
      module: 'Order',
      label: 'Verifikasi field wajib pada detail order',
    },
    detailRaw,
    [
      { label: 'nomor order', path: 'response.order_list[0].order_sn' },
      { label: 'tanggal (create_time)', path: 'response.order_list[0].create_time' },
      { label: 'status', path: 'response.order_list[0].order_status' },
      { label: 'daftar item', path: 'response.order_list[0].item_list' },
      { label: 'SKU item', path: 'response.order_list[0].item_list[0].item_sku' },
      { label: 'SKU model/varian', path: 'response.order_list[0].item_list[0].model_sku' },
      { label: 'qty', path: 'response.order_list[0].item_list[0].model_quantity_purchased' },
      { label: 'harga satuan (sebelum diskon)', path: 'response.order_list[0].item_list[0].model_original_price' },
      { label: 'harga satuan (setelah diskon)', path: 'response.order_list[0].item_list[0].model_discounted_price' },
      { label: 'total (total_amount)', path: 'response.order_list[0].total_amount' },
    ],
  );
}
