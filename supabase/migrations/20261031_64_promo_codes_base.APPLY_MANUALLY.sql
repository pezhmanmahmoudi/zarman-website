-- Base promo_codes table, safe to run whether or not the table already exists.
-- The earlier request migrations read and lock promo_codes but never created it, so a
-- database that never used promo codes may not have it (or may have only the minimal
-- columns). Run this BEFORE 20261031_65_promo_code_scope and 20261031_66_promo_code_limits.

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  discount_type text NOT NULL CHECK (discount_type = 'fixed'),
  discount_value numeric NOT NULL CHECK (discount_value > 0),
  max_uses integer CHECK (max_uses IS NULL OR max_uses >= 1),
  used_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- If the table pre-existed with fewer columns, bring it up to the shape the app expects.
ALTER TABLE public.promo_codes
  ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- The app looks codes up by `code` and edits/deletes by `id`.
CREATE UNIQUE INDEX IF NOT EXISTS promo_codes_code_key ON public.promo_codes (code);
CREATE UNIQUE INDEX IF NOT EXISTS promo_codes_id_key ON public.promo_codes (id);

-- Customers never read this table directly: validation and redemption run on the server
-- (service role) or inside SECURITY DEFINER functions. Only admins may manage it by JWT.
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'promo_codes' AND policyname = 'promo_codes_admin_all') THEN
    CREATE POLICY promo_codes_admin_all ON public.promo_codes
      FOR ALL
      USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'supabase_admin', 'service_role'))
      WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'supabase_admin', 'service_role'));
  END IF;
END $$;
