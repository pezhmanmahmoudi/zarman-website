-- ============================================================
-- Migration 06: Historical Exchange Rates + Exposure Target
-- ============================================================
--
-- PROBLEM FIXED:
--   Without a stored exchange_rate on each row, AUD-denominated
--   owner loans and expenses were converted using the CURRENT
--   market rate at query time. This is incorrect accounting:
--
--     A loan made when rate = 42,000 must always be valued at
--     42,000 × amount, not at today's 54,000 × amount.
--
--   Historical rate inconsistency causes:
--     - Phantom P&L changes from rate movements alone
--     - Incorrect loan balance reporting
--     - Audit trail that cannot reproduce historical figures
--
-- SOLUTION:
--   1. Add exchange_rate to owner_loans — stored at injection time.
--   2. Add exchange_rate to expenses — stored at payment/accrual time.
--   3. Add target_exposure_ratio to treasury_settings — configurable
--      ideal AUD exposure fraction (replaces hardcoded 0.50).
--
-- BACKFILL STRATEGY:
--   Rows with currency = 'IRT' always have exchange_rate = NULL
--   (no conversion needed; IRT amount is used directly).
--
--   Rows with currency = 'AUD' and exchange_rate = NULL will be
--   detected by the Accounting Engine and added to
--   accountingWarnings[], ensuring no silent data gaps.
--
-- ============================================================

-- ── 1. owner_loans: add exchange_rate ────────────────────────────────────
--
--   Stores the IRT/AUD rate that was prevailing when this loan
--   was originally made or repaid.
--
--   USAGE:
--     IF currency = 'AUD' AND exchange_rate IS NOT NULL:
--       irt_equivalent = amount * exchange_rate
--     IF currency = 'AUD' AND exchange_rate IS NULL:
--       → emit warning, fall back to current rate
--     IF currency = 'IRT':
--       irt_equivalent = amount (no conversion needed)

ALTER TABLE owner_loans
  ADD COLUMN IF NOT EXISTS exchange_rate numeric(15, 2) NULL
    CHECK (exchange_rate IS NULL OR exchange_rate > 0);

COMMENT ON COLUMN owner_loans.exchange_rate IS
  'IRT/AUD rate at time of loan creation/repayment. NULL for IRT-denominated rows (no conversion needed). AUD rows without this value will trigger an accounting warning.';

-- ── 2. expenses: add exchange_rate ───────────────────────────────────────
--
--   Stores the IRT/AUD rate prevailing when this expense was incurred.
--   AUD expenses without a historical rate will fall back to current
--   rate but will emit an accounting warning.

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS exchange_rate numeric(15, 2) NULL
    CHECK (exchange_rate IS NULL OR exchange_rate > 0);

COMMENT ON COLUMN expenses.exchange_rate IS
  'IRT/AUD rate at time expense was incurred. NULL for IRT-denominated expenses (no conversion needed). AUD expenses without this value will trigger an accounting warning.';

-- ── 3. treasury_settings: add target_exposure_ratio ──────────────────────
--
--   The ideal fraction of total assets held in AUD (0–1).
--   Used by Strategy Engine for exposure health score:
--     Score = 100 at target, 0 at max_aud_exposure and at 0.
--
--   Default: 0.50 (50% AUD, 50% IRT) — balanced portfolio.
--   Operators may change this based on business model and risk appetite.
--   e.g., a more conservative operation might set this to 0.40 (60% IRT).

ALTER TABLE treasury_settings
  ADD COLUMN IF NOT EXISTS target_exposure_ratio numeric(5, 4) NOT NULL DEFAULT 0.5000
    CHECK (target_exposure_ratio > 0 AND target_exposure_ratio < 1);

COMMENT ON COLUMN treasury_settings.target_exposure_ratio IS
  'Ideal fraction of total assets held in AUD (0–1). Exposure health score peaks at this value. Default 0.50 = balanced 50/50 portfolio. Must be less than max_aud_exposure.';

-- Seed the value into the existing singleton row
UPDATE treasury_settings
  SET target_exposure_ratio = 0.5000
  WHERE id = 1 AND target_exposure_ratio IS NULL;

-- ── 4. Constraint: target must be less than max ───────────────────────────
--   Cannot have a target exposure above the maximum allowed exposure.
ALTER TABLE treasury_settings
  DROP CONSTRAINT IF EXISTS chk_exposure_target_lt_max;

ALTER TABLE treasury_settings
  ADD CONSTRAINT chk_exposure_target_lt_max
    CHECK (target_exposure_ratio < max_aud_exposure);
