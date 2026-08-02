-- Add structured recipient address fields so AUSTRAC IFTI exports can map city/state/postcode/country explicitly.
alter table if exists public.recipients
  add column if not exists residential_city text,
  add column if not exists residential_state text,
  add column if not exists residential_postcode text,
  add column if not exists residential_country text,
  add column if not exists irt_city text,
  add column if not exists irt_state text,
  add column if not exists irt_postcode text,
  add column if not exists irt_country text;
