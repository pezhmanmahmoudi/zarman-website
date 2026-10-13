const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const output = { exports: {} };
const code = ts.transpileModule(readFileSync('lib/financial-reads.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInThisContext(`(function(module,exports){${code}\n})`)(output, output.exports);
const { readAllFinancialRows } = output.exports;

test('financial pagination reads past 1000 records with a lower server page limit', async () => {
  const rows = Array.from({ length: 1207 }, (_, i) => ({ id: `row-${i}`, amount: i + 1 }));
  const ranges = [];
  const result = await readAllFinancialRows(async (from, to) => {
    ranges.push([from, to]);
    return { data: rows.slice(from, Math.min(to + 1, from + 73)), error: null };
  });
  assert.equal(result.error, null);
  assert.deepEqual(result.data, rows);
  assert.equal(result.data.reduce((sum, row) => sum + row.amount, 0), 729028);
  assert.equal(ranges[1][0], 73);
  assert.equal(ranges.at(-1)[0], 1207);
});

test('a failed later page discards partial data and preserves the original error code', async () => {
  const problem = { code: 'PGRST202', message: 'Synthetic unavailable source' };
  const result = await readAllFinancialRows(async from => from === 0
    ? { data: [{ id: 'first', amount: 1000 }], error: null }
    : { data: null, error: problem });
  assert.equal(result.data, null);
  assert.equal(result.error, problem);
});

test('overlapping or missing record identities cannot silently duplicate financial totals', async () => {
  let calls = 0;
  const overlap = await readAllFinancialRows(async () => {
    calls++;
    return { data: [{ id: 'same' }], error: null };
  });
  assert.equal(calls, 2);
  assert.equal(overlap.data, null);
  assert.equal(overlap.error.code, 'FINANCIAL_READ_OVERLAP');
  const missing = await readAllFinancialRows(async () => ({ data: [{ amount: 10 }], error: null }));
  assert.equal(missing.data, null);
  assert.equal(missing.error.code, 'FINANCIAL_READ_OVERLAP');
});

test('fee earnings paginate on request identity and an empty source is valid zero data', async () => {
  const rows = [{ request_id: 'one' }, { request_id: 'two' }];
  const result = await readAllFinancialRows(async (from, to) => ({ data: rows.slice(from, to + 1), error: null }), 'request_id', 1);
  assert.deepEqual(result.data, rows);
  const empty = await readAllFinancialRows(async () => ({ data: [], error: null }));
  assert.deepEqual(empty, { data: [], error: null });
  const unreadable = await readAllFinancialRows(async () => ({ data: null, error: null }));
  assert.equal(unreadable.error.code, 'FINANCIAL_READ_INCOMPLETE');
});
