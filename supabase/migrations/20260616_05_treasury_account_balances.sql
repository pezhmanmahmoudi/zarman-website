-- ============================================================
-- Migration 05: Add account balance columns to treasury_settings
-- Purpose:
--   Kadoos and Pezhman IRT balances are operational account
--   snapshots manually maintained by the admin. They are NOT
--   derived from the ledger (which only tracks AUD trades).
--
--   Storing them in the treasury_settings singleton row keeps
--   the schema simple and avoids a separate accounts table.
--
--   The admin updates these whenever they reconcile the Iran
--   accounts. The last-update timestamp is preserved in
--   treasury_settings.updated_at via the existing trigger.
--
-- ============================================================

-- ── Add balance columns (idempotent) ─────────────────────────────────────

ALTER TABLE treasury_settings
  ADD COLUMN IF NOT EXISTS kadoos_balance_irt  numeric(25, 0) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pezhman_balance_irt numeric(25, 0) NOT NULL DEFAULT 0;

-- ── Add comments for documentation ───────────────────────────────────────

COMMENT ON COLUMN treasury_settings.kadoos_balance_irt IS
  'Current IRT balance in the Kadoos Iran account. Manually updated by admin. Not derived from ledger.';

COMMENT ON COLUMN treasury_settings.pezhman_balance_irt IS
  'Current IRT balance in the Pezhman Iran account. Manually updated by admin. Not derived from ledger.';
