-- The legacy baseline restricts ledger.type to the two exchange directions.
-- Priority cash postings from _25 use a managed transfer adjustment, so admit
-- that specific shape without opening the ledger to ordinary transfer rows.
BEGIN;

ALTER TABLE public.ledger DROP CONSTRAINT IF EXISTS ledger_type_check;
ALTER TABLE public.ledger ADD CONSTRAINT ledger_type_check CHECK (
  type IN ('buy_aud', 'sell_aud')
  OR (
    type = 'transfer'
    AND entry_type IS NOT DISTINCT FROM 'adjustment'
    AND request_fee_entry_id IS NOT NULL
  )
);

-- The _25 foreign key, unique fee reference, adjustment-shape constraint and
-- guarded posting trigger continue to enforce provenance and prevent duplicates.
NOTIFY pgrst, 'reload schema';
COMMIT;
