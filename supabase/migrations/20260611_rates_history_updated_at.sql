-- ============================================================
-- Migration: add updated_at column to rates_history
-- Purpose:   Track the LAST time a rate row was written
--            (created_at is immutable after INSERT in Supabase;
--             this column is explicitly updated on every upsert)
-- ============================================================

-- 1. Add the column (idempotent)
ALTER TABLE rates_history
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. Back-fill: existing rows default to their created_at value
UPDATE rates_history
  SET updated_at = created_at
  WHERE updated_at IS NULL;

-- 3. Trigger function: auto-stamp updated_at on every UPDATE
CREATE OR REPLACE FUNCTION fn_rates_history_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 4. Attach trigger (replace if it already exists)
DROP TRIGGER IF EXISTS trg_rates_history_updated_at ON rates_history;
CREATE TRIGGER trg_rates_history_updated_at
  BEFORE UPDATE ON rates_history
  FOR EACH ROW EXECUTE FUNCTION fn_rates_history_set_updated_at();
