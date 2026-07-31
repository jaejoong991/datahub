/**
 * A.1 — Autentikasi.
 *
 * A.1.1 (signature HMAC) dan A.1.2 (alur otorisasi toko) TIDAK dipanggil di
 * sini: keduanya derived dari hasil probe lain / dari preflight yang sudah
 * lolos sebelum file ini jalan sama sekali (lihat spike.ts). Kalau kita
 * sampai baris ini, A.1.2 sudah pasti benar — preflight() akan sudah exit
 * kalau belum. A.1.1 dihitung di report.ts dari status semua probe lain
 * (kalau ada satu saja yang 'ok', signature pasti valid).
 */
import type ShopeeSDK from '../../../vendor/shopee-sdk/lib/sdk.js';
import { getDb } from '../../lib/db.js';
import { runProbe } from './runner.js';
import type { ProbeContext } from './types.js';

export async function runAuthProbes(sdk: ShopeeSDK, ctx: ProbeContext): Promise<void> {
  // A.1.3 — refresh token ditukar jadi access token baru.
  const refreshed = await runProbe(ctx, {
    id: 'A.1.3',
    checklistRef: 'Refresh token berhasil ditukar menjadi token baru',
    module: 'Auth',
    label: 'Tukar refresh token → access token baru',
    call: () => sdk.refreshToken(ctx.shopId),
  });

  // A.1.4 — catat masa berlaku access & refresh token yang SEBENARNYA
  // (bukan asumsi 4 jam yang di-hardcode di DbTokenStore.get()).
  const shopRow = await getDb()
    .selectFrom('shop')
    .select(['token_expires_at', 'refresh_expires_at', 'authorized_at'])
    .where('id', '=', ctx.shopId)
    .executeTakeFirst();

  const refreshedExpireIn =
    refreshed && typeof refreshed === 'object' && 'expire_in' in refreshed
      ? (refreshed as { expire_in?: number }).expire_in
      : undefined;

  ctx.results.push({
    id: 'A.1.4',
    checklistRef: 'Catat: masa berlaku access token dan refresh token yang sebenarnya',
    module: 'Auth',
    label: 'Masa berlaku token (dari DB + respons refresh)',
    status: shopRow ? 'ok' : 'fail',
    detail: shopRow
      ? `access_token expire_in dari respons refresh: ${refreshedExpireIn ?? 'tidak ada di respons'} detik. ` +
        `token_expires_at (DB): ${shopRow.token_expires_at ?? '-'}. refresh_expires_at (DB, catatan aplikasi bukan dari Shopee): ${shopRow.refresh_expires_at ?? '-'}.`
      : 'Baris shop tidak ditemukan saat query ulang (tidak seharusnya terjadi setelah preflight lolos).',
    meta: { expire_in_seconds: refreshedExpireIn },
  });
}
