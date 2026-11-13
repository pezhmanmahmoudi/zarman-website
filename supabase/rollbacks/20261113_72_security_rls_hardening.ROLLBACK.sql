-- ROLLBACK for 20261113_72_security_rls_hardening.APPLY_MANUALLY.sql
--
-- Restores the exact pre-72 catalog state (policies regenerated from the production catalog on
-- 2026-11-13, including the two Persian-named policies by Unicode code point). Run ONLY to undo 72:
-- it deliberately re-opens the vulnerabilities that 72 closes (public profile reads, anonymous
-- transaction inserts, etc.). No table data is touched by either direction.
-- After running it, also redeploy the previous app build if the testimonial RPC fallback is unwanted.
BEGIN;

SET LOCAL lock_timeout = '5s';

-- 1. Policies -----------------------------------------------------------------
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

CREATE POLICY accounting_correction_batches_admin_read ON public.accounting_correction_batches AS PERMISSIVE FOR SELECT TO authenticated USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['admin'::text, 'supabase_admin'::text, 'service_role'::text])));
CREATE POLICY admin_read_audit_logs ON public.audit_logs AS PERMISSIVE FOR SELECT TO public USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));
CREATE POLICY deny_non_service_write_audit ON public.audit_logs AS PERMISSIVE FOR INSERT TO public WITH CHECK (false);
CREATE POLICY exchange_request_realtime_signals_owner_select ON public.exchange_request_realtime_signals AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY expenses_admin_select ON public.expenses AS PERMISSIVE FOR SELECT TO public USING ((((auth.jwt() ->> 'role'::text) = ANY (ARRAY['admin'::text, 'service_role'::text])) OR (auth.role() = 'service_role'::text)));
CREATE POLICY expenses_service_delete ON public.expenses AS PERMISSIVE FOR DELETE TO public USING ((auth.role() = 'service_role'::text));
CREATE POLICY expenses_service_insert ON public.expenses AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.role() = 'service_role'::text));
CREATE POLICY expenses_service_update ON public.expenses AS PERMISSIVE FOR UPDATE TO public USING ((auth.role() = 'service_role'::text));
CREATE POLICY owner_loans_admin_select ON public.owner_loans AS PERMISSIVE FOR SELECT TO public USING ((((auth.jwt() ->> 'role'::text) = ANY (ARRAY['admin'::text, 'service_role'::text])) OR (auth.role() = 'service_role'::text)));
CREATE POLICY owner_loans_service_delete ON public.owner_loans AS PERMISSIVE FOR DELETE TO public USING ((auth.role() = 'service_role'::text));
CREATE POLICY owner_loans_service_insert ON public.owner_loans AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.role() = 'service_role'::text));
CREATE POLICY owner_loans_service_update ON public.owner_loans AS PERMISSIVE FOR UPDATE TO public USING ((auth.role() = 'service_role'::text));
CREATE POLICY "Allow public read profiles" ON public.profiles AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Users can only update their own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = id));
CREATE POLICY "Users can only view their own profile" ON public.profiles AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = id));
CREATE POLICY "Users can select own profile" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = id));
CREATE POLICY "Users can view own profile" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = id));
CREATE POLICY admin_all_profiles ON public.profiles AS PERMISSIVE FOR ALL TO public USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)) WITH CHECK ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));
CREATE POLICY "users can read own profile" ON public.profiles AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = id));
-- "کاربران فقط پروفایل خود را آپدیت م" and "کاربران فقط پروفایل خود را می‌بین" (with U+200C), byte-exact:
CREATE POLICY U&"\06A9\0627\0631\0628\0631\0627\0646 \0641\0642\0637 \067E\0631\0648\0641\0627\06CC\0644 \062E\0648\062F \0631\0627 \0622\067E\062F\06CC\062A \0645" ON public.profiles AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = id));
CREATE POLICY U&"\06A9\0627\0631\0628\0631\0627\0646 \0641\0642\0637 \067E\0631\0648\0641\0627\06CC\0644 \062E\0648\062F \0631\0627 \0645\06CC\200C\0628\06CC\0646" ON public.profiles AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = id));
CREATE POLICY promo_codes_admin_all ON public.promo_codes AS PERMISSIVE FOR ALL TO public USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['admin'::text, 'supabase_admin'::text, 'service_role'::text]))) WITH CHECK ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['admin'::text, 'supabase_admin'::text, 'service_role'::text])));
CREATE POLICY "recipients: delete own" ON public.recipients AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
CREATE POLICY "recipients: insert own" ON public.recipients AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "recipients: select own" ON public.recipients AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "recipients: update own" ON public.recipients AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY report_account_admin_read ON public.report_account_daily AS PERMISSIVE FOR SELECT TO authenticated USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['admin'::text, 'supabase_admin'::text, 'service_role'::text])));
CREATE POLICY report_customer_admin_read ON public.report_customer_daily AS PERMISSIVE FOR SELECT TO authenticated USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['admin'::text, 'supabase_admin'::text, 'service_role'::text])));
CREATE POLICY report_refresh_admin_read ON public.report_refresh_state AS PERMISSIVE FOR SELECT TO authenticated USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['admin'::text, 'supabase_admin'::text, 'service_role'::text])));
CREATE POLICY reports_daily_admin_read ON public.reports_daily AS PERMISSIVE FOR SELECT TO authenticated USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['admin'::text, 'supabase_admin'::text, 'service_role'::text])));
CREATE POLICY "Allow public read access to testimonials" ON public.testimonials AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read testimonials" ON public.testimonials AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Public can read only published testimonials" ON public.testimonials AS PERMISSIVE FOR SELECT TO anon, authenticated USING ((is_published = true));
CREATE POLICY "Public testimonials are viewable by everyone." ON public.testimonials AS PERMISSIVE FOR SELECT TO public USING ((is_published = true));
CREATE POLICY "Users can insert own testimonial" ON public.testimonials AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can insert own testimonials" ON public.testimonials AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view own testimonials" ON public.testimonials AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY admin_all_testimonials ON public.testimonials AS PERMISSIVE FOR ALL TO public USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)) WITH CHECK ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));
CREATE POLICY anon_read_approved_testimonials ON public.testimonials AS PERMISSIVE FOR SELECT TO public USING ((status = 'approved'::text));
CREATE POLICY owner_insert_testimonials ON public.testimonials AS PERMISSIVE FOR INSERT TO public WITH CHECK ((user_id = auth.uid()));
CREATE POLICY owner_read_own_testimonials ON public.testimonials AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY "Allow Delete" ON public.transactions AS PERMISSIVE FOR DELETE TO public USING (true);
CREATE POLICY "Allow Insert" ON public.transactions AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Users can delete their own pending transactions" ON public.transactions AS PERMISSIVE FOR DELETE TO public USING (((auth.uid() = user_id) AND (status = 'pending'::text)));
CREATE POLICY "Users can insert own transactions" ON public.transactions AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view own transactions" ON public.transactions AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can view their own transactions" ON public.transactions AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY admin_all_transactions ON public.transactions AS PERMISSIVE FOR ALL TO public USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)) WITH CHECK ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));
CREATE POLICY treasury_settings_admin_select ON public.treasury_settings AS PERMISSIVE FOR SELECT TO public USING ((((auth.jwt() ->> 'role'::text) = ANY (ARRAY['admin'::text, 'service_role'::text])) OR (auth.role() = 'service_role'::text)));
CREATE POLICY treasury_settings_service_update ON public.treasury_settings AS PERMISSIVE FOR UPDATE TO public USING ((auth.role() = 'service_role'::text));

-- 2. Grants (pre-72: ALL to anon and authenticated on these 23 tables) ------------
GRANT ALL ON TABLE
  public.account_reconciliations, public.admin_stepup_attempts, public.admins, public.audit_logs,
  public.austrac_report_batches, public.bank_accounts, public.expenses, public.ledger,
  public.owner_loans, public.pending_bank_changes, public.profiles, public.promo_code_attempts,
  public.promo_codes, public.rates_history, public.recipients, public.recurring_expenses,
  public.report_account_daily, public.report_customer_daily, public.report_refresh_state,
  public.reports_daily, public.testimonials, public.transactions, public.treasury_settings
TO anon, authenticated;

-- 3. Functions ------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_public_testimonials(integer);

CREATE OR REPLACE FUNCTION public.attach_documents_to_profile(p_user_id uuid, p_doc_type text, p_front_url text, p_back_url text, p_address_url text, p_front_path text, p_back_path text, p_address_path text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  update public.profiles
  set
    document_type = p_doc_type,
    doc_front_url = coalesce(p_front_url, doc_front_url),
    doc_back_url = coalesce(p_back_url, doc_back_url),
    proof_of_address_url = coalesce(p_address_url, proof_of_address_url),
    doc_front_path = coalesce(p_front_path, doc_front_path),
    doc_back_path = coalesce(p_back_path, doc_back_path),
    proof_of_address_path = coalesce(p_address_path, proof_of_address_path)
  where id = p_user_id
    and created_at >= now() - interval '1 hour';

  if found then
    return true;
  else
    return false;
  end if;
end;
$function$;
GRANT EXECUTE ON FUNCTION public.attach_documents_to_profile(uuid, text, text, text, text, text, text, text) TO PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.check_user_exists(p_email text, p_phone text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  email_exists BOOLEAN;
  phone_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM profiles WHERE email = p_email) INTO email_exists;
  SELECT EXISTS(SELECT 1 FROM profiles WHERE mobile_number = p_phone) INTO phone_exists;
  RETURN json_build_object(
    'email_exists', email_exists,
    'phone_exists', phone_exists
  );
END;
$function$;
ALTER FUNCTION public.check_user_exists(text, text) RESET search_path;

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
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I() TO PUBLIC, anon, authenticated, service_role', f);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM supabase_auth_admin;
  END IF;
END $$;

ALTER FUNCTION public.assign_customer_code() RESET search_path;
ALTER FUNCTION public.protect_kyc_status() RESET search_path;
ALTER FUNCTION public.set_updated_at() RESET search_path;
ALTER FUNCTION public.set_ledger_updated_at() RESET search_path;
ALTER FUNCTION public.fn_bank_transfer_fee_accruals_set_updated_at() RESET search_path;
ALTER FUNCTION public.fn_expenses_set_updated_at() RESET search_path;
ALTER FUNCTION public.fn_owner_loans_set_updated_at() RESET search_path;
ALTER FUNCTION public.fn_rates_history_set_updated_at() RESET search_path;
ALTER FUNCTION public.fn_recurring_expenses_set_updated_at() RESET search_path;
ALTER FUNCTION public.fn_treasury_settings_set_updated_at() RESET search_path;
ALTER FUNCTION public.sync_expense_to_ledger() RESET search_path;
ALTER FUNCTION public.sync_owner_loan_to_ledger() RESET search_path;
ALTER FUNCTION public.parse_legacy_recipient_address(text) RESET search_path;

-- 4. Indexes ------------------------------------------------------------------
DROP INDEX IF EXISTS public.testimonials_user_id_idx;
CREATE INDEX IF NOT EXISTS idx_profiles_kyc_created ON public.profiles USING btree (kyc_status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS promo_codes_id_key ON public.promo_codes USING btree (id);

COMMIT;
