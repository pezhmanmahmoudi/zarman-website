-- Per-transaction conversation and explicit staff email decisions. Existing
-- events, queued payloads, completion receipts and reference codes are retained.
BEGIN;

ALTER TABLE public.exchange_request_events ADD COLUMN send_email boolean NOT NULL DEFAULT true;
ALTER TABLE public.exchange_request_notification_deliveries
  DROP CONSTRAINT exchange_request_notification_deliveries_status_check;
ALTER TABLE public.exchange_request_notification_deliveries
  ADD CONSTRAINT exchange_request_notification_deliveries_status_check
  CHECK(status IN ('pending','leased','provider_accepted','delivered','failed','suppressed','reconciliation_required','skipped'));
CREATE TABLE public.exchange_request_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.exchange_requests(id),
  event_id uuid NOT NULL UNIQUE REFERENCES public.exchange_request_events(id),
  event_sequence integer NOT NULL CHECK(event_sequence > 0),
  sender_id uuid NOT NULL REFERENCES auth.users(id),
  sender_role text NOT NULL CHECK(sender_role IN ('customer','admin')),
  body text NOT NULL CHECK(char_length(btrim(body)) BETWEEN 1 AND 2000),
  send_email boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(request_id,event_sequence)
);
ALTER TABLE public.exchange_request_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exchange_request_messages FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.exchange_request_messages TO service_role;
CREATE TRIGGER guard_request_message_immutable BEFORE UPDATE OR DELETE ON public.exchange_request_messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_exchange_request_immutable();

-- Surface existing explicit correspondence without rewriting its event, email or
-- financial snapshot. Evidence references and internal staff notes are excluded.
INSERT INTO public.exchange_request_messages(request_id,event_id,event_sequence,sender_id,sender_role,body,send_email,created_at)
SELECT e.request_id,e.id,e.sequence,e.actor_id,
  CASE WHEN e.actor_id=r.user_id THEN 'customer' ELSE 'admin' END,
  CASE WHEN e.event_type='respond' THEN e.internal_message ELSE e.public_message END,true,e.created_at
FROM public.exchange_request_events e JOIN public.exchange_requests r ON r.id=e.request_id
WHERE e.actor_id IS NOT NULL
  AND ((e.event_type='respond' AND e.actor_id=r.user_id)
    OR (e.event_type IN ('request_info','reject','record_uncertain_payout') AND public.exchange_request_is_admin(e.actor_id)))
  AND char_length(btrim(CASE WHEN e.event_type='respond' THEN e.internal_message ELSE e.public_message END)) BETWEEN 1 AND 2000;

CREATE OR REPLACE FUNCTION public.submit_exchange_request(p_actor_id uuid,p_quote_id uuid,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_request public.exchange_requests%ROWTYPE; v_quote public.exchange_request_quotes%ROWTYPE;
  v_settings public.exchange_request_settings%ROWTYPE; q jsonb; v_transaction_id uuid; v_reference text;
  v_recipient jsonb; v_promo jsonb; v_attempt integer; v_previous text:=current_setting('app.exchange_request_write',true);
BEGIN
  IF p_actor_id IS NULL OR p_quote_id IS NULL OR p_idempotency_key IS NULL THEN RAISE EXCEPTION 'Invalid submission'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_actor_id::text||p_idempotency_key::text,0));
  SELECT * INTO v_request FROM public.exchange_requests WHERE user_id=p_actor_id AND idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF v_request.quote_id<>p_quote_id THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Key already used for another quote'; END IF;
    RETURN to_jsonb(v_request);
  END IF;
  SELECT * INTO STRICT v_settings FROM public.exchange_request_settings WHERE id FOR UPDATE;
  IF NOT (v_settings.settings->>'enabled')::boolean THEN RAISE EXCEPTION 'REQUESTS_DISABLED'; END IF;
  SELECT * INTO v_quote FROM public.exchange_request_quotes WHERE id=p_quote_id AND user_id=p_actor_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quote unavailable' USING ERRCODE='42501'; END IF;
  IF v_quote.expires_at<=now() THEN RAISE EXCEPTION 'QUOTE_EXPIRED'; END IF;
  IF (SELECT count(*) FROM public.exchange_requests WHERE user_id=p_actor_id
    AND status NOT IN ('completed','cancelled','rejected','expired'))>=20 THEN RAISE EXCEPTION 'Too many active requests'; END IF;
  q:=v_quote.snapshot;
  IF NOT q ?& ARRAY['raw_amount_aud','equivalent_toman','applied_rate','base_fee_aud','priority_fee_aud','priority_fee_amount',
    'funding_currency','funding_total','recipient_amount','recipient_currency','service_tier','locale','policy_version']
    OR EXISTS(SELECT 1 FROM unnest(ARRAY['raw_amount_aud','equivalent_toman','applied_rate','base_fee_aud','priority_fee_aud',
      'priority_fee_amount','funding_total','recipient_amount']) key WHERE jsonb_typeof(q->key) IS DISTINCT FROM 'number') THEN
    RAISE EXCEPTION 'Invalid authoritative quote';
  END IF;
  IF (q->>'policy_version')::integer IS DISTINCT FROM v_settings.version THEN RAISE EXCEPTION 'QUOTE_CHANGED: Accept a new quote'; END IF;
  PERFORM 1 FROM public.profiles WHERE id=p_actor_id AND kyc_status='approved' AND NOT compliance_customer_flagged AND compliance_aml_flag NOT IN ('review_required','failed') AND compliance_dvs_status<>'failed' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Identity approval required'; END IF;
  PERFORM 1 FROM auth.users WHERE id=p_actor_id AND email_confirmed_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Verified email required'; END IF;
  IF NOT COALESCE((SELECT market_active FROM public.rates_history ORDER BY date DESC LIMIT 1),false) THEN RAISE EXCEPTION 'MARKET_PAUSED'; END IF;
  IF (q->>'raw_amount_aud')::numeric NOT BETWEEN 0.01 AND (v_settings.settings->>'max_amount_aud')::numeric
     OR (q->>'raw_amount_aud')::numeric <> round((q->>'raw_amount_aud')::numeric,2)
     OR (q->>'equivalent_toman')::numeric<=0 OR (q->>'applied_rate')::numeric<=0
     OR q->>'service_tier' NOT IN ('standard','priority') OR q->>'locale' NOT IN ('en','fa')
     OR q->>'customer_request_type' NOT IN ('buy_aud','sell_aud')
     OR q->>'company_trade_type' IS DISTINCT FROM (CASE WHEN q->>'customer_request_type'='buy_aud' THEN 'sell_aud' ELSE 'buy_aud' END)
     OR COALESCE(btrim(q->>'source_of_funds'),'')='' OR COALESCE(btrim(q->>'reason_for_transfer'),'')='' THEN
    RAISE EXCEPTION 'Invalid authoritative quote';
  END IF;
  IF q->>'recipient_id' IS NOT NULL THEN
    SELECT to_jsonb(recipient) INTO v_recipient FROM public.recipients recipient
    WHERE recipient.id=(q->>'recipient_id')::uuid AND recipient.user_id=p_actor_id FOR SHARE;
    IF NOT FOUND OR NOT v_recipient @> (q->'recipient_snapshot')
      OR v_recipient->>'direction' IS DISTINCT FROM (CASE WHEN q->>'customer_request_type'='buy_aud' THEN 'aud' ELSE 'irt' END) THEN
      RAISE EXCEPTION 'RECIPIENT_CHANGED: Accept a new quote';
    END IF;
  ELSIF COALESCE(q->>'payment_link','') !~ '^https://' OR COALESCE(btrim(q->>'institution_name'),'')='' OR COALESCE(btrim(q->>'invoice_reference'),'')='' THEN
    RAISE EXCEPTION 'Recipient or education payment details required';
  END IF;
  IF q->>'service_tier'='priority' THEN
    IF NOT (v_settings.settings->>'priority_enabled')::boolean
      OR (q->>'priority_fee_aud')::numeric IS DISTINCT FROM (v_settings.settings->>'priority_fee_aud')::numeric THEN
      RAISE EXCEPTION 'PRIORITY_UNAVAILABLE';
    END IF;
    IF EXISTS(SELECT 1 FROM public.exchange_requests WHERE service_tier='standard' AND status='ready' AND handling_due_at<=now())
      OR (SELECT count(*) FROM public.exchange_requests WHERE service_tier='priority'
        AND (status IN ('ready','processing','reconciliation') OR (status IN ('submitted','under_review','action_required','awaiting_funds') AND (clearance_due_at>now() OR evidence_submitted_at IS NOT NULL OR funding_received>0)))) >= (v_settings.settings->>'priority_capacity')::integer
      OR EXISTS(SELECT 1 FROM public.exchange_requests WHERE user_id=p_actor_id AND service_tier='priority'
        AND (status IN ('ready','processing','reconciliation') OR (status IN ('submitted','under_review','action_required','awaiting_funds') AND (clearance_due_at>now() OR evidence_submitted_at IS NOT NULL OR funding_received>0)))) THEN
      RAISE EXCEPTION 'PRIORITY_CAPACITY: Choose standard or try later';
    END IF;
  ELSIF (q->>'priority_fee_aud')::numeric<>0 OR (q->>'priority_fee_amount')::numeric<>0 THEN RAISE EXCEPTION 'Invalid standard fee'; END IF;
  IF (q->>'base_fee_aud')::numeric<0 OR (q->>'priority_fee_aud')::numeric<0
    OR (q->>'equivalent_toman')::numeric IS DISTINCT FROM round(((q->>'raw_amount_aud')::numeric+
      CASE WHEN q->>'customer_request_type'='buy_aud' THEN (q->>'base_fee_aud')::numeric ELSE -(q->>'base_fee_aud')::numeric END)*(q->>'applied_rate')::numeric)
    OR q->>'funding_currency' IS DISTINCT FROM (CASE WHEN q->>'customer_request_type'='buy_aud' THEN 'IRT' ELSE 'AUD' END)
    OR q->>'recipient_currency' IS DISTINCT FROM (CASE WHEN q->>'customer_request_type'='buy_aud' THEN 'AUD' ELSE 'IRT' END)
    OR (q->>'recipient_amount')::numeric IS DISTINCT FROM (CASE WHEN q->>'customer_request_type'='buy_aud' THEN (q->>'raw_amount_aud')::numeric ELSE (q->>'equivalent_toman')::numeric END)
    OR (q->>'priority_fee_amount')::numeric IS DISTINCT FROM (CASE WHEN q->>'funding_currency'='IRT' THEN round((q->>'priority_fee_aud')::numeric*(q->>'applied_rate')::numeric) ELSE (q->>'priority_fee_aud')::numeric END)
    OR (q->>'funding_total')::numeric IS DISTINCT FROM ((CASE WHEN q->>'funding_currency'='IRT' THEN (q->>'equivalent_toman')::numeric ELSE (q->>'raw_amount_aud')::numeric END)+(q->>'priority_fee_amount')::numeric) THEN
    RAISE EXCEPTION 'Invalid authoritative quote amounts';
  END IF;
  IF q->>'promo_code' IS NOT NULL THEN
    SELECT to_jsonb(promo) INTO v_promo FROM public.promo_codes promo WHERE code=q->>'promo_code' FOR UPDATE;
    IF NOT FOUND OR NOT (v_promo->>'active')::boolean
      OR (v_promo->>'expires_at')::timestamptz <= now()
      OR ((v_promo->>'max_uses')::integer IS NOT NULL AND (v_promo->>'used_count')::integer >= (v_promo->>'max_uses')::integer)
      OR v_promo->>'discount_type' IS DISTINCT FROM q->'promo_snapshot'->>'discount_type'
      OR (v_promo->>'discount_value')::numeric IS DISTINCT FROM (q->'promo_snapshot'->>'discount_value')::numeric THEN
      RAISE EXCEPTION 'PROMO_CHANGED: Accept a new quote';
    END IF;
    UPDATE public.promo_codes SET used_count=COALESCE(used_count,0)+1 WHERE code=q->>'promo_code';
  END IF;
  FOR v_attempt IN 1..10 LOOP
    -- Match the established ZE + five-digit transaction code. The transaction
    -- row is the source of the request reference; no second code is minted.
    v_reference:='ZE'||lpad(floor(random()*100000)::integer::text,5,'0');
    BEGIN
      INSERT INTO public.transactions(user_id,type,amount_aud,equivalent_toman,applied_rate,ledger_fee_aud,status,
        source_of_funds,reason_for_transfer,recipient_id,promo_code,discount_amount,final_amount,loyalty_discount,reference_code,payment_link)
      VALUES(p_actor_id,q->>'company_trade_type',(q->>'raw_amount_aud')::numeric,(q->>'equivalent_toman')::numeric,
        (q->>'applied_rate')::numeric,(q->>'base_fee_aud')::numeric,'pending',q->>'source_of_funds',q->>'reason_for_transfer',
        (q->>'recipient_id')::uuid,q->>'promo_code',(q->>'discount_amount')::numeric,(q->>'raw_amount_aud')::numeric,
        (q->>'loyalty_discount')::numeric,v_reference,q->>'payment_link') RETURNING id,reference_code INTO v_transaction_id,v_reference;
      EXIT;
    EXCEPTION WHEN unique_violation THEN IF v_attempt=10 THEN RAISE; END IF;
    END;
  END LOOP;
  INSERT INTO public.exchange_requests(transaction_id,user_id,quote_id,idempotency_key,reference_code,quote,service_tier,priority_fee_status,funding_due_at,clearance_due_at,payment_instructions)
  VALUES(v_transaction_id,p_actor_id,p_quote_id,p_idempotency_key,v_reference,q,q->>'service_tier',
    CASE WHEN q->>'service_tier'='priority' THEN 'unpaid' ELSE 'not_applicable' END,
    now()+make_interval(mins=>(v_settings.settings->>'funding_minutes')::integer),
    now()+make_interval(mins=>(v_settings.settings->>'funding_minutes')::integer + CASE WHEN q->>'funding_currency'='AUD' THEN COALESCE((v_settings.settings->>'australian_clearance_minutes')::integer,1440) ELSE 1440 END),
    CASE WHEN q->>'funding_currency'='AUD' THEN v_settings.settings->>'payment_instructions_aud' ELSE v_settings.settings->>'payment_instructions_irt' END) RETURNING * INTO v_request;
  UPDATE public.profiles SET loyalty_discount_toman=COALESCE(loyalty_discount_toman,0)+COALESCE((q->>'loyalty_discount')::numeric,0) WHERE id=p_actor_id;
  PERFORM public.emit_exchange_request_event(v_request.id,'submitted',p_actor_id,NULL);
  -- Staff approve the next stage explicitly. Funding instructions are already
  -- frozen above and visible immediately on the submitted request.
  INSERT INTO public.audit_logs(actor_id,actor_email,action,target_type,target_id,new_value)
  VALUES(p_actor_id,(SELECT email FROM auth.users WHERE id=p_actor_id),'REQUEST_SUBMITTED','exchange_requests',v_request.id::text,
    jsonb_build_object('reference',v_reference,'quote_id',p_quote_id,'service_tier',q->>'service_tier'));
  PERFORM set_config('app.exchange_request_write',COALESCE(v_previous,''),true);
  RETURN to_jsonb(v_request);
END;
$$;

CREATE OR REPLACE FUNCTION public.emit_exchange_request_event(p_request_id uuid,p_event_type text,p_actor_id uuid,p_message text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,public AS $$
DECLARE v_request public.exchange_requests%ROWTYPE; v_event public.exchange_request_events%ROWTYPE;
  v_execution public.exchange_request_executions%ROWTYPE;
  v_email text; v_settings jsonb; v_emails jsonb; v_snapshot jsonb; v_receipt jsonb; v_public boolean; v_public_message text;
  v_send_email boolean:=COALESCE(NULLIF(current_setting('app.exchange_request_send_email',true),'')::boolean,true);
BEGIN
  -- Also serialize direct privileged emitters; event sequence never races.
  SELECT * INTO STRICT v_request FROM public.exchange_requests WHERE id=p_request_id FOR UPDATE;
  v_public := p_event_type IN ('submitted','await_funds','review','request_info','respond','payment_evidence',
    'receipt_uploaded','ready','resume_funded_request','funds_recorded','start_processing','record_uncertain_payout','complete',
    'cancel','reject','refund_pending','refund_returned','expired','admin_message','customer_message');
  -- User-provided funding evidence, staff references and internal notes must
  -- never leak into either a public timeline or email body.
  v_public_message := CASE WHEN p_event_type IN ('request_info','reject','record_uncertain_payout','respond','admin_message','customer_message') THEN p_message ELSE NULL END;
  INSERT INTO public.exchange_request_events(request_id,sequence,event_type,status,public_message,actor_id,customer_visible,internal_message,send_email)
  VALUES(p_request_id,COALESCE((SELECT max(sequence)+1 FROM public.exchange_request_events WHERE request_id=p_request_id),1),
    p_event_type,v_request.status,v_public_message,p_actor_id,v_public,p_message,v_send_email) RETURNING * INTO v_event;

  IF v_public_message IS NOT NULL AND p_actor_id IS NOT NULL THEN
    INSERT INTO public.exchange_request_messages(request_id,event_id,event_sequence,sender_id,sender_role,body,send_email,created_at)
    VALUES(p_request_id,v_event.id,v_event.sequence,p_actor_id,
      CASE WHEN public.exchange_request_is_admin(p_actor_id) THEN 'admin' ELSE 'customer' END,
      v_public_message,v_send_email,v_event.created_at);
  END IF;
  IF p_actor_id IS NOT NULL AND public.exchange_request_is_admin(p_actor_id) THEN
    INSERT INTO public.audit_logs(actor_id,actor_email,action,target_type,target_id,new_value)
    VALUES(p_actor_id,(SELECT email FROM auth.users WHERE id=p_actor_id),'REQUEST_EMAIL_DECISION',
      'exchange_request_events',v_event.id::text,
      jsonb_build_object('request_id',p_request_id,'event_type',p_event_type,'send_email',v_send_email));
  END IF;

  IF p_event_type='complete' THEN
    SELECT * INTO v_execution FROM public.exchange_request_executions
      WHERE request_id=p_request_id AND status='settled' AND settled_at IS NOT NULL AND settlement_reference IS NOT NULL;
    IF NOT FOUND OR v_request.status<>'completed' OR v_request.funding_status<>'confirmed'
      OR NOT EXISTS(SELECT 1 FROM public.transactions WHERE id=v_request.transaction_id AND status='approved') THEN
      RAISE EXCEPTION 'Verified settlement required for completion receipt';
    END IF;
    v_receipt := jsonb_build_object(
      'version',1,'request_id',p_request_id,'transaction_id',v_request.transaction_id,
      'reference_code',v_request.reference_code,'completed_at',v_execution.settled_at,
      'sender_name',COALESCE(NULLIF(v_request.quote->'sender_snapshot'->>'name',''),'Account holder'),
      'recipient_name',COALESCE(NULLIF(v_request.quote->'recipient_snapshot'->>'full_name',''),
        NULLIF(v_request.quote->'recipient_snapshot'->>'account_name',''),NULLIF(v_request.quote->>'institution_name',''),'Transfer recipient'),
      'funding_currency',v_request.quote->>'funding_currency','funding_total',v_request.quote->'funding_total',
      'recipient_currency',v_request.quote->>'recipient_currency','recipient_amount',v_request.quote->'recipient_amount',
      'base_fee_aud',v_request.quote->'base_fee_aud','priority_fee_aud',v_request.quote->'priority_fee_aud',
      'priority_fee_amount',v_request.quote->'priority_fee_amount','priority_fee_status',v_request.priority_fee_status,
      'applied_rate',v_request.quote->'applied_rate','service_tier',v_request.service_tier);
    INSERT INTO public.exchange_request_completion_receipts(request_id,event_id,snapshot,created_at)
      VALUES(p_request_id,v_event.id,v_receipt,v_execution.settled_at);
  END IF;
  v_snapshot := jsonb_strip_nulls(jsonb_build_object(
    'public_message',v_public_message,
    'payment_instructions',CASE WHEN p_event_type IN ('submitted','await_funds') THEN v_request.payment_instructions ELSE NULL END,
    'funding_total',v_request.quote->'funding_total','funding_currency',v_request.quote->>'funding_currency',
    'australian_clearance_minutes',COALESCE(v_request.quote->'policy_snapshot'->'australian_clearance_minutes','1440'::jsonb),
    'iran_banking_notice',v_request.quote->'policy_snapshot'->>'iran_banking_notice',
    'handling_due_at',v_request.handling_due_at,'funds_confirmed_at',v_request.funds_confirmed_at,'receipt',v_receipt));
  IF v_public AND p_event_type<>'customer_message' AND NOT (p_event_type='respond' AND p_actor_id=v_request.user_id) THEN
    SELECT email INTO v_email FROM auth.users WHERE id=v_request.user_id AND email_confirmed_at IS NOT NULL;
    INSERT INTO public.exchange_request_notification_deliveries(request_id,event_id,event_sequence,event_type,audience,
      recipient_email,locale,reference,workflow_status,requested_tier,priority_fee_aud,created_at,payload_snapshot,status,last_error)
    VALUES(p_request_id,v_event.id,v_event.sequence,p_event_type,'customer',COALESCE(v_email,''),
      COALESCE(v_request.quote->>'locale','en'),v_request.reference_code,v_request.status,v_request.service_tier,
      (v_request.quote->>'priority_fee_aud')::numeric,v_event.created_at,v_snapshot,
      CASE WHEN v_send_email THEN 'pending' ELSE 'skipped' END,
      CASE WHEN v_send_email THEN NULL ELSE 'admin_email_opt_out' END);
  END IF;
  SELECT settings INTO v_settings FROM public.exchange_request_settings WHERE id;
  v_emails := v_settings->'management_emails';
  IF v_emails IS NULL OR jsonb_array_length(v_emails)=0 THEN v_emails := '[""]'::jsonb; END IF;
  FOR v_email IN SELECT DISTINCT lower(value) FROM jsonb_array_elements_text(v_emails) LOOP
    INSERT INTO public.exchange_request_notification_deliveries(request_id,event_id,event_sequence,event_type,audience,
      recipient_email,locale,reference,workflow_status,requested_tier,priority_fee_aud,created_at,payload_snapshot,status,last_error)
    VALUES(p_request_id,v_event.id,v_event.sequence,p_event_type,'management',v_email,'en',v_request.reference_code,
      v_request.status,v_request.service_tier,(v_request.quote->>'priority_fee_aud')::numeric,v_event.created_at,v_snapshot,
      CASE WHEN v_send_email THEN 'pending' ELSE 'skipped' END,
      CASE WHEN v_send_email THEN NULL ELSE 'admin_email_opt_out' END);
  END LOOP;
  RETURN v_event.id;
END;
$$;

-- Set the email decision inside the same transaction as the financial command,
-- audit, event and outbox insert. Customer-originated events retain alerts.
-- The existing core fingerprints the payload, including the email decision.
CREATE OR REPLACE FUNCTION public.transition_exchange_request(p_actor_id uuid,p_request_id uuid,p_expected_version integer,
  p_command_key uuid,p_action text,p_payload jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_result jsonb; v_admin boolean:=public.exchange_request_is_admin(p_actor_id);
  v_previous_date text:=current_setting('app.exchange_request_fee_jalali',true);
  v_previous_email text:=current_setting('app.exchange_request_send_email',true);
BEGIN
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid request command'; END IF;
  IF v_admin AND jsonb_typeof(p_payload->'send_email') IS DISTINCT FROM 'boolean' THEN
    RAISE EXCEPTION 'Choose whether to send an email'; END IF;
  IF p_action IN ('confirm_funds','resume_funded_request','confirm_refund')
    AND COALESCE(p_payload->>'date_jalali','') !~ '^[0-9]{4}/[0-9]{2}/[0-9]{2}$' THEN
    RAISE EXCEPTION 'Verified Persian accounting date required'; END IF;
  PERFORM set_config('app.exchange_request_send_email',
    CASE WHEN v_admin THEN p_payload->>'send_email' ELSE 'true' END,true);
  PERFORM set_config('app.exchange_request_fee_jalali',COALESCE(p_payload->>'date_jalali',''),true);
  v_result:=public.transition_exchange_request_accounting_core(p_actor_id,p_request_id,p_expected_version,p_command_key,p_action,p_payload);
  PERFORM set_config('app.exchange_request_fee_jalali',COALESCE(v_previous_date,''),true);
  PERFORM set_config('app.exchange_request_send_email',COALESCE(v_previous_email,''),true);
  RETURN v_result;
END;
$$;

CREATE FUNCTION public.send_exchange_request_message(p_actor_id uuid,p_request_id uuid,p_expected_version integer,
  p_command_key uuid,p_message text,p_send_email boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
  r public.exchange_requests%ROWTYPE; v_command public.exchange_request_commands%ROWTYPE;
  v_admin boolean:=public.exchange_request_is_admin(p_actor_id); v_send_email boolean;
  v_body text:=btrim(p_message); v_fingerprint text; v_event_type text; v_event_id uuid;
  v_message public.exchange_request_messages%ROWTYPE; v_result jsonb; v_before jsonb;
  v_previous_email text:=current_setting('app.exchange_request_send_email',true);
BEGIN
  IF p_actor_id IS NULL OR p_request_id IS NULL OR p_expected_version IS NULL OR p_command_key IS NULL
    OR v_body IS NULL OR char_length(v_body) NOT BETWEEN 1 AND 2000
    OR (v_admin AND p_send_email IS NULL) THEN RAISE EXCEPTION 'Invalid request message'; END IF;
  -- Same lock order as transitions and deadline sweeps.
  PERFORM 1 FROM public.exchange_request_settings WHERE id FOR UPDATE;
  SELECT * INTO r FROM public.exchange_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND OR (r.user_id<>p_actor_id AND NOT v_admin) THEN
    RAISE EXCEPTION 'Request unavailable' USING ERRCODE='42501'; END IF;
  v_send_email:=CASE WHEN v_admin THEN p_send_email ELSE true END;
  v_fingerprint:=md5(jsonb_build_object('actor',p_actor_id,'action','message','message',v_body,
    'send_email',v_send_email,'version',p_expected_version)::text);
  SELECT * INTO v_command FROM public.exchange_request_commands WHERE request_id=p_request_id AND command_key=p_command_key;
  IF FOUND THEN
    IF v_command.fingerprint<>v_fingerprint THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Command key reused'; END IF;
    RETURN v_command.result;
  END IF;
  IF r.version<>p_expected_version THEN RAISE EXCEPTION 'REQUEST_CONFLICT: Reload request' USING ERRCODE='40001'; END IF;
  v_before:=jsonb_build_object('status',r.status,'version',r.version);
  v_event_type:=CASE WHEN v_admin THEN 'admin_message' ELSE 'customer_message' END;
  IF NOT v_admin AND r.status='action_required' THEN
    IF EXISTS(SELECT 1 FROM public.exchange_request_refunds WHERE request_id=r.id AND status='pending') THEN
      RAISE EXCEPTION 'Finance must reconcile the pending refund'; END IF;
    r.status:='under_review'; r.action_required:=NULL; v_event_type:='respond';
  END IF;
  UPDATE public.exchange_requests SET version=version+1,status=r.status,action_required=r.action_required,updated_at=now()
    WHERE id=r.id RETURNING * INTO r;
  PERFORM set_config('app.exchange_request_send_email',v_send_email::text,true);
  v_event_id:=public.emit_exchange_request_event(r.id,v_event_type,p_actor_id,v_body);
  SELECT * INTO STRICT v_message FROM public.exchange_request_messages WHERE event_id=v_event_id;
  INSERT INTO public.audit_logs(actor_id,actor_email,action,target_type,target_id,old_value,new_value)
  VALUES(p_actor_id,(SELECT email FROM auth.users WHERE id=p_actor_id),'REQUEST_MESSAGE','exchange_requests',r.id::text,
    v_before,jsonb_build_object('status',r.status,'version',r.version,'command_key',p_command_key,
      'message_id',v_message.id,'send_email',v_send_email));
  v_result:=jsonb_build_object('message',to_jsonb(v_message),'request_version',r.version);
  INSERT INTO public.exchange_request_commands(request_id,command_key,actor_id,fingerprint,result)
    VALUES(r.id,p_command_key,p_actor_id,v_fingerprint,v_result);
  PERFORM set_config('app.exchange_request_send_email',COALESCE(v_previous_email,''),true);
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.send_exchange_request_message(uuid,uuid,integer,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.send_exchange_request_message(uuid,uuid,integer,uuid,text,boolean) TO service_role;
REVOKE ALL ON FUNCTION public.transition_exchange_request(uuid,uuid,integer,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.transition_exchange_request(uuid,uuid,integer,uuid,text,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
