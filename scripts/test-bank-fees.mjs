// Run: node --test scripts/test-bank-fees.mjs
// Executes the real migrations in ephemeral PostgreSQL (PGlite). No env files,
// Supabase clients, connection strings, network calls or production data.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { after, before, beforeEach, describe, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import ts from 'typescript';

const projectRoot = new URL('../', import.meta.url);
const read = (file) => readFileSync(new URL(file, projectRoot), 'utf8');
const compiled = { exports: {} };
const helperJs = ts.transpileModule(read('lib/bank-fee-posting.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInThisContext(`(function(module,exports){${helperJs}\n})`, {
  filename: fileURLToPath(new URL('lib/bank-fee-posting.ts', projectRoot)),
})(compiled, compiled.exports);
const helpers = compiled.exports;

const ADMIN = '00000000-0000-4000-8000-000000000001';
const CUSTOMER = '00000000-0000-4000-8000-000000000002';
const ACCOUNT_A = '10000000-0000-4000-8000-000000000001';
const ACCOUNT_B = '10000000-0000-4000-8000-000000000002';
const ACCOUNT_AUD = '10000000-0000-4000-8000-000000000003';
const MONTH = '2026-07-01';
const EMAIL = 'admin@example.invalid';
let db;

describe('bank-fee input validation', () => {
  test('parses Persian and Arabic bank amounts, including fractional toman and zero', () => {
    assert.equal(helpers.parseBankFeeAmount('۴۵۲٬۴۶۷٫۵۰'), 452467.5);
    assert.equal(helpers.parseBankFeeAmount('١٢٬٣٤٥٫٦٧'), 12345.67);
    assert.equal(helpers.parseBankFeeAmount('\u200f 1,234.50 '), 1234.5);
    assert.equal(helpers.parseBankFeeAmount('۰'), 0);
    for (const value of ['', '-1', 'NaN', 'Infinity', '1e3', '12.345', '12x', '1.2.3']) {
      assert.equal(helpers.parseBankFeeAmount(value), null, value);
    }
  });

  test('validates month boundaries, current-month posting, totals and review tokens', () => {
    const now = new Date('2026-01-15T12:00:00Z');
    assert.equal(helpers.defaultBankFeeMonth(now), '2025-12');
    assert.equal(helpers.currentBankFeeMonth(now), '2026-01');
    const entry = {
      accountId: ACCOUNT_A, actualAmountToman: 0, notes: '', expectedVersion: 0,
      expectedPendingFingerprint: 'd41d8cd98f00b204e9800998ecf8427e',
    };
    const valid = { feeMonth: '2026-01', entries: [entry] };
    assert.equal(helpers.bankFeePostInputError(valid, now), null);
    for (const feeMonth of ['2026-02', '2026-13', '0000-01', '2026-1', '']) {
      assert.ok(helpers.bankFeePostInputError({ ...valid, feeMonth }, now));
    }
    for (const actualAmountToman of [-1, 0.001, Infinity, NaN, '10', helpers.MAX_BANK_FEE_TOMAN + 1]) {
      assert.ok(helpers.bankFeePostInputError({ ...valid, entries: [{ ...entry, actualAmountToman }] }, now));
    }
    for (const entries of [[], [entry, entry], [{ ...entry, expectedVersion: -1 }],
      [{ ...entry, expectedPendingFingerprint: '' }], [{ ...entry, accountId: 'bad' }],
      [{ ...entry, notes: 'x'.repeat(2001) }]]) {
      assert.ok(helpers.bankFeePostInputError({ ...valid, entries }, now));
    }
  });
});

async function scalar(sql, parameters = [], connection = db) {
  return Object.values((await connection.query(sql, parameters)).rows[0])[0];
}

async function asRole(role, callback) {
  assert.ok(['anon', 'authenticated', 'service_role'].includes(role));
  return db.transaction(async (tx) => {
    await tx.exec(`SET LOCAL ROLE ${role}`);
    return callback(tx);
  });
}

async function review(month = MONTH, role = 'service_role') {
  return asRole(role, (tx) => scalar('SELECT public.get_monthly_bank_fee_review($1::date)', [month], tx));
}

function entry(row, amount, overrides = {}) {
  return {
    account_id: row.account_id,
    actual_amount_toman: amount,
    notes: 'Synthetic statement review',
    expected_version: row.posting_version,
    expected_pending_fingerprint: row.pending_fingerprint,
    ...overrides,
  };
}

async function post(entries, { month = MONTH, actor = ADMIN, email = EMAIL, role = 'service_role' } = {}) {
  return asRole(role, (tx) => scalar(
    'SELECT public.post_monthly_bank_fee_review($1::date, $2::jsonb, $3::uuid, $4::text)',
    [month, JSON.stringify(entries), actor, email], tx,
  ));
}

async function accountReview(account = ACCOUNT_A, month = MONTH) {
  const row = (await review(month)).accounts.find((value) => value.account_id === account);
  assert.ok(row, 'Expected the synthetic toman account in review');
  return row;
}

async function accrue(account = ACCOUNT_A, amount = 100, month = MONTH) {
  const transactionId = await scalar('INSERT INTO transactions DEFAULT VALUES RETURNING id');
  return scalar(`INSERT INTO bank_transfer_fee_accruals
    (transaction_id, fee_month, transfer_method, transaction_amount_toman, fee_amount_toman, payer_account_id)
    VALUES ($1, $2, 'paya', 1000000, $3, $4) RETURNING id`, [transactionId, month, amount, account]);
}

async function cash(account = ACCOUNT_A) {
  return Number(await scalar(`SELECT opening_balance + COALESCE((
    SELECT sum(delta) FROM test_cash_journal WHERE account_id = bank_accounts.id
  ), 0) FROM bank_accounts WHERE id = $1`, [account]));
}

async function counts() {
  return (await db.query(`SELECT
    (SELECT count(*)::int FROM expenses) AS expenses,
    (SELECT count(*)::int FROM bank_fee_monthly_postings) AS postings,
    (SELECT count(*)::int FROM audit_logs) AS audits,
    (SELECT count(*)::int FROM test_cash_journal) AS cash_movements,
    (SELECT count(*)::int FROM bank_transfer_fee_accruals WHERE status = 'posted') AS posted_accruals`)).rows[0];
}

async function rejectSql(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, code, `Unexpected PostgreSQL error: ${error.message}`);
    return true;
  });
}

describe('monthly bank-fee PostgreSQL transactions', { concurrency: false }, () => {
  before(async () => {
    db = new PGlite(); // No dataDir: this database exists only in process memory.
    await db.exec(read('scripts/fixtures/bank-fees.sql'));
    await db.exec(read('supabase/migrations/20260803_16_bank_transfer_fee_accruals.sql'));
    await db.exec(read('supabase/migrations/20260910_17_editable_bank_fees.sql'));
    await db.query(`INSERT INTO auth.users (id, email, raw_app_meta_data) VALUES
      ($1, $2, '{"role":"admin"}'), ($3, 'customer@example.invalid', '{"role":"customer"}')`,
    [ADMIN, EMAIL, CUSTOMER]);

    // A deterministic interleaving after the posting captures pending IDs.
    // PGlite has one connection; this checks snapshot membership, not lock races.
    await db.exec(`CREATE FUNCTION test_late_accrual() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE transaction_id uuid;
    BEGIN
      IF current_setting('test.inject_late_accrual', true) = 'on' THEN
        PERFORM set_config('test.inject_late_accrual', 'off', false);
        INSERT INTO transactions DEFAULT VALUES RETURNING id INTO transaction_id;
        INSERT INTO bank_transfer_fee_accruals
          (transaction_id, fee_month, transfer_method, transaction_amount_toman, fee_amount_toman, payer_account_id)
        VALUES (transaction_id, date_trunc('month', NEW.date)::date, 'paya', 1000000, 37, NEW.payer_account_id);
      END IF;
      RETURN NULL;
    END; $$;
    CREATE TRIGGER test_late_accrual AFTER INSERT ON expenses
      FOR EACH ROW EXECUTE FUNCTION test_late_accrual();`);
  });

  after(async () => { await db?.close(); });

  beforeEach(async () => {
    await db.exec(`RESET ROLE;
      SELECT set_config('test.reject_audit', 'off', false);
      SELECT set_config('test.reject_refresh', 'off', false);
      SELECT set_config('test.inject_late_accrual', 'off', false);
      SELECT set_config('app.bank_fee_monthly_posting', '', false);
      TRUNCATE bank_accounts, transactions, audit_logs, test_cash_journal, test_report_refreshes CASCADE;`);
    await db.query(`INSERT INTO bank_accounts (id, account_name, currency) VALUES
      ($1, 'Synthetic Bank A', 'IRT'), ($2, 'Synthetic Bank B', 'IRT'), ($3, 'Synthetic AUD', 'AUD')`,
    [ACCOUNT_A, ACCOUNT_B, ACCOUNT_AUD]);
  });

  test('posts the edited statement total once and preserves estimates in its audit', async () => {
    const ids = [await accrue(ACCOUNT_A, 100), await accrue(ACCOUNT_A, 50)];
    await accrue(ACCOUNT_B, 80);
    const row = await accountReview();
    assert.equal(row.estimated_total_toman, 150);
    assert.equal(row.pending_count, 2);
    const payload = [entry(row, 183.25)];
    assert.deepEqual(await post(payload), { posted_count: 1 });
    assert.equal(await cash(), 999816.75);
    assert.equal(await cash(ACCOUNT_B), 1000000);
    assert.deepEqual(await counts(), { expenses: 1, postings: 1, audits: 1, cash_movements: 1, posted_accruals: 2 });
    const expense = (await db.query('SELECT * FROM expenses')).rows[0];
    assert.equal(Number(expense.amount), 183.25);
    assert.equal(expense.status, 'paid');
    assert.equal(expense.currency, 'IRT');
    assert.equal(expense.category, 'bank_fees');
    assert.equal(expense.payer_account_id, ACCOUNT_A);
    const audit = (await db.query('SELECT * FROM audit_logs')).rows[0];
    assert.equal(audit.actor_id, ADMIN);
    assert.equal(audit.actor_email, EMAIL);
    assert.deepEqual(audit.new_value.reviewed_pending_ids.sort(), ids.sort());
    assert.equal(audit.new_value.reviewed_pending_total_toman, 150);
    assert.equal(audit.new_value.posting.actual_amount_toman, 183.25);
    await rejectSql(post(payload), '40001');
    assert.equal(await cash(), 999816.75, 'Replaying a stale form must never debit cash again');
    assert.equal((await counts()).expenses, 1);
  });

  test('editing the same account/month replaces its total on the same expense', async () => {
    await accrue();
    await post([entry(await accountReview(), 175)]);
    const first = await accountReview();
    await post([entry(first, 230)]);
    const second = await accountReview();
    assert.equal(second.expense_id, first.expense_id);
    assert.equal(second.posted_total_toman, 230);
    assert.equal(second.posting_version, 2);
    assert.equal(await cash(), 999770);
    assert.equal((await counts()).expenses, 1);
    assert.deepEqual((await db.query('SELECT delta::float8 AS delta FROM test_cash_journal ORDER BY id')).rows,
      [{ delta: -175 }, { delta: -55 }]);
    const audit = (await db.query('SELECT old_value, new_value FROM audit_logs ORDER BY id DESC LIMIT 1')).rows[0];
    assert.equal(audit.old_value.posting.actual_amount_toman, 175);
    assert.equal(audit.new_value.posting.actual_amount_toman, 230);
  });

  test('a stale second account rolls back the entire multi-account batch', async () => {
    await accrue(ACCOUNT_A, 100);
    await accrue(ACCOUNT_B, 200);
    const a = await accountReview(ACCOUNT_A);
    const b = await accountReview(ACCOUNT_B);
    await post([entry(b, 225)]);
    const before = await counts();
    await rejectSql(post([entry(a, 150), entry(b, 250)]), '40001');
    assert.deepEqual(await counts(), before, 'Earlier account expense, accrual and audit must roll back');
    assert.equal(await cash(ACCOUNT_A), 1000000);
    assert.equal(await cash(ACCOUNT_B), 999775);
    assert.equal((await accountReview(ACCOUNT_A)).posting_version, 0);
    assert.equal((await accountReview(ACCOUNT_A)).pending_count, 1);
  });

  test('new or edited accruals invalidate an older review even when its posting version is unchanged', async () => {
    const id = await accrue();
    let row = await accountReview();
    await accrue(ACCOUNT_A, 25);
    await rejectSql(post([entry(row, 100)]), '40001');
    row = await accountReview();
    await db.query('UPDATE bank_transfer_fee_accruals SET fee_amount_toman = 101 WHERE id = $1', [id]);
    await rejectSql(post([entry(row, 125)]), '40001');
    assert.deepEqual(await counts(), { expenses: 0, postings: 0, audits: 0, cash_movements: 0, posted_accruals: 0 });
  });

  test('a stale second-account fingerprint rolls back an earlier expense edit', async () => {
    await post([entry(await accountReview(), 100)]);
    await accrue(ACCOUNT_B, 200);
    const a = await accountReview();
    const b = await accountReview(ACCOUNT_B);
    await accrue(ACCOUNT_B, 25);
    const before = await counts();
    await rejectSql(post([entry(a, 150), entry(b, 200)]), '40001');
    assert.deepEqual(await counts(), before);
    assert.equal(await cash(), 999900);
    assert.equal((await accountReview()).posted_total_toman, 100);
    assert.equal((await accountReview()).posting_version, a.posting_version);
    assert.equal((await accountReview(ACCOUNT_B)).pending_count, 2);
  });

  test('only captured pending IDs are consumed, and a later review replaces the complete monthly total', async () => {
    const original = await accrue(ACCOUNT_A, 100);
    const row = await accountReview();
    await db.exec("SELECT set_config('test.inject_late_accrual', 'on', false)");
    await post([entry(row, 120)]);
    const fees = (await db.query('SELECT id, status FROM bank_transfer_fee_accruals ORDER BY created_at, id')).rows;
    assert.equal(fees.find((fee) => fee.id === original).status, 'posted');
    assert.equal(fees.find((fee) => fee.id !== original).status, 'accrued');
    const next = await accountReview();
    assert.equal(next.pending_count, 1);
    assert.equal(next.pending_total_toman, 37);
    assert.equal(next.posted_total_toman, 120);
    await post([entry(next, 160)]);
    assert.equal(await cash(), 999840, '160 is the new whole-month total, not an additional charge');
    assert.equal((await counts()).expenses, 1);
    assert.equal((await accountReview()).pending_count, 0);
  });

  test('zero is a valid actual total; editing a paid month to zero reverses its cash effect', async () => {
    await accrue();
    await post([entry(await accountReview(), 0)]);
    let row = await accountReview();
    assert.equal(row.posted_total_toman, 0);
    assert.equal(row.expense_id, null);
    assert.equal(row.pending_count, 0);
    assert.equal(await cash(), 1000000);
    assert.equal((await counts()).expenses, 0);
    await post([entry(row, 90)]);
    assert.equal(await cash(), 999910);
    row = await accountReview();
    await post([entry(row, 0)]);
    assert.equal(await cash(), 1000000);
    assert.equal((await counts()).expenses, 0);
    assert.equal((await accountReview()).posted_total_toman, 0);
  });

  test('an audit failure rolls back the expense, posting, accrual status and cash together', async () => {
    await accrue();
    const row = await accountReview();
    await db.exec("SELECT set_config('test.reject_audit', 'on', false)");
    await rejectSql(post([entry(row, 175)]), '23514');
    assert.deepEqual(await counts(), { expenses: 0, postings: 0, audits: 0, cash_movements: 0, posted_accruals: 0 });
    assert.equal(await cash(), 1000000);
  });

  test('report-refresh failure rolls back the complete posting and its audit', async () => {
    await accrue();
    const row = await accountReview();
    await db.exec("SELECT set_config('test.reject_refresh', 'on', false)");
    await rejectSql(post([entry(row, 175)]), '23514');
    assert.deepEqual(await counts(), { expenses: 0, postings: 0, audits: 0, cash_movements: 0, posted_accruals: 0 });
    assert.equal(await scalar('SELECT count(*)::int FROM test_report_refreshes'), 0);
    assert.equal(await cash(), 1000000);
  });

  test('ordinary expense editing/deletion cannot bypass monthly review; manual expenses remain editable', async () => {
    await post([entry(await accountReview(), 175)]);
    const row = await accountReview();
    await rejectSql(db.query('UPDATE expenses SET amount = 99 WHERE id = $1', [row.expense_id]), '42501');
    await rejectSql(db.query('DELETE FROM expenses WHERE id = $1', [row.expense_id]), '42501');
    assert.equal(await cash(), 999825);
    const manualId = await scalar(`INSERT INTO expenses
      (date, title, category, currency, amount, payer_account_id, status)
      VALUES ($1, 'Synthetic manual fee', 'bank_fees', 'IRT', 7, $2, 'paid') RETURNING id`, [MONTH, ACCOUNT_A]);
    assert.equal((await accountReview()).other_paid_fees_toman, 7);
    await db.query('UPDATE expenses SET amount = 9 WHERE id = $1', [manualId]);
    assert.equal((await accountReview()).other_paid_fees_toman, 9);
    await db.query('DELETE FROM expenses WHERE id = $1', [manualId]);
    assert.equal(await cash(), 999825);
  });

  test('only service role can call RPCs and only a verified admin can be recorded as actor', async () => {
    const payload = [entry(await accountReview(), 100)];
    for (const role of ['anon', 'authenticated']) {
      await rejectSql(review(MONTH, role), '42501');
      await rejectSql(post(payload, { role }), '42501');
      await rejectSql(asRole(role, (tx) => tx.query('SELECT * FROM bank_fee_monthly_postings')), '42501');
      await rejectSql(asRole(role, (tx) => tx.query('SELECT * FROM bank_transfer_fee_accruals')), '42501');
    }
    await rejectSql(post(payload, { actor: CUSTOMER, email: 'customer@example.invalid' }), '42501');
    await rejectSql(post(payload, { email: 'someone-else@example.invalid' }), '42501');
    await rejectSql(post(payload, { actor: null }), '42501');
    assert.equal((await counts()).expenses, 0);
    await post(payload, { email: EMAIL.toUpperCase() });
    assert.equal(await scalar('SELECT actor_email FROM audit_logs'), EMAIL);
  });

  test('blocks legacy posting and unreconciled historical posted accruals', async () => {
    await rejectSql(asRole('service_role', (tx) => tx.query('SELECT * FROM post_monthly_bank_transfer_fees($1)', [MONTH])), '22023');
    const id = await accrue();
    const row = await accountReview();
    await db.query("UPDATE bank_transfer_fee_accruals SET status = 'posted', posted_at = now() WHERE id = $1", [id]);
    await rejectSql(review(), '22023');
    await rejectSql(post([entry(row, 100)]), '22023');
    assert.equal((await counts()).expenses, 0);
  });

  test('validates SQL callers and keeps successful multi-account postings separate', async () => {
    const a = await accountReview();
    const b = await accountReview(ACCOUNT_B);
    for (const entries of [[], [entry(a, 1), entry(a, 2)], [entry(a, -1)], [entry(a, 1.001)],
      [entry(a, '1')], [entry(a, 1, { account_id: ACCOUNT_AUD })],
      [entry(a, 1, { notes: 'x'.repeat(2001) })], [entry(a, 1, { expected_version: 0.5 })]]) {
      await rejectSql(post(entries), '22023');
    }
    assert.equal((await counts()).expenses, 0);
    assert.deepEqual(await post([entry(b, 20), entry(a, 10)]), { posted_count: 2 });
    assert.equal(await cash(ACCOUNT_A), 999990);
    assert.equal(await cash(ACCOUNT_B), 999980);
    assert.equal((await counts()).expenses, 2);
    assert.equal(await scalar('SELECT count(*)::int FROM test_report_refreshes'), 1,
      'Refresh reports once after the complete batch');
  });

  test('current-month posting is dated today and a future month cannot post', async () => {
    const { today, month, future } = (await db.query(`SELECT current_date::text AS today,
      date_trunc('month', current_date)::date::text AS month,
      (date_trunc('month', current_date) + interval '1 month')::date::text AS future`)).rows[0];
    await post([entry(await accountReview(ACCOUNT_A, month), 15)], { month });
    assert.equal(await scalar('SELECT date::text FROM expenses'), today);
    await rejectSql(review(future), '22023');
    await rejectSql(post([entry(await accountReview(), 20)], { month: future }), '22023');
    assert.equal((await counts()).expenses, 1);
  });
});
