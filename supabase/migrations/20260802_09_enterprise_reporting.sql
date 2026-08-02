-- Enterprise reporting read model. Ledger and journals remain authoritative.

CREATE TABLE IF NOT EXISTS reports_daily (
  period_start date PRIMARY KEY,
  period_end date NOT NULL,
  revenue numeric NOT NULL DEFAULT 0,
  expenses numeric NOT NULL DEFAULT 0,
  fee_income numeric NOT NULL DEFAULT 0,
  trading_profit numeric NOT NULL DEFAULT 0,
  other_income numeric NOT NULL DEFAULT 0,
  cash_in numeric NOT NULL DEFAULT 0,
  cash_out numeric NOT NULL DEFAULT 0,
  net_cashflow numeric NOT NULL DEFAULT 0,
  aud_inventory numeric NOT NULL DEFAULT 0,
  opening_aud_inventory numeric NOT NULL DEFAULT 0,
  aud_purchased numeric NOT NULL DEFAULT 0,
  aud_sold numeric NOT NULL DEFAULT 0,
  irt_liquidity numeric NOT NULL DEFAULT 0,
  wac numeric NOT NULL DEFAULT 0,
  average_rate numeric NOT NULL DEFAULT 0,
  average_buy_rate numeric NOT NULL DEFAULT 0,
  average_sell_rate numeric NOT NULL DEFAULT 0,
  highest_rate numeric NOT NULL DEFAULT 0,
  lowest_rate numeric NOT NULL DEFAULT 0,
  transaction_count integer NOT NULL DEFAULT 0,
  buy_count integer NOT NULL DEFAULT 0,
  sell_count integer NOT NULL DEFAULT 0,
  buy_volume numeric NOT NULL DEFAULT 0,
  sell_volume numeric NOT NULL DEFAULT 0,
  average_fee numeric NOT NULL DEFAULT 0,
  largest_transaction numeric NOT NULL DEFAULT 0,
  smallest_transaction numeric NOT NULL DEFAULT 0,
  new_customers integer NOT NULL DEFAULT 0,
  returning_customers integer NOT NULL DEFAULT 0,
  owner_injection numeric NOT NULL DEFAULT 0,
  owner_loan_repayment numeric NOT NULL DEFAULT 0,
  refunds numeric NOT NULL DEFAULT 0,
  transfers_in numeric NOT NULL DEFAULT 0,
  transfers_out numeric NOT NULL DEFAULT 0,
  expense_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_account_daily (
  account_id uuid NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  opening_balance numeric NOT NULL DEFAULT 0,
  deposits numeric NOT NULL DEFAULT 0,
  withdrawals numeric NOT NULL DEFAULT 0,
  transfers_in numeric NOT NULL DEFAULT 0,
  transfers_out numeric NOT NULL DEFAULT 0,
  closing_balance numeric NOT NULL DEFAULT 0,
  net_movement numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, period_start)
);

CREATE TABLE IF NOT EXISTS report_customer_daily (
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  transaction_count integer NOT NULL DEFAULT 0,
  aud_volume numeric NOT NULL DEFAULT 0,
  irt_volume numeric NOT NULL DEFAULT 0,
  fee_income numeric NOT NULL DEFAULT 0,
  is_new_customer boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, period_start)
);

CREATE TABLE IF NOT EXISTS report_refresh_state (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  is_stale boolean NOT NULL DEFAULT true,
  stale_since timestamptz,
  last_started_at timestamptz,
  last_completed_at timestamptz,
  last_error text
);
INSERT INTO report_refresh_state (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_reports_daily_period_desc ON reports_daily (period_start DESC);
CREATE INDEX IF NOT EXISTS idx_report_account_period ON report_account_daily (account_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_report_customer_period ON report_customer_daily (period_start DESC, aud_volume DESC);
CREATE INDEX IF NOT EXISTS idx_report_customer_customer ON report_customer_daily (customer_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_reporting_order ON ledger (date_gregorian, created_at, id);
CREATE INDEX IF NOT EXISTS idx_ledger_reporting_transaction ON ledger (transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_reporting_date ON expenses (date) WHERE status = 'paid';
CREATE INDEX IF NOT EXISTS idx_owner_loans_reporting_date ON owner_loans (date);

ALTER TABLE reports_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_account_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_customer_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_refresh_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reports_daily_admin_read ON reports_daily;
CREATE POLICY reports_daily_admin_read ON reports_daily FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'supabase_admin', 'service_role'));
DROP POLICY IF EXISTS report_account_admin_read ON report_account_daily;
CREATE POLICY report_account_admin_read ON report_account_daily FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'supabase_admin', 'service_role'));
DROP POLICY IF EXISTS report_customer_admin_read ON report_customer_daily;
CREATE POLICY report_customer_admin_read ON report_customer_daily FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'supabase_admin', 'service_role'));
DROP POLICY IF EXISTS report_refresh_admin_read ON report_refresh_state;
CREATE POLICY report_refresh_admin_read ON report_refresh_state FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'supabase_admin', 'service_role'));

CREATE OR REPLACE FUNCTION mark_enterprise_reports_stale()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO report_refresh_state (id, is_stale, stale_since)
  VALUES (true, true, now())
  ON CONFLICT (id) DO UPDATE SET is_stale = true, stale_since = COALESCE(report_refresh_state.stale_since, now());
  RETURN NULL;
END;
$$;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['ledger', 'expenses', 'owner_loans', 'bank_accounts'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_reports_stale ON %I', table_name, table_name);
    EXECUTE format('CREATE TRIGGER trg_%I_reports_stale AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH STATEMENT EXECUTE FUNCTION mark_enterprise_reports_stale()', table_name, table_name);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION refresh_enterprise_reports()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE report_refresh_state SET last_started_at = now(), last_error = NULL WHERE id = true;

  CREATE TEMP TABLE report_ledger_facts ON COMMIT DROP AS
  WITH RECURSIVE ordered AS (
    SELECT row_number() OVER (ORDER BY date_gregorian, created_at, id) AS seq,
      date_gregorian::date AS day, type, COALESCE(entry_type, 'trade') AS entry_type,
      COALESCE(amount_aud, 0)::numeric AS aud, COALESCE(amount_toman, 0)::numeric AS irt,
      COALESCE(fee_aud, 0)::numeric AS fee_aud, payer_account_id, receiver_account_id,
      transaction_id, created_at
    FROM ledger
  ), states AS (
    SELECT 0::bigint AS seq, NULL::date AS day, 0::numeric AS inventory,
      0::numeric AS wac, 0::numeric AS realized_profit
    UNION ALL
    SELECT row.seq, row.day,
      state.inventory + CASE WHEN row.entry_type NOT IN ('transfer','expense','owner_loan','adjustment')
        THEN CASE WHEN row.type = 'buy_aud' THEN row.aud WHEN row.type = 'sell_aud' THEN -row.aud ELSE 0 END ELSE 0 END,
      CASE WHEN row.entry_type NOT IN ('transfer','expense','owner_loan','adjustment') AND row.type = 'buy_aud' AND row.aud > 0
        THEN CASE WHEN state.inventory > 0 THEN ((state.inventory * state.wac) + row.irt) / NULLIF(state.inventory + row.aud, 0)
          ELSE row.irt / NULLIF(row.aud, 0) END ELSE state.wac END,
      CASE WHEN row.entry_type NOT IN ('transfer','expense','owner_loan','adjustment') AND row.type = 'sell_aud' AND row.aud > 0
        THEN row.irt - (row.aud * state.wac) ELSE 0 END
    FROM states state JOIN ordered row ON row.seq = state.seq + 1
  )
  SELECT row.*, state.inventory, state.wac, state.realized_profit
  FROM ordered row JOIN states state USING (seq);

  TRUNCATE reports_daily, report_account_daily, report_customer_daily;

  WITH ledger_days AS (
    SELECT day,
      sum(irt) FILTER (WHERE type = 'sell_aud' AND entry_type NOT IN ('transfer','expense','owner_loan','adjustment')) AS revenue,
      sum(irt) FILTER (WHERE type = 'buy_aud' AND entry_type NOT IN ('transfer','expense','owner_loan','adjustment')) AS purchase_cost,
      sum(realized_profit) AS trading_profit,
      sum(fee_aud * (irt / NULLIF(aud, 0))) FILTER (WHERE entry_type <> 'transfer') AS fee_income,
      sum(aud) FILTER (WHERE type = 'buy_aud' AND entry_type NOT IN ('transfer','expense','owner_loan','adjustment')) AS aud_purchased,
      sum(aud) FILTER (WHERE type = 'sell_aud' AND entry_type NOT IN ('transfer','expense','owner_loan','adjustment')) AS aud_sold,
      count(*) FILTER (WHERE entry_type NOT IN ('transfer','expense','owner_loan','adjustment')) AS transaction_count,
      count(*) FILTER (WHERE type = 'buy_aud' AND entry_type NOT IN ('transfer','expense','owner_loan','adjustment')) AS buy_count,
      count(*) FILTER (WHERE type = 'sell_aud' AND entry_type NOT IN ('transfer','expense','owner_loan','adjustment')) AS sell_count,
      sum(aud) FILTER (WHERE type = 'buy_aud') AS buy_volume,
      sum(aud) FILTER (WHERE type = 'sell_aud') AS sell_volume,
      sum(irt) FILTER (WHERE aud > 0) / NULLIF(sum(aud) FILTER (WHERE aud > 0), 0) AS average_rate,
      (sum(irt) FILTER (WHERE type = 'buy_aud')) / NULLIF(sum(aud) FILTER (WHERE type = 'buy_aud'), 0) AS average_buy_rate,
      (sum(irt) FILTER (WHERE type = 'sell_aud')) / NULLIF(sum(aud) FILTER (WHERE type = 'sell_aud'), 0) AS average_sell_rate,
      max(irt / NULLIF(aud, 0)) FILTER (WHERE aud > 0) AS highest_rate,
      min(irt / NULLIF(aud, 0)) FILTER (WHERE aud > 0) AS lowest_rate,
      avg(fee_aud) AS average_fee, max(aud) AS largest_transaction, min(aud) FILTER (WHERE aud > 0) AS smallest_transaction
    FROM report_ledger_facts GROUP BY day
  ), closings AS (
    SELECT DISTINCT ON (day) day, inventory, wac FROM report_ledger_facts ORDER BY day, seq DESC
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
    FROM owner_loans GROUP BY date
  ), days AS (
    SELECT day FROM ledger_days UNION SELECT day FROM expense_days UNION SELECT day FROM loan_days
  ), combined AS (
    SELECT days.day,
      ledger_days.revenue, ledger_days.purchase_cost, ledger_days.trading_profit,
      ledger_days.fee_income, ledger_days.aud_purchased, ledger_days.aud_sold,
      ledger_days.transaction_count, ledger_days.buy_count, ledger_days.sell_count,
      ledger_days.buy_volume, ledger_days.sell_volume, ledger_days.average_rate,
      ledger_days.average_buy_rate, ledger_days.average_sell_rate,
      ledger_days.highest_rate, ledger_days.lowest_rate, ledger_days.average_fee,
      ledger_days.largest_transaction, ledger_days.smallest_transaction,
      (SELECT inventory FROM closings WHERE closings.day <= days.day ORDER BY closings.day DESC LIMIT 1) AS inventory,
      (SELECT wac FROM closings WHERE closings.day <= days.day ORDER BY closings.day DESC LIMIT 1) AS wac,
      COALESCE(expense_days.expenses, 0) AS expenses, COALESCE(expense_days.breakdown, '{}'::jsonb) AS breakdown,
      COALESCE(loan_days.injection, 0) AS injection, COALESCE(loan_days.repayment, 0) AS repayment
    FROM days LEFT JOIN ledger_days USING (day)
      LEFT JOIN expense_days USING (day) LEFT JOIN loan_days USING (day)
  )
  INSERT INTO reports_daily (
    period_start, period_end, revenue, expenses, fee_income, trading_profit, cash_in, cash_out, net_cashflow,
    aud_inventory, opening_aud_inventory, aud_purchased, aud_sold, wac, average_rate, average_buy_rate,
    average_sell_rate, highest_rate, lowest_rate, transaction_count, buy_count, sell_count, buy_volume,
    sell_volume, average_fee, largest_transaction, smallest_transaction, owner_injection,
    owner_loan_repayment, expense_breakdown, updated_at)
  SELECT day, day, COALESCE(revenue,0), expenses, COALESCE(fee_income,0), COALESCE(trading_profit,0),
    COALESCE(revenue,0) + injection, COALESCE(purchase_cost,0) + expenses + repayment,
    COALESCE(revenue,0) + injection - COALESCE(purchase_cost,0) - expenses - repayment,
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
        CASE WHEN entry_type <> 'transfer' THEN CASE WHEN account.currency = 'AUD' THEN aud + fee_aud ELSE irt END ELSE 0 END,
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
        CASE WHEN loan.loan_type = 'injection' THEN loan.amount ELSE 0 END::numeric,
        CASE WHEN loan.loan_type = 'repayment' THEN loan.amount ELSE 0 END::numeric,
        0, 0
      FROM owner_loans loan
      JOIN bank_accounts account ON account.id = loan.account_id AND account.currency = loan.currency
      WHERE loan.account_id IS NOT NULL
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
  SELECT transaction.user_id, fact.day, count(*), sum(fact.aud), sum(fact.irt),
    sum(fact.fee_aud * fact.irt / NULLIF(fact.aud, 0)),
    fact.day = min(fact.day) OVER (PARTITION BY transaction.user_id)
  FROM report_ledger_facts fact JOIN transactions transaction ON transaction.id::text = fact.transaction_id::text
  WHERE transaction.user_id IS NOT NULL GROUP BY transaction.user_id, fact.day;

  UPDATE reports_daily report SET
    new_customers = customer.new_count, returning_customers = customer.returning_count
  FROM (SELECT period_start, count(*) FILTER (WHERE is_new_customer) AS new_count,
    count(*) FILTER (WHERE NOT is_new_customer) AS returning_count
    FROM report_customer_daily GROUP BY period_start) customer
  WHERE report.period_start = customer.period_start;

  EXECUTE 'REFRESH MATERIALIZED VIEW reports_monthly';
  EXECUTE 'REFRESH MATERIALIZED VIEW reports_yearly';

  UPDATE report_refresh_state SET is_stale = false, stale_since = NULL, last_completed_at = now(), last_error = NULL WHERE id = true;
EXCEPTION WHEN OTHERS THEN
  UPDATE report_refresh_state SET last_error = SQLERRM WHERE id = true;
  RAISE;
END;
$$;

DROP MATERIALIZED VIEW IF EXISTS reports_monthly;
CREATE MATERIALIZED VIEW reports_monthly AS
SELECT date_trunc('month', period_start)::date AS period_start, max(period_start) AS period_end,
  sum(revenue) AS revenue, sum(expenses) AS expenses, sum(fee_income) AS fee_income,
  sum(trading_profit) AS trading_profit, sum(cash_in) AS cash_in, sum(cash_out) AS cash_out,
  sum(net_cashflow) AS net_cashflow, sum(transaction_count) AS transaction_count,
  sum(buy_volume) AS buy_volume, sum(sell_volume) AS sell_volume
FROM reports_daily GROUP BY 1 WITH NO DATA;
CREATE UNIQUE INDEX reports_monthly_period ON reports_monthly (period_start);

DROP MATERIALIZED VIEW IF EXISTS reports_yearly;
CREATE MATERIALIZED VIEW reports_yearly AS
SELECT date_trunc('year', period_start)::date AS period_start, max(period_start) AS period_end,
  sum(revenue) AS revenue, sum(expenses) AS expenses, sum(fee_income) AS fee_income,
  sum(trading_profit) AS trading_profit, sum(cash_in) AS cash_in, sum(cash_out) AS cash_out,
  sum(net_cashflow) AS net_cashflow, sum(transaction_count) AS transaction_count,
  sum(buy_volume) AS buy_volume, sum(sell_volume) AS sell_volume
FROM reports_daily GROUP BY 1 WITH NO DATA;
CREATE UNIQUE INDEX reports_yearly_period ON reports_yearly (period_start);

CREATE OR REPLACE FUNCTION get_top_report_customers(
  range_start date,
  range_end date,
  result_limit integer DEFAULT 10
)
RETURNS TABLE (
  customer_id uuid,
  customer_name text,
  customer_code text,
  transaction_count bigint,
  aud_volume numeric
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT customer.customer_id,
    trim(concat_ws(' ', profile.first_name, profile.last_name)) AS customer_name,
    profile.customer_code,
    sum(customer.transaction_count)::bigint,
    sum(customer.aud_volume)
  FROM report_customer_daily customer
  JOIN profiles profile ON profile.id = customer.customer_id
  WHERE customer.period_start BETWEEN range_start AND range_end
  GROUP BY customer.customer_id, profile.first_name, profile.last_name, profile.customer_code
  ORDER BY sum(customer.aud_volume) DESC
  LIMIT LEAST(GREATEST(result_limit, 1), 100)
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
        THEN CASE WHEN account.currency = 'AUD' THEN COALESCE(ledger.amount_aud, 0) + COALESCE(ledger.fee_aud, 0) ELSE COALESCE(ledger.amount_toman, 0) END ELSE 0 END::numeric AS debit,
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
      CASE WHEN loan.loan_type = 'injection' THEN 'Owner injection' ELSE 'Owner loan repayment' END,
      CASE WHEN loan.loan_type = 'repayment' THEN loan.amount ELSE 0 END::numeric,
      CASE WHEN loan.loan_type = 'injection' THEN loan.amount ELSE 0 END::numeric,
      loan.created_at
    FROM owner_loans loan CROSS JOIN account
    WHERE loan.account_id = selected_account
      AND loan.currency = account.currency
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

REVOKE ALL ON FUNCTION refresh_enterprise_reports() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION refresh_enterprise_reports() TO service_role;
REVOKE ALL ON FUNCTION mark_enterprise_reports_stale() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION get_top_report_customers(date, date, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_top_report_customers(date, date, integer) TO service_role;
REVOKE ALL ON FUNCTION get_report_account_statement(uuid, date, date, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_report_account_statement(uuid, date, date, integer, integer) TO service_role;
