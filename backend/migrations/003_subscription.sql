-- ============================================================
-- Migration 003: Subscription & Feature Flags
-- Tiap shop punya plan → menentukan modul aktif.
-- ============================================================

CREATE TABLE subscription_plan (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          text NOT NULL,
  description   text,
  monthly_price numeric(18,2) NOT NULL DEFAULT 0,
  features      jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE shop_subscription (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id       bigint NOT NULL REFERENCES shop(id) ON DELETE CASCADE,
  plan_id       bigint NOT NULL REFERENCES subscription_plan(id),
  features      jsonb,
  active_since  date NOT NULL DEFAULT CURRENT_DATE,
  expires_at    date,
  is_trial      boolean NOT NULL DEFAULT false,
  UNIQUE (shop_id)
);

INSERT INTO subscription_plan (name, description, monthly_price, features) VALUES
  ('Data Viewer', 'Lihat data saja, tanpa export', 0, '["reader"]'),
  ('Sales', 'Modul penjualan + stok', 150000, '["reader","order","product"]'),
  ('Finance', 'Modul penjualan + keuangan + export', 300000, '["reader","order","finance","returns","export"]'),
  ('Full', 'Semua modul termasuk ERP', 500000, '["reader","order","finance","returns","product","media","category","warehouse","logistics","voucher","discount","export","account_health","erp"]'),
  ('Marketplace Pro', 'Full + promosi + iklan + fulfillment', 1000000, '["reader","order","finance","returns","product","media","category","warehouse","logistics","tiered_wh","fbs","firstmile","voucher","discount","bundle","addon","flashsale","toppicks","livestream","video","ads","ams","export","account_health","global_product","erp"]'),
  ('Trial', '7 hari gratis semua modul', 0, '["reader","order","finance","returns","product","media","category","warehouse","logistics","tiered_wh","fbs","firstmile","voucher","discount","bundle","addon","flashsale","toppicks","livestream","video","ads","ams","export","account_health","global_product","erp"]');
