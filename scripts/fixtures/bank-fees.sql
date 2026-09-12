-- Synthetic, isolated schema for scripts/test-bank-fees.mjs. No real accounts.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  raw_app_meta_data jsonb NOT NULL DEFAULT '{}'
);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY,
  account_name text NOT NULL,
  currency text NOT NULL CHECK (currency IN ('IRT', 'AUD')),
  opening_balance numeric(20, 2) NOT NULL DEFAULT 1000000
);
CREATE TABLE public.transactions (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  title text NOT NULL,
  category text NOT NULL,
  currency text NOT NULL CHECK (currency IN ('IRT', 'AUD')),
  amount numeric(20, 2) NOT NULL CHECK (amount > 0),
  exchange_rate numeric,
  payer_account_id uuid REFERENCES public.bank_accounts(id),
  status text NOT NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES auth.users(id),
  actor_email text,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  old_value jsonb,
  new_value jsonb
);

-- An independent cash oracle: every paid expense mutation produces its cash
-- delta. This is a fixture trigger, not a copy of the fee-posting algorithm.
-- A failed PostgreSQL transaction must roll these journal entries back too.
CREATE TABLE public.test_cash_journal (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  expense_id uuid NOT NULL,
  account_id uuid NOT NULL,
  delta numeric(20, 2) NOT NULL
);
CREATE FUNCTION public.test_expense_cash_effect() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.payer_account_id = NEW.payer_account_id
     AND OLD.status = 'paid' AND NEW.status = 'paid' THEN
    IF OLD.amount <> NEW.amount THEN
      INSERT INTO public.test_cash_journal (expense_id, account_id, delta)
      VALUES (NEW.id, NEW.payer_account_id, OLD.amount - NEW.amount);
    END IF;
  ELSE
    IF TG_OP <> 'INSERT' AND OLD.status = 'paid' THEN
      INSERT INTO public.test_cash_journal (expense_id, account_id, delta)
      VALUES (OLD.id, OLD.payer_account_id, OLD.amount);
    END IF;
    IF TG_OP <> 'DELETE' AND NEW.status = 'paid' THEN
      INSERT INTO public.test_cash_journal (expense_id, account_id, delta)
      VALUES (NEW.id, NEW.payer_account_id, -NEW.amount);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER test_expense_cash_effect AFTER INSERT OR UPDATE OR DELETE
  ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.test_expense_cash_effect();

CREATE FUNCTION public.test_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('test.reject_audit', true) = 'on' THEN
    RAISE EXCEPTION 'Synthetic audit unavailable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER test_reject_audit BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.test_reject_audit();

CREATE TABLE public.test_report_refreshes (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY);
CREATE FUNCTION public.refresh_enterprise_reports() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.test_report_refreshes DEFAULT VALUES;
  IF current_setting('test.reject_refresh', true) = 'on' THEN
    RAISE EXCEPTION 'Synthetic report refresh unavailable' USING ERRCODE = '23514';
  END IF;
END;
$$;
