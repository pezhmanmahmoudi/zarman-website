-- Internal sanctions (DFAT) and PEP screening, per-request compliance record, customer
-- PEP self-declaration. Apply manually after _68. Idempotent; changes no existing rows.
--
--   compliance_list_imports   one row per uploaded DFAT file / Wikidata PEP import
--   sanctions_entries         DFAT Consolidated List rows (primary names + aliases)
--   pep_entries               PEP names from Wikidata (CC0, free for commercial use)
--   request_compliance        per-request category (A/B/C), funding method, ECDD approval
--   compliance_screenings     every screening result (internal, vendor, self-declaration) with
--                             match detail and the admin decision (false positive / confirmed)
--   profiles.pep_*            customer self-declaration, asked at KYC and recorded
--
-- All tables are service-role only (no customer or anon access).
BEGIN;

CREATE TABLE IF NOT EXISTS public.compliance_list_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('dfat', 'pep_wikidata')),
  status text NOT NULL DEFAULT 'loading' CHECK (status IN ('loading', 'active', 'superseded', 'failed')),
  source_name text,
  entry_count integer NOT NULL DEFAULT 0,
  latest_control_date date,
  notes text,
  imported_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz
);
CREATE INDEX IF NOT EXISTS compliance_list_imports_kind_status ON public.compliance_list_imports (kind, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.sanctions_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.compliance_list_imports(id) ON DELETE CASCADE,
  reference text NOT NULL,          -- DFAT "Reference", e.g. "2" (primary) or "2a" (alias)
  group_ref text NOT NULL,          -- numeric part of the reference; groups a name with its aliases
  name text NOT NULL,
  entry_type text,                  -- Individual / Entity / Ship
  name_type text,                   -- Primary Name / Alias / Original Script
  alias_strength text,
  dob text,
  place_of_birth text,
  citizenship text,
  address text,
  additional_information text,
  listing_information text,
  committees text,
  instrument text,
  control_date date,
  targeted_financial_sanction boolean
);
CREATE INDEX IF NOT EXISTS sanctions_entries_import ON public.sanctions_entries (import_id);
CREATE INDEX IF NOT EXISTS sanctions_entries_group ON public.sanctions_entries (import_id, group_ref);

CREATE TABLE IF NOT EXISTS public.pep_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.compliance_list_imports(id) ON DELETE CASCADE,
  wikidata_id text NOT NULL,        -- e.g. Q57400
  name text NOT NULL,               -- label or alias; one row per name variant
  is_alias boolean NOT NULL DEFAULT false,
  country text,
  positions text[] NOT NULL DEFAULT '{}',
  dob text,
  is_current boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS pep_entries_import ON public.pep_entries (import_id);

CREATE TABLE IF NOT EXISTS public.request_compliance (
  request_id uuid PRIMARY KEY REFERENCES public.exchange_requests(id) ON DELETE CASCADE,
  funding_method text NOT NULL DEFAULT 'bank' CHECK (funding_method IN ('bank', 'cash')),
  category text NOT NULL DEFAULT 'A' CHECK (category IN ('A', 'B', 'C')),
  triggers jsonb NOT NULL DEFAULT '[]'::jsonb,
  manual_escalation text CHECK (manual_escalation IN ('B', 'C')),
  manual_escalation_reason text,
  amount_aud numeric(20,2),
  rolling_12m_aud numeric(20,2),
  ecdd_status text NOT NULL DEFAULT 'not_required' CHECK (ecdd_status IN ('not_required', 'pending', 'approved', 'refused')),
  ecdd_reason text,
  ecdd_decided_by uuid REFERENCES auth.users(id),
  ecdd_decided_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.compliance_screenings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.exchange_requests(id) ON DELETE CASCADE,  -- NULL = customer-level (onboarding)
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  party text NOT NULL CHECK (party IN ('customer', 'beneficiary')),
  check_kind text NOT NULL CHECK (check_kind IN ('sanctions', 'pep', 'combined')),
  method text NOT NULL CHECK (method IN ('internal_dfat', 'internal_pep', 'vendor_namescan', 'self_declaration')),
  subject_name text NOT NULL,
  subject_dob date,
  outcome text NOT NULL CHECK (outcome IN ('clear', 'potential_match', 'failed', 'declared_yes', 'declared_no', 'waived')),
  top_score integer,
  matches jsonb NOT NULL DEFAULT '[]'::jsonb,
  list_import_id uuid REFERENCES public.compliance_list_imports(id) ON DELETE SET NULL,
  vendor_reference text,
  vendor_response jsonb,
  note text,
  performed_by uuid REFERENCES auth.users(id),
  performed_at timestamptz NOT NULL DEFAULT now(),
  decision text CHECK (decision IN ('pending', 'false_positive', 'confirmed_match')),
  decision_reason text,
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz
);
CREATE INDEX IF NOT EXISTS compliance_screenings_request ON public.compliance_screenings (request_id, party, check_kind, performed_at DESC);
CREATE INDEX IF NOT EXISTS compliance_screenings_profile ON public.compliance_screenings (profile_id, party, check_kind, performed_at DESC) WHERE request_id IS NULL;
CREATE INDEX IF NOT EXISTS compliance_screenings_pending ON public.compliance_screenings (performed_at DESC) WHERE outcome IN ('potential_match', 'declared_yes') AND (decision IS NULL OR decision = 'pending');

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pep_self_declared boolean,
  ADD COLUMN IF NOT EXISTS pep_declaration_relation text,   -- self | family | close_associate
  ADD COLUMN IF NOT EXISTS pep_declaration_details text,
  ADD COLUMN IF NOT EXISTS pep_declared_at timestamptz,
  ADD COLUMN IF NOT EXISTS pep_declaration_source text;      -- customer_form | admin_recorded

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_pep_declaration_relation_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_pep_declaration_relation_check
      CHECK (pep_declaration_relation IS NULL OR pep_declaration_relation IN ('self', 'family', 'close_associate'));
  END IF;
END$$;

ALTER TABLE public.compliance_list_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sanctions_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pep_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_compliance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_screenings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.compliance_list_imports, public.sanctions_entries, public.pep_entries,
  public.request_compliance, public.compliance_screenings FROM anon, authenticated;
GRANT ALL ON public.compliance_list_imports, public.sanctions_entries, public.pep_entries,
  public.request_compliance, public.compliance_screenings TO service_role;

COMMIT;
