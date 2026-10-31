-- Protected payment details: changes to the bank accounts and payment instructions customers
-- are told to pay into must go through an approval workflow.
--
--   1. A change is recorded in pending_bank_changes and does NOT go live.
--   2. It goes live only when a DIFFERENT admin approves it, or the requesting admin confirms it
--      after the hold period (effective_after, 24h by default). Anyone can cancel it.
--   3. The database itself refuses to alter these fields any other way (trigger below), so a bug
--      or a compromised code path in the app cannot silently swap an account number.
--
-- Apply after 20261031_66_promo_code_limits.APPLY_MANUALLY.sql.

CREATE TABLE IF NOT EXISTS public.pending_bank_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL,
  requested_by_email text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  effective_after timestamptz NOT NULL,
  payload jsonb NOT NULL,   -- new values of the protected keys
  previous jsonb NOT NULL,  -- values that were live when the change was requested
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'cancelled')),
  resolved_by uuid,
  resolved_by_email text,
  resolved_at timestamptz,
  resolution_note text,
  request_ip text
);
-- At most one change can be waiting at a time; a newer request supersedes (cancels) the older one.
CREATE UNIQUE INDEX IF NOT EXISTS pending_bank_changes_single_pending ON public.pending_bank_changes ((true)) WHERE status = 'pending';
ALTER TABLE public.pending_bank_changes ENABLE ROW LEVEL SECURITY;  -- server (service role) only

-- Throttle for the "re-enter your password" step.
CREATE TABLE IF NOT EXISTS public.admin_stepup_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  success boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_stepup_attempts_user_created_idx ON public.admin_stepup_attempts (user_id, created_at DESC);
ALTER TABLE public.admin_stepup_attempts ENABLE ROW LEVEL SECURITY;

-- ── Database-level guard ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.protect_bank_details()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  k text;
  keys text[] := ARRAY['payment_details_aud', 'payment_details_irt', 'payment_instructions_aud',
                       'payment_instructions_irt', 'payment_instructions_aud_fa', 'payment_instructions_irt_fa'];
  old_v jsonb;
  new_v jsonb;
BEGIN
  IF current_setting('app.bank_change_approved', true) = 'on' THEN RETURN NEW; END IF;
  FOREACH k IN ARRAY keys LOOP
    -- A missing key, JSON null and the empty value all mean "not set".
    old_v := COALESCE(NULLIF(OLD.settings -> k, 'null'::jsonb), CASE WHEN k LIKE 'payment_details%' THEN '{}'::jsonb ELSE '""'::jsonb END);
    new_v := COALESCE(NULLIF(NEW.settings -> k, 'null'::jsonb), CASE WHEN k LIKE 'payment_details%' THEN '{}'::jsonb ELSE '""'::jsonb END);
    IF old_v IS DISTINCT FROM new_v THEN
      RAISE EXCEPTION 'BANK_DETAILS_PROTECTED: Payment details change only through the approval workflow' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS protect_bank_details ON public.exchange_request_settings;
CREATE TRIGGER protect_bank_details
  BEFORE UPDATE OF settings ON public.exchange_request_settings
  FOR EACH ROW EXECUTE FUNCTION public.protect_bank_details();

-- ── The only path that may change them ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_pending_bank_change(p_change_id uuid, p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.pending_bank_changes%ROWTYPE;
  v_row public.exchange_request_settings%ROWTYPE;
  v_email text;
BEGIN
  SELECT * INTO c FROM public.pending_bank_changes WHERE id = p_change_id FOR UPDATE;
  IF NOT FOUND OR c.status <> 'pending' THEN
    RAISE EXCEPTION 'BANK_CHANGE_NOT_PENDING: This change is no longer waiting for approval' USING ERRCODE = 'P0001';
  END IF;
  -- The requester may not rush their own change; a different admin may approve at any time.
  IF p_actor_id = c.requested_by AND now() < c.effective_after THEN
    RAISE EXCEPTION 'BANK_CHANGE_HOLD: The hold period has not finished' USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.bank_change_approved', 'on', true);
  UPDATE public.exchange_request_settings
    SET settings = settings || c.payload, version = version + 1, updated_by = p_actor_id, updated_at = now()
    WHERE id RETURNING * INTO v_row;
  PERFORM set_config('app.bank_change_approved', 'off', true);

  SELECT email INTO v_email FROM auth.users WHERE id = p_actor_id;
  UPDATE public.pending_bank_changes
    SET status = 'applied', resolved_by = p_actor_id, resolved_by_email = v_email, resolved_at = now()
    WHERE id = c.id;
  INSERT INTO public.audit_logs(actor_id, actor_email, action, target_type, target_id, new_value)
  VALUES (p_actor_id, v_email, 'BANK_DETAILS_CHANGE_APPLIED', 'exchange_request_settings', c.id::text,
          jsonb_build_object('payload', c.payload, 'requested_by', c.requested_by_email));
  RETURN jsonb_build_object('version', v_row.version);
END $$;

-- SECURITY DEFINER functions are callable through the API by default; only the server may call this.
REVOKE ALL ON FUNCTION public.apply_pending_bank_change(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_pending_bank_change(uuid, uuid) TO service_role;
