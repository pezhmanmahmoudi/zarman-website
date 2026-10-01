-- Customers archive recipients instead of deleting them, so past transactions keep their recipient row.
ALTER TABLE public.recipients ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS recipients_user_active_idx
  ON public.recipients (user_id, created_at DESC)
  WHERE archived_at IS NULL;

COMMENT ON COLUMN public.recipients.archived_at IS 'Set when the customer removes or replaces this recipient; the row is kept for transaction history.';
