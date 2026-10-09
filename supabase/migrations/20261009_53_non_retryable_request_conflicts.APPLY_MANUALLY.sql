-- Business version conflicts must reach the caller as HTTP 409. SQLSTATE
-- 40001 means serialization_failure and can cause unbounded PostgREST retries.
-- Apply after the installed request migrations (including 51/52 if present).
-- Patch live definitions so accounting/pricing fixes and function ACLs survive.
-- Safe to run again; no requests, versions, command keys or ledger rows change.
BEGIN;

DO $migration$
DECLARE
  v_function record;
  v_definition text;
  v_patched text;
  v_pattern constant text := $pattern$(RAISE\s+EXCEPTION\s+'REQUEST_CONFLICT: Reload (request|settings)'\s+USING\s+ERRCODE\s*=\s*)'40001'$pattern$;
BEGIN
  IF to_regprocedure('public.transition_exchange_request(uuid,uuid,integer,uuid,text,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Install the exchange request functions before migration 53';
  END IF;

  -- Includes renamed inner cores, message/pricing RPCs and settings wrappers.
  -- Only the exact business-conflict RAISE is rewritten; genuine serialization
  -- failures and other SQLSTATEs retain their original meaning.
  FOR v_function IN
    SELECT p.oid, p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang
    WHERE n.nspname = 'public' AND p.prokind = 'f' AND l.lanname = 'plpgsql'
      AND p.prosrc LIKE '%REQUEST_CONFLICT: Reload%'
  LOOP
    v_definition := pg_get_functiondef(v_function.oid);
    v_patched := regexp_replace(v_definition, v_pattern, $replacement$\1'PT409'$replacement$, 'gi');
    IF v_patched <> v_definition THEN
      EXECUTE v_patched;
    END IF;
    IF pg_get_functiondef(v_function.oid) ~* $pattern$REQUEST_CONFLICT[^;]*ERRCODE\s*=\s*'40001'$pattern$ THEN
      RAISE EXCEPTION 'Unpatched request conflict in %. Review its definition.', v_function.signature;
    END IF;
  END LOOP;
END;
$migration$;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Existing PostgREST retry loops can outlive this change. After applying it,
-- inspect pg_stat_activity and correlate authenticator PIDs/backend_start with
-- current 40001 logs before terminating the affected backends. Do not blindly
-- terminate a PID from an old screenshot or all database sessions.
-- Read-only inspection (run separately after COMMIT):
-- SELECT pid, backend_start, state, query_start, query
-- FROM pg_stat_activity
-- WHERE usename = 'authenticator'
--   AND query ILIKE '%transition_exchange_request%'
-- ORDER BY query_start;
-- After verifying the current PID and backend_start against fresh logs, use
-- pg_terminate_backend on that backend only. Fixing the browser alone cannot
-- stop an existing PostgREST transaction retry loop.
