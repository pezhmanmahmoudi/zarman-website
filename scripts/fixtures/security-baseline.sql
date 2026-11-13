-- Synthetic replica of the PRE-72 production authorization state (captured 2026-11-13 from the
-- live catalog): table shapes, triggers, SECURITY DEFINER functions, every RLS policy and the
-- legacy ALL grants. Used only by the isolated PGlite suite scripts/test-security-rls-db.mjs.
-- Contains no production data.

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE supabase_auth_admin NOLOGIN;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role, supabase_auth_admin;

-- Same claim plumbing as Supabase (PostgREST sets request.jwt.claims per request).
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim', true), ''), nullif(current_setting('request.jwt.claims', true), ''))::jsonb
$$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
$$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'))::text
$$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role, supabase_auth_admin;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY, email text, raw_app_meta_data jsonb NOT NULL DEFAULT '{}', raw_user_meta_data jsonb NOT NULL DEFAULT '{}'
);
GRANT INSERT, SELECT ON auth.users TO supabase_auth_admin;

CREATE TABLE public.admins (id uuid PRIMARY KEY, "Name" text);

CREATE SEQUENCE public.profiles_customer_code_seq;
GRANT USAGE ON SEQUENCE public.profiles_customer_code_seq TO anon, authenticated, service_role;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text, middle_name text, last_name text, dob date, address text, country text, state text, city text,
  document_type text, created_at timestamptz DEFAULT now(), email text,
  kyc_status text CHECK (kyc_status = ANY (ARRAY['pending','under_review','approved','rejected','archived','suspended'])),
  mobile_number text, postal_code text, kyc_verified_at timestamptz, kyc_verified_by_admin_id uuid,
  loyalty_discount_toman numeric, kyc_archived_at timestamptz, kyc_archived_by_admin_id uuid REFERENCES public.admins(id),
  license_number text, card_number text, passport_number text, postcode text, updated_at timestamptz, expiry_date date,
  state_of_issue text, customer_code text UNIQUE,
  compliance_dvs_status text DEFAULT 'not_started', compliance_aml_status text DEFAULT 'not_started',
  compliance_aml_flag text DEFAULT 'none' CHECK (compliance_aml_flag = ANY (ARRAY['none','clear','review_required','failed'])),
  compliance_customer_flagged boolean DEFAULT false, compliance_customer_flag_reason text, compliance_admin_note text,
  kyc_approval_notice_seen_at timestamptz, pep_self_declared boolean, pep_declaration_relation text
);
CREATE INDEX idx_profiles_kyc_created ON public.profiles USING btree (kyc_status, created_at DESC);
CREATE INDEX idx_profiles_kyc_status_created ON public.profiles USING btree (kyc_status, created_at DESC);

CREATE TABLE public.recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id), full_name text
);
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text CHECK (type = ANY (ARRAY['buy_aud','sell_aud'])), amount_aud numeric, equivalent_toman numeric, counterparty text,
  created_at timestamptz DEFAULT now(),
  status text DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending','approved','rejected','archived'])),
  approved_at timestamptz, approved_by_admin_id uuid, canceled_at timestamptz, source_of_funds text, reason_for_transfer text,
  recipient_id uuid REFERENCES public.recipients(id) ON DELETE SET NULL, promo_code text, discount_amount numeric DEFAULT 0,
  final_amount numeric, loyalty_discount numeric, reference_code text UNIQUE, receipt_sent boolean DEFAULT false,
  payment_link text, ledger_fee_aud numeric DEFAULT 0, applied_rate numeric
);
CREATE TABLE public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating integer CHECK (rating >= 1 AND rating <= 5), message text, created_at timestamptz DEFAULT now(),
  is_published boolean DEFAULT false, status text DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending','approved','rejected'])),
  moderated_at timestamptz, moderated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE TABLE public.promo_codes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE, active boolean DEFAULT true);
CREATE UNIQUE INDEX promo_codes_id_key ON public.promo_codes USING btree (id);
CREATE TABLE public.rates_history (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), date date, buy_aud numeric, market_active boolean DEFAULT true, updated_at timestamptz);
CREATE TABLE public.audit_logs (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id uuid, action text, created_at timestamptz DEFAULT now());
CREATE TABLE public.exchange_request_realtime_signals (request_id uuid PRIMARY KEY, user_id uuid NOT NULL);
CREATE TABLE public.accounting_correction_batches (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.report_account_daily (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.report_customer_daily (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.report_refresh_state (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.reports_daily (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.expenses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), amount numeric, updated_at timestamptz);
CREATE TABLE public.owner_loans (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), amount numeric, updated_at timestamptz);
CREATE TABLE public.treasury_settings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), settings jsonb, updated_at timestamptz);
CREATE TABLE public.account_reconciliations (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.admin_stepup_attempts (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.austrac_report_batches (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.bank_accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_name text);
CREATE TABLE public.ledger (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), amount_aud numeric, updated_at timestamptz);
CREATE TABLE public.pending_bank_changes (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.promo_code_attempts (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.recurring_expenses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), updated_at timestamptz);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['admins','profiles','recipients','transactions','testimonials','promo_codes','rates_history',
    'audit_logs','exchange_request_realtime_signals','accounting_correction_batches','report_account_daily',
    'report_customer_daily','report_refresh_state','reports_daily','expenses','owner_loans','treasury_settings',
    'account_reconciliations','admin_stepup_attempts','austrac_report_batches','bank_accounts','ledger',
    'pending_bank_changes','promo_code_attempts','recurring_expenses']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
  END LOOP;
END $$;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

-- Production grants: ALL to anon + authenticated on the 23 legacy tables, narrower on the rest.
GRANT ALL ON TABLE
  public.account_reconciliations, public.admin_stepup_attempts, public.admins, public.audit_logs,
  public.austrac_report_batches, public.bank_accounts, public.expenses, public.ledger,
  public.owner_loans, public.pending_bank_changes, public.profiles, public.promo_code_attempts,
  public.promo_codes, public.rates_history, public.recipients, public.recurring_expenses,
  public.report_account_daily, public.report_customer_daily, public.report_refresh_state,
  public.reports_daily, public.testimonials, public.transactions, public.treasury_settings
TO anon, authenticated;
GRANT SELECT ON public.accounting_correction_batches, public.exchange_request_realtime_signals TO authenticated;

-- Functions (production bodies where behaviour matters; trivial stubs for pure trigger helpers).
CREATE FUNCTION public.protect_kyc_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.kyc_status IS DISTINCT FROM OLD.kyc_status THEN
    IF auth.role() = 'authenticated' THEN
      RAISE EXCEPTION 'Security Alert: Users cannot change their own KYC status.';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE FUNCTION public.assign_customer_code() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE next_num bigint; candidate text;
BEGIN
  IF NEW.customer_code IS NULL OR btrim(NEW.customer_code) = '' THEN
    LOOP
      next_num := nextval('public.profiles_customer_code_seq');
      candidate := 'CZ' || lpad(next_num::text, 6, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.customer_code = candidate AND p.id <> NEW.id);
    END LOOP;
    NEW.customer_code := candidate;
  END IF;
  RETURN NEW;
END $$;
CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, kyc_status)
  VALUES (NEW.id, NEW.email, NULLIF(NEW.raw_user_meta_data ->> 'first_name', ''), NULLIF(NEW.raw_user_meta_data ->> 'last_name', ''), 'pending')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER prevent_kyc_tampering BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_kyc_status();
CREATE TRIGGER trg_assign_customer_code BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.assign_customer_code();
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE FUNCTION public.set_ledger_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER trg_ledger_updated_at BEFORE UPDATE ON public.ledger FOR EACH ROW EXECUTE FUNCTION public.set_ledger_updated_at();
CREATE FUNCTION public.fn_bank_transfer_fee_accruals_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE FUNCTION public.fn_expenses_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE FUNCTION public.fn_owner_loans_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE FUNCTION public.fn_rates_history_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE FUNCTION public.fn_recurring_expenses_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE FUNCTION public.fn_treasury_settings_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE FUNCTION public.sync_expense_to_ledger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
CREATE FUNCTION public.sync_owner_loan_to_ledger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
CREATE FUNCTION public.protect_bank_details() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN RETURN NEW; END $$;
CREATE FUNCTION public.reject_primary_kyc_image_upload() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$ BEGIN RETURN NEW; END $$;
CREATE FUNCTION public.exchange_request_promo_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN RETURN NEW; END $$;
CREATE FUNCTION public.exchange_request_promo_usage() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN RETURN NEW; END $$;
CREATE FUNCTION public.parse_legacy_recipient_address(raw text, OUT street text, OUT city text, OUT state text, OUT postcode text, OUT country text)
  RETURNS SETOF record LANGUAGE plpgsql AS $$ BEGIN street := raw; RETURN NEXT; END $$;
CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.fn_expenses_set_updated_at();

CREATE FUNCTION public.check_user_exists(p_email text, p_phone text) RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE email_exists boolean; phone_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM profiles WHERE email = p_email) INTO email_exists;
  SELECT EXISTS(SELECT 1 FROM profiles WHERE mobile_number = p_phone) INTO phone_exists;
  RETURN json_build_object('email_exists', email_exists, 'phone_exists', phone_exists);
END $$;
CREATE FUNCTION public.attach_documents_to_profile(p_user_id uuid, p_doc_type text, p_front_url text, p_back_url text, p_address_url text, p_front_path text, p_back_path text, p_address_path text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles SET document_type = p_doc_type, doc_front_url = coalesce(p_front_url, doc_front_url)
  WHERE id = p_user_id AND created_at >= now() - interval '1 hour';
  RETURN found;
END $$;
CREATE FUNCTION public.acknowledge_kyc_approval_notice(p_profile_id uuid) RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_seen_at timestamptz;
BEGIN
  UPDATE public.profiles SET kyc_approval_notice_seen_at = now()
  WHERE id = p_profile_id AND id = (SELECT auth.uid()) AND kyc_status = 'approved' AND kyc_approval_notice_seen_at IS NULL
  RETURNING kyc_approval_notice_seen_at INTO v_seen_at;
  IF v_seen_at IS NULL THEN
    SELECT kyc_approval_notice_seen_at INTO v_seen_at FROM public.profiles
    WHERE id = p_profile_id AND id = (SELECT auth.uid()) AND kyc_status = 'approved';
  END IF;
  RETURN v_seen_at;
END $$;
REVOKE EXECUTE ON FUNCTION public.acknowledge_kyc_approval_notice(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acknowledge_kyc_approval_notice(uuid) TO authenticated;
CREATE FUNCTION public.my_approved_transaction_summary() RETURNS TABLE(volume numeric, approved_count bigint) LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT COALESCE(SUM(t.amount_aud::numeric), 0), COUNT(*) FROM public.transactions t
  WHERE t.user_id = (SELECT auth.uid()) AND t.status = 'approved';
$$;
REVOKE EXECUTE ON FUNCTION public.my_approved_transaction_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_approved_transaction_summary() TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.acknowledge_kyc_approval_notice(uuid), public.my_approved_transaction_summary() FROM anon;

-- Every production policy on the affected tables, verbatim (from pg_policies, 2026-11-13).
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
CREATE POLICY U&"\06A9\0627\0631\0628\0631\0627\0646 \0641\0642\0637 \067E\0631\0648\0641\0627\06CC\0644 \062E\0648\062F \0631\0627 \0622\067E\062F\06CC\062A \0645" ON public.profiles AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = id));
CREATE POLICY U&"\06A9\0627\0631\0628\0631\0627\0646 \0641\0642\0637 \067E\0631\0648\0641\0627\06CC\0644 \062E\0648\062F \0631\0627 \0645\06CC\200C\0628\06CC\0646" ON public.profiles AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = id));
CREATE POLICY promo_codes_admin_all ON public.promo_codes AS PERMISSIVE FOR ALL TO public USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['admin'::text, 'supabase_admin'::text, 'service_role'::text]))) WITH CHECK ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['admin'::text, 'supabase_admin'::text, 'service_role'::text])));
CREATE POLICY "Allow read access to rates" ON public.rates_history AS PERMISSIVE FOR SELECT TO public USING (true);
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
