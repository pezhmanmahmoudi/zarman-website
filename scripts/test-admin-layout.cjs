/* eslint-disable @typescript-eslint/no-require-imports -- Offline TSX rendering harness. */
// Render the real admin components with controlled data. No browser, credentials,
// database, or added runtime dependencies are needed.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");
const postcss = require("postcss");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const projectRoot = path.resolve(__dirname, "..");
const dashboardPath = "app/(panel)/admin/(protected)/dashboard/page.tsx";
const emptyStats = {
  pendingKycCount: 0,
  pendingTxCount: 0,
  pendingFeedbackCount: 0,
  totalUsersCount: 0,
  approvedTxCount: 0,
};

function cssModule(id) {
  const filename = path.join(projectRoot, id.replace(/^@\//, ""));
  const classes = {};
  postcss.parse(fs.readFileSync(filename, "utf8"), { from: filename }).walkRules(rule => {
    for (const match of rule.selector.matchAll(/\.([a-zA-Z_][\w-]*)/g)) classes[match[1]] = match[1];
  });
  return { __esModule: true, default: new Proxy(classes, {
    get: (target, key) => {
      if (typeof key !== "string" || key in target) return target[key];
      throw new Error(`Missing CSS class ${id}: ${key}`);
    },
  }) };
}

function compile(file, mocks = {}) {
  const source = fs.readFileSync(path.join(projectRoot, file), "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const compiled = { exports: {} };
  const localRequire = id => {
    if (id in mocks) return mocks[id];
    if (id.endsWith(".module.css")) return cssModule(id);
    if (id === "next/link") return { __esModule: true, default: props => React.createElement("a", props) };
    if (id === "next/image") return { __esModule: true, default: props => React.createElement("img", props) };
    return require(id);
  };
  vm.runInThisContext(`(function(require,module,exports){${js}\n})`, { filename: file })(
    localRequire, compiled, compiled.exports,
  );
  return compiled.exports;
}

async function renderDashboard(stats = emptyStats, logs = []) {
  const calls = [];
  const Dashboard = compile(dashboardPath, {
    "@/app/actions/admin.actions": {
      getAdminStats: async () => stats,
      getAuditLogs: async (page, pageSize) => {
        calls.push({ page, pageSize });
        return { data: logs, count: logs.length };
      },
    },
    "@/components/admin/ui/AdminRefreshButton": {
      AdminRefreshButton: () => React.createElement("button", { type: "button" }, "Refresh"),
    },
  }).default;
  return { html: renderToStaticMarkup(await Dashboard()), calls };
}

function renderSidebar(pathname, counts = {}) {
  const { AdminSidebar } = compile("components/admin/AdminSidebar.tsx", {
    "next/navigation": { usePathname: () => pathname, useRouter: () => ({}) },
    "@/lib/supabase": { supabase: { auth: {} } },
    "@/components/admin/ui/AdminDialog": { AdminDialog: () => null },
  });
  return renderToStaticMarkup(React.createElement(AdminSidebar, {
    adminEmail: "admin@example.test", pendingKyc: 0, pendingTx: 0, pendingFeedback: 0, ...counts,
  }));
}

test("the admin route's outermost layout renders a complete document", () => {
  const routeDirectories = ["app", "app/(panel)", "app/(panel)/admin", "app/(panel)/admin/login"];
  const rootLayout = routeDirectories.map(directory => `${directory}/layout.tsx`)
    .find(file => fs.existsSync(path.join(projectRoot, file)));
  assert.ok(rootLayout, "Admin routes need a root layout");
  const Layout = compile(rootLayout, {
    "next/font/google": { Inter: () => ({ variable: "font-en" }) },
    "@/app/globals.css": {},
  }).default;
  const html = renderToStaticMarkup(React.createElement(Layout, null, React.createElement("main", null, "Admin content")));
  assert.equal((html.match(/<html\b/g) || []).length, 1);
  assert.equal((html.match(/<body\b/g) || []).length, 1);
  assert.match(html, /<html[^>]*lang="en"[^>]*dir="ltr"/);
  assert.match(html, /<body[^>]*class="[^"]*theme/);
  assert.match(html, /<main>Admin content<\/main>/);
});

test("dashboard displays the returned queue counts, their total, and useful destinations", async () => {
  const { html, calls } = await renderDashboard({
    pendingKycCount: 3, pendingTxCount: 12, pendingFeedbackCount: 1,
    totalUsersCount: 2400, approvedTxCount: 12000,
  });
  assert.match(html, /16 items need your attention/);
  assert.deepEqual([...html.matchAll(/class="queueValue">([^<]+)/g)].map(match => match[1]), ["12", "3", "1"]);
  assert.match(html, /Total customers<\/span><strong>2,400<\/strong>/);
  assert.match(html, /Approved transactions<\/span><strong>12,000<\/strong>/);
  for (const destination of ["transactions", "kyc", "feedback", "users", "ledger", "treasury", "reports", "audit"]) {
    assert.ok(html.includes(`href="/admin/${destination}"`), `Missing ${destination} destination`);
  }
  assert.deepEqual(calls, [{ page: 1, pageSize: 7 }]);
});

test("empty queues and audit history render an honest empty state", async () => {
  const { html } = await renderDashboard();
  assert.match(html, /Your review queues are clear/);
  assert.equal((html.match(/>Up to date</g) || []).length, 3);
  assert.match(html, /colSpan="3"/i);
  assert.match(html, /No recent activity/);
  assert.doesNotMatch(html, /Awaiting review/);
  assert.doesNotMatch(html, /<main[ >]/);
});

test("one pending request uses singular text and audit entries retain their detail", async () => {
  const { html } = await renderDashboard({ ...emptyStats, pendingKycCount: 1 }, [
    { id: "audit-1", action: "KYC_APPROVED", target_type: "kyc_document", target_id: "abcdefgh-full-id", actor_email: "reviewer@example.test", created_at: "2026-09-11T00:00:00.000Z" },
    { id: "audit-2", action: "TRANSACTION_REJECTED", target_type: null, target_id: null, actor_email: null, created_at: "2026-09-11T01:00:00.000Z" },
  ]);
  assert.match(html, /1 item needs your attention/);
  assert.match(html, /badgeApproved">KYC APPROVED/);
  assert.match(html, /badgeRejected">TRANSACTION REJECTED/);
  assert.match(html, /kyc document.*abcdefgh/);
  assert.match(html, /reviewer@example.test/);
  assert.match(html, /class="actor">Administrator/);
  assert.equal((html.match(/<time dateTime="2026-09-11T0[01]:00:00.000Z"/g) || []).length, 2);
  assert.doesNotMatch(html, /No recent activity/);
});

test("sidebar marks nested report pages active and does not match unrelated prefixes", () => {
  const nested = renderSidebar("/admin/reports/accounts");
  assert.match(nested, /<a href="\/admin\/reports" aria-current="page"/);
  assert.equal((nested.match(/aria-current="page"/g) || []).length, 1);
  const unrelated = renderSidebar("/admin/reports-archive");
  assert.doesNotMatch(unrelated, /aria-current="page"/);
});

test("sidebar marks only the more specific sibling active for /admin/reports/austrac", () => {
  const html = renderSidebar("/admin/reports/austrac");
  assert.match(html, /<a href="\/admin\/reports\/austrac" aria-current="page"/);
  assert.doesNotMatch(html, /<a href="\/admin\/reports" aria-current="page"/);
  assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
});

test("sidebar keeps full pending counts accessible and exposes a collapsed mobile menu", () => {
  const html = renderSidebar("/admin/transactions", { pendingTx: 125, pendingKyc: 2 });
  assert.match(html, /aria-label="125 pending">99\+/);
  assert.match(html, /aria-label="2 pending">2</);
  assert.doesNotMatch(html, /aria-label="0 pending"/);
  assert.match(html, /aria-label="Open admin navigation" aria-expanded="false" aria-haspopup="dialog"/);
  assert.match(html, /aria-label="Admin navigation"/);
});

test("admin errors recover stale deployments with a full document navigation", () => {
  const errorSource = fs.readFileSync(
    path.join(projectRoot, "app/(panel)/admin/(protected)/error.tsx"),
    "utf8",
  );
  const configSource = fs.readFileSync(path.join(projectRoot, "next.config.ts"), "utf8");

  assert.match(errorSource, /window\.location\.reload\(\)/);
  assert.match(errorSource, /window\.location\.assign\("\/admin\/dashboard"\)/);
  assert.match(configSource, /deploymentId:\s*process\.env\.VERCEL_DEPLOYMENT_ID\s*\?\?\s*process\.env\.VERCEL_GIT_COMMIT_SHA/);
});

function mountAdminError() {
  const effects = [];
  const react = {
    ...React,
    useEffect: fn => { effects.push(fn); },
  };
  const AdminError = compile("app/(panel)/admin/(protected)/error.tsx", { react }).default;
  const fakeError = Object.assign(new Error("Synthetic render failure"), { digest: "test-digest-123" });
  const tree = AdminError({ error: fakeError, reset: () => {} });
  const actions = [];
  const collectActions = node => {
    if (!React.isValidElement(node)) return;
    if (typeof node.props.onClick === "function") actions.push(node);
    React.Children.forEach(node.props.children, collectActions);
  };
  collectActions(tree);
  return {
    render: () => renderToStaticMarkup(tree),
    runEffects: () => effects.splice(0).forEach(fn => fn()),
    actions,
    fakeError,
  };
}

test("admin errors stay visible until the user explicitly retries or opens the dashboard", () => {
  const navigationCalls = [];
  const storageCalls = [];
  const loggedErrors = [];
  const previousWindow = global.window;
  const previousSessionStorage = global.sessionStorage;
  const previousConsoleError = console.error;
  global.window = { location: {
    reload: () => navigationCalls.push("reload"),
    assign: url => navigationCalls.push(url),
  } };
  global.sessionStorage = {
    getItem: key => { storageCalls.push(["get", key]); return null; },
    setItem: (key, value) => storageCalls.push(["set", key, value]),
  };
  console.error = (...args) => loggedErrors.push(args);
  try {
    const first = mountAdminError();
    assert.match(first.render(), /role="alert"/);
    assert.match(first.render(), /This page couldn.t load/);
    assert.match(first.render(), /Try again/);
    assert.doesNotMatch(first.render(), /Refreshing/);
    first.runEffects();
    assert.deepEqual(navigationCalls, []);
    assert.ok(loggedErrors.some(args => args.includes(first.fakeError)), "the caught error must be logged for diagnosis");

    // A persistent failure also waits for manual recovery on subsequent mounts.
    const second = mountAdminError();
    assert.match(second.render(), /This page couldn.t load/);
    second.runEffects();
    assert.deepEqual(navigationCalls, []);
    assert.deepEqual(storageCalls, []);

    first.actions.find(action => action.type === "button").props.onClick();
    assert.deepEqual(navigationCalls, ["reload"]);
    let prevented = false;
    first.actions.find(action => action.props.href === "/admin/dashboard").props.onClick({
      preventDefault: () => { prevented = true; },
    });
    assert.equal(prevented, true);
    assert.deepEqual(navigationCalls, ["reload", "/admin/dashboard"]);
  } finally {
    console.error = previousConsoleError;
    global.window = previousWindow;
    global.sessionStorage = previousSessionStorage;
  }
});

test("admin status refresh requests fresh server data immediately without reloading the document", () => {
  const calls = [];
  const { useAdminRefresh } = compile("components/admin/ui/useAdminRefresh.ts", {
    react: {
      useCallback: callback => callback,
      useContext: () => null,
      startTransition: callback => { calls.push("transition"); callback(); },
    },
    "next/navigation": { useRouter: () => ({ refresh: () => calls.push("refresh") }) },
    "./AdminRefreshScope": { AdminRefreshContext: {} },
  });
  // No window/timer implementation: a full reload or artificial delay fails here.
  useAdminRefresh()();
  assert.deepEqual(calls, ["transition", "refresh"]);
});
