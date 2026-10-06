-- Run before and after deploying request email changes. Read-only; no sends.
BEGIN READ ONLY;
WITH required_functions(signature, api_callable) AS (
  VALUES
    ('public.claim_request_notifications_for_request(uuid,uuid,integer,integer,uuid)',true),
    ('public.prepare_request_notification(uuid,uuid,jsonb,text)',true),
    ('public.finish_request_notification(uuid,uuid,text,text,text,timestamptz)',true),
    ('public.retry_request_notification(uuid,uuid,uuid)',true),
    ('public.record_request_email_event(text,text,text,timestamptz,text)',true),
    ('public.apply_request_email_events(uuid)',false)
), function_checks AS (
  SELECT r.signature,
    p.oid IS NOT NULL
    AND p.prosecdef
    AND (NOT r.api_callable OR has_function_privilege('service_role',p.oid,'EXECUTE'))
    AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
    AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE') AS passed
  FROM required_functions r LEFT JOIN pg_proc p ON p.oid=to_regprocedure(r.signature)
), checks(name,passed) AS (
  SELECT signature,coalesce(passed,false) FROM function_checks
  UNION ALL
  SELECT 'email_events_table_and_permissions',EXISTS (
    SELECT 1 FROM pg_class c WHERE c.oid=to_regclass('public.exchange_request_email_events')
      AND c.relrowsecurity
      AND has_table_privilege('service_role',c.oid,'SELECT')
      AND has_table_privilege('service_role',c.oid,'INSERT')
      AND has_table_privilege('service_role',c.oid,'UPDATE')
      AND NOT has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE')
      AND NOT has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE')
  )
  UNION ALL
  SELECT 'unique_provider_index',EXISTS (
    SELECT 1 FROM pg_index WHERE indexrelid=to_regclass('public.exchange_request_notification_provider_idx')
      AND indisunique AND indisvalid
  )
)
SELECT bool_and(passed) AS all_checks_passed, jsonb_object_agg(name,passed) AS checks FROM checks;
ROLLBACK;
