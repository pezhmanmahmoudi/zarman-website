-- Immutable completion receipts and public milestone snapshots. No live mail is
-- sent by this migration. The authenticated worker delivers committed jobs.
BEGIN;

ALTER TABLE public.exchange_request_events ADD COLUMN customer_visible boolean NOT NULL DEFAULT true;
ALTER TABLE public.exchange_request_events ADD COLUMN internal_message text;
ALTER TABLE public.exchange_request_notification_deliveries ADD COLUMN payload_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
  CHECK(jsonb_typeof(payload_snapshot) = 'object');

CREATE TABLE public.exchange_request_completion_receipts (
  request_id uuid PRIMARY KEY REFERENCES public.exchange_requests(id),
  event_id uuid NOT NULL UNIQUE REFERENCES public.exchange_request_events(id),
  snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot) = 'object' AND snapshot->>'version' = '1'),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.exchange_request_completion_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exchange_request_completion_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.exchange_request_completion_receipts TO service_role;
CREATE TRIGGER guard_request_completion_receipt_immutable BEFORE UPDATE OR DELETE ON public.exchange_request_completion_receipts
  FOR EACH ROW EXECUTE FUNCTION public.guard_exchange_request_immutable();

CREATE OR REPLACE FUNCTION public.emit_exchange_request_event(p_request_id uuid,p_event_type text,p_actor_id uuid,p_message text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,public AS $$
DECLARE v_request public.exchange_requests%ROWTYPE; v_event public.exchange_request_events%ROWTYPE;
  v_execution public.exchange_request_executions%ROWTYPE;
  v_email text; v_settings jsonb; v_emails jsonb; v_snapshot jsonb; v_receipt jsonb; v_public boolean; v_public_message text;
BEGIN
  -- Also serialize direct privileged emitters; event sequence never races.
  SELECT * INTO STRICT v_request FROM public.exchange_requests WHERE id=p_request_id FOR UPDATE;
  v_public := p_event_type IN ('submitted','await_funds','review','request_info','respond','payment_evidence',
    'receipt_uploaded','ready','resume_funded_request','funds_recorded','start_processing','record_uncertain_payout','complete',
    'cancel','reject','refund_pending','refund_returned','expired');
  -- User-provided funding evidence, staff references and internal notes must
  -- never leak into either a public timeline or email body.
  v_public_message := CASE WHEN p_event_type IN ('request_info','reject','record_uncertain_payout') THEN p_message ELSE NULL END;
  INSERT INTO public.exchange_request_events(request_id,sequence,event_type,status,public_message,actor_id,customer_visible,internal_message)
  VALUES(p_request_id,COALESCE((SELECT max(sequence)+1 FROM public.exchange_request_events WHERE request_id=p_request_id),1),
    p_event_type,v_request.status,v_public_message,p_actor_id,v_public,p_message) RETURNING * INTO v_event;

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
  IF v_public THEN
    SELECT email INTO v_email FROM auth.users WHERE id=v_request.user_id AND email_confirmed_at IS NOT NULL;
    INSERT INTO public.exchange_request_notification_deliveries(request_id,event_id,event_sequence,event_type,audience,
      recipient_email,locale,reference,workflow_status,requested_tier,priority_fee_aud,created_at,payload_snapshot)
    VALUES(p_request_id,v_event.id,v_event.sequence,p_event_type,'customer',COALESCE(v_email,''),
      COALESCE(v_request.quote->>'locale','en'),v_request.reference_code,v_request.status,v_request.service_tier,
      (v_request.quote->>'priority_fee_aud')::numeric,v_event.created_at,v_snapshot);
  END IF;
  SELECT settings INTO v_settings FROM public.exchange_request_settings WHERE id;
  v_emails := v_settings->'management_emails';
  IF v_emails IS NULL OR jsonb_array_length(v_emails)=0 THEN v_emails := '[""]'::jsonb; END IF;
  FOR v_email IN SELECT DISTINCT lower(value) FROM jsonb_array_elements_text(v_emails) LOOP
    INSERT INTO public.exchange_request_notification_deliveries(request_id,event_id,event_sequence,event_type,audience,
      recipient_email,locale,reference,workflow_status,requested_tier,priority_fee_aud,created_at,payload_snapshot)
    VALUES(p_request_id,v_event.id,v_event.sequence,p_event_type,'management',v_email,'en',v_request.reference_code,
      v_request.status,v_request.service_tier,(v_request.quote->>'priority_fee_aud')::numeric,v_event.created_at,v_snapshot);
  END LOOP;
  RETURN v_event.id;
END;
$$;

CREATE FUNCTION public.guard_request_delivery_snapshot()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF ROW(NEW.request_id,NEW.event_id,NEW.event_sequence,NEW.event_type,NEW.audience,NEW.recipient_email,NEW.channel,NEW.locale,
    NEW.reference,NEW.workflow_status,NEW.requested_tier,NEW.priority_fee_aud,NEW.payload_snapshot,NEW.created_at)
    IS DISTINCT FROM ROW(OLD.request_id,OLD.event_id,OLD.event_sequence,OLD.event_type,OLD.audience,OLD.recipient_email,OLD.channel,OLD.locale,
    OLD.reference,OLD.workflow_status,OLD.requested_tier,OLD.priority_fee_aud,OLD.payload_snapshot,OLD.created_at)
    OR (OLD.rendered_payload IS NOT NULL AND (NEW.rendered_payload IS DISTINCT FROM OLD.rendered_payload OR NEW.template_version IS DISTINCT FROM OLD.template_version))
    OR (OLD.first_attempt_at IS NOT NULL AND NEW.first_attempt_at IS DISTINCT FROM OLD.first_attempt_at) THEN
    RAISE EXCEPTION 'Notification snapshot is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_request_delivery_snapshot BEFORE UPDATE ON public.exchange_request_notification_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.guard_request_delivery_snapshot();
REVOKE ALL ON FUNCTION public.guard_request_delivery_snapshot() FROM PUBLIC,anon,authenticated;

-- Worker RPC corrections follow below. In _19 the provider lock was placed in
-- prepare, where no provider id exists. Serialize acknowledgement with verified
-- callbacks inside finish instead, before acquiring the delivery row lock.

create or replace function public.prepare_request_notification(p_id uuid, p_worker_id uuid, p_payload jsonb, p_template_version text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare d public.exchange_request_notification_deliveries%rowtype;
begin
  select * into d from public.exchange_request_notification_deliveries where id = p_id for update;
  if not found or d.status <> 'leased' or d.lease_owner is distinct from p_worker_id or d.lease_expires_at <= now() then
    raise exception 'Notification lease lost';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or p_template_version is null
      or jsonb_typeof(p_payload->'to') <> 'array' or jsonb_array_length(p_payload->'to') <> 1
      or p_payload->'to'->>0 is distinct from d.recipient_email
      or not (p_payload ?& array['from', 'subject', 'html', 'text']) then
    raise exception 'Invalid notification payload';
  end if;
  if d.rendered_payload is not null and (d.rendered_payload is distinct from p_payload or d.template_version is distinct from p_template_version) then
    raise exception 'Notification payload is immutable';
  end if;
  if d.first_attempt_at is not null and d.first_attempt_at <= now() - interval '23 hours' then
    raise exception 'Notification requires reconciliation';
  end if;
  update public.exchange_request_notification_deliveries
  set rendered_payload = coalesce(rendered_payload, p_payload),
      template_version = coalesce(template_version, p_template_version),
      first_attempt_at = coalesce(first_attempt_at, now()), updated_at = now()
  where id = p_id returning * into d;
  return to_jsonb(d);
end;
$$;

create or replace function public.finish_request_notification(
  p_id uuid, p_worker_id uuid, p_status text, p_provider_id text default null,
  p_error_code text default null, p_next_attempt_at timestamptz default null
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare d public.exchange_request_notification_deliveries%rowtype;
begin
  if p_provider_id is not null then perform pg_advisory_xact_lock(hashtextextended(p_provider_id, 0)); end if;
  select * into d from public.exchange_request_notification_deliveries where id = p_id for update;
  if not found or d.status <> 'leased' or d.lease_owner is distinct from p_worker_id or d.lease_expires_at <= now() then
    raise exception 'Notification lease lost';
  end if;
  if p_status not in ('pending', 'provider_accepted', 'failed', 'reconciliation_required')
      or (p_status = 'provider_accepted' and (coalesce(length(p_provider_id), 0) = 0 or d.first_attempt_at is null))
      or (p_status = 'pending' and (p_next_attempt_at is null or p_next_attempt_at <= now()))
      or (p_error_code is not null and p_error_code !~ '^[a-z_]{1,100}$') then
    raise exception 'Invalid notification outcome';
  end if;
  update public.exchange_request_notification_deliveries set
    status = p_status,
    provider_id = coalesce(provider_id, p_provider_id),
    provider_accepted_at = case when p_status = 'provider_accepted' then coalesce(provider_accepted_at, now()) else provider_accepted_at end,
    last_error = p_error_code,
    next_attempt_at = coalesce(p_next_attempt_at, next_attempt_at),
    lease_owner = null, lease_expires_at = null, updated_at = now()
  where id = p_id;
  perform public.apply_request_email_events(p_id);
  select * into d from public.exchange_request_notification_deliveries where id = p_id;
  return to_jsonb(d);
end;
$$;


NOTIFY pgrst,'reload schema';
COMMIT;
