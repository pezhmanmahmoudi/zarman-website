-- ============================================================
-- Migration 03: Create expenses table
-- Purpose:
--   Track all operational business expenses.
--
-- ACCOUNTING RULE:
--   Only 'paid' expenses reduce Operating Profit.
--   'pending' expenses are shown separately and do NOT
--   affect any profit calculation until marked paid.
--
-- Operating Profit = Realized Trading Profit
--                  + Fee Income
--                  - Paid Expenses (IRT equivalent)
--
-- Expenses in AUD are left in AUD.
-- Expenses in IRT are stored as IRT.
-- Cross-currency equivalence for reporting uses
-- the prevailing rate at time of expense.
--
-- Cash Runway = Available IRT Liquidity / Avg Monthly IRT Expenses
-- This table is the source of truth for that metric.
-- ============================================================

CREATE TABLE IF NOT EXISTS expenses (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Date ──────────────────────────────────────────────────────────────
  date            date        NOT NULL,
  date_jalali     text        NOT NULL DEFAULT '',

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

  -- ── Account attribution ───────────────────────────────────────────────
  --   Which operational account paid this expense
  payer_account   text        NOT NULL
                              CHECK (payer_account IN ('zarman', 'kadoos', 'pezhman')),

  -- ── Status ────────────────────────────────────────────────────────────
  --   pending: accrued but not yet paid — shown separately in UI
  --   paid:    cash has left the account — deducted from Operating Profit
  status          text        NOT NULL DEFAULT 'paid'
                              CHECK (status IN ('pending', 'paid')),

  -- ── Metadata ──────────────────────────────────────────────────────────
  notes           text,
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_expenses_date
  ON expenses (date DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_status
  ON expenses (status);

CREATE INDEX IF NOT EXISTS idx_expenses_category
  ON expenses (category);

CREATE INDEX IF NOT EXISTS idx_expenses_currency
  ON expenses (currency);

-- Composite index for Cash Runway calculation:
--   WHERE status = 'paid' AND currency = 'IRT' ORDER BY date DESC
CREATE INDEX IF NOT EXISTS idx_expenses_paid_irt
  ON expenses (status, currency, date DESC)
  WHERE status = 'paid';

-- ── Auto-update updated_at ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_expenses_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_expenses_updated_at ON expenses;
CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION fn_expenses_set_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_admin_select"
  ON expenses FOR SELECT
  USING (
    (auth.jwt() ->> 'role') IN ('admin', 'service_role')
    OR auth.role() = 'service_role'
  );

CREATE POLICY "expenses_service_insert"
  ON expenses FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "expenses_service_update"
  ON expenses FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "expenses_service_delete"
  ON expenses FOR DELETE
  USING (auth.role() = 'service_role');
