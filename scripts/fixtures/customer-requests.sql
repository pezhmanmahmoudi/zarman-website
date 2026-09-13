-- Synthetic baseline used only by the isolated PGlite request-workflow suite.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE TABLE storage.buckets (
  id text PRIMARY KEY, name text NOT NULL, public boolean DEFAULT false,
  file_size_limit bigint, allowed_mime_types text[]
);
CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text REFERENCES storage.buckets(id),
  name text NOT NULL, metadata jsonb, UNIQUE(bucket_id,name)
);
CREATE TABLE auth.users (
  id uuid PRIMARY KEY, email text NOT NULL,
  email_confirmed_at timestamptz DEFAULT now(), raw_app_meta_data jsonb NOT NULL DEFAULT '{}'
);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('app_metadata',COALESCE((SELECT raw_app_meta_data FROM auth.users WHERE id=auth.uid()),'{}'::jsonb));
$$;
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id), email text, first_name text, last_name text, customer_code text,
  kyc_status text NOT NULL DEFAULT 'pending', loyalty_discount_toman numeric NOT NULL DEFAULT 0,
  compliance_customer_flagged boolean NOT NULL DEFAULT false,
  compliance_aml_flag text NOT NULL DEFAULT 'none', compliance_dvs_status text NOT NULL DEFAULT 'not_started'
);
CREATE TABLE recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES profiles(id),
  direction text, label text, full_name text, account_name text, bank_name text,
  account_number text, bsb text, iban text
);
CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES profiles(id),
  type text NOT NULL CHECK(type IN ('buy_aud','sell_aud')), amount_aud numeric NOT NULL,
  equivalent_toman numeric NOT NULL, applied_rate numeric, ledger_fee_aud numeric,
  status text NOT NULL DEFAULT 'pending', source_of_funds text, reason_for_transfer text,
  recipient_id uuid REFERENCES recipients(id) ON DELETE SET NULL, promo_code text,
  discount_amount numeric, final_amount numeric, loyalty_discount numeric,
  reference_code text UNIQUE, payment_link text, approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE rates_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), date date NOT NULL UNIQUE,
  buy_aud numeric NOT NULL, sell_aud numeric NOT NULL, market_active boolean NOT NULL DEFAULT true,
  applied_fee numeric DEFAULT 30, fee_threshold numeric DEFAULT 1000,
  discount_step_volume numeric DEFAULT 1000, discount_percent_per_step numeric DEFAULT 0.005,
  max_discount_percent numeric DEFAULT 0.25
);
CREATE TABLE promo_codes (
  code text PRIMARY KEY, discount_type text NOT NULL, discount_value numeric NOT NULL,
  max_uses integer, used_count integer NOT NULL DEFAULT 0, active boolean NOT NULL DEFAULT true,
  expires_at timestamptz
);
CREATE TABLE bank_accounts (
  id uuid PRIMARY KEY, account_name text NOT NULL, currency text NOT NULL CHECK(currency IN ('AUD','IRT')),
  is_active boolean NOT NULL DEFAULT true, account_type text NOT NULL DEFAULT 'bank'
);
CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), date date NOT NULL, title text NOT NULL, category text NOT NULL,
  currency text NOT NULL, amount numeric NOT NULL, exchange_rate numeric, payer_account_id uuid REFERENCES bank_accounts(id),
  status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE owner_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), date date NOT NULL, loan_type text NOT NULL, currency text NOT NULL,
  amount numeric NOT NULL, exchange_rate numeric, account_id uuid REFERENCES bank_accounts(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), transaction_id uuid REFERENCES transactions(id),
  date_gregorian date NOT NULL, date_jalali text NOT NULL, type text NOT NULL,
  entry_type text NOT NULL DEFAULT 'trade', exchange_rate numeric, amount_aud numeric NOT NULL,
  amount_toman numeric NOT NULL, sender text, recipient text, fee_aud numeric DEFAULT 0,
  payer_account_id uuid REFERENCES bank_accounts(id), receiver_account_id uuid REFERENCES bank_accounts(id),
  created_by uuid REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE bank_transfer_fee_accruals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), transaction_id uuid NOT NULL UNIQUE REFERENCES transactions(id),
  fee_month date NOT NULL, transfer_method text NOT NULL, transaction_amount_toman numeric NOT NULL,
  fee_amount_toman numeric NOT NULL, payer_account_id uuid NOT NULL REFERENCES bank_accounts(id),
  receiver_account_id uuid REFERENCES bank_accounts(id), status text DEFAULT 'accrued',
  accrued_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES auth.users(id)
);
CREATE TABLE audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id uuid, actor_email text,
  action text, target_type text, target_id text, old_value jsonb, new_value jsonb
);
-- Simulate existing legacy permissions. The new managed-transaction trigger
-- must protect linked requests even when a legacy service route has grants.
GRANT SELECT,INSERT,UPDATE,DELETE ON transactions,ledger TO service_role,authenticated;
GRANT USAGE ON SCHEMA auth TO service_role,authenticated,anon;
CREATE FUNCTION test_reject_request_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('test.reject_audit', true) = 'on' THEN
    RAISE EXCEPTION 'Synthetic audit unavailable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER test_reject_request_audit BEFORE INSERT ON audit_logs
FOR EACH ROW EXECUTE FUNCTION test_reject_request_audit();
