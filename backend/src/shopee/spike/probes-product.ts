/**
 * A.4 — Produk & stok.
 */
import type ShopeeSDK from '../../../vendor/shopee-sdk/lib/sdk.js';
import { ItemStatus } from '../../../vendor/shopee-sdk/lib/schemas/product.js';
import { runProbe, skipProbe, recordDerived, recordFieldCheck } from './runner.js';
import type { ProbeContext } from './types.js';

export async function runProductProbes(sdk: ShopeeSDK, ctx: ProbeContext): Promise<void> {
  // A.4.1 — daftar produk.
  const listRaw = (await runProbe(ctx, {
    id: 'A.4.1',
    checklistRef: 'Ambil daftar produk',
    module: 'Product',
    label: 'Daftar produk (get_item_list, status NORMAL)',
    call: () => sdk.product.getItemList({ offset: 0, page_size: 20, item_status: [ItemStatus.NORMAL] }),
  })) as { response?: { item?: { item_id: number }[] } } | undefined;

  ctx.sampleItemId = listRaw?.response?.item?.[0]?.item_id;

  if (!ctx.sampleItemId) {
    skipProbe(ctx, { id: 'A.4.2', checklistRef: 'Ambil detail produk beserta varian/model', module: 'Product', label: 'Detail produk + varian' }, 'Tidak ada item_id sample — daftar produk kosong (status NORMAL). Buat listing test di sandbox.');
    skipProbe(ctx, { id: 'A.4.3', checklistRef: 'Pastikan tersedia: nama, SKU penjual, harga, stok, status listing', module: 'Product', label: 'Verifikasi field wajib produk' }, 'Lihat A.4.2.');
    skipProbe(ctx, { id: 'A.4.4', checklistRef: 'Perhatikan perbedaan jenis stok jika ada (mis. stok total vs stok tersedia vs stok dialokasikan) — catat mana yang akan dipakai sebagai angka acuan', module: 'Product', label: 'Jenis-jenis field stok' }, 'Lihat A.4.2.');
    return;
  }

  // A.4.2 — detail produk (base info) + daftar model/varian.
  const baseInfoRaw = await runProbe(ctx, {
    id: 'A.4.2',
    checklistRef: 'Ambil detail produk beserta varian/model',
    module: 'Product',
    label: `Detail produk item_id=${ctx.sampleItemId} (get_item_base_info)`,
    call: () => sdk.product.getItemBaseInfo({ item_id_list: [ctx.sampleItemId as number] }),
  });
  await runProbe(ctx, {
    id: 'A.4.2-model',
    checklistRef: 'Ambil detail produk beserta varian/model',
    module: 'Product',
    label: `Daftar model/varian item_id=${ctx.sampleItemId} (get_model_list)`,
    call: () => sdk.product.getModelList({ item_id: ctx.sampleItemId as number }),
  });

  // A.4.3 — field wajib atas base info yang sudah diambil.
  recordFieldCheck(
    ctx,
    { id: 'A.4.3', checklistRef: 'Pastikan tersedia: nama, SKU penjual, harga, stok, status listing', module: 'Product', label: 'Verifikasi field wajib produk' },
    baseInfoRaw,
    [
      { label: 'nama', path: 'response.item_list[0].item_name' },
      { label: 'SKU penjual', path: 'response.item_list[0].item_sku' },
      { label: 'harga (price_info)', path: 'response.item_list[0].price_info[0].current_price' },
      { label: 'stok (stock_info_v2)', path: 'response.item_list[0].stock_info_v2' },
      { label: 'status listing', path: 'response.item_list[0].item_status' },
    ],
  );

  // A.4.4 — jenis-jenis field stok yang tersedia, DERIVED dari raw base info
  // (bukan pass/fail — ini murni pencatatan, sesuai bunyi checklist "catat
  // mana yang akan dipakai sebagai angka acuan").
  const stockInfo = (baseInfoRaw as { response?: { item_list?: { stock_info_v2?: unknown }[] } } | undefined)?.response?.item_list?.[0]?.stock_info_v2 as
    | { summary_info?: { total_available_stock?: number; total_reserved_stock?: number }; seller_stock?: { stock?: number }[]; shopee_stock?: { stock?: number }[] }
    | undefined;
  recordDerived(
    ctx,
    {
      id: 'A.4.4',
      checklistRef: 'Perhatikan perbedaan jenis stok jika ada (mis. stok total vs stok tersedia vs stok dialokasikan) — catat mana yang akan dipakai sebagai angka acuan',
      module: 'Product',
      label: 'Jenis-jenis field stok tersedia',
    },
    stockInfo ? 'ok' : 'skipped',
    stockInfo
      ? `summary_info.total_available_stock=${stockInfo.summary_info?.total_available_stock ?? 'tidak ada'}, ` +
        `summary_info.total_reserved_stock=${stockInfo.summary_info?.total_reserved_stock ?? 'tidak ada'}, ` +
        `seller_stock[]=${stockInfo.seller_stock?.length ?? 0} lokasi, shopee_stock[]=${stockInfo.shopee_stock?.length ?? 0} lokasi. ` +
        'Rekomendasi: pakai summary_info.total_available_stock sebagai angka acuan F-40/F-42 (ini yang benar-benar bisa dijual saat ini); ' +
        'total_reserved_stock adalah stok yang ditahan promosi, bukan stok hilang.'
      : 'stock_info_v2 tidak ada di response — cek apakah perlu request field tambahan atau item ini memang tidak dikelola per-lokasi.',
  );
}
