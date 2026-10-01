-- Request emails are sent only when an administrator approves a stage (or
-- sends a message) with "send email" ticked, inside that same server action.
-- There is no scheduler: nothing waits in a queue for a later run.
BEGIN;

-- Customer-originated and system (deadline sweep) events never create a
-- sendable email. Admin events keep the administrator's explicit decision.
CREATE OR REPLACE FUNCTION public.restrict_request_email_to_admin() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.status = 'pending' AND NOT EXISTS(
    SELECT 1 FROM public.exchange_request_events e
    WHERE e.id = NEW.event_id AND e.actor_id IS NOT NULL AND public.exchange_request_is_admin(e.actor_id)
  ) THEN
    NEW.status := 'skipped';
    NEW.last_error := 'admin_email_opt_out';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.restrict_request_email_to_admin() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS restrict_request_email_to_admin ON public.exchange_request_notification_deliveries;
CREATE TRIGGER restrict_request_email_to_admin BEFORE INSERT ON public.exchange_request_notification_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.restrict_request_email_to_admin();

-- Retire never-attempted jobs left by the old scheduled worker so stale status
-- emails are not sent later and do not hold back new admin-approved emails.
UPDATE public.exchange_request_notification_deliveries
SET status = 'skipped', last_error = 'queue_retired', updated_at = now()
WHERE status = 'pending' AND first_attempt_at IS NULL;

-- Claim the sendable emails of one request for the immediate, admin-triggered
-- send. Ignores retry backoff (the admin action is the trigger) but keeps the
-- per-recipient milestone order and lease ownership of the original worker.
CREATE OR REPLACE FUNCTION public.claim_request_notifications_for_request(
  p_worker_id uuid, p_request_id uuid, p_limit integer DEFAULT 10, p_lease_seconds integer DEFAULT 300
) RETURNS SETOF public.exchange_request_notification_deliveries
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF p_worker_id IS NULL OR p_request_id IS NULL OR p_limit NOT BETWEEN 1 AND 25 OR p_lease_seconds NOT BETWEEN 30 AND 300 THEN
    RAISE EXCEPTION 'Invalid notification claim';
  END IF;
  RETURN QUERY
  WITH candidates AS (
    SELECT d.id FROM public.exchange_request_notification_deliveries d
    WHERE d.request_id = p_request_id
      AND (d.status = 'pending' OR (d.status = 'leased' AND d.lease_expires_at <= now()))
      AND NOT EXISTS (
        SELECT 1 FROM public.exchange_request_notification_deliveries prior
        WHERE prior.request_id = d.request_id AND prior.audience = d.audience
          AND prior.recipient_email IS NOT DISTINCT FROM d.recipient_email
          AND prior.channel = d.channel AND prior.event_sequence < d.event_sequence
          AND prior.status IN ('pending', 'leased', 'reconciliation_required')
      )
    ORDER BY d.created_at, d.event_sequence, d.id
    FOR UPDATE OF d SKIP LOCKED LIMIT p_limit
  )
  UPDATE public.exchange_request_notification_deliveries d
  SET status = 'leased', lease_owner = p_worker_id,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      attempts = d.attempts + 1, updated_at = now()
  FROM candidates WHERE d.id = candidates.id RETURNING d.*;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_request_notifications_for_request(uuid, uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_request_notifications_for_request(uuid, uuid, integer, integer) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
