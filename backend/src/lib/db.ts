import pg from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import { getEnv } from './env.js';

/* node-postgres mengembalikan bigint (OID 20) sebagai string, padahal tipe
   Database di bawah mendeklarasikannya number. Tanpa parser ini runtime dan
   tipe berbeda: id '1' (string) tidak pernah sama dengan 1 (number), dan tsc
   tidak bisa menangkapnya karena tipenya sudah salah sejak deklarasi.

   Semua bigint di skema ini surrogate key kecil (id IDENTITY) atau partner_id
   Shopee 7 digit — jauh di bawah Number.MAX_SAFE_INTEGER. Id marketplace
   eksternal disimpan sebagai text, bukan bigint. Kalau suatu saat ada nilai di
   luar rentang aman, gagalkan keras daripada memotong angka diam-diam. */
pg.types.setTypeParser(pg.types.builtins.INT8, (value: string) => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`bigint ${value} di luar rentang aman JavaScript (Number.MAX_SAFE_INTEGER).`);
  }
  return parsed;
});

/* Masalah yang sama untuk kolom date (OID 1082). Default pg mengubahnya jadi
   objek Date tengah malam waktu lokal, lalu Fastify men-serialisasi ke ISO
   UTC — di GMT+7 '2026-07-26' berubah jadi '2026-07-25T17:00:00.000Z', mundur
   sehari. Tipe Database mendeklarasikan kolom ini string 'yyyy-MM-dd', dan
   itu memang yang dibutuhkan frontend (<input type="date"> hanya menerima
   format itu). Jadi biarkan apa adanya dari PostgreSQL.

   timestamptz (OID 1184: created_at, synced_at, ordered_at) TIDAK diubah —
   tipenya memang Date dan butuh komponen waktu. */
pg.types.setTypeParser(pg.types.builtins.DATE, (value: string) => value);

/* ============================================================
   Database types — generated from migration 001 schema.
   Add new tables/columns here when adding migrations.
   ============================================================ */

interface Shop {
  id: number;
  channel: string;
  external_shop_id: string;
  name: string;
  access_token_enc: Buffer | null;
  refresh_token_enc: Buffer | null;
  token_expires_at: Date | null;
  refresh_expires_at: Date | null;
  is_active: boolean;
  authorized_at: Date | null;
}

interface ShopeeCredential {
  id: number;
  shop_id: number;
  partner_id: number;
  partner_key_enc: Buffer;
  is_active: boolean;
}

interface ChannelCredential {
  id: number;
  shop_id: number;
  key: string;
  value: string;
  is_encrypted: boolean;
}

interface RawPayload {
  id: number;
  shop_id: number;
  resource: string;
  external_id: string;
  payload: unknown;
  payload_hash: string;
  fetched_at: Date;
  processed_at: Date | null;
}

interface SyncState {
  shop_id: number;
  resource: string;
  cursor_value: string | null;
  last_success_at: Date | null;
  last_error: string | null;
  last_error_at: Date | null;
  consecutive_failures: number;
}

interface SalesOrder {
  id: number;
  shop_id: number;
  external_order_id: string;
  channel_status: string;
  status: string;
  ordered_at: Date;
  report_date: string;
  paid_at: Date | null;
  completed_at: Date | null;
  cancelled_at: Date | null;
  gross_amount: string;
  buyer_ref: string | null;
  channel_updated_at: Date | null;
  synced_at: Date;
}

interface SalesOrderItem {
  id: number;
  order_id: number;
  external_item_id: string;
  external_variant_id: string | null;
  sku: string | null;
  product_name: string | null;
  qty: number;
  unit_price: string;
  discount: string;
  line_total: string;
}

interface Settlement {
  order_id: number;
  gross: string;
  commission_fee: string;
  service_fee: string;
  admin_fee: string;
  seller_voucher: string;
  platform_voucher: string;
  shipping_charged: string;
  shipping_subsidy: string;
  other_fee: string;
  other_fee_detail: unknown | null;
  net_payout: string;
  refund_amount: string;
  payout_date: string | null;
  is_released: boolean;
  synced_at: Date;
}

interface Product {
  id: number;
  shop_id: number;
  external_item_id: string;
  external_variant_id: string | null;
  sku: string | null;
  name: string;
  variant_name: string | null;
  price: string | null;
  stock: number | null;
  stock_type: string | null;
  listing_status: string | null;
  low_stock_threshold: number | null;
  channel_updated_at: Date | null;
  synced_at: Date;
}

interface StockSnapshot {
  id: number;
  shop_id: number;
  product_id: number;
  taken_on: string;
  stock: number;
}

interface AppUser {
  id: number;
  email: string;
  password_hash: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: Date;
}

interface UserSession {
  id: string;
  user_id: number;
  shop_id: number | null;
  created_at: Date;
  expires_at: Date;
}

interface ActivityLog {
  id: number;
  user_id: number | null;
  action: string;
  detail: unknown | null;
  ip: string | null;
  created_at: Date;
}

interface ApiCallLog {
  id: number;
  shop_id: number | null;
  path: string;
  http_status: number | null;
  error_code: string | null;
  duration_ms: number | null;
  called_at: Date;
}

interface ReconciliationCheck {
  id: number;
  shop_id: number;
  check_date: string;
  local_count: number;
  remote_count: number;
  is_match: boolean;
  detail: unknown | null;
  checked_at: Date;
}

interface MvDailySales {
  shop_id: number;
  report_date: string;
  order_count: number;
  gross_amount: string | null;
  net_payout: string | null;
  total_fee: string | null;
}

interface SubscriptionPlan {
  id: number;
  name: string;
  description: string | null;
  monthly_price: string;
  features: unknown;
  is_active: boolean;
  created_at: Date;
}

interface AppRole {
  id: number;
  name: string;
  label: string;
  features: unknown;
  is_system: boolean;
}

interface ShopSubscription {
  id: number;
  shop_id: number;
  plan_id: number;
  features: unknown | null;
  active_since: string;
  expires_at: string | null;
  is_trial: boolean;
}

/* Database schema — tambah tabel baru di sini */
interface Database {
  shop: Shop;
  shopee_credential: ShopeeCredential;
  channel_credential: ChannelCredential;
  raw_payload: RawPayload;
  sync_state: SyncState;
  sales_order: SalesOrder;
  sales_order_item: SalesOrderItem;
  settlement: Settlement;
  product: Product;
  stock_snapshot: StockSnapshot;
  app_user: AppUser;
  user_session: UserSession;
  activity_log: ActivityLog;
  api_call_log: ApiCallLog;
  reconciliation_check: ReconciliationCheck;
  mv_daily_sales: MvDailySales;
  subscription_plan: SubscriptionPlan;
  shop_subscription: ShopSubscription;
  app_role: AppRole;
}

let _db: Kysely<Database> | null = null;

export function getDb(): Kysely<Database> {
  if (!_db) {
    const pool = new pg.Pool({ connectionString: getEnv().DATABASE_URL });
    _db = new Kysely<Database>({
      dialect: new PostgresDialect({ pool }),
    });
  }
  return _db;
}

export async function closeDb(): Promise<void> {
  if (_db) {
    await _db.destroy();
    _db = null;
  }
}
