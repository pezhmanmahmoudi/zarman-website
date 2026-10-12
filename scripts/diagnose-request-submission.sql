-- Read-only deployment diagnosis; does not expose profiles or payment details.
WITH installed AS (
  SELECT pg_get_functiondef('public.submit_exchange_request(uuid,uuid,uuid)'::regprocedure) AS definition
), normalized AS (
  SELECT definition,regexp_replace(definition,'[[:space:]]','','g') AS compact FROM installed
)
SELECT
  -- A false recognition flag is not proof that rounding is unsupported;
  -- inspect the full function below when its installed equation differs.
  strpos(compact,$equation$END)*(q->>'applied_rate')::numeric)+COALESCE((q->>'rounding_adjustment_toman')::numeric,0)ORq->>'funding_currency'$equation$)>0 AS recognized_currency_rounding_equation,
  strpos(compact,'PERFORMpublic.validate_request_quote_currency_lock(q);')>0 AS validates_existing_quote_currency_lock,
  EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.exchange_request_quotes'::regclass
    AND tgname='validate_locked_request_quote' AND tgenabled IN ('O','A')) AS validates_new_quote_currency_lock,
  to_regprocedure('public.admin_update_request_pricing(uuid,uuid,integer,uuid,numeric,numeric,text)') IS NOT NULL AS pricing_migration_51_present,
  definition AS installed_submission_function
FROM normalized;
