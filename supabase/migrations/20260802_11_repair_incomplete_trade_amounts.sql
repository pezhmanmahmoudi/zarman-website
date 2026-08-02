-- Repair incomplete approved trade ledger rows from their authoritative transaction.
-- This currently repairs two historical sell rows with zero IRT amounts.

INSERT INTO audit_logs (
  actor_id,
  actor_email,
  action,
  target_type,
  target_id,
  old_value,
  new_value
)
SELECT
  ledger.created_by,
  'system:migration',
  'LEDGER_TRADE_AMOUNTS_REPAIRED',
  'ledger',
  ledger.id::text,
  jsonb_build_object(
    'amount_aud', ledger.amount_aud,
    'amount_toman', ledger.amount_toman,
    'exchange_rate', ledger.exchange_rate
  ),
  jsonb_build_object(
    'amount_aud', ledger.amount_aud,
    'amount_toman', transaction.equivalent_toman,
    'exchange_rate', transaction.equivalent_toman / NULLIF(ledger.amount_aud, 0),
    'source_transaction_id', transaction.id
  )
FROM ledger
JOIN transactions transaction ON transaction.id::text = ledger.transaction_id::text
WHERE COALESCE(ledger.entry_type, 'trade') = 'trade'
  AND ledger.amount_aud > 0
  AND COALESCE(ledger.amount_toman, 0) <= 0
  AND transaction.status = 'approved'
  AND transaction.equivalent_toman > 0;

UPDATE ledger
SET
  amount_toman = transaction.equivalent_toman,
  exchange_rate = transaction.equivalent_toman / NULLIF(ledger.amount_aud, 0)
FROM transactions transaction
WHERE transaction.id::text = ledger.transaction_id::text
  AND COALESCE(ledger.entry_type, 'trade') = 'trade'
  AND ledger.amount_aud > 0
  AND COALESCE(ledger.amount_toman, 0) <= 0
  AND transaction.status = 'approved'
  AND transaction.equivalent_toman > 0;

ALTER TABLE ledger VALIDATE CONSTRAINT ledger_trade_amounts_check;
