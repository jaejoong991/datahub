-- Role management — admin bikin custom role + pilih fitur
CREATE TABLE IF NOT EXISTS app_role (
  id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name     text NOT NULL UNIQUE,
  label    text NOT NULL,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_system boolean NOT NULL DEFAULT false
);

INSERT INTO app_role (name, label, features, is_system) VALUES
  ('sales',     'Sales',     '["order","product"]', true),
  ('finance',   'Finance',   '["order","finance","returns","export"]', true),
  ('warehouse', 'Gudang',    '["product","warehouse","logistics"]', true),
  ('admin',     'Admin',     '["reader","order","finance","returns","product","media","category","warehouse","logistics","tiered_wh","fbs","firstmile","voucher","discount","bundle","addon","flashsale","toppicks","livestream","video","ads","ams","export","account_health","global_product","erp"]', true)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE app_user DROP CONSTRAINT IF EXISTS app_user_role_check;

UPDATE app_user SET role = 'admin' WHERE role NOT IN ('admin','sales','finance','warehouse');
