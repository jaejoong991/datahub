/**
 * Preflight check untuk spike API: pastikan shop id valid, kredensial partner
 * ada di DB, dan toko sudah diotorisasi — SEBELUM memanggil satu pun endpoint
 * Shopee. Kalau salah satu gagal, keluar dengan instruksi yang jelas — jangan
 * pernah lanjut dengan data palsu/mock.
 */
import { getDb } from '../../lib/db.js';
import { getShopCredentials } from '../config.js';
import { getValidToken } from '../token.js';

export interface PreflightResult {
  shopId: number;
  shopName: string;
  isSandbox: boolean;
}

function fail(title: string, lines: string[]): never {
  console.error(`\n✗ Spike API dibatalkan — ${title}\n`);
  for (const line of lines) console.error(`  ${line}`);
  console.error('');
  process.exit(1);
}

export async function preflight(): Promise<PreflightResult> {
  const rawShopId = process.env.SHOPEE_SHOP_ID;
  const shopId = Number(rawShopId);
  if (!rawShopId || !Number.isInteger(shopId) || shopId <= 0) {
    fail('SHOPEE_SHOP_ID tidak diset atau tidak valid', [
      'Set env var SHOPEE_SHOP_ID ke id baris pada tabel `shop` (channel = \'shopee\').',
      'Shop hasil `npm run seed` (dev) biasanya id=1, contoh:',
      '  SHOPEE_SHOP_ID=1 npx tsx src/shopee/spike.ts',
      'Untuk cek id yang benar: psql "$DATABASE_URL" -c "select id, channel, name from shop;"',
    ]);
  }

  let shop: { id: number; name: string; channel: string } | undefined;
  try {
    shop = await getDb()
      .selectFrom('shop')
      .select(['id', 'name', 'channel'])
      .where('id', '=', shopId)
      .executeTakeFirst();
  } catch (e) {
    fail('tidak bisa konek ke database', [
      e instanceof Error ? e.message : String(e),
      'Pastikan Postgres jalan: `docker compose up -d` dari root repo (compose.yaml, host port 5434).',
      'Pastikan DATABASE_URL di backend/.env mengarah ke port itu.',
    ]);
  }
  if (!shop) {
    fail(`shop id=${shopId} tidak ditemukan di tabel \`shop\``, [
      'Jalankan `npm run seed` untuk membuat shop contoh (dev), atau buat baris shop lewat panel admin.',
    ]);
  }
  if (shop.channel !== 'shopee') {
    fail(`shop id=${shopId} channel-nya "${shop.channel}", bukan "shopee"`, [
      'Spike ini khusus Shopee — pilih SHOPEE_SHOP_ID milik toko dengan channel = shopee.',
    ]);
  }

  let isSandbox = true;
  try {
    const cred = await getShopCredentials(shopId);
    isSandbox = cred.isSandbox;
  } catch (e) {
    fail('kredensial partner Shopee belum ada di database', [
      e instanceof Error ? e.message : String(e),
      '',
      'Cara mengisi (dev/sandbox):',
      '  1. Isi SHOPEE_PARTNER_ID dan SHOPEE_PARTNER_KEY di backend/.env',
      '     (nilai dari App Shopee Open Platform sandbox kamu).',
      '  2. Jalankan `npm run seed` — ini memindahkan nilai itu ke tabel',
      '     channel_credential untuk shop id=1. Env var itu SENDIRI TIDAK dibaca',
      '     saat runtime, hanya dipakai sekali oleh seed.',
      '  Produksi: isi lewat panel admin (tabel channel_credential, key=partner_id/partner_key).',
    ]);
  }

  try {
    await getValidToken(shopId);
  } catch (e) {
    const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
    fail(`shop id=${shopId} belum diotorisasi ke Shopee (belum ada access token tersimpan)`, [
      e instanceof Error ? e.message : String(e),
      '',
      'Cara mengotorisasi (harus lewat browser, bukan dari script ini):',
      '  1. Jalankan backend: npm run dev',
      '  2. Login ke frontend sebagai user role admin.',
      `  3. Buka: ${appUrl}/auth/shopee/authorize`,
      '     (route ini butuh session admin — akan redirect ke Shopee sandbox untuk consent,',
      '     lalu callback menyimpan access_token & refresh_token terenkripsi ke tabel shop.)',
      '  4. Jalankan ulang spike ini setelah otorisasi selesai.',
    ]);
  }

  return { shopId, shopName: shop.name, isSandbox };
}
