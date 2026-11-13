-- Post-deployment verification for migration 72. READ-ONLY: runs in a read-only transaction and only
-- SELECTs. It exercises real production rows as PostgREST would (SET ROLE + request.jwt.claims) for:
-- anonymous visitor, a real customer, the same customer with a forged user_metadata "admin" claim,
-- a real administrator (app_metadata.role = admin), and the service role used by the server actions.
-- Prints counts and PASS/FAIL lines only - no customer data. Ends with RESULT: PASS, or raises an
-- error "RESULT: FAILED (n checks)" so psql exits non-zero.
--
--   psql "host=aws-1-ap-southeast-2.pooler.supabase.com port=5432 dbname=postgres user=postgres.kkibwbmufjkyqdldlkbh sslmode=require" -X -q -f scripts/verify-security-72.sql
\set ON_ERROR_STOP 1
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
DO $verify$
DECLARE
  fails int := 0;
  ok boolean;
  n bigint;
  m bigint;
  t text;
  cust uuid;
  adm uuid;
  total_profiles bigint;
  total_tx bigint;
  total_testimonials bigint;
  total_promos bigint;
  cust_tx bigint;
  cust_recipients bigint;
  approved_testimonials bigint;
  cust_testimonials bigint;
  customer_claims text;
  forged_claims text;
  admin_claims text;
BEGIN
  -- Ground truth, read as the session owner (postgres).
  SELECT count(*) INTO total_profiles FROM public.profiles;
  SELECT count(*) INTO total_tx FROM public.transactions;
  SELECT count(*) INTO total_testimonials FROM public.testimonials;
  SELECT count(*) INTO total_promos FROM public.promo_codes;
  SELECT count(*) INTO approved_testimonials FROM public.testimonials WHERE status = 'approved';
  SELECT u.id INTO adm FROM auth.users u WHERE u.raw_app_meta_data ->> 'role' = 'admin' ORDER BY u.id LIMIT 1;
  -- A real customer (not an admin) who has transactions while other customers also have transactions.
  SELECT p.id INTO cust FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
   WHERE coalesce(u.raw_app_meta_data ->> 'role', '') <> 'admin'
     AND EXISTS (SELECT 1 FROM public.transactions x WHERE x.user_id = p.id)
     AND EXISTS (SELECT 1 FROM public.transactions x WHERE x.user_id <> p.id)
   ORDER BY p.id LIMIT 1;
  IF cust IS NULL OR adm IS NULL THEN RAISE EXCEPTION 'RESULT: FAILED (no customer with transactions or no admin user to test with)'; END IF;
  SELECT count(*) INTO cust_tx FROM public.transactions WHERE user_id = cust;
  SELECT count(*) INTO cust_recipients FROM public.recipients WHERE user_id = cust;
  SELECT count(*) INTO cust_testimonials FROM public.testimonials WHERE status = 'approved' OR user_id = cust;

  customer_claims := json_build_object('sub', cust, 'role', 'authenticated', 'aal', 'aal1',
                       'app_metadata', json_build_object('provider', 'email'), 'user_metadata', json_build_object())::text;
  forged_claims   := json_build_object('sub', cust, 'role', 'authenticated', 'aal', 'aal1',
                       'app_metadata', json_build_object('provider', 'email'), 'user_metadata', json_build_object('role', 'admin'))::text;
  admin_claims    := json_build_object('sub', adm, 'role', 'authenticated', 'aal', 'aal2',
                       'app_metadata', json_build_object('provider', 'email', 'role', 'admin'))::text;

  RAISE NOTICE 'Data (as owner): profiles=% transactions=% testimonials=% promo_codes=% auth.users=% recipients=% audit_logs=%',
    total_profiles, total_tx, total_testimonials, total_promos,
    (SELECT count(*) FROM auth.users), (SELECT count(*) FROM public.recipients), (SELECT count(*) FROM public.audit_logs);
  RAISE NOTICE 'Transactions by status: %', (SELECT string_agg(s || '=' || c, ' ' ORDER BY s) FROM (SELECT coalesce(status, 'null') s, count(*) c FROM public.transactions GROUP BY 1) z);

  -- ---------------------------------------------------------------- catalog
  SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles';
  ok := n = 1 AND EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_select_own_or_admin');
  RAISE NOTICE '% catalog: profiles has exactly the one SELECT policy', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END; IF NOT ok THEN fails := fails + 1; END IF;
  SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND tablename = 'transactions';
  ok := n = 1 AND EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'transactions' AND policyname = 'transactions_select_own_or_admin');
  RAISE NOTICE '% catalog: transactions has exactly the one SELECT policy', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END; IF NOT ok THEN fails := fails + 1; END IF;
  SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public'
     AND tablename IN ('profiles','transactions','testimonials','promo_codes','audit_logs','recipients')
     AND (btrim(coalesce(qual, '')) = 'true' OR btrim(coalesce(with_check, '')) = 'true');
  ok := n = 0;
  RAISE NOTICE '% catalog: no USING (true) / WITH CHECK (true) policy on customer or financial tables (found %)', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END, n; IF NOT ok THEN fails := fails + 1; END IF;
  ok := to_regprocedure('public.get_public_testimonials(integer)') IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace WHERE s.nspname = 'public' AND p.proname = 'attach_documents_to_profile');
  RAISE NOTICE '% catalog: get_public_testimonials exists, attach_documents_to_profile removed', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END; IF NOT ok THEN fails := fails + 1; END IF;

  -- ---------------------------------------------------------------- grants
  SELECT string_agg(r || ':' || tb || ':' || pv, ' ' ORDER BY r, tb, pv) INTO t
    FROM (VALUES ('anon'), ('authenticated')) roles(r),
         (VALUES ('profiles'), ('transactions'), ('audit_logs'), ('promo_codes'), ('ledger'), ('bank_accounts'), ('admins'), ('expenses'), ('treasury_settings'), ('owner_loans')) tables(tb),
         (VALUES ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) privs(pv)
   WHERE to_regclass('public.' || tb) IS NOT NULL AND has_table_privilege(r, 'public.' || tb, pv);
  ok := t IS NULL;
  RAISE NOTICE '% grants: API roles cannot write or truncate profiles, transactions, audit log, ledger, promo codes% ', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END, coalesce(' (still granted: ' || left(t, 160) || CASE WHEN length(t) > 160 THEN ' ...' ELSE '' END || ')', ''); IF NOT ok THEN fails := fails + 1; END IF;
  SELECT string_agg(tb || ':' || pv, ' ' ORDER BY tb, pv) INTO t
    FROM (VALUES ('profiles'), ('transactions'), ('testimonials'), ('promo_codes'), ('audit_logs'), ('recipients')) tables(tb),
         (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) privs(pv)
   WHERE NOT has_table_privilege('service_role', 'public.' || tb, pv);
  ok := t IS NULL;
  RAISE NOTICE '% grants: service role (admin server actions) keeps full read/write% ', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END, coalesce(' (missing: ' || t || ')', ''); IF NOT ok THEN fails := fails + 1; END IF;

  -- ---------------------------------------------------------------- anonymous visitor
  BEGIN
    PERFORM set_config('role', 'anon', true);
    SELECT count(*) INTO n FROM public.profiles;
    ok := false;
  EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  PERFORM set_config('role', 'none', true);
  RAISE NOTICE '% anon: cannot read profiles', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END; IF NOT ok THEN fails := fails + 1; END IF;
  BEGIN
    PERFORM set_config('role', 'anon', true);
    SELECT count(*) INTO n FROM public.transactions;
    ok := false;
  EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  PERFORM set_config('role', 'none', true);
  RAISE NOTICE '% anon: cannot read transactions', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END; IF NOT ok THEN fails := fails + 1; END IF;
  ok := NOT has_table_privilege('anon', 'public.transactions', 'INSERT') AND NOT has_table_privilege('anon', 'public.profiles', 'UPDATE');
  RAISE NOTICE '% anon: cannot create transactions or change profiles', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END; IF NOT ok THEN fails := fails + 1; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  PERFORM set_config('role', 'anon', true);
  SELECT count(*), count(*) FILTER (WHERE status IS DISTINCT FROM 'approved') INTO n, m FROM public.testimonials;
  PERFORM set_config('role', 'none', true);
  ok := n = approved_testimonials AND m = 0;
  RAISE NOTICE '% anon: sees only approved testimonials (% of %)', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END, n, total_testimonials; IF NOT ok THEN fails := fails + 1; END IF;
  BEGIN
    PERFORM set_config('role', 'anon', true);
    SELECT count(*) INTO n FROM public.get_public_testimonials(24);
    SELECT count(*) INTO m FROM public.rates_history;
    PERFORM public.check_user_exists('verify-72@example.invalid', '+0000000000');
    ok := n = least(approved_testimonials, 24) AND m > 0;
  EXCEPTION WHEN OTHERS THEN ok := false; RAISE NOTICE '      (%: %)', SQLSTATE, SQLERRM; END;
  PERFORM set_config('role', 'none', true);
  RAISE NOTICE '% anon: public site works (testimonials RPC, exchange rates, registration duplicate check)', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END; IF NOT ok THEN fails := fails + 1; END IF;

  -- ---------------------------------------------------------------- customer
  PERFORM set_config('request.jwt.claims', customer_claims, true);
  PERFORM set_config('role', 'authenticated', true);
  SELECT count(*), count(*) FILTER (WHERE id <> cust) INTO n, m FROM public.profiles;
  PERFORM set_config('role', 'none', true);
  ok := n = 1 AND m = 0;
  RAISE NOTICE '% customer: sees only their own profile (% visible of %)', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END, n, total_profiles; IF NOT ok THEN fails := fails + 1; END IF;
  PERFORM set_config('role', 'authenticated', true);
  SELECT count(*), count(*) FILTER (WHERE user_id IS DISTINCT FROM cust) INTO n, m FROM public.transactions;
  PERFORM set_config('role', 'none', true);
  ok := n = cust_tx AND m = 0;
  RAISE NOTICE '% customer: sees all and only their own transactions (% of %)', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END, n, total_tx; IF NOT ok THEN fails := fails + 1; END IF;
  PERFORM set_config('role', 'authenticated', true);
  SELECT count(*), count(*) FILTER (WHERE user_id IS DISTINCT FROM cust) INTO n, m FROM public.recipients;
  PERFORM set_config('role', 'none', true);
  ok := n = cust_recipients AND m = 0;
  RAISE NOTICE '% customer: sees all and only their own recipients (%)', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END, n; IF NOT ok THEN fails := fails + 1; END IF;
  PERFORM set_config('role', 'authenticated', true);
  SELECT count(*) INTO n FROM public.testimonials;
  SELECT count(*) INTO m FROM public.audit_logs;
  SELECT m + count(*) INTO m FROM public.promo_codes;
  PERFORM set_config('role', 'none', true);
  ok := n = cust_testimonials AND m = 0;
  RAISE NOTICE '% customer: sees approved + own testimonials only, no audit log, no promo code list', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END; IF NOT ok THEN fails := fails + 1; END IF;
  ok := NOT has_table_privilege('authenticated', 'public.profiles', 'UPDATE')
        AND NOT has_table_privilege('authenticated', 'public.transactions', 'INSERT')
        AND NOT has_table_privilege('authenticated', 'public.transactions', 'UPDATE')
        AND NOT has_table_privilege('authenticated', 'public.transactions', 'DELETE')
        AND NOT has_table_privilege('authenticated', 'public.testimonials', 'UPDATE');
  RAISE NOTICE '% customer: cannot edit own profile/compliance flags or create, change or delete transactions directly', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END; IF NOT ok THEN fails := fails + 1; END IF;
  PERFORM set_config('request.jwt.claims', forged_claims, true);
  PERFORM set_config('role', 'authenticated', true);
  SELECT count(*) INTO n FROM public.profiles;
  SELECT count(*) INTO m FROM public.transactions;
  PERFORM set_config('role', 'none', true);
  ok := n = 1 AND m = cust_tx;
  RAISE NOTICE '% customer: a self-set user_metadata "admin" role grants nothing', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END; IF NOT ok THEN fails := fails + 1; END IF;

  -- ---------------------------------------------------------------- administrator (browser session)
  PERFORM set_config('request.jwt.claims', admin_claims, true);
  PERFORM set_config('role', 'authenticated', true);
  SELECT count(*) INTO n FROM public.profiles;
  SELECT count(*) INTO m FROM public.transactions;
  PERFORM set_config('role', 'none', true);
  ok := n = total_profiles AND m = total_tx;
  RAISE NOTICE '% admin: sees every profile (%) and every transaction (%)', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END, n, m; IF NOT ok THEN fails := fails + 1; END IF;
  PERFORM set_config('role', 'authenticated', true);
  SELECT count(*) INTO n FROM public.testimonials;
  SELECT count(*) INTO m FROM public.promo_codes;
  SELECT count(*) INTO t FROM (SELECT 1 FROM public.audit_logs LIMIT 1) z;
  PERFORM set_config('role', 'none', true);
  ok := n = total_testimonials AND m = total_promos AND t = '1';
  RAISE NOTICE '% admin: sees all testimonials, promo codes and the audit log', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END; IF NOT ok THEN fails := fails + 1; END IF;

  -- ---------------------------------------------------------------- service role (admin server actions)
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  PERFORM set_config('role', 'service_role', true);
  SELECT count(*) INTO n FROM public.profiles;
  SELECT count(*) INTO m FROM public.transactions;
  PERFORM set_config('role', 'none', true);
  ok := n = total_profiles AND m = total_tx;
  RAISE NOTICE '% service role: full access for admin edits, name corrections, assisted/cancelled/deleted transactions', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END; IF NOT ok THEN fails := fails + 1; END IF;

  IF fails > 0 THEN RAISE EXCEPTION 'RESULT: FAILED (% checks)', fails; END IF;
  RAISE NOTICE 'RESULT: PASS';
END
$verify$;
ROLLBACK;
