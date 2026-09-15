-- Staff approval precedes payment instructions and customer evidence. Final
-- reconciliation can close a funded request in one atomic, idempotent command.
BEGIN;

ALTER TABLE public.exchange_requests
  ADD COLUMN payment_approved_at timestamptz,
  ALTER COLUMN funding_due_at DROP NOT NULL,
  ALTER COLUMN clearance_due_at DROP NOT NULL;

-- Preserve the exact server-generated accounting date for retries across UTC
-- midnight. Older commands retain NULL; their fingerprints are never rewritten.
ALTER TABLE public.exchange_request_commands ADD COLUMN accounting_date_jalali text;

-- Before this release customers could already pay/upload from submission.
-- Grandfather proven approval, payment or sent evidence without changing any
-- historical event, reference, email payload or issued receipt.
UPDATE public.exchange_requests r SET payment_approved_at=COALESCE(
  (SELECT min(created_at) FROM public.exchange_request_events WHERE request_id=r.id AND event_type='await_funds'),
  (SELECT min(created_at) FROM public.exchange_request_events WHERE request_id=r.id
    AND event_type IN ('ready','funds_recorded','resume_funded_request','start_processing','complete')),
  (SELECT min(created_at) FROM public.exchange_request_payments WHERE request_id=r.id),
  (SELECT min(created_at) FROM public.exchange_request_receipts WHERE request_id=r.id),
  r.evidence_submitted_at,r.funds_confirmed_at,r.ready_at,
  CASE WHEN r.status IN ('awaiting_funds','ready','processing','reconciliation','completed') THEN r.created_at END);

CREATE FUNCTION public.initialize_request_payment_approval() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  NEW.payment_approved_at:=NULL;
  NEW.funding_due_at:=NULL;
  NEW.clearance_due_at:=NULL;
  RETURN NEW;
END;
$$;
CREATE TRIGGER initialize_request_payment_approval BEFORE INSERT ON public.exchange_requests
  FOR EACH ROW EXECUTE FUNCTION public.initialize_request_payment_approval();
REVOKE ALL ON FUNCTION public.initialize_request_payment_approval() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.guard_request_payment_approval() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.payment_approved_at IS DISTINCT FROM OLD.payment_approved_at
    AND (OLD.payment_approved_at IS NOT NULL OR NEW.payment_approved_at IS NULL
      OR current_setting('app.exchange_request_payment_approval',true) IS DISTINCT FROM 'on') THEN
    RAISE EXCEPTION 'Payment approval is immutable; use the staff approval command' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_request_payment_approval BEFORE UPDATE ON public.exchange_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_request_payment_approval();
REVOKE ALL ON FUNCTION public.guard_request_payment_approval() FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION public.transition_exchange_request(uuid,uuid,integer,uuid,text,jsonb)
  RENAME TO transition_exchange_request_notification_core;
REVOKE ALL ON FUNCTION public.transition_exchange_request_notification_core(uuid,uuid,integer,uuid,text,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.transition_exchange_request(p_actor_id uuid,p_request_id uuid,p_expected_version integer,
  p_command_key uuid,p_action text,p_payload jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
  r public.exchange_requests%ROWTYPE; v_settings public.exchange_request_settings%ROWTYPE;
  v_command public.exchange_request_commands%ROWTYPE; v_admin boolean:=public.exchange_request_is_admin(p_actor_id);
  v_fingerprint text; v_result jsonb; v_start_key uuid; v_complete_key uuid;
  v_previous_approval text:=current_setting('app.exchange_request_payment_approval',true);
  v_approved boolean:=false; v_minutes integer; v_clearance integer;
BEGIN
  IF p_actor_id IS NULL OR p_request_id IS NULL OR p_expected_version IS NULL OR p_command_key IS NULL
    OR p_action IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid request command'; END IF;
  SELECT * INTO STRICT v_settings FROM public.exchange_request_settings WHERE id FOR UPDATE;
  SELECT * INTO r FROM public.exchange_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND OR (r.user_id<>p_actor_id AND NOT v_admin) THEN
    RAISE EXCEPTION 'Request unavailable' USING ERRCODE='42501'; END IF;
  v_fingerprint:=md5(jsonb_build_object('actor',p_actor_id,'action',p_action,'payload',p_payload,'version',p_expected_version)::text);
  SELECT * INTO v_command FROM public.exchange_request_commands WHERE request_id=r.id AND command_key=p_command_key;
  IF FOUND THEN
    IF v_command.fingerprint<>v_fingerprint THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Command key reused'; END IF;
    RETURN v_command.result;
  END IF;
  IF r.version<>p_expected_version THEN RAISE EXCEPTION 'REQUEST_CONFLICT: Reload request' USING ERRCODE='40001'; END IF;
  IF v_admin AND jsonb_typeof(p_payload->'send_email') IS DISTINCT FROM 'boolean' THEN
    RAISE EXCEPTION 'Choose whether to send an email'; END IF;
  IF NOT v_admin AND p_action NOT IN ('cancel','respond','payment_evidence') THEN
    RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
  IF p_action IN ('payment_evidence','confirm_funds','resume_funded_request','start_processing',
    'record_uncertain_payout','complete','reconcile_complete') AND r.payment_approved_at IS NULL THEN
    RAISE EXCEPTION 'Wait for staff payment approval before continuing'; END IF;

  IF p_action='await_funds' AND r.payment_approved_at IS NULL THEN
    IF r.service_tier='priority' THEN
      -- Unapproved requests reserve no bank-clearance window. Recheck capacity
      -- when staff authorise payment, while holding the shared admission lock.
      IF (SELECT count(*) FROM public.exchange_requests other WHERE other.id<>r.id AND other.service_tier='priority'
        AND (other.status IN ('ready','processing','reconciliation') OR (other.payment_approved_at IS NOT NULL
          AND other.status IN ('submitted','under_review','action_required','awaiting_funds')
          AND (other.clearance_due_at>now() OR other.evidence_submitted_at IS NOT NULL OR other.funding_received>0))))
          >= (v_settings.settings->>'priority_capacity')::integer
        OR EXISTS(SELECT 1 FROM public.exchange_requests other WHERE other.id<>r.id AND other.user_id=r.user_id AND other.service_tier='priority'
          AND (other.status IN ('ready','processing','reconciliation') OR (other.payment_approved_at IS NOT NULL
            AND other.status IN ('submitted','under_review','action_required','awaiting_funds')
            AND (other.clearance_due_at>now() OR other.evidence_submitted_at IS NOT NULL OR other.funding_received>0))))
        OR EXISTS(SELECT 1 FROM public.exchange_requests WHERE service_tier='standard' AND status='ready' AND handling_due_at<=now()) THEN
        RAISE EXCEPTION 'PRIORITY_CAPACITY: Wait for an available priority slot';
      END IF;
    END IF;
    v_minutes:=(r.quote->'policy_snapshot'->>'funding_minutes')::integer;
    v_clearance:=CASE WHEN r.quote->>'funding_currency'='AUD'
      THEN COALESCE((r.quote->'policy_snapshot'->>'australian_clearance_minutes')::integer,1440) ELSE 1440 END;
    IF v_minutes IS NULL OR v_minutes NOT BETWEEN 1 AND 10080 OR v_clearance NOT BETWEEN 1440 AND 10080 THEN
      RAISE EXCEPTION 'Accepted payment window requires administrator review'; END IF;
    PERFORM set_config('app.exchange_request_payment_approval','on',true);
    UPDATE public.exchange_requests SET payment_approved_at=now(),funding_due_at=now()+make_interval(mins=>v_minutes),
      clearance_due_at=now()+make_interval(mins=>v_minutes+v_clearance) WHERE id=r.id RETURNING * INTO r;
    PERFORM set_config('app.exchange_request_payment_approval',COALESCE(v_previous_approval,''),true);
    v_approved:=true;
  END IF;

  IF p_action='reconcile_complete' THEN
    IF r.status<>'ready' OR r.funding_status<>'confirmed' THEN RAISE EXCEPTION 'Confirmed funds are required for final reconciliation'; END IF;
    IF COALESCE(p_payload->>'date_jalali','') !~ '^[0-9]{4}/[0-9]{2}/[0-9]{2}$' THEN RAISE EXCEPTION 'Verified Persian accounting date required'; END IF;
    -- Internal keys cannot be reused accidentally by the outer retry. The two
    -- original guarded financial commands and their audits remain atomic.
    v_start_key:=md5(p_command_key::text||':reconcile:start')::uuid;
    v_complete_key:=md5(p_command_key::text||':reconcile:complete')::uuid;
    v_result:=public.transition_exchange_request_notification_core(p_actor_id,r.id,r.version,v_start_key,
      'start_processing',jsonb_build_object('send_email',false));
    v_result:=public.transition_exchange_request_notification_core(p_actor_id,r.id,(v_result->>'version')::integer,
      v_complete_key,'complete',p_payload);
    INSERT INTO public.audit_logs(actor_id,actor_email,action,target_type,target_id,old_value,new_value)
    VALUES(p_actor_id,(SELECT email FROM auth.users WHERE id=p_actor_id),'REQUEST_RECONCILE_COMPLETE','exchange_requests',r.id::text,
      jsonb_build_object('status',r.status,'version',r.version),
      jsonb_build_object('status',v_result->>'status','version',v_result->'version','command_key',p_command_key,
        'send_email',p_payload->'send_email','start_command_key',v_start_key,'complete_command_key',v_complete_key));
    INSERT INTO public.exchange_request_commands(request_id,command_key,actor_id,fingerprint,result,accounting_date_jalali)
      VALUES(r.id,p_command_key,p_actor_id,v_fingerprint,v_result,p_payload->>'date_jalali');
  ELSE
    v_result:=public.transition_exchange_request_notification_core(p_actor_id,p_request_id,p_expected_version,p_command_key,p_action,p_payload);
    -- Only the newly executed outer command reaches here. Replays return above
    -- before any update, so neither the saved result nor its date can drift.
    UPDATE public.exchange_request_commands SET accounting_date_jalali=p_payload->>'date_jalali'
      WHERE request_id=r.id AND command_key=p_command_key;
    IF v_approved THEN
      INSERT INTO public.audit_logs(actor_id,actor_email,action,target_type,target_id,new_value)
      VALUES(p_actor_id,(SELECT email FROM auth.users WHERE id=p_actor_id),'REQUEST_PAYMENT_APPROVED','exchange_requests',r.id::text,
        jsonb_build_object('command_key',p_command_key,'payment_approved_at',r.payment_approved_at,
          'funding_due_at',r.funding_due_at,'clearance_due_at',r.clearance_due_at));
    END IF;
  END IF;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.transition_exchange_request(uuid,uuid,integer,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.transition_exchange_request(uuid,uuid,integer,uuid,text,jsonb) TO service_role;

ALTER FUNCTION public.attach_exchange_request_receipt(uuid,uuid,uuid,text,text,text,integer,text,uuid)
  RENAME TO attach_exchange_request_receipt_core;
REVOKE ALL ON FUNCTION public.attach_exchange_request_receipt_core(uuid,uuid,uuid,text,text,text,integer,text,uuid)
  FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.attach_exchange_request_receipt(p_actor_id uuid,p_request_id uuid,p_receipt_id uuid,p_path text,p_original_name text,
  p_content_type text,p_size_bytes integer,p_sha256 text,p_command_key uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.exchange_requests%ROWTYPE;
BEGIN
  PERFORM 1 FROM public.exchange_request_settings WHERE id FOR UPDATE;
  SELECT * INTO r FROM public.exchange_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND OR r.user_id IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION 'Request unavailable' USING ERRCODE='42501'; END IF;
  IF r.payment_approved_at IS NULL THEN RAISE EXCEPTION 'Wait for staff payment approval before sending a receipt'; END IF;
  RETURN public.attach_exchange_request_receipt_core(p_actor_id,p_request_id,p_receipt_id,p_path,p_original_name,
    p_content_type,p_size_bytes,p_sha256,p_command_key);
END;
$$;
REVOKE ALL ON FUNCTION public.attach_exchange_request_receipt(uuid,uuid,uuid,text,text,text,integer,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.attach_exchange_request_receipt(uuid,uuid,uuid,text,text,text,integer,text,uuid) TO service_role;
-- The service route stores objects, then registers their metadata through the
-- guarded RPC; direct metadata inserts would bypass its approval checks.
REVOKE INSERT ON public.exchange_request_receipts FROM service_role;

CREATE OR REPLACE FUNCTION public.snapshot_request_delivery_bank_details() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.exchange_requests%ROWTYPE;
BEGIN
  SELECT * INTO STRICT r FROM public.exchange_requests WHERE id=NEW.request_id;
  NEW.payload_snapshot:=NEW.payload_snapshot||jsonb_build_object('iran_banking_notice_fa',
    COALESCE(NULLIF(r.quote->'policy_snapshot'->>'iran_banking_notice_fa',''),
      'واریز در ایران تابع چرخه‌های ساتنا و پایا و ساعات کاری بانک است.'));
  IF r.payment_approved_at IS NULL THEN
    NEW.payload_snapshot:=NEW.payload_snapshot-ARRAY['payment_details','payment_instructions','payment_instructions_fa'];
  ELSIF NEW.event_type IN ('submitted','await_funds') THEN
    NEW.payload_snapshot:=NEW.payload_snapshot||jsonb_strip_nulls(jsonb_build_object(
      'payment_details',r.payment_details,'payment_instructions',r.payment_instructions,
      'payment_instructions_fa',r.payment_instructions_fa,'payment_approved_at',r.payment_approved_at));
  END IF;
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.sweep_exchange_request_deadlines() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.exchange_requests%ROWTYPE; v_count integer:=0; v_previous text:=current_setting('app.exchange_request_write',true);
BEGIN
  PERFORM 1 FROM public.exchange_request_settings WHERE id FOR UPDATE;
  PERFORM set_config('app.exchange_request_write','on',true);
  FOR r IN SELECT * FROM public.exchange_requests
    WHERE (payment_approved_at IS NOT NULL AND status IN ('submitted','under_review','action_required','awaiting_funds') AND clearance_due_at<=now()
      AND NOT EXISTS(SELECT 1 FROM public.exchange_request_tasks t WHERE t.request_id=exchange_requests.id AND t.dedupe_key=exchange_requests.id||':funding_clearance_review'))
       OR (status='ready' AND handling_due_at<=now()
      AND NOT EXISTS(SELECT 1 FROM public.exchange_request_tasks t WHERE t.request_id=exchange_requests.id AND t.dedupe_key=exchange_requests.id||':handling_overdue'))
    ORDER BY created_at LIMIT 200 FOR UPDATE LOOP
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
    ELSIF r.evidence_submitted_at IS NOT NULL OR r.funding_received>0
      OR EXISTS(SELECT 1 FROM public.exchange_request_payments WHERE request_id=r.id)
      OR EXISTS(SELECT 1 FROM public.exchange_request_receipts WHERE request_id=r.id) THEN
      -- Receipt evidence is not cleared cash. Do not expire or reprice an
      -- in-flight payment. The fixed allowance is never extended by uploads.
      INSERT INTO public.exchange_request_tasks(request_id,kind,description,dedupe_key)
      VALUES(r.id,'funding_clearance_review','Banking allowance elapsed. Reconcile the submitted evidence and bank balance before taking further action.',r.id||':funding_clearance_review') ON CONFLICT(dedupe_key) DO NOTHING;
      IF NOT FOUND THEN CONTINUE; END IF;
      UPDATE public.exchange_requests SET version=version+1,updated_at=now() WHERE id=r.id;
      PERFORM public.emit_exchange_request_event(r.id,'funding_clearance_review',NULL,NULL);
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

NOTIFY pgrst,'reload schema';
COMMIT;
