-- Synthetic stand-in for the production Supabase database, used only by Test-BackupKit.ps1.
-- Runs as the bootstrap superuser "supabase_admin" of a throw-away local cluster. Role attributes,
-- memberships and settings mirror production (captured 2026-11-13, no passwords); schemas, owners,
-- grants, RLS, triggers, event triggers, publications and data types mirror what the backup must
-- reproduce. All data is fictitious.

-- ---------------------------------------------------------------- roles (as in production)
CREATE ROLE anon NOLOGIN INHERIT;
CREATE ROLE authenticated NOLOGIN INHERIT;
CREATE ROLE service_role NOLOGIN INHERIT BYPASSRLS;
CREATE ROLE authenticator LOGIN NOINHERIT;
CREATE ROLE dashboard_user NOLOGIN CREATEROLE CREATEDB REPLICATION;
CREATE ROLE pgbouncer LOGIN;
CREATE ROLE postgres LOGIN CREATEROLE CREATEDB REPLICATION BYPASSRLS PASSWORD 'synthetic-rehearsal-db-password';
CREATE ROLE supabase_auth_admin LOGIN NOINHERIT CREATEROLE;
CREATE ROLE supabase_storage_admin LOGIN NOINHERIT CREATEROLE;
CREATE ROLE supabase_etl_admin LOGIN REPLICATION BYPASSRLS;
CREATE ROLE supabase_privileged_role NOLOGIN;
CREATE ROLE supabase_read_only_user LOGIN BYPASSRLS;
CREATE ROLE supabase_realtime_admin NOLOGIN NOINHERIT;
CREATE ROLE supabase_replication_admin LOGIN REPLICATION;
CREATE ROLE cli_login_postgres LOGIN NOINHERIT;
CREATE ROLE cli_login_supabase_read_only_user LOGIN NOINHERIT;

GRANT anon, authenticated, service_role TO authenticator WITH INHERIT FALSE;
GRANT anon, authenticated, authenticator, service_role, pg_create_subscription, pg_monitor, pg_read_all_data, pg_signal_backend TO postgres WITH ADMIN OPTION;
GRANT supabase_privileged_role TO postgres;
GRANT postgres TO cli_login_postgres WITH INHERIT FALSE;
GRANT supabase_read_only_user TO cli_login_supabase_read_only_user WITH INHERIT FALSE;
GRANT pg_monitor, pg_read_all_data, supabase_privileged_role TO supabase_etl_admin;
GRANT pg_monitor, pg_read_all_data TO supabase_read_only_user;
GRANT authenticator TO supabase_storage_admin WITH INHERIT FALSE;

ALTER ROLE anon SET statement_timeout = '3s';
ALTER ROLE authenticated SET statement_timeout = '8s';
ALTER ROLE authenticator SET session_preload_libraries = 'safeupdate';
ALTER ROLE authenticator SET statement_timeout = '8s';
ALTER ROLE authenticator SET lock_timeout = '8s';
ALTER ROLE postgres SET search_path = "\$user", public, extensions;
ALTER ROLE supabase_admin SET search_path = "$user", public, auth, extensions;
ALTER ROLE supabase_admin SET log_statement = 'none';
ALTER ROLE supabase_auth_admin SET search_path = auth;
ALTER ROLE supabase_auth_admin SET idle_in_transaction_session_timeout = 60000;
ALTER ROLE supabase_auth_admin SET log_statement = 'none';
ALTER ROLE supabase_read_only_user SET default_transaction_read_only = on;
ALTER ROLE supabase_storage_admin SET search_path = storage;
ALTER ROLE supabase_storage_admin SET log_statement = 'none';
ALTER DATABASE postgres SET "app.settings.jwt_exp" TO '3600';

-- ---------------------------------------------------------------- schemas + extensions
CREATE SCHEMA extensions AUTHORIZATION postgres;
CREATE SCHEMA auth AUTHORIZATION supabase_admin;
CREATE SCHEMA storage AUTHORIZATION supabase_admin;
CREATE SCHEMA realtime AUTHORIZATION supabase_admin;
CREATE SCHEMA vault AUTHORIZATION supabase_admin;
CREATE SCHEMA graphql_public AUTHORIZATION supabase_admin;
CREATE SCHEMA pgbouncer AUTHORIZATION pgbouncer;
CREATE SCHEMA supabase_migrations AUTHORIZATION postgres;
GRANT USAGE ON SCHEMA public, extensions, graphql_public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth, storage, realtime, vault, supabase_migrations TO postgres, service_role;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin;
GRANT USAGE ON SCHEMA storage TO anon, authenticated;
GRANT USAGE ON SCHEMA auth TO supabase_storage_admin, anon, authenticated;
GRANT USAGE ON SCHEMA extensions TO supabase_auth_admin, supabase_storage_admin;
GRANT ALL ON SCHEMA public TO postgres;

CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION pg_stat_statements WITH SCHEMA extensions;
-- Supabase grants on extension members: these ACL entries must be handled by the restore filter.
GRANT SELECT ON extensions.pg_stat_statements TO dashboard_user;
GRANT EXECUTE ON FUNCTION extensions.pg_stat_statements_reset(oid, oid, bigint, boolean) TO postgres;

CREATE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM pg_notify('pgrst', 'reload schema'); END $$;
CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end EXECUTE FUNCTION extensions.pgrst_ddl_watch();

-- ---------------------------------------------------------------- auth
SET ROLE supabase_auth_admin;
CREATE TYPE auth.factor_type AS ENUM ('totp', 'webauthn', 'phone');
CREATE TABLE auth.users (
  id uuid PRIMARY KEY, email text UNIQUE, encrypted_password text, raw_app_meta_data jsonb DEFAULT '{}'::jsonb,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb, created_at timestamptz DEFAULT now(), banned_until timestamptz
);
CREATE TABLE auth.refresh_tokens (id bigserial PRIMARY KEY, token text, user_id uuid REFERENCES auth.users(id), revoked boolean, created_at timestamptz);
CREATE TABLE auth.mfa_factors (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, factor_type auth.factor_type NOT NULL, secret text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim', true), ''), nullif(current_setting('request.jwt.claims', true), ''))::jsonb $$;
GRANT SELECT ON ALL TABLES IN SCHEMA auth TO postgres;
GRANT REFERENCES ON auth.users TO postgres;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.jwt() TO anon, authenticated, service_role, supabase_storage_admin;
RESET ROLE;

-- ---------------------------------------------------------------- storage
SET ROLE supabase_storage_admin;
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text NOT NULL, public boolean DEFAULT false, file_size_limit bigint, allowed_mime_types text[], created_at timestamptz DEFAULT now());
CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(), bucket_id text REFERENCES storage.buckets(id), name text, owner uuid,
  metadata jsonb, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), UNIQUE (bucket_id, name)
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY customer_kyc_evidence_server_only ON storage.objects AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (bucket_id <> 'customer-kyc-evidence') WITH CHECK (bucket_id <> 'customer-kyc-evidence');
CREATE POLICY kyc_select_own_prefix ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-documents' AND split_part(name, '/', 1) = (SELECT auth.uid())::text);
GRANT SELECT ON ALL TABLES IN SCHEMA storage TO postgres;
GRANT ALL ON storage.objects TO anon, authenticated, service_role;
RESET ROLE;

-- ---------------------------------------------------------------- realtime / vault / migrations
CREATE TABLE realtime.messages (id bigserial, topic text NOT NULL, payload jsonb, inserted_at timestamp NOT NULL DEFAULT now(), PRIMARY KEY (id, inserted_at)) PARTITION BY RANGE (inserted_at);
CREATE TABLE realtime.messages_2026_11_13 PARTITION OF realtime.messages FOR VALUES FROM ('2026-11-13') TO ('2026-11-14');
CREATE TABLE realtime.schema_migrations (version bigint PRIMARY KEY, inserted_at timestamp);
CREATE TABLE vault.secrets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, secret text);
CREATE TABLE supabase_migrations.schema_migrations (version text PRIMARY KEY, statements text[], name text);
ALTER TABLE supabase_migrations.schema_migrations OWNER TO postgres;

-- ---------------------------------------------------------------- public (application)
SET ROLE postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
CREATE DOMAIN public.positive_amount AS numeric(18,2) CHECK (VALUE >= 0);
CREATE TYPE public.kyc_state AS ENUM ('pending', 'approved', 'rejected');
CREATE SEQUENCE public.profiles_customer_code_seq;
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text, last_name text, email text, dob date, passport_number text,
  kyc_status public.kyc_state DEFAULT 'pending', customer_code text UNIQUE,
  loyalty_discount_toman numeric, tags text[], avatar bytea, preferences jsonb,
  created_at timestamptz DEFAULT now(), updated_at timestamptz
);
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text CHECK (type IN ('buy_aud', 'sell_aud')), amount_aud public.positive_amount, applied_rate double precision,
  status text DEFAULT 'pending', reference_code text UNIQUE, created_at timestamptz DEFAULT now()
);
CREATE INDEX transactions_user_created ON public.transactions (user_id, created_at DESC);
CREATE TABLE public.testimonials (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES public.profiles(id), rating int CHECK (rating BETWEEN 1 AND 5), message text, status text DEFAULT 'pending');
CREATE TABLE public.audit_logs (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id uuid, action text, new_value jsonb, created_at timestamptz DEFAULT now());
CREATE TABLE public.rates_history (id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(), date date UNIQUE, buy_aud numeric, sell_aud numeric, spread numeric GENERATED ALWAYS AS (sell_aud - buy_aud) STORED);
CREATE VIEW public.approved_volume AS SELECT user_id, sum(amount_aud) AS volume FROM public.transactions WHERE status = 'approved' GROUP BY user_id;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY U&"\06A9\0627\0631\0628\0631\0627\0646 \0641\0642\0637 \067E\0631\0648\0641\0627\06CC\0644 \062E\0648\062F \0631\0627 \0645\06CC\200C\0628\06CC\0646" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY admin_all_profiles ON public.profiles USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin') WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY transactions_select_own ON public.transactions FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY testimonials_public ON public.testimonials FOR SELECT TO anon, authenticated USING (status = 'approved');
GRANT SELECT (email) ON public.profiles TO supabase_read_only_user;
REVOKE ALL ON public.audit_logs FROM anon;

CREATE FUNCTION public.assign_customer_code() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.customer_code IS NULL THEN NEW.customer_code := 'CZ' || lpad(nextval('public.profiles_customer_code_seq')::text, 6, '0'); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_assign_customer_code BEFORE INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.assign_customer_code();
CREATE FUNCTION public.my_volume() RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(sum(t.amount_aud), 0) FROM public.transactions t WHERE t.user_id = (SELECT auth.uid()) AND t.status = 'approved' $$;
REVOKE EXECUTE ON FUNCTION public.my_volume() FROM PUBLIC, anon;
RESET ROLE;

CREATE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name) VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'first_name', NEW.raw_user_meta_data ->> 'last_name');
  RETURN NEW;
END $$;
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE PUBLICATION supabase_realtime FOR TABLE public.transactions;
CREATE PUBLICATION supabase_realtime_messages_publication FOR TABLE realtime.messages;

-- ---------------------------------------------------------------- synthetic data
INSERT INTO auth.users (id, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at)
SELECT ('00000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
       'synthetic-customer-' || g || '@example.invalid',
       '$2a$10$SYNTHETICHASHSYNTHETICHASHSYNTHETICHASHSYNTHETICHASHab',
       CASE WHEN g = 1 THEN '{"role":"admin","provider":"email"}'::jsonb ELSE '{"provider":"email"}'::jsonb END,
       jsonb_build_object('first_name', CASE WHEN g % 2 = 0 THEN 'پژمان-آزمایشی-' || g ELSE 'Synthetic-' || g END, 'last_name', 'Testcase-' || g),
       timestamptz '2026-01-01 00:00:00+00' + (g || ' hours')::interval
FROM generate_series(1, 120) g;
UPDATE public.profiles SET dob = date '1990-01-01' + (right(id::text, 4)::int), passport_number = 'SYNTHETIC-PASSPORT-' || right(id::text, 4),
  kyc_status = CASE WHEN right(id::text, 1) IN ('0', '2', '4') THEN 'approved'::public.kyc_state ELSE 'pending'::public.kyc_state END,
  loyalty_discount_toman = right(id::text, 3)::numeric * 1000.5, tags = ARRAY['synthetic', 'tag ' || right(id::text, 2)],
  avatar = decode(md5(id::text), 'hex'), preferences = jsonb_build_object('locale', 'fa', 'emoji', '✅', 'n', 1.5e-7);
INSERT INTO public.transactions (user_id, type, amount_aud, applied_rate, status, reference_code, created_at)
SELECT p.id, CASE WHEN g % 2 = 0 THEN 'buy_aud' ELSE 'sell_aud' END, (g * 13.37)::numeric(18,2), 0.1 + g / 3.0,
       CASE WHEN g % 3 = 0 THEN 'approved' ELSE 'pending' END, 'ZE-SYN-' || p.customer_code || '-' || g, timestamptz '2026-02-01 00:00+00' + (g || ' minutes')::interval
FROM public.profiles p CROSS JOIN generate_series(1, 4) g;
INSERT INTO public.testimonials (user_id, rating, message, status)
SELECT id, 1 + (right(id::text, 1)::int % 5), 'Synthetic feedback — بازخورد آزمایشی', CASE WHEN right(id::text, 1) = '0' THEN 'approved' ELSE 'pending' END FROM public.profiles;
INSERT INTO public.audit_logs (actor_id, action, new_value) SELECT id, 'SYNTHETIC_EVENT', jsonb_build_object('i', right(id::text, 3)) FROM public.profiles;
INSERT INTO public.rates_history (date, buy_aud, sell_aud) SELECT date '2025-01-01' + g, 30000 + g, 30500 + g FROM generate_series(1, 300) g;
INSERT INTO auth.refresh_tokens (token, user_id, revoked, created_at) SELECT md5(id::text), id, false, now() FROM auth.users;
INSERT INTO auth.mfa_factors (id, user_id, factor_type, secret) SELECT gen_random_uuid(), id, 'totp', 'SYNTHETICTOTPSECRET' FROM auth.users WHERE right(id::text, 1) = '1';
INSERT INTO realtime.messages (topic, payload, inserted_at) SELECT 'synthetic', '{"a":1}', timestamp '2026-11-13 01:00' + (g || ' seconds')::interval FROM generate_series(1, 25) g;
INSERT INTO realtime.schema_migrations VALUES (20211116024918, '2026-01-01 00:00'), (20211116045059, '2026-01-01 00:00');
INSERT INTO supabase_migrations.schema_migrations VALUES ('20261113000072', ARRAY['select 1'], 'security_rls_hardening');
