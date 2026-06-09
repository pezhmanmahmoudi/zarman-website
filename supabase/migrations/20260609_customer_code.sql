-- ============================================================
-- Migration: Add customer_code to profiles table
-- Format: CZ + 4 zero-padded digits, e.g. CZ0001
-- Uses hashtext(id) for random-looking but deterministic codes
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS customer_code text UNIQUE;

-- Backfill existing rows using a hash of the row UUID so codes
-- look random but are stable (same UUID → same code every time).
UPDATE public.profiles
SET customer_code = 'CZ' || LPAD(
  (abs(hashtext(id::text)) % 10000)::text,
  4, '0'
)
WHERE customer_code IS NULL;

-- Index for fast lookups by customer code
CREATE INDEX IF NOT EXISTS idx_profiles_customer_code
  ON public.profiles(customer_code);
