-- ============================================================
-- Migration 002: Channel credentials → DB (bukan env vars)
-- One row per (shop_id, key) — unlimited multi-channel.
-- ============================================================

DROP TABLE IF EXISTS shopee_credential;

CREATE TABLE channel_credential (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id      bigint NOT NULL REFERENCES shop(id) ON DELETE CASCADE,
  key          text NOT NULL,
  value        text NOT NULL,
  is_encrypted boolean NOT NULL DEFAULT false,
  UNIQUE (shop_id, key)
);

ALTER TABLE shop DROP CONSTRAINT IF EXISTS shop_channel_check;
ALTER TABLE shop ADD CONSTRAINT shop_channel_check
  CHECK (channel IN ('shopee', 'tokopedia', 'lazada', 'tiktok'));
