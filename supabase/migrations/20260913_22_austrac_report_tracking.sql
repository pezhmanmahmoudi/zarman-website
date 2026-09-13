-- Tracks which approved transactions have already been included in a
-- submitted AUSTRAC IFTI-DRA report, so the compliance dashboard can show
-- exactly what is still outstanding and how many business days remain
-- before the 10-business-day reporting deadline (see
-- lib/reporting/austrac-deadlines.ts) is breached.

CREATE TABLE IF NOT EXISTS public.austrac_report_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type text NOT NULL CHECK (report_type IN ('outgoing', 'incoming')),
  transaction_count integer NOT NULL CHECK (transaction_count > 0),
  period_start date,
  period_end date,
  file_name text,
  submitted_by uuid,
  submitted_by_email text,
  notes text,
  -- Soft-delete: a mistaken/duplicate batch is reverted, not erased, so the
  -- compliance history stays auditable.
  reverted_at timestamptz,
  reverted_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS austrac_reported_at timestamptz,
  ADD COLUMN IF NOT EXISTS austrac_report_batch_id uuid;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_austrac_report_batch_id_fkey;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_austrac_report_batch_id_fkey
  FOREIGN KEY (austrac_report_batch_id)
  REFERENCES public.austrac_report_batches (id)
  ON DELETE SET NULL;

-- Speeds up the "still outstanding" queue query (approved + not yet reported).
CREATE INDEX IF NOT EXISTS idx_transactions_austrac_pending
  ON public.transactions (type, approved_at)
  WHERE status = 'approved' AND austrac_reported_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_austrac_report_batches_type_created
  ON public.austrac_report_batches (report_type, created_at DESC);
