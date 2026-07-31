-- ============================================================
-- Ecommerce Data Hub — Migration 001: Initial Schema
-- Tech Spec 4.2
-- ============================================================

-- ============ Koneksi kanal ============
CREATE TABLE shop (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  channel         text NOT NULL CHECK (channel IN ('shopee')),
  external_shop_id text NOT NULL,
  name            text NOT NULL,
  access_token_enc  bytea,
  refresh_token_enc bytea,
  token_expires_at  timestamptz,
  refresh_expires_at timestamptz,
  is_active       boolean NOT NULL DEFAULT true,
  authorized_at   timestamptz,
  UNIQUE (channel, external_shop_id)
);

CREATE TABLE shopee_credential (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id         bigint NOT NULL REFERENCES shop(id) ON DELETE CASCADE,
  partner_id      bigint NOT NULL,
  partner_key_enc bytea NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  UNIQUE (shop_id)
);

-- ============ Penyimpanan mentah ============
CREATE TABLE raw_payload (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id      bigint NOT NULL REFERENCES shop(id),
  resource     text   NOT NULL,
  external_id  text   NOT NULL,
  payload      jsonb  NOT NULL,
  payload_hash text   NOT NULL,
  fetched_at   timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (shop_id, resource, external_id, payload_hash)
);
CREATE INDEX ON raw_payload (shop_id, resource, processed_at)
  WHERE processed_at IS NULL;

-- ============ Status sinkronisasi ============
CREATE TABLE sync_state (
  shop_id       bigint NOT NULL REFERENCES shop(id),
  resource      text   NOT NULL,
  cursor_value  text,
  last_success_at timestamptz,
  last_error    text,
  last_error_at timestamptz,
  consecutive_failures int NOT NULL DEFAULT 0,
  PRIMARY KEY (shop_id, resource)
);

-- ============ Order ============
CREATE TABLE sales_order (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id        bigint NOT NULL REFERENCES shop(id),
  external_order_id text NOT NULL,
  channel_status text NOT NULL,
  status         text NOT NULL,
  ordered_at     timestamptz NOT NULL,
  report_date    date NOT NULL,
  paid_at        timestamptz,
  completed_at   timestamptz,
  cancelled_at   timestamptz,
  gross_amount   numeric(18,2) NOT NULL DEFAULT 0,
  buyer_ref      text,
  channel_updated_at timestamptz,
  synced_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, external_order_id)
);
CREATE INDEX ON sales_order (shop_id, report_date);
CREATE INDEX ON sales_order (shop_id, status);

CREATE TABLE sales_order_item (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id      bigint NOT NULL REFERENCES sales_order(id) ON DELETE CASCADE,
  external_item_id text NOT NULL,
  external_variant_id text,
  sku           text,
  product_name  text,
  qty           integer NOT NULL,
  unit_price    numeric(18,2) NOT NULL,
  discount      numeric(18,2) NOT NULL DEFAULT 0,
  line_total    numeric(18,2) NOT NULL,
  UNIQUE (order_id, external_item_id, external_variant_id)
);
CREATE INDEX ON sales_order_item (sku);

-- ============ Keuangan ============
CREATE TABLE settlement (
  order_id         bigint PRIMARY KEY REFERENCES sales_order(id) ON DELETE CASCADE,
  gross            numeric(18,2) NOT NULL DEFAULT 0,
  commission_fee   numeric(18,2) NOT NULL DEFAULT 0,
  service_fee      numeric(18,2) NOT NULL DEFAULT 0,
  admin_fee        numeric(18,2) NOT NULL DEFAULT 0,
  seller_voucher   numeric(18,2) NOT NULL DEFAULT 0,
  platform_voucher numeric(18,2) NOT NULL DEFAULT 0,
  shipping_charged numeric(18,2) NOT NULL DEFAULT 0,
  shipping_subsidy numeric(18,2) NOT NULL DEFAULT 0,
  other_fee        numeric(18,2) NOT NULL DEFAULT 0,
  other_fee_detail jsonb,
  net_payout       numeric(18,2) NOT NULL DEFAULT 0,
  refund_amount    numeric(18,2) NOT NULL DEFAULT 0,
  payout_date      date,
  is_released      boolean NOT NULL DEFAULT false,
  synced_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON settlement (payout_date);

-- ============ Produk & stok ============
CREATE TABLE product (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id       bigint NOT NULL REFERENCES shop(id),
  external_item_id text NOT NULL,
  external_variant_id text,
  sku           text,
  name          text NOT NULL,
  variant_name  text,
  price         numeric(18,2),
  stock         integer,
  stock_type    text,
  listing_status text,
  low_stock_threshold integer,
  channel_updated_at timestamptz,
  synced_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, external_item_id, external_variant_id)
);

CREATE TABLE stock_snapshot (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id    bigint NOT NULL REFERENCES shop(id),
  product_id bigint NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  taken_on   date   NOT NULL,
  stock      integer NOT NULL,
  UNIQUE (product_id, taken_on)
);

-- ============ Pengguna & akses ============
CREATE TABLE app_user (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name     text NOT NULL,
  role          text NOT NULL CHECK (role IN ('sales','finance','warehouse','admin')),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_session (
  id            text PRIMARY KEY,
  user_id       bigint NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  shop_id       bigint REFERENCES shop(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL
);
CREATE INDEX ON user_session (expires_at);

CREATE TABLE activity_log (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    bigint REFERENCES app_user(id),
  action     text NOT NULL,
  detail     jsonb,
  ip         inet,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON activity_log (created_at DESC);
CREATE INDEX ON activity_log (user_id, created_at DESC);

-- ============ Operasional ============
CREATE TABLE api_call_log (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id     bigint REFERENCES shop(id),
  path        text NOT NULL,
  http_status integer,
  error_code  text,
  duration_ms integer,
  called_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reconciliation_check (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id      bigint NOT NULL REFERENCES shop(id),
  check_date   date   NOT NULL,
  local_count  integer NOT NULL,
  remote_count integer NOT NULL,
  is_match     boolean NOT NULL,
  detail       jsonb,
  checked_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON reconciliation_check (shop_id, check_date DESC);

-- ============ ERP (Fase 6) ============
CREATE TABLE erp_sku_map (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id     bigint NOT NULL REFERENCES shop(id),
  sku         text   NOT NULL,
  erp_product_value text NOT NULL,
  UNIQUE (shop_id, sku)
);

CREATE TABLE erp_batch (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id       bigint NOT NULL REFERENCES shop(id),
  reference     text NOT NULL UNIQUE,
  period_date   date NOT NULL,
  status        text NOT NULL CHECK (status IN ('draft','blocked','sent','completed','failed')),
  row_count     integer,
  total_amount  numeric(18,2),
  blocked_reason jsonb,
  sent_at       timestamptz,
  confirmed_at  timestamptz,
  UNIQUE (shop_id, period_date)
);

-- ============ Materialized views ============
CREATE MATERIALIZED VIEW mv_daily_sales AS
SELECT o.shop_id, o.report_date,
       count(*)                        AS order_count,
       sum(o.gross_amount)             AS gross_amount,
       sum(s.net_payout)               AS net_payout,
       sum(s.commission_fee + s.service_fee + s.admin_fee) AS total_fee
FROM sales_order o
LEFT JOIN settlement s ON s.order_id = o.id
WHERE o.status <> 'cancelled'
GROUP BY 1, 2;

CREATE UNIQUE INDEX ON mv_daily_sales (shop_id, report_date);
