-- Promo codes can be limited to one trade, in the COMPANY's terms (same as transactions and the ledger).
--   both      -> usable for Buy AUD and Sell AUD (default; keeps existing codes working)
--   buy_aud   -> we buy AUD: the customer sends AUD and is paid Toman at the (lower) buy rate
--   sell_aud  -> we sell AUD: the customer pays Toman at the (higher) sell rate and receives AUD
-- Scope is enforced when a quote is created (lib/pricing.ts applyPromoCode).
ALTER TABLE public.promo_codes
  ADD COLUMN IF NOT EXISTS applies_to text NOT NULL DEFAULT 'both';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'promo_codes_applies_to_check' AND conrelid = 'public.promo_codes'::regclass
  ) THEN
    ALTER TABLE public.promo_codes
      ADD CONSTRAINT promo_codes_applies_to_check CHECK (applies_to IN ('both', 'buy_aud', 'sell_aud'));
  END IF;
END $$;
