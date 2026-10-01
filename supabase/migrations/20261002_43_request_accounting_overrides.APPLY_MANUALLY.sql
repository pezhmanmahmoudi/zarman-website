-- Admin-adjusted accounting terms for a customer request.
-- Recorded when an admin verifies an incoming payment. Only the trade ledger
-- row (exchange rate / fee) uses these values; the accepted quote, customer
-- amounts and recipient payout are unchanged.
BEGIN;

ALTER TABLE public.exchange_requests ADD COLUMN IF NOT EXISTS accounting_overrides jsonb;
ALTER TABLE public.exchange_requests DROP CONSTRAINT IF EXISTS exchange_requests_accounting_overrides_object;
ALTER TABLE public.exchange_requests ADD CONSTRAINT exchange_requests_accounting_overrides_object
  CHECK (accounting_overrides IS NULL OR jsonb_typeof(accounting_overrides) = 'object');

CREATE OR REPLACE FUNCTION public.apply_request_accounting_overrides() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_overrides jsonb;
BEGIN
  IF NEW.transaction_id IS NULL OR NEW.entry_type IS DISTINCT FROM 'trade' OR NEW.request_fee_entry_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT accounting_overrides INTO v_overrides FROM public.exchange_requests WHERE transaction_id = NEW.transaction_id;
  IF v_overrides IS NULL THEN RETURN NEW; END IF;
  IF jsonb_typeof(v_overrides->'applied_rate') = 'number' AND (v_overrides->>'applied_rate')::numeric > 0 THEN
    NEW.exchange_rate := (v_overrides->>'applied_rate')::numeric;
  END IF;
  IF jsonb_typeof(v_overrides->'base_fee_aud') = 'number' AND (v_overrides->>'base_fee_aud')::numeric >= 0 THEN
    NEW.fee_aud := (v_overrides->>'base_fee_aud')::numeric;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_request_accounting_overrides() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS apply_request_accounting_overrides ON public.ledger;
CREATE TRIGGER apply_request_accounting_overrides BEFORE INSERT ON public.ledger
FOR EACH ROW EXECUTE FUNCTION public.apply_request_accounting_overrides();

COMMIT;
