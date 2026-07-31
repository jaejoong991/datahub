import ShopeeSDK from '../../vendor/shopee-sdk/lib/sdk.js';
import type { TokenStorage } from '../../vendor/shopee-sdk/lib/storage/token-storage.interface.js';
import type { AccessToken } from '../../vendor/shopee-sdk/lib/schemas/access-token.js';
import { getShopCredentials } from './config.js';
import { getDb } from '../lib/db.js';
import { encryptToken, decryptToken } from '../lib/crypto.js';
import { logInfo } from '../lib/logger.js';

const clients = new Map<number, ShopeeSDK>();
// tokenStores paralel ke `clients`, kunci sama — supaya clearShopTokenStore()
// bisa panggil DbTokenStore.clear() langsung tanpa menembus field private
// `tokenStorage` milik ShopeeSDK (yang sebelumnya butuh `as any`).
const tokenStores = new Map<number, DbTokenStore>();

export async function getShopeeSDK(shopId: number): Promise<ShopeeSDK> {
  if (!clients.has(shopId)) {
    const cred = await getShopCredentials(shopId);
    const tokenStore = new DbTokenStore(shopId);
    const sdk = new ShopeeSDK(
      { partner_id: cred.partnerId, partner_key: cred.partnerKey, shop_id: shopId },
      tokenStore,
    );
    clients.set(shopId, sdk);
    tokenStores.set(shopId, tokenStore);
  }
  return clients.get(shopId)!;
}

/* Hapus token tersimpan lewat DbTokenStore langsung. ShopeeSDK tidak
   mengekspos API publik untuk clear token, dan `tokenStorage` di dalamnya
   private — jadi kita pertahankan instance store kita sendiri di sini. */
export async function clearShopTokenStore(shopId: number): Promise<void> {
  await getShopeeSDK(shopId); // pastikan store untuk shop ini sudah ada
  await tokenStores.get(shopId)?.clear();
}

class DbTokenStore implements TokenStorage {
  constructor(private shopId: number) {}

  async get(): Promise<AccessToken | null> {
    const shop = await getDb().selectFrom('shop')
      .select(['access_token_enc','refresh_token_enc','token_expires_at','refresh_expires_at'])
      .where('id','=',this.shopId).executeTakeFirst();
    if (!shop?.access_token_enc || !shop?.refresh_token_enc) return null;
    return {
      access_token: decryptToken(shop.access_token_enc),
      refresh_token: decryptToken(shop.refresh_token_enc),
      expire_in: 14400,
      request_id: '', error: '', message: '',
    };
  }

  async store(t: AccessToken): Promise<void> {
    const expAt = t.expired_at ? new Date(t.expired_at * 1000) : new Date(Date.now() + (t.expire_in ?? 14400) * 1000);
    await getDb().updateTable('shop').set({
      access_token_enc: encryptToken(t.access_token),
      refresh_token_enc: encryptToken(t.refresh_token),
      token_expires_at: expAt,
      refresh_expires_at: new Date(Date.now() + 30 * 86400_000),
    }).where('id','=',this.shopId).execute();
    logInfo(`SDK token stored for shop ${this.shopId}`);
  }

  async clear(): Promise<void> {
    await getDb().updateTable('shop').set({
      access_token_enc:null, refresh_token_enc:null,
      token_expires_at:null, refresh_expires_at:null,
    }).where('id','=',this.shopId).execute();
  }
}

export default ShopeeSDK;
