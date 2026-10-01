-- Apply manually after review. Requires PAYMENT_ACCESS_ENCRYPTION_KEY on the server.
-- Only ciphertext enters PostgreSQL; never include these values in quotes or events.
BEGIN;

CREATE TABLE public.exchange_request_payment_access (
  request_id uuid PRIMARY KEY REFERENCES public.exchange_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  quote_id uuid NOT NULL REFERENCES public.exchange_request_quotes(id),
  encrypted_account text NOT NULL CHECK (length(encrypted_account) BETWEEN 40 AND 16000 AND encrypted_account LIKE 'v1.%'),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.exchange_request_payment_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exchange_request_payment_access FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.exchange_request_payment_access TO service_role;

CREATE FUNCTION public.submit_exchange_request_with_payment_access(
  p_actor_id uuid, p_quote_id uuid, p_idempotency_key uuid, p_encrypted_account text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_request jsonb; v_quote jsonb; v_existing uuid;
BEGIN
  IF p_encrypted_account IS NULL OR length(p_encrypted_account) NOT BETWEEN 40 AND 16000
    OR p_encrypted_account NOT LIKE 'v1.%' THEN RAISE EXCEPTION 'Invalid payment account details'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_actor_id::text||p_idempotency_key::text,0));
  SELECT snapshot INTO v_quote FROM public.exchange_request_quotes WHERE id=p_quote_id AND user_id=p_actor_id;
  IF NOT FOUND OR v_quote->>'recipient_id' IS NOT NULL OR COALESCE(v_quote->>'institution_name','')=''
    THEN RAISE EXCEPTION 'Institution quote required' USING ERRCODE='42501'; END IF;
  SELECT id INTO v_existing FROM public.exchange_requests WHERE user_id=p_actor_id AND idempotency_key=p_idempotency_key;
  v_request:=public.submit_exchange_request(p_actor_id,p_quote_id,p_idempotency_key);
  -- A replay must never replace or attach credentials to an already-submitted request.
  IF v_existing IS NULL THEN
    INSERT INTO public.exchange_request_payment_access(request_id,user_id,quote_id,encrypted_account)
    VALUES((v_request->>'id')::uuid,p_actor_id,p_quote_id,p_encrypted_account);
  END IF;
  RETURN v_request;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_exchange_request_with_payment_access(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_exchange_request_with_payment_access(uuid,uuid,uuid,text) TO service_role;

-- The application authenticates the admin; the database also enforces the funding gate.
CREATE FUNCTION public.read_funded_request_payment_access(p_request_id uuid)
RETURNS TABLE(user_id uuid,quote_id uuid,encrypted_account text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT a.user_id,a.quote_id,a.encrypted_account
  FROM public.exchange_request_payment_access a
  JOIN public.exchange_requests r ON r.id=a.request_id
  WHERE a.request_id=p_request_id AND r.funding_status='confirmed';
$$;
REVOKE ALL ON FUNCTION public.read_funded_request_payment_access(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_funded_request_payment_access(uuid) TO service_role;
COMMIT;
