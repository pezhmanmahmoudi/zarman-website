-- Cosmetic, account-level acknowledgement of the first approved identity notice.
-- Existing approved customers see the notice once on their next overview visit.
BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kyc_approval_notice_seen_at timestamptz;

COMMENT ON COLUMN public.profiles.kyc_approval_notice_seen_at IS
  'First overview visit showing successful identity verification. Does not affect KYC eligibility.';

CREATE OR REPLACE FUNCTION public.acknowledge_kyc_approval_notice(p_profile_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_seen_at timestamptz;
BEGIN
  UPDATE public.profiles
  SET kyc_approval_notice_seen_at = now()
  WHERE id = p_profile_id AND id = (SELECT auth.uid())
    AND kyc_status = 'approved' AND kyc_approval_notice_seen_at IS NULL
  RETURNING kyc_approval_notice_seen_at INTO v_seen_at;

  IF v_seen_at IS NULL THEN
    SELECT kyc_approval_notice_seen_at INTO v_seen_at
    FROM public.profiles
    WHERE id = p_profile_id AND id = (SELECT auth.uid()) AND kyc_status = 'approved';
  END IF;
  RETURN v_seen_at;
END;
$$;

REVOKE ALL ON FUNCTION public.acknowledge_kyc_approval_notice(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acknowledge_kyc_approval_notice(uuid) TO authenticated;

COMMIT;
