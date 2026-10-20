-- Allow ledger entries and completed transactions to be edited independently.
BEGIN;

DROP TRIGGER IF EXISTS guard_completed_ledger_amounts ON public.ledger;
DROP TRIGGER IF EXISTS guard_exchange_request_ledger ON public.ledger;

CREATE OR REPLACE FUNCTION public.guard_completed_transaction_amounts() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF current_setting('app.completed_amount_correction',true)='on' THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME='transactions' THEN
    IF OLD.status='approved' AND (NEW.amount_aud,NEW.equivalent_toman,NEW.applied_rate,NEW.ledger_fee_aud,NEW.final_amount,NEW.type)
      IS DISTINCT FROM (OLD.amount_aud,OLD.equivalent_toman,OLD.applied_rate,OLD.ledger_fee_aud,OLD.final_amount,OLD.type) THEN
      RAISE EXCEPTION 'Use Edit amounts in Transactions to correct a completed transfer and its linked records together';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.guard_completed_transaction_amounts() FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.get_completed_transaction_correction(p_actor_id uuid,p_transaction_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE s jsonb; t jsonb; r jsonb; q jsonb; v_payments jsonb;
BEGIN
  IF public.exchange_request_is_admin(p_actor_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
  s:=public.completed_transaction_correction_state(p_transaction_id); t:=s->'transaction'; r:=s->'request'; q:=r->'quote';
  IF s IS NULL OR t->>'status' IS DISTINCT FROM 'approved'
    OR (r<>'null'::jsonb AND r->>'status' IS DISTINCT FROM 'completed') THEN
    RAISE EXCEPTION 'Only completed transfers can be corrected here'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',p->>'id','amount',p->'amount',
    'reference',p->>'payment_reference','accountName',a.account_name) ORDER BY p->>'id'),'[]'::jsonb)
    INTO v_payments FROM jsonb_array_elements(s->'payments') p
    LEFT JOIN public.bank_accounts a ON a.id=(p->>'account_id')::uuid WHERE (p->>'amount')::numeric>0;
  RETURN jsonb_build_object('transactionId',p_transaction_id,'requestId',r->>'id','revision',md5(s::text),
    'fundingCurrency',COALESCE(q->>'funding_currency',CASE WHEN t->>'type'='buy_aud' THEN 'AUD' ELSE 'IRT' END),
    'recipientCurrency',COALESCE(q->>'recipient_currency',CASE WHEN t->>'type'='buy_aud' THEN 'IRT' ELSE 'AUD' END),
    'fundingTotal',COALESCE(q->'funding_total',CASE WHEN t->>'type'='buy_aud' THEN t->'amount_aud' ELSE t->'equivalent_toman' END),
    'recipientAmount',COALESCE(q->'recipient_amount',CASE WHEN t->>'type'='buy_aud' THEN t->'equivalent_toman' ELSE t->'amount_aud' END),
    'baseFeeAUD',COALESCE(q->'base_fee_aud',t->'ledger_fee_aud',s->'ledger'->0->'fee_aud','0'::jsonb),
    'priorityFee',COALESCE(q->'priority_fee_amount','0'::jsonb),'payments',v_payments);
END; $$;
REVOKE ALL ON FUNCTION public.get_completed_transaction_correction(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_completed_transaction_correction(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.correct_completed_transaction_amounts(
  p_actor_id uuid,p_transaction_id uuid,p_revision text,p_command_key uuid,
  p_funding_total numeric,p_recipient_amount numeric,p_reason text,p_payments jsonb DEFAULT '[]'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
  t public.transactions%ROWTYPE; r public.exchange_requests%ROWTYPE; l public.ledger%ROWTYPE;
  c public.transaction_amount_corrections%ROWTYPE; v_payment record; v_item jsonb;
  v_before jsonb; v_after jsonb; q jsonb; v_receipt jsonb; v_fingerprint text; v_id uuid;
  v_funding_currency text; v_recipient_currency text; v_total numeric; v_amount numeric;
  v_raw numeric; v_equivalent numeric; v_rate numeric; v_accounting_rate numeric;
  v_fee numeric; v_accounting_fee numeric; v_priority numeric; v_denominator numeric; v_adjustment numeric;
  v_previous text:=current_setting('app.exchange_request_write',true);
  v_previous_correction text:=current_setting('app.completed_amount_correction',true);
BEGIN
  IF public.exchange_request_is_admin(p_actor_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
  IF p_transaction_id IS NULL OR p_command_key IS NULL OR p_revision IS NULL
    OR p_funding_total IS NULL OR p_recipient_amount IS NULL
    OR p_funding_total::text IN ('NaN','Infinity','-Infinity') OR p_recipient_amount::text IN ('NaN','Infinity','-Infinity')
    OR p_funding_total<=0 OR p_recipient_amount<=0 OR p_funding_total>90071992547409 OR p_recipient_amount>90071992547409
    OR char_length(btrim(COALESCE(p_reason,''))) NOT BETWEEN 3 AND 1000
    OR jsonb_typeof(p_payments) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Enter valid amounts and a reason for the correction'; END IF;
  IF jsonb_array_length(p_payments)>100 THEN RAISE EXCEPTION 'Too many deposit corrections'; END IF;
  PERFORM 1 FROM public.exchange_request_settings WHERE id FOR UPDATE;
  SELECT * INTO r FROM public.exchange_requests WHERE transaction_id=p_transaction_id FOR UPDATE;
  SELECT * INTO t FROM public.transactions WHERE id=p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaction unavailable' USING ERRCODE='42501'; END IF;
  v_fingerprint:=md5(jsonb_build_object('actor',p_actor_id,'revision',p_revision,'funding',p_funding_total,
    'recipient',p_recipient_amount,'reason',btrim(p_reason),'payments',p_payments)::text);
  SELECT * INTO c FROM public.transaction_amount_corrections WHERE transaction_id=t.id AND command_key=p_command_key;
  IF FOUND THEN
    IF c.fingerprint<>v_fingerprint THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Command key reused'; END IF;
    RETURN jsonb_build_object('transactionId',t.id,'requestId',r.id);
  END IF;
  PERFORM 1 FROM public.bank_transfer_fee_accruals WHERE transaction_id=t.id ORDER BY id FOR UPDATE;
  v_before:=public.completed_transaction_correction_state(t.id);
  IF md5(v_before::text)<>p_revision THEN
    RAISE EXCEPTION 'REQUEST_CONFLICT: Reload the current amounts before correcting this transfer' USING ERRCODE='PT409'; END IF;
  IF t.status IS DISTINCT FROM 'approved' OR t.type NOT IN ('buy_aud','sell_aud')
    OR (r.id IS NOT NULL AND (r.status<>'completed' OR r.funding_status<>'confirmed')) THEN
    RAISE EXCEPTION 'Only completed transfers can be corrected here'; END IF;
  IF jsonb_array_length(v_before->'ledger')>0 THEN
    SELECT * INTO l FROM public.ledger WHERE id=(v_before->'ledger'->0->>'id')::uuid;
  END IF;
  q:=r.quote;
  v_funding_currency:=CASE WHEN t.type='buy_aud' THEN 'AUD' ELSE 'IRT' END;
  v_recipient_currency:=CASE WHEN t.type='buy_aud' THEN 'IRT' ELSE 'AUD' END;
  IF (v_funding_currency='IRT' AND (p_funding_total<>trunc(p_funding_total) OR p_recipient_amount<>round(p_recipient_amount,2)))
    OR (v_funding_currency='AUD' AND (p_recipient_amount<>trunc(p_recipient_amount) OR p_funding_total<>round(p_funding_total,2))) THEN
    RAISE EXCEPTION 'Use whole Toman and at most two AUD decimal places'; END IF;
  v_accounting_fee:=COALESCE(t.ledger_fee_aud,(r.accounting_overrides->>'base_fee_aud')::numeric,l.fee_aud,0);
  v_fee:=COALESCE((q->>'base_fee_aud')::numeric,v_accounting_fee,0);
  v_priority:=COALESCE((q->>'priority_fee_amount')::numeric,0);
  IF v_fee<0 OR v_priority<0 OR p_funding_total<=v_priority THEN RAISE EXCEPTION 'The payment must cover the recorded fees'; END IF;
  v_raw:=CASE WHEN t.type='buy_aud' THEN p_funding_total-v_priority ELSE p_recipient_amount END;
  v_equivalent:=CASE WHEN t.type='buy_aud' THEN p_recipient_amount ELSE p_funding_total-v_priority END;
  v_denominator:=v_raw+CASE WHEN t.type='buy_aud' THEN -v_fee ELSE v_fee END;
  IF v_denominator<=0 THEN RAISE EXCEPTION 'The AUD amount must cover the recorded transfer fee'; END IF;
  v_rate:=round(v_equivalent/v_denominator,6);
  v_adjustment:=v_equivalent-round(v_denominator*v_rate);
  v_denominator:=v_raw+CASE WHEN t.type='buy_aud' THEN -COALESCE(v_accounting_fee,0) ELSE COALESCE(v_accounting_fee,0) END;
  IF v_denominator<=0 THEN RAISE EXCEPTION 'The AUD amount must cover the accounting fee'; END IF;
  v_accounting_rate:=round(v_equivalent/v_denominator,6);
  IF v_rate<=0 OR v_rate>100000000 OR v_accounting_rate<=0 OR v_accounting_rate>100000000 THEN
    RAISE EXCEPTION 'The corrected amounts produce an invalid exchange rate'; END IF;
  IF r.id IS NOT NULL THEN
    IF q->>'funding_currency' IS DISTINCT FROM v_funding_currency
      OR q->>'recipient_currency' IS DISTINCT FROM v_recipient_currency THEN
      RAISE EXCEPTION 'The request currency needs reconciliation'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.exchange_request_executions WHERE request_id=r.id AND status='settled')
      OR EXISTS(SELECT 1 FROM public.exchange_request_refunds WHERE request_id=r.id AND kind='principal') THEN
      RAISE EXCEPTION 'Reconcile the settlement or principal refund before correcting amounts'; END IF;
    IF p_funding_total=(q->>'funding_total')::numeric AND p_recipient_amount=(q->>'recipient_amount')::numeric THEN
      RAISE EXCEPTION 'Change a transfer amount before saving'; END IF;
    IF v_before->'receipt'='null'::jsonb THEN RAISE EXCEPTION 'The original completion receipt is missing'; END IF;
    IF (SELECT count(*) FROM public.exchange_request_effective_payments WHERE request_id=r.id)=0
      OR EXISTS(SELECT 1 FROM public.exchange_request_effective_payments WHERE request_id=r.id
        AND currency<>v_funding_currency) THEN
      RAISE EXCEPTION 'The recorded deposits and settlement account need reconciliation'; END IF;
    IF jsonb_array_length(p_payments)<>(SELECT count(*) FROM public.exchange_request_effective_payments WHERE request_id=r.id)
      OR jsonb_array_length(p_payments)<>(SELECT count(DISTINCT item->>'id') FROM jsonb_array_elements(p_payments) item) THEN
      RAISE EXCEPTION 'Include each recorded deposit once'; END IF;
    v_total:=0;
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_payments) LOOP
      IF jsonb_typeof(v_item->'amount') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Enter a valid deposit amount'; END IF;
      SELECT * INTO v_payment FROM public.exchange_request_effective_payments WHERE request_id=r.id AND id=(v_item->>'id')::uuid;
      IF NOT FOUND THEN RAISE EXCEPTION 'Recorded deposit unavailable' USING ERRCODE='42501'; END IF;
      v_amount:=(v_item->>'amount')::numeric;
      IF v_amount::text IN ('NaN','Infinity','-Infinity') OR v_amount<0 OR v_amount>90071992547409
        OR v_amount<>round(v_amount,2) OR (v_funding_currency='IRT' AND v_amount<>trunc(v_amount)) THEN
        RAISE EXCEPTION 'Use whole Toman and at most two AUD decimal places for deposits'; END IF;
      v_total:=v_total+v_amount;
      IF v_amount<>v_payment.amount THEN
        INSERT INTO public.exchange_request_payment_corrections(payment_id,request_id,request_version,amount,reason,actor_id,command_key)
          VALUES(v_payment.id,r.id,r.version+1,v_amount,btrim(p_reason),p_actor_id,p_command_key);
      END IF;
    END LOOP;
    IF v_total<>p_funding_total THEN RAISE EXCEPTION 'Recorded deposits must add up to the corrected customer payment'; END IF;
    q:=(q-'locked_amount_currency'-'locked_amount_value')||jsonb_build_object('raw_amount_aud',v_raw,
      'equivalent_toman',v_equivalent,'applied_rate',v_rate,'funding_total',p_funding_total,
      'recipient_amount',p_recipient_amount,'rounding_adjustment_toman',v_adjustment,'admin_adjusted',true);
  ELSE
    IF jsonb_array_length(p_payments)<>0 THEN RAISE EXCEPTION 'Manual transfers do not have request deposits'; END IF;
    IF v_raw=t.amount_aud AND v_equivalent=t.equivalent_toman THEN RAISE EXCEPTION 'Change a transfer amount before saving'; END IF;
  END IF;
  PERFORM set_config('app.exchange_request_write','on',true);
  PERFORM set_config('app.completed_amount_correction','on',true);
  IF r.id IS NOT NULL THEN
    UPDATE public.exchange_requests SET original_quote=COALESCE(original_quote,quote),quote=q,
      accounting_overrides=jsonb_build_object('applied_rate',v_accounting_rate,'base_fee_aud',COALESCE(v_accounting_fee,0)),
      funding_received=p_funding_total,version=version+1,updated_at=now() WHERE id=r.id RETURNING * INTO r;
  END IF;
  UPDATE public.transactions SET amount_aud=v_raw,equivalent_toman=v_equivalent,
    final_amount=CASE WHEN final_amount IS NOT NULL OR r.id IS NOT NULL THEN v_raw ELSE NULL END,
    applied_rate=v_accounting_rate,ledger_fee_aud=COALESCE(v_accounting_fee,0) WHERE id=t.id;
  IF r.id IS NOT NULL THEN
    UPDATE public.exchange_request_fee_earnings e SET amount_toman=
      CASE WHEN f.currency='IRT' THEN f.amount ELSE f.amount*v_rate END
      FROM public.exchange_request_fee_entries f WHERE e.request_id=r.id AND e.fee_entry_id=f.id;
  END IF;
  UPDATE public.bank_transfer_fee_accruals SET transaction_amount_toman=v_equivalent,
    fee_amount_toman=CASE WHEN status='accrued' AND posted_expense_id IS NULL AND posted_at IS NULL THEN
      CASE transfer_method WHEN 'pol' THEN round(v_equivalent*0.0002)
        WHEN 'paya' THEN LEAST(round(v_equivalent*0.0001),7500)
        WHEN 'satna' THEN LEAST(round(v_equivalent*0.0002),35000) ELSE 0 END ELSE fee_amount_toman END
    WHERE transaction_id=t.id;
  v_id:=gen_random_uuid();
  INSERT INTO public.transaction_amount_corrections(id,transaction_id,command_key,fingerprint,actor_id,reason,before_state,after_state)
    VALUES(v_id,t.id,p_command_key,v_fingerprint,p_actor_id,btrim(p_reason),v_before,'{}');
  IF r.id IS NOT NULL THEN
    v_receipt:=(v_before->'receipt')||jsonb_build_object('funding_total',p_funding_total,'recipient_amount',p_recipient_amount,
      'applied_rate',v_rate,'corrected_at',now(),'revision',r.version);
    INSERT INTO public.exchange_request_receipt_revisions(request_id,request_version,correction_id,snapshot)
      VALUES(r.id,r.version,v_id,v_receipt);
    INSERT INTO public.exchange_request_events(request_id,sequence,event_type,status,actor_id,customer_visible,internal_message,send_email)
      VALUES(r.id,COALESCE((SELECT max(sequence)+1 FROM public.exchange_request_events WHERE request_id=r.id),1),
        'amounts_corrected','completed',p_actor_id,true,btrim(p_reason),false);
  END IF;
  PERFORM public.refresh_enterprise_reports();
  v_after:=public.completed_transaction_correction_state(t.id);
  UPDATE public.transaction_amount_corrections SET after_state=v_after WHERE id=v_id;
  INSERT INTO public.audit_logs(actor_id,actor_email,action,target_type,target_id,old_value,new_value)
    VALUES(p_actor_id,(SELECT email FROM auth.users WHERE id=p_actor_id),'COMPLETED_TRANSACTION_AMOUNTS_CORRECTED','transaction',t.id::text,
      v_before,jsonb_build_object('state',v_after,'reason',btrim(p_reason),'correction_id',v_id));
  PERFORM set_config('app.exchange_request_write',COALESCE(v_previous,''),true);
  PERFORM set_config('app.completed_amount_correction',COALESCE(v_previous_correction,''),true);
  RETURN jsonb_build_object('transactionId',t.id,'requestId',r.id);
END; $$;
REVOKE ALL ON FUNCTION public.correct_completed_transaction_amounts(uuid,uuid,text,uuid,numeric,numeric,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.correct_completed_transaction_amounts(uuid,uuid,text,uuid,numeric,numeric,text,jsonb) TO service_role;

NOTIFY pgrst,'reload schema';
COMMIT;

