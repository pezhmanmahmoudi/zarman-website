-- DFAT listings outside the Australia-Iran corridor (China, Russia, Pakistan, no Iran link) stay in the
-- list but only produce a hit on a strong match. Apply after _69, then re-load the DFAT list.
ALTER TABLE public.sanctions_entries ADD COLUMN IF NOT EXISTS low_relevance boolean NOT NULL DEFAULT false;
