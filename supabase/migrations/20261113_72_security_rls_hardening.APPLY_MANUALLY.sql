-- 72 · Security, authorization and RLS-performance hardening.
--
-- Apply once, after 20261112_71. Reverse with supabase/rollbacks/20261113_72_security_rls_hardening.ROLLBACK.sql.
-- Verified against an exact replica of the production policies by scripts/test-security-rls-db.mjs.
--
-- What this closes (all confirmed against the live catalog on 2026-11-13):
--   * profiles      "Allow public read profiles" USING (true) let the public anon key read every
--                   customer's name, DOB, address, phone, passport/licence numbers and compliance notes.
--   * profiles      Customer self-UPDATE policies had no column limits: a customer could rewrite their
--                   own compliance_* flags, loyalty_discount_toman, customer_code, PEP declaration, and
--                   change their verified identity after KYC approval (bypassing the server actions).
--   * transactions  "Allow Insert" WITH CHECK (true): anyone with the public key could create
--                   transactions for any customer, with any status/amount/rate.
--   * transactions  "Allow Delete" USING (true): any customer could delete their own approved records.
--   * testimonials  Two USING (true) policies exposed pending/rejected feedback; owner INSERT let a
--                   customer publish their own testimonial as 'approved'.
--   * Legacy ALL grants (incl. TRUNCATE/MAINTAIN) to anon/authenticated on 23 financial tables.
--   * attach_documents_to_profile: anon-callable SECURITY DEFINER with no search_path (and broken).
--
-- Authorization model after this migration:
--   anon           SELECT rates_history; SELECT approved testimonials; RPC get_public_testimonials and
--                  check_user_exists (registration). Nothing else.
--   customer       SELECT own profile / own transactions / own + approved testimonials;
--                  INSERT own testimonial as 'pending' only; own recipients (unchanged).
--                  Every profile edit and every exchange request goes through the existing
--                  authenticated server actions (field allow-lists, KYC lock, quote validation).
--   admin JWT      READ-ONLY at the database level (profiles, transactions, testimonials, promo codes,
--                  audit log, reports). All admin writes already run through requireAdmin() + the
--                  service role + audit logging, so a stolen browser token cannot modify records.
--   service_role   Unchanged (BYPASSRLS) — used only server-side after requireAdmin()/getUser().
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ---------------------------------------------------------------------------
-- 1. Replace every policy on the affected tables (names include legacy Persian
--    duplicates, so drop them from the catalog rather than by hand).
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN (
      'profiles','transactions','testimonials','promo_codes','audit_logs','recipients',
      'exchange_request_realtime_signals','accounting_correction_batches',
      'report_account_daily','report_customer_daily','report_refresh_state','reports_daily',
      'expenses','owner_loans','treasury_settings')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- profiles: one SELECT policy. No direct writes for anon/customers/admin JWT.
CREATE POLICY profiles_select_own_or_admin ON public.profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- transactions: one SELECT policy. Customers create requests through submit_exchange_request
-- (SECURITY DEFINER, server-validated quote); admins write through audited server actions.
CREATE POLICY transactions_select_own_or_admin ON public.transactions
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- testimonials: approved ones are public; owners see their own; admins see all.
CREATE POLICY testimonials_select_visible ON public.testimonials
  FOR SELECT TO anon, authenticated
  USING (
    status = 'approved'
    OR user_id = (SELECT auth.uid())
    OR (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
-- Customers may only submit their own feedback, unmoderated. Moderation is a server action.
CREATE POLICY testimonials_insert_own_pending ON public.testimonials
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND status = 'pending'
    AND is_published IS NOT TRUE
    AND moderated_at IS NULL
    AND moderated_by IS NULL
  );

-- promo_codes: admin dashboard reads with the admin JWT; all writes use the service role.
CREATE POLICY promo_codes_admin_select ON public.promo_codes
  FOR SELECT TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = ANY (ARRAY['admin','supabase_admin','service_role']));

-- audit_logs: admins read (requireAdmin capability probe + audit page). Writes are service-role only
-- and are now also blocked at the grant level, so the audit trail cannot be edited from the API.
CREATE POLICY audit_logs_admin_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- recipients: semantics unchanged (owner CRUD), restricted to signed-in users and initplan-friendly.
CREATE POLICY recipients_select_own ON public.recipients
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY recipients_insert_own ON public.recipients
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY recipients_update_own ON public.recipients
  FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY recipients_delete_own ON public.recipients
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- Realtime change signals: semantics unchanged, initplan-friendly.
CREATE POLICY exchange_request_realtime_signals_owner_select ON public.exchange_request_realtime_signals
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- Reporting tables: semantics unchanged, initplan-friendly.
CREATE POLICY accounting_correction_batches_admin_read ON public.accounting_correction_batches
  FOR SELECT TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = ANY (ARRAY['admin','supabase_admin','service_role']));
CREATE POLICY report_account_admin_read ON public.report_account_daily
  FOR SELECT TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = ANY (ARRAY['admin','supabase_admin','service_role']));
CREATE POLICY report_customer_admin_read ON public.report_customer_daily
  FOR SELECT TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = ANY (ARRAY['admin','supabase_admin','service_role']));
CREATE POLICY report_refresh_admin_read ON public.report_refresh_state
  FOR SELECT TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = ANY (ARRAY['admin','supabase_admin','service_role']));
CREATE POLICY reports_daily_admin_read ON public.reports_daily
  FOR SELECT TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = ANY (ARRAY['admin','supabase_admin','service_role']));

-- expenses / owner_loans / treasury_settings: the old policies matched only the service_role
-- (which bypasses RLS anyway) or a top-level JWT role 'admin' that Supabase never issues.
-- They were dead weight; with no policy the tables stay deny-all for API roles, as before.

-- ---------------------------------------------------------------------------
-- 2. Least-privilege grants on the 23 legacy tables that granted ALL (incl. TRUNCATE) to API roles.
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE
  public.account_reconciliations, public.admin_stepup_attempts, public.admins, public.audit_logs,
  public.austrac_report_batches, public.bank_accounts, public.expenses, public.ledger,
  public.owner_loans, public.pending_bank_changes, public.profiles, public.promo_code_attempts,
  public.promo_codes, public.rates_history, public.recipients, public.recurring_expenses,
  public.report_account_daily, public.report_customer_daily, public.report_refresh_state,
  public.reports_daily, public.testimonials, public.transactions, public.treasury_settings
FROM anon, authenticated;

GRANT SELECT ON TABLE public.rates_history, public.testimonials TO anon;
GRANT SELECT ON TABLE
  public.rates_history, public.profiles, public.transactions, public.promo_codes, public.audit_logs,
  public.report_account_daily, public.report_customer_daily, public.report_refresh_state, public.reports_daily
TO authenticated;
GRANT SELECT, INSERT ON TABLE public.testimonials TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.recipients TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Public testimonials without exposing profiles: only the display name is released.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_testimonials(p_limit integer DEFAULT 9)
RETURNS TABLE (rating integer, message text, display_name text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT t.rating,
         t.message,
         coalesce(concat_ws(' ',
           nullif(p.first_name, ''),
           CASE WHEN nullif(p.last_name, '') IS NOT NULL THEN left(p.last_name, 1) || '.' END
         ), '') AS display_name,
         t.created_at
  FROM public.testimonials t
  LEFT JOIN public.profiles p ON p.id = t.user_id
  WHERE t.status = 'approved'
  ORDER BY t.created_at DESC
  LIMIT least(greatest(coalesce(p_limit, 9), 1), 24);
$$;
REVOKE ALL ON FUNCTION public.get_public_testimonials(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_testimonials(integer) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Functions.
-- ---------------------------------------------------------------------------
-- Broken (references dropped columns) anonymous SECURITY DEFINER writer; nothing calls it.
DROP FUNCTION IF EXISTS public.attach_documents_to_profile(uuid, text, text, text, text, text, text, text);

-- Registration duplicate check: same result, pinned search_path.
CREATE OR REPLACE FUNCTION public.check_user_exists(p_email text, p_phone text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN json_build_object(
    'email_exists', EXISTS (SELECT 1 FROM public.profiles WHERE email = p_email),
    'phone_exists', EXISTS (SELECT 1 FROM public.profiles WHERE mobile_number = p_phone)
  );
END;
$$;

-- Trigger functions are not API endpoints. Firing a trigger does not check EXECUTE,
-- so revoking it changes nothing for inserts/updates (verified, including signup).
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'handle_new_user','exchange_request_promo_guard','exchange_request_promo_usage','assign_customer_code',
    'protect_kyc_status','protect_bank_details','set_updated_at','set_ledger_updated_at',
    'fn_bank_transfer_fee_accruals_set_updated_at','fn_expenses_set_updated_at','fn_owner_loans_set_updated_at',
    'fn_rates_history_set_updated_at','fn_recurring_expenses_set_updated_at','fn_treasury_settings_set_updated_at',
    'sync_expense_to_ledger','sync_owner_loan_to_ledger','reject_primary_kyc_image_upload']
  LOOP
    IF to_regprocedure(format('public.%I()', f)) IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I() FROM PUBLIC, anon, authenticated', f);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I() TO service_role', f);
    END IF;
  END LOOP;
  -- Belt and braces for signup: the Auth service role keeps explicit access to the profile trigger.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
  END IF;
END $$;

-- Pin search_path on invoker functions whose bodies only use public + built-ins (advisor 0011).
ALTER FUNCTION public.assign_customer_code() SET search_path = pg_catalog, public;
ALTER FUNCTION public.protect_kyc_status() SET search_path = pg_catalog, public;
ALTER FUNCTION public.set_updated_at() SET search_path = pg_catalog, public;
ALTER FUNCTION public.set_ledger_updated_at() SET search_path = pg_catalog, public;
ALTER FUNCTION public.fn_bank_transfer_fee_accruals_set_updated_at() SET search_path = pg_catalog, public;
ALTER FUNCTION public.fn_expenses_set_updated_at() SET search_path = pg_catalog, public;
ALTER FUNCTION public.fn_owner_loans_set_updated_at() SET search_path = pg_catalog, public;
ALTER FUNCTION public.fn_rates_history_set_updated_at() SET search_path = pg_catalog, public;
ALTER FUNCTION public.fn_recurring_expenses_set_updated_at() SET search_path = pg_catalog, public;
ALTER FUNCTION public.fn_treasury_settings_set_updated_at() SET search_path = pg_catalog, public;
ALTER FUNCTION public.sync_expense_to_ledger() SET search_path = pg_catalog, public;
ALTER FUNCTION public.sync_owner_loan_to_ledger() SET search_path = pg_catalog, public;
ALTER FUNCTION public.parse_legacy_recipient_address(text) SET search_path = pg_catalog, public;

-- ---------------------------------------------------------------------------
-- 5. Indexes.
-- ---------------------------------------------------------------------------
-- Byte-identical duplicates (advisor 0009). Each keeps its twin; neither backs a constraint or FK.
DROP INDEX IF EXISTS public.idx_profiles_kyc_created;   -- keeps idx_profiles_kyc_status_created
DROP INDEX IF EXISTS public.promo_codes_id_key;         -- keeps promo_codes_pkey (same UNIQUE (id))
-- Covers the testimonials owner predicate used by the new RLS policy.
CREATE INDEX IF NOT EXISTS testimonials_user_id_idx ON public.testimonials (user_id);

COMMIT;
