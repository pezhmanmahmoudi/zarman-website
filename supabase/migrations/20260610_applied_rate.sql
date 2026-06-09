-- Migration: Add applied_rate to transactions
-- Records the Toman/AUD exchange rate agreed at the time the transaction was created.
-- Nullable so existing rows are not affected.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS applied_rate numeric(18, 2);

COMMENT ON COLUMN public.transactions.applied_rate IS
  'Exchange rate (Toman per AUD) recorded at transaction creation time.';
