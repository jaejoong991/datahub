import { getShopeeSDK } from './client.js';
import { logInfo } from '../lib/logger.js';

export const getAuthorizationUrl = (shopId: number, redirectUri: string, state?: string) =>
  getShopeeSDK(shopId).then(s => s.getAuthorizationUrl(redirectUri, state ? { state } : undefined));

export async function exchangeCodeForTokens(shopId: number, code: string): Promise<void> {
  const sdk = await getShopeeSDK(shopId);
  await sdk.authenticateWithCode(code, shopId);
  logInfo(`Shopee tokens stored for shop ${shopId}`);
}

export async function getValidToken(shopId: number): Promise<string> {
  const sdk = await getShopeeSDK(shopId);
  const token = await sdk.getAuthToken();
  if (!token) throw new Error(`Shop ${shopId} not authorized.`);
  return token.access_token;
}

/* Hapus token tersimpan supaya shop harus otorisasi ulang. Sengaja TIDAK bikin
   URL otorisasi di sini: URL + cookie state CSRF dibangun di layer HTTP
   (routes/auth.ts) supaya /authorize dan /reauthorize lewat jalur yang sama —
   kalau tidak, callback menolak flow ini karena state-nya tidak pernah di-set. */
export async function clearShopTokens(shopId: number): Promise<void> {
  const sdk = await getShopeeSDK(shopId);
  await (sdk as any).tokenStorage?.clear();
  logInfo(`Shopee tokens cleared for shop ${shopId}`);
}
