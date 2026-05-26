-- ============================================================
-- Migration: Re-randomize sequential reference codes
-- Replaces ZE00001, ZE00002... with hash-based random codes
-- Uses hashtext(id) so the mapping is deterministic per row
-- but looks random to the outside world.
-- ============================================================

UPDATE public.transactions
SET reference_code = 'ZE' || LPAD(
  (abs(hashtext(id::text)) % 100000)::text,
  5, '0'
);
