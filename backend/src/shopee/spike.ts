/**
 * Spike API (Fase 0.5) — test endpoints via Shopee SDK di sandbox.
 * Jalankan: npx tsx src/shopee/spike.ts
 */
import { getShopeeSDK } from './client.js';
import { ItemStatus } from '../../vendor/shopee-sdk/lib/schemas/product.js';

export {}; // make module for top-level await

const shopId = Number(process.env.SHOPEE_SHOP_ID);
if (!shopId) { console.error('SHOPEE_SHOP_ID required'); process.exit(1); }

const sdk = await getShopeeSDK(shopId);

const results: { module: string; status: 'ok'|'fail'; detail: string }[] = [];
async function t(mod: string, fn: () => Promise<any>, label: string) {
  try { await fn(); results.push({ module: mod, status: 'ok', detail: `${label} OK` }); }
  catch (e: any) { results.push({ module: mod, status: 'fail', detail: `${label}: ${e.message}` }); }
}

await t('Order', () => sdk.order.getOrderList({
  time_range_field: 'create_time',
  time_from: Math.floor(Date.now()/1000)-86400*7,
  time_to: Math.floor(Date.now()/1000),
  page_size: 5,
}), 'Order list');

await t('Product', () => sdk.product.getItemList({ offset: 0, page_size: 5, item_status: [ItemStatus.NORMAL] }), 'Product list');

await t('Shop', () => sdk.shop.getShopInfo(), 'Shop info');

await t('Payment', () => sdk.payment.getEscrowList({
  page_size: 5,
  release_time_from: Math.floor(Date.now()/1000)-86400*30,
  release_time_to: Math.floor(Date.now()/1000),
}), 'Escrow list');

console.log('\n=== Spike Results ===');
for (const r of results) {
  console.log(` ${r.status === 'ok' ? '✅' : '❌'} ${r.module}: ${r.detail}`);
}
