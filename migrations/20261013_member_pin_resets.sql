-- Run on the POPA Neon database after approval, before enabling PIN recovery.
CREATE TABLE IF NOT EXISTS member_pin_resets (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS member_pin_resets_phone_created_idx ON member_pin_resets(phone, created_at DESC);
