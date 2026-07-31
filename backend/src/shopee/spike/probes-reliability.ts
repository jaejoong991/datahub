/**
 * A.5 — Batas & keandalan.
 */
import type ShopeeSDK from '../../../vendor/shopee-sdk/lib/sdk.js';
import { ShopeeApiError, ShopeeSdkError } from '../../../vendor/shopee-sdk/lib/errors.js';
import { runProbe, recordDerived } from './runner.js';
import { describeError, saveRaw, serializeError, sleep } from './util.js';
import type { ProbeContext } from './types.js';

const RATE_LIMIT_BURST_SIZE = 20;

export async function runReliabilityProbes(sdk: ShopeeSDK, ctx: ProbeContext): Promise<void> {
  // A.5.1 — rate limit & perilaku saat terlampaui. Opt-in lewat env karena ini
  // SENGAJA membombardir sandbox dengan panggilan beruntun — tidak dijalankan
  // diam-diam secara default supaya tidak memicu throttle/ban tanpa consent.
  if (process.env.SHOPEE_SPIKE_TEST_RATE_LIMIT === 'true') {
    let successCount = 0;
    let firstFailure: unknown;
    for (let i = 0; i < RATE_LIMIT_BURST_SIZE; i++) {
      try {
        await sdk.shop.getShopInfo();
        successCount++;
      } catch (e) {
        firstFailure = firstFailure ?? e;
      }
    }
    const savedAs = firstFailure ? await saveRaw('A.5.1-error', serializeError(firstFailure)) : undefined;
    recordDerived(
      ctx,
      { id: 'A.5.1', checklistRef: 'Catat batas laju (rate limit) yang berlaku dan perilaku saat terlampaui', module: 'Reliability', label: `Burst test: ${RATE_LIMIT_BURST_SIZE}x get_shop_info tanpa jeda` },
      'ok',
      firstFailure
        ? `${successCount}/${RATE_LIMIT_BURST_SIZE} berhasil sebelum gagal. Error pertama: ${describeError(firstFailure)}${savedAs ? ` (raw: ${savedAs})` : ''}`
        : `Semua ${RATE_LIMIT_BURST_SIZE} panggilan beruntun berhasil — belum ketemu batas laju di burst size ini. Naikkan RATE_LIMIT_BURST_SIZE atau ulangi jika perlu.`,
    );
  } else {
    recordDerived(
      ctx,
      { id: 'A.5.1', checklistRef: 'Catat batas laju (rate limit) yang berlaku dan perilaku saat terlampaui', module: 'Reliability', label: 'Burst test rate limit' },
      'skipped',
      'Tidak dijalankan (default). Set SHOPEE_SPIKE_TEST_RATE_LIMIT=true untuk mengaktifkan — ini akan memanggil get_shop_info berkali-kali tanpa jeda untuk sengaja memicu limit, jadi jangan jalankan berulang-ulang di sandbox yang sama tanpa perlu.',
    );
  }

  // A.5.2 — bentuk respons error & kode error. Sengaja panggil order_sn yang
  // tidak mungkin ada. Status 'ok' berarti "berhasil merekam buktinya",
  // TERLEPAS dari apakah Shopee menolaknya dengan error keras atau balas 200
  // dengan daftar kosong — dua-duanya adalah temuan yang sah untuk dicatat.
  await sleep(300);
  try {
    const raw = await sdk.order.getOrdersDetail({ order_sn_list: ['SPIKE-TEST-INVALID-000'] });
    const savedAs = await saveRaw('A.5.2', raw);
    ctx.results.push({
      id: 'A.5.2',
      checklistRef: 'Catat bentuk respons error dan kode error yang perlu ditangani',
      module: 'Reliability',
      label: 'order_sn tidak valid → bentuk respons',
      status: 'ok',
      detail: 'Shopee TIDAK melempar error untuk order_sn tidak valid — balas 200 dengan payload (lihat raw). Cek apakah order_list kosong atau berisi entri dengan flag error per-item.',
      savedAs,
    });
  } catch (e) {
    const savedAs = await saveRaw('A.5.2-error', serializeError(e));
    const errorCode = e instanceof ShopeeApiError && typeof e.data === 'object' && e.data !== null && 'error' in e.data ? String((e.data as Record<string, unknown>).error) : undefined;
    ctx.results.push({
      id: 'A.5.2',
      checklistRef: 'Catat bentuk respons error dan kode error yang perlu ditangani',
      module: 'Reliability',
      label: 'order_sn tidak valid → bentuk respons error',
      status: 'ok',
      detail: `Shopee menolak dengan ${e instanceof ShopeeApiError ? `HTTP ${e.status}, error code "${errorCode ?? '?'}"` : e instanceof ShopeeSdkError ? 'ShopeeSdkError (bukan dari Shopee, dari SDK lokal)' : 'error tak dikenal'}: ${describeError(e)}`,
      savedAs,
      meta: { error_code: errorCode },
    });
  }

  // A.5.3 — ketersediaan webhook/push mechanism.
  await runProbe(ctx, {
    id: 'A.5.3',
    checklistRef: 'Cek ketersediaan webhook/push mechanism dan event apa saja yang tersedia',
    module: 'Reliability',
    label: 'Konfigurasi push/webhook saat ini (get_app_push_config)',
    fields: [
      { label: 'callback_url', path: 'response.callback_url' },
      { label: 'push_config_on_list (event yang aktif)', path: 'response.push_config_on_list' },
    ],
    call: () => sdk.push.getAppPushConfig(),
  });
}
