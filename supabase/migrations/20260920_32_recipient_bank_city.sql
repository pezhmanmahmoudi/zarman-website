-- Bank branch location is separate from the recipient's residential city.
-- Nullable for existing recipients; future quotes include it in their immutable snapshot.
ALTER TABLE public.recipients ADD COLUMN IF NOT EXISTS bank_city text;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.recipients'::regclass AND conname = 'recipients_bank_city_length'
  ) THEN
    ALTER TABLE public.recipients
      ADD CONSTRAINT recipients_bank_city_length CHECK (bank_city IS NULL OR char_length(bank_city) <= 120);
  END IF;
END $$;
COMMENT ON COLUMN public.recipients.bank_city IS 'Iranian bank branch city; distinct from recipient residential city.';
