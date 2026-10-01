-- Monthly account reconciliation audit trail: compare the system's computed
-- balance for a bank account against the actual bank statement balance and
-- keep a history of discrepancies, notes and any corrective ledger entry.

CREATE TABLE IF NOT EXISTS account_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  period text NOT NULL CHECK (period ~ '^\d{4}-\d{2}$'),
  as_of_date date NOT NULL,
  currency text NOT NULL CHECK (currency IN ('AUD', 'IRT')),
  computed_balance numeric(18, 2) NOT NULL,
  actual_balance numeric(18, 2) NOT NULL,
  discrepancy numeric(18, 2) GENERATED ALWAYS AS (round(actual_balance - computed_balance, 2)) STORED,
  status text NOT NULL DEFAULT 'matched' CHECK (status IN ('matched', 'discrepancy', 'adjusted')),
  notes text,
  adjustment_ledger_id uuid REFERENCES ledger(id) ON DELETE SET NULL,
  reconciled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reconciled_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_reconciliations_account_period
  ON account_reconciliations (account_id, period DESC, created_at DESC);
