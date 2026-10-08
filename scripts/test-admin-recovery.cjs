/* eslint-disable @typescript-eslint/no-require-imports -- Offline fault-injection tests. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");
const React = require("react");
const { dashboardHarness } = require("./helpers/dashboard-harness.cjs");
const root = path.resolve(__dirname, "..");

function nodes(tree, match) {
  if (!tree || typeof tree !== "object") return [];
  return [...(match(tree) ? [tree] : []), ...React.Children.toArray(tree.props?.children).flatMap(child => nodes(child, match))];
}

function compile(file, mocks) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const result = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${js}\n})`, { filename: file })(id => {
    if (id in mocks) return mocks[id];
    throw new Error(`Unexpected dependency: ${id}`);
  }, result, result.exports);
  return result.exports;
}
const { createAdminRefreshQueue } = compile("lib/admin-refresh-queue.ts", {});
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test("a mutation during a refresh queues one newer read and cannot publish the older state", async () => {
  const first = deferred(), second = deferred(), displayed = [], pending = [];
  let reads = 0;
  const queue = createAdminRefreshQueue({ load: () => (++reads === 1 ? first.promise : second.promise),
    onData: value => displayed.push(value), onError: error => { throw error; }, onPending: value => pending.push(value) });
  const work = queue.refresh();
  await Promise.resolve();
  queue.refresh(); queue.refresh();
  first.resolve("before deletion");
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(displayed, []);
  second.resolve("after deletion");
  await work;
  assert.equal(reads, 2);
  assert.deepEqual(displayed, ["after deletion"]);
  assert.deepEqual(pending, [true, false]);
});

test("failed refresh retains a confirmed local change and retry performs only a read", async () => {
  let displayed = ["remaining record"], reads = 0, failures = 0;
  const queue = createAdminRefreshQueue({ load: async () => { if (++reads === 1) throw Error("Network interrupted"); return ["latest record"]; },
    onData: value => { displayed = value; }, onError: () => failures++, onPending() {} });
  await queue.refresh();
  assert.deepEqual(displayed, ["remaining record"]);
  assert.equal(failures, 1);
  await queue.refresh();
  assert.deepEqual(displayed, ["latest record"]);
  assert.equal(reads, 2);
});

test("an unmounted workspace cannot publish a delayed response or error", async () => {
  const read = deferred(), published = [];
  const queue = createAdminRefreshQueue({ load: () => read.promise, onData: value => published.push(value),
    onError: error => published.push(error), onPending: value => published.push(value) });
  const work = queue.refresh(); await Promise.resolve();
  queue.deactivate(); read.reject(Error("late failure")); await work;
  assert.deepEqual(published, [true]);
  queue.activate();
  await queue.refresh();
  assert.equal(published.at(-1), false);
});

function sessionClients({ writable = false, cleanupFails = false } = {}) {
  let cookieWrites = 0, authChecks = 0, deletions = 0;
  const makeClient = handlers => ({
    auth: { getUser: async () => {
      authChecks++;
      handlers.cookies.setAll([{ name: "session", value: "renewed", options: {} }]);
      return { data: { user: { id: "admin", email: "admin@example.test", app_metadata: { role: "admin" } } }, error: null };
    } },
    from: () => ({ select: () => ({ limit: async () => ({ error: null }) }) }),
  });
  const server = compile("lib/supabase-server.ts", {
    "@supabase/ssr": { createServerClient: (_url, _key, handlers) => makeClient(handlers) },
    "next/headers": { cookies: async () => ({ getAll: () => [], set: () => {
      cookieWrites++; if (!writable) throw Error("Cookies can only be modified in a Server Action or Route Handler.");
    } }) },
    "next/server": {},
  });
  const actions = compile("app/actions/admin.actions.ts", {
    "@/lib/supabase-server": server,
    "next/cache": { revalidateTag() {} },
    "@supabase/supabase-js": { createClient: () => ({
      rpc: async () => { deletions++; return { data: { deleted_count: 1, receipt_paths: ["receipt.pdf"] }, error: null }; },
      storage: { from: () => ({ remove: async () => { if (cleanupFails) throw Error("Storage unavailable"); return { error: null }; } }) },
    }) },
    react: { cache: fn => fn }, "@/lib/rates": {}, "@/lib/pricing": {}, "@/lib/jalali": {},
    "@/lib/iran-bank-transfer-fees": {}, "@/lib/requests/receipt-upload": { REQUEST_RECEIPTS_BUCKET: "receipts" },
  });
  return { server, actions, get cookieWrites() { return cookieWrites; }, get authChecks() { return authChecks; }, get deletions() { return deletions; } };
}

test("admin authorization tolerates token renewal during a read-only server render", async () => {
  const session = sessionClients();
  const admin = await session.actions.requireAdmin();
  assert.equal(admin.id, "admin");
  assert.equal(session.authChecks, 1);
  assert.equal(session.cookieWrites, 0);
  // This is the exact failure the old writable-client authorization path exposed.
  const writableClient = await session.server.createSupabaseServerActionClient();
  await assert.rejects(writableClient.auth.getUser(), /Cookies can only be modified/);
});

test("actual Server Action cookie persistence remains available in a writable context", async () => {
  const session = sessionClients({ writable: true });
  const client = await session.server.createSupabaseServerActionClient();
  await client.auth.getUser();
  assert.equal(session.cookieWrites, 1);
});

test("receipt cleanup transport failure cannot turn a committed deletion into a failed action", async () => {
  const session = sessionClients({ cleanupFails: true });
  const result = await session.actions.hardDeleteTransaction("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.equal(result.success, true);
  assert.match(result.warning, /still need cleanup/);
  assert.equal(session.deletions, 1);
});

test("rejected asynchronous admin tasks resolve locally and never automatically repeat a write", async () => {
  let task, writes = 0, reads = 0;
  const notices = [];
  const feedback = {}, refresh = {};
  const { useAdminTransition } = compile("components/admin/ui/useAdminTransition.ts", {
    react: { useCallback: fn => fn, useContext: context => context === feedback ? { showToast: value => notices.push(value) } : async () => { reads++; },
      useTransition: () => [false, callback => { task = callback(); }] },
    "./AdminFeedbackProvider": { AdminFeedbackContext: feedback }, "./AdminRefreshScope": { AdminRefreshContext: refresh },
  });
  const [, start] = useAdminTransition({ refreshAfter: true });
  start(async () => { writes++; throw Error("Response lost"); });
  await assert.doesNotReject(task);
  assert.equal(writes, 1);
  assert.equal(reads, 1);
  assert.match(notices[0].message, /confirm the result/);
});

test("refresh failure after a successful admin task cannot reject the transition or replay the action", async () => {
  let task, writes = 0, reads = 0;
  const notices = [];
  const feedback = {}, refresh = {};
  const { useAdminTransition } = compile("components/admin/ui/useAdminTransition.ts", {
    react: { useCallback: fn => fn, useContext: context => context === feedback ? { showToast: value => notices.push(value) } : async () => { reads++; throw Error("Read failed"); },
      useTransition: () => [false, callback => { task = callback(); }] },
    "./AdminFeedbackProvider": { AdminFeedbackContext: feedback }, "./AdminRefreshScope": { AdminRefreshContext: refresh },
  });
  const [, start] = useAdminTransition({ refreshAfter: true });
  start(async () => { writes++; });
  await assert.doesNotReject(task);
  assert.equal(writes, 1);
  assert.equal(reads, 1);
  assert.match(notices[0].message, /without repeating your action/);
});

test("a scheduled refresh deactivated before it starts does not read or publish pending state", async () => {
  let reads = 0;
  const pending = [];
  const queue = createAdminRefreshQueue({ load: async () => { reads++; },
    onData() {}, onError() {}, onPending: value => pending.push(value) });
  const work = queue.refresh();
  queue.deactivate();
  await work;
  assert.equal(reads, 0);
  assert.deepEqual(pending, []);
});

test("confirmed KYC archive stays visible when its follow-up read fails and retry only reloads data", async () => {
  const customer = { id: "fixture-customer", kyc_status: "pending", created_at: "2026-10-08T00:00:00Z" };
  let unavailable = true, reads = 0;
  const h = dashboardHarness({ mocks: {
    "@/app/actions/admin.actions": {
      getKycQueue: async () => { reads++; if (unavailable) throw Error("Read interrupted"); return []; },
      getKycHistory: async () => ({ data: [{ ...customer, kyc_status: "archived" }], total: 1 }),
    },
    "@/components/admin/IdentityVerificationTable": { IdentityVerificationTable: () => null },
    "@/components/admin/AdminPagination": { AdminPagination: () => null },
  } });
  const { KycWorkspace } = h.load("components/admin/KycWorkspace.tsx");
  const props = { initialData: { queue: [customer], history: [], total: 0 }, currentPage: 1, pageSize: 20, historyView: false };
  let tree = h.render(KycWorkspace, props); h.effects();
  nodes(tree, node => node.props.onStatusChange)[0].props.onStatusChange(customer, "archived");
  await tree.props.refresh();
  tree = h.render(KycWorkspace, props);
  const tables = nodes(tree, node => node.props.onStatusChange);
  assert.deepEqual(tables[0].props.users, []);
  assert.equal(tables[1].props.users[0].kyc_status, "archived");
  const notice = nodes(tree, node => node.type?.name === "AdminRefreshNotice")[0];
  assert.equal(notice.props.error, true);
  unavailable = false;
  await notice.props.onRefresh();
  tree = h.render(KycWorkspace, props);
  assert.equal(nodes(tree, node => node.type?.name === "AdminRefreshNotice")[0].props.error, false);
  assert.equal(reads, 2);
  h.cleanup();
});

test("customer profile remains available and cannot hide a separate bank-account read failure", async () => {
  const profile = { profile: { id: "fixture-customer" }, approvedVolume: 0, approvedCount: 0, currentRates: {}, transactions: [], testimonials: [] };
  let accountsUnavailable = true;
  const mocks = {
    "@/app/actions/admin.actions": {
      getUserFinancialProfile: async () => profile,
      getActiveBankAccountsForAdmin: async () => { if (accountsUnavailable) throw Error("Accounts unavailable"); return []; },
    },
    "@/lib/pricing": { calcLoyaltyDiscountPct: () => 0 },
  };
  for (const name of ["UserSearchPanel", "UserFinancialStats", "UserKycManager", "UserTransactionTimeline", "UserFeedbackHistory", "UserRecipientsPanel", "AssistedOnboardingPanel"]) {
    mocks[`@/components/admin/users/${name}`] = { [name]: () => null };
  }
  const h = dashboardHarness({ mocks });
  const { UsersPageClient } = h.load("components/admin/users/UsersPageClient.tsx");
  const props = { financeConfig: {}, initialUserId: "fixture-customer" };
  h.render(UsersPageClient, props); h.effects();
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  let tree = h.render(UsersPageClient, props);
  assert.equal(nodes(tree, node => node.props.profile === profile.profile).length, 1);
  const notice = nodes(tree, node => node.type?.name === "AdminRefreshNotice")[0];
  assert.equal(notice.props.error, true);
  accountsUnavailable = false;
  await notice.props.onRefresh();
  tree = h.render(UsersPageClient, props);
  assert.equal(nodes(tree, node => node.type?.name === "AdminRefreshNotice")[0].props.error, false);
  assert.equal(nodes(tree, node => node.props.profile === profile.profile).length, 1);
  h.cleanup();
});

test("customer profile keeps a confirmed archive when the follow-up profile read fails", async () => {
  const profile = { profile: { id: "fixture-customer", kyc_status: "pending" }, approvedVolume: 0, approvedCount: 0, currentRates: {}, transactions: [], testimonials: [] };
  let unavailable = false, reads = 0;
  const mocks = {
    "@/app/actions/admin.actions": {
      getUserFinancialProfile: async () => { reads++; if (unavailable) throw Error("Profile unavailable"); return profile; },
      getActiveBankAccountsForAdmin: async () => [],
    },
    "@/lib/pricing": { calcLoyaltyDiscountPct: () => 0 },
  };
  for (const name of ["UserSearchPanel", "UserFinancialStats", "UserKycManager", "UserTransactionTimeline", "UserFeedbackHistory", "UserRecipientsPanel", "AssistedOnboardingPanel"]) {
    mocks[`@/components/admin/users/${name}`] = { [name]: () => null };
  }
  const h = dashboardHarness({ mocks });
  const { UsersPageClient } = h.load("components/admin/users/UsersPageClient.tsx");
  const props = { financeConfig: {}, initialUserId: "fixture-customer" };
  h.render(UsersPageClient, props); h.effects();
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  let tree = h.render(UsersPageClient, props);
  nodes(tree, node => node.props.onKycStatusCommitted)[0].props.onKycStatusCommitted("archived");
  unavailable = true;
  await tree.props.refresh();
  tree = h.render(UsersPageClient, props);
  const manager = nodes(tree, node => node.props.onKycStatusCommitted)[0];
  assert.equal(manager.props.profile.kyc_status, "archived");
  assert.equal(nodes(tree, node => node.type?.name === "AdminRefreshNotice")[0].props.error, true);
  assert.equal(reads, 2);
  h.cleanup();
});
