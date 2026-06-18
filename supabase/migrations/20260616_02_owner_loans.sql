-- ============================================================
-- Migration 02: Create owner_loans table
-- Purpose:
--   Track all owner capital injections and repayments separately
--   from business revenue and expenses.
--
-- CRITICAL ACCOUNTING RULE:
--   Owner loan amounts MUST NEVER enter profit calculations.
--   They are liabilities of the business to the owner.
--   Injections increase business liquidity but are NOT revenue.
--   Repayments decrease business liquidity but are NOT expenses.
--
-- Outstanding Owner Balance = SUM(injections) - SUM(repayments)
-- This figure is displayed as "بدهی به مالک" in the treasury UI.
-- ============================================================

CREATE TABLE IF NOT EXISTS owner_loans (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Date ──────────────────────────────────────────────────────────────
  date             date        NOT NULL,
  date_jalali      text        NOT NULL DEFAULT '',

  -- ── Financial ─────────────────────────────────────────────────────────
  currency         text        NOT NULL CHECK (currency IN ('AUD', 'IRT')),
  amount           numeric(20, 2) NOT NULL CHECK (amount > 0),

  -- ── Account attribution ───────────────────────────────────────────────
  --   Which business account received (injection) or sent (repayment) funds
  account          text        NOT NULL CHECK (account IN ('zarman', 'kadoos', 'pezhman')),

  -- ── Direction ─────────────────────────────────────────────────────────
  --   injection:  owner → business (increases Outstanding Owner Balance)
  --   repayment:  business → owner (decreases Outstanding Owner Balance)
  loan_type        text        NOT NULL DEFAULT 'injection'
                               CHECK (loan_type IN ('injection', 'repayment')),

  -- ── Repayment tracking ────────────────────────────────────────────────
  --   Tracks the repayment STATUS of an injection record.
  --   Repayment rows themselves always use loan_type = 'repayment'.
  repayment_status text        NOT NULL DEFAULT 'open'
                               CHECK (repayment_status IN ('open', 'partially_repaid', 'repaid')),

  -- ── Metadata ──────────────────────────────────────────────────────────
  notes            text,
  created_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_owner_loans_date
  ON owner_loans (date DESC);

CREATE INDEX IF NOT EXISTS idx_owner_loans_type
  ON owner_loans (loan_type);

CREATE INDEX IF NOT EXISTS idx_owner_loans_currency
  ON owner_loans (currency);

-- ── Auto-update updated_at ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_owner_loans_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_owner_loans_updated_at ON owner_loans;
CREATE TRIGGER trg_owner_loans_updated_at
  BEFORE UPDATE ON owner_loans
  FOR EACH ROW EXECUTE FUNCTION fn_owner_loans_set_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────
--   Owner loan data is financially sensitive.
--   Only admin and service_role may read or write.

ALTER TABLE owner_loans ENABLE ROW LEVEL SECURITY;

-- Admin and service_role SELECT
CREATE POLICY "owner_loans_admin_select"
  ON owner_loans FOR SELECT
  USING (
    (auth.jwt() ->> 'role') IN ('admin', 'service_role')
    OR auth.role() = 'service_role'
  );

-- Service_role INSERT (all writes go through server actions with requireAdmin())
CREATE POLICY "owner_loans_service_insert"
  ON owner_loans FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Service_role UPDATE
CREATE POLICY "owner_loans_service_update"
  ON owner_loans FOR UPDATE
  USING (auth.role() = 'service_role');

-- Service_role DELETE (corrections only — audit logged)
CREATE POLICY "owner_loans_service_delete"
  ON owner_loans FOR DELETE
  USING (auth.role() = 'service_role');
