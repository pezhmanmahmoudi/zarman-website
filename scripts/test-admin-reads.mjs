// Offline regression coverage for admin reads. No credentials, network or writes.
// Run: node --test scripts/test-admin-reads.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../app/actions/admin.actions.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function setup({ tables = {}, role = "admin", fail = () => false, apiLimit = 1_000 } = {}) {
  const calls = [];
  let authChecks = 0;
  let serviceClients = 0;

  class ReadQuery {
    constructor(table) {
      this.table = table;
      this.predicates = [];
      this.orders = [];
      this.options = {};
    }
    select(_columns, options = {}) { this.options = options; return this; }
    eq(field, value) { this.predicates.push((row) => row[field] === value); return this; }
    in(field, values) { this.predicates.push((row) => values.includes(row[field])); return this; }
    gte(field, value) { this.predicates.push((row) => row[field] >= value); return this; }
    lte(field, value) { this.predicates.push((row) => row[field] <= value); return this; }
    or(expression) {
      const conditions = expression.split(",").map((part) => {
        const [, field, operator, value] = part.match(/^([a-z_]+)\.(eq|is|ilike)\.(.*)$/);
        if (operator === "is") return (row) => row[field] == null;
        if (operator === "ilike") return (row) => String(row[field] ?? "").toLowerCase().includes(value.replaceAll("%", "").toLowerCase());
        return (row) => row[field] === value;
      });
      this.predicates.push((row) => conditions.some((condition) => condition(row)));
      return this;
    }
    order(field, { ascending }) { this.orders.push({ field, ascending }); return this; }
    range(start, end) { this.window = [start, end]; return this; }
    limit(limit) { this.window = [0, limit - 1]; return this; }
    then(resolve, reject) {
      calls.push(this);
      if (fail(this)) return Promise.resolve({ data: null, count: null, error: { message: "Synthetic read failure" } }).then(resolve, reject);
      const filtered = (tables[this.table] ?? []).filter((row) => this.predicates.every((predicate) => predicate(row)));
      filtered.sort((a, b) => {
        for (const { field, ascending } of this.orders) {
          const comparison = String(a[field]).localeCompare(String(b[field]));
          if (comparison) return ascending ? comparison : -comparison;
        }
        return 0;
      });
      const [start, end] = this.window ?? [0, apiLimit - 1];
      return Promise.resolve({
        data: this.options.head ? null : filtered.slice(start, Math.min(end + 1, start + apiLimit)),
        count: this.options.count === "exact" ? filtered.length : null,
        error: null,
      }).then(resolve, reject);
    }
  }

  const db = {
    from: (table) => new ReadQuery(table),
    auth: { getUser: async () => {
      authChecks++;
      return { data: { user: role ? { id: "offline-admin", app_metadata: { role } } : null }, error: null };
    } },
  };
  const compiledModule = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports,process){${compiled}\n})`)(
    (name) => {
      if (name === "@supabase/supabase-js") return { createClient: () => { serviceClients++; return db; } };
      if (name === "@/lib/supabase-server") return { createSupabaseServerActionClient: async () => db };
      // Direct action calls do not run in a React Server Component cache scope.
      if (name === "react") return { cache: (fn) => fn };
      if (["next/cache", "@/lib/rates", "@/lib/pricing", "@/lib/iran-bank-transfer-fees"].includes(name)) return {};
      throw new Error(`Unexpected dependency: ${name}`);
    },
    compiledModule,
    compiledModule.exports,
    { env: {} },
  );
  return { actions: compiledModule.exports, calls, get authChecks() { return authChecks; }, get serviceClients() { return serviceClients; } };
}

const ledgerRows = (length) => Array.from({ length }, (_, index) => ({
  id: String(index).padStart(6, "0"),
  date_gregorian: "2026-09-01",
  created_at: "2026-09-01T12:00:00Z",
  type: "buy_aud",
  entry_type: "trade",
  sender: "Alice",
  recipient: "Bob",
  payer_account_id: "account-a",
  receiver_account_id: "account-b",
}));

test("navigation reads only pending queues and verifies capability without counting audit history", async () => {
  const context = setup({ tables: {
    profiles: [{ kyc_status: "pending" }, { kyc_status: "under_review" }, { kyc_status: "approved" }],
    transactions: [{ status: "pending" }, { status: "approved" }],
    testimonials: [{ status: "pending" }, { status: "rejected" }],
  } });
  const result = await context.actions.getAdminNavigationCounts();
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { pendingKycCount: 2, pendingTxCount: 1, pendingFeedbackCount: 1 });
  assert.equal(context.calls.length, 4);
  assert.equal(context.calls[0].table, "audit_logs");
  assert.equal(context.calls[0].options.count, undefined);
  assert.equal(context.serviceClients, 0);
});

test("dashboard counters reject unavailable data instead of displaying false zeroes", async () => {
  const context = setup({ fail: (query) => query.table === "testimonials" });
  await assert.rejects(context.actions.getAdminStats(), /Synthetic read failure/);
});

test("ledger pagination returns only the visible rows and a complete filtered count", async () => {
  const context = setup({ tables: { ledger: ledgerRows(1_205) } });
  const result = await context.actions.getLedgerData(2, 20);
  assert.equal(result.pageLedgerRows.length, 20);
  assert.equal(result.pageLedgerRows[0].id, "001184");
  assert.equal(result.total, 1_205);
  assert.equal(context.calls.filter((query) => query.table === "ledger").length, 1);
  assert.equal("allLedgerRows" in result, false);
  assert.equal(context.calls.some((query) => query.table === "rates_history"), false);
});

test("CSV export covers every row beyond the API limit, including lower configured limits", async () => {
  const context = setup({ tables: { ledger: ledgerRows(1_205) }, apiLimit: 200 });
  const rows = await context.actions.getLedgerExportRows();
  assert.equal(rows.length, 1_205);
  assert.equal(new Set(rows.map((row) => row.id)).size, 1_205);
  assert.equal(rows.at(0).id, "001204");
  assert.equal(rows.at(-1).id, "000000");
  const queries = context.calls.filter((query) => query.table === "ledger");
  assert.equal(queries.length, 7);
  assert.equal(queries.filter((query) => query.options.count === "exact").length, 1);
});

test("page and export apply the same date, trade, account and sanitized search filters", async () => {
  const base = ledgerRows(1)[0];
  const context = setup({ tables: { ledger: [
    base,
    { ...base, id: "legacy-trade", entry_type: null },
    { ...base, id: "too-old", date_gregorian: "2026-08-30" },
    { ...base, id: "too-new", date_gregorian: "2026-09-30" },
    { ...base, id: "expense", entry_type: "expense" },
    { ...base, id: "other-account", payer_account_id: "account-c", receiver_account_id: "account-d" },
    { ...base, id: "other-customer", sender: "Charlie" },
  ] } });
  const filters = { start: "2026-09-01", end: "2026-09-15", type: "buy_aud", search: " %Alice% ", account: "account-a" };
  const page = await context.actions.getLedgerData(1, 20, filters);
  const exported = await context.actions.getLedgerExportRows(filters);
  assert.equal(page.total, 2);
  assert.equal(exported.length, 2);
  assert.deepEqual(Array.from(page.pageLedgerRows, (row) => row.id), Array.from(exported, (row) => row.id));
});

test("unauthenticated and non-admin requests cannot initialize a privileged ledger client", async () => {
  for (const role of [null, "customer"]) {
    for (const action of ["getLedgerData", "getLedgerExportRows", "getAdminNavigationCounts"]) {
      const context = setup({ role });
      await assert.rejects(context.actions[action](), /Unauthorized|Forbidden/);
      assert.equal(context.serviceClients, 0);
      assert.equal(context.calls.length, 0);
    }
  }
});

test("failed capability checks and failed export batches do not return partial data", async () => {
  const forbidden = setup({ fail: (query) => query.table === "audit_logs" });
  await assert.rejects(forbidden.actions.getLedgerExportRows(), /capability check failed/);
  assert.equal(forbidden.serviceClients, 0);

  const interrupted = setup({ tables: { ledger: ledgerRows(1_205) }, fail: (query) => query.table === "ledger" && query.window?.[0] > 0 });
  await assert.rejects(interrupted.actions.getLedgerExportRows(), /Synthetic read failure/);
});

test("treasury rejects unauthorized direct server-action calls before creating a privileged client", async () => {
  const treasurySource = readFileSync(new URL("../app/actions/treasury.actions.ts", import.meta.url), "utf8");
  const treasuryJs = ts.transpileModule(treasurySource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  for (const role of [null, "customer"]) {
    const context = setup({ role });
    const treasuryModule = { exports: {} };
    let privilegedAccess = false;
    vm.runInNewContext(`(function(require,module,exports,process){${treasuryJs}\n})`)(
      (name) => {
        if (name === "@/app/actions/admin.actions") return context.actions;
        if (name === "@supabase/supabase-js") return { createClient: () => { privilegedAccess = true; throw new Error("Privileged client should not be created"); } };
        if (["next/cache", "@/lib/accounting-engine", "@/lib/treasury-engine", "@/lib/strategy-engine", "@/lib/bank-account-ordering"].includes(name)) return {};
        throw new Error(`Unexpected treasury dependency: ${name}`);
      },
      treasuryModule,
      treasuryModule.exports,
      { env: {} },
    );
    await assert.rejects(treasuryModule.exports.getTreasuryFullData(), /Unauthorized|Forbidden/);
    assert.equal(privilegedAccess, false);
  }
});
