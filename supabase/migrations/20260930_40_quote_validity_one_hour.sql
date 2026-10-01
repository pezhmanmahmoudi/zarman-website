-- Upgrade the previous ten-minute default while preserving other admin settings.
-- Existing quotes retain their original expiry; customers can request a new quote.
BEGIN;

UPDATE public.exchange_request_settings
SET settings = jsonb_set(settings, '{quote_minutes}', '60'::jsonb),
    version = version + 1,
    updated_at = now(),
    updated_by = NULL
WHERE id = true
  AND (settings->>'quote_minutes' IS NULL OR settings->>'quote_minutes' = '10');

COMMIT;
