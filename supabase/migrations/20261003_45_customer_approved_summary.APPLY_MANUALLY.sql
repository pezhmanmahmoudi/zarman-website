-- The customer dashboard shows the signed-in customer's approved volume and
-- count. Summing in the database returns one row instead of paging through
-- every approved transaction in the browser. SECURITY INVOKER keeps RLS in
-- force, and the explicit auth.uid() filter limits it to the caller's rows.
BEGIN;

CREATE OR REPLACE FUNCTION public.my_approved_transaction_summary()
RETURNS TABLE(volume numeric, approved_count bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT COALESCE(SUM(t.amount_aud::numeric), 0), COUNT(*)
  FROM public.transactions t
  WHERE t.user_id = (SELECT auth.uid()) AND t.status = 'approved';
$$;

REVOKE ALL ON FUNCTION public.my_approved_transaction_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_approved_transaction_summary() TO authenticated;

CREATE INDEX IF NOT EXISTS transactions_user_approved_idx
  ON public.transactions (user_id) INCLUDE (amount_aud) WHERE status = 'approved';

COMMIT;
