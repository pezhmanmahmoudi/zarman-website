-- One-time backfill: parse legacy full-address strings into structured address fields
-- for existing recipients. This does not overwrite the original full-address columns.

create or replace function public.parse_legacy_recipient_address(raw text)
returns table (
  street text,
  city text,
  state text,
  postcode text,
  country text
)
language plpgsql
as $$
declare
  normalized text;
  working text;
  parts text[];
  words text[];
  n int;
  guessed_city text;
  guessed_street text;
begin
  normalized := regexp_replace(trim(coalesce(raw, '')), '\s+', ' ', 'g');
  if normalized = '' then
    return;
  end if;

  -- Country inference
  if normalized ~* '\m(islamic republic of iran|iran)\M' then
    country := 'Iran';
  elsif normalized ~* '\maustralia\M' then
    country := 'Australia';
  end if;

  -- Postcode: last 4-digit token (common AU format)
  postcode := reverse(substring(reverse(normalized) from '(\d{4})'));
  if postcode = '' then
    postcode := null;
  end if;

  -- State inference from common AU state abbreviations in the address string
  state := substring(normalized from '\m(NSW|VIC|QLD|SA|WA|TAS|ACT|NT)\M');

  parts := regexp_split_to_array(normalized, '\s*,\s*');

  if coalesce(array_length(parts, 1), 0) >= 2 then
    guessed_city := parts[array_upper(parts, 1)];
    guessed_street := array_to_string(parts[1:array_upper(parts, 1) - 1], ', ');
  else
    -- Fallback: remove known tokens then split trailing words as city
    working := normalized;
    if country is not null then
      working := regexp_replace(working, '\m(' || country || '|Islamic Republic of Iran)\M', '', 'gi');
    end if;
    if state is not null then
      working := regexp_replace(working, '\m' || state || '\M', '', 'gi');
    end if;
    if postcode is not null then
      working := regexp_replace(working, '\m' || postcode || '\M', '', 'g');
    end if;

    working := trim(regexp_replace(working, '\s+', ' ', 'g'));
    words := regexp_split_to_array(working, '\s+');
    n := coalesce(array_length(words, 1), 0);

    if n >= 3 then
      guessed_city := words[n - 1] || ' ' || words[n];
      guessed_street := array_to_string(words[1:n - 2], ' ');
    elsif n >= 1 then
      guessed_street := working;
    end if;
  end if;

  -- Cleanup inferred city
  guessed_city := trim(regexp_replace(coalesce(guessed_city, ''), '\s+', ' ', 'g'));
  guessed_city := regexp_replace(guessed_city, '\m(NSW|VIC|QLD|SA|WA|TAS|ACT|NT)\M', '', 'gi');
  guessed_city := regexp_replace(guessed_city, '\m\d{4}\M', '', 'g');
  guessed_city := trim(regexp_replace(guessed_city, '\s+', ' ', 'g'));
  if guessed_city = '' then guessed_city := null; end if;

  guessed_street := trim(regexp_replace(coalesce(guessed_street, ''), '\s+', ' ', 'g'));
  if guessed_street = '' then guessed_street := null; end if;

  street := guessed_street;
  city := guessed_city;

  return next;
end;
$$;

-- Backfill AUD address fields from residential_address where structured fields are missing.
with parsed_residential as (
  select
    r.id,
    p.city,
    p.state,
    p.postcode,
    p.country
  from public.recipients r
  cross join lateral public.parse_legacy_recipient_address(r.residential_address) p
  where coalesce(trim(r.residential_address), '') <> ''
    and (
      coalesce(trim(r.residential_city), '') = ''
      or coalesce(trim(r.residential_state), '') = ''
      or coalesce(trim(r.residential_postcode), '') = ''
      or coalesce(trim(r.residential_country), '') = ''
    )
)
update public.recipients r
set
  residential_city = coalesce(nullif(trim(r.residential_city), ''), p.city),
  residential_state = coalesce(nullif(trim(r.residential_state), ''), p.state),
  residential_postcode = coalesce(nullif(trim(r.residential_postcode), ''), p.postcode),
  residential_country = coalesce(nullif(trim(r.residential_country), ''), p.country)
from parsed_residential p
where r.id = p.id;

-- Backfill IRT address fields from irt_address where structured fields are missing.
with parsed_irt as (
  select
    r.id,
    p.city,
    p.state,
    p.postcode,
    p.country
  from public.recipients r
  cross join lateral public.parse_legacy_recipient_address(r.irt_address) p
  where coalesce(trim(r.irt_address), '') <> ''
    and (
      coalesce(trim(r.irt_city), '') = ''
      or coalesce(trim(r.irt_state), '') = ''
      or coalesce(trim(r.irt_postcode), '') = ''
      or coalesce(trim(r.irt_country), '') = ''
    )
)
update public.recipients r
set
  irt_city = coalesce(nullif(trim(r.irt_city), ''), p.city),
  irt_state = coalesce(nullif(trim(r.irt_state), ''), p.state),
  irt_postcode = coalesce(nullif(trim(r.irt_postcode), ''), p.postcode),
  irt_country = coalesce(nullif(trim(r.irt_country), ''), p.country)
from parsed_irt p
where r.id = p.id;
