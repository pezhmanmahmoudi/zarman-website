const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const output = { exports: {} };
const source = fs.readFileSync(require('node:path').join(__dirname, '../lib/owner-funding.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInThisContext(`(function(module,exports){${code}\n})`)(output, output.exports);
const { validateOwnerFunding, ownerFundingInput, changesLinkedOwnerFunding, changesOwnerFundingSettlement } = output.exports;
const funding = { date: '2026-06-01', currency: 'AUD', amount: 200, exchange_rate: 100000,
  account_id: 'synthetic-account', loan_type: 'injection', funding_type: 'equity', repayment_status: 'open' };

test('capital requires a historical rate, including IRT capital', () => {
  assert.equal(validateOwnerFunding(funding), null);
  assert.ok(validateOwnerFunding({ ...funding, currency: 'IRT', exchange_rate: 0 }));
  assert.ok(validateOwnerFunding({ ...funding, amount: NaN }));
  assert.ok(validateOwnerFunding({ ...funding, cash_effect: 'false' }));
});

test('linked cash cannot be posted a second time', () => {
  assert.ok(validateOwnerFunding({ ...funding, linked_ledger_id: 'cash-evidence' }));
  assert.equal(validateOwnerFunding({ ...funding, linked_ledger_id: 'cash-evidence', cash_effect: false }), null);
  assert.ok(validateOwnerFunding({ ...funding, settlement_currency: 'IRT' }));
});

test('notes-only updates preserve linked equity and reject changes to principal', () => {
  const before = { ...funding, cash_effect: false, linked_ledger_id: 'cash-evidence' };
  assert.equal(changesLinkedOwnerFunding(before, { ...funding, funding_type: undefined, notes: 'Clarified evidence' }), false);
  assert.equal(changesLinkedOwnerFunding(before, { ...funding, amount: 201 }), true);
  assert.equal(changesLinkedOwnerFunding(before, { ...funding, funding_type: 'loan' }), true);
});

test('ordinary editing cannot silently change cash settlement metadata', () => {
  assert.equal(changesOwnerFundingSettlement(funding, { ...funding, cash_effect: true }), false);
  assert.equal(changesOwnerFundingSettlement(funding, { ...funding, cash_effect: false }), true);
  assert.equal(changesOwnerFundingSettlement(funding, { ...funding, settlement_currency: 'IRT', settlement_amount: 20000000 }), true);
  assert.equal(changesOwnerFundingSettlement({ ...funding, settlement_amount: '20000000' }, { ...funding, settlement_amount: 20000000 }), false);
});

test('database mapping retains historical timing and settlement and defaults legacy funding to loans', () => {
  const before = { ...funding, id: 'funding-id', cash_effect: false, settlement_currency: 'IRT', settlement_amount: '20000000', created_at: '2026-06-01T01:00:00Z' };
  const mapped = ownerFundingInput(before);
  assert.equal(mapped.funding_type, 'equity');
  assert.equal(mapped.cash_effect, false);
  assert.equal(mapped.settlement_amount, 20000000);
  assert.equal(mapped.created_at, before.created_at);
  assert.equal(ownerFundingInput({ ...funding, funding_type: undefined }).funding_type, 'loan');
});
