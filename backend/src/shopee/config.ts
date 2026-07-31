import { getDb } from '../lib/db.js';
import { decryptToken } from '../lib/crypto.js';

/* Shopee config — credential dari DB, bukan env vars.
   Multi-channel ready: beda shop = beda credential. */

export const SANDBOX_HOST = 'https://partner.test-stable.shopeemobile.com';
export const PROD_HOST    = 'https://partner.shopeemobile.com';

export function apiPath(path: string): string { return `/api/v2${path}`; }

interface Credentials {
  partnerId: number;
  partnerKey: string;
  isSandbox: boolean;
}

export async function getShopCredentials(shopId: number): Promise<Credentials> {
  const rows = await getDb()
    .selectFrom('channel_credential')
    .select(['key', 'value', 'is_encrypted'])
    .where('shop_id', '=', shopId)
    .execute();

  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key] = r.is_encrypted ? decryptToken(Buffer.from(r.value, 'hex')) : r.value;
  }

  if (!map.partner_id || !map.partner_key) {
    throw new Error(`Shop ${shopId}: partner_id/partner_key missing in channel_credential.`);
  }

  return {
    partnerId: Number(map.partner_id),
    partnerKey: map.partner_key,
    isSandbox: map.sandbox !== 'false',
  };
}

export async function getShopeeHost(shopId: number): Promise<string> {
  const cred = await getShopCredentials(shopId);
  return cred.isSandbox ? SANDBOX_HOST : PROD_HOST;
}
