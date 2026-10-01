-- Manual rollout: remove the obsolete invoice/candidate-reference requirement.
-- Patch only the existing guard, preserving deployed accounting/notification logic.
BEGIN;
DO $migration$
DECLARE
  definition text;
  previous_guard text := $old$COALESCE(q->>'payment_link','') !~ '^https://' OR COALESCE(btrim(q->>'institution_name'),'')='' OR COALESCE(btrim(q->>'invoice_reference'),'')=''$old$;
  updated_guard text := $new$COALESCE(q->>'payment_link','') !~ '^https://' OR COALESCE(btrim(q->>'institution_name'),'')=''$new$;
BEGIN
  SELECT pg_get_functiondef('public.submit_exchange_request(uuid,uuid,uuid)'::regprocedure) INTO definition;
  IF strpos(definition, previous_guard) > 0 THEN
    EXECUTE replace(definition, previous_guard, updated_guard);
  ELSIF strpos(definition, updated_guard || ' THEN') = 0 OR strpos(definition, 'invoice_reference') > 0 THEN
    RAISE EXCEPTION 'Unexpected submission function: review reference validation before applying this migration';
  END IF;
END;
$migration$;
COMMIT;
