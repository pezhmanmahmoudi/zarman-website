/* eslint-disable @typescript-eslint/no-require-imports -- Offline server-component rendering harness. */
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
  const localRequire = id => {
    if (id in mocks) return mocks[id];
    if (id.endsWith(".module.css")) {
      const css = fs.readFileSync(path.join(root, id.replace(/^@\//, "")), "utf8");
      const classes = {};
      postcss.parse(css).walkRules(rule => {
        for (const match of rule.selector.matchAll(/\.([a-zA-Z_][\w-]*)/g)) classes[match[1]] = match[1];
      });
      return { __esModule: true, default: new Proxy(classes, { get: (target, key) => {
        if (typeof key !== "string" || key in target) return target[key];
        throw new Error(`Missing CSS class ${id}: ${key}`);
      } }) };
    }
    if (id === "next/link") return { __esModule: true, default: props => {
      const linkProps = { ...props };
      delete linkProps.prefetch;
      return React.createElement("a", linkProps);
    } };
    if (id.startsWith("@/lib/")) return compile(`${id.slice(2)}.ts`, mocks);
    return require(id);
  };
  vm.runInThisContext(`(function(require,module,exports){${js}\n})`, { filename: file })(localRequire, compiled, compiled.exports);
  return compiled.exports;
}

const navigation = compile("lib/treasury-navigation.ts");
const snapshot = {
  accounting: { operatingProfit: 100, ownerLoanBalanceIRT: 300, netBusinessValueIRT: 200, drawerBalances: {} },
  treasury: { audInventory: 500, totalIranLiquidityIRT: 10000 },
  strategy: {
    alerts: [], accountingWarnings: [], criticalAlertCount: 0,
    healthScore: { score: 72 }, recommendation: { titleFA: "وضعیت خزانه" },
  },
  bankAccounts: [], expenses: [], recurringExpenses: [], ownerLoans: [], settings: {},
};
const paneNames = ["AlertsSection", "StrategyCenter", "MarketInventory", "LiquidityAccounts", "ReconciliationGrid", "ExposureSection", "ProfitabilitySection", "BankAccountManager", "BankTransferFees", "ExpenseForm", "RecurringExpenseForm", "OwnerLoanForm", "TreasurySettings"];

function createWorkspace() {
  const mounted = [];
  const mocks = Object.fromEntries(paneNames.map(name => [`@/components/admin/treasury/${name}`, {
    __esModule: true,
    default: props => {
      mounted.push({ name, props });
      return React.createElement("div", { "data-pane": name });
    },
  }]));
  const Workspace = compile("components/admin/treasury/TreasuryWorkspace.tsx", mocks).default;
  return { Workspace, mounted };
}

test("treasury URLs accept known views and reject arrays and prototype properties", () => {
  for (const view of Object.keys(navigation.TREASURY_VIEWS)) {
    assert.equal(navigation.resolveTreasuryView(view), view);
    assert.equal(navigation.treasuryViewHref(view), `/admin/treasury?view=${view}`);
  }
  for (const value of [undefined, "", "missing", "__proto__", "constructor", ["expenses"], ["expenses", "capital"]]) {
    assert.equal(navigation.resolveTreasuryView(value), "overview");
  }
});

test("overview exposes compact metrics and direct task destinations without mounting management forms", () => {
  const { Workspace, mounted } = createWorkspace();
  const html = renderToStaticMarkup(React.createElement(Workspace, { view: "overview", data: snapshot }));
  assert.deepEqual(mounted, []);
  assert.equal((html.match(/class="metric"/g) || []).length, 4);
  assert.match(html, /No treasury alerts/);
  assert.match(html, /Health score 72\/100/);
  for (const view of ["reconciliation", "expenses", "recurring", "bank-fees", "capital", "bank-accounts", "inventory", "profitability", "alerts", "strategy"]) {
    assert.ok(html.includes(`href="/admin/treasury?view=${view}"`), `Missing ${view} link`);
  }
  assert.doesNotMatch(html, /<main[ >]/);
});

test("each treasury workspace mounts only its selected pane and keeps its section links reachable", () => {
  const expected = {
    accounts: "LiquidityAccounts", reconciliation: "ReconciliationGrid", "bank-accounts": "BankAccountManager",
    expenses: "ExpenseForm", recurring: "RecurringExpenseForm", "bank-fees": "BankTransferFees", capital: "OwnerLoanForm",
    strategy: "StrategyCenter", inventory: "MarketInventory", exposure: "ExposureSection", profitability: "ProfitabilitySection", settings: "TreasurySettings",
  };
  for (const [view, name] of Object.entries(expected)) {
    const { Workspace, mounted } = createWorkspace();
    const html = renderToStaticMarkup(React.createElement(Workspace, { view, data: snapshot }));
    assert.deepEqual(mounted.map(item => item.name), [name], `${view} hydrated an unrelated form`);
    assert.equal((html.match(/aria-current="location"/g) || []).length, 1);
    const group = navigation.TREASURY_VIEWS[view].group;
    const siblings = Object.keys(navigation.TREASURY_VIEWS).filter(key => navigation.TREASURY_VIEWS[key].group === group);
    for (const sibling of siblings) assert.ok(html.includes(`href="/admin/treasury?view=${sibling}"`));
    if (siblings.length > 1) assert.match(html, new RegExp(`href="/admin/treasury\\?view=${view}" aria-current="page"`));
    if (["BankAccountManager", "ExpenseForm", "RecurringExpenseForm", "OwnerLoanForm"].includes(name)) assert.equal(mounted[0].props.defaultOpen, true);
  }
});

test("all alerts remain accessible from every workspace and empty alerts have a clear state", () => {
  const data = { ...snapshot, strategy: { ...snapshot.strategy, criticalAlertCount: 1, alerts: [{ severity: "critical", titleFA: "هشدار" }], accountingWarnings: ["warning"] } };
  for (const view of Object.keys(navigation.TREASURY_VIEWS)) {
    const { Workspace, mounted } = createWorkspace();
    const html = renderToStaticMarkup(React.createElement(Workspace, { view, data }));
    assert.ok(html.includes('href="/admin/treasury?view=alerts"'));
    if (view === "overview") assert.match(html, /2 items need your attention/);
    if (view === "alerts") {
      assert.equal(mounted[0].name, "AlertsSection");
      assert.equal(mounted[0].props.alerts, data.strategy.alerts);
      assert.equal(mounted[0].props.accountingWarnings, data.strategy.accountingWarnings);
    }
  }
  const { Workspace, mounted } = createWorkspace();
  const html = renderToStaticMarkup(React.createElement(Workspace, { view: "alerts", data: snapshot }));
  assert.match(html, /No treasury alerts/);
  assert.deepEqual(mounted, []);
});

test("treasury page resolves URL state on the server and retrieves one shared snapshot", async () => {
  for (const [requested, expected] of [["bank-fees", "bank-fees"], ["unknown", "overview"], [undefined, "overview"]]) {
    let requests = 0;
    let selected;
    const Page = compile("app/(panel)/admin/(protected)/treasury/page.tsx", {
      "@/app/actions/treasury.actions": { getTreasuryFullData: async () => { requests++; return snapshot; } },
      "@/components/admin/treasury/TreasuryWorkspace": { __esModule: true, default: props => { selected = props; return null; } },
      "@/components/admin/ui/AdminRefreshButton": { AdminRefreshButton: () => React.createElement("button", null, "Refresh") },
    }).default;
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ view: requested }) }));
    assert.equal(requests, 1);
    assert.equal(selected.view, expected);
    assert.equal(selected.data, snapshot);
    assert.match(html, /<h1 class="pageTitle">Treasury<\/h1>/);
  }
});
