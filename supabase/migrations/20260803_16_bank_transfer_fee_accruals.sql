-- Track transfer-network bank fees separately from the main ledger.
-- The fees are accrued per transaction and posted once per month as a single expense per source account.

CREATE TABLE IF NOT EXISTS bank_transfer_fee_accruals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE CASCADE,
  fee_month date NOT NULL,
  transfer_method text NOT NULL CHECK (transfer_method IN ('free', 'pol', 'paya', 'satna')),
  transaction_amount_toman numeric(20, 2) NOT NULL CHECK (transaction_amount_toman >= 0),
  fee_amount_toman numeric(20, 2) NOT NULL CHECK (fee_amount_toman >= 0),
  payer_account_id uuid NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  receiver_account_id uuid REFERENCES bank_accounts(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'accrued' CHECK (status IN ('accrued', 'posted', 'void')),
  accrued_at timestamptz NOT NULL DEFAULT now(),
  posted_at timestamptz,
  posted_expense_id uuid REFERENCES expenses(id) ON DELETE SET NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_transfer_fee_accruals_month_status
  ON bank_transfer_fee_accruals (fee_month, status, payer_account_id)
  WHERE status = 'accrued';

CREATE INDEX IF NOT EXISTS idx_bank_transfer_fee_accruals_payer_month
  ON bank_transfer_fee_accruals (payer_account_id, fee_month DESC);

CREATE OR REPLACE FUNCTION fn_bank_transfer_fee_accruals_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bank_transfer_fee_accruals_updated_at ON bank_transfer_fee_accruals;
CREATE TRIGGER trg_bank_transfer_fee_accruals_updated_at
  BEFORE UPDATE ON bank_transfer_fee_accruals
  FOR EACH ROW EXECUTE FUNCTION fn_bank_transfer_fee_accruals_set_updated_at();

CREATE OR REPLACE FUNCTION post_monthly_bank_transfer_fees(p_fee_month date)
RETURNS TABLE (
  payer_account_id uuid,
  expense_id uuid,
  total_fee_toman numeric,
  fee_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  month_start date := date_trunc('month', p_fee_month)::date;
  month_end date := (date_trunc('month', p_fee_month) + interval '1 month - 1 day')::date;
  fee_group record;
  inserted_expense_id uuid;
BEGIN
  FOR fee_group IN
    SELECT
      payer_account_id,
      sum(fee_amount_toman) AS total_fee_toman,
      count(*)::integer AS fee_count
    FROM bank_transfer_fee_accruals
    WHERE fee_month = month_start
      AND status = 'accrued'
      AND posted_at IS NULL
    GROUP BY payer_account_id
    HAVING sum(fee_amount_toman) > 0
    ORDER BY payer_account_id
  LOOP
    INSERT INTO expenses (
      date,
      title,
      category,
      currency,
      amount,
      exchange_rate,
      payer_account_id,
      status,
      notes,
      created_by
    ) VALUES (
      month_end,
      'کارمزد تجمیعی انتقالات بانکی',
      'bank_fees',
      'IRT',
      fee_group.total_fee_toman,
      NULL,
      fee_group.payer_account_id,
      'paid',
      format('Consolidated bank transfer fees for %s (%s transactions).', to_char(month_start, 'YYYY-MM'), fee_group.fee_count),
      auth.uid()
    )
    RETURNING id INTO inserted_expense_id;

    UPDATE bank_transfer_fee_accruals
    SET status = 'posted',
        posted_at = now(),
        posted_expense_id = inserted_expense_id
    WHERE fee_month = month_start
      AND payer_account_id = fee_group.payer_account_id
      AND status = 'accrued'
      AND posted_at IS NULL;

    payer_account_id := fee_group.payer_account_id;
    expense_id := inserted_expense_id;
    total_fee_toman := fee_group.total_fee_toman;
    fee_count := fee_group.fee_count;
    RETURN NEXT;
  END LOOP;
END;
$$;