-- Let an administrator send the completion email (with receipt) AFTER a request is completed,
-- for the case where the "Send email to customer" box was not ticked at completion.
--
-- Completion already recorded a customer delivery for the 'complete' event with status 'skipped'
-- (admin_email_opt_out). This turns that same delivery into a normal pending one and records the
-- decision, so the existing worker (claim -> prepare -> send) and the 23h idempotency rules apply
-- unchanged. A delivery that was already sent or is already queued is returned untouched, so a
-- double click can never produce a second email.

BEGIN;

CREATE OR REPLACE FUNCTION public.send_completion_email(p_actor_id uuid, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_request public.exchange_requests%ROWTYPE;
  v_event public.exchange_request_events%ROWTYPE;
  v_delivery public.exchange_request_notification_deliveries%ROWTYPE;
  v_receipt jsonb;
  v_email text;
  v_previous_status text;
BEGIN
  IF NOT public.exchange_request_is_admin(p_actor_id) THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_request FROM public.exchange_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_request.status <> 'completed' THEN RAISE EXCEPTION 'Only a completed request has a completion email'; END IF;

  SELECT * INTO v_event FROM public.exchange_request_events
    WHERE request_id = p_request_id AND event_type = 'complete' ORDER BY sequence DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Completion event not found'; END IF;

  SELECT * INTO v_delivery FROM public.exchange_request_notification_deliveries
    WHERE event_id = v_event.id AND audience = 'customer' ORDER BY created_at DESC LIMIT 1 FOR UPDATE;

  -- Already sent, or already on its way: nothing to do.
  IF FOUND AND v_delivery.status IN ('pending', 'leased', 'provider_accepted', 'delivered') THEN
    RETURN to_jsonb(v_delivery);
  END IF;

  -- The worker only sends events an administrator approved for email.
  UPDATE public.exchange_request_events
    SET send_email = true,
        actor_id = CASE WHEN actor_id IS NOT NULL AND public.exchange_request_is_admin(actor_id) THEN actor_id ELSE p_actor_id END
    WHERE id = v_event.id;

  IF v_delivery.id IS NULL THEN
    -- Completed before email deliveries existed: build one from the stored completion receipt.
    SELECT snapshot INTO v_receipt FROM public.exchange_request_completion_receipts WHERE request_id = p_request_id AND event_id = v_event.id;
    IF v_receipt IS NULL THEN RAISE EXCEPTION 'Completion receipt unavailable'; END IF;
    SELECT email INTO v_email FROM auth.users WHERE id = v_request.user_id AND email_confirmed_at IS NOT NULL;
    INSERT INTO public.exchange_request_notification_deliveries(request_id, event_id, event_sequence, event_type, audience,
      recipient_email, locale, reference, workflow_status, requested_tier, priority_fee_aud, created_at, payload_snapshot, status)
    VALUES (p_request_id, v_event.id, v_event.sequence, 'complete', 'customer', COALESCE(v_email, ''),
      COALESCE(v_request.quote->>'locale', 'en'), v_request.reference_code, v_request.status, v_request.service_tier,
      COALESCE((v_request.quote->>'priority_fee_aud')::numeric, 0), now(),
      jsonb_strip_nulls(jsonb_build_object(
        'sender_name', NULLIF(v_request.quote->'sender_snapshot'->>'name', ''),
        'recipient_name', v_receipt->>'recipient_name',
        'recipient_amount', v_request.quote->'recipient_amount', 'recipient_currency', v_request.quote->>'recipient_currency',
        'funding_total', v_request.quote->'funding_total', 'funding_currency', v_request.quote->>'funding_currency',
        'receipt', v_receipt)),
      'pending')
    RETURNING * INTO v_delivery;
    v_previous_status := NULL;
  ELSE
    v_previous_status := v_delivery.status;
    -- Only a delivery that never left the building is re-armed. Failed or ambiguous ones keep
    -- their payload, first-attempt time and identity and go through retry_request_notification.
    IF v_delivery.status = 'skipped' THEN
      UPDATE public.exchange_request_notification_deliveries
        SET status = 'pending', last_error = NULL, next_attempt_at = now(), lease_owner = NULL, lease_expires_at = NULL, updated_at = now()
        WHERE id = v_delivery.id RETURNING * INTO v_delivery;
    END IF;
  END IF;

  INSERT INTO public.audit_logs(actor_id, actor_email, action, target_type, target_id, old_value, new_value)
  VALUES (p_actor_id, (SELECT email FROM auth.users WHERE id = p_actor_id), 'REQUEST_EMAIL_DECISION',
    'exchange_request_events', v_event.id::text, jsonb_build_object('send_email', false, 'delivery_status', v_previous_status),
    jsonb_build_object('request_id', p_request_id, 'event_type', 'complete', 'send_email', true, 'source', 'manual_after_completion'));

  RETURN to_jsonb(v_delivery);
END;
$$;

REVOKE ALL ON FUNCTION public.send_completion_email(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_completion_email(uuid, uuid) TO service_role;
NOTIFY pgrst, 'reload schema';

COMMIT;
