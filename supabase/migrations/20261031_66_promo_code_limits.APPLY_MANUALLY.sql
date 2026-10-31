-- Promo code limits, usage restoration and attempt throttling.
-- Apply after 20261031_65_promo_code_scope.APPLY_MANUALLY.sql.
--
--   per_customer_limit  how many non-cancelled requests ONE customer may place with the code (NULL = unlimited)
--   min_amount_aud      minimum raw AUD amount of the request (NULL = no minimum)
--
-- The checks live in a BEFORE INSERT trigger on exchange_requests, so they run inside the same
-- transaction as submit/accept and after accept has locked the promo row (FOR UPDATE): two
-- simultaneous submissions by one customer cannot both squeeze under the limit.

ALTER TABLE public.promo_codes
  ADD COLUMN IF NOT EXISTS per_customer_limit integer,
  ADD COLUMN IF NOT EXISTS min_amount_aud numeric;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promo_codes_per_customer_limit_check' AND conrelid = 'public.promo_codes'::regclass) THEN
    ALTER TABLE public.promo_codes ADD CONSTRAINT promo_codes_per_customer_limit_check CHECK (per_customer_limit IS NULL OR per_customer_limit >= 1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promo_codes_min_amount_aud_check' AND conrelid = 'public.promo_codes'::regclass) THEN
    ALTER TABLE public.promo_codes ADD CONSTRAINT promo_codes_min_amount_aud_check CHECK (min_amount_aud IS NULL OR min_amount_aud > 0);
  END IF;
END $$;

-- ── Enforce limits when a request is created ───────────────────────────────
CREATE OR REPLACE FUNCTION public.exchange_request_promo_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code text := NEW.quote->>'promo_code';
  v_promo public.promo_codes%ROWTYPE;
  v_used integer;
BEGIN
  IF v_code IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_promo FROM public.promo_codes WHERE code = v_code;
  IF NOT FOUND THEN RETURN NEW; END IF; -- existence/expiry/usage are validated by the accept function

  IF v_promo.min_amount_aud IS NOT NULL AND (NEW.quote->>'raw_amount_aud')::numeric < v_promo.min_amount_aud THEN
    RAISE EXCEPTION 'PROMO_MINIMUM: This promotion code needs a larger amount';
  END IF;

  IF v_promo.per_customer_limit IS NOT NULL THEN
    SELECT count(*) INTO v_used FROM public.exchange_requests
      WHERE user_id = NEW.user_id AND quote->>'promo_code' = v_code
        AND status NOT IN ('cancelled', 'rejected', 'expired');
    IF v_used >= v_promo.per_customer_limit THEN
      RAISE EXCEPTION 'PROMO_LIMIT: This promotion code has reached your usage limit';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS exchange_request_promo_guard ON public.exchange_requests;
CREATE TRIGGER exchange_request_promo_guard
  BEFORE INSERT ON public.exchange_requests
  FOR EACH ROW EXECUTE FUNCTION public.exchange_request_promo_guard();

-- ── Give the use back when a request dies, take it again if it is reopened ──
-- accept increments promo_codes.used_count once per request. A request that ends
-- cancelled/rejected/expired (or is deleted) should not keep consuming max_uses.
CREATE OR REPLACE FUNCTION public.exchange_request_promo_usage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code text;
  v_old_dead boolean;
  v_new_dead boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_code := OLD.quote->>'promo_code';
    IF v_code IS NOT NULL AND OLD.status NOT IN ('cancelled', 'rejected', 'expired') THEN
      UPDATE public.promo_codes SET used_count = GREATEST(COALESCE(used_count, 0) - 1, 0) WHERE code = v_code;
    END IF;
    RETURN OLD;
  END IF;

  v_code := NEW.quote->>'promo_code';
  IF v_code IS NULL OR NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  v_old_dead := OLD.status IN ('cancelled', 'rejected', 'expired');
  v_new_dead := NEW.status IN ('cancelled', 'rejected', 'expired');
  IF NOT v_old_dead AND v_new_dead THEN
    UPDATE public.promo_codes SET used_count = GREATEST(COALESCE(used_count, 0) - 1, 0) WHERE code = v_code;
  ELSIF v_old_dead AND NOT v_new_dead THEN
    UPDATE public.promo_codes SET used_count = COALESCE(used_count, 0) + 1 WHERE code = v_code;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS exchange_request_promo_usage ON public.exchange_requests;
CREATE TRIGGER exchange_request_promo_usage
  AFTER UPDATE OF status OR DELETE ON public.exchange_requests
  FOR EACH ROW EXECUTE FUNCTION public.exchange_request_promo_usage();

-- ── Throttle code guessing ────────────────────────────────────────────────
-- Written and read by the server with the service role only (RLS on, no policies).
CREATE TABLE IF NOT EXISTS public.promo_code_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  code text NOT NULL,
  success boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS promo_code_attempts_user_created_idx ON public.promo_code_attempts (user_id, created_at DESC);
ALTER TABLE public.promo_code_attempts ENABLE ROW LEVEL SECURITY;

-- Optional housekeeping (run periodically, or schedule with pg_cron):
--   DELETE FROM public.promo_code_attempts WHERE created_at < now() - interval '7 days';
