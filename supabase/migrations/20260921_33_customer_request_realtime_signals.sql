-- Publish only an owner-scoped change signal to customer browsers. Financial
-- request snapshots and conversation bodies remain available through server
-- actions and are never granted to authenticated clients for Realtime.
BEGIN;

CREATE TABLE IF NOT EXISTS public.exchange_request_realtime_signals (
  request_id uuid PRIMARY KEY REFERENCES public.exchange_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS exchange_request_realtime_signals_user_id_idx
  ON public.exchange_request_realtime_signals(user_id);

ALTER TABLE public.exchange_request_realtime_signals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exchange_request_realtime_signals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.exchange_request_realtime_signals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exchange_request_realtime_signals TO service_role;

DROP POLICY IF EXISTS exchange_request_realtime_signals_owner_select
  ON public.exchange_request_realtime_signals;
CREATE POLICY exchange_request_realtime_signals_owner_select
  ON public.exchange_request_realtime_signals
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.touch_exchange_request_realtime_signal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_request_id uuid;
  v_user_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'exchange_requests' THEN
    IF TG_OP = 'DELETE' THEN
      DELETE FROM public.exchange_request_realtime_signals
      WHERE request_id = OLD.id;
      RETURN OLD;
    END IF;
    v_request_id := NEW.id;
    v_user_id := NEW.user_id;
  ELSE
    v_request_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.request_id ELSE NEW.request_id END;
    SELECT user_id INTO v_user_id
    FROM public.exchange_requests
    WHERE id = v_request_id;
  END IF;

  IF v_request_id IS NOT NULL AND v_user_id IS NOT NULL THEN
    INSERT INTO public.exchange_request_realtime_signals(request_id, user_id, updated_at)
    VALUES(v_request_id, v_user_id, clock_timestamp())
    ON CONFLICT (request_id) DO UPDATE
      SET user_id = EXCLUDED.user_id,
          updated_at = EXCLUDED.updated_at;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_exchange_request_realtime_signal() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.touch_exchange_request_realtime_signal() TO service_role;

DROP TRIGGER IF EXISTS touch_exchange_request_realtime_signal_on_request
  ON public.exchange_requests;
CREATE TRIGGER touch_exchange_request_realtime_signal_on_request
AFTER INSERT OR UPDATE OR DELETE ON public.exchange_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_exchange_request_realtime_signal();

DROP TRIGGER IF EXISTS touch_exchange_request_realtime_signal_on_message
  ON public.exchange_request_messages;
CREATE TRIGGER touch_exchange_request_realtime_signal_on_message
AFTER INSERT OR UPDATE OR DELETE ON public.exchange_request_messages
FOR EACH ROW EXECUTE FUNCTION public.touch_exchange_request_realtime_signal();

INSERT INTO public.exchange_request_realtime_signals(request_id, user_id, updated_at)
SELECT id, user_id, COALESCE(updated_at, created_at, now())
FROM public.exchange_requests
ON CONFLICT (request_id) DO UPDATE
  SET user_id = EXCLUDED.user_id,
      updated_at = GREATEST(
        public.exchange_request_realtime_signals.updated_at,
        EXCLUDED.updated_at
      );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'exchange_request_realtime_signals'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.exchange_request_realtime_signals';
  END IF;
END;
$$;

COMMENT ON TABLE public.exchange_request_realtime_signals IS
  'Minimal owner-scoped invalidation rows for customer request Realtime subscriptions.';

COMMIT;
