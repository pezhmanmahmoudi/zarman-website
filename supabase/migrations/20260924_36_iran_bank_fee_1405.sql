-- Apply the announced 1405 Iranian interbank transfer fees to every new
-- accrual, including accruals created by older request-settlement RPCs.
-- Amounts are in toman.

CREATE OR REPLACE FUNCTION public.set_iran_bank_transfer_fee_1405()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.fee_amount_toman := CASE
    WHEN NEW.transaction_amount_toman <= 0 OR NEW.transfer_method = 'free' THEN 0
    WHEN NEW.transfer_method = 'pol' THEN
      GREATEST(round(NEW.transaction_amount_toman * 0.0002), 800)
    WHEN NEW.transfer_method = 'paya' THEN
      LEAST(GREATEST(round(NEW.transaction_amount_toman * 0.0001), 400), 12000)
    WHEN NEW.transfer_method = 'satna' THEN
      LEAST(round(NEW.transaction_amount_toman * 0.0002), 50000)
    ELSE NEW.fee_amount_toman
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bank_transfer_fee_1405 ON public.bank_transfer_fee_accruals;
CREATE TRIGGER trg_bank_transfer_fee_1405
  BEFORE INSERT ON public.bank_transfer_fee_accruals
  FOR EACH ROW EXECUTE FUNCTION public.set_iran_bank_transfer_fee_1405();

REVOKE ALL ON FUNCTION public.set_iran_bank_transfer_fee_1405() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_iran_bank_transfer_fee_1405() TO service_role;
