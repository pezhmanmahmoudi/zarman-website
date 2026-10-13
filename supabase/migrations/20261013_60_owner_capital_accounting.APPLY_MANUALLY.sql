-- Separate permanent owner capital from repayable owner loans. Financing is
-- never revenue; an existing ledger cash movement must not be posted twice.
-- On a fresh database, apply migration 61 after this migration. Do not rerun
-- migration 60 over migration 61: its original reporting function is superseded.
BEGIN;

ALTER TABLE public.owner_loans
  ADD COLUMN IF NOT EXISTS funding_type text NOT NULL DEFAULT 'loan',
  ADD COLUMN IF NOT EXISTS cash_effect boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS settlement_currency text,
  ADD COLUMN IF NOT EXISTS settlement_amount numeric,
  ADD COLUMN IF NOT EXISTS linked_ledger_id uuid REFERENCES public.ledger(id) ON DELETE RESTRICT;

ALTER TABLE public.owner_loans
  DROP CONSTRAINT IF EXISTS owner_loans_funding_type_check,
  DROP CONSTRAINT IF EXISTS owner_loans_settlement_check,
  DROP CONSTRAINT IF EXISTS owner_loans_linked_cash_check;
ALTER TABLE public.owner_loans
  ADD CONSTRAINT owner_loans_funding_type_check CHECK (funding_type IN ('loan', 'equity')),
  ADD CONSTRAINT owner_loans_settlement_check CHECK (
    (settlement_currency IS NULL AND settlement_amount IS NULL)
    OR (settlement_currency IS NOT NULL AND settlement_amount IS NOT NULL
      AND settlement_currency IN ('AUD', 'IRT') AND settlement_amount >= 0)
  ),
  ADD CONSTRAINT owner_loans_linked_cash_check CHECK (linked_ledger_id IS NULL OR NOT cash_effect);

COMMENT ON COLUMN public.owner_loans.funding_type IS
  'loan is a repayable monetary liability; equity is permanent contributed capital, carried at historical value.';
COMMENT ON COLUMN public.owner_loans.cash_effect IS
  'False when the cash movement is already recorded elsewhere; the funding record changes owner principal only.';
COMMENT ON COLUMN public.owner_loans.settlement_currency IS
  'Currency of the bank movement. Null uses principal currency. Must be paired with settlement_amount.';
COMMENT ON COLUMN public.owner_loans.settlement_amount IS
  'Actual bank movement, independent of the owner principal amount. Null uses principal amount.';
COMMENT ON COLUMN public.owner_loans.linked_ledger_id IS
  'Optional cash evidence for a funding record without an additional bank movement.';

CREATE OR REPLACE FUNCTION public.validate_owner_funding_cash()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE v_currency text;
BEGIN
  IF NEW.cash_effect THEN
    SELECT currency INTO v_currency FROM public.bank_accounts WHERE id = NEW.account_id;
    IF v_currency IS NULL THEN
      RAISE EXCEPTION 'Owner funding cash movement requires a valid bank account' USING ERRCODE = '23514';
    END IF;
    IF v_currency IS DISTINCT FROM COALESCE(NEW.settlement_currency, NEW.currency) THEN
      RAISE EXCEPTION 'Owner funding settlement currency must match its bank account' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS validate_owner_funding_cash ON public.owner_loans;
CREATE TRIGGER validate_owner_funding_cash BEFORE INSERT OR UPDATE ON public.owner_loans
FOR EACH ROW EXECUTE FUNCTION public.validate_owner_funding_cash();
REVOKE ALL ON FUNCTION public.validate_owner_funding_cash() FROM PUBLIC, anon, authenticated;

-- A deferred final-state sync coexists with the original installation's
-- ordinary mirror triggers, whose names differed between early deployments.
-- The loan journal is authoritative; mirrors do not independently move cash.
CREATE UNIQUE INDEX IF NOT EXISTS ledger_owner_loan_single_entry
  ON public.ledger(owner_loan_id) WHERE owner_loan_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_owner_funding_ledger(p_owner_loan_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_loan public.owner_loans%ROWTYPE;
  v_mirror_id uuid;
  v_currency text;
  v_amount numeric;
  v_aud numeric;
  v_irt numeric;
  v_label text;
BEGIN
  SELECT * INTO v_loan FROM public.owner_loans WHERE id = p_owner_loan_id;
  IF NOT FOUND THEN
    DELETE FROM public.ledger WHERE owner_loan_id = p_owner_loan_id;
    RETURN;
  END IF;
  v_currency := COALESCE(v_loan.settlement_currency, v_loan.currency);
  v_amount := CASE WHEN v_loan.cash_effect THEN COALESCE(v_loan.settlement_amount, v_loan.amount) ELSE 0 END;
  v_aud := CASE WHEN v_currency = 'AUD' THEN v_amount ELSE 0 END;
  v_irt := CASE WHEN v_currency = 'IRT' THEN v_amount ELSE v_amount * COALESCE(v_loan.exchange_rate, 0) END;
  v_label := CASE WHEN v_loan.funding_type = 'equity' THEN
    CASE WHEN v_loan.loan_type = 'injection' THEN 'Owner capital contribution' ELSE 'Owner capital withdrawal' END
    ELSE CASE WHEN v_loan.loan_type = 'injection' THEN 'Owner loan received' ELSE 'Owner loan repayment' END END;

  SELECT id INTO v_mirror_id FROM public.ledger WHERE owner_loan_id = v_loan.id FOR UPDATE;
  IF v_mirror_id IS NULL THEN
    INSERT INTO public.ledger(owner_loan_id, date_gregorian, date_jalali, type, entry_type,
      exchange_rate, amount_aud, amount_toman, fee_aud, payer_account_id, receiver_account_id,
      sender, recipient, notes, created_by, created_at)
    VALUES(v_loan.id, v_loan.date, COALESCE(v_loan.date_jalali, ''),
      CASE WHEN v_loan.loan_type = 'injection' THEN 'buy_aud' ELSE 'sell_aud' END, 'owner_loan',
      COALESCE(v_loan.exchange_rate, 0), v_aud, v_irt, 0,
      CASE WHEN v_loan.cash_effect AND v_loan.loan_type = 'repayment' THEN v_loan.account_id END,
      CASE WHEN v_loan.cash_effect AND v_loan.loan_type = 'injection' THEN v_loan.account_id END,
      v_label, '', v_loan.notes, v_loan.created_by, v_loan.created_at);
  ELSE
    UPDATE public.ledger SET date_gregorian = v_loan.date, date_jalali = COALESCE(v_loan.date_jalali, ''),
      type = CASE WHEN v_loan.loan_type = 'injection' THEN 'buy_aud' ELSE 'sell_aud' END,
      entry_type = 'owner_loan', exchange_rate = COALESCE(v_loan.exchange_rate, 0),
      amount_aud = v_aud, amount_toman = v_irt, fee_aud = 0,
      payer_account_id = CASE WHEN v_loan.cash_effect AND v_loan.loan_type = 'repayment' THEN v_loan.account_id END,
      receiver_account_id = CASE WHEN v_loan.cash_effect AND v_loan.loan_type = 'injection' THEN v_loan.account_id END,
      sender = v_label
    WHERE id = v_mirror_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_sync_owner_funding_ledger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public.sync_owner_funding_ledger(CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS owner_funding_ledger_sync ON public.owner_loans;
CREATE CONSTRAINT TRIGGER owner_funding_ledger_sync
AFTER INSERT OR UPDATE OR DELETE ON public.owner_loans
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.trigger_sync_owner_funding_ledger();
REVOKE ALL ON FUNCTION public.sync_owner_funding_ledger(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.trigger_sync_owner_funding_ledger() FROM PUBLIC, anon, authenticated, service_role;

-- Repair missing mirrors, including historical contributions. Amounts and
-- financing classifications in the owner journal are not changed here.
SELECT public.sync_owner_funding_ledger(id) FROM public.owner_loans ORDER BY date, created_at, id;

-- The reporting valuation stream matches the application engine: canonical
-- AUD funding, paid expenses and cash adjustments participate in inventory;
-- mirror rows and request-fee cash do not. Uncovered sales retain their
-- proceeds until an incoming event covers the short position.
CREATE OR REPLACE FUNCTION public.get_accounting_inventory_events()
RETURNS TABLE(seq bigint, day date, inventory numeric, wac numeric,
  realized_profit numeric, realized_asset_fx numeric, transfer_fee_irt numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  movement record;
  current_rate numeric;
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
  seq := 0; inventory := 0; wac := 0;
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
    SELECT * FROM events WHERE abs(quantity) > epsilon
    ORDER BY event_day, priority, created_at, event_id
  LOOP
    seq := seq + 1; day := movement.event_day;
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
        wac := (GREATEST(inventory, 0) * wac + incoming * movement.event_rate) / (inventory + incoming);
        inventory := inventory + incoming;
      ELSIF inventory < -epsilon THEN
        wac := (short_trading_proceeds + short_other_proceeds) / -inventory;
      END IF;
    ELSE
      outgoing := -movement.quantity;
      covered := LEAST(outgoing, GREATEST(inventory, 0));
      gain := covered * (movement.event_rate - wac);
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
        wac := (short_trading_proceeds + short_other_proceeds) / -inventory;
      END IF;
    END IF;
    IF abs(inventory) < epsilon THEN inventory := 0; wac := 0; END IF;
    RETURN NEXT;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.get_accounting_inventory_events() FROM PUBLIC, anon, authenticated, service_role;

-- Reporting keeps financing separate from income and counts each bank movement once.
CREATE OR REPLACE FUNCTION refresh_enterprise_reports()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE report_refresh_state SET last_started_at = now(), last_error = NULL WHERE id = true;

  DROP TABLE IF EXISTS pg_temp.report_inventory_facts;
  CREATE TEMP TABLE report_inventory_facts ON COMMIT DROP AS SELECT * FROM public.get_accounting_inventory_events();
  DROP TABLE IF EXISTS pg_temp.report_ledger_facts;
  CREATE TEMP TABLE report_ledger_facts ON COMMIT DROP AS
  WITH raw_facts AS (
    SELECT row_number() OVER (ORDER BY l.date_gregorian, l.created_at, l.id) AS seq,
      l.date_gregorian::date AS day, l.type, COALESCE(l.entry_type, 'trade') AS entry_type,
      COALESCE(l.amount_aud, 0)::numeric AS aud, COALESCE(l.amount_toman, 0)::numeric AS irt,
      COALESCE(l.fee_aud, 0)::numeric AS fee_aud,
      CASE WHEN COALESCE(l.exchange_rate, 0) > 0 THEN l.exchange_rate
        WHEN COALESCE(l.amount_aud, 0) > 0 THEN COALESCE(l.amount_toman, 0) / l.amount_aud ELSE 0 END::numeric AS exchange_rate,
      CASE WHEN payer.id IS NOT NULL AND receiver.id IS NOT NULL THEN
          CASE WHEN receiver.currency = 'AUD' THEN COALESCE(l.amount_aud, 0) ELSE 0 END
          - CASE WHEN payer.currency = 'AUD' THEN COALESCE(l.amount_aud, 0) ELSE 0 END
        WHEN l.type = 'buy_aud' THEN COALESCE(l.amount_aud, 0) ELSE -COALESCE(l.amount_aud, 0) END AS stock_movement,
      l.payer_account_id, l.receiver_account_id, l.transaction_id, l.created_at
    FROM ledger l
    LEFT JOIN bank_accounts payer ON payer.id = l.payer_account_id
    LEFT JOIN bank_accounts receiver ON receiver.id = l.receiver_account_id
  )
  SELECT raw_facts.*, CASE WHEN entry_type = 'trade' AND type IN ('buy_aud', 'sell_aud') AND aud > 0
      AND stock_movement <> 0 THEN CASE WHEN stock_movement > 0 THEN 'buy_aud' ELSE 'sell_aud' END
    END AS stock_type FROM raw_facts;

  TRUNCATE reports_daily, report_account_daily, report_customer_daily;

  WITH ledger_days AS (
    SELECT day,
      sum(GREATEST(irt - (fee_aud * exchange_rate), 0)) FILTER (
        WHERE stock_type = 'sell_aud' AND irt > 0 AND exchange_rate > 0
      ) AS revenue,
      sum(irt + (fee_aud * exchange_rate)) FILTER (
        WHERE stock_type = 'buy_aud' AND irt > 0 AND exchange_rate > 0
      ) AS purchase_cost,
      0::numeric AS trading_profit,
      sum(fee_aud * exchange_rate) FILTER (
        WHERE entry_type NOT IN ('transfer','expense','owner_loan','adjustment') AND aud > 0 AND irt > 0 AND exchange_rate > 0
      ) AS fee_income,
      sum(aud) FILTER (WHERE stock_type = 'buy_aud') AS aud_purchased,
      sum(aud) FILTER (WHERE stock_type = 'sell_aud') AS aud_sold,
      count(*) FILTER (WHERE stock_type IS NOT NULL) AS transaction_count,
      count(*) FILTER (WHERE stock_type = 'buy_aud') AS buy_count,
      count(*) FILTER (WHERE stock_type = 'sell_aud') AS sell_count,
      sum(aud) FILTER (WHERE stock_type = 'buy_aud') AS buy_volume,
      sum(aud) FILTER (WHERE stock_type = 'sell_aud') AS sell_volume,
      sum(exchange_rate * aud) FILTER (
        WHERE stock_type IS NOT NULL AND irt > 0 AND exchange_rate > 0
      ) / NULLIF(sum(aud) FILTER (
        WHERE stock_type IS NOT NULL AND irt > 0 AND exchange_rate > 0
      ), 0) AS average_rate,
      sum(exchange_rate * aud) FILTER (
        WHERE stock_type = 'buy_aud' AND irt > 0 AND exchange_rate > 0
      ) / NULLIF(sum(aud) FILTER (
        WHERE stock_type = 'buy_aud' AND irt > 0 AND exchange_rate > 0
      ), 0) AS average_buy_rate,
      sum(exchange_rate * aud) FILTER (
        WHERE stock_type = 'sell_aud' AND irt > 0 AND exchange_rate > 0
      ) / NULLIF(sum(aud) FILTER (
        WHERE stock_type = 'sell_aud' AND irt > 0 AND exchange_rate > 0
      ), 0) AS average_sell_rate,
      max(exchange_rate) FILTER (
        WHERE stock_type IS NOT NULL AND irt > 0 AND exchange_rate > 0
      ) AS highest_rate,
      min(exchange_rate) FILTER (
        WHERE stock_type IS NOT NULL AND irt > 0 AND exchange_rate > 0
      ) AS lowest_rate,
      avg(fee_aud) FILTER (WHERE stock_type IS NOT NULL) AS average_fee,
      max(aud) FILTER (WHERE stock_type IS NOT NULL) AS largest_transaction,
      min(aud) FILTER (WHERE stock_type IS NOT NULL) AS smallest_transaction
    FROM report_ledger_facts GROUP BY day
  ), valuation_days AS (
    SELECT day, sum(realized_profit) AS trading_profit, sum(realized_asset_fx) AS asset_fx,
      sum(transfer_fee_irt) AS transfer_fees FROM report_inventory_facts GROUP BY day
  ), closings AS (
    SELECT DISTINCT ON (day) day, inventory, wac FROM report_inventory_facts ORDER BY day, seq DESC
  ), expense_categories AS (
    SELECT date::date AS day, category,
      sum(CASE WHEN currency = 'AUD' THEN amount * COALESCE(exchange_rate, 0) ELSE amount END) AS amount
    FROM expenses WHERE status = 'paid' GROUP BY date, category
  ), expense_days AS (
    SELECT day, sum(amount) AS expenses, jsonb_object_agg(category, amount) AS breakdown
    FROM expense_categories GROUP BY day
  ), loan_days AS (
    SELECT date::date AS day,
      sum(CASE WHEN loan_type = 'injection' THEN CASE WHEN currency = 'AUD' THEN amount * COALESCE(exchange_rate, 0) ELSE amount END ELSE 0 END) AS injection,
      sum(CASE WHEN loan_type = 'repayment' THEN CASE WHEN currency = 'AUD' THEN amount * COALESCE(exchange_rate, 0) ELSE amount END ELSE 0 END) AS repayment
      , sum(CASE WHEN cash_effect AND loan_type = 'injection' THEN
          CASE WHEN COALESCE(settlement_currency, currency) = 'AUD'
            THEN COALESCE(settlement_amount, amount) * COALESCE(exchange_rate, 0)
            ELSE COALESCE(settlement_amount, amount) END ELSE 0 END) AS cash_injection
      , sum(CASE WHEN cash_effect AND loan_type = 'repayment' THEN
          CASE WHEN COALESCE(settlement_currency, currency) = 'AUD'
            THEN COALESCE(settlement_amount, amount) * COALESCE(exchange_rate, 0)
            ELSE COALESCE(settlement_amount, amount) END ELSE 0 END) AS cash_repayment
    FROM owner_loans GROUP BY date
  ), days AS (
    SELECT day FROM ledger_days UNION SELECT day FROM expense_days UNION SELECT day FROM loan_days UNION SELECT day FROM valuation_days
  ), combined AS (
    SELECT days.day,
      ledger_days.revenue, ledger_days.purchase_cost, COALESCE(valuation_days.trading_profit, 0) AS trading_profit,
      COALESCE(valuation_days.asset_fx, 0) AS asset_fx,
      ledger_days.fee_income, ledger_days.aud_purchased, ledger_days.aud_sold,
      ledger_days.transaction_count, ledger_days.buy_count, ledger_days.sell_count,
      ledger_days.buy_volume, ledger_days.sell_volume, ledger_days.average_rate,
      ledger_days.average_buy_rate, ledger_days.average_sell_rate,
      ledger_days.highest_rate, ledger_days.lowest_rate, ledger_days.average_fee,
      ledger_days.largest_transaction, ledger_days.smallest_transaction,
      (SELECT inventory FROM closings WHERE closings.day <= days.day ORDER BY closings.day DESC LIMIT 1) AS inventory,
      (SELECT wac FROM closings WHERE closings.day <= days.day ORDER BY closings.day DESC LIMIT 1) AS wac,
      COALESCE(expense_days.expenses, 0) + COALESCE(valuation_days.transfer_fees, 0) AS expenses,
      COALESCE(expense_days.breakdown, '{}'::jsonb) || CASE WHEN COALESCE(valuation_days.transfer_fees, 0) <> 0
        THEN jsonb_build_object('bank_fees', COALESCE((expense_days.breakdown->>'bank_fees')::numeric, 0) + valuation_days.transfer_fees)
        ELSE '{}'::jsonb END AS breakdown,
      COALESCE(loan_days.injection, 0) AS injection, COALESCE(loan_days.repayment, 0) AS repayment,
      COALESCE(loan_days.cash_injection, 0) AS cash_injection, COALESCE(loan_days.cash_repayment, 0) AS cash_repayment
    FROM days LEFT JOIN ledger_days USING (day)
      LEFT JOIN expense_days USING (day) LEFT JOIN loan_days USING (day) LEFT JOIN valuation_days USING (day)
  )
  INSERT INTO reports_daily (
    period_start, period_end, revenue, expenses, fee_income, trading_profit, other_income, cash_in, cash_out, net_cashflow,
    aud_inventory, opening_aud_inventory, aud_purchased, aud_sold, wac, average_rate, average_buy_rate,
    average_sell_rate, highest_rate, lowest_rate, transaction_count, buy_count, sell_count, buy_volume,
    sell_volume, average_fee, largest_transaction, smallest_transaction, owner_injection,
    owner_loan_repayment, expense_breakdown, updated_at)
  SELECT day, day, COALESCE(revenue,0), expenses, COALESCE(fee_income,0), COALESCE(trading_profit,0), asset_fx,
    COALESCE(revenue,0) + cash_injection, COALESCE(purchase_cost,0) + expenses + cash_repayment,
    COALESCE(revenue,0) + cash_injection - COALESCE(purchase_cost,0) - expenses - cash_repayment,
    COALESCE(inventory, 0), COALESCE(lag(inventory) OVER (ORDER BY day), 0),
    COALESCE(aud_purchased,0), COALESCE(aud_sold,0),
    COALESCE(wac, 0), COALESCE(average_rate,0), COALESCE(average_buy_rate,0),
    COALESCE(average_sell_rate,0), COALESCE(highest_rate,0), COALESCE(lowest_rate,0),
    COALESCE(transaction_count,0), COALESCE(buy_count,0), COALESCE(sell_count,0), COALESCE(buy_volume,0),
    COALESCE(sell_volume,0), COALESCE(average_fee,0), COALESCE(largest_transaction,0), COALESCE(smallest_transaction,0),
    injection, repayment, breakdown, now()
  FROM combined ORDER BY day;

  INSERT INTO report_account_daily (account_id, period_start, deposits, withdrawals, transfers_in, transfers_out, net_movement, opening_balance, closing_balance)
  WITH movements AS (
    SELECT account_id, day,
      sum(deposit) AS deposits, sum(withdrawal) AS withdrawals,
      sum(transfer_in) AS transfers_in, sum(transfer_out) AS transfers_out
    FROM (
      SELECT receiver_account_id AS account_id, day,
        CASE WHEN entry_type <> 'transfer' THEN CASE WHEN account.currency = 'AUD' THEN aud ELSE irt END ELSE 0 END AS deposit,
        0::numeric AS withdrawal,
        CASE WHEN entry_type = 'transfer' THEN CASE WHEN account.currency = 'AUD' THEN aud ELSE irt END ELSE 0 END AS transfer_in,
        0::numeric AS transfer_out
      FROM report_ledger_facts JOIN bank_accounts account ON account.id = receiver_account_id
      WHERE receiver_account_id IS NOT NULL AND entry_type NOT IN ('expense', 'owner_loan')
      UNION ALL
      SELECT payer_account_id, day, 0,
        CASE WHEN entry_type <> 'transfer' THEN CASE WHEN account.currency = 'AUD' THEN aud ELSE irt END ELSE 0 END,
        0, CASE WHEN entry_type = 'transfer' THEN CASE WHEN account.currency = 'AUD' THEN aud + fee_aud ELSE irt END ELSE 0 END
      FROM report_ledger_facts JOIN bank_accounts account ON account.id = payer_account_id
      WHERE payer_account_id IS NOT NULL AND entry_type NOT IN ('expense', 'owner_loan')
      UNION ALL
      SELECT expense.payer_account_id, expense.date::date, 0,
        expense.amount::numeric, 0, 0
      FROM expenses expense
      JOIN bank_accounts account ON account.id = expense.payer_account_id AND account.currency = expense.currency
      WHERE expense.status = 'paid' AND expense.payer_account_id IS NOT NULL
      UNION ALL
      SELECT loan.account_id, loan.date::date,
        CASE WHEN loan.loan_type = 'injection' THEN COALESCE(loan.settlement_amount, loan.amount) ELSE 0 END::numeric,
        CASE WHEN loan.loan_type = 'repayment' THEN COALESCE(loan.settlement_amount, loan.amount) ELSE 0 END::numeric,
        0, 0
      FROM owner_loans loan
      JOIN bank_accounts account ON account.id = loan.account_id
        AND account.currency = COALESCE(loan.settlement_currency, loan.currency)
      WHERE loan.account_id IS NOT NULL AND loan.cash_effect
    ) entries GROUP BY account_id, day
  ), account_days AS (
    SELECT account.id AS account_id, report.period_start AS day,
      COALESCE(movement.deposits, 0) AS deposits, COALESCE(movement.withdrawals, 0) AS withdrawals,
      COALESCE(movement.transfers_in, 0) AS transfers_in, COALESCE(movement.transfers_out, 0) AS transfers_out
    FROM bank_accounts account CROSS JOIN reports_daily report
    LEFT JOIN movements movement ON movement.account_id = account.id AND movement.day = report.period_start
    WHERE account.is_active = true
  ), running AS (
    SELECT *, sum(deposits + transfers_in - withdrawals - transfers_out) OVER (PARTITION BY account_id ORDER BY day) AS closing
    FROM account_days
  )
  SELECT account_id, day, deposits, withdrawals, transfers_in, transfers_out,
    deposits + transfers_in - withdrawals - transfers_out,
    closing - (deposits + transfers_in - withdrawals - transfers_out), closing FROM running;

  UPDATE reports_daily report SET irt_liquidity = liquidity.balance
  FROM (
    SELECT movement.period_start, sum(movement.closing_balance) AS balance
    FROM report_account_daily movement
    JOIN bank_accounts account ON account.id = movement.account_id
    WHERE account.currency = 'IRT' AND account.account_type = 'bank'
    GROUP BY movement.period_start
  ) liquidity
  WHERE report.period_start = liquidity.period_start;

  INSERT INTO report_customer_daily (customer_id, period_start, transaction_count, aud_volume, irt_volume, fee_income, is_new_customer)
  SELECT transaction.user_id, fact.day, count(*) FILTER (WHERE fact.stock_type IS NOT NULL),
    sum(CASE WHEN fact.stock_type IS NOT NULL THEN fact.aud ELSE 0 END),
    sum(CASE WHEN fact.stock_type IS NOT NULL THEN fact.irt ELSE 0 END),
    sum(fact.fee_aud * fact.exchange_rate),
    fact.day = min(fact.day) OVER (PARTITION BY transaction.user_id)
  FROM report_ledger_facts fact JOIN transactions transaction ON transaction.id::text = fact.transaction_id::text
  WHERE transaction.user_id IS NOT NULL GROUP BY transaction.user_id, fact.day;

  UPDATE reports_daily report SET
    new_customers = customer.new_count, returning_customers = customer.returning_count
  FROM (SELECT period_start, count(*) FILTER (WHERE is_new_customer) AS new_count,
    count(*) FILTER (WHERE NOT is_new_customer) AS returning_count
    FROM report_customer_daily GROUP BY period_start) customer
  WHERE report.period_start = customer.period_start;

  -- Recognition and cash movement are separate: collection remains unearned
  -- until successful settlement, and refunds never inflate fee income.
  UPDATE public.reports_daily d SET fee_income=d.fee_income+earned.amount_toman
  FROM (SELECT (earned_at AT TIME ZONE 'UTC')::date AS day,sum(amount_toman) AS amount_toman
    FROM public.exchange_request_fee_earnings GROUP BY 1) earned WHERE d.period_start=earned.day;
  UPDATE public.report_customer_daily d SET fee_income=d.fee_income+earned.amount_toman
  FROM (SELECT r.user_id,(e.earned_at AT TIME ZONE 'UTC')::date AS day,sum(e.amount_toman) AS amount_toman
    FROM public.exchange_request_fee_earnings e JOIN public.exchange_requests r ON r.id=e.request_id
    GROUP BY 1,2) earned WHERE d.customer_id=earned.user_id AND d.period_start=earned.day;
  UPDATE public.reports_daily d SET cash_in=d.cash_in+cash.received,cash_out=d.cash_out+cash.returned,
    net_cashflow=d.net_cashflow+cash.received-cash.returned,refunds=d.refunds+cash.returned
  FROM (SELECT (e.created_at AT TIME ZONE 'UTC')::date AS day,
    sum(CASE WHEN e.kind='collected' THEN CASE WHEN e.currency='IRT' THEN e.amount ELSE e.amount*(r.quote->>'applied_rate')::numeric END ELSE 0 END) AS received,
    sum(CASE WHEN e.kind='refunded' THEN CASE WHEN e.currency='IRT' THEN e.amount ELSE e.amount*(r.quote->>'applied_rate')::numeric END ELSE 0 END) AS returned
    FROM public.exchange_request_fee_entries e JOIN public.exchange_requests r ON r.id=e.request_id GROUP BY 1) cash
  WHERE d.period_start=cash.day;

  EXECUTE 'REFRESH MATERIALIZED VIEW reports_monthly';
  EXECUTE 'REFRESH MATERIALIZED VIEW reports_yearly';

  UPDATE report_refresh_state SET is_stale = false, stale_since = NULL, last_completed_at = now(), last_error = NULL WHERE id = true;
EXCEPTION WHEN OTHERS THEN
  UPDATE report_refresh_state SET last_error = SQLERRM WHERE id = true;
  RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION get_report_account_statement(
  selected_account uuid,
  range_start date,
  range_end date,
  page_number integer DEFAULT 1,
  page_size integer DEFAULT 50
)
RETURNS TABLE (
  ledger_id text,
  transaction_id text,
  entry_date date,
  description text,
  debit numeric,
  credit numeric,
  running_balance numeric,
  total_count bigint
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH account AS (
    SELECT id, currency FROM bank_accounts WHERE id = selected_account AND is_active = true
  ), opening AS (
    SELECT COALESCE((SELECT closing_balance FROM report_account_daily
      WHERE account_id = selected_account AND period_start < range_start
      ORDER BY period_start DESC LIMIT 1), 0)::numeric AS balance
  ), entries AS (
    SELECT ledger.id::text AS ledger_id, ledger.transaction_id::text,
      ledger.date_gregorian::date AS entry_date,
      trim(concat_ws(' - ', NULLIF(ledger.sender, ''), NULLIF(ledger.recipient, ''))) AS description,
      CASE WHEN ledger.payer_account_id = selected_account
        THEN CASE WHEN account.currency = 'AUD' THEN COALESCE(ledger.amount_aud, 0)
          + CASE WHEN COALESCE(ledger.entry_type, 'trade') = 'transfer' THEN COALESCE(ledger.fee_aud, 0) ELSE 0 END
          ELSE COALESCE(ledger.amount_toman, 0) END ELSE 0 END::numeric AS debit,
      CASE WHEN ledger.receiver_account_id = selected_account
        THEN CASE WHEN account.currency = 'AUD' THEN COALESCE(ledger.amount_aud, 0) ELSE COALESCE(ledger.amount_toman, 0) END ELSE 0 END::numeric AS credit,
      ledger.created_at
    FROM ledger CROSS JOIN account
    WHERE ledger.date_gregorian BETWEEN range_start AND range_end
      AND COALESCE(ledger.entry_type, 'trade') NOT IN ('expense', 'owner_loan')
      AND (ledger.payer_account_id = selected_account OR ledger.receiver_account_id = selected_account)
    UNION ALL
    SELECT concat('expense:', expense.id)::text, NULL::text,
      expense.date::date, expense.title::text,
      expense.amount::numeric, 0::numeric, expense.created_at
    FROM expenses expense CROSS JOIN account
    WHERE expense.status = 'paid'
      AND expense.payer_account_id = selected_account
      AND expense.currency = account.currency
      AND expense.date BETWEEN range_start AND range_end
    UNION ALL
    SELECT concat('owner-loan:', loan.id)::text, NULL::text,
      loan.date::date,
      CASE WHEN loan.funding_type = 'equity' THEN
        CASE WHEN loan.loan_type = 'injection' THEN 'Owner capital contribution' ELSE 'Owner capital withdrawal' END
        ELSE CASE WHEN loan.loan_type = 'injection' THEN 'Owner loan received' ELSE 'Owner loan repayment' END END,
      CASE WHEN loan.loan_type = 'repayment' THEN COALESCE(loan.settlement_amount, loan.amount) ELSE 0 END::numeric,
      CASE WHEN loan.loan_type = 'injection' THEN COALESCE(loan.settlement_amount, loan.amount) ELSE 0 END::numeric,
      loan.created_at
    FROM owner_loans loan CROSS JOIN account
    WHERE loan.account_id = selected_account
      AND COALESCE(loan.settlement_currency, loan.currency) = account.currency
      AND loan.cash_effect
      AND loan.date BETWEEN range_start AND range_end
  ), balanced AS (
    SELECT entries.*,
      opening.balance + sum(credit - debit) OVER (ORDER BY entry_date, created_at, ledger_id) AS running_balance,
      count(*) OVER () AS total_count
    FROM entries CROSS JOIN opening
  )
  SELECT ledger_id, transaction_id, entry_date, COALESCE(NULLIF(description, ''), 'Ledger movement'),
    debit, credit, running_balance, total_count
  FROM balanced ORDER BY entry_date, created_at, ledger_id
  OFFSET (GREATEST(page_number, 1) - 1) * LEAST(GREATEST(page_size, 1), 100)
  LIMIT LEAST(GREATEST(page_size, 1), 100)
$$;

REVOKE ALL ON FUNCTION public.refresh_enterprise_reports() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_enterprise_reports() TO service_role;
REVOKE ALL ON FUNCTION public.get_report_account_statement(uuid,date,date,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_report_account_statement(uuid,date,date,integer,integer) TO service_role;
UPDATE public.report_refresh_state SET is_stale = true, stale_since = COALESCE(stale_since, now()) WHERE id = true;
NOTIFY pgrst, 'reload schema';
COMMIT;
