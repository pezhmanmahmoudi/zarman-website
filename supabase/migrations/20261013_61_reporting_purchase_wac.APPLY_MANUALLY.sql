-- Keep purchase WAC separate from short-sale valuation. Reporting and ledger
-- insights share the same chronological inventory facts. Apply after migration 60.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_accounting_inventory_facts()
RETURNS TABLE(seq bigint, day date, inventory numeric, inventory_rate numeric, wac numeric,
  event_id text, ledger_id uuid, quantity numeric, event_rate numeric, trading boolean, inventory_before numeric,
  realized_profit numeric, realized_asset_fx numeric, transfer_fee_irt numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  movement record;
  current_rate numeric;
  purchase_wac numeric := 0;
  incoming numeric;
  outgoing numeric;
  covered numeric;
  fraction numeric;
  gain numeric;
  short_trading_aud numeric := 0;
  short_trading_proceeds numeric := 0;
  short_other_aud numeric := 0;
  short_other_proceeds numeric := 0;
  epsilon constant numeric := 0.00000001;
BEGIN
  SELECT COALESCE(buy_aud, 0) INTO current_rate FROM public.rates_history ORDER BY date DESC LIMIT 1;
  current_rate := GREATEST(COALESCE(current_rate, 0), 0);
  seq := 0; inventory := 0; inventory_rate := 0;
  FOR movement IN
    WITH base AS (
      SELECT l.*, COALESCE(l.entry_type, 'trade') AS kind,
        COALESCE(l.amount_aud, 0) AS aud, COALESCE(l.amount_toman, 0) AS irt,
        COALESCE(l.fee_aud, 0) AS fee,
        CASE WHEN COALESCE(l.exchange_rate, 0) > 0 THEN l.exchange_rate
          WHEN COALESCE(l.amount_aud, 0) > 0 THEN COALESCE(l.amount_toman, 0) / l.amount_aud ELSE 0 END AS execution_rate,
        payer.id IS NOT NULL AND receiver.id IS NOT NULL AS accounts_mapped,
        COALESCE(payer.currency = 'AUD', false) AS payer_aud,
        COALESCE(receiver.currency = 'AUD', false) AS receiver_aud
      FROM public.ledger l
      LEFT JOIN public.bank_accounts payer ON payer.id = l.payer_account_id
      LEFT JOIN public.bank_accounts receiver ON receiver.id = l.receiver_account_id
    ), directions AS (
      SELECT base.*, CASE WHEN accounts_mapped THEN
          CASE WHEN receiver_aud THEN aud ELSE 0 END - CASE WHEN payer_aud THEN aud ELSE 0 END
        WHEN type = 'buy_aud' THEN aud ELSE -aud END AS trade_movement
      FROM base
    ), principals AS (
      SELECT directions.*, CASE WHEN trade_movement > 0 THEN irt + GREATEST(fee, 0) * GREATEST(execution_rate, 0)
        ELSE GREATEST(irt - GREATEST(fee, 0) * GREATEST(execution_rate, 0), 0) END AS principal
      FROM directions
    ), events AS (
      SELECT id::text AS event_id, date_gregorian::date AS event_day, created_at, 1 AS priority,
        trade_movement AS quantity,
        principal / NULLIF(aud, 0) AS event_rate, true AS trading, 0::numeric AS transfer_fee
      FROM principals WHERE kind = 'trade' AND type IN ('buy_aud', 'sell_aud') AND aud > 0 AND principal > 0
      UNION ALL
      SELECT id::text, date_gregorian::date, created_at, 1,
        CASE WHEN receiver_aud THEN aud ELSE 0 END - CASE WHEN payer_aud THEN aud ELSE 0 END,
        CASE WHEN execution_rate > 0 THEN execution_rate ELSE current_rate END, false, 0
      FROM principals WHERE kind = 'transfer'
        OR (kind = 'adjustment' AND request_fee_entry_id IS NULL AND type <> 'transfer')
      UNION ALL
      SELECT id::text || ':fee', date_gregorian::date, created_at, 2, -fee,
        CASE WHEN execution_rate > 0 THEN execution_rate ELSE current_rate END, false,
        fee * CASE WHEN execution_rate > 0 THEN execution_rate ELSE current_rate END
      FROM principals WHERE kind = 'transfer' AND payer_aud AND fee > 0
      UNION ALL
      SELECT loan.id::text, loan.date::date, loan.created_at, CASE WHEN loan.loan_type = 'injection' THEN 0 ELSE 3 END,
        CASE WHEN loan.loan_type = 'injection' THEN 1 ELSE -1 END * COALESCE(loan.settlement_amount, loan.amount),
        CASE WHEN loan.currency = 'IRT' THEN loan.amount / NULLIF(COALESCE(loan.settlement_amount, loan.amount), 0)
          WHEN COALESCE(loan.exchange_rate, 0) > 0 THEN loan.exchange_rate ELSE current_rate END, false, 0
      FROM public.owner_loans loan JOIN public.bank_accounts account ON account.id = loan.account_id AND account.currency = 'AUD'
      WHERE loan.cash_effect AND COALESCE(loan.settlement_currency, loan.currency) = 'AUD'
        AND COALESCE(loan.settlement_amount, loan.amount) > 0
      UNION ALL
      SELECT expense.id::text, expense.date::date, expense.created_at, 2, -expense.amount,
        CASE WHEN COALESCE(expense.exchange_rate, 0) > 0 THEN expense.exchange_rate ELSE current_rate END, false, 0
      FROM public.expenses expense JOIN public.bank_accounts account ON account.id = expense.payer_account_id AND account.currency = 'AUD'
      WHERE expense.status = 'paid' AND expense.currency = 'AUD'
    )
    SELECT events.*, l.id AS source_ledger_id FROM events LEFT JOIN public.ledger l
      ON l.id = split_part(events.event_id, ':', 1)::uuid
        OR l.owner_loan_id = split_part(events.event_id, ':', 1)::uuid
    WHERE abs(events.quantity) > epsilon
    ORDER BY events.event_day, events.priority, events.created_at, events.event_id
  LOOP
    seq := seq + 1; day := movement.event_day; inventory_before := inventory;
    event_id := movement.event_id; ledger_id := movement.source_ledger_id;
    quantity := movement.quantity; event_rate := movement.event_rate; trading := movement.trading;
    realized_profit := 0; realized_asset_fx := 0; transfer_fee_irt := movement.transfer_fee;
    IF movement.quantity > 0 THEN
      incoming := movement.quantity;
      IF inventory < -epsilon THEN
        covered := LEAST(incoming, -inventory);
        fraction := covered / -inventory;
        realized_profit := fraction * (short_trading_proceeds - short_trading_aud * movement.event_rate);
        realized_asset_fx := fraction * (short_other_proceeds - short_other_aud * movement.event_rate);
        short_trading_aud := short_trading_aud * (1 - fraction);
        short_trading_proceeds := short_trading_proceeds * (1 - fraction);
        short_other_aud := short_other_aud * (1 - fraction);
        short_other_proceeds := short_other_proceeds * (1 - fraction);
        inventory := inventory + covered; incoming := incoming - covered;
      END IF;
      IF incoming > epsilon THEN
        inventory_rate := (GREATEST(inventory, 0) * inventory_rate + incoming * movement.event_rate) / (inventory + incoming);
        purchase_wac := inventory_rate;
        inventory := inventory + incoming;
      ELSIF inventory < -epsilon THEN
        inventory_rate := (short_trading_proceeds + short_other_proceeds) / -inventory;
      END IF;
    ELSE
      outgoing := -movement.quantity;
      covered := LEAST(outgoing, GREATEST(inventory, 0));
      gain := covered * (movement.event_rate - inventory_rate);
      IF movement.trading THEN realized_profit := gain; ELSE realized_asset_fx := gain; END IF;
      inventory := inventory - covered; outgoing := outgoing - covered;
      IF outgoing > epsilon THEN
        IF movement.trading THEN
          short_trading_aud := short_trading_aud + outgoing;
          short_trading_proceeds := short_trading_proceeds + outgoing * movement.event_rate;
        ELSE
          short_other_aud := short_other_aud + outgoing;
          short_other_proceeds := short_other_proceeds + outgoing * movement.event_rate;
        END IF;
        inventory := inventory - outgoing;
        inventory_rate := (short_trading_proceeds + short_other_proceeds) / -inventory;
      END IF;
    END IF;
    IF abs(inventory) < epsilon THEN inventory := 0; inventory_rate := 0; END IF;
    wac := purchase_wac;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.get_accounting_inventory_facts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_accounting_inventory_facts() TO service_role;

CREATE OR REPLACE FUNCTION public.get_accounting_inventory_events()
RETURNS TABLE(seq bigint, day date, inventory numeric, wac numeric,
  realized_profit numeric, realized_asset_fx numeric, transfer_fee_irt numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT f.seq, f.day, f.inventory, f.wac, f.realized_profit, f.realized_asset_fx, f.transfer_fee_irt
  FROM public.get_accounting_inventory_facts() f ORDER BY f.seq;
$$;
REVOKE ALL ON FUNCTION public.get_accounting_inventory_events() FROM PUBLIC, anon, authenticated, service_role;

SELECT public.refresh_enterprise_reports();
NOTIFY pgrst, 'reload schema';
COMMIT;
