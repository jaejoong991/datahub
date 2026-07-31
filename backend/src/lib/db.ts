import pg from 'pg';
import { Kysely, PostgresDialect, type Generated, type ColumnType } from 'kysely';
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

/* Kolom `date` yang di beberapa call site diisi objek JS Date langsung
   (bukan string 'yyyy-MM-dd') — driver pg tetap menerimanya (di-serialize lalu
   di-cast Postgres ke date), tapi hasil SELECT selalu string mentah karena
   parser DATE custom di atas. Insert/update boleh terima keduanya; Select
   tetap string supaya konsisten dengan kolom date lain & kontrak frontend. */
type FlexDate = ColumnType<string, string | Date | undefined, string | Date>;
type FlexDateNullable = ColumnType<string | null, string | Date | null, string | Date | null>;

interface Shop {
  id: Generated<number>;
  channel: string;
  external_shop_id: string;
  name: string;
  access_token_enc: Buffer | null;
  refresh_token_enc: Buffer | null;
  token_expires_at: Date | null;
  refresh_expires_at: Date | null;
  is_active: Generated<boolean>;
  authorized_at: Date | null;
}

interface ChannelCredential {
  id: Generated<number>;
  shop_id: number;
  key: string;
  value: string;
  is_encrypted: Generated<boolean>;
}

interface RawPayload {
  id: Generated<number>;
  shop_id: number;
  resource: string;
  external_id: string;
  payload: unknown;
  payload_hash: string;
  fetched_at: Generated<Date>;
  processed_at: Date | null;
}

interface SyncState {
  shop_id: number;
  resource: string;
  cursor_value: string | null;
  last_success_at: Date | null;
  last_error: string | null;
  last_error_at: Date | null;
  consecutive_failures: Generated<number>;
}

interface SalesOrder {
  id: Generated<number>;
  shop_id: number;
  external_order_id: string;
  channel_status: string;
  status: string;
  ordered_at: Date;
  report_date: string;
  paid_at: Date | null;
  completed_at: Date | null;
  cancelled_at: Date | null;
  gross_amount: Generated<string>;
  buyer_ref: string | null;
  channel_updated_at: Date | null;
  synced_at: Generated<Date>;
}

interface SalesOrderItem {
  id: Generated<number>;
  order_id: number;
  external_item_id: string;
  external_variant_id: string | null;
  sku: string | null;
  product_name: string | null;
  qty: number;
  unit_price: string;
  discount: Generated<string>;
  line_total: string;
}

interface Settlement {
  order_id: number;
  gross: Generated<string>;
  commission_fee: Generated<string>;
  service_fee: Generated<string>;
  admin_fee: Generated<string>;
  seller_voucher: Generated<string>;
  platform_voucher: Generated<string>;
  shipping_charged: Generated<string>;
  shipping_subsidy: Generated<string>;
  other_fee: Generated<string>;
  other_fee_detail: unknown | null;
  net_payout: Generated<string>;
  refund_amount: Generated<string>;
  payout_date: string | null;
  is_released: Generated<boolean>;
  synced_at: Generated<Date>;
}

interface Product {
  id: Generated<number>;
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
  synced_at: Generated<Date>;
}

interface StockSnapshot {
  id: Generated<number>;
  shop_id: number;
  product_id: number;
  taken_on: string;
  stock: number;
}

interface AppUser {
  id: Generated<number>;
  email: string;
  password_hash: string;
  full_name: string;
  role: string;
  is_active: Generated<boolean>;
  created_at: Generated<Date>;
}

interface UserSession {
  id: string;
  user_id: number;
  shop_id: number | null;
  created_at: Generated<Date>;
  expires_at: Date;
}

interface ActivityLog {
  id: Generated<number>;
  user_id: number | null;
  action: string;
  detail: unknown | null;
  ip: string | null;
  created_at: Generated<Date>;
}

interface ApiCallLog {
  id: Generated<number>;
  shop_id: number | null;
  path: string;
  http_status: number | null;
  error_code: string | null;
  duration_ms: number | null;
  called_at: Generated<Date>;
}

interface ReconciliationCheck {
  id: Generated<number>;
  shop_id: number;
  check_date: string;
  local_count: number;
  remote_count: number;
  is_match: boolean;
  detail: unknown | null;
  checked_at: Generated<Date>;
}

/* Materialized view — tidak pernah di-INSERT/UPDATE lewat Kysely, jadi tidak
   perlu Generated (REFRESH MATERIALIZED VIEW dilakukan lewat SQL mentah). */
interface MvDailySales {
  shop_id: number;
  report_date: string;
  order_count: number;
  gross_amount: string | null;
  net_payout: string | null;
  total_fee: string | null;
}

interface SubscriptionPlan {
  id: Generated<number>;
  name: string;
  description: string | null;
  monthly_price: Generated<string>;
  features: Generated<unknown>;
  is_active: Generated<boolean>;
  created_at: Generated<Date>;
}

interface AppRole {
  id: Generated<number>;
  name: string;
  label: string;
  features: Generated<unknown>;
  is_system: Generated<boolean>;
}

interface ShopSubscription {
  id: Generated<number>;
  shop_id: number;
  plan_id: number;
  features: unknown | null;
  active_since: FlexDate;
  expires_at: FlexDateNullable;
  is_trial: Generated<boolean>;
}

/* Database schema — tambah tabel baru di sini */
interface Database {
  shop: Shop;
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
