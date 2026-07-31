import { getShopeeSDK } from './client.js';
import { logInfo } from '../lib/logger.js';

export const getAuthorizationUrl = (shopId: number, redirectUri: string) =>
  getShopeeSDK(shopId).then(s => s.getAuthorizationUrl(redirectUri));

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

export async function forceReauthorize(shopId: number): Promise<string> {
  const sdk = await getShopeeSDK(shopId);
  (sdk as any).tokenStorage?.clear();
  const url = `${process.env.CORS_ORIGIN ?? 'http://localhost:5173'}/auth/shopee/callback`;
  return getAuthorizationUrl(shopId, url);
}
