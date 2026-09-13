-- Structured, copyable funding details and Persian instructions. Historical
-- requests and queued email snapshots retain exactly the values they accepted.
BEGIN;

ALTER TABLE public.exchange_requests
  ADD COLUMN payment_details jsonb CHECK(payment_details IS NULL OR jsonb_typeof(payment_details)='object'),
  ADD COLUMN payment_instructions_fa text CHECK(payment_instructions_fa IS NULL OR char_length(payment_instructions_fa)<=4000);
UPDATE public.exchange_request_settings SET settings=jsonb_build_object(
  'payment_details_aud','{}'::jsonb,'payment_details_irt','{}'::jsonb,
  'payment_instructions_aud_fa','','payment_instructions_irt_fa','',
  'iran_banking_notice_fa','واریز در ایران تابع چرخه‌های ساتنا و پایا و ساعات کاری بانک است.') || settings;

CREATE FUNCTION public.exchange_request_bank_details_valid(p_details jsonb,p_currency text,p_required boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public AS $$
BEGIN
  IF jsonb_typeof(p_details) IS DISTINCT FROM 'object' OR p_currency NOT IN ('AUD','IRT')
    OR p_currency IS NULL OR p_required IS NULL THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_each(p_details) field
    WHERE field.key NOT IN ('account_name','bank_name','bsb','account_number','iban','card_number')
      OR jsonb_typeof(field.value) IS DISTINCT FROM 'string'
      OR char_length(field.value#>>'{}')>200
      OR (field.value#>>'{}') ~ '[[:cntrl:]]') THEN RETURN false; END IF;
  -- Optional identifiers can be omitted, but a supplied identifier must be
  -- usable. This also prevents a valid alternate IRT field masking a typo.
  IF COALESCE(p_details->>'bsb','')<>'' AND regexp_replace(p_details->>'bsb','[ -]','','g') !~ '^[0-9]{6}$'
    OR COALESCE(p_details->>'account_number','')<>'' AND regexp_replace(p_details->>'account_number','[ -]','','g')
      !~ (CASE WHEN p_currency='AUD' THEN '^[0-9]{5,12}$' ELSE '^[0-9]{5,20}$' END)
    OR COALESCE(p_details->>'iban','')<>'' AND upper(replace(p_details->>'iban',' ','')) !~ '^IR[0-9]{24}$'
    OR COALESCE(p_details->>'card_number','')<>'' AND regexp_replace(p_details->>'card_number','[ -]','','g') !~ '^[0-9]{16}$'
    THEN RETURN false; END IF;
  IF NOT p_required THEN RETURN true; END IF;
  IF COALESCE(btrim(p_details->>'account_name'),'')='' THEN RETURN false; END IF;
  IF p_currency='AUD' THEN
    RETURN COALESCE(regexp_replace(p_details->>'bsb','[[:space:]-]','','g') ~ '^[0-9]{6}$',false)
      AND COALESCE(regexp_replace(p_details->>'account_number','[[:space:]-]','','g') ~ '^[0-9]{5,12}$',false);
  END IF;
  RETURN COALESCE(regexp_replace(p_details->>'account_number','[[:space:]-]','','g') ~ '^[0-9]{5,20}$',false)
    OR COALESCE(upper(regexp_replace(p_details->>'iban','[[:space:]-]','','g')) ~ '^IR[0-9]{24}$',false)
    OR COALESCE(regexp_replace(p_details->>'card_number','[[:space:]-]','','g') ~ '^[0-9]{16}$',false);
END;
$$;
REVOKE ALL ON FUNCTION public.exchange_request_bank_details_valid(jsonb,text,boolean) FROM PUBLIC,anon,authenticated,service_role;

-- Retain all established settings validation, optimistic locking and audit.
ALTER FUNCTION public.save_exchange_request_settings(uuid,integer,jsonb)
  RENAME TO save_exchange_request_settings_legacy_core;
REVOKE ALL ON FUNCTION public.save_exchange_request_settings_legacy_core(uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.save_exchange_request_settings(p_actor_id uuid,p_expected_version integer,p_settings jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_currency text; v_details jsonb; v_enabled boolean;
BEGIN
  IF NOT public.exchange_request_is_admin(p_actor_id) THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_settings) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_settings->'enabled') IS DISTINCT FROM 'boolean' THEN
    RAISE EXCEPTION 'Invalid request settings' USING ERRCODE='22023'; END IF;
  p_settings:=jsonb_build_object('payment_details_aud','{}'::jsonb,'payment_details_irt','{}'::jsonb,
    'payment_instructions_aud_fa','','payment_instructions_irt_fa','',
    'iran_banking_notice_fa','واریز در ایران تابع چرخه‌های ساتنا و پایا و ساعات کاری بانک است.') || p_settings;
  v_enabled:=(p_settings->>'enabled')::boolean;
  IF EXISTS(SELECT 1 FROM unnest(ARRAY['payment_instructions_aud_fa','payment_instructions_irt_fa']) key
    WHERE jsonb_typeof(p_settings->key) IS DISTINCT FROM 'string' OR char_length(p_settings->>key)>4000)
    OR jsonb_typeof(p_settings->'iran_banking_notice_fa') IS DISTINCT FROM 'string'
    OR char_length(btrim(p_settings->>'iran_banking_notice_fa')) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'Invalid Persian instructions' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(ARRAY['payment_instructions_aud','payment_instructions_irt']) key
    WHERE p_settings ? key AND jsonb_typeof(p_settings->key) IS DISTINCT FROM 'string') THEN
    RAISE EXCEPTION 'Invalid instructions or terms' USING ERRCODE='22023'; END IF;
  FOREACH v_currency IN ARRAY ARRAY['AUD','IRT'] LOOP
    v_details:=p_settings->('payment_details_'||lower(v_currency));
    IF NOT public.exchange_request_bank_details_valid(v_details,v_currency,v_enabled) THEN
      RAISE EXCEPTION 'Configure valid % bank details before enabling requests',v_currency USING ERRCODE='22023'; END IF;
    IF public.exchange_request_bank_details_valid(v_details,v_currency,true) THEN
      IF COALESCE(btrim(p_settings->>('payment_instructions_'||lower(v_currency))),'')='' THEN
        p_settings:=jsonb_set(p_settings,ARRAY['payment_instructions_'||lower(v_currency)],
          to_jsonb('Include your transaction code in the transfer description.'::text));
      END IF;
      IF btrim(p_settings->>('payment_instructions_'||lower(v_currency)||'_fa'))='' THEN
        p_settings:=jsonb_set(p_settings,ARRAY['payment_instructions_'||lower(v_currency)||'_fa'],
          to_jsonb('کد تراکنش را در توضیحات انتقال بانکی وارد کنید.'::text));
      END IF;
    END IF;
  END LOOP;
  RETURN public.save_exchange_request_settings_legacy_core(p_actor_id,p_expected_version,p_settings);
END;
$$;
REVOKE ALL ON FUNCTION public.save_exchange_request_settings(uuid,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_exchange_request_settings(uuid,integer,jsonb) TO service_role;

CREATE FUNCTION public.snapshot_exchange_request_bank_details() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_settings jsonb; v_currency text:=NEW.quote->>'funding_currency';
BEGIN
  SELECT settings INTO STRICT v_settings FROM public.exchange_request_settings WHERE id FOR UPDATE;
  NEW.payment_details:=v_settings->('payment_details_'||lower(v_currency));
  IF NOT public.exchange_request_bank_details_valid(NEW.payment_details,v_currency,true) THEN
    RAISE EXCEPTION 'Funding bank details are not configured' USING ERRCODE='22023'; END IF;
  NEW.payment_instructions_fa:=COALESCE(NULLIF(btrim(v_settings->>('payment_instructions_'||lower(v_currency)||'_fa')),''),
    'کد تراکنش را در توضیحات انتقال بانکی وارد کنید.');
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.snapshot_exchange_request_bank_details() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER snapshot_exchange_request_bank_details BEFORE INSERT ON public.exchange_requests
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_exchange_request_bank_details();

CREATE OR REPLACE FUNCTION public.guard_exchange_request_snapshot() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF ROW(NEW.transaction_id,NEW.user_id,NEW.quote_id,NEW.idempotency_key,NEW.reference_code,NEW.quote,NEW.service_tier,
      NEW.payment_instructions,NEW.payment_details,NEW.payment_instructions_fa)
    IS DISTINCT FROM ROW(OLD.transaction_id,OLD.user_id,OLD.quote_id,OLD.idempotency_key,OLD.reference_code,OLD.quote,OLD.service_tier,
      OLD.payment_instructions,OLD.payment_details,OLD.payment_instructions_fa) THEN
    RAISE EXCEPTION 'Accepted request quote and payment instructions are immutable' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END;
$$;

-- New email jobs use the same accepted bank details and language-specific note
-- as the dashboard. Existing jobs and rendered payloads are never changed.
CREATE FUNCTION public.snapshot_request_delivery_bank_details() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.exchange_requests%ROWTYPE;
BEGIN
  SELECT * INTO STRICT r FROM public.exchange_requests WHERE id=NEW.request_id;
  NEW.payload_snapshot:=NEW.payload_snapshot||jsonb_build_object('iran_banking_notice_fa',
    COALESCE(NULLIF(r.quote->'policy_snapshot'->>'iran_banking_notice_fa',''),
      'واریز در ایران تابع چرخه‌های ساتنا و پایا و ساعات کاری بانک است.'));
  IF NEW.event_type IN ('submitted','await_funds') THEN
    NEW.payload_snapshot:=NEW.payload_snapshot||jsonb_strip_nulls(jsonb_build_object(
      'payment_details',r.payment_details,'payment_instructions_fa',r.payment_instructions_fa));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.snapshot_request_delivery_bank_details() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER snapshot_request_delivery_bank_details BEFORE INSERT ON public.exchange_request_notification_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_request_delivery_bank_details();
NOTIFY pgrst,'reload schema';
COMMIT;
