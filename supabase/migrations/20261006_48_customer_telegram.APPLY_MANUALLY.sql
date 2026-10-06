-- Apply once, after the request/message migrations. No existing events are replayed.
BEGIN;

CREATE TABLE public.customer_telegram_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bot_id bigint NOT NULL CHECK (bot_id > 0),
  chat_id bigint NOT NULL CHECK (chat_id > 0),
  display_name text NOT NULL CHECK (length(display_name) <= 160),
  username text,
  locale text NOT NULL CHECK (locale IN ('en','fa')),
  preview_messages boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  source_challenge_id uuid NOT NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  disconnected_at timestamptz
);
CREATE UNIQUE INDEX customer_telegram_active_user ON public.customer_telegram_connections(user_id) WHERE active;
CREATE UNIQUE INDEX customer_telegram_active_chat ON public.customer_telegram_connections(bot_id,chat_id) WHERE active;

CREATE TABLE public.customer_telegram_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  bot_id bigint NOT NULL,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  locale text NOT NULL CHECK (locale IN ('en','fa')),
  chat_id bigint,
  display_name text,
  username text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes'
);

CREATE TABLE public.customer_telegram_updates (
  bot_id bigint NOT NULL,
  update_id bigint NOT NULL,
  chat_id bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(bot_id,update_id)
);
CREATE INDEX customer_telegram_update_age ON public.customer_telegram_updates(created_at);

CREATE TABLE public.customer_telegram_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.customer_telegram_connections(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.exchange_requests(id) ON DELETE CASCADE,
  event_id uuid NOT NULL UNIQUE REFERENCES public.exchange_request_events(id) ON DELETE CASCADE,
  event_sequence integer NOT NULL,
  event_type text NOT NULL,
  reference text NOT NULL,
  workflow_status text NOT NULL,
  funding_status text NOT NULL,
  preview_allowed boolean NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed','uncertain','cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  worker_id uuid,
  lease_expires_at timestamptz,
  provider_id text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX customer_telegram_pending ON public.customer_telegram_deliveries(request_id,created_at) WHERE status='pending';
CREATE INDEX customer_telegram_request ON public.customer_telegram_deliveries(request_id,event_sequence);
CREATE INDEX customer_telegram_connection_queue ON public.customer_telegram_deliveries(connection_id,created_at) WHERE status IN ('pending','sending');

ALTER TABLE public.customer_telegram_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_telegram_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_telegram_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_telegram_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_telegram_connections,public.customer_telegram_links,public.customer_telegram_updates,public.customer_telegram_deliveries FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.customer_telegram_connections,public.customer_telegram_links,public.customer_telegram_updates,public.customer_telegram_deliveries TO service_role;

-- Only authenticated server actions call this RPC; user_id always comes from auth.getUser().
CREATE FUNCTION public.customer_telegram_settings(p_user_id uuid,p_bot_id bigint,p_action text DEFAULT 'read',
  p_locale text DEFAULT 'en',p_token_hash text DEFAULT NULL,p_challenge_id uuid DEFAULT NULL,
  p_connection_id uuid DEFAULT NULL,p_preview boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE c public.customer_telegram_connections%ROWTYPE; l public.customer_telegram_links%ROWTYPE;
BEGIN
  IF p_locale NOT IN ('en','fa') OR p_bot_id IS NULL OR p_bot_id<=0 THEN RAISE EXCEPTION 'invalid_input'; END IF;
  PERFORM id FROM public.profiles WHERE id=p_user_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id AND email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'verified_account_required';
  END IF;
  DELETE FROM public.customer_telegram_links WHERE user_id=p_user_id AND expires_at<now();
  IF p_action='begin' THEN
    IF EXISTS(SELECT 1 FROM public.customer_telegram_connections WHERE user_id=p_user_id AND bot_id=p_bot_id AND active) THEN RAISE EXCEPTION 'already_connected'; END IF;
    IF EXISTS(SELECT 1 FROM public.customer_telegram_links WHERE user_id=p_user_id AND created_at>now()-interval '30 seconds') THEN RAISE EXCEPTION 'please_wait'; END IF;
    IF p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid_input'; END IF;
    DELETE FROM public.customer_telegram_links WHERE user_id=p_user_id;
    INSERT INTO public.customer_telegram_links(user_id,bot_id,token_hash,locale) VALUES(p_user_id,p_bot_id,p_token_hash,p_locale);
  ELSIF p_action='confirm' THEN
    SELECT * INTO l FROM public.customer_telegram_links WHERE id=p_challenge_id AND user_id=p_user_id AND bot_id=p_bot_id AND expires_at>now() FOR UPDATE;
    IF NOT FOUND OR l.chat_id IS NULL THEN
      IF NOT EXISTS(SELECT 1 FROM public.customer_telegram_connections WHERE user_id=p_user_id AND bot_id=p_bot_id AND active AND source_challenge_id=p_challenge_id) THEN RAISE EXCEPTION 'link_expired'; END IF;
    ELSE
      IF EXISTS(SELECT 1 FROM public.customer_telegram_connections WHERE bot_id=p_bot_id AND chat_id=l.chat_id AND active) THEN RAISE EXCEPTION 'telegram_already_connected'; END IF;
      INSERT INTO public.customer_telegram_connections(user_id,bot_id,chat_id,display_name,username,locale,source_challenge_id)
        VALUES(p_user_id,p_bot_id,l.chat_id,l.display_name,l.username,l.locale,l.id);
      DELETE FROM public.customer_telegram_links WHERE id=l.id;
    END IF;
  ELSIF p_action='disconnect' THEN
    UPDATE public.customer_telegram_connections SET active=false,disconnected_at=now()
      WHERE id=p_connection_id AND user_id=p_user_id AND bot_id=p_bot_id AND active;
    DELETE FROM public.customer_telegram_links WHERE user_id=p_user_id AND bot_id=p_bot_id;
  ELSIF p_action='cancel' THEN
    DELETE FROM public.customer_telegram_links WHERE id=p_challenge_id AND user_id=p_user_id AND bot_id=p_bot_id;
  ELSIF p_action='preferences' THEN
    UPDATE public.customer_telegram_connections SET preview_messages=COALESCE(p_preview,false),locale=p_locale
      WHERE id=p_connection_id AND user_id=p_user_id AND bot_id=p_bot_id AND active;
    IF NOT FOUND THEN RAISE EXCEPTION 'connection_changed'; END IF;
  ELSIF p_action<>'read' THEN RAISE EXCEPTION 'invalid_input';
  END IF;
  UPDATE public.customer_telegram_deliveries d SET status='cancelled',last_error='disconnected',worker_id=NULL,lease_expires_at=NULL
    FROM public.customer_telegram_connections x WHERE d.connection_id=x.id AND x.user_id=p_user_id AND NOT x.active AND d.status IN ('pending','sending');
  SELECT * INTO c FROM public.customer_telegram_connections WHERE user_id=p_user_id AND bot_id=p_bot_id AND active;
  SELECT * INTO l FROM public.customer_telegram_links WHERE user_id=p_user_id AND bot_id=p_bot_id AND expires_at>now();
  RETURN jsonb_build_object('connection',CASE WHEN c.id IS NOT NULL THEN jsonb_build_object('id',c.id,'displayName',c.display_name,'username',c.username,'previewMessages',c.preview_messages,'locale',c.locale) END,
    'pending',CASE WHEN l.id IS NOT NULL THEN jsonb_build_object('id',l.id,'displayName',l.display_name,'username',l.username,'claimed',l.chat_id IS NOT NULL,'expiresAt',l.expires_at) END);
END;
$$;

-- Telegram updates are authenticated by the webhook secret before reaching this RPC.
CREATE FUNCTION public.customer_telegram_webhook(p_bot_id bigint,p_update_id bigint,p_chat_id bigint,p_action text,
  p_token_hash text DEFAULT NULL,p_display_name text DEFAULT '',p_username text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE l public.customer_telegram_links%ROWTYPE; v_locale text:='en';
BEGIN
  IF p_chat_id IS NULL OR p_chat_id<=0 OR p_bot_id<=0 OR p_update_id<0 THEN RAISE EXCEPTION 'invalid_input'; END IF;
  DELETE FROM public.customer_telegram_updates WHERE created_at<now()-interval '7 days';
  INSERT INTO public.customer_telegram_updates(bot_id,update_id,chat_id) VALUES(p_bot_id,p_update_id,p_chat_id) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF p_action='start' THEN
    SELECT * INTO l FROM public.customer_telegram_links WHERE token_hash=p_token_hash AND bot_id=p_bot_id AND expires_at>now() FOR UPDATE;
    IF l.id IS NULL OR (l.chat_id IS NOT NULL AND l.chat_id<>p_chat_id) THEN RETURN NULL; END IF;
    UPDATE public.customer_telegram_links SET chat_id=p_chat_id,display_name=left(p_display_name,160),username=left(p_username,64) WHERE id=l.id;
    RETURN jsonb_build_object('kind','confirm','locale',l.locale);
  ELSIF p_action IN ('stop','blocked') THEN
    SELECT locale INTO v_locale FROM public.customer_telegram_connections WHERE bot_id=p_bot_id AND chat_id=p_chat_id AND active;
    UPDATE public.customer_telegram_connections SET active=false,disconnected_at=now() WHERE bot_id=p_bot_id AND chat_id=p_chat_id AND active;
    DELETE FROM public.customer_telegram_links WHERE bot_id=p_bot_id AND chat_id=p_chat_id;
    UPDATE public.customer_telegram_deliveries d SET status='cancelled',last_error='disconnected',worker_id=NULL,lease_expires_at=NULL
      FROM public.customer_telegram_connections c WHERE d.connection_id=c.id AND c.bot_id=p_bot_id AND c.chat_id=p_chat_id AND d.status IN ('pending','sending');
    RETURN CASE WHEN p_action='stop' THEN jsonb_build_object('kind','disconnected','locale',COALESCE(v_locale,'en')) ELSE NULL END;
  END IF;
  -- No financial actions or customer replies are accepted through Telegram.
  IF EXISTS(SELECT 1 FROM public.customer_telegram_updates WHERE bot_id=p_bot_id AND chat_id=p_chat_id AND update_id<>p_update_id AND created_at>now()-interval '30 seconds') THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('kind','help','locale','en');
END;
$$;

CREATE FUNCTION public.enqueue_customer_telegram_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.exchange_requests%ROWTYPE;
BEGIN
  IF NOT NEW.customer_visible OR NEW.actor_id IS NULL OR NOT public.exchange_request_is_admin(NEW.actor_id) THEN RETURN NEW; END IF;
  SELECT * INTO STRICT r FROM public.exchange_requests WHERE id=NEW.request_id;
  IF NEW.actor_id=r.user_id OR NEW.event_type IN ('customer_message','respond','receipt_uploaded','payment_evidence','submitted') THEN RETURN NEW; END IF;
  INSERT INTO public.customer_telegram_deliveries(connection_id,request_id,event_id,event_sequence,event_type,reference,workflow_status,funding_status,preview_allowed,created_at)
    SELECT c.id,r.id,NEW.id,NEW.sequence,NEW.event_type,r.reference_code,NEW.status,r.funding_status,c.preview_messages,NEW.created_at
    FROM public.customer_telegram_connections c WHERE c.user_id=r.user_id AND c.active
    ON CONFLICT(event_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER customer_telegram_event AFTER INSERT ON public.exchange_request_events FOR EACH ROW EXECUTE FUNCTION public.enqueue_customer_telegram_event();

CREATE FUNCTION public.claim_customer_telegram_delivery(p_bot_id bigint,p_worker_id uuid,p_request_id uuid,p_delivery_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_id uuid;
BEGIN
  -- Telegram has no idempotency key: an expired send lease requires review, never blind replay.
  UPDATE public.customer_telegram_deliveries SET status='uncertain',last_error='delivery_unconfirmed',worker_id=NULL,lease_expires_at=NULL WHERE status='sending' AND lease_expires_at<now();
  SELECT d.id INTO v_id FROM public.customer_telegram_deliveries d
    JOIN public.customer_telegram_connections c ON c.id=d.connection_id
    WHERE d.status='pending' AND c.bot_id=p_bot_id AND c.active AND d.request_id=p_request_id
      AND (p_delivery_id IS NULL OR d.id=p_delivery_id)
      AND NOT EXISTS(SELECT 1 FROM public.customer_telegram_deliveries older WHERE older.connection_id=d.connection_id AND older.status IN ('pending','sending')
        AND older.request_id=d.request_id AND (p_delivery_id IS NULL OR older.status='sending')
        AND (older.created_at,older.event_sequence,older.id)<(d.created_at,d.event_sequence,d.id))
    ORDER BY d.created_at,d.event_sequence,d.id FOR UPDATE OF c,d SKIP LOCKED LIMIT 1;
  IF v_id IS NULL THEN RETURN NULL; END IF;
  UPDATE public.customer_telegram_deliveries SET status='sending',attempts=attempts+1,worker_id=p_worker_id,lease_expires_at=now()+interval '2 minutes' WHERE id=v_id;
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.prepare_customer_telegram_delivery(p_id uuid,p_worker_id uuid,p_bot_id bigint)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT jsonb_build_object('id',d.id,'chatId',c.chat_id::text,'requestId',d.request_id,'eventType',d.event_type,
    'reference',d.reference,'status',d.workflow_status,'fundingStatus',d.funding_status,'locale',c.locale,'attempts',d.attempts,
    'createdAt',d.created_at,'message',CASE WHEN d.preview_allowed AND c.preview_messages THEN e.public_message ELSE NULL END)
  FROM public.customer_telegram_deliveries d JOIN public.customer_telegram_connections c ON c.id=d.connection_id
    JOIN public.exchange_request_events e ON e.id=d.event_id
  WHERE d.id=p_id AND d.worker_id=p_worker_id AND d.status='sending' AND d.lease_expires_at>now() AND c.active AND c.bot_id=p_bot_id;
$$;

CREATE FUNCTION public.finish_customer_telegram_delivery(p_id uuid,p_worker_id uuid,p_status text,
  p_error text DEFAULT NULL,p_provider_id text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_connection uuid;
BEGIN
  IF p_status NOT IN ('sent','failed','uncertain','cancelled','blocked') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  UPDATE public.customer_telegram_deliveries SET status=CASE WHEN p_status='blocked' THEN 'cancelled' ELSE p_status END,
    last_error=left(p_error,80),provider_id=p_provider_id,worker_id=NULL,lease_expires_at=NULL,
    sent_at=CASE WHEN p_status='sent' THEN now() ELSE NULL END
    WHERE id=p_id AND worker_id=p_worker_id AND status='sending' RETURNING connection_id INTO v_connection;
  IF p_status='blocked' AND v_connection IS NOT NULL THEN
    UPDATE public.customer_telegram_connections SET active=false,disconnected_at=now() WHERE id=v_connection;
    UPDATE public.customer_telegram_deliveries SET status='cancelled',last_error='bot_blocked' WHERE connection_id=v_connection AND status='pending';
  END IF;
END;
$$;

CREATE FUNCTION public.retry_customer_telegram_delivery(p_actor_id uuid,p_id uuid,p_request_id uuid,p_allow_duplicate boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE d public.customer_telegram_deliveries%ROWTYPE;
BEGIN
  IF NOT public.exchange_request_is_admin(p_actor_id) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT * INTO STRICT d FROM public.customer_telegram_deliveries WHERE id=p_id AND request_id=p_request_id FOR UPDATE;
  IF d.status='sending' AND d.lease_expires_at<now() THEN d.status:='uncertain'; END IF;
  IF d.status NOT IN ('pending','failed','uncertain') THEN RAISE EXCEPTION 'delivery_changed'; END IF;
  IF d.status='uncertain' AND NOT COALESCE(p_allow_duplicate,false) THEN RAISE EXCEPTION 'duplicate_confirmation_required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.customer_telegram_connections WHERE id=d.connection_id AND active) THEN RAISE EXCEPTION 'disconnected'; END IF;
  UPDATE public.customer_telegram_deliveries SET status='pending',last_error=NULL,worker_id=NULL,lease_expires_at=NULL WHERE id=p_id;
  INSERT INTO public.audit_logs(actor_id,actor_email,action,target_type,target_id,new_value)
    VALUES(p_actor_id,(SELECT email FROM auth.users WHERE id=p_actor_id),'CUSTOMER_TELEGRAM_RETRY','customer_telegram_deliveries',p_id::text,jsonb_build_object('previous_status',d.status,'duplicate_acknowledged',p_allow_duplicate));
END;
$$;

-- Do not expose privileged RPCs through PostgREST's default PUBLIC execute grant.
DO $$ DECLARE f regprocedure; BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('customer_telegram_settings','customer_telegram_webhook','enqueue_customer_telegram_event',
      'claim_customer_telegram_delivery','prepare_customer_telegram_delivery','finish_customer_telegram_delivery','retry_customer_telegram_delivery')
  LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f);
  END LOOP;
END $$;
COMMIT;
