-- ============================================================
-- Migration: Recipients, Promo Codes, Transaction Columns
-- Run in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================

-- ============================================================
-- 1. RECIPIENTS TABLE
--    Stores saved bank details for both AUD and IRT transfers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recipients (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Direction flag: 'aud' (Iran→Australia) | 'irt' (Australia→Iran)
  direction     text NOT NULL CHECK (direction IN ('aud', 'irt')),
  -- Display label for dropdown (e.g. "John Smith – CBA")
  label         text NOT NULL,

  -- ── AUD recipient fields (direction = 'aud') ──────────────
  bank_name         text,
  bsb               text,
  account_number    text,
  account_name      text,     -- full name
  residential_address text,
  recipient_email   text,
  recipient_phone   text,

  -- ── IRT recipient fields (direction = 'irt') ──────────────
  bank_type         text CHECK (bank_type IN ('bank_melli', 'other')),
  card_number       text,
  shaba_number      text,     -- stored WITHOUT spaces
  irt_account_number text,
  full_name         text,
  irt_address       text,
  irt_phone         text,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_recipients_updated_at ON public.recipients;
CREATE TRIGGER set_recipients_updated_at
  BEFORE UPDATE ON public.recipients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: enable and restrict to owner only
ALTER TABLE public.recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recipients: select own"  ON public.recipients;
DROP POLICY IF EXISTS "recipients: insert own"  ON public.recipients;
DROP POLICY IF EXISTS "recipients: update own"  ON public.recipients;
DROP POLICY IF EXISTS "recipients: delete own"  ON public.recipients;

CREATE POLICY "recipients: select own"
  ON public.recipients FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "recipients: insert own"
  ON public.recipients FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "recipients: update own"
  ON public.recipients FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "recipients: delete own"
  ON public.recipients FOR DELETE
  USING (auth.uid() = user_id);

-- Index for per-user queries
CREATE INDEX IF NOT EXISTS idx_recipients_user_id ON public.recipients(user_id);


-- ============================================================
-- 2. PROMO CODES TABLE
--    Managed by admin; validated by the server action
-- ============================================================
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,
  discount_type   text NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  -- percentage: value is 0–100 (e.g. 10 = 10% off final_amount)
  -- fixed: value is AUD amount to subtract
  discount_value  numeric(12, 4) NOT NULL CHECK (discount_value > 0),
  max_uses        integer,           -- NULL = unlimited
  used_count      integer NOT NULL DEFAULT 0,
  active          boolean NOT NULL DEFAULT true,
  expires_at      timestamptz,       -- NULL = no expiry
  description     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_promo_codes_updated_at ON public.promo_codes;
CREATE TRIGGER set_promo_codes_updated_at
  BEFORE UPDATE ON public.promo_codes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- No RLS: promo_codes is admin-only via service role key.
-- Clients validate codes through a server action, never directly.
ALTER TABLE public.promo_codes DISABLE ROW LEVEL SECURITY;


-- ============================================================
-- 3. ALTER TRANSACTIONS TABLE
--    Add recipient link, promo tracking, and final amount
-- ============================================================
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS recipient_id    uuid REFERENCES public.recipients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promo_code      text,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_amount    numeric(12, 4);

-- Backfill final_amount for existing rows (equals amount_aud when no discount)
UPDATE public.transactions
  SET final_amount = amount_aud
  WHERE final_amount IS NULL;

-- Index for recipient lookups
CREATE INDEX IF NOT EXISTS idx_transactions_recipient_id ON public.transactions(recipient_id);
