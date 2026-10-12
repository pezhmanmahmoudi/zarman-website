-- Apply after request migrations through 56. Installation changes no requests.
-- Reopen only an unpaid rejection; preserve the quote, evidence and audit trail.
BEGIN;

-- Extend the installed emitter without replacing its email/realtime fixes.
DO $patch$
DECLARE v_definition text; v_marker text := 'v_public := p_event_type IN (';
BEGIN
  v_definition := pg_get_functiondef('public.emit_exchange_request_event(uuid,text,uuid,text)'::regprocedure);
  IF position(v_marker || '''reopened'',' IN v_definition) = 0 THEN
    IF length(v_definition)-length(replace(v_definition,v_marker,'')) <> length(v_marker) THEN
      RAISE EXCEPTION 'Review the request event emitter before applying migration 57';
    END IF;
    EXECUTE replace(v_definition,v_marker,v_marker || '''reopened'',');
  END IF;
END;
$patch$;

CREATE OR REPLACE FUNCTION public.reopen_exchange_request(
  p_actor_id uuid,p_request_id uuid,p_expected_version integer,p_command_key uuid,p_payload jsonb DEFAULT '{}'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET timezone='UTC' AS $$
DECLARE
  r public.exchange_requests%ROWTYPE; v_transaction public.transactions%ROWTYPE;
  v_settings public.exchange_request_settings%ROWTYPE; v_command public.exchange_request_commands%ROWTYPE;
  v_reason text; v_fingerprint text; v_result jsonb; v_minutes integer; v_clearance integer;
  v_previous text:=current_setting('app.exchange_request_write',true);
  v_previous_email text:=current_setting('app.exchange_request_send_email',true);
BEGIN
  IF public.exchange_request_is_admin(p_actor_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501';
  END IF;
  IF p_request_id IS NULL OR p_expected_version IS NULL OR p_expected_version<1 OR p_command_key IS NULL
    OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_payload->'send_email') IS DISTINCT FROM 'boolean'
    OR jsonb_typeof(p_payload->'message') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'Enter the reopening reason and choose whether to send an email';
  END IF;
  v_reason:=NULLIF(btrim(p_payload->>'message'),'');
  IF v_reason IS NULL OR char_length(v_reason) NOT BETWEEN 3 AND 2000 THEN
    RAISE EXCEPTION 'Enter a reopening reason of 3 to 2000 characters';
  END IF;

  -- Match admission, settlement and deadline lock order.
  SELECT * INTO STRICT v_settings FROM public.exchange_request_settings WHERE id FOR UPDATE;
  SELECT * INTO r FROM public.exchange_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request unavailable' USING ERRCODE='42501'; END IF;
  v_fingerprint:=md5(jsonb_build_object('actor',p_actor_id,'action','reopen','payload',p_payload,'version',p_expected_version)::text);
  SELECT * INTO v_command FROM public.exchange_request_commands WHERE request_id=r.id AND command_key=p_command_key;
  IF FOUND THEN
    IF v_command.fingerprint<>v_fingerprint THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Command key reused'; END IF;
    RETURN v_command.result;
  END IF;
  IF r.version<>p_expected_version THEN RAISE EXCEPTION 'REQUEST_CONFLICT: Reload request' USING ERRCODE='PT409'; END IF;
  IF r.status<>'rejected' THEN RAISE EXCEPTION 'Only rejected requests can be reopened'; END IF;
  SELECT * INTO v_transaction FROM public.transactions WHERE id=r.transaction_id FOR UPDATE;
  IF NOT FOUND OR v_transaction.status<>'rejected' OR v_transaction.approved_at IS NOT NULL THEN
    RAISE EXCEPTION 'Linked accounting requires reconciliation before reopening';
  END IF;
  IF r.funding_status<>'unpaid' OR r.funding_received<>0 OR r.priority_fee_status NOT IN ('unpaid','not_applicable')
    OR r.funds_confirmed_at IS NOT NULL OR r.ready_at IS NOT NULL OR r.handling_started_at IS NOT NULL
    OR EXISTS(SELECT 1 FROM public.exchange_request_payments WHERE request_id=r.id)
    OR EXISTS(SELECT 1 FROM public.exchange_request_refunds WHERE request_id=r.id)
    OR EXISTS(SELECT 1 FROM public.exchange_request_executions WHERE request_id=r.id)
    OR EXISTS(SELECT 1 FROM public.exchange_request_fee_entries WHERE request_id=r.id)
    OR EXISTS(SELECT 1 FROM public.exchange_request_completion_receipts WHERE request_id=r.id)
    OR EXISTS(SELECT 1 FROM public.ledger WHERE transaction_id=r.transaction_id)
    OR EXISTS(SELECT 1 FROM public.bank_transfer_fee_accruals WHERE transaction_id=r.transaction_id) THEN
    RAISE EXCEPTION 'Requests with recorded funds, refunds or settlement require finance reconciliation before reopening';
  END IF;

  -- Prior payment approval is immutable. Renew only its payment window, with
  -- the same admission checks as approval. Unapproved requests keep no window.
  IF r.payment_approved_at IS NOT NULL THEN
    IF r.service_tier='priority' AND (
      (SELECT count(*) FROM public.exchange_requests other WHERE other.id<>r.id AND other.service_tier='priority'
        AND (other.status IN ('ready','processing','reconciliation') OR (other.payment_approved_at IS NOT NULL
          AND other.status IN ('submitted','under_review','action_required','awaiting_funds')
          AND (other.clearance_due_at>now() OR other.evidence_submitted_at IS NOT NULL OR other.funding_received>0))))
        >= (v_settings.settings->>'priority_capacity')::integer
      OR EXISTS(SELECT 1 FROM public.exchange_requests other WHERE other.id<>r.id AND other.user_id=r.user_id AND other.service_tier='priority'
        AND (other.status IN ('ready','processing','reconciliation') OR (other.payment_approved_at IS NOT NULL
          AND other.status IN ('submitted','under_review','action_required','awaiting_funds')
          AND (other.clearance_due_at>now() OR other.evidence_submitted_at IS NOT NULL OR other.funding_received>0))))
      OR EXISTS(SELECT 1 FROM public.exchange_requests WHERE service_tier='standard' AND status='ready' AND handling_due_at<=now())
    ) THEN RAISE EXCEPTION 'PRIORITY_CAPACITY: Wait for an available priority slot'; END IF;
    v_minutes:=(r.quote->'policy_snapshot'->>'funding_minutes')::integer;
    v_clearance:=CASE WHEN r.quote->>'funding_currency'='AUD'
      THEN COALESCE((r.quote->'policy_snapshot'->>'australian_clearance_minutes')::integer,1440) ELSE 1440 END;
    IF v_minutes IS NULL OR v_minutes NOT BETWEEN 1 AND 10080 OR v_clearance NOT BETWEEN 1440 AND 10080 THEN
      RAISE EXCEPTION 'Accepted payment window requires administrator review';
    END IF;
  END IF;

  PERFORM set_config('app.exchange_request_write','on',true);
  UPDATE public.transactions SET status='pending' WHERE id=r.transaction_id;
  UPDATE public.exchange_requests SET status='under_review',owner_id=p_actor_id,
    action_required=NULL,customer_action_required=NULL,handling_due_at=NULL,
    funding_due_at=CASE WHEN payment_approved_at IS NOT NULL THEN now()+make_interval(mins=>v_minutes) ELSE NULL END,
    clearance_due_at=CASE WHEN payment_approved_at IS NOT NULL THEN now()+make_interval(mins=>v_minutes+v_clearance) ELSE NULL END,
    version=version+1,updated_at=now()
    WHERE id=r.id RETURNING to_jsonb(exchange_requests.*) INTO v_result;
  PERFORM set_config('app.exchange_request_send_email',p_payload->>'send_email',true);
  -- The reason stays internal; the customer sees only the reopening milestone.
  PERFORM public.emit_exchange_request_event(r.id,'reopened',p_actor_id,v_reason);
  INSERT INTO public.audit_logs(actor_id,actor_email,action,target_type,target_id,old_value,new_value)
    VALUES(p_actor_id,(SELECT email FROM auth.users WHERE id=p_actor_id),'REQUEST_REOPENED','exchange_requests',r.id::text,
      jsonb_build_object('status',r.status,'version',r.version,'transaction_status',v_transaction.status,
        'funding_due_at',r.funding_due_at,'clearance_due_at',r.clearance_due_at),
      jsonb_build_object('status',v_result->'status','version',v_result->'version','transaction_status','pending',
        'funding_due_at',v_result->'funding_due_at','clearance_due_at',v_result->'clearance_due_at',
        'reason',v_reason,'command_key',p_command_key,'send_email',p_payload->'send_email'));
  INSERT INTO public.exchange_request_commands(request_id,command_key,actor_id,fingerprint,result)
    VALUES(r.id,p_command_key,p_actor_id,v_fingerprint,v_result);
  PERFORM set_config('app.exchange_request_write',COALESCE(v_previous,''),true);
  PERFORM set_config('app.exchange_request_send_email',COALESCE(v_previous_email,''),true);
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.reopen_exchange_request(uuid,uuid,integer,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_exchange_request(uuid,uuid,integer,uuid,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
