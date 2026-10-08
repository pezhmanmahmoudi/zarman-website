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

function setup({ tables = {}, role = "admin", fail = () => false, apiLimit = 1_000, projectColumns = false, serverRender = false, readGate = () => undefined } = {}) {
  const calls = [];
  let authChecks = 0;
  let serviceClients = 0;
  let currentRole = role;

  class ReadQuery {
    constructor(table) {
      this.table = table;
      this.predicates = [];
      this.orders = [];
      this.options = {};
    }
    select(columns, options = {}) { this.columns = columns; this.options = options; return this; }
    eq(field, value) { this.predicates.push((row) => row[field] === value); return this; }
    neq(field, value) { this.predicates.push((row) => row[field] !== value); return this; }
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
      let page = filtered.slice(start, Math.min(end + 1, start + apiLimit));
      if (projectColumns && this.columns !== "*") {
        const fields = this.columns.split(",").map(field => field.trim());
        page = page.map(row => Object.fromEntries(fields.map(field => [field, row[field]])));
      }
      const response = {
        data: this.options.head ? null : page,
        count: this.options.count === "exact" ? filtered.length : null,
        error: null,
      };
      return Promise.resolve(readGate(this)).then(() => response).then(resolve, reject);
    }
  }

  const db = {
    from: (table) => new ReadQuery(table),
    auth: { getUser: async () => {
      authChecks++;
      return { data: { user: currentRole ? { id: "offline-admin", app_metadata: { role: currentRole } } : null }, error: null };
    } },
  };
  const compiledModule = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports,process){${compiled}\n})`)(
    (name) => {
      if (name === "@supabase/supabase-js") return { createClient: () => { serviceClients++; return db; } };
      if (name === "@/lib/supabase-server") return { createSupabaseServerComponentClient: async () => db };
      // Model one RSC request scope only when explicitly requested. Direct
      // action calls have no React render cache and always recheck access.
      if (name === "react") return { cache: fn => {
        if (!serverRender) return fn;
        let value;
        return () => value ??= fn();
      } };
      if (name === "@/lib/requests/receipt-upload") return { REQUEST_RECEIPTS_BUCKET: "exchange-request-receipts" };
      if (["next/cache", "@/lib/rates", "@/lib/pricing", "@/lib/iran-bank-transfer-fees", "@/lib/jalali"].includes(name)) return {};
      throw new Error(`Unexpected dependency: ${name}`);
    },
    compiledModule,
    compiledModule.exports,
    { env: {} },
  );
  return { actions: compiledModule.exports, calls, setRole: value => { currentRole = value; }, get authChecks() { return authChecks; }, get serviceClients() { return serviceClients; } };
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

test("transaction server rendering shares one fresh authorization with sidebar counts", async () => {
  for (let request = 0; request < 2; request++) {
    const context = setup({ serverRender: true });
    await Promise.all([
      context.actions.getAdminNavigationCounts(),
      context.actions.getPendingTransactionsWithDetails(),
      context.actions.getTransactionHistoryWithDetails(),
      context.actions.getTransactionHistoryStatusCounts(),
      context.actions.getActiveBankAccountsForAdmin(),
    ]);
    assert.equal(context.authChecks, 1);
    assert.equal(context.calls.filter(query => query.table === "audit_logs").length, 1);
    assert.equal(context.serviceClients, 1);
  }
});

test("the transaction workspace uses one fresh authorization per browser action and skips hidden history", async () => {
  const context = setup({ tables: {
    transactions: [
      { id: "pending-1", status: "pending", created_at: "2026-09-15T01:00:00Z" },
      { id: "approved-1", status: "approved", created_at: "2026-09-14T01:00:00Z" },
      { id: "approved-2", status: "approved", created_at: "2026-09-13T01:00:00Z" },
    ],
    bank_accounts: [{ id: "active-account", account_name: "AUD", currency: "AUD", is_active: true }, { id: "hidden-account", is_active: false }],
  } });
  const active = await context.actions.getAdminTransactionWorkspace("active");
  assert.deepEqual(Array.from(active.pending, row => row.id), ["pending-1"]);
  assert.equal(active.history.length, 0);
  assert.equal(active.total, 0);
  assert.equal(active.statusCounts.approved, 2);
  assert.equal(active.bankAccounts.length, 1);
  assert.equal(context.authChecks, 1);
  assert.equal(context.serviceClients, 1);
  assert.equal(context.calls.length, 7, "authorization, pending/refund queues, three badge counts and accounts only");
  assert.equal(context.calls.filter(query => query.table === "transactions" && !query.options.head).length, 1);

  const previousCalls = context.calls.length;
  const history = await context.actions.getAdminTransactionWorkspace("history", 2, 1, { status: "approved" });
  assert.deepEqual(Array.from(history.history, row => row.id), ["approved-2"]);
  assert.equal(history.total, 2);
  assert.equal(history.pending.length, 1);
  assert.equal(context.authChecks, 2, "a new browser action rechecks the live admin session");
  assert.equal(context.serviceClients, 2);
  assert.equal(context.calls.length - previousCalls, 9, "history adds its filtered count and visible page");
  const page = context.calls.slice(previousCalls).find(query => query.table === "transactions" && query.window?.[0] === 1);
  assert.deepEqual(page.window, [1, 1]);
  const authorizedReadCount = context.calls.length;
  context.setRole("customer");
  await assert.rejects(context.actions.getAdminTransactionWorkspace("active"), /Forbidden/);
  assert.equal(context.authChecks, 3);
  assert.equal(context.serviceClients, 2, "a revoked role cannot reuse privileged access from the previous action");
  assert.equal(context.calls.length, authorizedReadCount);
});

test("transaction workspace reads independent history, counts and accounts while the queue is still loading", async () => {
  let releaseQueue;
  const queueGate = new Promise(resolve => { releaseQueue = resolve; });
  const context = setup({ readGate: query => query.table === "transactions"
    && query.orders.some(order => order.field === "created_at" && order.ascending) ? queueGate : undefined });
  const response = context.actions.getAdminTransactionWorkspace("history");
  try {
    await new Promise(setImmediate);
    assert.equal(context.authChecks, 1);
    assert.equal(context.calls[0].table, "audit_logs", "privileged reads must follow the capability check");
    assert.ok(context.calls.some(query => query.table === "bank_accounts"), "accounts do not wait for the queue");
    assert.ok(context.calls.some(query => query.table === "transactions" && query.orders.some(order => order.field === "created_at" && !order.ascending)), "history does not wait for the queue");
    assert.equal(context.calls.filter(query => query.table === "transactions" && query.options.head).length, 4, "the history count and three badge counts start independently");
  } finally { releaseQueue(); }
  assert.equal((await response).pending.length, 0);
});

test("transaction workspace denies unauthorized and failed-capability reads before service access", async () => {
  for (const role of [null, "customer"]) {
    const context = setup({ role });
    await assert.rejects(context.actions.getAdminTransactionWorkspace("history"), /Unauthorized|Forbidden/);
    assert.equal(context.serviceClients, 0);
    assert.equal(context.calls.length, 0);
  }
  const forbidden = setup({ fail: query => query.table === "audit_logs" });
  await assert.rejects(forbidden.actions.getAdminTransactionWorkspace("active"), /capability check failed/);
  assert.equal(forbidden.serviceClients, 0);
  const unavailable = setup({ fail: query => query.table === "bank_accounts" });
  await assert.rejects(unavailable.actions.getAdminTransactionWorkspace("active"), /Synthetic read failure/);
});

test("transaction read actions reauthorize outside render scope and reject non-admins before service access", async () => {
  const reads = ["getPendingTransactionsWithDetails", "getTransactionHistoryWithDetails", "getTransactionHistoryStatusCounts", "getActiveBankAccountsForAdmin"];
  const context = setup();
  for (const read of reads) await context.actions[read]();
  assert.equal(context.authChecks, reads.length);
  for (const role of [null, "customer"]) {
    const denied = setup({ role, serverRender: true });
    for (const read of reads) await assert.rejects(denied.actions[read]());
    assert.equal(denied.serviceClients, 0);
  }
});

test("verification queue and history return the saved contact, address and identity fields used by View", async () => {
  const details = {
    first_name: "Example", last_name: "Customer", email: "example@example.test", customer_code: "CZ00123",
    created_at: "2026-09-27T00:00:00Z", mobile_number: "0400000000", dob: "1990-01-01",
    address: "10 Example Street", city: "Sydney", state: "NSW", postcode: "2000", country: "Australia",
    document_type: "driver_license", license_number: "001234", card_number: "00099", passport_number: null,
    state_of_issue: "NSW", expiry_date: "2029-01-01",
  };
  const profiles = ["pending", "under_review", "approved", "rejected", "archived"].map(kyc_status => ({ ...details, id: kyc_status, kyc_status }));
  const context = setup({ tables: { profiles }, projectColumns: true });
  const queue = await context.actions.getKycQueue();
  const history = await context.actions.getKycHistory(1, 20);
  assert.deepEqual(queue.map(row => row.id).sort(), ["pending", "under_review"]);
  assert.equal(history.total, 3);
  assert.deepEqual(history.data.map(row => row.id).sort(), ["approved", "archived", "rejected"]);
  for (const row of [...queue, ...history.data]) {
    for (const [key, value] of Object.entries(details)) assert.equal(row[key], value, `${row.id}: missing ${key}`);
  }
  const read = context.calls.find(query => query.table === "profiles" && query.window);
  assert.deepEqual(read.window, [0, 19]);
  assert.equal(context.serviceClients, 0);
});

test("verification data remains admin-only and read failures are surfaced", async () => {
  for (const role of [null, "customer"]) {
    const context = setup({ role });
    await assert.rejects(context.actions.getKycQueue());
    await assert.rejects(context.actions.getKycHistory());
    assert.equal(context.calls.some(query => query.table === "profiles"), false);
  }
  const failed = setup({ fail: query => query.table === "profiles" && !query.options.head });
  await assert.rejects(failed.actions.getKycQueue(), /Synthetic read failure/);
  await assert.rejects(failed.actions.getKycHistory(), /Synthetic read failure/);
});

test("merged queue includes every pending transfer beyond API limits and outstanding refunds without duplicates", async () => {
  const pending = Array.from({ length: 205 }, (_, index) => ({ id: `tx-${index}`, status: "pending", created_at: "2026-09-15T01:00:00Z", request: index ? null : { id: "request-0" } }));
  const refunds = Array.from({ length: 45 }, (_, index) => ({ id: `refund-${index}`, transaction_id: `closed-${index}`, funding_status: "refund_pending" }));
  const context = setup({ apiLimit: 20, tables: {
    transactions: [...pending, ...refunds.map(item => ({ id: item.transaction_id, status: "rejected" }))],
    exchange_requests: [...refunds, { id: "pending-refund", transaction_id: "tx-0", priority_fee_status: "refund_pending" }],
  } });
  const rows = await context.actions.getPendingTransactionsWithDetails();
  assert.equal(rows.length, 250);
  assert.equal(new Set(rows.map(row => row.id)).size, 250);
  assert.equal(rows.find(row => row.id === "tx-0").request.id, "request-0");
  for (const query of context.calls.filter(query => query.table === "transactions")) assert.match(query.columns, /request:exchange_requests\(\*\)/);
});

test("request read errors fail the unified queue instead of treating linked transfers as manual", async () => {
  const context = setup({ fail: query => query.table === "exchange_requests" });
  await assert.rejects(context.actions.getPendingTransactionsWithDetails(), /Synthetic read failure/);
});

test("transaction history is paginated once, preserves linked request details and checks both counts and rows", async () => {
  const transactions = Array.from({ length: 30 }, (_, index) => ({ id: String(index).padStart(3, "0"), status: "approved", created_at: "2026-09-15T01:00:00Z", request: { id: `req-${index}` } }));
  const context = setup({ tables: { transactions } });
  const result = await context.actions.getTransactionHistoryWithDetails(2, 10);
  assert.equal(result.total, 30);
  assert.equal(result.data.length, 10);
  assert.equal(result.data[0].request.id, "req-19");
  const failed = setup({ fail: query => query.table === "transactions" && query.options.head });
  await assert.rejects(failed.actions.getTransactionHistoryWithDetails(), /Synthetic read failure/);
  await assert.rejects(failed.actions.getTransactionHistoryStatusCounts(), /Synthetic read failure/);
});

test("unified transaction reads enforce admin authorization before using service credentials", async () => {
  const context = setup({ role: null });
  await assert.rejects(context.actions.getPendingTransactionsWithDetails());
  await assert.rejects(context.actions.getTransactionHistoryWithDetails());
  assert.equal(context.serviceClients, 0);
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
        if (["next/cache", "@/lib/accounting-engine", "@/lib/treasury-engine", "@/lib/strategy-engine", "@/lib/bank-account-ordering", "@/lib/reconciliation-engine", "@/lib/jalali"].includes(name)) return {};
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
