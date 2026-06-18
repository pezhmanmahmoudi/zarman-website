-- ============================================================
-- Migration 01: Add account tracking columns to ledger
-- Purpose:
--   1. entry_type  — trade | expense | owner_loan | adjustment | transfer
--   2. payer_account   — who sent the money / asset
--   3. receiver_account — who received the money / asset
--
-- All three columns are additive (ADD COLUMN IF NOT EXISTS).
-- Existing rows are backfilled with correct business defaults.
-- All existing queries continue working without changes.
--
-- IMPORTANT:
--   'transfer' entries MUST be excluded from all profit,
--   inventory, and P&L calculations. They are structural
--   balance-sheet movements between internal accounts only.
-- ============================================================

-- ── 1. Add entry_type ─────────────────────────────────────────────────────
ALTER TABLE ledger
  ADD COLUMN IF NOT EXISTS entry_type text
    DEFAULT 'trade'
    CHECK (entry_type IN ('trade', 'expense', 'owner_loan', 'adjustment', 'transfer'));

-- ── 2. Add payer_account ──────────────────────────────────────────────────
--   'external' covers customer-facing counterparties (e.g. end-customers
--    who send AUD via PayID). Never used for internal P&L attribution.
ALTER TABLE ledger
  ADD COLUMN IF NOT EXISTS payer_account text
    DEFAULT 'kadoos'
    CHECK (payer_account IN ('zarman', 'kadoos', 'pezhman', 'external'));

-- ── 3. Add receiver_account ───────────────────────────────────────────────
ALTER TABLE ledger
  ADD COLUMN IF NOT EXISTS receiver_account text
    DEFAULT 'zarman'
    CHECK (receiver_account IN ('zarman', 'kadoos', 'pezhman', 'external'));

-- ── 4. Backfill existing trade rows ───────────────────────────────────────
--   All existing rows are buy_aud or sell_aud trades.
--   buy_aud:  Kadoos pays IRT → Zarman receives AUD
--   sell_aud: Zarman pays AUD → Kadoos receives IRT

UPDATE ledger
  SET entry_type = 'trade'
  WHERE entry_type IS NULL;

UPDATE ledger
  SET payer_account = 'kadoos',
      receiver_account = 'zarman'
  WHERE type = 'buy_aud'
    AND payer_account IS NULL;

UPDATE ledger
  SET payer_account = 'zarman',
      receiver_account = 'kadoos'
  WHERE type = 'sell_aud'
    AND receiver_account IS NULL;

-- ── 5. Indexes for common query patterns ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ledger_entry_type
  ON ledger (entry_type);

CREATE INDEX IF NOT EXISTS idx_ledger_payer_account
  ON ledger (payer_account);

CREATE INDEX IF NOT EXISTS idx_ledger_receiver_account
  ON ledger (receiver_account);

-- ── 6. Composite index for treasury engine queries ────────────────────────
--   Supports: WHERE entry_type = 'trade' AND type IN ('buy_aud','sell_aud')
--   ordered by date for Moving WAC sequential processing
CREATE INDEX IF NOT EXISTS idx_ledger_trade_date
  ON ledger (entry_type, type, date_gregorian ASC, created_at ASC)
  WHERE entry_type = 'trade';
