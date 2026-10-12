-- Repair currency-locked submissions on installations that skipped migration 51.
-- Preserve the installed submission function's identity, recipient, notification,
-- idempotency and accounting safeguards. No existing request or money is changed.
BEGIN;

-- Validate at submission as well as quote insertion: quotes created before this
-- repair must obey the same bounds. Only a fixed Toman amount may use a rounding
-- adjustment, limited to the value of one half AUD cent (plus integer rounding).
CREATE OR REPLACE FUNCTION public.validate_request_quote_currency_lock(q jsonb) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE v_adjustment numeric:=COALESCE((q->>'rounding_adjustment_toman')::numeric,0);
BEGIN
  IF q->>'locked_amount_currency' IS NULL THEN
    IF v_adjustment<>0 THEN RAISE EXCEPTION 'Rounding requires a currency-locked quote'; END IF;
    RETURN;
  END IF;
  IF q->>'locked_amount_currency' NOT IN ('AUD','IRT')
    OR jsonb_typeof(q->'locked_amount_value') IS DISTINCT FROM 'number'
    OR (q->>'locked_amount_value')::numeric<=0
    OR jsonb_typeof(q->'raw_amount_aud') IS DISTINCT FROM 'number'
    OR (q->>'raw_amount_aud')::numeric<>round((q->>'raw_amount_aud')::numeric,2)
    OR v_adjustment<>trunc(v_adjustment) THEN
    RAISE EXCEPTION 'Invalid currency-locked quote';
  END IF;
  IF q->>'locked_amount_currency'='AUD' THEN
    IF (q->>'locked_amount_value')::numeric IS DISTINCT FROM (q->>'raw_amount_aud')::numeric OR v_adjustment<>0 THEN
      RAISE EXCEPTION 'Fixed AUD amount changed';
    END IF;
  ELSE
    IF jsonb_typeof(q->'applied_rate') IS DISTINCT FROM 'number' OR (q->>'applied_rate')::numeric<=0
      OR (q->>'locked_amount_value')::numeric<>trunc((q->>'locked_amount_value')::numeric)
      OR (q->>'locked_amount_value')::numeric IS DISTINCT FROM
        (CASE WHEN q->>'customer_request_type'='buy_aud' THEN (q->>'funding_total')::numeric ELSE (q->>'recipient_amount')::numeric END)
      OR abs(v_adjustment)>ceil((q->>'applied_rate')::numeric/200)+1 THEN
      RAISE EXCEPTION 'Fixed Toman amount changed or rounding exceeds one half cent';
    END IF;
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.validate_request_quote_currency_lock(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.validate_request_quote_currency_lock(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.validate_locked_request_quote() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  PERFORM public.validate_request_quote_currency_lock(NEW.snapshot);
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.validate_locked_request_quote() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS validate_locked_request_quote ON public.exchange_request_quotes;
CREATE TRIGGER validate_locked_request_quote BEFORE INSERT OR UPDATE OF snapshot ON public.exchange_request_quotes
FOR EACH ROW EXECUTE FUNCTION public.validate_locked_request_quote();

DO $repair$
DECLARE
  v_definition text;
  -- Keep patterns on one line: SQL editors may submit CRLF inside multiline
  -- dollar-quoted literals while pg_get_functiondef contains LF. Match only the
  -- known equation followed by its funding guard, allowing whitespace changes.
  v_equation_end constant text := $pattern$(END\s*\)\s*\*\s*\(\s*q\s*->>\s*'applied_rate'\s*\)\s*::\s*numeric\s*\))$pattern$;
  v_funding_guard constant text := $pattern$(\s*OR\s+q\s*->>\s*'funding_currency')$pattern$;
  v_adjustment constant text := $pattern$\s*\+\s*COALESCE\s*\(\s*\(\s*q\s*->>\s*'rounding_adjustment_toman'\s*\)\s*::\s*numeric\s*,\s*0\s*\)$pattern$;
  v_old_count integer;
  v_new_count integer;
  v_call constant text := 'PERFORM public.validate_request_quote_currency_lock(q);';
  v_call_pattern constant text := 'PERFORM\s+public\.validate_request_quote_currency_lock\s*\(\s*q\s*\)\s*;';
  v_assignment constant text := 'q\s*:=\s*v_quote\.snapshot\s*;';
BEGIN
  v_definition:=replace(pg_get_functiondef('public.submit_exchange_request(uuid,uuid,uuid)'::regprocedure),chr(13),'');
  SELECT count(*) INTO v_old_count FROM regexp_matches(v_definition,v_equation_end||v_funding_guard,'gi');
  SELECT count(*) INTO v_new_count FROM regexp_matches(v_definition,v_equation_end||v_adjustment||v_funding_guard,'gi');
  IF v_old_count=1 AND v_new_count=0 THEN
    v_definition:=regexp_replace(v_definition,v_equation_end||v_funding_guard,
      $replacement$\1+COALESCE((q->>'rounding_adjustment_toman')::numeric,0)\2$replacement$,'i');
  ELSIF v_old_count<>0 OR v_new_count<>1 THEN
    RAISE EXCEPTION 'Unexpected quote submission equation: review the installed function before applying migration 58';
  END IF;
  IF v_definition !~* v_call_pattern THEN
    IF (SELECT count(*) FROM regexp_matches(v_definition,v_assignment,'g'))<>1 THEN
      RAISE EXCEPTION 'Unexpected quote loading: review the installed function before applying migration 58';
    END IF;
    v_definition:=regexp_replace(v_definition,v_assignment,E'\\&\n  '||v_call);
  END IF;
  EXECUTE v_definition;
END;
$repair$;

NOTIFY pgrst, 'reload schema';
COMMIT;
