-- Apply after 51–54. Step two sets final amounts, rather than adding a deposit.
-- Installation does not edit existing requests or bank records.
BEGIN;

CREATE OR REPLACE FUNCTION public.finalize_exchange_request_funds(
  p_actor_id uuid,p_request_id uuid,p_expected_version integer,p_command_key uuid,p_payload jsonb DEFAULT '{}'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
  r public.exchange_requests%ROWTYPE; t public.transactions%ROWTYPE;
  c public.exchange_request_commands%ROWTYPE; v_account public.bank_accounts%ROWTYPE;
  q jsonb; v_before jsonb; v_payments jsonb; v_result jsonb; v_payment record;
  v_fingerprint text; v_target uuid; v_key uuid; v_reference text;
  v_funding numeric; v_recipient numeric; v_raw numeric; v_equivalent numeric;
  v_rate numeric; v_fee numeric; v_priority numeric; v_adjustment numeric;
  v_accounting_rate numeric; v_accounting_fee numeric; v_changed boolean;
  v_previous text:=current_setting('app.exchange_request_write',true);
  v_previous_email text:=current_setting('app.exchange_request_send_email',true);
BEGIN
  IF public.exchange_request_is_admin(p_actor_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
  IF p_request_id IS NULL OR p_expected_version IS NULL OR p_command_key IS NULL
    OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_payload->'send_email') IS DISTINCT FROM 'boolean'
    OR COALESCE(p_payload->>'date_jalali','') !~ '^[0-9]{4}/[0-9]{2}/[0-9]{2}$'
    OR jsonb_typeof(p_payload->'final_funding_total') IS DISTINCT FROM 'number'
    OR jsonb_typeof(p_payload->'final_recipient_amount') IS DISTINCT FROM 'number' THEN
    RAISE EXCEPTION 'Enter the final customer payment and recipient amount'; END IF;
  v_funding:=(p_payload->>'final_funding_total')::numeric;
  v_recipient:=(p_payload->>'final_recipient_amount')::numeric;
  IF v_funding<=0 OR v_recipient<=0 OR v_funding>90071992547409 OR v_recipient>90071992547409 THEN
    RAISE EXCEPTION 'Enter valid positive final amounts'; END IF;
  PERFORM 1 FROM public.exchange_request_settings WHERE id FOR UPDATE;
  SELECT * INTO r FROM public.exchange_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request unavailable' USING ERRCODE='42501'; END IF;
  v_fingerprint:=md5(jsonb_build_object('actor',p_actor_id,'action','finalize_funds','payload',p_payload,'version',p_expected_version)::text);
  SELECT * INTO c FROM public.exchange_request_commands WHERE request_id=r.id AND command_key=p_command_key;
  IF FOUND THEN
    IF c.fingerprint<>v_fingerprint THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Command key reused'; END IF;
    RETURN c.result;
  END IF;
  IF r.version<>p_expected_version THEN RAISE EXCEPTION 'REQUEST_CONFLICT: Reload request' USING ERRCODE='PT409'; END IF;
  SELECT * INTO t FROM public.transactions WHERE id=r.transaction_id FOR UPDATE;
  IF r.payment_approved_at IS NULL OR r.pricing_pending_acceptance
    OR r.status NOT IN ('awaiting_funds','under_review','action_required','ready','expired')
    OR r.funding_status NOT IN ('unpaid','partial','confirmed')
    OR (t.status<>'pending' AND NOT (r.status='expired' AND t.status='rejected'))
    OR EXISTS(SELECT 1 FROM public.exchange_request_executions WHERE request_id=r.id)
    OR EXISTS(SELECT 1 FROM public.exchange_request_refunds WHERE request_id=r.id)
    OR EXISTS(SELECT 1 FROM public.exchange_request_fee_entries WHERE request_id=r.id)
    OR EXISTS(SELECT 1 FROM public.ledger WHERE transaction_id=r.transaction_id) THEN
    RAISE EXCEPTION 'Final amounts can only be confirmed before settlement'; END IF;
  SELECT * INTO v_account FROM public.bank_accounts WHERE id=(p_payload->>'receiver_account_id')::uuid FOR SHARE;
  IF NOT FOUND OR v_account.currency IS DISTINCT FROM r.quote->>'funding_currency' THEN
    RAISE EXCEPTION 'Choose the account that received the customer payment'; END IF;
  q:=r.quote; v_before:=to_jsonb(r);
  v_changed:=v_funding<>(q->>'funding_total')::numeric OR v_recipient<>(q->>'recipient_amount')::numeric;
  v_fee:=(q->>'base_fee_aud')::numeric; v_priority:=(q->>'priority_fee_aud')::numeric;
  -- Final customer and recipient amounts are independent administrator inputs.
  -- Derive their effective quote rate; accounting rate/fee remain explicit terms.
  IF q->>'customer_request_type'='buy_aud' THEN
    IF v_funding<>trunc(v_funding) OR v_recipient<>round(v_recipient,2) THEN
      RAISE EXCEPTION 'Use whole Toman and at most two AUD decimal places'; END IF;
    v_raw:=v_recipient; v_rate:=round(v_funding/(v_raw+v_fee+v_priority),6);
    v_priority:=round(v_priority*v_rate); v_equivalent:=v_funding-v_priority;
    v_adjustment:=v_equivalent-round((v_raw+v_fee)*v_rate);
  ELSE
    IF v_recipient<>trunc(v_recipient) OR v_funding<>round(v_funding,2) THEN
      RAISE EXCEPTION 'Use whole Toman and at most two AUD decimal places'; END IF;
    v_raw:=v_funding-v_priority;
    IF v_raw<=v_fee THEN RAISE EXCEPTION 'The final payment must cover the service fees'; END IF;
    v_rate:=round(v_recipient/(v_raw-v_fee),6); v_equivalent:=v_recipient;
    v_adjustment:=v_equivalent-round((v_raw-v_fee)*v_rate);
  END IF;
  IF v_rate<=0 OR v_rate>100000000 OR v_raw<=0
    OR v_raw>COALESCE((q->'policy_snapshot'->>'max_amount_aud')::numeric,50000)
    OR abs(v_adjustment)>ceil(v_rate/200)+1 THEN RAISE EXCEPTION 'Final amounts exceed the service limits'; END IF;
  IF v_changed THEN
    q:=(q-'locked_amount_currency'-'locked_amount_value')||jsonb_build_object('raw_amount_aud',v_raw,
      'equivalent_toman',v_equivalent,'applied_rate',v_rate,'priority_fee_amount',v_priority,
      'funding_total',v_funding,'recipient_amount',v_recipient,'rounding_adjustment_toman',v_adjustment,'admin_adjusted',true);
  END IF;
  v_accounting_rate:=COALESCE((r.accounting_overrides->>'applied_rate')::numeric,(q->>'applied_rate')::numeric);
  v_accounting_fee:=COALESCE((r.accounting_overrides->>'base_fee_aud')::numeric,(q->>'base_fee_aud')::numeric);
  IF p_payload ? 'accounting_rate' THEN
    IF jsonb_typeof(p_payload->'accounting_rate') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Enter a valid exchange rate'; END IF;
    v_accounting_rate:=(p_payload->>'accounting_rate')::numeric;
  END IF;
  IF p_payload ? 'accounting_fee_aud' THEN
    IF jsonb_typeof(p_payload->'accounting_fee_aud') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Enter a valid fee in AUD'; END IF;
    v_accounting_fee:=(p_payload->>'accounting_fee_aud')::numeric;
  END IF;
  IF v_accounting_rate<=0 OR v_accounting_rate>100000000 OR v_accounting_rate<>round(v_accounting_rate,6)
    OR v_accounting_fee<0 OR v_accounting_fee>100000 OR v_accounting_fee<>round(v_accounting_fee,2) THEN
    RAISE EXCEPTION 'Enter a valid accounting rate and fee'; END IF;
  SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) INTO v_payments FROM public.exchange_request_current_payments p WHERE request_id=r.id;
  SELECT id INTO v_target FROM public.exchange_request_effective_payments
    WHERE request_id=r.id AND currency=v_account.currency AND account_id=v_account.id ORDER BY created_at DESC,id DESC LIMIT 1;
  IF v_target IS NULL THEN
    v_reference:='AUTO-FINAL-'||p_command_key::text;
    INSERT INTO public.exchange_request_payments(request_id,payment_reference,amount,currency,account_id,actor_id)
      VALUES(r.id,v_reference,v_funding,v_account.currency,v_account.id,p_actor_id) RETURNING id INTO v_target;
  END IF;
  -- Replace the active total, never add the edited number to earlier entries.
  -- Original deposit rows and each administrator revision remain in history.
  FOR v_payment IN SELECT * FROM public.exchange_request_effective_payments WHERE request_id=r.id LOOP
    IF v_payment.amount<>(CASE WHEN v_payment.id=v_target THEN v_funding ELSE 0 END) THEN
      INSERT INTO public.exchange_request_payment_corrections(payment_id,request_id,request_version,amount,reason,actor_id,command_key)
        VALUES(v_payment.id,r.id,r.version+1,CASE WHEN v_payment.id=v_target THEN v_funding ELSE 0 END,
          'Administrator confirmed the final payment total',p_actor_id,p_command_key);
    END IF;
  END LOOP;
  PERFORM set_config('app.exchange_request_write','on',true);
  UPDATE public.exchange_requests SET original_quote=CASE WHEN v_changed THEN COALESCE(original_quote,quote) ELSE original_quote END,
    quote=q,accounting_overrides=jsonb_build_object('applied_rate',v_accounting_rate,'base_fee_aud',v_accounting_fee),
    pricing_pending_acceptance=false,funding_received=v_funding,funding_status='confirmed',status='under_review',
    funds_confirmed_at=COALESCE(funds_confirmed_at,now()),action_required=NULL,customer_action_required=NULL WHERE id=r.id;
  UPDATE public.transactions SET amount_aud=(q->>'raw_amount_aud')::numeric,equivalent_toman=(q->>'equivalent_toman')::numeric,
    final_amount=(q->>'raw_amount_aud')::numeric,applied_rate=v_accounting_rate,ledger_fee_aud=v_accounting_fee,status='pending'
    WHERE id=r.transaction_id;
  UPDATE public.exchange_request_tasks SET status='completed',completed_at=now()
    WHERE request_id=r.id AND status='open' AND kind IN ('funding_discrepancy','late_funding_review','funding_clearance_review');
  v_key:=md5(p_command_key::text||':final:ready')::uuid;
  v_result:=public.transition_exchange_request(p_actor_id,r.id,r.version,v_key,'resume_funded_request',
    jsonb_build_object('honour_quote',true,'send_email',p_payload->'send_email','date_jalali',p_payload->>'date_jalali'));
  PERFORM set_config('app.exchange_request_send_email','false',true);
  PERFORM public.emit_exchange_request_event(r.id,'funds_finalized',p_actor_id,'Administrator confirmed the final customer and recipient amounts');
  INSERT INTO public.audit_logs(actor_id,actor_email,action,target_type,target_id,old_value,new_value)
    VALUES(p_actor_id,(SELECT email FROM auth.users WHERE id=p_actor_id),'REQUEST_FINAL_AMOUNTS_CONFIRMED','exchange_requests',r.id::text,
      jsonb_build_object('quote',v_before->'quote','funding_received',r.funding_received,'payments',v_payments,'version',r.version),
      jsonb_build_object('quote',q,'funding_received',v_funding,'accounting_overrides',v_result->'accounting_overrides',
        'version',v_result->'version','command_key',p_command_key));
  INSERT INTO public.exchange_request_commands(request_id,command_key,actor_id,fingerprint,result,accounting_date_jalali)
    VALUES(r.id,p_command_key,p_actor_id,v_fingerprint,v_result,p_payload->>'date_jalali');
  PERFORM set_config('app.exchange_request_write',COALESCE(v_previous,''),true);
  PERFORM set_config('app.exchange_request_send_email',COALESCE(v_previous_email,''),true);
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_exchange_request_funds(uuid,uuid,integer,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_exchange_request_funds(uuid,uuid,integer,uuid,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
