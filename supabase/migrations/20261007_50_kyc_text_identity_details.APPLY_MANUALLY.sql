-- Apply after _37 in the isolated test project before production rollout.
-- Primary identity documents use text details. Historical evidence is untouched.
BEGIN;
ALTER TABLE public.customer_kyc_uploads DROP CONSTRAINT IF EXISTS customer_kyc_uploads_role_check;
ALTER TABLE public.customer_kyc_uploads ADD CONSTRAINT customer_kyc_uploads_role_check
  CHECK (role IN ('front','back','address','source_of_funds'));

CREATE OR REPLACE FUNCTION public.reject_primary_kyc_image_upload()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog,public AS $$
BEGIN
  IF NEW.document_type IN ('driver_license','passport','medicare')
     AND NEW.role IN ('front','back') THEN
    RAISE EXCEPTION 'Primary identity documents require text details, not images';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS reject_primary_kyc_image_upload ON public.customer_kyc_uploads;
CREATE TRIGGER reject_primary_kyc_image_upload
  BEFORE INSERT OR UPDATE OF document_type,role ON public.customer_kyc_uploads
  FOR EACH ROW EXECUTE FUNCTION public.reject_primary_kyc_image_upload();

CREATE OR REPLACE FUNCTION public.submit_customer_kyc_evidence(p_user_id uuid, p_details jsonb, p_upload_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,public AS $$
DECLARE
  v_status text; v_id uuid; v_count integer; v_type text;
  v_required text[]; v_expected_profile_type text;
BEGIN
  IF p_details->'consent_notice' IS DISTINCT FROM 'true'::jsonb
     OR p_details->'consent_dvs' IS DISTINCT FROM 'true'::jsonb
     OR COALESCE(btrim(p_details->>'consent_version'),'')='' THEN
    RAISE EXCEPTION 'Explicit consent is required';
  END IF;
  v_type := p_details->>'document_type';
  IF v_type IS NULL OR v_type NOT IN ('driver_license','passport','medicare','photo_id','proof_of_age',
      'foreign_passport','national_id','birth_certificate','citizenship_certificate','concession_card','certified_copy') THEN
    RAISE EXCEPTION 'Unsupported identity document';
  END IF;
  -- Zarman intake policy: residence in Iran requires an Iranian passport upload.
  IF lower(btrim(p_details->>'country')) IN ('iran','ir','irn','ایران','iran (islamic republic of)') THEN
    IF v_type <> 'foreign_passport'
       OR COALESCE(lower(btrim(p_details->>'document_issuer')),'') NOT IN ('iran','ir','irn','ایران','iran (islamic republic of)') THEN
      RAISE EXCEPTION 'Residents of Iran must provide an Iranian passport';
    END IF;
    IF jsonb_typeof(p_details->'document_number') IS DISTINCT FROM 'string'
       OR COALESCE(btrim(p_details->>'document_number'),'')=''
       OR length(p_details->>'document_number')>200 THEN
      RAISE EXCEPTION 'Iranian passport number is required';
    END IF;
    IF COALESCE(p_details->>'expiry_date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       OR (p_details->>'expiry_date')::date < (now() AT TIME ZONE 'Australia/Sydney')::date THEN
      RAISE EXCEPTION 'A current Iranian passport and expiry date are required';
    END IF;
  END IF;
  v_expected_profile_type := CASE WHEN v_type IN ('driver_license','passport') THEN v_type ELSE 'none' END;
  IF p_details->>'profile_document_type' IS DISTINCT FROM v_expected_profile_type THEN
    RAISE EXCEPTION 'Invalid profile document mapping';
  END IF;
  v_required := CASE
    WHEN v_type IN ('driver_license','passport','medicare') THEN ARRAY[]::text[]
    WHEN v_type='foreign_passport' THEN ARRAY['front']
    WHEN v_type IN ('photo_id','proof_of_age','national_id','concession_card') THEN ARRAY['front','back','address']
    ELSE ARRAY['front','address'] END;
  IF p_upload_ids IS NULL OR cardinality(p_upload_ids) NOT BETWEEN cardinality(v_required) AND cardinality(v_required)+1 THEN
    RAISE EXCEPTION 'Missing or unexpected supporting evidence';
  END IF;
  SELECT kyc_status INTO v_status FROM public.profiles WHERE id=p_user_id FOR UPDATE;
  IF NOT FOUND OR v_status='approved' THEN RAISE EXCEPTION 'Account cannot be resubmitted'; END IF;

  -- A retry returns the identical submission. An empty upload list must not
  -- prevent a customer from correcting their text details after rejection.
  SELECT id INTO v_id FROM public.customer_kyc_submissions
    WHERE user_id=p_user_id AND upload_ids=p_upload_ids AND details=p_details
    ORDER BY created_at DESC LIMIT 1;
  IF v_id IS NOT NULL AND v_status IN ('pending','under_review') THEN RETURN v_id; END IF;

  PERFORM id FROM public.customer_kyc_uploads WHERE id=ANY(p_upload_ids) FOR UPDATE;
  SELECT count(*) INTO v_count FROM public.customer_kyc_uploads
    WHERE id=ANY(p_upload_ids) AND user_id=p_user_id AND submission_id IS NULL
      AND document_type=v_type AND (role=ANY(v_required) OR role='source_of_funds');
  IF v_count <> cardinality(p_upload_ids) THEN RAISE EXCEPTION 'Invalid evidence ownership, role or state'; END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(v_required) AS required(role)
    WHERE NOT EXISTS (SELECT 1 FROM public.customer_kyc_uploads u
      WHERE u.id=ANY(p_upload_ids) AND u.role=required.role)
  ) OR EXISTS (
    SELECT 1 FROM public.customer_kyc_uploads WHERE id=ANY(p_upload_ids)
    GROUP BY role HAVING count(*)>1
  ) OR EXISTS (
    SELECT 1 FROM public.customer_kyc_uploads WHERE id=ANY(p_upload_ids)
    GROUP BY sha256 HAVING count(*)>1
  ) THEN RAISE EXCEPTION 'Missing or duplicate supporting evidence'; END IF;
  IF EXISTS (SELECT 1 FROM public.customer_kyc_uploads WHERE id=ANY(p_upload_ids)
    AND role='address' AND address_type IS DISTINCT FROM p_details->>'address_type') THEN
    RAISE EXCEPTION 'Proof of address type does not match';
  END IF;
  INSERT INTO public.customer_kyc_submissions(user_id,document_type,details,upload_ids)
    VALUES(p_user_id,v_type,p_details,p_upload_ids) RETURNING id INTO v_id;
  UPDATE public.customer_kyc_uploads SET submission_id=v_id WHERE id=ANY(p_upload_ids);
  UPDATE public.profiles SET
    first_name=p_details->>'first_name',last_name=p_details->>'last_name',mobile_number=p_details->>'mobile_number',
    dob=(p_details->>'dob')::date,country=p_details->>'country',address=p_details->>'address',
    city=p_details->>'city',state=p_details->>'state',postcode=p_details->>'postcode',
    document_type=v_expected_profile_type,
    license_number=NULLIF(p_details->>'license_number',''),card_number=NULLIF(p_details->>'card_number',''),
    state_of_issue=NULLIF(p_details->>'state_of_issue',''),passport_number=NULLIF(p_details->>'passport_number',''),
    expiry_date=NULLIF(p_details->>'expiry_date','')::date,kyc_status='pending',
    compliance_dvs_status=CASE WHEN compliance_dvs_status IN ('completed','skipped') THEN 'not_started' ELSE compliance_dvs_status END,
    compliance_aml_status=CASE WHEN compliance_aml_status IN ('completed','skipped') THEN 'not_started' ELSE compliance_aml_status END
    WHERE id=p_user_id;
  INSERT INTO public.audit_logs(actor_id,actor_email,action,target_type,target_id,new_value)
    VALUES(p_user_id,(SELECT email FROM auth.users WHERE id=p_user_id),'KYC_EVIDENCE_SUBMITTED','profile',p_user_id,
      jsonb_build_object('submission_id',v_id,'document_type',v_type,
        'consent_notice',true,'consent_dvs',true,'consent_version',p_details->>'consent_version',
        'consent_statement',p_details->>'consent_statement','submitted_at',now()));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.submit_customer_kyc_evidence(uuid,jsonb,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_customer_kyc_evidence(uuid,jsonb,uuid[]) TO service_role;
COMMIT;
