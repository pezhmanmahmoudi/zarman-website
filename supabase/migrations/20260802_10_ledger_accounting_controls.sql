-- Prevent new ledger classification and amount defects.
-- Existing malformed trades remain visible for controlled, audited repair.

ALTER TABLE ledger
  DROP CONSTRAINT IF EXISTS ledger_entry_type_check;
ALTER TABLE ledger
  ADD CONSTRAINT ledger_entry_type_check
  CHECK (COALESCE(entry_type, 'trade') IN ('trade', 'transfer', 'expense', 'owner_loan', 'adjustment'))
  NOT VALID;
ALTER TABLE ledger VALIDATE CONSTRAINT ledger_entry_type_check;

ALTER TABLE ledger
  DROP CONSTRAINT IF EXISTS ledger_non_negative_amounts_check;
ALTER TABLE ledger
  ADD CONSTRAINT ledger_non_negative_amounts_check
  CHECK (
    COALESCE(amount_aud, 0) >= 0
    AND COALESCE(amount_toman, 0) >= 0
    AND COALESCE(fee_aud, 0) >= 0
  )
  NOT VALID;
ALTER TABLE ledger VALIDATE CONSTRAINT ledger_non_negative_amounts_check;

ALTER TABLE ledger
  DROP CONSTRAINT IF EXISTS ledger_trade_amounts_check;
ALTER TABLE ledger
  ADD CONSTRAINT ledger_trade_amounts_check
  CHECK (
    COALESCE(entry_type, 'trade') <> 'trade'
    OR (COALESCE(amount_aud, 0) > 0 AND COALESCE(amount_toman, 0) > 0)
  )
  NOT VALID;

ALTER TABLE ledger
  DROP CONSTRAINT IF EXISTS ledger_transfer_accounts_check;
ALTER TABLE ledger
  ADD CONSTRAINT ledger_transfer_accounts_check
  CHECK (
    entry_type <> 'transfer'
    OR (
      payer_account_id IS NOT NULL
      AND receiver_account_id IS NOT NULL
      AND payer_account_id <> receiver_account_id
    )
  )
  NOT VALID;
ALTER TABLE ledger VALIDATE CONSTRAINT ledger_transfer_accounts_check;
