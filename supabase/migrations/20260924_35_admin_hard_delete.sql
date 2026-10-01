-- Remove the request immutability layer and expose administrator-only,
-- transactional hard-delete commands for requests and transactions.
BEGIN;

DROP TRIGGER IF EXISTS guard_request_event_immutable ON public.exchange_request_events;
DROP TRIGGER IF EXISTS guard_request_payment_immutable ON public.exchange_request_payments;
DROP TRIGGER IF EXISTS guard_request_fee_immutable ON public.exchange_request_fee_entries;
DROP TRIGGER IF EXISTS guard_request_quote_immutable ON public.exchange_request_quotes;
DROP TRIGGER IF EXISTS guard_request_receipt_immutable ON public.exchange_request_receipts;
DROP TRIGGER IF EXISTS guard_request_completion_receipt_immutable ON public.exchange_request_completion_receipts;
DROP TRIGGER IF EXISTS guard_request_fee_earnings_immutable ON public.exchange_request_fee_earnings;
DROP TRIGGER IF EXISTS guard_request_message_immutable ON public.exchange_request_messages;

-- These guards also enforce immutable request/accounting snapshots. Remove
-- them so administrators can delete any request regardless of its state.
DROP TRIGGER IF EXISTS guard_exchange_request_snapshot ON public.exchange_requests;
DROP TRIGGER IF EXISTS guard_request_payment_approval ON public.exchange_requests;
DROP TRIGGER IF EXISTS guard_request_delivery_snapshot ON public.exchange_request_notification_deliveries;
DROP TRIGGER IF EXISTS guard_exchange_request_transaction ON public.transactions;
DROP TRIGGER IF EXISTS guard_exchange_request_ledger ON public.ledger;
DROP TRIGGER IF EXISTS guard_request_fee_cash_ledger ON public.ledger;

DROP FUNCTION IF EXISTS public.guard_exchange_request_immutable();
DROP FUNCTION IF EXISTS public.guard_exchange_request_snapshot();
DROP FUNCTION IF EXISTS public.guard_request_payment_approval();
DROP FUNCTION IF EXISTS public.guard_request_delivery_snapshot();
DROP FUNCTION IF EXISTS public.guard_exchange_request_transaction();
DROP FUNCTION IF EXISTS public.guard_request_fee_cash_ledger();

CREATE OR REPLACE FUNCTION public.admin_hard_delete_transaction(
  p_actor_id uuid,
  p_transaction_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_transaction public.transactions%ROWTYPE;
  v_request public.exchange_requests%ROWTYPE;
  v_receipt_paths text[] := ARRAY[]::text[];
BEGIN
  IF NOT public.exchange_request_is_admin(p_actor_id) THEN
    RAISE EXCEPTION 'Administrator required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_transaction
  FROM public.transactions
  WHERE id = p_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_request
  FROM public.exchange_requests
  WHERE transaction_id = p_transaction_id
  FOR UPDATE;

  IF v_request.id IS NOT NULL THEN
    SELECT COALESCE(array_agg(storage_path ORDER BY storage_path), ARRAY[]::text[])
      INTO v_receipt_paths
    FROM public.exchange_request_receipts
    WHERE request_id = v_request.id;

    -- Delete dependants in foreign-key order. Ledger fee rows must go before
    -- their request fee entries, and event dependants before the events.
    DELETE FROM public.exchange_request_notification_deliveries WHERE request_id = v_request.id;
    DELETE FROM public.exchange_request_messages WHERE request_id = v_request.id;
    DELETE FROM public.exchange_request_completion_receipts WHERE request_id = v_request.id;
    DELETE FROM public.exchange_request_realtime_signals WHERE request_id = v_request.id;
    DELETE FROM public.exchange_request_fee_earnings WHERE request_id = v_request.id;
    DELETE FROM public.ledger
      WHERE request_fee_entry_id IN (
        SELECT id FROM public.exchange_request_fee_entries WHERE request_id = v_request.id
      );
    DELETE FROM public.exchange_request_receipts WHERE request_id = v_request.id;
    DELETE FROM public.exchange_request_commands WHERE request_id = v_request.id;
    DELETE FROM public.exchange_request_tasks WHERE request_id = v_request.id;
    DELETE FROM public.exchange_request_payments WHERE request_id = v_request.id;
    DELETE FROM public.exchange_request_executions WHERE request_id = v_request.id;
    DELETE FROM public.exchange_request_refunds WHERE request_id = v_request.id;
    DELETE FROM public.exchange_request_fee_entries WHERE request_id = v_request.id;
    DELETE FROM public.exchange_request_events WHERE request_id = v_request.id;
    DELETE FROM public.exchange_requests WHERE id = v_request.id;
    DELETE FROM public.exchange_request_quotes WHERE id = v_request.quote_id;
  END IF;

  DELETE FROM public.ledger WHERE transaction_id = p_transaction_id;
  DELETE FROM public.bank_transfer_fee_accruals WHERE transaction_id = p_transaction_id;
  DELETE FROM public.transactions WHERE id = p_transaction_id;
  DELETE FROM public.audit_logs
  WHERE target_id = p_transaction_id::text
     OR (v_request.id IS NOT NULL AND target_id = v_request.id::text);

  RETURN jsonb_build_object(
    'transaction_id', p_transaction_id,
    'request_id', v_request.id,
    'receipt_paths', to_jsonb(v_receipt_paths)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_hard_delete_exchange_request(
  p_actor_id uuid,
  p_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_transaction_id uuid;
BEGIN
  IF NOT public.exchange_request_is_admin(p_actor_id) THEN
    RAISE EXCEPTION 'Administrator required' USING ERRCODE = '42501';
  END IF;

  SELECT transaction_id INTO v_transaction_id
  FROM public.exchange_requests
  WHERE id = p_request_id;

  IF v_transaction_id IS NULL THEN
    RAISE EXCEPTION 'Request not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN public.admin_hard_delete_transaction(p_actor_id, v_transaction_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_hard_delete_transactions(
  p_actor_id uuid,
  p_transaction_ids uuid[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_ids uuid[];
  v_id uuid;
  v_result jsonb;
  v_paths jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.exchange_request_is_admin(p_actor_id) THEN
    RAISE EXCEPTION 'Administrator required' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::uuid[])
    INTO v_ids
  FROM (SELECT DISTINCT unnest(p_transaction_ids) AS id) requested;

  IF cardinality(v_ids) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Select between 1 and 100 transactions';
  END IF;

  IF (SELECT count(*) FROM public.transactions WHERE id = ANY(v_ids)) <> cardinality(v_ids) THEN
    RAISE EXCEPTION 'One or more transactions no longer exist' USING ERRCODE = 'P0002';
  END IF;

  FOREACH v_id IN ARRAY v_ids LOOP
    v_result := public.admin_hard_delete_transaction(p_actor_id, v_id);
    v_paths := v_paths || COALESCE(v_result->'receipt_paths', '[]'::jsonb);
  END LOOP;

  RETURN jsonb_build_object(
    'deleted_count', cardinality(v_ids),
    'transaction_ids', to_jsonb(v_ids),
    'receipt_paths', v_paths
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_hard_delete_transaction(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_hard_delete_exchange_request(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_hard_delete_transactions(uuid, uuid[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_hard_delete_transaction(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_hard_delete_exchange_request(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_hard_delete_transactions(uuid, uuid[]) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
