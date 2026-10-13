const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function loadTypeScript(path, imports = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInThisContext(`(function(module,exports,require){${code}\n})`, { filename: path })(module, module.exports, name => {
    assert.ok(name in imports, `Unexpected dependency ${name}`);
    return imports[name];
  });
  return module.exports;
}

const financialReads = loadTypeScript('lib/financial-reads.ts');
const ownerFunding = loadTypeScript('lib/owner-funding.ts');

function harness({ tables = {}, errors = {}, enabled = false, rpcError = null, pageLimit = 73 } = {}) {
  const captured = { calls: [], accounting: null };
  const sources = {
    rates_history: [{ buy_aud: 172000 }],
    exchange_request_settings: [{ settings: { enabled } }],
    ...tables,
  };
  const db = {
    from(table) {
      let from = 0, to = Infinity, single = false;
      const query = {
        select() { return query; },
        order() { return query; },
        eq() { return query; },
        limit(amount) { to = amount - 1; return query; },
        range(start, end) { from = start; to = end; return query; },
        maybeSingle() { single = true; return query; },
        then(resolve, reject) {
          captured.calls.push({ table, from, to });
          const error = typeof errors[table] === 'function' ? errors[table](from) : errors[table];
          const rows = (sources[table] ?? []).slice(from, Math.min(to + 1, from + pageLimit));
          return Promise.resolve({ data: error ? null : single ? rows[0] ?? null : rows, error: error ?? null }).then(resolve, reject);
        },
      };
      return query;
    },
    rpc() { return Promise.resolve({ data: rpcError ? null : 12345, error: rpcError }); },
  };
  const actions = loadTypeScript('app/actions/treasury.actions.ts', {
    '@supabase/supabase-js': { createClient: () => db },
    '@/app/actions/admin.actions': { requireAdmin: async () => ({ id: 'admin' }) },
    '@/lib/jalali': {},
    '@/lib/accounting-engine': { calcAccountingSnapshot: (...args) => { captured.accounting = args; return { drawerBalances: {} }; } },
    '@/lib/treasury-engine': { calcTreasurySnapshot: () => ({}) },
    '@/lib/strategy-engine': { generateStrategyOutput: () => ({}) },
    '@/lib/bank-account-ordering': { sortBankAccountsByPriority: rows => rows },
    '@/lib/reconciliation-engine': {},
    '@/lib/financial-reads': financialReads,
    '@/lib/owner-funding': ownerFunding,
  });
  return { ...actions, captured };
}

test('treasury reads every financial source beyond API limits and preserves funding metadata', async () => {
  const count = 1207;
  const rows = fn => Array.from({ length: count }, (_, i) => fn(i));
  const { getTreasuryFullData, captured } = harness({ tables: {
    ledger: rows(i => ({ id: `ledger-${i}`, type: 'buy', entry_type: 'trade', amount_aud: '1', amount_toman: '172000', exchange_rate: '172000', date_gregorian: '2026-10-13', request_fee_entry_id: i === 0 ? 'fee-0' : null })),
    expenses: rows(i => ({ id: `expense-${i}`, currency: 'AUD', amount: '1', status: 'paid' })),
    owner_loans: rows(i => ({ id: `funding-${i}`, currency: 'AUD', amount: '1', loan_type: 'repayment', funding_type: 'equity', cash_effect: false, settlement_currency: 'IRT', settlement_amount: '172000', account_id: 'bank', date: '2026-10-13' })),
    bank_accounts: [{ id: 'bank', currency: 'AUD', account_type: 'bank', account_name: 'Bank', is_active: true }],
    bank_fee_monthly_postings: rows(i => ({ id: `posting-${i}`, expense_id: `expense-${i}`, fee_month: '2026-10-01' })),
    exchange_request_fee_entries: Array.from({ length: 1101 }, (_, i) => ({ id: `fee-${i}`, request_id: `request-${i}`, kind: 'collected', currency: 'AUD', amount: '1' })),
    exchange_request_fee_earnings: Array.from({ length: 1001 }, (_, i) => ({ request_id: `request-${i}` })),
  } });
  const result = await getTreasuryFullData();
  assert.equal(captured.accounting[0].length, count);
  assert.equal(captured.accounting[1].length, count);
  assert.equal(captured.accounting[2].length, count);
  assert.equal(captured.accounting[2].at(-1).funding_type, 'equity');
  assert.equal(captured.accounting[2].at(-1).cash_effect, false);
  assert.equal(captured.accounting[2].at(-1).settlement_amount, 172000);
  assert.equal(captured.accounting[5], 12345);
  assert.equal(captured.accounting[6], 100 * 172000);
  assert.equal(result.ownerLoans.length, count);
  assert.equal(result.expenses.at(-1).bank_fee_month, '2026-10-01');
});

test('fee source failures stop reporting even without fee ledger evidence, including later pages', async () => {
  for (const table of ['exchange_request_fee_entries', 'exchange_request_fee_earnings']) {
    const { getTreasuryFullData, captured } = harness({ errors: { [table]: { code: '42501', message: 'Denied' } } });
    await assert.rejects(getTreasuryFullData());
    assert.equal(captured.accounting, null);
  }
  const { getTreasuryFullData, captured } = harness({
    tables: { exchange_request_fee_entries: [{ id: 'fee', request_id: 'request', kind: 'collected', amount: 1, currency: 'AUD' }] },
    errors: { exchange_request_fee_entries: from => from > 0 ? { code: '57014', message: 'Timed out' } : null },
  });
  await assert.rejects(getTreasuryFullData());
  assert.equal(captured.accounting, null);
});

test('missing fee sources are tolerated only for a disabled unused workflow', async () => {
  const missing = { code: 'PGRST205', message: 'Missing relation' };
  const errors = { exchange_request_fee_entries: missing, exchange_request_fee_earnings: missing };
  const disabled = harness({ errors, rpcError: { code: 'PGRST202', message: 'Missing function' } });
  await disabled.getTreasuryFullData();
  assert.equal(disabled.captured.accounting[6], 0);
  assert.equal(disabled.captured.calls.filter(call => call.table === 'exchange_request_settings').length, 1);
  await assert.rejects(harness({ errors, enabled: true }).getTreasuryFullData());
  await assert.rejects(harness({ errors, tables: { ledger: [{ id: 'ledger', request_fee_entry_id: 'fee' }] } }).getTreasuryFullData());
  await assert.rejects(harness({ errors: { ...errors, exchange_request_settings: { code: '42501', message: 'Denied' } } }).getTreasuryFullData());
});
