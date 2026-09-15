-- Separate verified incoming funds and explicit customer questions from internal
-- finance readiness. Existing payment evidence, accounting entries, receipts,
-- event/email snapshots and idempotent command results remain immutable.
BEGIN;

ALTER TABLE public.exchange_requests ADD COLUMN customer_action_required text
  CHECK(customer_action_required IS NULL OR char_length(btrim(customer_action_required)) BETWEEN 1 AND 2000);

-- Recover only current, unanswered public questions. A previously completed
-- approval/waiver is not reopened by this migration.
-- Exact matched payments prove receipt even when another currency requires a
-- separate finance review. Use the final matching payment's timestamp, not now().
DO $$
DECLARE r public.exchange_requests%ROWTYPE; v_question text; v_received_at timestamptz;
  v_matched numeric; v_funding_status text; v_confirmed_at timestamptz;
BEGIN
  FOR r IN SELECT * FROM public.exchange_requests ORDER BY id FOR UPDATE LOOP
    v_question:=NULL;
    IF r.status IN ('submitted','under_review','awaiting_funds','action_required') THEN
      SELECT e.public_message INTO v_question FROM public.exchange_request_events e
      WHERE e.request_id=r.id AND e.event_type='request_info' AND e.customer_visible
        AND public.exchange_request_is_admin(e.actor_id)
        AND char_length(btrim(e.public_message)) BETWEEN 1 AND 2000
        AND NOT EXISTS(SELECT 1 FROM public.exchange_request_events later WHERE later.request_id=r.id
          AND later.sequence>e.sequence AND later.event_type IN
          ('request_info','respond','await_funds','resume_funded_request','ready','complete','cancel','reject','refund_returned'))
      ORDER BY e.sequence DESC LIMIT 1;
    END IF;
    SELECT COALESCE(sum(amount),0),max(created_at) INTO v_matched,v_received_at
      FROM public.exchange_request_payments WHERE request_id=r.id AND currency=r.quote->>'funding_currency';
    v_funding_status:=r.funding_status; v_confirmed_at:=r.funds_confirmed_at;
    IF r.payment_approved_at IS NOT NULL AND r.funding_status IN ('unpaid','partial','confirmed')
      AND v_matched>0 AND v_matched=(r.quote->>'funding_total')::numeric AND r.funding_received=v_matched THEN
      v_funding_status:='confirmed'; v_confirmed_at:=COALESCE(r.funds_confirmed_at,v_received_at);
    END IF;
    IF ROW(v_question,v_funding_status,v_confirmed_at)
      IS DISTINCT FROM ROW(r.customer_action_required,r.funding_status,r.funds_confirmed_at) THEN
      UPDATE public.exchange_requests SET customer_action_required=v_question,funding_status=v_funding_status,
        funds_confirmed_at=v_confirmed_at,version=version+1,updated_at=now() WHERE id=r.id;
      INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,old_value,new_value)
      VALUES(NULL,'REQUEST_RECEIVED_FUNDS_FACTS_BACKFILL','exchange_requests',r.id::text,
        jsonb_build_object('version',r.version,'funding_status',r.funding_status,'funds_confirmed_at',r.funds_confirmed_at,
          'customer_action_required',r.customer_action_required),
        jsonb_build_object('version',r.version+1,'funding_status',v_funding_status,'funds_confirmed_at',v_confirmed_at,
          'customer_action_required',v_question,'matched_payment_total',v_matched));
    END IF;
  END LOOP;
END;
$$;

CREATE FUNCTION public.exchange_request_has_finance_hold(p_request_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT EXISTS(SELECT 1 FROM public.exchange_request_payments p JOIN public.exchange_requests r ON r.id=p.request_id
      WHERE p.request_id=p_request_id AND p.currency<>r.quote->>'funding_currency')
    OR EXISTS(SELECT 1 FROM public.exchange_request_refunds WHERE request_id=p_request_id AND status='pending')
    OR EXISTS(SELECT 1 FROM public.exchange_request_tasks WHERE request_id=p_request_id AND status='open'
      AND kind IN ('funding_discrepancy','late_funding_review','funding_clearance_review','payout_reconciliation'));
$$;
REVOKE ALL ON FUNCTION public.exchange_request_has_finance_hold(uuid) FROM PUBLIC,anon,authenticated,service_role;

-- Keep the established accounting implementation and _29 outer retry/date
-- wrapper. Amend only reviewed branches; unexpected source drift aborts the
-- entire migration rather than silently installing an incomplete correction.
CREATE FUNCTION pg_temp.patch_request_function(p_function regprocedure,p_before text,p_after text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_definition text;
BEGIN
  v_definition:=replace(pg_get_functiondef(p_function),E'\r\n',E'\n');
  IF length(v_definition)-length(replace(v_definition,p_before,''))<>length(p_before) THEN
    RAISE EXCEPTION 'Request function requires migration review: %',p_function;
  END IF;
  EXECUTE replace(v_definition,p_before,p_after);
END;
$$;

SELECT pg_temp.patch_request_function('public.transition_exchange_request_accounting_core(uuid,uuid,integer,uuid,text,jsonb)',
$before$  v_before:=to_jsonb(r);$before$,
$after$  IF p_action IN ('start_processing','complete') AND r.customer_action_required IS NOT NULL THEN
    RAISE EXCEPTION 'Resolve or explicitly waive the customer question before settlement'; END IF;
  v_before:=to_jsonb(r);$after$);

SELECT pg_temp.patch_request_function('public.transition_exchange_request_accounting_core(uuid,uuid,integer,uuid,text,jsonb)',
$before$    IF r.status NOT IN ('submitted','under_review','awaiting_funds','action_required') OR v_message IS NULL THEN
      RAISE EXCEPTION 'Information request requires a reviewable request and a customer message'; END IF;$before$,
$after$    IF r.status NOT IN ('submitted','under_review','awaiting_funds','action_required','ready') OR v_message IS NULL
      OR EXISTS(SELECT 1 FROM public.exchange_request_executions WHERE request_id=r.id) THEN
      RAISE EXCEPTION 'Information request requires a reviewable request and a customer message'; END IF;$after$);

SELECT pg_temp.patch_request_function('public.transition_exchange_request_accounting_core(uuid,uuid,integer,uuid,text,jsonb)',
$before$    r.status:='action_required'; r.action_required:=v_message; r.owner_id:=p_actor_id;
  WHEN 'respond' THEN
    IF r.status<>'action_required' OR v_message IS NULL THEN RAISE EXCEPTION 'Provide the requested information'; END IF;
    IF EXISTS(SELECT 1 FROM public.exchange_request_refunds WHERE request_id=r.id AND status='pending') THEN
      RAISE EXCEPTION 'Finance must reconcile the pending refund'; END IF;
    r.status:='under_review'; r.action_required:=NULL;$before$,
$after$    r.status:='action_required'; r.action_required:=v_message; r.customer_action_required:=v_message; r.owner_id:=p_actor_id;
  WHEN 'respond' THEN
    IF r.customer_action_required IS NULL OR r.status NOT IN ('submitted','under_review','awaiting_funds','action_required')
      OR v_message IS NULL THEN RAISE EXCEPTION 'Respond only to an explicit customer question; otherwise send a message'; END IF;
    r.customer_action_required:=NULL;
    IF public.exchange_request_has_finance_hold(r.id) THEN
      r.status:='action_required'; r.action_required:='Finance is reviewing the recorded funds.';
    ELSE r.status:='under_review'; r.action_required:=NULL; END IF;$after$);

SELECT pg_temp.patch_request_function('public.transition_exchange_request_accounting_core(uuid,uuid,integer,uuid,text,jsonb)',
$before$    r.status:='awaiting_funds'; r.action_required:=NULL;
  WHEN 'payment_evidence' THEN$before$,
$after$    r.status:='awaiting_funds'; r.action_required:=NULL; r.customer_action_required:=NULL;
  WHEN 'payment_evidence' THEN$after$);

SELECT pg_temp.patch_request_function('public.transition_exchange_request_accounting_core(uuid,uuid,integer,uuid,text,jsonb)',
$before$    r.funding_status:=CASE WHEN r.funding_received>0 THEN 'partial' ELSE 'unpaid' END;
    IF v_currency IS DISTINCT FROM r.quote->>'funding_currency'$before$,
$after$    r.funding_status:=CASE WHEN r.funding_received>0 THEN 'partial' ELSE 'unpaid' END;
    -- Receipt of the exact quoted currency is a fact, independent of whether
    -- another payment or an outstanding question prevents finance release.
    IF r.funding_received=(r.quote->>'funding_total')::numeric
      AND (SELECT COALESCE(sum(amount),0) FROM public.exchange_request_payments
        WHERE request_id=r.id AND currency=r.quote->>'funding_currency')=r.funding_received THEN
      r.funding_status:='confirmed';
      r.funds_confirmed_at:=COALESCE(r.funds_confirmed_at,(SELECT max(created_at) FROM public.exchange_request_payments
        WHERE request_id=r.id AND currency=r.quote->>'funding_currency'));
    END IF;
    IF v_currency IS DISTINCT FROM r.quote->>'funding_currency'$after$);

SELECT pg_temp.patch_request_function('public.transition_exchange_request_accounting_core(uuid,uuid,integer,uuid,text,jsonb)',
$before$      ELSIF NOT FOUND THEN
        r.status:='under_review'; r.action_required:=NULL;$before$,
$after$      ELSIF NOT FOUND OR r.customer_action_required IS NOT NULL THEN
        -- Do not start the target or collect the separate Priority fee journal
        -- until identity checks and the explicit customer question are resolved.
        r.status:='under_review'; r.action_required:=NULL;$after$);

SELECT pg_temp.patch_request_function('public.transition_exchange_request_accounting_core(uuid,uuid,integer,uuid,text,jsonb)',
$before$      OR EXISTS(SELECT 1 FROM public.exchange_request_refunds WHERE request_id=r.id)
      OR EXISTS(SELECT 1 FROM public.exchange_request_executions WHERE request_id=r.id)
      OR (SELECT COALESCE(sum(amount),0) FROM public.exchange_request_payments WHERE request_id=r.id AND currency=r.quote->>'funding_currency')<>(r.quote->>'funding_total')::numeric THEN$before$,
$after$      -- Returning an overdue handling fee does not reverse the funded
      -- transfer principal. Every other refund still requires finance closure.
      OR EXISTS(SELECT 1 FROM public.exchange_request_refunds WHERE request_id=r.id
        AND (kind<>'priority' OR reason<>'handling_target_breached'))
      OR EXISTS(SELECT 1 FROM public.exchange_request_executions WHERE request_id=r.id)
      OR (SELECT COALESCE(sum(amount),0) FROM public.exchange_request_payments WHERE request_id=r.id AND currency=r.quote->>'funding_currency')<>(r.quote->>'funding_total')::numeric THEN$after$);

SELECT pg_temp.patch_request_function('public.transition_exchange_request_accounting_core(uuid,uuid,integer,uuid,text,jsonb)',
$before$    r.status:='ready'; r.ready_at:=now(); r.funds_confirmed_at:=now(); r.action_required:=NULL;$before$,
$after$    r.status:='ready'; r.ready_at:=COALESCE(r.ready_at,now()); r.funds_confirmed_at:=COALESCE(r.funds_confirmed_at,now());
    r.action_required:=NULL; r.customer_action_required:=NULL;$after$);

SELECT pg_temp.patch_request_function('public.transition_exchange_request_accounting_core(uuid,uuid,integer,uuid,text,jsonb)',
$before$    r.handling_due_at:=public.exchange_request_business_due(now(),
      (r.quote->'policy_snapshot'->>CASE WHEN r.service_tier='priority' THEN 'priority_minutes' ELSE 'standard_minutes' END)::integer,r.quote->'policy_snapshot');$before$,
$after$    -- A question asked after readiness must not restart its accepted target.
    r.handling_due_at:=COALESCE(r.handling_due_at,public.exchange_request_business_due(now(),
      (r.quote->'policy_snapshot'->>CASE WHEN r.service_tier='priority' THEN 'priority_minutes' ELSE 'standard_minutes' END)::integer,r.quote->'policy_snapshot'));$after$);

SELECT pg_temp.patch_request_function('public.transition_exchange_request_accounting_core(uuid,uuid,integer,uuid,text,jsonb)',
$before$  WHEN 'cancel','reject' THEN
    IF r.status$before$,
$after$  WHEN 'cancel','reject' THEN
    r.customer_action_required:=NULL;
    IF r.status$after$);

SELECT pg_temp.patch_request_function('public.transition_exchange_request_accounting_core(uuid,uuid,integer,uuid,text,jsonb)',
$before$  UPDATE public.exchange_requests SET status=r.status,version=version+1,priority_fee_status=r.priority_fee_status,$before$,
$after$  IF r.status IN ('completed','cancelled','rejected','expired') THEN r.customer_action_required:=NULL; END IF;
  UPDATE public.exchange_requests SET status=r.status,version=version+1,priority_fee_status=r.priority_fee_status,
    customer_action_required=r.customer_action_required,$after$);

SELECT pg_temp.patch_request_function('public.transition_exchange_request_accounting_core(uuid,uuid,integer,uuid,text,jsonb)',
$before$    jsonb_build_object('status',r.status,'version',r.version,'command_key',p_command_key));$before$,
$after$    jsonb_build_object('status',r.status,'version',r.version,'command_key',p_command_key,
      'customer_action_required',r.customer_action_required,'funding_status',r.funding_status,'funds_confirmed_at',r.funds_confirmed_at));$after$);

-- Customer chat answers a question only when staff explicitly requested one.
-- A normal message never dismisses a bank discrepancy, refund or review hold.
SELECT pg_temp.patch_request_function('public.send_exchange_request_message(uuid,uuid,integer,uuid,text,boolean)',
$before$  IF NOT v_admin AND r.status='action_required' THEN
    IF EXISTS(SELECT 1 FROM public.exchange_request_refunds WHERE request_id=r.id AND status='pending') THEN
      RAISE EXCEPTION 'Finance must reconcile the pending refund'; END IF;
    r.status:='under_review'; r.action_required:=NULL; v_event_type:='respond';
  END IF;
  UPDATE public.exchange_requests SET version=version+1,status=r.status,action_required=r.action_required,updated_at=now()$before$,
$after$  IF NOT v_admin AND r.customer_action_required IS NOT NULL THEN
    IF r.status NOT IN ('submitted','under_review','awaiting_funds','action_required') THEN
      RAISE EXCEPTION 'This customer question requires administrator review'; END IF;
    r.customer_action_required:=NULL; v_event_type:='respond';
    IF public.exchange_request_has_finance_hold(r.id) THEN
      r.status:='action_required'; r.action_required:='Finance is reviewing the recorded funds.';
    ELSE r.status:='under_review'; r.action_required:=NULL; END IF;
  END IF;
  UPDATE public.exchange_requests SET version=version+1,status=r.status,action_required=r.action_required,
    customer_action_required=r.customer_action_required,updated_at=now()$after$);

SELECT pg_temp.patch_request_function('public.send_exchange_request_message(uuid,uuid,integer,uuid,text,boolean)',
$before$      'message_id',v_message.id,'send_email',v_send_email));$before$,
$after$      'message_id',v_message.id,'send_email',v_send_email,'customer_action_required',r.customer_action_required));$after$);

-- A question never pauses an already-started handling promise. Include held,
-- pre-execution requests in the existing deadline/refund sweep. The core's
-- post-command breach check also covers resume/start before the next sweep.
SELECT pg_temp.patch_request_function('public.sweep_exchange_request_deadlines()',
$before$    WHERE (payment_approved_at IS NOT NULL AND status IN ('submitted','under_review','action_required','awaiting_funds') AND clearance_due_at<=now()$before$,
$after$    WHERE (payment_approved_at IS NOT NULL AND ready_at IS NULL
      AND status IN ('submitted','under_review','action_required','awaiting_funds') AND clearance_due_at<=now()$after$);

SELECT pg_temp.patch_request_function('public.sweep_exchange_request_deadlines()',
$before$       OR (status='ready' AND handling_due_at<=now()$before$,
$after$       OR (status IN ('ready','under_review','action_required') AND ready_at IS NOT NULL
         AND handling_started_at IS NULL AND handling_due_at<=now()$after$);

SELECT pg_temp.patch_request_function('public.sweep_exchange_request_deadlines()',
$before$    IF r.status='ready' THEN$before$,
$after$    IF r.ready_at IS NOT NULL AND r.handling_started_at IS NULL AND r.handling_due_at<=now() THEN$after$);

DROP FUNCTION pg_temp.patch_request_function(regprocedure,text,text);
REVOKE ALL ON FUNCTION public.transition_exchange_request_accounting_core(uuid,uuid,integer,uuid,text,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.send_exchange_request_message(uuid,uuid,integer,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.send_exchange_request_message(uuid,uuid,integer,uuid,text,boolean) TO service_role;

CREATE FUNCTION public.snapshot_request_customer_action() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  NEW.payload_snapshot:=NEW.payload_snapshot||jsonb_build_object('customer_action_required',
    (SELECT customer_action_required FROM public.exchange_requests WHERE id=NEW.request_id));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.snapshot_request_customer_action() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER snapshot_request_customer_action BEFORE INSERT ON public.exchange_request_notification_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_request_customer_action();

-- Scheduler expiry is also terminal; no expired request can retain a question.
CREATE FUNCTION public.clear_terminal_request_customer_action() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.status IN ('completed','cancelled','rejected','expired') THEN NEW.customer_action_required:=NULL; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.clear_terminal_request_customer_action() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER clear_terminal_request_customer_action BEFORE UPDATE OF status ON public.exchange_requests
  FOR EACH ROW EXECUTE FUNCTION public.clear_terminal_request_customer_action();

NOTIFY pgrst,'reload schema';
COMMIT;
