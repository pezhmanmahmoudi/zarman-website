-- Repair the partial notification deployment observed on 2026-10-05.
-- _24 installed finish_request_notification but its _19 dependencies were absent.
-- Apply after _46. Additive repair only: no delivery resets or email sends.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
BEGIN
  IF to_regprocedure('public.finish_request_notification(uuid,uuid,text,text,text,timestamptz)') IS NULL
    OR to_regprocedure('public.prepare_request_notification(uuid,uuid,jsonb,text)') IS NULL
    OR to_regprocedure('public.claim_request_notifications_for_request(uuid,uuid,integer,integer,uuid)') IS NULL
    OR to_regprocedure('public.retry_request_notification(uuid,uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Apply request notification migrations through _46 before _47';
  END IF;
END;
$preflight$;

CREATE TABLE IF NOT EXISTS public.exchange_request_email_events (
  event_id text PRIMARY KEY CHECK (length(event_id) BETWEEN 1 AND 200),
  event_type text NOT NULL CHECK (length(event_type) BETWEEN 1 AND 80),
  provider_id text,
  occurred_at timestamptz NOT NULL,
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS exchange_request_email_events_provider_idx
  ON public.exchange_request_email_events(provider_id);
CREATE UNIQUE INDEX IF NOT EXISTS exchange_request_notification_provider_idx
  ON public.exchange_request_notification_deliveries(provider_id) WHERE provider_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS exchange_request_notification_retry_idx
  ON public.exchange_request_notification_deliveries(next_attempt_at, created_at)
  WHERE status IN ('pending', 'leased');

ALTER TABLE public.exchange_request_email_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exchange_request_email_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.exchange_request_email_events TO service_role;

-- Same event aggregation as _19. A provider acceptance is not a delivery.
-- Verified callbacks may arrive early, repeatedly, or out of order.
CREATE OR REPLACE FUNCTION public.apply_request_email_events(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  d public.exchange_request_notification_deliveries%rowtype;
  accepted_time timestamptz;
  delivered_time timestamptz;
  has_bounce boolean;
  has_failed boolean;
  has_suppression boolean;
BEGIN
  SELECT * INTO d FROM public.exchange_request_notification_deliveries WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR d.provider_id IS NULL THEN RETURN; END IF;
  SELECT
    min(occurred_at) FILTER (WHERE event_type IN ('email.sent', 'email.delivered')),
    min(occurred_at) FILTER (WHERE event_type = 'email.delivered'),
    coalesce(bool_or(event_type = 'email.bounced'), false),
    coalesce(bool_or(event_type = 'email.failed'), false),
    coalesce(bool_or(event_type IN ('email.complained', 'email.suppressed')), false)
  INTO accepted_time, delivered_time, has_bounce, has_failed, has_suppression
  FROM public.exchange_request_email_events WHERE provider_id = d.provider_id;
  UPDATE public.exchange_request_notification_deliveries SET
    status = CASE WHEN has_suppression THEN 'suppressed'
                  WHEN has_bounce OR has_failed THEN 'failed'
                  WHEN delivered_time IS NOT NULL THEN 'delivered'
                  WHEN accepted_time IS NOT NULL AND status NOT IN ('delivered', 'failed', 'suppressed') THEN 'provider_accepted'
                  ELSE status END,
    provider_accepted_at = coalesce(provider_accepted_at, accepted_time),
    delivered_at = coalesce(delivered_at, delivered_time),
    last_error = CASE WHEN has_suppression THEN 'provider_suppressed'
                      WHEN has_bounce THEN 'provider_bounced'
                      WHEN has_failed THEN 'provider_failed'
                      WHEN delivered_time IS NOT NULL THEN NULL ELSE last_error END,
    updated_at = now()
  WHERE id = d.id;
  IF d.audience = 'customer' AND (has_bounce OR has_suppression) THEN
    INSERT INTO public.exchange_request_tasks(request_id, kind, description, dedupe_key)
    VALUES(d.request_id, 'contact_update', 'Customer email could not be delivered. Verify the account contact address.', 'email-contact:' || d.id::text)
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_request_email_event(
  p_event_id text, p_event_type text, p_provider_id text,
  p_occurred_at timestamptz, p_payload_hash text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE existing_hash text; delivery_id uuid;
BEGIN
  -- Matches the provider lock in finish_request_notification from _24.
  IF p_provider_id IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended(p_provider_id, 0)); END IF;
  INSERT INTO public.exchange_request_email_events(event_id, event_type, provider_id, occurred_at, payload_hash)
  VALUES(p_event_id, p_event_type, p_provider_id, p_occurred_at, p_payload_hash)
  ON CONFLICT (event_id) DO NOTHING;
  SELECT payload_hash INTO existing_hash FROM public.exchange_request_email_events WHERE event_id = p_event_id;
  IF existing_hash IS DISTINCT FROM p_payload_hash THEN RAISE EXCEPTION 'Provider event payload conflict'; END IF;
  SELECT id INTO delivery_id FROM public.exchange_request_notification_deliveries WHERE provider_id = p_provider_id;
  IF delivery_id IS NOT NULL THEN PERFORM public.apply_request_email_events(delivery_id); END IF;
  RETURN jsonb_build_object('recorded', true);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_request_email_events(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.record_request_email_event(text,text,text,timestamptz,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_request_email_event(text,text,text,timestamptz,text) TO service_role;

-- _24/_46 replaced these functions, assuming _19 had restricted their access.
-- Restore those base grants too when repairing a partially installed schema.
REVOKE ALL ON FUNCTION public.prepare_request_notification(uuid,uuid,jsonb,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_request_notification(uuid,uuid,text,text,text,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_request_notification(uuid,uuid,jsonb,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_request_notification(uuid,uuid,text,text,text,timestamptz) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
