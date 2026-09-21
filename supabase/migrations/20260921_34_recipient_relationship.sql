-- Optional for existing recipients and older clients; no customer data is backfilled.
ALTER TABLE public.recipients ADD COLUMN IF NOT EXISTS relationship text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.recipients'::regclass AND conname = 'recipients_relationship_allowed'
  ) THEN
    ALTER TABLE public.recipients
      ADD CONSTRAINT recipients_relationship_allowed CHECK (
        relationship IS NULL OR (
          char_length(relationship) <= 8
          AND relationship IN ('self', 'family', 'friend', 'business', 'other')
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.recipients.relationship IS 'Customer-selected relationship to the recipient; optional for legacy records.';
