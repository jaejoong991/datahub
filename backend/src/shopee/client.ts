import ShopeeSDK from '../../vendor/shopee-sdk/lib/sdk.js';
import { getShopCredentials } from './config.js';
import { getDb } from '../lib/db.js';
import { encryptToken, decryptToken } from '../lib/crypto.js';
import { logInfo } from '../lib/logger.js';

const clients = new Map<number, ShopeeSDK>();

export async function getShopeeSDK(shopId: number): Promise<ShopeeSDK> {
  if (!clients.has(shopId)) {
    const cred = await getShopCredentials(shopId);
    const sdk = new ShopeeSDK(
      { partner_id: cred.partnerId, partner_key: cred.partnerKey, shop_id: shopId },
      new DbTokenStore(shopId),
    );
    clients.set(shopId, sdk);
  }
  return clients.get(shopId)!;
}

class DbTokenStore {
  constructor(private shopId: number) {}

  async get() {
    const shop = await getDb().selectFrom('shop')
      .select(['access_token_enc','refresh_token_enc','token_expires_at','refresh_expires_at'])
      .where('id','=',this.shopId).executeTakeFirst();
    if (!shop?.access_token_enc || !shop?.refresh_token_enc) return null;
    return {
      access_token: decryptToken(shop.access_token_enc),
      refresh_token: decryptToken(shop.refresh_token_enc),
      expire_in: 14400,
      request_id: '', error: '', message: '',
    } as any;
  }

  async store(t: any) {
    const expAt = t.expired_at ? new Date(t.expired_at * 1000) : new Date(Date.now() + (t.expire_in ?? 14400) * 1000);
    await getDb().updateTable('shop').set({
      access_token_enc: encryptToken(t.access_token),
      refresh_token_enc: encryptToken(t.refresh_token),
      token_expires_at: expAt,
      refresh_expires_at: new Date(Date.now() + 30 * 86400_000),
    } as any).where('id','=',this.shopId).execute();
    logInfo(`SDK token stored for shop ${this.shopId}`);
  }

  async clear() {
    await getDb().updateTable('shop').set({
      access_token_enc:null, refresh_token_enc:null,
      token_expires_at:null, refresh_expires_at:null,
    } as any).where('id','=',this.shopId).execute();
  }
}

export default ShopeeSDK;
