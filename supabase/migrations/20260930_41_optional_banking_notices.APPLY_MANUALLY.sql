-- Allow independently empty English and Persian banking notices.
-- Preserve every other validation, admin check, version check and audit entry.
BEGIN;

DO $$
DECLARE
  function_name text;
  definition text;
  updated_definition text;
  old_guard text;
  new_guard text;
BEGIN
  FOREACH function_name IN ARRAY ARRAY['save_exchange_request_settings', 'save_exchange_request_settings_legacy_core'] LOOP
    SELECT pg_get_functiondef(to_regprocedure(format('public.%I(uuid,integer,jsonb)', function_name))) INTO definition;
    IF definition IS NULL THEN
      RAISE EXCEPTION 'Missing settings function: %', function_name;
    END IF;
    old_guard := CASE WHEN function_name = 'save_exchange_request_settings'
      THEN 'char_length(btrim(p_settings->>''iran_banking_notice_fa'')) NOT BETWEEN 1 AND 2000'
      ELSE 'char_length(p_settings->>''iran_banking_notice'') NOT BETWEEN 1 AND 2000' END;
    new_guard := replace(old_guard, 'BETWEEN 1 AND 2000', 'BETWEEN 0 AND 2000');
    IF position(old_guard IN definition) > 0 THEN
      updated_definition := replace(definition, old_guard, new_guard);
      EXECUTE updated_definition;
    ELSIF position(new_guard IN definition) = 0 THEN
      RAISE EXCEPTION 'Unexpected notice validation in %. No changes applied.', function_name;
    END IF;
  END LOOP;
END;
$$;

COMMIT;
