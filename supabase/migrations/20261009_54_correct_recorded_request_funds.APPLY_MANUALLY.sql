-- Apply after request migrations 30, 52 and 53. No existing payments are changed.
-- Corrections preserve the original deposit and append an administrator's revision.
BEGIN;

CREATE TABLE IF NOT EXISTS public.exchange_request_payment_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.exchange_request_payments(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.exchange_requests(id) ON DELETE CASCADE,
  request_version integer NOT NULL,
  amount numeric(20,2) NOT NULL CHECK(amount >= 0 AND amount < 1000000000000000000),
  reason text NOT NULL CHECK(char_length(btrim(reason)) BETWEEN 3 AND 2000),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  command_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(payment_id,request_version)
);
ALTER TABLE public.exchange_request_payment_corrections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exchange_request_payment_corrections FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE VIEW public.exchange_request_current_payments AS
SELECT p.id,p.request_id,p.payment_reference,COALESCE(c.amount,p.amount) AS amount,
  p.currency,p.account_id,p.actor_id,p.created_at,p.amount AS original_amount,
  c.created_at AS corrected_at,COALESCE(c.amount=0,false) AS excluded
FROM public.exchange_request_payments p
LEFT JOIN LATERAL (
  SELECT amount,created_at FROM public.exchange_request_payment_corrections
  WHERE payment_id=p.id ORDER BY request_version DESC LIMIT 1
) c ON true;

CREATE OR REPLACE VIEW public.exchange_request_effective_payments AS
SELECT id,request_id,payment_reference,amount,currency,account_id,actor_id,created_at
FROM public.exchange_request_current_payments WHERE NOT excluded;
REVOKE ALL ON public.exchange_request_current_payments,public.exchange_request_effective_payments
  FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.exchange_request_current_payments TO service_role;

-- Every financial read uses the corrected amounts; inserts still preserve the
-- original payment table. Do not weaken the existing settlement/refund guards.
DO $patch$
DECLARE v_signature regprocedure; v_definition text;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.transition_exchange_request_accounting_core(uuid,uuid,integer,uuid,text,jsonb)'::regprocedure,
    'public.exchange_request_has_finance_hold(uuid)'::regprocedure
  ] LOOP
    v_definition:=pg_get_functiondef(v_signature);
    IF position('FROM public.exchange_request_payments' IN v_definition)=0
      AND position('FROM public.exchange_request_effective_payments' IN v_definition)=0 THEN
      RAISE EXCEPTION 'Review the payment reads in % before applying migration 54',v_signature;
    END IF;
    EXECUTE replace(v_definition,'FROM public.exchange_request_payments','FROM public.exchange_request_effective_payments');
  END LOOP;
END;
$patch$;

CREATE OR REPLACE FUNCTION public.correct_exchange_request_funds(
  p_actor_id uuid,p_request_id uuid,p_expected_version integer,p_command_key uuid,p_payload jsonb DEFAULT '{}'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
  r public.exchange_requests%ROWTYPE; v_command public.exchange_request_commands%ROWTYPE;
  v_payment record; v_item jsonb; v_amount numeric; v_total numeric; v_changed integer:=0;
  v_fingerprint text; v_before jsonb; v_result jsonb; v_reason text; v_key uuid;
  v_previous text:=current_setting('app.exchange_request_write',true);
  v_previous_email text:=current_setting('app.exchange_request_send_email',true);
BEGIN
  IF public.exchange_request_is_admin(p_actor_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501';
  END IF;
  IF p_request_id IS NULL OR p_expected_version IS NULL OR p_command_key IS NULL
    OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_payload->'send_email') IS DISTINCT FROM 'boolean'
    OR COALESCE(p_payload->>'date_jalali','') !~ '^[0-9]{4}/[0-9]{2}/[0-9]{2}$'
    OR jsonb_typeof(p_payload->'payment_corrections') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid deposit correction';
  END IF;
  v_reason:=NULLIF(btrim(p_payload->>'message'),'');
  IF v_reason IS NULL OR char_length(v_reason) NOT BETWEEN 3 AND 2000
    OR jsonb_array_length(p_payload->'payment_corrections') NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Select the recorded deposits to correct and enter a reason';
  END IF;
  PERFORM 1 FROM public.exchange_request_settings WHERE id FOR UPDATE;
  SELECT * INTO r FROM public.exchange_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request unavailable' USING ERRCODE='42501'; END IF;
  v_fingerprint:=md5(jsonb_build_object('actor',p_actor_id,'action','correct_funds','payload',p_payload,'version',p_expected_version)::text);
  SELECT * INTO v_command FROM public.exchange_request_commands WHERE request_id=r.id AND command_key=p_command_key;
  IF FOUND THEN
    IF v_command.fingerprint<>v_fingerprint THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Command key reused'; END IF;
    RETURN v_command.result;
  END IF;
  IF r.version<>p_expected_version THEN RAISE EXCEPTION 'REQUEST_CONFLICT: Reload request' USING ERRCODE='PT409'; END IF;
  IF r.payment_approved_at IS NULL OR r.status NOT IN ('awaiting_funds','under_review','action_required','ready')
    OR r.funding_status NOT IN ('unpaid','partial','confirmed') OR r.pricing_pending_acceptance
    OR EXISTS(SELECT 1 FROM public.exchange_request_executions WHERE request_id=r.id)
    OR EXISTS(SELECT 1 FROM public.exchange_request_refunds WHERE request_id=r.id)
    OR EXISTS(SELECT 1 FROM public.exchange_request_fee_entries WHERE request_id=r.id) THEN
    RAISE EXCEPTION 'Recorded deposits can only be corrected before settlement or fee accounting';
  END IF;
  IF (SELECT count(DISTINCT item->>'payment_id') FROM jsonb_array_elements(p_payload->'payment_corrections') item)
    <>jsonb_array_length(p_payload->'payment_corrections') THEN RAISE EXCEPTION 'Select each deposit once'; END IF;
  SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) INTO v_before
    FROM public.exchange_request_current_payments p WHERE request_id=r.id;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'payment_corrections') LOOP
    IF jsonb_typeof(v_item->'amount') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Enter a valid corrected deposit amount'; END IF;
    SELECT * INTO v_payment FROM public.exchange_request_current_payments
      WHERE request_id=r.id AND id=(v_item->>'payment_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'Recorded deposit unavailable' USING ERRCODE='42501'; END IF;
    v_amount:=(v_item->>'amount')::numeric;
    IF v_amount<0 OR v_amount>=1000000000000000000 OR v_amount<>round(v_amount,2)
      OR (v_payment.currency='IRT' AND v_amount<>trunc(v_amount)) THEN
      RAISE EXCEPTION 'Use whole Toman or up to two decimal places for AUD';
    END IF;
    IF v_amount<>v_payment.amount THEN
      INSERT INTO public.exchange_request_payment_corrections(payment_id,request_id,request_version,amount,reason,actor_id,command_key)
        VALUES(v_payment.id,r.id,r.version+1,v_amount,v_reason,p_actor_id,p_command_key);
      v_changed:=v_changed+1;
    END IF;
  END LOOP;
  IF v_changed=0 THEN RAISE EXCEPTION 'Change an amount or exclude a duplicate deposit before saving'; END IF;
  IF EXISTS(SELECT 1 FROM public.exchange_request_effective_payments WHERE request_id=r.id AND currency<>r.quote->>'funding_currency') THEN
    RAISE EXCEPTION 'Resolve the recorded currency mismatch before continuing';
  END IF;
  SELECT COALESCE(sum(amount),0) INTO v_total FROM public.exchange_request_effective_payments WHERE request_id=r.id;
  IF v_total<=0 OR v_total>(r.quote->>'funding_total')::numeric THEN
    RAISE EXCEPTION 'Corrected deposits must total more than zero and no more than the expected payment';
  END IF;
  PERFORM set_config('app.exchange_request_write','on',true);
  UPDATE public.exchange_requests SET funding_received=v_total,
    funding_status=CASE WHEN v_total=(quote->>'funding_total')::numeric THEN 'confirmed' ELSE 'partial' END,
    status=CASE WHEN v_total=(quote->>'funding_total')::numeric THEN 'under_review' ELSE 'awaiting_funds' END,
    funds_confirmed_at=CASE WHEN v_total=(quote->>'funding_total')::numeric THEN COALESCE(funds_confirmed_at,now()) ELSE NULL END,
    ready_at=CASE WHEN v_total=(quote->>'funding_total')::numeric THEN ready_at ELSE NULL END,
    handling_due_at=CASE WHEN v_total=(quote->>'funding_total')::numeric THEN handling_due_at ELSE NULL END,
    action_required=NULL WHERE id=r.id;
  UPDATE public.exchange_request_tasks SET status='completed',completed_at=now()
    WHERE request_id=r.id AND kind='funding_discrepancy' AND status='open';
  IF v_total=(r.quote->>'funding_total')::numeric THEN
    -- This single admin confirmation also releases the corrected funds. The
    -- existing command retains identity, account, fee and execution safeguards.
    v_key:=md5(p_command_key::text||':correct:resume')::uuid;
    v_result:=public.transition_exchange_request(p_actor_id,r.id,r.version,v_key,'resume_funded_request',
      jsonb_build_object('honour_quote',true,'send_email',p_payload->'send_email','date_jalali',p_payload->>'date_jalali'));
  ELSE
    UPDATE public.exchange_requests SET version=version+1,updated_at=now() WHERE id=r.id RETURNING to_jsonb(exchange_requests.*) INTO v_result;
    PERFORM set_config('app.exchange_request_send_email',p_payload->>'send_email',true);
    PERFORM public.emit_exchange_request_event(r.id,'funds_recorded',p_actor_id,NULL);
  END IF;
  PERFORM set_config('app.exchange_request_send_email','false',true);
  PERFORM public.emit_exchange_request_event(r.id,'funds_corrected',p_actor_id,v_reason);
  INSERT INTO public.audit_logs(actor_id,actor_email,action,target_type,target_id,old_value,new_value)
    VALUES(p_actor_id,(SELECT email FROM auth.users WHERE id=p_actor_id),'REQUEST_FUNDS_CORRECTED','exchange_requests',r.id::text,
      jsonb_build_object('payments',v_before,'funding_received',r.funding_received,'version',r.version),
      jsonb_build_object('corrections',p_payload->'payment_corrections','reason',v_reason,'funding_received',v_total,
        'version',v_result->'version','command_key',p_command_key));
  INSERT INTO public.exchange_request_commands(request_id,command_key,actor_id,fingerprint,result,accounting_date_jalali)
    VALUES(r.id,p_command_key,p_actor_id,v_fingerprint,v_result,p_payload->>'date_jalali');
  PERFORM set_config('app.exchange_request_write',COALESCE(v_previous,''),true);
  PERFORM set_config('app.exchange_request_send_email',COALESCE(v_previous_email,''),true);
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.correct_exchange_request_funds(uuid,uuid,integer,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.correct_exchange_request_funds(uuid,uuid,integer,uuid,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
