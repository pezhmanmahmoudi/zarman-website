-- Customer-only, durable administrator-approved email delivery.
-- Apply after _28 and _44. Does not send mail or rewrite immutable receipts.
-- Deploy the matching customer-only worker. Only explicit admin actions send.
BEGIN;

UPDATE public.exchange_request_settings SET settings=settings-'management_emails' WHERE id;
-- Preserve the deployed default expression and every unrelated setting. Do not
-- recreate an obsolete set of defaults or change quote validity/pricing here.
DO $default$
DECLARE definition text;
BEGIN
  SELECT pg_get_expr(d.adbin,d.adrelid) INTO definition
  FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum
  WHERE d.adrelid='public.exchange_request_settings'::regclass AND a.attname='settings';
  IF definition IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.exchange_request_settings ALTER COLUMN settings SET DEFAULT ((%s)::jsonb - %L)',definition,'management_emails');
  END IF;
END;
$default$;

-- Surgically remove management validation from the deployed legacy core. This
-- retains later patches such as _41 optional banking notices, the _28 bank
-- wrapper, all financial validation, optimistic version checks and audit.
DO $settings$
DECLARE definition text; updated_definition text;
BEGIN
  SELECT pg_get_functiondef('public.save_exchange_request_settings_legacy_core(uuid,integer,jsonb)'::regprocedure) INTO definition;
  definition:=replace(definition,chr(13)||chr(10),chr(10));
  IF strpos(definition,$marker$p_settings := p_settings - 'management_emails';$marker$)=0 THEN
    updated_definition:=definition;
    IF strpos(updated_definition,$old0$BEGIN
  p_settings :=$old0$)=0 THEN RAISE EXCEPTION 'Unexpected settings validator (0); no changes applied'; END IF;
    updated_definition:=replace(updated_definition,$old0$BEGIN
  p_settings :=$old0$,$new0$BEGIN
  p_settings := p_settings - 'management_emails';
  p_settings :=$new0$);
    IF strpos(updated_definition,$old1$v_email text; $old1$)=0 THEN RAISE EXCEPTION 'Unexpected settings validator (1); no changes applied'; END IF;
    updated_definition:=replace(updated_definition,$old1$v_email text; $old1$,$new1$$new1$);
    IF strpos(updated_definition,$old2$     OR jsonb_typeof(p_settings->'management_emails') IS DISTINCT FROM 'array'
$old2$)=0 THEN RAISE EXCEPTION 'Unexpected settings validator (2); no changes applied'; END IF;
    updated_definition:=replace(updated_definition,$old2$     OR jsonb_typeof(p_settings->'management_emails') IS DISTINCT FROM 'array'
$old2$,$new2$$new2$);
    IF strpos(updated_definition,$old3$     OR jsonb_array_length(p_settings->'holidays') > 366
     OR jsonb_array_length(p_settings->'management_emails') > 10 THEN$old3$)=0 THEN RAISE EXCEPTION 'Unexpected settings validator (3); no changes applied'; END IF;
    updated_definition:=replace(updated_definition,$old3$     OR jsonb_array_length(p_settings->'holidays') > 366
     OR jsonb_array_length(p_settings->'management_emails') > 10 THEN$old3$,$new3$     OR jsonb_array_length(p_settings->'holidays') > 366 THEN$new3$);
    IF strpos(updated_definition,$old4$  FOR v_email IN SELECT value FROM jsonb_array_elements_text(p_settings->'management_emails') LOOP
    IF char_length(v_email)>254 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Invalid management email'; END IF;
  END LOOP;
$old4$)=0 THEN RAISE EXCEPTION 'Unexpected settings validator (4); no changes applied'; END IF;
    updated_definition:=replace(updated_definition,$old4$  FOR v_email IN SELECT value FROM jsonb_array_elements_text(p_settings->'management_emails') LOOP
    IF char_length(v_email)>254 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Invalid management email'; END IF;
  END LOOP;
$old4$,$new4$$new4$);
    IF strpos(updated_definition,$old5$AND (jsonb_array_length(p_settings->'management_emails')=0
    OR btrim$old5$)=0 THEN RAISE EXCEPTION 'Unexpected settings validator (5); no changes applied'; END IF;
    updated_definition:=replace(updated_definition,$old5$AND (jsonb_array_length(p_settings->'management_emails')=0
    OR btrim$old5$,$new5$AND (btrim$new5$);
    IF strpos(updated_definition,$old6$Configure management recipients and both funding instructions$old6$)=0 THEN RAISE EXCEPTION 'Unexpected settings validator (6); no changes applied'; END IF;
    updated_definition:=replace(updated_definition,$old6$Configure management recipients and both funding instructions$old6$,$new6$Configure both funding instructions$new6$);
    EXECUTE updated_definition;
  END IF;
END;
$settings$;

CREATE OR REPLACE FUNCTION public.emit_exchange_request_event(p_request_id uuid,p_event_type text,p_actor_id uuid,p_message text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,public AS $$
DECLARE v_request public.exchange_requests%ROWTYPE; v_event public.exchange_request_events%ROWTYPE;
  v_execution public.exchange_request_executions%ROWTYPE;
  v_email text; v_snapshot jsonb; v_receipt jsonb; v_public boolean; v_public_message text;
  v_send_email boolean:=public.exchange_request_is_admin(p_actor_id)
    AND COALESCE(NULLIF(current_setting('app.exchange_request_send_email',true),'')::boolean,false);
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
    'sender_name',NULLIF(v_request.quote->'sender_snapshot'->>'name',''),
    'recipient_name',COALESCE(NULLIF(v_request.quote->'recipient_snapshot'->>'full_name',''),
      NULLIF(v_request.quote->'recipient_snapshot'->>'account_name',''),NULLIF(v_request.quote->>'institution_name','')),
    'recipient_amount',v_request.quote->'recipient_amount','recipient_currency',v_request.quote->>'recipient_currency',
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
  RETURN v_event.id;
END;
$$;

create or replace function public.prepare_request_notification(p_id uuid, p_worker_id uuid, p_payload jsonb, p_template_version text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare d public.exchange_request_notification_deliveries%rowtype;
begin
  select * into d from public.exchange_request_notification_deliveries where id = p_id for update;
  if not found or p_worker_id is null or d.status <> 'leased' or d.lease_owner is distinct from p_worker_id
      or d.lease_expires_at is null or d.lease_expires_at <= now() then
    raise exception 'Notification lease lost';
  end if;
  if d.audience <> 'customer' or not exists (
    select 1 from public.exchange_request_events e where e.id=d.event_id and e.send_email
      and e.actor_id is not null and public.exchange_request_is_admin(e.actor_id)
  ) then raise exception 'Customer email was not approved'; end if;
  if jsonb_typeof(p_payload) is distinct from 'object' or coalesce(length(p_template_version),0) not between 1 and 100
      or jsonb_typeof(p_payload->'to') is distinct from 'array' then
    raise exception 'Invalid notification payload';
  end if;
  if jsonb_array_length(p_payload->'to') <> 1
      or p_payload->'to'->>0 is distinct from d.recipient_email
      or not (p_payload ?& array['from', 'subject', 'html', 'text'])
      or exists(select 1 from unnest(array['from','subject','html','text']) field
        where jsonb_typeof(p_payload->field) is distinct from 'string')
      or p_payload ?| array['cc','bcc'] then
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

-- Defense in depth: retired code cannot create management mail or an unapproved
-- customer send. Skipped customer entries retain the administrator's decision.
CREATE OR REPLACE FUNCTION public.restrict_request_email_to_admin() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.audience <> 'customer' THEN RAISE EXCEPTION 'Only customer emails are supported'; END IF;
  IF NEW.status <> 'skipped' AND NOT EXISTS(
    SELECT 1 FROM public.exchange_request_events e WHERE e.id=NEW.event_id AND e.send_email
      AND e.actor_id IS NOT NULL AND public.exchange_request_is_admin(e.actor_id)
  ) THEN
    NEW.status:='skipped'; NEW.last_error:='admin_email_opt_out';
    NEW.lease_owner:=NULL; NEW.lease_expires_at:=NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.restrict_request_email_to_admin() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS restrict_request_email_to_admin ON public.exchange_request_notification_deliveries;
CREATE TRIGGER restrict_request_email_to_admin BEFORE INSERT ON public.exchange_request_notification_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.restrict_request_email_to_admin();

-- Preserve sent history and all original payloads, IDs and timestamps. Retiring
-- an unsent management job is not an assertion that an earlier attempt failed.
UPDATE public.exchange_request_notification_deliveries
SET status='skipped',last_error='management_email_disabled',lease_owner=NULL,lease_expires_at=NULL,updated_at=now()
WHERE audience='management' AND status IN ('pending','leased','reconciliation_required');
UPDATE public.exchange_request_notification_deliveries d
SET status='skipped',last_error='admin_email_opt_out',lease_owner=NULL,lease_expires_at=NULL,updated_at=now()
WHERE d.audience='customer' AND d.status IN ('pending','leased') AND NOT EXISTS(
  SELECT 1 FROM public.exchange_request_events e WHERE e.id=d.event_id AND e.send_email
    AND e.actor_id IS NOT NULL AND public.exchange_request_is_admin(e.actor_id)
);

-- An expired lease with no prepared payload has never reached network I/O and
-- is safe to retry. A prepared attempt outside Resend's 24h dedupe window is
-- ambiguous: freeze it for investigation, never mint another idempotency key.
UPDATE public.exchange_request_notification_deliveries
SET status='reconciliation_required',last_error='idempotency_window_reconciliation_required',
    lease_owner=NULL,lease_expires_at=NULL,updated_at=now()
WHERE audience='customer' AND first_attempt_at<=now()-interval '23 hours'
  AND (status='pending' OR (status='leased' AND (lease_expires_at IS NULL OR lease_expires_at<=now())));
UPDATE public.exchange_request_notification_deliveries
SET status='pending',last_error='expired_lease_recovered',lease_owner=NULL,lease_expires_at=NULL,
    next_attempt_at=now(),updated_at=now()
WHERE audience='customer' AND status='leased' AND first_attempt_at IS NULL
  AND (lease_expires_at IS NULL OR lease_expires_at<=now());

-- No global scheduled claiming remains. Drop the four-argument overload so
-- PostgREST resolves the new optional selected-delivery argument unambiguously.
DROP FUNCTION IF EXISTS public.claim_request_notifications(uuid,integer,integer);
DROP FUNCTION IF EXISTS public.claim_request_notifications_for_request(uuid,uuid,integer,integer);
-- A small cleanup batch prevents backlogs from monopolizing an admin action.
-- Explicit retry narrows both recovery and claiming to the selected delivery.
CREATE OR REPLACE FUNCTION public.claim_request_notifications_for_request(
  p_worker_id uuid,p_request_id uuid,p_limit integer DEFAULT 10,p_lease_seconds integer DEFAULT 300,
  p_delivery_id uuid DEFAULT NULL
) RETURNS SETOF public.exchange_request_notification_deliveries
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF p_worker_id IS NULL OR p_request_id IS NULL OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 25
    OR p_lease_seconds IS NULL OR p_lease_seconds NOT BETWEEN 30 AND 300 THEN
    RAISE EXCEPTION 'Invalid notification claim';
  END IF;
  WITH expired AS (
    SELECT d.id FROM public.exchange_request_notification_deliveries d
    WHERE d.audience='customer' AND d.request_id=p_request_id
      AND (p_delivery_id IS NULL OR d.id=p_delivery_id)
      AND d.first_attempt_at<=now()-interval '23 hours'
      AND (d.status='pending' OR (d.status='leased' AND (d.lease_expires_at IS NULL OR d.lease_expires_at<=now())))
    ORDER BY d.created_at,d.id FOR UPDATE OF d SKIP LOCKED LIMIT 100
  )
  UPDATE public.exchange_request_notification_deliveries d
  SET status='reconciliation_required',last_error='idempotency_window_reconciliation_required',
      lease_owner=NULL,lease_expires_at=NULL,updated_at=now()
  FROM expired WHERE d.id=expired.id;

  RETURN QUERY WITH candidates AS (
    SELECT d.id FROM public.exchange_request_notification_deliveries d
    WHERE d.audience='customer' AND d.request_id=p_request_id
      AND (p_delivery_id IS NULL OR d.id=p_delivery_id)
      AND (d.first_attempt_at IS NULL OR d.first_attempt_at>now()-interval '23 hours')
      AND d.provider_id IS NULL AND d.provider_accepted_at IS NULL AND d.delivered_at IS NULL
      AND ((d.status='pending' AND d.next_attempt_at<=now())
        OR (d.status='leased' AND (d.lease_expires_at IS NULL OR d.lease_expires_at<=now())))
      AND EXISTS(SELECT 1 FROM public.exchange_request_events e WHERE e.id=d.event_id AND e.send_email
        AND e.actor_id IS NOT NULL AND public.exchange_request_is_admin(e.actor_id))
      AND NOT EXISTS(
        SELECT 1 FROM public.exchange_request_notification_deliveries prior
        WHERE prior.request_id=d.request_id AND prior.audience='customer'
          AND prior.recipient_email IS NOT DISTINCT FROM d.recipient_email AND prior.channel=d.channel
          AND prior.event_sequence<d.event_sequence AND prior.status IN ('pending','leased','reconciliation_required')
      )
    ORDER BY d.created_at,d.event_sequence,d.id FOR UPDATE OF d SKIP LOCKED LIMIT p_limit
  )
  UPDATE public.exchange_request_notification_deliveries d
  SET status='leased',lease_owner=p_worker_id,lease_expires_at=now()+make_interval(secs=>p_lease_seconds),
      attempts=d.attempts+1,updated_at=now()
  FROM candidates WHERE d.id=candidates.id RETURNING d.*;
END;
$$;
-- Explicit admin retry advances the existing job; it never resets its immutable
-- payload, first attempt, identity or provider dedupe window. The status is
-- returned even for an ambiguous stale job so the UI can show the committed
-- reconciliation state without pretending a resend took place.
CREATE OR REPLACE FUNCTION public.retry_request_notification(p_actor_id uuid,p_request_id uuid,p_delivery_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE d public.exchange_request_notification_deliveries%ROWTYPE; v_previous_status text;
BEGIN
  IF NOT public.exchange_request_is_admin(p_actor_id) THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
  IF p_request_id IS NULL OR p_delivery_id IS NULL THEN RAISE EXCEPTION 'Invalid notification retry'; END IF;
  SELECT * INTO d FROM public.exchange_request_notification_deliveries WHERE id=p_delivery_id AND request_id=p_request_id FOR UPDATE;
  IF NOT FOUND OR d.audience<>'customer' OR NOT EXISTS(
    SELECT 1 FROM public.exchange_request_events e WHERE e.id=d.event_id AND e.send_email
      AND e.actor_id IS NOT NULL AND public.exchange_request_is_admin(e.actor_id)
  ) THEN RAISE EXCEPTION 'Customer email unavailable' USING ERRCODE='42501'; END IF;
  IF d.status NOT IN ('pending','failed','leased') OR d.provider_id IS NOT NULL
    OR d.provider_accepted_at IS NOT NULL OR d.delivered_at IS NOT NULL
    OR (d.status='leased' AND d.lease_expires_at>now()) THEN
    RAISE EXCEPTION 'Notification cannot be retried';
  END IF;
  v_previous_status:=d.status;
  UPDATE public.exchange_request_notification_deliveries SET
    status=CASE WHEN d.first_attempt_at<=now()-interval '23 hours' THEN 'reconciliation_required' ELSE 'pending' END,
    last_error=CASE WHEN d.first_attempt_at<=now()-interval '23 hours' THEN 'idempotency_window_reconciliation_required' ELSE NULL END,
    next_attempt_at=now(),lease_owner=NULL,lease_expires_at=NULL,updated_at=now()
  WHERE id=d.id RETURNING * INTO d;
  INSERT INTO public.audit_logs(actor_id,actor_email,action,target_type,target_id,old_value,new_value)
  VALUES(p_actor_id,(SELECT email FROM auth.users WHERE id=p_actor_id),'REQUEST_EMAIL_RETRY',
    'exchange_request_notification_deliveries',d.id::text,jsonb_build_object('status',v_previous_status),
    jsonb_build_object('request_id',d.request_id,'status',d.status));
  RETURN to_jsonb(d);
END;
$$;

REVOKE ALL ON FUNCTION public.save_exchange_request_settings_legacy_core(uuid,integer,jsonb) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.claim_request_notifications_for_request(uuid,uuid,integer,integer,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.retry_request_notification(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_request_notifications_for_request(uuid,uuid,integer,integer,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.retry_request_notification(uuid,uuid,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
