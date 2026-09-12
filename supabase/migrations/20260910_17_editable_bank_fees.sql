-- An account/month has one reviewed total and at most one paid expense.
-- Accruals remain estimates; posting another review replaces the total.
BEGIN;

CREATE TABLE IF NOT EXISTS public.bank_fee_monthly_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_account_id uuid NOT NULL REFERENCES public.bank_accounts(id),
  fee_month date NOT NULL CHECK (fee_month = date_trunc('month', fee_month)::date),
  actual_amount_toman numeric(20, 2) NOT NULL DEFAULT 0
    CHECK (actual_amount_toman >= 0 AND actual_amount_toman < 'Infinity'::numeric),
  expense_id uuid UNIQUE REFERENCES public.expenses(id),
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  notes text CHECK (char_length(notes) <= 2000),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payer_account_id, fee_month)
);

ALTER TABLE public.bank_fee_monthly_postings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bank_fee_monthly_postings FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.bank_fee_monthly_postings TO service_role;

ALTER TABLE public.bank_transfer_fee_accruals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bank_transfer_fee_accruals FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.bank_transfer_fee_accruals TO service_role;

CREATE OR REPLACE FUNCTION public.guard_managed_bank_fee_expense()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF current_setting('app.bank_fee_monthly_posting', true) IS DISTINCT FROM 'on'
     AND EXISTS (
       SELECT 1 FROM public.bank_fee_monthly_postings posting
       WHERE posting.expense_id = OLD.id
     ) THEN
    RAISE EXCEPTION 'BANK_FEE_MANAGED_EXPENSE: Use the monthly bank-fee review to change this expense.'
      USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_expenses_guard_monthly_bank_fee ON public.expenses;
CREATE TRIGGER trg_expenses_guard_monthly_bank_fee
  BEFORE UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.guard_managed_bank_fee_expense();

CREATE OR REPLACE FUNCTION public.get_monthly_bank_fee_review(p_fee_month date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
SET timezone = 'UTC'
AS $$
DECLARE
  v_month date := date_trunc('month', p_fee_month)::date;
  v_result jsonb;
BEGIN
  IF v_month IS NULL OR v_month > date_trunc('month', current_date)::date THEN
    RAISE EXCEPTION 'Choose the current month or a past month.' USING ERRCODE = '22023';
  END IF;

  -- Do not adopt unidentified legacy expenses or charge them a second time.
  IF EXISTS (
    SELECT 1 FROM public.bank_transfer_fee_accruals fee
    WHERE fee.fee_month = v_month
      AND (fee.status = 'posted' OR fee.posted_at IS NOT NULL OR fee.posted_expense_id IS NOT NULL)
      AND NOT EXISTS (
        SELECT 1 FROM public.bank_fee_monthly_postings posting
        WHERE posting.payer_account_id = fee.payer_account_id
          AND posting.fee_month = v_month AND posting.version > 0
      )
  ) THEN
    RAISE EXCEPTION 'BANK_FEE_LEGACY_POSTING: Legacy posted fees require reconciliation before using the monthly review.'
      USING ERRCODE = '22023';
  END IF;

  SELECT jsonb_build_object(
    'fee_month', v_month,
    'accounts', COALESCE(jsonb_agg(jsonb_build_object(
      'account_id', account.id,
      'account_name', account.account_name,
      'estimated_total_toman', COALESCE(fees.estimated_total, 0),
      'pending_total_toman', COALESCE(fees.pending_total, 0),
      'pending_count', COALESCE(fees.pending_count, 0),
      'posted_total_toman', CASE WHEN posting.version > 0 THEN posting.actual_amount_toman END,
      'posting_version', COALESCE(posting.version, 0),
      'pending_fingerprint', COALESCE(fees.fingerprint, md5('')),
      'expense_id', posting.expense_id,
      'notes', posting.notes,
      'other_paid_fees_toman', COALESCE(other_fees.total, 0)
    ) ORDER BY account.account_name, account.id), '[]'::jsonb)
  ) INTO v_result
  FROM public.bank_accounts account
  LEFT JOIN public.bank_fee_monthly_postings posting
    ON posting.payer_account_id = account.id AND posting.fee_month = v_month
  LEFT JOIN LATERAL (
    SELECT
      sum(fee.fee_amount_toman) FILTER (WHERE fee.status <> 'void') AS estimated_total,
      sum(fee.fee_amount_toman) FILTER (WHERE fee.status = 'accrued' AND fee.posted_at IS NULL) AS pending_total,
      count(*) FILTER (WHERE fee.status = 'accrued' AND fee.posted_at IS NULL)::integer AS pending_count,
      md5(COALESCE(string_agg(
        fee.id::text || ':' || fee.fee_amount_toman::text || ':' || fee.updated_at::text,
        ',' ORDER BY fee.id
      ) FILTER (WHERE fee.status = 'accrued' AND fee.posted_at IS NULL), '')) AS fingerprint
    FROM public.bank_transfer_fee_accruals fee
    WHERE fee.payer_account_id = account.id AND fee.fee_month = v_month
  ) fees ON true
  LEFT JOIN LATERAL (
    SELECT sum(expense.amount) AS total FROM public.expenses expense
    WHERE expense.payer_account_id = account.id
      AND expense.currency = 'IRT' AND expense.status = 'paid'
      AND expense.category = 'bank_fees'
      AND expense.date >= v_month AND expense.date < (v_month + interval '1 month')::date
      AND NOT EXISTS (
        SELECT 1 FROM public.bank_fee_monthly_postings managed
        WHERE managed.expense_id = expense.id
      )
  ) other_fees ON true
  WHERE account.currency = 'IRT';
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_monthly_bank_fee_review(
  p_fee_month date,
  p_entries jsonb,
  p_actor_id uuid,
  p_actor_email text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
SET timezone = 'UTC'
AS $$
DECLARE
  v_month date := date_trunc('month', p_fee_month)::date;
  v_expense_date date;
  v_actor_email text;
  v_entry record;
  v_posting public.bank_fee_monthly_postings%ROWTYPE;
  v_before jsonb;
  v_old_expense jsonb;
  v_amount numeric;
  v_notes text;
  v_expected_version integer;
  v_pending_ids uuid[];
  v_pending_fingerprint text;
  v_pending_total numeric;
  v_expense_id uuid;
  v_posted_count integer := 0;
  v_previous_guard text := current_setting('app.bank_fee_monthly_posting', true);
BEGIN
  SELECT actor.email INTO v_actor_email FROM auth.users actor
  WHERE actor.id = p_actor_id
    AND actor.raw_app_meta_data ->> 'role' IN ('admin', 'supabase_admin', 'service_role')
    AND lower(actor.email) = lower(p_actor_email);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'An authenticated administrator is required.' USING ERRCODE = '42501';
  END IF;
  IF v_month IS NULL OR v_month > date_trunc('month', current_date)::date THEN
    RAISE EXCEPTION 'Choose the current month or a past month.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_entries) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_entries) = 0 OR jsonb_array_length(p_entries) > 100 THEN
    RAISE EXCEPTION 'Provide between 1 and 100 account reviews.' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(DISTINCT (entry ->> 'account_id')::uuid)
      FROM jsonb_array_elements(p_entries) entry) <> jsonb_array_length(p_entries) THEN
    RAISE EXCEPTION 'Each account must appear exactly once.' USING ERRCODE = '22023';
  END IF;
  v_expense_date := LEAST(current_date, (v_month + interval '1 month - 1 day')::date);

  -- Lock the entire account batch before any expense writes. Expenses also
  -- lock the shared report-refresh state, so interleaving account locks and
  -- expense writes could deadlock an overlapping batch despite sorted input.
  FOR v_entry IN
    SELECT (entry ->> 'account_id')::uuid AS account_id
    FROM jsonb_array_elements(p_entries) entry
    ORDER BY (entry ->> 'account_id')::uuid
  LOOP
    PERFORM 1 FROM public.bank_accounts account
      WHERE account.id = v_entry.account_id AND account.currency = 'IRT' FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Choose an existing toman account.' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.bank_fee_monthly_postings (payer_account_id, fee_month, created_by, updated_by)
    VALUES (v_entry.account_id, v_month, p_actor_id, p_actor_id)
    ON CONFLICT (payer_account_id, fee_month) DO NOTHING;
    PERFORM 1 FROM public.bank_fee_monthly_postings posting
    WHERE posting.payer_account_id = v_entry.account_id AND posting.fee_month = v_month
    FOR UPDATE;
  END LOOP;

  FOR v_entry IN
    SELECT (entry ->> 'account_id')::uuid AS account_id, entry AS payload
    FROM jsonb_array_elements(p_entries) entry
    ORDER BY (entry ->> 'account_id')::uuid
  LOOP
    IF jsonb_typeof(v_entry.payload -> 'actual_amount_toman') IS DISTINCT FROM 'number'
       OR jsonb_typeof(v_entry.payload -> 'expected_version') IS DISTINCT FROM 'number'
       OR COALESCE(v_entry.payload ->> 'expected_version', '') !~ '^[0-9]+$'
       OR COALESCE(v_entry.payload ->> 'expected_pending_fingerprint', '') !~ '^[0-9a-f]{32}$'
       OR (v_entry.payload ? 'notes' AND jsonb_typeof(v_entry.payload -> 'notes') NOT IN ('string', 'null')) THEN
      RAISE EXCEPTION 'Invalid monthly fee review. Reload the review and try again.' USING ERRCODE = '22023';
    END IF;
    v_amount := (v_entry.payload ->> 'actual_amount_toman')::numeric;
    IF v_amount < 0 OR v_amount >= 1000000000000000000 OR v_amount <> round(v_amount, 2) THEN
      RAISE EXCEPTION 'Actual fees must be a non-negative amount with at most two decimal places.'
        USING ERRCODE = '22023';
    END IF;
    v_expected_version := (v_entry.payload ->> 'expected_version')::integer;
    v_notes := NULLIF(btrim(v_entry.payload ->> 'notes'), '');
    IF char_length(v_notes) > 2000 THEN
      RAISE EXCEPTION 'Notes must be 2000 characters or fewer.' USING ERRCODE = '22023';
    END IF;
    SELECT posting.* INTO v_posting FROM public.bank_fee_monthly_postings posting
    WHERE posting.payer_account_id = v_entry.account_id AND posting.fee_month = v_month
    FOR UPDATE;
    IF v_posting.version <> v_expected_version THEN
      RAISE EXCEPTION 'BANK_FEE_REVIEW_CHANGED: This account review has changed. Reload before posting.' USING ERRCODE = '40001';
    END IF;
    IF v_posting.version = 0 AND EXISTS (
      SELECT 1 FROM public.bank_transfer_fee_accruals fee
      WHERE fee.payer_account_id = v_entry.account_id AND fee.fee_month = v_month
        AND (fee.status = 'posted' OR fee.posted_at IS NOT NULL OR fee.posted_expense_id IS NOT NULL)
    ) THEN
      RAISE EXCEPTION 'BANK_FEE_LEGACY_POSTING: Legacy posted fees require reconciliation before using the monthly review.'
        USING ERRCODE = '22023';
    END IF;

    -- Capture and lock exactly the pending rows the review covers. A later
    -- accrual remains pending rather than silently increasing the actual total.
    SELECT COALESCE(array_agg(fee.id ORDER BY fee.id), ARRAY[]::uuid[]),
      md5(COALESCE(string_agg(fee.id::text || ':' || fee.fee_amount_toman::text || ':' || fee.updated_at::text,
        ',' ORDER BY fee.id), '')),
      COALESCE(sum(fee.fee_amount_toman), 0)
    INTO v_pending_ids, v_pending_fingerprint, v_pending_total
    FROM (
      SELECT fee.id, fee.fee_amount_toman, fee.updated_at
      FROM public.bank_transfer_fee_accruals fee
      WHERE fee.payer_account_id = v_entry.account_id AND fee.fee_month = v_month
        AND fee.status = 'accrued' AND fee.posted_at IS NULL
      ORDER BY fee.id FOR UPDATE
    ) fee;
    IF v_pending_fingerprint <> (v_entry.payload ->> 'expected_pending_fingerprint') THEN
      RAISE EXCEPTION 'BANK_FEE_REVIEW_CHANGED: Pending bank fees have changed. Reload before posting.' USING ERRCODE = '40001';
    END IF;

    v_before := CASE WHEN v_posting.version > 0 THEN to_jsonb(v_posting) ELSE NULL END;
    v_expense_id := v_posting.expense_id;
    v_old_expense := NULL;
    IF v_expense_id IS NOT NULL THEN
      SELECT to_jsonb(expense) INTO v_old_expense FROM public.expenses expense
      WHERE expense.id = v_expense_id FOR UPDATE;
      IF NOT FOUND OR (v_old_expense ->> 'payer_account_id') IS DISTINCT FROM v_entry.account_id::text
        OR (v_old_expense ->> 'currency') IS DISTINCT FROM 'IRT'
        OR (v_old_expense ->> 'status') IS DISTINCT FROM 'paid'
        OR (v_old_expense ->> 'category') IS DISTINCT FROM 'bank_fees'
        OR (v_old_expense ->> 'amount')::numeric IS DISTINCT FROM v_posting.actual_amount_toman THEN
        RAISE EXCEPTION 'The linked monthly expense needs reconciliation before it can be changed.'
          USING ERRCODE = '22023';
      END IF;
    ELSIF v_posting.actual_amount_toman <> 0 THEN
      RAISE EXCEPTION 'The linked monthly expense is missing.' USING ERRCODE = '22023';
    END IF;

    PERFORM set_config('app.bank_fee_monthly_posting', 'on', true);
    IF v_amount = 0 THEN
      IF v_expense_id IS NOT NULL THEN
        UPDATE public.bank_fee_monthly_postings SET expense_id = NULL WHERE id = v_posting.id;
        DELETE FROM public.expenses WHERE id = v_expense_id;
        v_expense_id := NULL;
      END IF;
    ELSIF v_expense_id IS NULL THEN
      INSERT INTO public.expenses (date, title, category, currency, amount, exchange_rate,
        payer_account_id, status, notes, created_by)
      VALUES (v_expense_date, 'Monthly bank transfer fees — ' || to_char(v_month, 'YYYY-MM'),
        'bank_fees', 'IRT', v_amount, NULL, v_entry.account_id, 'paid', v_notes, p_actor_id)
      RETURNING id INTO v_expense_id;
    ELSE
      UPDATE public.expenses SET amount = v_amount, notes = v_notes
      WHERE id = v_expense_id;
    END IF;

    UPDATE public.bank_fee_monthly_postings posting
    SET actual_amount_toman = v_amount, expense_id = v_expense_id, notes = v_notes,
      version = posting.version + 1, updated_by = p_actor_id, updated_at = now()
    WHERE posting.id = v_posting.id
    RETURNING posting.* INTO v_posting;
    UPDATE public.bank_transfer_fee_accruals fee
    SET status = 'posted', posted_at = now(), posted_expense_id = v_expense_id
    WHERE fee.id = ANY(v_pending_ids) AND fee.status = 'accrued' AND fee.posted_at IS NULL;

    -- Audit is part of the transaction: an audit failure rolls back the expense,
    -- posting revision and accrual changes together.
    INSERT INTO public.audit_logs (actor_id, actor_email, action, target_type, target_id, old_value, new_value)
    VALUES (p_actor_id, v_actor_email, 'MONTHLY_BANK_FEES_REVIEWED', 'bank_fee_monthly_postings',
      v_posting.id::text,
      jsonb_build_object('posting', v_before, 'expense', v_old_expense),
      jsonb_build_object('posting', to_jsonb(v_posting), 'reviewed_pending_ids', to_jsonb(v_pending_ids),
        'reviewed_pending_total_toman', v_pending_total, 'reviewed_pending_count', cardinality(v_pending_ids)));
    v_posted_count := v_posted_count + 1;
  END LOOP;
  PERFORM set_config('app.bank_fee_monthly_posting', COALESCE(v_previous_guard, ''), true);
  IF to_regprocedure('public.refresh_enterprise_reports()') IS NOT NULL THEN
    PERFORM public.refresh_enterprise_reports();
  END IF;
  RETURN jsonb_build_object('posted_count', v_posted_count);
END;
$$;

-- Keep the old signature for older deployments, but never run its unsafe
-- append-only implementation after this migration.
CREATE OR REPLACE FUNCTION public.post_monthly_bank_transfer_fees(p_fee_month date)
RETURNS TABLE (payer_account_id uuid, expense_id uuid, total_fee_toman numeric, fee_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'Monthly fee review required. Reload Treasury to review actual fees.'
    USING ERRCODE = '22023';
END;
$$;

REVOKE ALL ON FUNCTION public.guard_managed_bank_fee_expense() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_monthly_bank_fee_review(date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.post_monthly_bank_fee_review(date, jsonb, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.post_monthly_bank_transfer_fees(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_monthly_bank_fee_review(date) TO service_role;
GRANT EXECUTE ON FUNCTION public.post_monthly_bank_fee_review(date, jsonb, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.post_monthly_bank_transfer_fees(date) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
