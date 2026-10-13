// Isolated PostgreSQL tests: no production connections or financial data.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { before, after, beforeEach, afterEach, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import ts from 'typescript';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const require = createRequire(import.meta.url);
function compile(file, imports = {}) {
  const output = { exports: {} };
  const code = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`)(id => imports[id] ?? require(id), output, output.exports);
  return output.exports;
}
const pricing = compile('lib/pricing.ts');
const { calcAccountingSnapshot } = compile('lib/accounting-engine.ts', { '@/lib/pricing': pricing });
const AUD = '10000000-0000-4000-8000-000000000001';
const IRT = '10000000-0000-4000-8000-000000000002';
const ORIGINAL = '20000000-0000-4000-8000-000000000001';
const MIGRATION = 'supabase/migrations/20261013_60_owner_capital_accounting.APPLY_MANUALLY.sql';
let db;
const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
async function rejected(work, pattern) {
  await db.exec('SAVEPOINT invalid_funding');
  await assert.rejects(work, pattern);
  await db.exec('ROLLBACK TO SAVEPOINT invalid_funding');
}
async function funding(extra = {}) {
  const values = {
    date: '2026-05-30', currency: 'AUD', amount: 100, exchange_rate: 100000,
    loan_type: 'injection', account_id: AUD, ...extra,
  };
  const columns = Object.keys(values);
  return one(`INSERT INTO owner_loans(${columns.join(',')}) VALUES(${columns.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`, Object.values(values));
}
const refresh = () => db.exec('SET CONSTRAINTS ALL IMMEDIATE; SELECT refresh_enterprise_reports()');
const statement = account => db.query("SELECT * FROM get_report_account_statement($1,'2026-01-01','2026-12-31')", [account]);
async function trade({ date = '2026-05-30', type = 'buy_aud', aud = 100, rate = 100000, ...rest } = {}) {
  const values = { date_gregorian: date, date_jalali: '', type, entry_type: 'trade', amount_aud: aud,
    amount_toman: aud * rate, exchange_rate: rate, ...rest };
  const keys = Object.keys(values);
  return one(`INSERT INTO ledger(${keys.join(',')}) VALUES(${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`, Object.values(values));
}
async function valuationParity() {
  await refresh();
  const [ledger, expenses, loans, accounts] = await Promise.all([
    db.query('SELECT *,date_gregorian::text,created_at::text FROM ledger'),
    db.query('SELECT *,date::text,created_at::text FROM expenses'),
    db.query('SELECT *,date::text,created_at::text FROM owner_loans'),
    db.query('SELECT id,account_name AS name,currency,account_type AS type FROM bank_accounts'),
  ]);
  const snapshot = calcAccountingSnapshot(ledger.rows, expenses.rows, loans.rows, accounts.rows, 185000);
  const value = await one(`SELECT (SELECT inventory FROM get_accounting_inventory_events() ORDER BY seq DESC LIMIT 1) AS inventory,
    (SELECT wac FROM get_accounting_inventory_events() ORDER BY seq DESC LIMIT 1) AS wac,
    sum(realized_profit) AS profit,sum(realized_asset_fx) AS asset_fx FROM get_accounting_inventory_events()`);
  const close = (actual, expected, tolerance = .01) => assert.ok(Math.abs(Number(actual) - expected) <= tolerance, `${actual} != ${expected}`);
  close(value.inventory, snapshot.audInventory, .00000001);
  close(value.wac, snapshot.wac);
  close(value.profit, snapshot.realizedTradingProfit);
  close(value.asset_fx, snapshot.realizedFXGainLossIRT);
  const reported = await one('SELECT sum(trading_profit) AS profit,sum(other_income) AS asset_fx,sum(fee_income-expenses+trading_profit) AS operating FROM reports_daily');
  close(reported.profit, snapshot.realizedTradingProfit);
  close(reported.asset_fx, snapshot.realizedFXGainLossIRT);
  close(reported.operating, snapshot.operatingProfit);
  const closing = await one('SELECT aud_inventory,wac FROM reports_daily ORDER BY period_start DESC LIMIT 1');
  close(closing.aud_inventory, snapshot.audInventory, .00000001);
  close(closing.wac, snapshot.wac);
  return snapshot;
}

before(async () => {
  db = new PGlite();
  await db.exec(read('scripts/fixtures/customer-requests.sql'));
  await db.exec(`
    ALTER TABLE owner_loans ADD COLUMN notes text, ADD COLUMN date_jalali text DEFAULT '',
      ADD COLUMN created_by uuid, ADD COLUMN repayment_status text DEFAULT 'open';
    ALTER TABLE ledger ADD COLUMN notes text, ADD COLUMN request_fee_entry_id uuid,
      ADD COLUMN owner_loan_id uuid REFERENCES owner_loans(id) ON DELETE CASCADE;
    CREATE TABLE exchange_requests(id uuid PRIMARY KEY, user_id uuid, quote jsonb);
    CREATE TABLE exchange_request_fee_earnings(request_id uuid, earned_at timestamptz, amount_toman numeric);
    CREATE TABLE exchange_request_fee_entries(request_id uuid, created_at timestamptz, kind text, currency text, amount numeric);
  `);
  await db.exec(read('supabase/migrations/20260802_09_enterprise_reporting.sql'));
  await db.query("INSERT INTO bank_accounts(id,account_name,currency) VALUES($1,'Synthetic AUD','AUD'),($2,'Synthetic IRT','IRT')", [AUD, IRT]);
  await db.exec("INSERT INTO rates_history(date,buy_aud,sell_aud) VALUES('2026-10-13',185000,190000)");
  await funding({ id: ORIGINAL, amount: 1200 });
  await db.exec(read(MIGRATION));
});
after(async () => { await db?.close(); });
beforeEach(async () => { await db.exec('BEGIN'); });
afterEach(async () => { await db.exec('ROLLBACK'); });

test('existing owner funding remains a repayable cash loan unless explicitly reclassified', async () => {
  const original = await one('SELECT * FROM owner_loans WHERE id=$1', [ORIGINAL]);
  assert.equal(original.funding_type, 'loan');
  assert.equal(original.cash_effect, true);
  assert.equal(original.settlement_currency, null);
  assert.equal(original.settlement_amount, null);
  await refresh();
  const balance = await one('SELECT closing_balance FROM report_account_daily WHERE account_id=$1 ORDER BY period_start DESC LIMIT 1', [AUD]);
  assert.equal(Number(balance.closing_balance), 1200);
  const report = await one('SELECT revenue,fee_income,trading_profit,owner_injection,cash_in FROM reports_daily ORDER BY period_start DESC LIMIT 1');
  assert.equal(Number(report.revenue), 0);
  assert.equal(Number(report.fee_income), 0);
  assert.equal(Number(report.trading_profit), 0);
  assert.equal(Number(report.owner_injection), 120000000);
  assert.equal(Number(report.cash_in), 120000000);
  const mirrors = (await db.query('SELECT * FROM ledger WHERE owner_loan_id=$1', [ORIGINAL])).rows;
  assert.equal(mirrors.length, 1);
  assert.equal(mirrors[0].entry_type, 'owner_loan');
  assert.equal(Number(mirrors[0].amount_aud), 1200);
});

test('reclassifying permanent capital changes its statement label without creating income or cash', async () => {
  await db.query("UPDATE owner_loans SET funding_type='equity' WHERE id=$1", [ORIGINAL]);
  await refresh();
  const rows = (await statement(AUD)).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].description, 'Owner capital contribution');
  assert.equal(Number(rows[0].credit), 1200);
  assert.equal(Number(rows[0].running_balance), 1200);
  const report = await one('SELECT revenue,trading_profit,fee_income,buy_volume,sell_volume FROM reports_daily');
  for (const value of Object.values(report)) assert.equal(Number(value), 0);
});

test('AUD principal can be repaid from an IRT account using the actual settlement exactly once', async () => {
  const withdrawal = await funding({ loan_type: 'repayment', amount: 50, account_id: IRT,
    exchange_rate: 125000, settlement_currency: 'IRT', settlement_amount: 6250000 });
  assert.equal(Number(withdrawal.amount), 50);
  assert.equal(withdrawal.currency, 'AUD');
  await refresh();
  const bank = await one('SELECT closing_balance FROM report_account_daily WHERE account_id=$1 ORDER BY period_start DESC LIMIT 1', [IRT]);
  assert.equal(Number(bank.closing_balance), -6250000);
  const rows = (await statement(IRT)).rows;
  assert.equal(rows.length, 1);
  assert.equal(Number(rows[0].debit), 6250000);
  assert.equal(Number(rows[0].running_balance), -6250000);
  const report = await one('SELECT cash_out,owner_loan_repayment,expenses FROM reports_daily');
  assert.equal(Number(report.cash_out), 6250000);
  assert.equal(Number(report.owner_loan_repayment), 6250000);
  assert.equal(Number(report.expenses), 0);
  const mirror = await one('SELECT * FROM ledger WHERE owner_loan_id=$1', [withdrawal.id]);
  assert.equal(Number(mirror.amount_aud), 0);
  assert.equal(Number(mirror.amount_toman), 6250000);
  assert.equal(mirror.payer_account_id, IRT);
});

test('funding linked to existing cash evidence does not add a second bank movement', async () => {
  const source = await one(`INSERT INTO ledger(date_gregorian,date_jalali,type,entry_type,amount_aud,amount_toman,
    receiver_account_id,exchange_rate) VALUES('2026-06-01','','buy_aud','adjustment',700,0,$1,0) RETURNING id`, [AUD]);
  await funding({ date: '2026-06-01', amount: 700, funding_type: 'equity', cash_effect: false, linked_ledger_id: source.id });
  await refresh();
  const bank = await one('SELECT closing_balance FROM report_account_daily WHERE account_id=$1 ORDER BY period_start DESC LIMIT 1', [AUD]);
  assert.equal(Number(bank.closing_balance), 1900);
  const rows = (await statement(AUD)).rows;
  assert.equal(rows.length, 2);
  assert.equal(Number(rows.at(-1).running_balance), 1900);
  const report = await one("SELECT revenue,fee_income,trading_profit,cash_in FROM reports_daily WHERE period_start='2026-06-01'");
  for (const value of Object.values(report)) assert.equal(Number(value), 0);
});

test('invalid settlement pairs, account currencies and duplicate cash evidence fail atomically', async () => {
  await rejected(() => funding({ funding_type: 'other' }), /funding_type_check/);
  await rejected(() => funding({ settlement_currency: 'AUD' }), /settlement_check/);
  await rejected(() => funding({ settlement_amount: 1 }), /settlement_check/);
  await rejected(() => funding({ settlement_currency: 'AUD', settlement_amount: -1 }), /settlement_check/);
  await rejected(() => funding({ account_id: IRT }), /settlement currency must match/);
  await rejected(() => funding({ account_id: null }), /valid bank account/);
  const source = await one(`INSERT INTO ledger(date_gregorian,date_jalali,type,entry_type,amount_aud,amount_toman)
    VALUES('2026-06-01','','buy_aud','adjustment',0,0) RETURNING id`);
  await rejected(() => funding({ linked_ledger_id: source.id }), /linked_cash_check/);
  assert.equal(Number((await one('SELECT count(*) AS count FROM owner_loans')).count), 1);
});

test('final-state mirror sync coexists with an old cash-unaware trigger and preserves mirror history', async () => {
  await db.exec(`
    CREATE FUNCTION test_old_owner_mirror() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      INSERT INTO ledger(owner_loan_id,date_gregorian,date_jalali,type,entry_type,amount_aud,amount_toman,
        receiver_account_id,notes)
      VALUES(NEW.id,NEW.date,'','buy_aud','owner_loan',NEW.amount,NEW.amount*NEW.exchange_rate,NEW.account_id,'Retained import note')
      ON CONFLICT(owner_loan_id) WHERE owner_loan_id IS NOT NULL
      DO UPDATE SET amount_aud=excluded.amount_aud,amount_toman=excluded.amount_toman,
        receiver_account_id=excluded.receiver_account_id;
      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER old_owner_mirror AFTER INSERT OR UPDATE ON owner_loans
    FOR EACH ROW EXECUTE FUNCTION test_old_owner_mirror();
  `);
  const row = await funding({ amount: 700, funding_type: 'equity', cash_effect: false });
  const oldMirror = await one('SELECT * FROM ledger WHERE owner_loan_id=$1', [row.id]);
  assert.equal(Number(oldMirror.amount_aud), 700);
  await db.exec('SET CONSTRAINTS ALL IMMEDIATE');
  const neutralMirror = await one('SELECT * FROM ledger WHERE owner_loan_id=$1', [row.id]);
  assert.equal(neutralMirror.id, oldMirror.id);
  assert.equal(neutralMirror.notes, 'Retained import note');
  assert.equal(Number(neutralMirror.amount_aud), 0);
  assert.equal(Number(neutralMirror.amount_toman), 0);
  assert.equal(neutralMirror.payer_account_id, null);
  assert.equal(neutralMirror.receiver_account_id, null);

  await db.query(`UPDATE owner_loans SET cash_effect=true,loan_type='repayment',amount=50,account_id=$2,
    settlement_currency='IRT',settlement_amount=6250000 WHERE id=$1`, [row.id, IRT]);
  const updated = await one('SELECT * FROM ledger WHERE owner_loan_id=$1', [row.id]);
  assert.equal(updated.id, oldMirror.id);
  assert.equal(updated.type, 'sell_aud');
  assert.equal(Number(updated.amount_aud), 0);
  assert.equal(Number(updated.amount_toman), 6250000);
  assert.equal(updated.payer_account_id, IRT);
  assert.equal(updated.receiver_account_id, null);
  assert.equal(updated.notes, 'Retained import note');
  assert.equal(Number((await one('SELECT count(*) AS count FROM ledger WHERE owner_loan_id=$1', [row.id])).count), 1);
  await db.query('DELETE FROM owner_loans WHERE id=$1', [row.id]);
  assert.equal(Number((await one('SELECT count(*) AS count FROM ledger WHERE owner_loan_id=$1', [row.id])).count), 0);
});

test('mirror backfill is idempotent and cannot be invoked directly by application roles', async () => {
  const beforeMirror = await one('SELECT * FROM ledger WHERE owner_loan_id=$1', [ORIGINAL]);
  await db.query('SELECT sync_owner_funding_ledger($1)', [ORIGINAL]);
  await db.query('SELECT sync_owner_funding_ledger($1)', [ORIGINAL]);
  const rows = (await db.query('SELECT * FROM ledger WHERE owner_loan_id=$1', [ORIGINAL])).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, beforeMirror.id);
  for (const role of ['anon', 'authenticated', 'service_role']) {
    const privilege = await one("SELECT has_function_privilege($1,'public.sync_owner_funding_ledger(uuid)','EXECUTE') AS allowed", [role]);
    assert.equal(privilege.allowed, false);
  }
});

test('SQL inventory values same-day capital before customer payment, expense and withdrawal', async () => {
  await db.query('DELETE FROM owner_loans WHERE id=$1', [ORIGINAL]);
  await funding({ amount: 100, funding_type: 'equity', created_at: '2026-05-30T23:00:00Z' });
  await trade({ type: 'sell_aud', aud: 70, rate: 120000, payer_account_id: AUD, receiver_account_id: IRT,
    created_at: '2026-05-30T00:00:00Z' });
  await db.query(`INSERT INTO expenses(date,title,category,currency,amount,exchange_rate,payer_account_id,status)
    VALUES('2026-05-30','Synthetic service','software','AUD',20,105000,$1,'paid')`, [AUD]);
  await funding({ funding_type: 'equity', loan_type: 'repayment', amount: 10, exchange_rate: 130000,
    created_at: '2026-05-30T00:00:00Z' });
  const snapshot = await valuationParity();
  assert.equal(snapshot.audInventory, 0);
  assert.equal(snapshot.realizedTradingProfit, 1400000);
  assert.equal(snapshot.realizedFXGainLossIRT, 400000);
});

test('SQL short-sale covers preserve weighted trade and expense proceeds until cover', async () => {
  await db.query('DELETE FROM owner_loans WHERE id=$1', [ORIGINAL]);
  await trade({ type: 'sell_aud', aud: 100, rate: 200000, payer_account_id: AUD, receiver_account_id: IRT });
  await db.query(`INSERT INTO expenses(date,title,category,currency,amount,exchange_rate,payer_account_id,status)
    VALUES('2026-05-30','Synthetic service','software','AUD',20,180000,$1,'paid')`, [AUD]);
  const short = await one('SELECT sum(realized_profit) AS profit FROM get_accounting_inventory_events()');
  assert.equal(Number(short.profit), 0);
  await funding({ date: '2026-05-31', amount: 50, funding_type: 'equity', exchange_rate: 100000 });
  await trade({ date: '2026-06-01', aud: 100, rate: 150000, receiver_account_id: AUD, payer_account_id: IRT });
  const snapshot = await valuationParity();
  assert.equal(snapshot.audInventory, 30);
  assert.equal(snapshot.wac, 150000);
  assert.ok(Math.abs(snapshot.realizedTradingProfit - 7083333.333333333) < .01);
});

test('SQL includes cross-currency AUD funding and transfer fees but excludes fee escrow inventory', async () => {
  await db.query('DELETE FROM owner_loans WHERE id=$1', [ORIGINAL]);
  const secondAUD = '10000000-0000-4000-8000-000000000003';
  await db.query("INSERT INTO bank_accounts(id,account_name,currency) VALUES($1,'Synthetic second AUD','AUD')", [secondAUD]);
  await funding({ currency: 'IRT', amount: 10000000, funding_type: 'equity', settlement_currency: 'AUD', settlement_amount: 100 });
  await trade({ date: '2026-05-31', entry_type: 'transfer', aud: 10, rate: 110000,
    payer_account_id: AUD, receiver_account_id: secondAUD, fee_aud: 2 });
  await trade({ date: '2026-06-01', entry_type: 'adjustment', aud: 9, rate: 120000,
    receiver_account_id: AUD, request_fee_entry_id: '30000000-0000-4000-8000-000000000001' });
  const snapshot = await valuationParity();
  assert.equal(snapshot.audInventory, 98);
  assert.equal(snapshot.realizedFXGainLossIRT, 20000);
  assert.equal(snapshot.operatingProfit, -220000);
  const report = await one("SELECT expense_breakdown FROM reports_daily WHERE period_start='2026-05-31'");
  assert.equal(Number(report.expense_breakdown.bank_fees), 220000);
});

test('account statements do not subtract a trade service fee from the AUD principal a second time', async () => {
  await db.query('DELETE FROM owner_loans WHERE id=$1', [ORIGINAL]);
  await funding({ amount: 100, funding_type: 'equity' });
  await trade({ date: '2026-06-01', type: 'sell_aud', aud: 50, rate: 120000, amount_toman: 6600000,
    payer_account_id: AUD, receiver_account_id: IRT, fee_aud: 5 });
  await valuationParity();
  const rows = (await statement(AUD)).rows;
  assert.equal(Number(rows.at(-1).debit), 50);
  assert.equal(Number(rows.at(-1).running_balance), 50);
});

test('mapped bank-to-customer AUD settlement has no inventory gain while its service fee remains income', async () => {
  const customerAUD = '10000000-0000-4000-8000-000000000003';
  await db.query("INSERT INTO bank_accounts(id,account_name,currency,account_type) VALUES($1,'Synthetic customer credit','AUD','virtual')", [customerAUD]);
  await trade({ date: '2026-06-01', type: 'sell_aud', aud: 50, rate: 120000, amount_toman: 7200000,
    payer_account_id: AUD, receiver_account_id: customerAUD, fee_aud: 10 });
  const snapshot = await valuationParity();
  assert.equal(snapshot.audInventory, 1200);
  assert.equal(snapshot.wac, 100000);
  assert.equal(snapshot.realizedTradingProfit, 0);
  assert.equal(snapshot.operatingProfit, 1200000);
  const report = await one("SELECT revenue,cash_in,cash_out,aud_purchased,aud_sold,buy_volume,sell_volume,transaction_count,buy_count,sell_count,fee_income FROM reports_daily WHERE period_start='2026-06-01'");
  assert.equal(Number(report.fee_income), 1200000);
  for (const [field, value] of Object.entries(report)) if (field !== 'fee_income') assert.equal(Number(value), 0, field);
  const bankRows = (await statement(AUD)).rows;
  const customerRows = (await statement(customerAUD)).rows;
  assert.equal(Number(bankRows.at(-1).running_balance), 1150);
  assert.equal(Number(customerRows.at(-1).running_balance), 50);
});

test('mapped cross-currency direction overrides stale trade type including principal fee direction', async () => {
  // Declared buy is really an AUD sale: the 600,000 IRT fee is removed from proceeds.
  await trade({ date: '2026-06-01', type: 'buy_aud', aud: 50, rate: 120000, amount_toman: 6600000,
    payer_account_id: AUD, receiver_account_id: IRT, fee_aud: 5 });
  // Declared sell is really an AUD purchase: add the fee back to determine its cost.
  await trade({ date: '2026-06-02', type: 'sell_aud', aud: 50, rate: 140000, amount_toman: 6300000,
    payer_account_id: IRT, receiver_account_id: AUD, fee_aud: 5 });
  const snapshot = await valuationParity();
  assert.equal(snapshot.audInventory, 1200);
  assert.ok(Math.abs(snapshot.wac - 101666.66666666667) < .000001);
  assert.equal(snapshot.realizedTradingProfit, 1000000);
  assert.equal(snapshot.operatingProfit, 2300000);
  const sale = await one("SELECT revenue,cash_out,buy_volume,sell_volume,buy_count,sell_count FROM reports_daily WHERE period_start='2026-06-01'");
  assert.deepEqual(Object.fromEntries(Object.entries(sale).map(([key, value]) => [key, Number(value)])),
    { revenue: 6000000, cash_out: 0, buy_volume: 0, sell_volume: 50, buy_count: 0, sell_count: 1 });
  const purchase = await one("SELECT revenue,cash_out,buy_volume,sell_volume,buy_count,sell_count FROM reports_daily WHERE period_start='2026-06-02'");
  assert.deepEqual(Object.fromEntries(Object.entries(purchase).map(([key, value]) => [key, Number(value)])),
    { revenue: 0, cash_out: 7000000, buy_volume: 50, sell_volume: 0, buy_count: 1, sell_count: 0 });
});

test('same-IRT settlement is inventory-neutral and partially mapped trades retain the declared fallback', async () => {
  const secondIRT = '10000000-0000-4000-8000-000000000003';
  await db.query("INSERT INTO bank_accounts(id,account_name,currency) VALUES($1,'Synthetic IRT customer','IRT')", [secondIRT]);
  await trade({ date: '2026-06-01', type: 'sell_aud', aud: 70, rate: 130000,
    payer_account_id: IRT, receiver_account_id: secondIRT });
  await trade({ date: '2026-06-02', type: 'buy_aud', aud: 50, rate: 120000, amount_toman: 5400000,
    payer_account_id: null, receiver_account_id: AUD, fee_aud: 5 });
  const snapshot = await valuationParity();
  assert.equal(snapshot.audInventory, 1250);
  assert.equal(snapshot.wac, 100800);
  assert.equal(snapshot.realizedTradingProfit, 0);
  assert.equal(snapshot.operatingProfit, 600000);
  const report = await one('SELECT sum(transaction_count) AS count,sum(buy_volume) AS buys,sum(sell_volume) AS sells FROM reports_daily');
  assert.equal(Number(report.count), 1);
  assert.equal(Number(report.buys), 50);
  assert.equal(Number(report.sells), 0);
});
