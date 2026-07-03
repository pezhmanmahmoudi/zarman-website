-- ============================================================
-- Migration 07: Create recurring_expenses table
-- Purpose:
--   Store recurring expense templates for operational bills
--   such as website hosting, email service, mobile SIM, etc.
--   These are NOT directly deducted from profit — only when
--   an occurrence is "posted" (instantiated) does it create
--   a real row in the `expenses` table.
--
-- WORKFLOW:
--   1. Admin defines a recurring expense template here.
--   2. On or after `next_due_date`, admin clicks "Post" in the UI.
--   3. System inserts a row into `expenses` and advances
--      `next_due_date` by one frequency period.
--
-- FREQUENCIES:
--   weekly      → +7 days
--   fortnightly → +14 days
--   monthly     → +1 month
--   quarterly   → +3 months
-- ============================================================

CREATE TABLE IF NOT EXISTS recurring_expenses (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Description ───────────────────────────────────────────────────────
  title           text        NOT NULL CHECK (char_length(trim(title)) > 0),
  category        text        NOT NULL
                              CHECK (category IN (
                                'rent',
                                'marketing',
                                'bank_fees',
                                'software',
                                'salary',
                                'tax',
                                'office',
                                'miscellaneous'
                              )),

  -- ── Financial ─────────────────────────────────────────────────────────
  currency        text        NOT NULL CHECK (currency IN ('AUD', 'IRT')),
  amount          numeric(20, 2) NOT NULL CHECK (amount > 0),
  exchange_rate   numeric(20, 2),   -- required when currency = 'AUD'

  -- ── Account attribution ───────────────────────────────────────────────
  payer_account_id  uuid      REFERENCES bank_accounts(id) ON DELETE SET NULL,

  -- ── Schedule ──────────────────────────────────────────────────────────
  frequency       text        NOT NULL
                              CHECK (frequency IN (
                                'weekly',
                                'fortnightly',
                                'monthly',
                                'quarterly'
                              )),
  start_date      date        NOT NULL,
  next_due_date   date        NOT NULL,

  -- ── Status ────────────────────────────────────────────────────────────
  is_active       boolean     NOT NULL DEFAULT true,

  -- ── Metadata ──────────────────────────────────────────────────────────
  notes           text,
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_next_due
  ON recurring_expenses (next_due_date ASC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_recurring_expenses_active
  ON recurring_expenses (is_active);

-- ── Auto-update updated_at ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_recurring_expenses_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recurring_expenses_updated_at ON recurring_expenses;
CREATE TRIGGER trg_recurring_expenses_updated_at
  BEFORE UPDATE ON recurring_expenses
  FOR EACH ROW EXECUTE FUNCTION fn_recurring_expenses_set_updated_at();
