-- Web push notifications for customers (installed web app / browser).
-- Apply once, after 20261006_48_customer_telegram. No existing events are replayed.
-- Mirrors the Telegram queue: the same customer-visible admin events are queued
-- per customer, and the server sends them to every device the customer enabled.
BEGIN;

CREATE TABLE public.customer_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- The server POSTs to this URL, so only official push services are accepted (also checked in the app).
  endpoint text NOT NULL UNIQUE CHECK (length(endpoint) <= 1024 AND endpoint ~ '^https://[A-Za-z0-9.-]+(:443)?/'),
  p256dh text NOT NULL CHECK (p256dh ~ '^[A-Za-z0-9_-]{80,100}$'),
  auth text NOT NULL CHECK (auth ~ '^[A-Za-z0-9_-]{16,32}$'),
  locale text NOT NULL CHECK (locale IN ('en','fa')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_success_at timestamptz,
  last_test_at timestamptz,
  failure_count integer NOT NULL DEFAULT 0
);
CREATE INDEX customer_push_subscriptions_user ON public.customer_push_subscriptions(user_id, last_seen_at DESC);

CREATE TABLE public.customer_push_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.exchange_requests(id) ON DELETE CASCADE,
  event_id uuid NOT NULL UNIQUE REFERENCES public.exchange_request_events(id) ON DELETE CASCADE,
  event_sequence integer NOT NULL,
  event_type text NOT NULL,
  reference text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  worker_id uuid,
  lease_expires_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX customer_push_pending ON public.customer_push_deliveries(request_id, created_at) WHERE status IN ('pending','sending');

ALTER TABLE public.customer_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_push_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_push_subscriptions, public.customer_push_deliveries FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.customer_push_subscriptions, public.customer_push_deliveries TO service_role;

-- Same events as Telegram: customer-visible actions taken by an admin.
CREATE FUNCTION public.enqueue_customer_push_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.exchange_requests%ROWTYPE;
BEGIN
  IF NOT NEW.customer_visible OR NEW.actor_id IS NULL OR NOT public.exchange_request_is_admin(NEW.actor_id) THEN RETURN NEW; END IF;
  SELECT * INTO STRICT r FROM public.exchange_requests WHERE id=NEW.request_id;
  IF NEW.actor_id=r.user_id OR NEW.event_type IN ('customer_message','respond','receipt_uploaded','payment_evidence','submitted') THEN RETURN NEW; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.customer_push_subscriptions WHERE user_id=r.user_id) THEN RETURN NEW; END IF;
  INSERT INTO public.customer_push_deliveries(user_id,request_id,event_id,event_sequence,event_type,reference,created_at)
    VALUES(r.user_id,r.id,NEW.id,NEW.sequence,NEW.event_type,r.reference_code,NEW.created_at)
    ON CONFLICT(event_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER customer_push_event AFTER INSERT ON public.exchange_request_events FOR EACH ROW EXECUTE FUNCTION public.enqueue_customer_push_event();

-- Claims the next delivery for a request and returns it with the customer's devices.
-- Notifications for one transfer share a tag, so a repeated send replaces rather than duplicates:
-- an expired lease is simply retried.
CREATE FUNCTION public.claim_customer_push_delivery(p_worker_id uuid, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE d public.customer_push_deliveries%ROWTYPE;
BEGIN
  UPDATE public.customer_push_deliveries SET status='pending', worker_id=NULL, lease_expires_at=NULL
    WHERE request_id=p_request_id AND status='sending' AND lease_expires_at<now();
  SELECT * INTO d FROM public.customer_push_deliveries
    WHERE request_id=p_request_id AND status='pending' AND attempts<5
    ORDER BY created_at, event_sequence, id FOR UPDATE SKIP LOCKED LIMIT 1;
  IF d.id IS NULL THEN RETURN NULL; END IF;
  UPDATE public.customer_push_deliveries SET status='sending', attempts=attempts+1, worker_id=p_worker_id, lease_expires_at=now()+interval '1 minute'
    WHERE id=d.id;
  RETURN jsonb_build_object('id',d.id,'requestId',d.request_id,'eventType',d.event_type,'reference',d.reference,'createdAt',d.created_at,
    'subscriptions',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'endpoint',s.endpoint,'p256dh',s.p256dh,'auth',s.auth,'locale',s.locale))
      FROM public.customer_push_subscriptions s WHERE s.user_id=d.user_id),'[]'::jsonb));
END;
$$;

CREATE FUNCTION public.finish_customer_push_delivery(p_id uuid, p_worker_id uuid, p_status text, p_error text DEFAULT NULL,
  p_delivered uuid[] DEFAULT '{}', p_failed uuid[] DEFAULT '{}', p_gone uuid[] DEFAULT '{}')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF p_status NOT IN ('sent','failed','cancelled') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  -- A failed delivery goes back to the queue and is retried by the next dispatch for this transfer (max 5 attempts).
  UPDATE public.customer_push_deliveries SET status=CASE WHEN p_status='failed' AND attempts<5 THEN 'pending' ELSE p_status END,
    last_error=left(p_error,80), worker_id=NULL, lease_expires_at=NULL, sent_at=CASE WHEN p_status='sent' THEN now() ELSE NULL END
    WHERE id=p_id AND worker_id=p_worker_id AND status='sending';
  UPDATE public.customer_push_subscriptions SET last_success_at=now(), failure_count=0 WHERE id=ANY(p_delivered);
  UPDATE public.customer_push_subscriptions SET failure_count=failure_count+1 WHERE id=ANY(p_failed);
  -- 404/410 from the push service: the browser removed the subscription. Also drop devices that keep failing.
  DELETE FROM public.customer_push_subscriptions WHERE id=ANY(p_gone) OR (id=ANY(p_failed) AND failure_count>=20);
END;
$$;

DO $$ DECLARE f regprocedure; BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('enqueue_customer_push_event','claim_customer_push_delivery','finish_customer_push_delivery')
  LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f);
  END LOOP;
END $$;
COMMIT;
