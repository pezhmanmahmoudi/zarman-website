-- Add customer-level compliance tracking fields for admin AML/DVS operations.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS compliance_dvs_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS compliance_dvs_method text,
  ADD COLUMN IF NOT EXISTS compliance_dvs_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS compliance_dvs_outcome text,
  ADD COLUMN IF NOT EXISTS compliance_aml_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS compliance_aml_method text,
  ADD COLUMN IF NOT EXISTS compliance_aml_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS compliance_aml_outcome text,
  ADD COLUMN IF NOT EXISTS compliance_aml_flag text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS compliance_customer_flagged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS compliance_customer_flagged_at timestamptz,
  ADD COLUMN IF NOT EXISTS compliance_customer_flag_reason text,
  ADD COLUMN IF NOT EXISTS compliance_admin_note text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_compliance_dvs_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_compliance_dvs_status_check
      CHECK (compliance_dvs_status IN ('not_started', 'completed', 'failed', 'skipped'));
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_compliance_aml_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_compliance_aml_status_check
      CHECK (compliance_aml_status IN ('not_started', 'completed', 'failed', 'skipped'));
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_compliance_aml_flag_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_compliance_aml_flag_check
      CHECK (compliance_aml_flag IN ('none', 'clear', 'review_required', 'failed'));
  END IF;
END$$;
