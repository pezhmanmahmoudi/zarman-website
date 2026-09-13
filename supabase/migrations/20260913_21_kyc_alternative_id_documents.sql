-- AU customers who hold neither an Australian driver licence nor an Australian
-- passport are DVS-verified manually using alternative supporting documents.
-- The identity document (photo ID / proof of age card / foreign passport /
-- etc.) and the residential address document (bank statement / utility
-- account / etc.) are recorded using AUSTRAC's own "ID type" enumeration —
-- the same fixed list AUSTRAC's IFTI-DRA report uses for "ID type (1)" and
-- "ID type (2)" — so the exported report never contains a value AUSTRAC's
-- validation would reject. "Other (provide description)" pairs with a free
-- text column, matching AUSTRAC's "ID type (if 'Other')" report column.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS compliance_dvs_alt_id_type text,
  ADD COLUMN IF NOT EXISTS compliance_dvs_alt_id_type_other text,
  ADD COLUMN IF NOT EXISTS compliance_dvs_alt_id_number text,
  ADD COLUMN IF NOT EXISTS compliance_dvs_alt_id_issuer text,
  ADD COLUMN IF NOT EXISTS compliance_dvs_alt_address_type text,
  ADD COLUMN IF NOT EXISTS compliance_dvs_alt_address_type_other text,
  ADD COLUMN IF NOT EXISTS compliance_dvs_alt_address_reference text,
  ADD COLUMN IF NOT EXISTS compliance_dvs_alt_address_issuer text,
  ADD COLUMN IF NOT EXISTS compliance_dvs_alt_address_date date;

-- Drop any earlier (pre-AUSTRAC-alignment) constraints from a prior version
-- of this migration, so this file is safe to (re)run as-is.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_compliance_dvs_alt_id_type_check;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_compliance_dvs_alt_address_type_check;

DO $$
BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_compliance_dvs_alt_id_type_check
    CHECK (compliance_dvs_alt_id_type IS NULL OR compliance_dvs_alt_id_type IN (
      'Alien registration number',
      'Bank account',
      'Benefits card/ID',
      'Birth certificate',
      'Business registration/licence',
      'Credit/debit card',
      'Customer account/ID',
      'Driver''s licence',
      'Employee ID',
      'Employer number',
      'Identity card/number',
      'Membership ID',
      'Passport',
      'Photo ID',
      'Security ID',
      'Social security ID',
      'Student ID',
      'Tax number/ID (except Australian tax file numbers (TFN))',
      'Telephone/fax number',
      'Other (provide description)'
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

DO $$
BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_compliance_dvs_alt_address_type_check
    CHECK (compliance_dvs_alt_address_type IS NULL OR compliance_dvs_alt_address_type IN (
      'Alien registration number',
      'Bank account',
      'Benefits card/ID',
      'Birth certificate',
      'Business registration/licence',
      'Credit/debit card',
      'Customer account/ID',
      'Driver''s licence',
      'Employee ID',
      'Employer number',
      'Identity card/number',
      'Membership ID',
      'Passport',
      'Photo ID',
      'Security ID',
      'Social security ID',
      'Student ID',
      'Tax number/ID (except Australian tax file numbers (TFN))',
      'Telephone/fax number',
      'Other (provide description)'
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

