-- Requires the request workflow through _29_request_payment_approval.
-- Confirm incoming funds and save accounting terms in one database transaction.
-- Keep the accepted quote, customer amounts, transaction guards and payout intact.
-- No historical requests or payments are changed by this migration.
BEGIN;

-- Include the idempotent _43 schema setup for deployments where that manual
-- migration was missed. A missing accounting_overrides column also broke the
-- previous action after its funds confirmation had already committed.
ALTER TABLE public.exchange_requests ADD COLUMN IF NOT EXISTS accounting_overrides jsonb;
ALTER TABLE public.exchange_requests DROP CONSTRAINT IF EXISTS exchange_requests_accounting_overrides_object;
ALTER TABLE public.exchange_requests ADD CONSTRAINT exchange_requests_accounting_overrides_object
  CHECK (accounting_overrides IS NULL OR jsonb_typeof(accounting_overrides) = 'object');

CREATE OR REPLACE FUNCTION public.apply_request_accounting_overrides() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_overrides jsonb;
BEGIN
  IF NEW.transaction_id IS NULL OR NEW.entry_type IS DISTINCT FROM 'trade' OR NEW.request_fee_entry_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT accounting_overrides INTO v_overrides FROM public.exchange_requests WHERE transaction_id = NEW.transaction_id;
  IF v_overrides IS NULL THEN RETURN NEW; END IF;
  IF jsonb_typeof(v_overrides->'applied_rate') = 'number' AND (v_overrides->>'applied_rate')::numeric > 0 THEN
    NEW.exchange_rate := (v_overrides->>'applied_rate')::numeric;
  END IF;
  IF jsonb_typeof(v_overrides->'base_fee_aud') = 'number' AND (v_overrides->>'base_fee_aud')::numeric >= 0 THEN
    NEW.fee_aud := (v_overrides->>'base_fee_aud')::numeric;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_request_accounting_overrides() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS apply_request_accounting_overrides ON public.ledger;
CREATE TRIGGER apply_request_accounting_overrides BEFORE INSERT ON public.ledger
  FOR EACH ROW EXECUTE FUNCTION public.apply_request_accounting_overrides();

CREATE OR REPLACE FUNCTION public.confirm_exchange_request_funds(
  p_actor_id uuid,p_request_id uuid,p_expected_version integer,p_command_key uuid,p_payload jsonb DEFAULT '{}'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
  r public.exchange_requests%ROWTYPE;
  v_result jsonb; v_replay boolean; v_rate numeric; v_fee numeric; v_overrides jsonb;
  v_previous text:=current_setting('app.exchange_request_write',true);
BEGIN
  IF public.exchange_request_is_admin(p_actor_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid request command'; END IF;
  IF p_payload ? 'accounting_rate' THEN
    IF jsonb_typeof(p_payload->'accounting_rate') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'Enter a valid exchange rate.';
    END IF;
    v_rate:=(p_payload->>'accounting_rate')::numeric;
    IF v_rate<=0 OR v_rate>100000000 OR v_rate<>round(v_rate,2) THEN
      RAISE EXCEPTION 'Enter a valid exchange rate.';
    END IF;
  END IF;
  IF p_payload ? 'accounting_fee_aud' THEN
    IF jsonb_typeof(p_payload->'accounting_fee_aud') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'Enter a valid fee in AUD.';
    END IF;
    v_fee:=(p_payload->>'accounting_fee_aud')::numeric;
    IF v_fee<0 OR v_fee>100000 OR v_fee<>round(v_fee,2) THEN
      RAISE EXCEPTION 'Enter a valid fee in AUD.';
    END IF;
  END IF;

  -- Use the workflow's lock order, including on retries. The underlying command
  -- checks permissions, state, version and the full payload fingerprint (fees
  -- included), and preserves its original accounting date and notification jobs.
  PERFORM 1 FROM public.exchange_request_settings WHERE id FOR UPDATE;
  SELECT * INTO r FROM public.exchange_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request unavailable' USING ERRCODE='42501'; END IF;
  v_replay:=EXISTS(SELECT 1 FROM public.exchange_request_commands WHERE request_id=r.id AND command_key=p_command_key);
  v_result:=public.transition_exchange_request(p_actor_id,p_request_id,p_expected_version,p_command_key,'confirm_funds',p_payload);
  IF v_replay OR NOT (p_payload ?| ARRAY['accounting_rate','accounting_fee_aud']) THEN RETURN v_result; END IF;

  -- Omitted fields retain previous accounting terms for subsequent partial
  -- deposits. COALESCE deliberately retains an explicit zero fee.
  v_rate:=COALESCE(v_rate,(r.accounting_overrides->>'applied_rate')::numeric,(r.quote->>'applied_rate')::numeric);
  v_fee:=COALESCE(v_fee,(r.accounting_overrides->>'base_fee_aud')::numeric,(r.quote->>'base_fee_aud')::numeric);
  IF r.accounting_overrides IS NULL AND v_rate=(r.quote->>'applied_rate')::numeric
    AND v_fee=(r.quote->>'base_fee_aud')::numeric THEN RETURN v_result; END IF;
  v_overrides:=jsonb_build_object('applied_rate',v_rate,'base_fee_aud',v_fee);

  -- This flag exists only inside the authorized transaction. Where the legacy
  -- request transaction guard is installed, its restrictions stay intact.
  PERFORM set_config('app.exchange_request_write','on',true);
  UPDATE public.transactions SET applied_rate=v_rate,ledger_fee_aud=v_fee
    WHERE id=r.transaction_id AND status='pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Linked accounting requires reconciliation'; END IF;
  UPDATE public.exchange_requests SET accounting_overrides=v_overrides WHERE id=r.id;
  INSERT INTO public.audit_logs(actor_id,actor_email,action,target_type,target_id,old_value,new_value)
    VALUES(p_actor_id,(SELECT email FROM auth.users WHERE id=p_actor_id),'REQUEST_ACCOUNTING_TERMS_UPDATED','exchange_requests',r.id::text,
      jsonb_build_object('accounting_overrides',r.accounting_overrides,'quote_rate',r.quote->'applied_rate','quote_fee_aud',r.quote->'base_fee_aud'),
      jsonb_build_object('accounting_overrides',v_overrides,'command_key',p_command_key,'version',v_result->'version'));
  v_result:=v_result||jsonb_build_object('accounting_overrides',v_overrides);
  UPDATE public.exchange_request_commands SET result=v_result WHERE request_id=r.id AND command_key=p_command_key;
  PERFORM set_config('app.exchange_request_write',COALESCE(v_previous,''),true);
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_exchange_request_funds(uuid,uuid,integer,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_exchange_request_funds(uuid,uuid,integer,uuid,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
