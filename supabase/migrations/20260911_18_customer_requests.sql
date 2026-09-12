-- Customer request aggregate. Staged rollout: both service flags default OFF.
-- This migration changes no existing trade amounts and sends no messages.
BEGIN;

CREATE TABLE public.exchange_request_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK(id), version integer NOT NULL DEFAULT 1 CHECK(version > 0),
  settings jsonb NOT NULL DEFAULT '{"enabled":false,"priority_enabled":false,"priority_fee_aud":0,"priority_capacity":0,"standard_minutes":240,"priority_minutes":30,"quote_minutes":10,"funding_minutes":120,"max_amount_aud":50000,"timezone":"Australia/Sydney","business_days":[1,2,3,4,5],"opening_hour":9,"closing_hour":17,"holidays":[],"management_emails":[],"payment_instructions_aud":"","payment_instructions_irt":"","priority_terms":"","priority_terms_fa":""}',
  updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES auth.users(id)
);
INSERT INTO public.exchange_request_settings(id) VALUES (true);

CREATE TABLE public.exchange_request_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id),
  snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot) = 'object'), expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), CHECK(expires_at > created_at)
);
CREATE INDEX ON public.exchange_request_quotes(user_id,created_at DESC);

CREATE TABLE public.exchange_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), transaction_id uuid NOT NULL UNIQUE REFERENCES public.transactions(id),
  user_id uuid NOT NULL REFERENCES auth.users(id), quote_id uuid NOT NULL UNIQUE REFERENCES public.exchange_request_quotes(id),
  idempotency_key uuid NOT NULL, reference_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','under_review','action_required','awaiting_funds','ready','processing','reconciliation','completed','cancelled','rejected','expired')),
  version integer NOT NULL DEFAULT 1 CHECK(version > 0), quote jsonb NOT NULL,
  service_tier text NOT NULL CHECK(service_tier IN ('standard','priority')),
  priority_fee_status text NOT NULL CHECK(priority_fee_status IN ('not_applicable','unpaid','paid','refund_pending','refunded')),
  funding_status text NOT NULL DEFAULT 'unpaid' CHECK(funding_status IN ('unpaid','partial','confirmed','refund_pending','refunded')),
  funding_received numeric(20,2) NOT NULL DEFAULT 0 CHECK(funding_received >= 0),
  payment_instructions text, action_required text, owner_id uuid REFERENCES auth.users(id),
  handling_due_at timestamptz, handling_started_at timestamptz, funding_due_at timestamptz NOT NULL,
  ready_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,idempotency_key)
);
CREATE INDEX ON public.exchange_requests(user_id,created_at DESC);
CREATE INDEX ON public.exchange_requests(status,handling_due_at,created_at);

CREATE TABLE public.exchange_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES public.exchange_requests(id),
  sequence integer NOT NULL, event_type text NOT NULL, status text NOT NULL, public_message text,
  actor_id uuid REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(request_id,sequence)
);
CREATE TABLE public.exchange_request_commands (
  request_id uuid NOT NULL REFERENCES public.exchange_requests(id), command_key uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES auth.users(id), fingerprint text NOT NULL, result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(request_id,command_key)
);
CREATE TABLE public.exchange_request_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES public.exchange_requests(id),
  kind text NOT NULL, description text NOT NULL, status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','completed')),
  dedupe_key text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
CREATE TABLE public.exchange_request_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES public.exchange_requests(id),
  payment_reference text NOT NULL UNIQUE CHECK(char_length(payment_reference) BETWEEN 3 AND 200),
  amount numeric(20,2) NOT NULL CHECK(amount > 0 AND amount < 'Infinity'::numeric),
  currency text NOT NULL CHECK(currency IN ('AUD','IRT')), account_id uuid NOT NULL REFERENCES public.bank_accounts(id),
  actor_id uuid NOT NULL REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.exchange_request_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL UNIQUE REFERENCES public.exchange_requests(id),
  status text NOT NULL DEFAULT 'claimed' CHECK(status IN ('claimed','uncertain','settled')),
  claimed_by uuid NOT NULL REFERENCES auth.users(id), settlement_reference text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(), settled_at timestamptz
);
CREATE TABLE public.exchange_request_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES public.exchange_requests(id),
  kind text NOT NULL CHECK(kind IN ('priority','principal')), amount numeric(20,2) NOT NULL CHECK(amount > 0),
  currency text NOT NULL CHECK(currency IN ('AUD','IRT')), reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','returned')),
  refund_reference text UNIQUE, account_id uuid REFERENCES public.bank_accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(), returned_at timestamptz, UNIQUE(request_id,kind)
);
-- Separate fee journal avoids altering trade volume, exchange rates or base fees.
-- Its original-currency cash movements are visible in the request finance queue;
-- enterprise-report integration is a launch prerequisite for paid priority.
CREATE TABLE public.exchange_request_fee_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES public.exchange_requests(id),
  kind text NOT NULL CHECK(kind IN ('collected','refunded')), account_id uuid NOT NULL REFERENCES public.bank_accounts(id),
  currency text NOT NULL CHECK(currency IN ('AUD','IRT')), amount numeric(20,2) NOT NULL CHECK(amount > 0),
  amount_aud numeric(20,2) NOT NULL CHECK(amount_aud > 0), evidence_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(request_id,kind)
);
CREATE TABLE public.exchange_request_notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES public.exchange_requests(id),
  event_id uuid NOT NULL REFERENCES public.exchange_request_events(id), event_sequence integer NOT NULL, event_type text NOT NULL,
  audience text NOT NULL CHECK(audience IN ('customer','management')), recipient_email text NOT NULL,
  channel text NOT NULL DEFAULT 'email' CHECK(channel = 'email'), locale text NOT NULL CHECK(locale IN ('en','fa')),
  reference text NOT NULL, workflow_status text NOT NULL, requested_tier text NOT NULL, priority_fee_aud numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','leased','provider_accepted','delivered','failed','suppressed','reconciliation_required')),
  lease_owner uuid, lease_expires_at timestamptz, next_attempt_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts >= 0), rendered_payload jsonb, template_version text,
  first_attempt_at timestamptz, provider_id text, last_error text, delivered_at timestamptz, provider_accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id,audience,recipient_email,channel)
);
CREATE INDEX ON public.exchange_request_notification_deliveries(status,next_attempt_at,created_at);
CREATE INDEX ON public.exchange_request_notification_deliveries(provider_id) WHERE provider_id IS NOT NULL;

CREATE FUNCTION public.exchange_request_is_admin(p_actor_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog,public AS $$
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = p_actor_id
    AND raw_app_meta_data ->> 'role' IN ('admin','supabase_admin','service_role'));
$$;

-- Business-time arithmetic is performed in the accepted Sydney calendar, using
-- timezone conversion for every day (including DST boundaries and holidays).
CREATE FUNCTION public.exchange_request_business_due(p_start timestamptz,p_minutes integer,p_policy jsonb)
RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog,public AS $$
DECLARE
  v_cursor timestamptz := p_start; v_day date; v_open timestamptz; v_close timestamptz;
  v_remaining interval := make_interval(mins => p_minutes); v_days integer := 0;
BEGIN
  IF p_start IS NULL OR p_minutes < 0 OR p_minutes > 10080 OR p_policy->>'timezone' <> 'Australia/Sydney'
     OR jsonb_array_length(p_policy->'business_days') = 0 THEN RAISE EXCEPTION 'Invalid business calendar'; END IF;
  LOOP
    v_days := v_days + 1;
    IF v_days > 730 THEN RAISE EXCEPTION 'Business calendar has no available capacity'; END IF;
    v_day := (v_cursor AT TIME ZONE 'Australia/Sydney')::date;
    v_open := (v_day + make_interval(hours => (p_policy->>'opening_hour')::integer)) AT TIME ZONE 'Australia/Sydney';
    v_close := (v_day + make_interval(hours => (p_policy->>'closing_hour')::integer)) AT TIME ZONE 'Australia/Sydney';
    IF (p_policy->'business_days') @> to_jsonb(ARRAY[extract(dow FROM v_day)::integer])
       AND NOT (COALESCE(p_policy->'holidays','[]'::jsonb) @> to_jsonb(ARRAY[v_day::text]))
       AND v_cursor < v_close THEN
      v_cursor := GREATEST(v_cursor,v_open);
      IF v_remaining <= v_close-v_cursor THEN RETURN v_cursor+v_remaining; END IF;
      v_remaining := v_remaining-(v_close-v_cursor);
    END IF;
    v_cursor := (v_day+1)::timestamp AT TIME ZONE 'Australia/Sydney';
  END LOOP;
END;
$$;

CREATE FUNCTION public.emit_exchange_request_event(p_request_id uuid,p_event_type text,p_actor_id uuid,p_message text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,public AS $$
DECLARE v_request public.exchange_requests%ROWTYPE; v_event public.exchange_request_events%ROWTYPE;
  v_email text; v_settings jsonb; v_emails jsonb;
BEGIN
  SELECT * INTO STRICT v_request FROM public.exchange_requests WHERE id=p_request_id;
  INSERT INTO public.exchange_request_events(request_id,sequence,event_type,status,public_message,actor_id)
  VALUES(p_request_id,COALESCE((SELECT max(sequence)+1 FROM public.exchange_request_events WHERE request_id=p_request_id),1),
    p_event_type,v_request.status,p_message,p_actor_id) RETURNING * INTO v_event;
  SELECT email INTO v_email FROM auth.users WHERE id=v_request.user_id AND email_confirmed_at IS NOT NULL;
  INSERT INTO public.exchange_request_notification_deliveries(request_id,event_id,event_sequence,event_type,audience,
    recipient_email,locale,reference,workflow_status,requested_tier,priority_fee_aud,created_at)
  VALUES(p_request_id,v_event.id,v_event.sequence,p_event_type,'customer',COALESCE(v_email,''),
    v_request.quote->>'locale',v_request.reference_code,v_request.status,v_request.service_tier,
    (v_request.quote->>'priority_fee_aud')::numeric,v_event.created_at);
  SELECT settings INTO v_settings FROM public.exchange_request_settings WHERE id;
  v_emails := v_settings->'management_emails';
  IF jsonb_array_length(v_emails)=0 THEN v_emails := '[""]'::jsonb; END IF;
  FOR v_email IN SELECT DISTINCT lower(value) FROM jsonb_array_elements_text(v_emails) LOOP
    INSERT INTO public.exchange_request_notification_deliveries(request_id,event_id,event_sequence,event_type,audience,
      recipient_email,locale,reference,workflow_status,requested_tier,priority_fee_aud,created_at)
    VALUES(p_request_id,v_event.id,v_event.sequence,p_event_type,'management',v_email,'en',v_request.reference_code,
      v_request.status,v_request.service_tier,(v_request.quote->>'priority_fee_aud')::numeric,v_event.created_at);
  END LOOP;
  RETURN v_event.id;
END;
$$;

CREATE FUNCTION public.save_exchange_request_settings(p_actor_id uuid,p_expected_version integer,p_settings jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,public AS $$
DECLARE v_row public.exchange_request_settings%ROWTYPE; v_email text; v_day text;
BEGIN
  IF NOT public.exchange_request_is_admin(p_actor_id) THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
  SELECT * INTO STRICT v_row FROM public.exchange_request_settings WHERE id FOR UPDATE;
  IF v_row.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'REQUEST_CONFLICT: Reload settings' USING ERRCODE='40001'; END IF;
  IF jsonb_typeof(p_settings) IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_settings->'enabled') IS DISTINCT FROM 'boolean'
     OR jsonb_typeof(p_settings->'priority_enabled') IS DISTINCT FROM 'boolean'
     OR p_settings->>'timezone' IS DISTINCT FROM 'Australia/Sydney'
     OR COALESCE(p_settings->>'priority_fee_aud','') !~ '^[0-9]+(\.[0-9]{1,2})?$'
     OR (p_settings->>'priority_fee_aud')::numeric > 1000
     OR COALESCE(p_settings->>'priority_capacity','') !~ '^[0-9]+$'
     OR (p_settings->>'priority_capacity')::integer > 100
     OR COALESCE(p_settings->>'standard_minutes','') !~ '^[0-9]+$'
     OR (p_settings->>'standard_minutes')::integer NOT BETWEEN 1 AND 10080
     OR COALESCE(p_settings->>'priority_minutes','') !~ '^[0-9]+$'
     OR (p_settings->>'priority_minutes')::integer NOT BETWEEN 1 AND 10080
     OR COALESCE(p_settings->>'quote_minutes','') !~ '^[0-9]+$'
     OR (p_settings->>'quote_minutes')::integer NOT BETWEEN 1 AND 60
     OR COALESCE(p_settings->>'funding_minutes','') !~ '^[0-9]+$'
     OR (p_settings->>'funding_minutes')::integer NOT BETWEEN 1 AND 10080
     OR COALESCE(p_settings->>'max_amount_aud','') !~ '^[0-9]+(\.[0-9]{1,2})?$'
     OR (p_settings->>'max_amount_aud')::numeric NOT BETWEEN 1 AND 1000000
     OR COALESCE(p_settings->>'opening_hour','') !~ '^[0-9]+$'
     OR COALESCE(p_settings->>'closing_hour','') !~ '^[0-9]+$'
     OR (p_settings->>'opening_hour')::integer NOT BETWEEN 0 AND 23
     OR (p_settings->>'closing_hour')::integer NOT BETWEEN 1 AND 24
     OR (p_settings->>'opening_hour')::integer >= (p_settings->>'closing_hour')::integer
     OR jsonb_typeof(p_settings->'business_days') IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_settings->'holidays') IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_settings->'management_emails') IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_settings->'business_days') NOT BETWEEN 1 AND 7
     OR jsonb_array_length(p_settings->'holidays') > 366
     OR jsonb_array_length(p_settings->'management_emails') > 10 THEN
    RAISE EXCEPTION 'Invalid request settings' USING ERRCODE='22023';
  END IF;
  FOR v_day IN SELECT value FROM jsonb_array_elements_text(p_settings->'business_days') LOOP
    IF v_day !~ '^[0-6]$' THEN RAISE EXCEPTION 'Invalid business days'; END IF;
  END LOOP;
  FOR v_day IN SELECT value FROM jsonb_array_elements_text(p_settings->'holidays') LOOP
    IF v_day !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' OR v_day::date::text <> v_day THEN RAISE EXCEPTION 'Invalid holiday'; END IF;
  END LOOP;
  FOR v_email IN SELECT value FROM jsonb_array_elements_text(p_settings->'management_emails') LOOP
    IF char_length(v_email)>254 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Invalid management email'; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM unnest(ARRAY['payment_instructions_aud','payment_instructions_irt','priority_terms','priority_terms_fa']) key
    WHERE jsonb_typeof(p_settings->key) IS DISTINCT FROM 'string' OR char_length(p_settings->>key)>4000) THEN
    RAISE EXCEPTION 'Invalid instructions or terms';
  END IF;
  IF (p_settings->>'enabled')::boolean AND (jsonb_array_length(p_settings->'management_emails')=0
    OR btrim(p_settings->>'payment_instructions_aud')='' OR btrim(p_settings->>'payment_instructions_irt')='') THEN
    RAISE EXCEPTION 'Configure management recipients and both funding instructions before enabling requests';
  END IF;
  IF (p_settings->>'priority_enabled')::boolean AND (NOT (p_settings->>'enabled')::boolean
    OR (p_settings->>'priority_fee_aud')::numeric<=0 OR (p_settings->>'priority_capacity')::integer<=0
    OR (p_settings->>'priority_minutes')::integer >= (p_settings->>'standard_minutes')::integer
    OR btrim(p_settings->>'priority_terms')='' OR btrim(p_settings->>'priority_terms_fa')='') THEN
    RAISE EXCEPTION 'Configure priority price, capacity, target and both language terms before enabling it';
  END IF;
  UPDATE public.exchange_request_settings SET settings=p_settings,version=version+1,updated_by=p_actor_id,updated_at=now() WHERE id
    RETURNING * INTO v_row;
  INSERT INTO public.audit_logs(actor_id,actor_email,action,target_type,target_id,new_value)
  VALUES(p_actor_id,(SELECT email FROM auth.users WHERE id=p_actor_id),'REQUEST_SETTINGS_UPDATED','exchange_request_settings','true',to_jsonb(v_row));
  RETURN jsonb_build_object('version',v_row.version,'settings',v_row.settings);
END;
$$;

CREATE FUNCTION public.submit_exchange_request(p_actor_id uuid,p_quote_id uuid,p_idempotency_key uuid)
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
  PERFORM 1 FROM public.profiles WHERE id=p_actor_id AND kyc_status='approved' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Identity approval required'; END IF;
  PERFORM 1 FROM auth.users WHERE id=p_actor_id AND email_confirmed_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Verified email required'; END IF;
  IF NOT COALESCE((SELECT market_active FROM public.rates_history ORDER BY date DESC LIMIT 1),false) THEN RAISE EXCEPTION 'MARKET_PAUSED'; END IF;
  IF (q->>'raw_amount_aud')::numeric NOT BETWEEN 0.01 AND (v_settings.settings->>'max_amount_aud')::numeric
     OR (q->>'raw_amount_aud')::numeric <> round((q->>'raw_amount_aud')::numeric,2)
     OR (q->>'equivalent_toman')::numeric<=0 OR (q->>'applied_rate')::numeric<=0
     OR q->>'service_tier' NOT IN ('standard','priority') OR q->>'locale' NOT IN ('en','fa')
     OR q->>'customer_request_type' NOT IN ('buy_aud','sell_aud')
     OR q->>'company_trade_type' IS DISTINCT FROM CASE WHEN q->>'customer_request_type'='buy_aud' THEN 'sell_aud' ELSE 'buy_aud' END
     OR COALESCE(btrim(q->>'source_of_funds'),'')='' OR COALESCE(btrim(q->>'reason_for_transfer'),'')='' THEN
    RAISE EXCEPTION 'Invalid authoritative quote';
  END IF;
  IF q->>'recipient_id' IS NOT NULL THEN
    SELECT to_jsonb(recipient) INTO v_recipient FROM public.recipients recipient
    WHERE recipient.id=(q->>'recipient_id')::uuid AND recipient.user_id=p_actor_id FOR SHARE;
    IF NOT FOUND OR NOT v_recipient @> (q->'recipient_snapshot')
      OR v_recipient->>'direction' IS DISTINCT FROM CASE WHEN q->>'customer_request_type'='buy_aud' THEN 'aud' ELSE 'irt' END THEN
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
        AND (status IN ('ready','processing','reconciliation') OR (status IN ('submitted','under_review','action_required','awaiting_funds') AND funding_due_at>now()))) >= (v_settings.settings->>'priority_capacity')::integer
      OR EXISTS(SELECT 1 FROM public.exchange_requests WHERE user_id=p_actor_id AND service_tier='priority'
        AND (status IN ('ready','processing','reconciliation') OR (status IN ('submitted','under_review','action_required','awaiting_funds') AND funding_due_at>now()))) THEN
      RAISE EXCEPTION 'PRIORITY_CAPACITY: Choose standard or try later';
    END IF;
  ELSIF (q->>'priority_fee_aud')::numeric<>0 OR (q->>'priority_fee_amount')::numeric<>0 THEN RAISE EXCEPTION 'Invalid standard fee'; END IF;
  IF (q->>'base_fee_aud')::numeric<0 OR (q->>'priority_fee_aud')::numeric<0
    OR (q->>'equivalent_toman')::numeric IS DISTINCT FROM round(((q->>'raw_amount_aud')::numeric+
      CASE WHEN q->>'customer_request_type'='buy_aud' THEN (q->>'base_fee_aud')::numeric ELSE -(q->>'base_fee_aud')::numeric END)*(q->>'applied_rate')::numeric)
    OR q->>'funding_currency' IS DISTINCT FROM CASE WHEN q->>'customer_request_type'='buy_aud' THEN 'IRT' ELSE 'AUD' END
    OR q->>'recipient_currency' IS DISTINCT FROM CASE WHEN q->>'customer_request_type'='buy_aud' THEN 'AUD' ELSE 'IRT' END
    OR (q->>'recipient_amount')::numeric IS DISTINCT FROM CASE WHEN q->>'customer_request_type'='buy_aud' THEN (q->>'raw_amount_aud')::numeric ELSE (q->>'equivalent_toman')::numeric END
    OR (q->>'priority_fee_amount')::numeric IS DISTINCT FROM CASE WHEN q->>'funding_currency'='IRT' THEN round((q->>'priority_fee_aud')::numeric*(q->>'applied_rate')::numeric) ELSE (q->>'priority_fee_aud')::numeric END
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
    v_reference:='ZE'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
    BEGIN
      INSERT INTO public.transactions(user_id,type,amount_aud,equivalent_toman,applied_rate,ledger_fee_aud,status,
        source_of_funds,reason_for_transfer,recipient_id,promo_code,discount_amount,final_amount,loyalty_discount,reference_code,payment_link)
      VALUES(p_actor_id,q->>'company_trade_type',(q->>'raw_amount_aud')::numeric,(q->>'equivalent_toman')::numeric,
        (q->>'applied_rate')::numeric,(q->>'base_fee_aud')::numeric,'pending',q->>'source_of_funds',q->>'reason_for_transfer',
        (q->>'recipient_id')::uuid,q->>'promo_code',(q->>'discount_amount')::numeric,(q->>'raw_amount_aud')::numeric,
        (q->>'loyalty_discount')::numeric,v_reference,q->>'payment_link') RETURNING id INTO v_transaction_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN IF v_attempt=10 THEN RAISE; END IF;
    END;
  END LOOP;
  INSERT INTO public.exchange_requests(transaction_id,user_id,quote_id,idempotency_key,reference_code,quote,service_tier,priority_fee_status,funding_due_at,payment_instructions)
  VALUES(v_transaction_id,p_actor_id,p_quote_id,p_idempotency_key,v_reference,q,q->>'service_tier',
    CASE WHEN q->>'service_tier'='priority' THEN 'unpaid' ELSE 'not_applicable' END,
    now()+make_interval(mins=>(v_settings.settings->>'funding_minutes')::integer),
    CASE WHEN q->>'funding_currency'='AUD' THEN v_settings.settings->>'payment_instructions_aud' ELSE v_settings.settings->>'payment_instructions_irt' END) RETURNING * INTO v_request;
  UPDATE public.profiles SET loyalty_discount_toman=COALESCE(loyalty_discount_toman,0)+COALESCE((q->>'loyalty_discount')::numeric,0) WHERE id=p_actor_id;
  PERFORM public.emit_exchange_request_event(v_request.id,'submitted',p_actor_id,NULL);
  INSERT INTO public.audit_logs(actor_id,actor_email,action,target_type,target_id,new_value)
  VALUES(p_actor_id,(SELECT email FROM auth.users WHERE id=p_actor_id),'REQUEST_SUBMITTED','exchange_requests',v_request.id::text,
    jsonb_build_object('reference',v_reference,'quote_id',p_quote_id,'service_tier',q->>'service_tier'));
  PERFORM set_config('app.exchange_request_write',COALESCE(v_previous,''),true);
  RETURN to_jsonb(v_request);
END;
$$;

-- Transition implementation follows below. Every mutation and its milestone
-- deliveries commit together, with an expected version and durable command key.
CREATE FUNCTION public.transition_exchange_request(p_actor_id uuid,p_request_id uuid,p_expected_version integer,
  p_command_key uuid,p_action text,p_payload jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET timezone='UTC' AS $$
DECLARE
  r public.exchange_requests%ROWTYPE; v_before jsonb; v_result jsonb; v_command public.exchange_request_commands%ROWTYPE;
  v_admin boolean:=public.exchange_request_is_admin(p_actor_id); v_fingerprint text;
  v_message text:=NULLIF(btrim(p_payload->>'message'),''); v_event text:=p_action;
  v_account public.bank_accounts%ROWTYPE; v_payer public.bank_accounts%ROWTYPE; v_receiver public.bank_accounts%ROWTYPE;
  v_amount numeric; v_currency text; v_reference text; v_refund public.exchange_request_refunds%ROWTYPE;
  v_fee numeric:=0; v_method text; v_principal numeric; v_previous text:=current_setting('app.exchange_request_write',true);
BEGIN
  IF p_actor_id IS NULL OR p_request_id IS NULL OR p_command_key IS NULL OR p_expected_version IS NULL
    OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR char_length(COALESCE(v_message,''))>2000 THEN RAISE EXCEPTION 'Invalid request command'; END IF;
  -- All commands lock the same capacity row before the request: no claim,
  -- readiness, reservation or deadline sweep can race admission.
  PERFORM 1 FROM public.exchange_request_settings WHERE id FOR UPDATE;
  SELECT * INTO r FROM public.exchange_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND OR (r.user_id<>p_actor_id AND NOT v_admin) THEN RAISE EXCEPTION 'Request unavailable' USING ERRCODE='42501'; END IF;
  v_fingerprint:=md5(jsonb_build_object('actor',p_actor_id,'action',p_action,'payload',p_payload,'version',p_expected_version)::text);
  SELECT * INTO v_command FROM public.exchange_request_commands WHERE request_id=p_request_id AND command_key=p_command_key;
  IF FOUND THEN
    IF v_command.fingerprint<>v_fingerprint THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Command key reused'; END IF;
    RETURN v_command.result;
  END IF;
  IF r.version<>p_expected_version THEN RAISE EXCEPTION 'REQUEST_CONFLICT: Reload request' USING ERRCODE='40001'; END IF;
  IF NOT v_admin AND p_action NOT IN ('cancel','respond','payment_evidence') THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
  v_before:=to_jsonb(r);
  PERFORM set_config('app.exchange_request_write','on',true);

  CASE p_action
  WHEN 'review' THEN
    IF r.status NOT IN ('submitted','action_required','awaiting_funds','under_review') THEN RAISE EXCEPTION 'Invalid review transition'; END IF;
    r.status:='under_review'; r.owner_id:=p_actor_id; r.action_required:=NULL;
  WHEN 'request_info' THEN
    IF r.status NOT IN ('submitted','under_review','awaiting_funds','action_required') OR v_message IS NULL THEN
      RAISE EXCEPTION 'Information request requires a reviewable request and a customer message'; END IF;
    r.status:='action_required'; r.action_required:=v_message; r.owner_id:=p_actor_id;
  WHEN 'respond' THEN
    IF r.status<>'action_required' OR v_message IS NULL THEN RAISE EXCEPTION 'Provide the requested information'; END IF;
    IF EXISTS(SELECT 1 FROM public.exchange_request_refunds WHERE request_id=r.id AND status='pending') THEN
      RAISE EXCEPTION 'Finance must reconcile the pending refund'; END IF;
    r.status:='under_review'; r.action_required:=NULL;
  WHEN 'await_funds' THEN
    IF r.status NOT IN ('submitted','under_review','action_required') OR r.funding_received<>0
      OR r.funding_status<>'unpaid' OR r.funding_due_at<=now() THEN RAISE EXCEPTION 'Funding instructions require current unpaid request'; END IF;
    PERFORM 1 FROM public.profiles WHERE id=r.user_id AND kyc_status='approved' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Current identity approval required'; END IF;
    r.status:='awaiting_funds'; r.action_required:=NULL;
  WHEN 'payment_evidence' THEN
    IF r.status NOT IN ('awaiting_funds','action_required') OR v_message IS NULL THEN
      RAISE EXCEPTION 'Payment evidence requires funding instructions and a reference'; END IF;
    INSERT INTO public.exchange_request_tasks(request_id,kind,description,dedupe_key)
    VALUES(r.id,'payment_evidence',v_message,r.id||':evidence:'||p_command_key);
    -- Customer evidence never changes cleared funds or priority eligibility.
  WHEN 'confirm_funds' THEN
    IF r.status IN ('ready','processing','reconciliation','completed','cancelled','rejected')
      OR EXISTS(SELECT 1 FROM public.exchange_request_executions WHERE request_id=r.id)
      OR EXISTS(SELECT 1 FROM public.exchange_request_refunds WHERE request_id=r.id) THEN
      RAISE EXCEPTION 'Funding cannot be applied in this state'; END IF;
    v_reference:=NULLIF(btrim(p_payload->>'payment_reference'),'');
    v_currency:=p_payload->>'received_currency';
    IF jsonb_typeof(p_payload->'received_amount') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Payment amount required'; END IF;
    v_amount:=(p_payload->>'received_amount')::numeric;
    IF v_amount<=0 OR v_amount>=1000000000000000000 OR v_amount<>round(v_amount,2)
      OR v_currency NOT IN ('AUD','IRT') OR v_reference IS NULL OR char_length(v_reference) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'Invalid reconciled payment'; END IF;
    SELECT * INTO v_account FROM public.bank_accounts WHERE id=(p_payload->>'receiver_account_id')::uuid FOR SHARE;
    IF NOT FOUND OR v_account.currency<>v_currency THEN RAISE EXCEPTION 'Choose the reconciled receiving account'; END IF;
    INSERT INTO public.exchange_request_payments(request_id,payment_reference,amount,currency,account_id,actor_id)
    VALUES(r.id,v_reference,v_amount,v_currency,v_account.id,p_actor_id);
    IF v_currency=r.quote->>'funding_currency' THEN r.funding_received:=r.funding_received+v_amount; END IF;
    r.funding_status:=CASE WHEN r.funding_received>0 THEN 'partial' ELSE 'unpaid' END;
    IF v_currency IS DISTINCT FROM r.quote->>'funding_currency'
      OR EXISTS(SELECT 1 FROM public.exchange_request_payments WHERE request_id=r.id AND currency<>r.quote->>'funding_currency')
      OR r.funding_received>(r.quote->>'funding_total')::numeric OR r.funding_due_at<=now() THEN
      r.status:='action_required'; r.action_required:='Payment needs reconciliation. Please wait for the finance team.';
      INSERT INTO public.exchange_request_tasks(request_id,kind,description,dedupe_key)
      VALUES(r.id,'funding_discrepancy','Review wrong-currency, excess or late funds before processing.',r.id||':funding_discrepancy') ON CONFLICT(dedupe_key) DO NOTHING;
    ELSIF r.funding_received=(r.quote->>'funding_total')::numeric THEN
      PERFORM 1 FROM public.profiles WHERE id=r.user_id AND kyc_status='approved' FOR SHARE;
      IF NOT FOUND THEN
        r.status:='under_review'; r.action_required:=NULL;
      ELSE
        r.funding_status:='confirmed'; r.status:='ready'; r.ready_at:=now(); r.action_required:=NULL;
        r.handling_due_at:=public.exchange_request_business_due(now(),
          (r.quote->'policy_snapshot'->>CASE WHEN r.service_tier='priority' THEN 'priority_minutes' ELSE 'standard_minutes' END)::integer,
          r.quote->'policy_snapshot');
        IF r.service_tier='priority' THEN
          r.priority_fee_status:='paid';
          INSERT INTO public.exchange_request_fee_entries(request_id,kind,account_id,currency,amount,amount_aud,evidence_reference)
          VALUES(r.id,'collected',v_account.id,v_currency,(r.quote->>'priority_fee_amount')::numeric,(r.quote->>'priority_fee_aud')::numeric,v_reference);
        END IF;
      END IF;
    ELSE r.status:='awaiting_funds'; r.action_required:=NULL;
    END IF;
    v_event:=CASE WHEN r.status='ready' THEN 'ready' ELSE 'funds_recorded' END;
  WHEN 'start_processing' THEN
    IF r.status<>'ready' OR r.funding_status<>'confirmed' OR (r.service_tier='priority' AND r.priority_fee_status NOT IN ('paid','refund_pending','refunded')) THEN
      RAISE EXCEPTION 'Request is not ready'; END IF;
    PERFORM 1 FROM public.profiles WHERE id=r.user_id AND kyc_status='approved' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Current identity approval required'; END IF;
    -- Overdue standard work must be started before a newer priority request.
    IF r.service_tier='priority' AND EXISTS(SELECT 1 FROM public.exchange_requests WHERE service_tier='standard'
      AND status='ready' AND handling_due_at<=now() AND handling_due_at<r.handling_due_at) THEN
      RAISE EXCEPTION 'Start overdue standard work first'; END IF;
    INSERT INTO public.exchange_request_executions(request_id,claimed_by) VALUES(r.id,p_actor_id);
    r.status:='processing'; r.owner_id:=p_actor_id; r.handling_started_at:=now();
  WHEN 'record_uncertain_payout' THEN
    IF r.status<>'processing' OR v_message IS NULL THEN RAISE EXCEPTION 'Processing request and reconciliation reason required'; END IF;
    UPDATE public.exchange_request_executions SET status='uncertain' WHERE request_id=r.id AND status='claimed';
    IF NOT FOUND THEN RAISE EXCEPTION 'No active execution intent'; END IF;
    r.status:='reconciliation'; r.action_required:='The finance team is checking the bank result. No second payout will be attempted.';
    INSERT INTO public.exchange_request_tasks(request_id,kind,description,dedupe_key)
    VALUES(r.id,'payout_reconciliation',v_message,r.id||':payout_reconciliation') ON CONFLICT(dedupe_key) DO NOTHING;
    v_message:=r.action_required;
  WHEN 'complete' THEN
    IF r.status NOT IN ('processing','reconciliation') OR r.funding_status<>'confirmed'
      OR NOT EXISTS(SELECT 1 FROM public.exchange_request_executions WHERE request_id=r.id AND status IN ('claimed','uncertain')) THEN
      RAISE EXCEPTION 'A claimed execution and confirmed funding are required'; END IF;
    v_reference:=NULLIF(btrim(p_payload->>'settlement_reference'),'');
    IF v_reference IS NULL OR char_length(v_reference) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'Verified bank settlement reference required'; END IF;
    SELECT * INTO v_payer FROM public.bank_accounts WHERE id=(p_payload->>'payer_account_id')::uuid FOR SHARE;
    SELECT * INTO v_receiver FROM public.bank_accounts WHERE id=(p_payload->>'receiver_account_id')::uuid FOR SHARE;
    IF v_payer.id IS NULL OR v_receiver.id IS NULL OR v_payer.id=v_receiver.id
      OR v_payer.currency IS DISTINCT FROM r.quote->>'recipient_currency'
      OR v_receiver.currency IS DISTINCT FROM r.quote->>'funding_currency'
      OR EXISTS(SELECT 1 FROM public.exchange_request_payments WHERE request_id=r.id AND account_id<>v_receiver.id) THEN
      RAISE EXCEPTION 'Settlement accounts must match all reconciled receipts and the payout currency'; END IF;
    v_method:=COALESCE(p_payload->>'transfer_method','free');
    IF v_method NOT IN ('free','pol','paya','satna') OR (v_payer.currency='AUD' AND v_method<>'free') THEN RAISE EXCEPTION 'Invalid bank transfer method'; END IF;
    v_amount:=(r.quote->>'equivalent_toman')::numeric;
    IF (v_method='pol' AND v_amount>50000000) OR (v_method='paya' AND v_amount>200000000) THEN RAISE EXCEPTION 'Bank transfer method limit exceeded'; END IF;
    v_fee:=CASE v_method WHEN 'pol' THEN round(v_amount*0.0002) WHEN 'paya' THEN LEAST(round(v_amount*0.0001),7500)
      WHEN 'satna' THEN LEAST(round(v_amount*0.0002),35000) ELSE 0 END;
    PERFORM 1 FROM public.transactions WHERE id=r.transaction_id AND status='pending' FOR UPDATE;
    IF NOT FOUND OR EXISTS(SELECT 1 FROM public.ledger WHERE transaction_id=r.transaction_id) THEN RAISE EXCEPTION 'Linked accounting requires reconciliation'; END IF;
    IF COALESCE(p_payload->>'date_jalali','') !~ '^[0-9]{4}[/-][0-9]{2}[/-][0-9]{2}$' THEN RAISE EXCEPTION 'Accounting date required'; END IF;
    INSERT INTO public.ledger(transaction_id,date_gregorian,date_jalali,type,entry_type,exchange_rate,amount_aud,amount_toman,
      sender,recipient,fee_aud,payer_account_id,receiver_account_id,created_by)
    VALUES(r.transaction_id,current_date,p_payload->>'date_jalali',r.quote->>'company_trade_type','trade',
      (r.quote->>'applied_rate')::numeric,(r.quote->>'raw_amount_aud')::numeric,(r.quote->>'equivalent_toman')::numeric,
      r.quote->'sender_snapshot'->>'name',COALESCE(r.quote->'recipient_snapshot'->>'full_name',r.quote->'recipient_snapshot'->>'account_name',r.quote->>'institution_name'),
      (r.quote->>'base_fee_aud')::numeric,v_payer.id,v_receiver.id,p_actor_id);
    IF v_fee>0 THEN
      INSERT INTO public.bank_transfer_fee_accruals(transaction_id,fee_month,transfer_method,transaction_amount_toman,fee_amount_toman,
        payer_account_id,receiver_account_id,status,accrued_at,created_by)
      VALUES(r.transaction_id,date_trunc('month',now())::date,v_method,v_amount,v_fee,v_payer.id,v_receiver.id,'accrued',now(),p_actor_id);
    END IF;
    UPDATE public.transactions SET status='approved',approved_at=now() WHERE id=r.transaction_id;
    UPDATE public.exchange_request_executions SET status='settled',settlement_reference=v_reference,settled_at=now() WHERE request_id=r.id;
    UPDATE public.exchange_request_tasks SET status='completed',completed_at=now() WHERE request_id=r.id AND kind='payout_reconciliation' AND status='open';
    r.status:='completed'; r.action_required:=NULL;
  WHEN 'cancel','reject' THEN
    IF r.status IN ('processing','reconciliation','completed','cancelled','rejected')
      OR EXISTS(SELECT 1 FROM public.exchange_request_executions WHERE request_id=r.id) THEN RAISE EXCEPTION 'A committed payout cannot be cancelled'; END IF;
    IF p_action='reject' AND v_message IS NULL THEN RAISE EXCEPTION 'Customer-safe rejection reason required'; END IF;
    IF EXISTS(SELECT 1 FROM public.exchange_request_payments WHERE request_id=r.id AND currency<>r.quote->>'funding_currency') THEN
      RAISE EXCEPTION 'Wrong-currency funds need a reviewed manual return before closure'; END IF;
    IF r.priority_fee_status='paid' THEN
      INSERT INTO public.exchange_request_refunds(request_id,kind,amount,currency,reason)
      VALUES(r.id,'priority',(r.quote->>'priority_fee_amount')::numeric,r.quote->>'funding_currency','cancelled_before_processing') ON CONFLICT(request_id,kind) DO NOTHING;
      r.priority_fee_status:='refund_pending';
    END IF;
    v_principal:=r.funding_received-CASE WHEN r.priority_fee_status IN ('paid','refund_pending','refunded') THEN (r.quote->>'priority_fee_amount')::numeric ELSE 0 END;
    IF v_principal>0 AND r.funding_status<>'refunded' THEN
      INSERT INTO public.exchange_request_refunds(request_id,kind,amount,currency,reason)
      VALUES(r.id,'principal',v_principal,r.quote->>'funding_currency',p_action) ON CONFLICT(request_id,kind) DO NOTHING;
      r.funding_status:='refund_pending';
    END IF;
    IF EXISTS(SELECT 1 FROM public.exchange_request_refunds WHERE request_id=r.id AND status='pending') THEN
      r.status:='action_required'; r.action_required:='Cancellation requested. Finance is arranging the return of received funds.'; v_event:='refund_pending';
    ELSE
      r.status:=CASE WHEN p_action='reject' THEN 'rejected' ELSE 'cancelled' END; r.action_required:=NULL;
      UPDATE public.transactions SET status='rejected' WHERE id=r.transaction_id AND status='pending';
    END IF;
  WHEN 'confirm_refund' THEN
    SELECT * INTO v_refund FROM public.exchange_request_refunds WHERE request_id=r.id AND kind=p_payload->>'refund_kind' AND status='pending' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'No pending refund of this kind'; END IF;
    v_reference:=NULLIF(btrim(p_payload->>'refund_reference'),'');
    IF v_reference IS NULL OR char_length(v_reference) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'Verified return reference required'; END IF;
    SELECT * INTO v_payer FROM public.bank_accounts WHERE id=(p_payload->>'payer_account_id')::uuid FOR SHARE;
    IF NOT FOUND OR v_payer.currency<>v_refund.currency THEN RAISE EXCEPTION 'Refund account currency must match original funds'; END IF;
    UPDATE public.exchange_request_refunds SET status='returned',refund_reference=v_reference,account_id=v_payer.id,returned_at=now() WHERE id=v_refund.id;
    IF v_refund.kind='priority' THEN
      r.priority_fee_status:='refunded';
      INSERT INTO public.exchange_request_fee_entries(request_id,kind,account_id,currency,amount,amount_aud,evidence_reference)
      VALUES(r.id,'refunded',v_payer.id,v_refund.currency,v_refund.amount,(r.quote->>'priority_fee_aud')::numeric,v_reference);
    ELSE r.funding_status:='refunded'; END IF;
    IF r.funding_status='refunded' AND r.status='action_required' AND NOT EXISTS(SELECT 1 FROM public.exchange_request_refunds WHERE request_id=r.id AND status='pending') THEN
      r.status:='cancelled'; r.action_required:=NULL;
      UPDATE public.transactions SET status='rejected' WHERE id=r.transaction_id AND status='pending';
    END IF;
    v_event:='refund_returned';
  ELSE RAISE EXCEPTION 'Unknown request action';
  END CASE;

  -- Catch a breach even if the scheduled worker has not yet visited the row.
  IF r.service_tier='priority' AND r.priority_fee_status='paid' AND r.handling_due_at<now()
    AND (r.handling_started_at IS NULL OR r.handling_started_at>r.handling_due_at) THEN
    INSERT INTO public.exchange_request_refunds(request_id,kind,amount,currency,reason)
    VALUES(r.id,'priority',(r.quote->>'priority_fee_amount')::numeric,r.quote->>'funding_currency','handling_target_breached') ON CONFLICT(request_id,kind) DO NOTHING;
    r.priority_fee_status:='refund_pending';
    INSERT INTO public.exchange_request_tasks(request_id,kind,description,dedupe_key)
    VALUES(r.id,'priority_refund','Handling target missed. Return the priority fee.',r.id||':priority_refund') ON CONFLICT(dedupe_key) DO NOTHING;
  END IF;
  UPDATE public.exchange_requests SET status=r.status,version=version+1,priority_fee_status=r.priority_fee_status,
    funding_status=r.funding_status,funding_received=r.funding_received,action_required=r.action_required,owner_id=r.owner_id,
    handling_due_at=r.handling_due_at,handling_started_at=r.handling_started_at,ready_at=r.ready_at,updated_at=now()
  WHERE id=r.id RETURNING * INTO r;
  PERFORM public.emit_exchange_request_event(r.id,v_event,p_actor_id,v_message);
  IF v_before->>'priority_fee_status'='paid' AND r.priority_fee_status='refund_pending' AND v_event<>'refund_pending' THEN
    PERFORM public.emit_exchange_request_event(r.id,'refund_pending',NULL,NULL);
  END IF;
  INSERT INTO public.audit_logs(actor_id,actor_email,action,target_type,target_id,old_value,new_value)
  VALUES(p_actor_id,(SELECT email FROM auth.users WHERE id=p_actor_id),'REQUEST_'||upper(p_action),'exchange_requests',r.id::text,
    jsonb_build_object('status',v_before->>'status','version',v_before->'version'),
    jsonb_build_object('status',r.status,'version',r.version,'command_key',p_command_key));
  v_result:=to_jsonb(r);
  INSERT INTO public.exchange_request_commands(request_id,command_key,actor_id,fingerprint,result)
  VALUES(r.id,p_command_key,p_actor_id,v_fingerprint,v_result);
  PERFORM set_config('app.exchange_request_write',COALESCE(v_previous,''),true);
  RETURN v_result;
END;
$$;

CREATE FUNCTION public.sweep_exchange_request_deadlines() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.exchange_requests%ROWTYPE; v_count integer:=0; v_previous text:=current_setting('app.exchange_request_write',true);
BEGIN
  PERFORM 1 FROM public.exchange_request_settings WHERE id FOR UPDATE;
  PERFORM set_config('app.exchange_request_write','on',true);
  FOR r IN SELECT * FROM public.exchange_requests
    WHERE (status IN ('submitted','under_review','action_required','awaiting_funds') AND funding_due_at<=now() AND funding_status='unpaid'
      AND NOT EXISTS(SELECT 1 FROM public.exchange_request_payments WHERE request_id=exchange_requests.id))
    OR (status='ready' AND handling_due_at<=now()) ORDER BY created_at LIMIT 200 FOR UPDATE LOOP
    IF r.status='ready' THEN
      INSERT INTO public.exchange_request_tasks(request_id,kind,description,dedupe_key)
      VALUES(r.id,'handling_overdue','Handling deadline passed. Duty manager must review the queue.',r.id||':handling_overdue') ON CONFLICT(dedupe_key) DO NOTHING;
      IF NOT FOUND THEN CONTINUE; END IF;
      IF r.service_tier='priority' AND r.priority_fee_status='paid' THEN
        INSERT INTO public.exchange_request_refunds(request_id,kind,amount,currency,reason)
        VALUES(r.id,'priority',(r.quote->>'priority_fee_amount')::numeric,r.quote->>'funding_currency','handling_target_breached') ON CONFLICT(request_id,kind) DO NOTHING;
        UPDATE public.exchange_requests SET priority_fee_status='refund_pending',version=version+1,updated_at=now() WHERE id=r.id;
        PERFORM public.emit_exchange_request_event(r.id,'refund_pending',NULL,NULL);
      ELSE
        UPDATE public.exchange_requests SET version=version+1,updated_at=now() WHERE id=r.id;
        PERFORM public.emit_exchange_request_event(r.id,'handling_overdue',NULL,NULL);
      END IF;
    ELSE
      UPDATE public.exchange_requests SET status='expired',version=version+1,updated_at=now(),action_required=NULL WHERE id=r.id;
      UPDATE public.transactions SET status='rejected' WHERE id=r.transaction_id AND status='pending';
      PERFORM public.emit_exchange_request_event(r.id,'expired',NULL,NULL);
    END IF;
    v_count:=v_count+1;
  END LOOP;
  PERFORM set_config('app.exchange_request_write',COALESCE(v_previous,''),true);
  RETURN jsonb_build_object('updated',v_count);
END;
$$;

CREATE FUNCTION public.guard_exchange_request_transaction() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_tx uuid;
BEGIN
  IF TG_TABLE_NAME='transactions' THEN v_tx:=OLD.id;
  ELSE v_tx:=CASE WHEN TG_OP='DELETE' THEN OLD.transaction_id ELSE NEW.transaction_id END; END IF;
  IF current_setting('app.exchange_request_write',true) IS DISTINCT FROM 'on'
    AND (EXISTS(SELECT 1 FROM public.exchange_requests WHERE transaction_id=v_tx)
      OR (TG_TABLE_NAME='ledger' AND TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM public.exchange_requests WHERE transaction_id=OLD.transaction_id))) THEN
    RAISE EXCEPTION 'REQUEST_MANAGED_TRANSACTION: Use the request workflow for this linked transaction' USING ERRCODE='42501';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END;
$$;
CREATE TRIGGER guard_exchange_request_transaction BEFORE UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.guard_exchange_request_transaction();
CREATE TRIGGER guard_exchange_request_ledger BEFORE INSERT OR UPDATE OR DELETE ON public.ledger
FOR EACH ROW EXECUTE FUNCTION public.guard_exchange_request_transaction();

CREATE FUNCTION public.guard_exchange_request_immutable() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN RAISE EXCEPTION 'Request evidence is immutable; use an audited correction' USING ERRCODE='42501'; END;
$$;
CREATE TRIGGER guard_request_event_immutable BEFORE UPDATE OR DELETE ON public.exchange_request_events
FOR EACH ROW EXECUTE FUNCTION public.guard_exchange_request_immutable();
CREATE TRIGGER guard_request_payment_immutable BEFORE UPDATE OR DELETE ON public.exchange_request_payments
FOR EACH ROW EXECUTE FUNCTION public.guard_exchange_request_immutable();
CREATE TRIGGER guard_request_fee_immutable BEFORE UPDATE OR DELETE ON public.exchange_request_fee_entries
FOR EACH ROW EXECUTE FUNCTION public.guard_exchange_request_immutable();
CREATE TRIGGER guard_request_quote_immutable BEFORE UPDATE OR DELETE ON public.exchange_request_quotes
FOR EACH ROW EXECUTE FUNCTION public.guard_exchange_request_immutable();

-- Public clients cannot read staff evidence or invoke privileged RPCs directly.
-- Server actions authenticate/authorise each read; commands recheck actors here.
DO $$ DECLARE v_name text; v_function record; BEGIN
  FOREACH v_name IN ARRAY ARRAY['exchange_request_settings','exchange_request_quotes','exchange_requests','exchange_request_events',
    'exchange_request_commands','exchange_request_tasks','exchange_request_payments','exchange_request_executions','exchange_request_refunds',
    'exchange_request_fee_entries','exchange_request_notification_deliveries'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',v_name);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',v_name);
    EXECUTE format('GRANT ALL ON public.%I TO service_role',v_name);
  END LOOP;
  FOR v_function IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace
    AND proname IN ('exchange_request_is_admin','exchange_request_business_due','emit_exchange_request_event','save_exchange_request_settings',
      'submit_exchange_request','transition_exchange_request','sweep_exchange_request_deadlines','guard_exchange_request_transaction','guard_exchange_request_immutable') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',v_function.signature);
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.save_exchange_request_settings(uuid,integer,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_exchange_request(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.transition_exchange_request(uuid,uuid,integer,uuid,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.sweep_exchange_request_deadlines() TO service_role;
GRANT EXECUTE ON FUNCTION public.exchange_request_business_due(timestamptz,integer,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
