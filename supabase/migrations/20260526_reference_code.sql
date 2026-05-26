-- ============================================================
-- Migration: Add reference_code to transactions
-- Format: ZE + 5 zero-padded digits, e.g. ZE84271
-- Uses hashtext(id) for random-looking but deterministic codes
-- ============================================================

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS reference_code text UNIQUE;

-- Backfill existing rows using a hash of the row UUID so codes
-- look random but are stable (same UUID → same code every time).
UPDATE public.transactions
SET reference_code = 'ZE' || LPAD(
  (abs(hashtext(id::text)) % 100000)::text,
  5, '0'
)
WHERE reference_code IS NULL;

-- Index for fast lookups by reference code
CREATE INDEX IF NOT EXISTS idx_transactions_reference_code
  ON public.transactions(reference_code);
