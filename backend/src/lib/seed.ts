import { getDb } from './db.js';
import { hashPassword, encryptToken } from './crypto.js';
import { logInfo } from './logger.js';

export async function runSeed() {
  const db = getDb();

  const existing = await db.selectFrom('app_user').selectAll().execute();
  if (existing.length > 0) {
    logInfo('Seed skipped — data already exists');
    return;
  }

  const pw = await hashPassword('admin123');

  await db.insertInto('app_user').values([
    { email: 'admin@toko.id', password_hash: pw, full_name: 'Dewi Lestari', role: 'admin', is_active: true },
    { email: 'rina@toko.id', password_hash: pw, full_name: 'Rina Ardiani', role: 'finance', is_active: true },
    { email: 'dimas@toko.id', password_hash: pw, full_name: 'Dimas Prakoso', role: 'sales', is_active: true },
    { email: 'agus@toko.id', password_hash: pw, full_name: 'Agus Wijaya', role: 'warehouse', is_active: true },
    { email: 'sari@toko.id', password_hash: pw, full_name: 'Sari Utami', role: 'finance', is_active: false },
  ] as any).execute();

  // Shop 1: Shopee
  await db.insertInto('shop').values({
    channel: 'shopee', external_shop_id: 'shop-001', name: 'Toko Nusantara', is_active: true, authorized_at: new Date('2026-06-01'),
  } as any).execute();

  // Shop 2: Tokopedia (dummy — credential kosong, untuk demo multi-channel)
  await db.insertInto('shop').values({
    channel: 'tokopedia', external_shop_id: 'tp-001', name: 'Toko Nusantara — Tokped', is_active: true,
  } as any).execute();

  for (const resource of ['order', 'settlement', 'product', 'stock_snapshot']) {
    await db.insertInto('sync_state').values({
      shop_id: 1, resource, cursor_value: null, last_success_at: null,
      last_error: null, last_error_at: null, consecutive_failures: 0,
    }).execute();
  }

  // Bootstrap credential dari env vars (opsional — sisanya via admin UI)
  const partnerId = process.env.SHOPEE_PARTNER_ID;
  const partnerKey = process.env.SHOPEE_PARTNER_KEY;
  if (partnerId && partnerKey) {
    const sandbox = process.env.SHOPEE_SANDBOX !== 'false';
    const encKey = (await encryptToken(partnerKey)).toString('hex');
    await db.insertInto('channel_credential').values([
      { shop_id: 1, key: 'partner_id', value: partnerId, is_encrypted: false },
      { shop_id: 1, key: 'partner_key', value: encKey, is_encrypted: true },
      { shop_id: 1, key: 'sandbox', value: sandbox ? 'true' : 'false', is_encrypted: false },
    ] as any).execute();
    logInfo('Seed: shopee credentials from env → DB');
  }

  // Assign subscription — shop 1 = Full, shop 2 = Data Viewer (demo)
  const plans = await db.selectFrom('subscription_plan')
    .select(['id', 'name']).execute();
  const planMap = Object.fromEntries(plans.map((p) => [p.name, p.id]));
  if (planMap.Full) {
    await db.insertInto('shop_subscription').values({
      shop_id: 1, plan_id: planMap.Full, active_since: new Date('2026-06-01'),
    } as any).execute();
  }
  if (planMap['Data Viewer'] && planMap.Full) {
    // Shop 2 trial — Data Viewer plan dulu
    await db.insertInto('shop_subscription').values({
      shop_id: 2, plan_id: planMap['Data Viewer'], active_since: new Date(), is_trial: true,
    } as any).execute();
    logInfo('Seed: shop 2 = Data Viewer, shop 1 = Full');
  }

  logInfo('Seed: 5 users, 2 shops, subscriptions');
}

const mainUrl2 = process.argv[1];
if (mainUrl2 && (mainUrl2.includes('seed') || mainUrl2.endsWith('/seed.ts') || mainUrl2.endsWith('\\seed.ts'))) {
  runSeed().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
