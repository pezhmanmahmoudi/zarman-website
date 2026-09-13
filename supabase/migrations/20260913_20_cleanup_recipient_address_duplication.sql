-- One-time cleanup: earlier app code re-composed city/state/postcode/country back
-- into residential_address/irt_address on every save, so those columns can contain
-- duplicated text (e.g. "...45 Metri Kaj St.,, Karaj,, Alborz Province, Iran" while
-- residential_city/state/country hold the same values separately). The app now
-- stores street-only text in these columns; this migration recovers the clean
-- street value for existing rows without touching the already-correct structured
-- columns (city/state/postcode/country).

create or replace function public.strip_known_address_suffix(
  raw_address text,
  p_city text,
  p_state text,
  p_postcode text,
  p_country text
) returns text
language plpgsql
as $$
declare
  working text;
  part text;
  parts text[] := array[]::text[];
  changed boolean;
begin
  working := trim(regexp_replace(coalesce(raw_address, ''), '\s+', ' ', 'g'));
  working := regexp_replace(working, '(,\s*){2,}', ', ', 'g');
  working := regexp_replace(working, '\s*,\s*', ', ', 'g');
  working := trim(both ', ' from working);

  if working = '' then
    return '';
  end if;

  foreach part in array array[p_city, p_state, p_postcode, p_country]
  loop
    part := trim(both ', ' from trim(regexp_replace(coalesce(part, ''), '\s+', ' ', 'g')));
    if part <> '' then
      parts := array_append(parts, part);
    end if;
  end loop;

  if array_length(parts, 1) is null then
    return working;
  end if;

  changed := true;
  while changed loop
    changed := false;
    foreach part in array parts
    loop
      if length(part) > 0
        and length(part) <= length(working)
        and lower(right(working, length(part))) = lower(part)
      then
        working := left(working, length(working) - length(part));
        working := trim(regexp_replace(working, '[\s,]+$', ''));
        changed := true;
      end if;
    end loop;
  end loop;

  return working;
end;
$$;

-- Trim stray leading/trailing commas picked up by earlier faulty address parsing.
update public.recipients
set residential_city = trim(both ', ' from residential_city)
where residential_city is not null and residential_city <> trim(both ', ' from residential_city);

update public.recipients
set residential_state = trim(both ', ' from residential_state)
where residential_state is not null and residential_state <> trim(both ', ' from residential_state);

update public.recipients
set residential_country = trim(both ', ' from residential_country)
where residential_country is not null and residential_country <> trim(both ', ' from residential_country);

update public.recipients
set irt_city = trim(both ', ' from irt_city)
where irt_city is not null and irt_city <> trim(both ', ' from irt_city);

update public.recipients
set irt_state = trim(both ', ' from irt_state)
where irt_state is not null and irt_state <> trim(both ', ' from irt_state);

update public.recipients
set irt_country = trim(both ', ' from irt_country)
where irt_country is not null and irt_country <> trim(both ', ' from irt_country);

-- Recover the street-only value for AUD recipients.
update public.recipients r
set residential_address = s.cleaned
from (
  select id, public.strip_known_address_suffix(
    residential_address, residential_city, residential_state, residential_postcode, residential_country
  ) as cleaned
  from public.recipients
  where coalesce(trim(residential_address), '') <> ''
    and (
      coalesce(trim(residential_city), '') <> ''
      or coalesce(trim(residential_state), '') <> ''
      or coalesce(trim(residential_postcode), '') <> ''
      or coalesce(trim(residential_country), '') <> ''
    )
) s
where r.id = s.id
  and s.cleaned <> ''
  and s.cleaned is distinct from r.residential_address;

-- Recover the street-only value for IRT recipients.
update public.recipients r
set irt_address = s.cleaned
from (
  select id, public.strip_known_address_suffix(
    irt_address, irt_city, irt_state, irt_postcode, irt_country
  ) as cleaned
  from public.recipients
  where coalesce(trim(irt_address), '') <> ''
    and (
      coalesce(trim(irt_city), '') <> ''
      or coalesce(trim(irt_state), '') <> ''
      or coalesce(trim(irt_postcode), '') <> ''
      or coalesce(trim(irt_country), '') <> ''
    )
) s
where r.id = s.id
  and s.cleaned <> ''
  and s.cleaned is distinct from r.irt_address;

drop function public.strip_known_address_suffix(text, text, text, text, text);
