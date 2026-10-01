-- Apply to the isolated test project first. No changes are applied by the app.
-- Customer evidence is kept separate from administrator-verified compliance fields.
BEGIN;
CREATE TABLE IF NOT EXISTS public.customer_kyc_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  document_type text NOT NULL,
  details jsonb NOT NULL,
  upload_ids uuid[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.customer_kyc_uploads (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  document_type text NOT NULL,
  role text NOT NULL CHECK (role IN ('front','back','address')),
  address_type text,
  storage_path text NOT NULL UNIQUE,
  original_name text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','application/pdf')),
  byte_size integer NOT NULL CHECK (byte_size > 0 AND byte_size <= 4194304),
  sha256 text NOT NULL,
  submission_id uuid REFERENCES public.customer_kyc_submissions(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_kyc_uploads_owner ON public.customer_kyc_uploads(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS customer_kyc_submissions_owner ON public.customer_kyc_submissions(user_id, created_at DESC);
ALTER TABLE public.customer_kyc_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_kyc_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_kyc_uploads, public.customer_kyc_submissions FROM anon, authenticated;
GRANT ALL ON public.customer_kyc_uploads, public.customer_kyc_submissions TO service_role;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('customer-kyc-evidence','customer-kyc-evidence',false,4194304,ARRAY['image/jpeg','image/png','application/pdf'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=EXCLUDED.file_size_limit,allowed_mime_types=EXCLUDED.allowed_mime_types;
DROP POLICY IF EXISTS customer_kyc_evidence_server_only ON storage.objects;
CREATE POLICY customer_kyc_evidence_server_only ON storage.objects AS RESTRICTIVE
FOR ALL TO anon,authenticated
USING(bucket_id <> 'customer-kyc-evidence') WITH CHECK(bucket_id <> 'customer-kyc-evidence');

-- Service-role only. The authenticated server action validates the catalog,
-- dates, consents, role/type binding and attachment count before this call.
CREATE OR REPLACE FUNCTION public.submit_customer_kyc_evidence(p_user_id uuid, p_details jsonb, p_upload_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,public AS $$
DECLARE v_status text; v_id uuid; v_count integer;
BEGIN
  IF p_details->>'consent_notice' IS DISTINCT FROM 'true' OR p_details->>'consent_dvs' IS DISTINCT FROM 'true'
    THEN RAISE EXCEPTION 'Explicit consent is required'; END IF;
  SELECT kyc_status INTO v_status FROM public.profiles WHERE id=p_user_id FOR UPDATE;
  IF NOT FOUND OR v_status='approved' THEN RAISE EXCEPTION 'Account cannot be resubmitted'; END IF;
  SELECT id INTO v_id FROM public.customer_kyc_submissions
    WHERE user_id=p_user_id AND upload_ids=p_upload_ids AND document_type=p_details->>'document_type' LIMIT 1;
  IF v_id IS NOT NULL THEN
    IF v_status IN ('pending','under_review') AND EXISTS(
      SELECT 1 FROM public.customer_kyc_submissions WHERE id=v_id AND details=p_details
    ) THEN RETURN v_id; END IF;
    RAISE EXCEPTION 'Previously submitted evidence cannot be reused for a changed application';
  END IF;
  IF cardinality(p_upload_ids) NOT BETWEEN 1 AND 3 THEN RAISE EXCEPTION 'Missing evidence'; END IF;
  PERFORM id FROM public.customer_kyc_uploads WHERE id=ANY(p_upload_ids) FOR UPDATE;
  SELECT count(*) INTO v_count FROM public.customer_kyc_uploads
    WHERE id=ANY(p_upload_ids) AND user_id=p_user_id AND submission_id IS NULL
      AND document_type=p_details->>'document_type';
  IF v_count <> cardinality(p_upload_ids) THEN RAISE EXCEPTION 'Invalid evidence ownership or state'; END IF;
  INSERT INTO public.customer_kyc_submissions(user_id,document_type,details,upload_ids)
    VALUES(p_user_id,p_details->>'document_type',p_details,p_upload_ids) RETURNING id INTO v_id;
  UPDATE public.customer_kyc_uploads SET submission_id=v_id WHERE id=ANY(p_upload_ids);
  UPDATE public.profiles SET
    first_name=p_details->>'first_name',last_name=p_details->>'last_name',mobile_number=p_details->>'mobile_number',
    dob=(p_details->>'dob')::date,country=p_details->>'country',address=p_details->>'address',
    city=p_details->>'city',state=p_details->>'state',postcode=p_details->>'postcode',
    document_type=p_details->>'profile_document_type',
    license_number=NULLIF(p_details->>'license_number',''),card_number=NULLIF(p_details->>'card_number',''),
    state_of_issue=NULLIF(p_details->>'state_of_issue',''),passport_number=NULLIF(p_details->>'passport_number',''),
    expiry_date=NULLIF(p_details->>'expiry_date','')::date,kyc_status='pending',
    -- New identity data cannot reuse an old successful check. Preserve risk flags
    -- and failures; previous outcomes remain in the compliance audit history.
    compliance_dvs_status=CASE WHEN compliance_dvs_status IN ('completed','skipped') THEN 'not_started' ELSE compliance_dvs_status END,
    compliance_aml_status=CASE WHEN compliance_aml_status IN ('completed','skipped') THEN 'not_started' ELSE compliance_aml_status END
    WHERE id=p_user_id;
  INSERT INTO public.audit_logs(actor_id,actor_email,action,target_type,target_id,new_value)
    VALUES(p_user_id,(SELECT email FROM auth.users WHERE id=p_user_id),'KYC_EVIDENCE_SUBMITTED','profile',p_user_id,
      jsonb_build_object('submission_id',v_id,'document_type',p_details->>'document_type',
        'consent_notice',p_details->'consent_notice','consent_dvs',p_details->'consent_dvs',
        'consent_version',p_details->>'consent_version','submitted_at',now()));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.submit_customer_kyc_evidence(uuid,jsonb,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_customer_kyc_evidence(uuid,jsonb,uuid[]) TO service_role;
COMMIT;
