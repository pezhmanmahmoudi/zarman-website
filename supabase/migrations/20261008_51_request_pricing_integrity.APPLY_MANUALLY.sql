-- Preserve the entered currency amount, and support audited pre-payment corrections.
-- Original accepted quote rows are retained. No historical requests are repriced.
BEGIN;

-- Amend only the rounding equation, preserving deployed submission safeguards.
DO $migration$
DECLARE definition text;
  previous_equation text := $old$END)*(q->>'applied_rate')::numeric)
    OR q->>'funding_currency'$old$;
  updated_equation text := $new$END)*(q->>'applied_rate')::numeric)+COALESCE((q->>'rounding_adjustment_toman')::numeric,0)
    OR q->>'funding_currency'$new$;
BEGIN
  SELECT replace(pg_get_functiondef('public.submit_exchange_request(uuid,uuid,uuid)'::regprocedure),chr(13),'') INTO definition;
  IF strpos(definition,previous_equation)>0 THEN
    EXECUTE replace(definition,previous_equation,updated_equation);
  ELSIF strpos(definition,updated_equation)=0 THEN
    RAISE EXCEPTION 'Unexpected submission function: review amount validation before applying this migration';
  END IF;
END;
$migration$;

CREATE OR REPLACE FUNCTION public.validate_locked_request_quote() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE q jsonb:=NEW.snapshot; v_adjustment numeric:=COALESCE((q->>'rounding_adjustment_toman')::numeric,0);
BEGIN
  IF q->>'locked_amount_currency' IS NULL THEN
    IF v_adjustment<>0 THEN RAISE EXCEPTION 'Rounding requires a currency-locked quote'; END IF;
    RETURN NEW;
  END IF;
  IF q->>'locked_amount_currency' NOT IN ('AUD','IRT') OR jsonb_typeof(q->'locked_amount_value') IS DISTINCT FROM 'number'
    OR (q->>'locked_amount_value')::numeric<=0
    OR (q->>'raw_amount_aud')::numeric<>round((q->>'raw_amount_aud')::numeric,2)
    OR v_adjustment<>trunc(v_adjustment) THEN RAISE EXCEPTION 'Invalid currency-locked quote'; END IF;
  IF q->>'locked_amount_currency'='AUD' THEN
    IF (q->>'locked_amount_value')::numeric IS DISTINCT FROM (q->>'raw_amount_aud')::numeric OR v_adjustment<>0
      THEN RAISE EXCEPTION 'Fixed AUD amount changed'; END IF;
  ELSE
    IF (q->>'locked_amount_value')::numeric<>trunc((q->>'locked_amount_value')::numeric)
      OR (q->>'locked_amount_value')::numeric IS DISTINCT FROM
        (CASE WHEN q->>'customer_request_type'='buy_aud' THEN (q->>'funding_total')::numeric ELSE (q->>'recipient_amount')::numeric END)
      OR abs(v_adjustment)>ceil((q->>'applied_rate')::numeric/200)+1
      THEN RAISE EXCEPTION 'Fixed Toman amount changed or rounding exceeds one half cent'; END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS validate_locked_request_quote ON public.exchange_request_quotes;
CREATE TRIGGER validate_locked_request_quote BEFORE INSERT OR UPDATE OF snapshot ON public.exchange_request_quotes
FOR EACH ROW EXECUTE FUNCTION public.validate_locked_request_quote();
REVOKE ALL ON FUNCTION public.validate_locked_request_quote() FROM PUBLIC,anon,authenticated;

ALTER TABLE public.exchange_requests
  ADD COLUMN IF NOT EXISTS original_quote jsonb,
  ADD COLUMN IF NOT EXISTS pricing_pending_acceptance boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.guard_pending_request_pricing() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.status IN ('cancelled','rejected','expired') THEN NEW.pricing_pending_acceptance:=false; END IF;
  IF NEW.pricing_pending_acceptance AND (NEW.payment_approved_at IS NOT NULL
    OR NEW.funding_status IS DISTINCT FROM 'unpaid' OR NEW.funding_received<>0 OR NEW.evidence_submitted_at IS NOT NULL
    OR NEW.status IN ('ready','processing','reconciliation','completed')) THEN
    RAISE EXCEPTION 'Customer must accept revised amounts before payment approval';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS guard_pending_request_pricing ON public.exchange_requests;
CREATE TRIGGER guard_pending_request_pricing BEFORE INSERT OR UPDATE ON public.exchange_requests
FOR EACH ROW EXECUTE FUNCTION public.guard_pending_request_pricing();
REVOKE ALL ON FUNCTION public.guard_pending_request_pricing() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_request_pricing(p_actor_id uuid,p_request_id uuid,p_expected_version integer,
  p_command_key uuid,p_funding_total numeric,p_recipient_amount numeric,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.exchange_requests%ROWTYPE; t public.transactions%ROWTYPE; c public.exchange_request_commands%ROWTYPE;
  q jsonb; v_old_quote jsonb; v_fingerprint text; v_rate numeric; v_raw numeric; v_equivalent numeric; v_priority numeric;
  v_fee numeric; v_adjustment numeric; v_result jsonb; v_previous text:=current_setting('app.exchange_request_write',true);
BEGIN
  IF NOT public.exchange_request_is_admin(p_actor_id) THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
  IF p_command_key IS NULL OR p_expected_version IS NULL OR p_expected_version<1
    OR p_funding_total IS NULL OR p_recipient_amount IS NULL
    OR p_funding_total::text IN ('NaN','Infinity','-Infinity') OR p_recipient_amount::text IN ('NaN','Infinity','-Infinity')
    OR p_funding_total<=0 OR p_recipient_amount<=0
    OR p_funding_total>90071992547409 OR p_recipient_amount>90071992547409
    OR char_length(btrim(COALESCE(p_reason,''))) NOT BETWEEN 3 AND 1000 THEN RAISE EXCEPTION 'Invalid pricing correction'; END IF;
  SELECT * INTO r FROM public.exchange_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request unavailable' USING ERRCODE='42501'; END IF;
  v_fingerprint:=md5(jsonb_build_object('actor',p_actor_id,'action','edit_pricing','version',p_expected_version,
    'funding',p_funding_total,'recipient',p_recipient_amount,'reason',btrim(p_reason))::text);
  SELECT * INTO c FROM public.exchange_request_commands WHERE request_id=r.id AND command_key=p_command_key;
  IF FOUND THEN
    IF c.fingerprint<>v_fingerprint THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Command key reused'; END IF;
    RETURN c.result;
  END IF;
  IF r.version<>p_expected_version THEN RAISE EXCEPTION 'REQUEST_CONFLICT: Reload request' USING ERRCODE='40001'; END IF;
  SELECT * INTO t FROM public.transactions WHERE id=r.transaction_id FOR UPDATE;
  IF r.status NOT IN ('submitted','under_review','action_required','awaiting_funds')
    OR r.funding_status<>'unpaid' OR r.funding_received<>0 OR r.evidence_submitted_at IS NOT NULL
    OR t.status<>'pending' OR EXISTS(SELECT 1 FROM public.exchange_request_payments WHERE request_id=r.id)
    OR EXISTS(SELECT 1 FROM public.exchange_request_receipts WHERE request_id=r.id)
    OR EXISTS(SELECT 1 FROM public.ledger WHERE transaction_id=r.transaction_id) THEN
    RAISE EXCEPTION 'Amounts are locked after payment evidence, cleared funds or settlement. Use an accounting correction.';
  END IF;
  v_old_quote:=r.quote; q:=r.quote; v_fee:=(q->>'base_fee_aud')::numeric;
  v_priority:=(q->>'priority_fee_aud')::numeric;
  IF q->>'customer_request_type'='buy_aud' THEN
    IF p_funding_total<>trunc(p_funding_total) OR p_recipient_amount<>round(p_recipient_amount,2)
      THEN RAISE EXCEPTION 'Use whole Toman and at most two AUD decimal places'; END IF;
    v_raw:=p_recipient_amount;
    v_rate:=round(p_funding_total/(v_raw+v_fee+v_priority),6);
    v_priority:=round(v_priority*v_rate);
    v_equivalent:=p_funding_total-v_priority;
    v_adjustment:=v_equivalent-round((v_raw+v_fee)*v_rate);
  ELSE
    IF p_recipient_amount<>trunc(p_recipient_amount) OR p_funding_total<>round(p_funding_total,2)
      THEN RAISE EXCEPTION 'Use whole Toman and at most two AUD decimal places'; END IF;
    v_raw:=p_funding_total-v_priority;
    IF v_raw<=v_fee THEN RAISE EXCEPTION 'The amount must cover the service fees'; END IF;
    v_rate:=round(p_recipient_amount/(v_raw-v_fee),6);
    v_equivalent:=p_recipient_amount;
    v_adjustment:=v_equivalent-round((v_raw-v_fee)*v_rate);
  END IF;
  IF v_rate<=0 OR v_rate>100000000 OR v_raw<=0 OR v_raw>COALESCE((q->'policy_snapshot'->>'max_amount_aud')::numeric,50000)
    OR abs(v_adjustment)>ceil(v_rate/200)+1 THEN RAISE EXCEPTION 'Pricing correction exceeds the service limits'; END IF;
  q:=(q-'locked_amount_currency'-'locked_amount_value')||jsonb_build_object('raw_amount_aud',v_raw,
    'equivalent_toman',v_equivalent,'applied_rate',v_rate,'priority_fee_amount',v_priority,
    'funding_total',p_funding_total,'recipient_amount',p_recipient_amount,'rounding_adjustment_toman',v_adjustment,
    'admin_adjusted',true);
  PERFORM set_config('app.exchange_request_write','on',true);
  UPDATE public.exchange_requests SET original_quote=COALESCE(original_quote,quote),quote=q,
    pricing_pending_acceptance=true,payment_approved_at=NULL,funding_due_at=NULL,clearance_due_at=NULL,
    status='action_required',action_required='Pricing revised. Awaiting customer acceptance.',
    customer_action_required=btrim(p_reason),version=version+1,updated_at=now()
    WHERE id=r.id RETURNING * INTO r;
  UPDATE public.transactions SET amount_aud=v_raw,equivalent_toman=v_equivalent,applied_rate=v_rate,final_amount=v_raw WHERE id=r.transaction_id;
  PERFORM public.emit_exchange_request_event(r.id,'pricing_revised',p_actor_id,btrim(p_reason));
  INSERT INTO public.audit_logs(actor_id,actor_email,action,target_type,target_id,old_value,new_value)
    VALUES(p_actor_id,(SELECT email FROM auth.users WHERE id=p_actor_id),'REQUEST_PRICING_REVISED','exchange_requests',r.id::text,
      jsonb_build_object('quote',v_old_quote),
      jsonb_build_object('quote',q,'reason',btrim(p_reason),'awaiting_customer_acceptance',true));
  v_result:=to_jsonb(r);
  INSERT INTO public.exchange_request_commands(request_id,command_key,actor_id,fingerprint,result)
    VALUES(r.id,p_command_key,p_actor_id,v_fingerprint,v_result);
  PERFORM set_config('app.exchange_request_write',COALESCE(v_previous,''),true);
  RETURN v_result;
END; $$;
REVOKE ALL ON FUNCTION public.admin_update_request_pricing(uuid,uuid,integer,uuid,numeric,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_request_pricing(uuid,uuid,integer,uuid,numeric,numeric,text) TO service_role;

CREATE OR REPLACE FUNCTION public.accept_request_pricing(p_actor_id uuid,p_request_id uuid,p_expected_version integer,p_command_key uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.exchange_requests%ROWTYPE; c public.exchange_request_commands%ROWTYPE; v_fingerprint text; v_result jsonb;
BEGIN
  SELECT * INTO r FROM public.exchange_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND OR r.user_id IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION 'Request unavailable' USING ERRCODE='42501'; END IF;
  IF p_command_key IS NULL OR p_expected_version IS NULL THEN RAISE EXCEPTION 'Invalid acceptance'; END IF;
  v_fingerprint:=md5(jsonb_build_object('actor',p_actor_id,'action','accept_pricing','version',p_expected_version)::text);
  SELECT * INTO c FROM public.exchange_request_commands WHERE request_id=r.id AND command_key=p_command_key;
  IF FOUND THEN
    IF c.fingerprint<>v_fingerprint THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Command key reused'; END IF;
    RETURN c.result;
  END IF;
  IF r.version<>p_expected_version THEN RAISE EXCEPTION 'REQUEST_CONFLICT: Reload request' USING ERRCODE='40001'; END IF;
  IF NOT r.pricing_pending_acceptance OR r.status NOT IN ('submitted','under_review','action_required','awaiting_funds') OR r.funding_status<>'unpaid'
    THEN RAISE EXCEPTION 'No pricing revision awaiting acceptance'; END IF;
  UPDATE public.exchange_requests SET pricing_pending_acceptance=false,customer_action_required=NULL,
    action_required='Revised amounts accepted. Review and approve payment.',status='under_review',version=version+1,updated_at=now()
    WHERE id=r.id RETURNING * INTO r;
  PERFORM public.emit_exchange_request_event(r.id,'pricing_accepted',p_actor_id,NULL);
  INSERT INTO public.audit_logs(actor_id,actor_email,action,target_type,target_id,new_value)
    VALUES(p_actor_id,(SELECT email FROM auth.users WHERE id=p_actor_id),'REQUEST_PRICING_ACCEPTED','exchange_requests',r.id::text,jsonb_build_object('quote',r.quote));
  v_result:=to_jsonb(r);
  INSERT INTO public.exchange_request_commands(request_id,command_key,actor_id,fingerprint,result)
    VALUES(r.id,p_command_key,p_actor_id,v_fingerprint,v_result);
  RETURN v_result;
END; $$;
REVOKE ALL ON FUNCTION public.accept_request_pricing(uuid,uuid,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.accept_request_pricing(uuid,uuid,integer,uuid) TO service_role;
COMMIT;
