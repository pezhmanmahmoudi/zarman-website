/* eslint-disable @typescript-eslint/no-require-imports -- Offline server-component regression tests. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");
const postcss = require("postcss");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const root = path.resolve(__dirname, "..");
function compile(file, mocks = {}) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const compiled = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${js}\n})`, { filename: file })(id => {
    if (id in mocks) return mocks[id];
    if (id.endsWith(".module.css")) {
      const classes = {};
      postcss.parse(fs.readFileSync(path.join(root, id.replace(/^@\//, "")), "utf8")).walkRules(rule => {
        for (const match of rule.selector.matchAll(/\.([a-zA-Z_][\w-]*)/g)) classes[match[1]] = match[1];
      });
      return { __esModule: true, default: new Proxy(classes, { get: (target, key) => {
        if (typeof key !== "string" || key in target) return target[key];
        throw new Error(`Missing CSS class ${id}: ${key}`);
      } }) };
    }
    return require(id);
  }, compiled, compiled.exports);
  return compiled.exports;
}

const views = compile("lib/admin-ledger-view.ts");
const pagination = compile("lib/admin-pagination.ts");
const link = { __esModule: true, default: props => {
  const attributes = { ...props };
  delete attributes.prefetch;
  return React.createElement("a", attributes);
} };

async function renderPage(params = {}, records = { pageLedgerRows: [], total: 0 }) {
  const calls = { records: [], banks: 0, toolbar: [], pagination: [], table: [], details: [], insights: [], treasury: 0 };
  const bankAccounts = [{ id: "account-test", account_name: "Test account", currency: "AUD" }];
  const Page = compile("app/(panel)/admin/(protected)/ledger/page.tsx", {
    "next/link": link,
    "next/navigation": { redirect: href => { const error = new Error("redirect"); error.href = href; throw error; } },
    "@/app/actions/admin.actions": {
      getActiveBankAccountsForAdmin: async () => { calls.banks++; return bankAccounts; },
      getLedgerData: async (...args) => { calls.records.push(args); if (records instanceof Error) throw records; return records; },
    },
    "@/app/actions/treasury.actions": { getTreasuryFullData: async () => { calls.treasury++; throw new Error("Entries must not load treasury"); } },
    "@/components/admin/AdminPagination": { AdminPagination: props => { calls.pagination.push(props); return React.createElement("nav", { "aria-label": props.label }, `Page ${props.currentPage}`); } },
    "@/components/admin/EditableLedgerTable": { EditableLedgerTable: props => { calls.table.push(props); return React.createElement("div", null, props.titleSlot, props.rows.map(row => React.createElement("span", { key: row.id }, row.sender))); } },
    "@/components/admin/ui/AdminRefreshButton": { AdminRefreshButton: () => React.createElement("button", { type: "button" }, "Refresh") },
    "@/components/admin/ledger/LedgerToolbar": { __esModule: true, default: props => { calls.toolbar.push(props); return React.createElement("section", { "aria-label": "Ledger filters and export" }); } },
    "@/components/admin/ledger/LedgerDrillDown": { __esModule: true, default: props => { calls.details.push(props.ledgerDataMap); return props.children; } },
    "@/components/admin/ledger/LedgerInsights": { __esModule: true, default: props => { calls.insights.push(props); return React.createElement("section", { "aria-label": "Insights" }, "Period metrics"); } },
    "@/lib/admin-ledger-view": views,
    "@/lib/admin-pagination": pagination,
  }).default;
  try {
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) }));
    return { html, calls, bankAccounts };
  } catch (error) {
    if (error.href) return { redirect: error.href, calls };
    throw error;
  }
}

test("default ledger Entries render only the visible records without insights or treasury reads", async () => {
  const rows = [{ id: "ledger-test", sender: "Example sender" }];
  const { html, calls, bankAccounts } = await renderPage({}, { pageLedgerRows: rows, total: 266 });
  assert.deepEqual(calls.records, [[1, 20, { start: undefined, end: undefined, type: undefined, search: undefined, account: undefined }]]);
  assert.equal(calls.banks, 1);
  assert.equal(calls.treasury, 0);
  assert.deepEqual(calls.insights, []);
  assert.match(html, /All entries/);
  assert.match(html, /266 records/);
  assert.match(html, /Example sender/);
  assert.doesNotMatch(html, /Period metrics/);
  assert.match(html, /href="\/admin\/ledger"[^>]+aria-current="page"/);
  assert.deepEqual(calls.table[0].rows, rows);
  assert.deepEqual(calls.table[0].bankAccounts, bankAccounts);
  assert.deepEqual(calls.details[0], { "ledger-test": rows[0] });
  assert.equal(calls.pagination.length, 2);
  assert.notEqual(calls.pagination[0].label, calls.pagination[1].label);
});

test("selected page size and filters are shared by records, both paginators, and CSV toolbar", async () => {
  const params = { page: "3", pageSize: "50", start: "2026-09-01", end: "2026-09-11", type: "buy_aud", account: "account-test", search: "Ali & Sara" };
  const { calls } = await renderPage(params, { pageLedgerRows: [], total: 266 });
  const filters = { start: params.start, end: params.end, type: params.type, account: params.account, search: params.search };
  assert.deepEqual(calls.records, [[3, 50, filters]]);
  assert.deepEqual(calls.toolbar[0].exportFilters, filters);
  assert.deepEqual(calls.toolbar[0].currentParams, params);
  for (const pager of calls.pagination) {
    assert.equal(pager.currentPage, 3);
    assert.equal(pager.pageSize, 50);
    assert.equal(pager.totalCount, 266);
  }
});

test("Insights view retains filters and avoids reading an unused table page", async () => {
  const params = { view: "insights", page: "3", pageSize: "25", start: "2026-08-01", end: "2026-08-31", search: "A & B", type: "sell_aud", account: "account-test" };
  const { html, calls } = await renderPage(params);
  assert.deepEqual(calls.records, []);
  assert.deepEqual(calls.table, []);
  assert.deepEqual(calls.pagination, []);
  assert.equal(calls.insights.length, 1);
  assert.deepEqual(calls.insights[0].filters, calls.toolbar[0].exportFilters);
  assert.match(html, /Period metrics/);
  assert.doesNotMatch(html, /All entries/);
  const entriesLink = new URL(views.ledgerViewHref(params, "entries"), "https://admin.example.test");
  assert.equal(entriesLink.searchParams.has("view"), false);
  for (const [key, value] of Object.entries(params)) if (key !== "view") assert.equal(entriesLink.searchParams.get(key), value);
  const insightsLink = new URL(views.ledgerViewHref(params, "insights"), "https://admin.example.test");
  for (const [key, value] of Object.entries(params)) assert.equal(insightsLink.searchParams.get(key), value);
});

test("out-of-range ledger pages redirect to the last available page and preserve filters", async () => {
  const params = { page: "27", pageSize: "50", search: "A & B", account: "account-test", range: "this-month" };
  const result = await renderPage(params, { pageLedgerRows: [], total: 266 });
  const destination = new URL(result.redirect, "https://admin.example.test");
  assert.equal(destination.pathname, "/admin/ledger");
  assert.equal(destination.searchParams.get("page"), "6");
  for (const key of ["pageSize", "search", "account", "range"]) assert.equal(destination.searchParams.get(key), params[key]);
  assert.deepEqual(result.calls.table, []);
  const empty = await renderPage({ page: "27", pageSize: "20", search: "no-match" });
  assert.equal(new URL(empty.redirect, "https://admin.example.test").searchParams.get("page"), "1");
});

test("malformed pagination falls back safely and failed ledger reads do not render empty balances", async () => {
  const { calls } = await renderPage({ page: "invalid", pageSize: "999" });
  assert.equal(calls.records[0][0], 1);
  assert.equal(calls.records[0][1], 20);
  await assert.rejects(renderPage({}, new Error("Ledger unavailable")), /Ledger unavailable/);
});

test("date shortcuts follow Sydney local midnight and year boundaries", () => {
  const today = views.ledgerFiltersForView({ range: "today" }, new Date("2026-09-10T14:30:00Z"));
  assert.equal(today.start, "2026-09-11");
  assert.equal(today.end, "2026-09-11");
  const newYear = new Date("2025-12-31T13:30:00Z");
  const year = views.ledgerFiltersForView({ range: "this-year" }, newYear);
  assert.equal(year.start, "2026-01-01");
  assert.equal(year.end, "2026-12-31");
  const month = views.ledgerFiltersForView({ range: "this-month" }, newYear);
  assert.equal(month.start, "2026-01-01");
  assert.equal(month.end, "2026-01-31");
  const lastMonth = views.ledgerFiltersForView({ range: "last-month" }, newYear);
  assert.equal(lastMonth.start, "2025-12-01");
  assert.equal(lastMonth.end, "2025-12-31");
  const leapMonth = views.ledgerFiltersForView({ range: "last-month" }, new Date("2024-03-01T00:00:00Z"));
  assert.equal(leapMonth.start, "2024-02-01");
  assert.equal(leapMonth.end, "2024-02-29");
});

test("all-time clears stale date limits; custom dates and other filters are preserved", () => {
  const filters = { start: "2026-08-01", end: "2026-08-31", account: "account-test", type: "expense", search: "Sam" };
  assert.deepEqual(views.ledgerFiltersForView({ ...filters, range: "custom" }), filters);
  assert.deepEqual(views.ledgerFiltersForView(filters), filters);
  assert.deepEqual(views.ledgerFiltersForView({ ...filters, range: "all" }), { ...filters, start: undefined, end: undefined });
});
