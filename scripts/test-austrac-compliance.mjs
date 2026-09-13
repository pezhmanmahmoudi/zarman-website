// Offline regression coverage for the AUSTRAC compliance DB helpers, using an
// in-memory fake Supabase client (no network, credentials, or real database).
// Run: node --test scripts/test-austrac-compliance.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";

const projectRoot = new URL("../", import.meta.url);
const read = (file) => readFileSync(new URL(file, projectRoot), "utf8");

function compile(file, mocks = {}) {
  const js = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const compiledModule = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${js}\n})`, {
    filename: fileURLToPath(new URL(file, projectRoot)),
  })((id) => {
    if (id in mocks) return mocks[id];
    throw new Error(`Unexpected dependency: ${id}`);
  }, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}

const deadlines = compile("lib/reporting/austrac-deadlines.ts");
const helpers = compile("lib/reporting/austrac-compliance.ts", {
  "@/lib/reporting/austrac-deadlines": deadlines,
});

// Minimal in-memory fake mirroring the small subset of the Supabase
// query-builder surface that lib/reporting/austrac-compliance.ts uses.
class FakeQuery {
  constructor(table) { this.table = table; this.predicates = []; }
  select() { if (!this.mode) this.mode = "select"; return this; }
  insert(payload) { this.mode = "insert"; this.payload = payload; return this; }
  update(patch) { this.mode = "update"; this.patch = patch; return this; }
  eq(field, value) { this.predicates.push((row) => row[field] === value); return this; }
  is(field, value) { this.predicates.push((row) => (row[field] ?? null) === value); return this; }
  in(field, values) { this.predicates.push((row) => values.includes(row[field])); return this; }
  order(field, { ascending }) { this.orderField = field; this.ascending = ascending; return this; }
  limit(n) { this.limitN = n; return this; }
  maybeSingle() { this.single = "maybe"; return this; }
  single() { this.single = "strict"; return this; }
  then(resolve, reject) {
    return Promise.resolve(this.execute()).then(resolve, reject);
  }
  execute() {
    if (this.mode === "insert") {
      const row = { id: `row-${this.table.length}-${Math.random().toString(36).slice(2, 8)}`, ...this.payload };
      this.table.push(row);
      return { data: this.single ? row : [row], error: null };
    }
    if (this.mode === "update") {
      const matches = this.table.filter((row) => this.predicates.every((p) => p(row)));
      matches.forEach((row) => Object.assign(row, this.patch));
      return { data: matches, error: null };
    }
    let rows = this.table.filter((row) => this.predicates.every((p) => p(row)));
    if (this.orderField) {
      rows = [...rows].sort((a, b) => {
        const cmp = String(a[this.orderField]).localeCompare(String(b[this.orderField]));
        return this.ascending ? cmp : -cmp;
      });
    }
    if (this.limitN != null) rows = rows.slice(0, this.limitN);
    if (this.single === "maybe") return { data: rows[0] ?? null, error: null };
    if (this.single === "strict") return { data: rows[0] ?? null, error: rows[0] ? null : { message: "no rows found" } };
    return { data: rows, error: null };
  }
}

function makeFakeDb(seed = {}) {
  const store = { transactions: [], austrac_report_batches: [], ...seed };
  return { from: (table) => new FakeQuery(store[table] ??= []), store };
}

test("pending queue returns only approved, correctly-typed, unreported rows sorted by approval date", async () => {
  const db = makeFakeDb({ transactions: [
    { id: "tx-1", status: "approved", type: "buy_aud", reference_code: "ZE001", amount_aud: 500, approved_at: "2026-06-03", profiles: { first_name: "Alice", last_name: "Nguyen" } },
    { id: "tx-2", status: "approved", type: "buy_aud", reference_code: "ZE002", amount_aud: 250, approved_at: "2026-06-01", profiles: null },
    { id: "tx-3", status: "pending", type: "buy_aud", reference_code: "ZE003", amount_aud: 100, approved_at: "2026-06-01" },
    { id: "tx-4", status: "approved", type: "sell_aud", reference_code: "ZE004", amount_aud: 100, approved_at: "2026-06-01" },
    { id: "tx-5", status: "approved", type: "buy_aud", reference_code: "ZE005", amount_aud: 900, approved_at: "2026-06-01", austrac_reported_at: "2026-06-10T00:00:00Z" },
  ] });

  const queue = await helpers.getAustracPendingQueue(db, "outgoing", "2026-06-05");
  assert.deepEqual(queue.map((row) => row.id), ["tx-2", "tx-1"]);
  assert.equal(queue[0].customerName, "Unknown customer");
  assert.equal(queue[1].customerName, "Alice Nguyen");
  assert.equal(queue[0].dueDate, "2026-06-15");
  assert.equal(queue[0].daysRemaining, 6);
  assert.equal(queue[0].urgency, "ok");
  assert.equal(queue[1].dueDate, "2026-06-17");
  assert.equal(queue[1].daysRemaining, 8);
});

test("recording a batch stamps only not-yet-reported transactions and preserves the original batch of already-reported ones", async () => {
  const db = makeFakeDb({ transactions: [
    { id: "tx-1", status: "approved", type: "buy_aud", approved_at: "2026-06-01", austrac_reported_at: null, austrac_report_batch_id: null },
    { id: "tx-2", status: "approved", type: "buy_aud", approved_at: "2026-06-03", austrac_reported_at: "2026-06-10T00:00:00Z", austrac_report_batch_id: "old-batch" },
  ] });

  const result = await helpers.recordAustracReportBatch(db, {
    reportType: "outgoing",
    transactionIds: ["tx-1", "tx-2"],
    referenceDates: ["2026-06-01", "2026-06-03"],
    fileName: "AML.Report.AustracOutgoing 2026-06-01 to 2026-06-03.xlsx",
    submittedById: "admin-1",
    submittedByEmail: "admin@example.invalid",
  });

  assert.equal(result.updatedCount, 1);
  const [batch] = db.store.austrac_report_batches;
  assert.equal(batch.report_type, "outgoing");
  assert.equal(batch.transaction_count, 2);
  assert.equal(batch.period_start, "2026-06-01");
  assert.equal(batch.period_end, "2026-06-03");

  const tx1 = db.store.transactions.find((row) => row.id === "tx-1");
  const tx2 = db.store.transactions.find((row) => row.id === "tx-2");
  assert.equal(tx1.austrac_report_batch_id, result.batchId);
  assert.ok(tx1.austrac_reported_at);
  // Already-reported transaction keeps its original batch reference.
  assert.equal(tx2.austrac_report_batch_id, "old-batch");
  assert.equal(tx2.austrac_reported_at, "2026-06-10T00:00:00Z");
});

test("latest batch lookup ignores reverted batches", async () => {
  const db = makeFakeDb({ austrac_report_batches: [
    { id: "batch-1", report_type: "outgoing", transaction_count: 3, created_at: "2026-06-01T00:00:00Z", reverted_at: null },
    { id: "batch-2", report_type: "outgoing", transaction_count: 5, created_at: "2026-06-10T00:00:00Z", reverted_at: "2026-06-11T00:00:00Z" },
  ] });

  const latest = await helpers.getLatestAustracBatch(db, "outgoing");
  assert.equal(latest.id, "batch-1");
});

test("reverting a batch clears the transaction tracking fields and soft-deletes the batch exactly once", async () => {
  const db = makeFakeDb({
    transactions: [
      { id: "tx-1", austrac_reported_at: "2026-06-10T00:00:00Z", austrac_report_batch_id: "batch-1" },
      { id: "tx-2", austrac_reported_at: "2026-06-10T00:00:00Z", austrac_report_batch_id: "batch-1" },
      { id: "tx-3", austrac_reported_at: "2026-06-11T00:00:00Z", austrac_report_batch_id: "batch-2" },
    ],
    austrac_report_batches: [
      { id: "batch-1", reverted_at: null },
      { id: "batch-2", reverted_at: null },
    ],
  });

  await helpers.revertAustracReportBatch(db, "batch-1", "admin@example.invalid");

  const [tx1, tx2, tx3] = db.store.transactions;
  assert.equal(tx1.austrac_reported_at, null);
  assert.equal(tx1.austrac_report_batch_id, null);
  assert.equal(tx2.austrac_reported_at, null);
  assert.equal(tx3.austrac_report_batch_id, "batch-2"); // untouched

  const batch1 = db.store.austrac_report_batches.find((row) => row.id === "batch-1");
  assert.ok(batch1.reverted_at);
  assert.equal(batch1.reverted_by_email, "admin@example.invalid");

  // A second revert attempt must not overwrite the original reverted_at.
  const firstRevertedAt = batch1.reverted_at;
  await helpers.revertAustracReportBatch(db, "batch-1", "someone-else@example.invalid");
  assert.equal(batch1.reverted_at, firstRevertedAt);
  assert.equal(batch1.reverted_by_email, "admin@example.invalid");
});
