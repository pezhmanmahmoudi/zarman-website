/* eslint-disable @typescript-eslint/no-require-imports -- Offline integration tests. */
const assert = require("node:assert/strict");
const test = require("node:test");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { dashboardHarness, request: fixture } = require("./helpers/dashboard-harness.cjs");

const request = { ...fixture, quote: { ...fixture.quote, sender_snapshot: { name: "Alex Morgan", email: "alex@example.test" } } };
const row = (id, workflow = null, extra = {}) => ({
  id, user_id: "customer", created_at: "2026-09-15T01:20:00Z", type: "buy_aud", status: "pending",
  reference_code: `ZE-${id}`, amount_aud: 100, equivalent_toman: 10000000,
  request: workflow ? { ...request, id: `request-${id}`, transaction_id: id, reference_code: `ZE-${id}`, ...workflow } : null,
  profiles: { first_name: "Taylor", last_name: "Smith", email: "taylor@example.test" }, ...extra,
});
function manualApproval({ transactionId }) { return React.createElement("button", { "data-manual": transactionId }, "Manual approval"); }
const tableMocks = {
  "./AdminDialog": { AdminDialog: ({ children, labelledBy, variant }) => React.createElement("section", { role: "dialog", "aria-labelledby": labelledBy, "data-variant": variant }, children) },
  "@/components/admin/ui/AdminDialog": { AdminDialog: ({ children, labelledBy, variant }) => React.createElement("section", { role: "dialog", "aria-labelledby": labelledBy, "data-variant": variant }, children) },
  "@/components/admin/TransactionApproveButton": { TransactionApproveButton: manualApproval },
  "@/components/admin/EditableReferenceCode": { EditableReferenceCode: ({ transactionId }) => React.createElement("button", { "data-edit-ref": transactionId }, "Edit reference") },
  "@/components/admin/EditableAmount": { EditableAmount: ({ transactionId }) => React.createElement("button", { "data-edit-amount": transactionId }, "Edit amount") },
  "@/components/admin/SendReceiptButton": { SendReceiptButton: () => null },
  "@/components/admin/RejectApprovedButton": { RejectApprovedButton: () => null },
};
const queueHarness = () => dashboardHarness({ mocks: tableMocks });
const markup = tree => renderToStaticMarkup(tree);
function nodes(tree, match) {
  if (!tree || typeof tree !== "object") return [];
  return [...(match(tree) ? [tree] : []), ...React.Children.toArray(tree.props?.children).flatMap(child => nodes(child, match))];
}
const text = tree => typeof tree === "string" || typeof tree === "number" ? String(tree) : React.Children.toArray(tree?.props?.children).map(text).join("");

test("one queue preserves manual approval and routes linked transfers through their workflow", () => {
  const h = queueHarness();
  const { TransactionQueue } = h.load("components/admin/transactions/TransactionQueue.tsx");
  const rows = [row("manual"), row("online", { status: "ready" })];
  const html = markup(h.render(TransactionQueue, { rows, bankAccounts: [] }));
  assert.equal((html.match(/class="AdminWorkspace_recordRow"/g) ?? []).length, 2);
  assert.match(html, /data-manual="manual"/);
  assert.doesNotMatch(html, /data-manual="online"/);
  assert.match(html, /href="\/admin\/transactions\/requests\/request-online"/);
  assert.match(html, /Reconcile &amp; complete/);
});

test("funding updates change next step; funded holds and customer questions cannot enter To complete", () => {
  const h = queueHarness();
  const { TransactionQueue } = h.load("components/admin/transactions/TransactionQueue.tsx");
  const rows = [row("hold", {}), row("ready", { status: "ready" }), row("reply", { status: "ready", customer_action_required: "Please clarify" })];
  let tree = h.render(TransactionQueue, { rows, bankAccounts: [] });
  nodes(tree, node => node.type === "button" && text(node).startsWith("To complete"))[0].props.onClick();
  tree = h.render(TransactionQueue, { rows, bankAccounts: [] });
  assert.match(markup(tree), /ZE-ready/);
  assert.doesNotMatch(markup(tree), /ZE-hold|ZE-reply/);
  const updated = rows.map(item => item.id === "hold" ? { ...item, request: { ...item.request, status: "ready" } } : item);
  assert.match(markup(h.render(TransactionQueue, { rows: updated, bankAccounts: [] })), /ZE-hold/);
});

test("queue search covers snapshot customers, manual customers and transaction codes", () => {
  const h = queueHarness();
  const { TransactionQueue } = h.load("components/admin/transactions/TransactionQueue.tsx");
  const props = { rows: [row("manual"), row("online", {})], bankAccounts: [] };
  for (const [search, found, absent] of [["alex morgan", "ZE-online", "ZE-manual"], ["ZE-manual", "ZE-manual", "ZE-online"]]) {
    const tree = h.render(TransactionQueue, props);
    nodes(tree, node => node.type === "input")[0].props.onChange({ target: { value: search } });
    const html = markup(h.render(TransactionQueue, props));
    assert.ok(html.includes(found)); assert.ok(!html.includes(absent));
  }
});

test("request row email and rejection shortcuts stay visible without offering legacy accounting actions", () => {
  const h = queueHarness();
  const { TransactionTable } = h.load("components/admin/transactions/TransactionTable.tsx");
  const html = markup(h.render(TransactionTable, { isPending: true, bankAccounts: [], rows: [
    row("review", { status: "under_review" }), row("paying", { status: "processing" }), row("done", { status: "completed" }),
  ] }));
  assert.match(html, /request-review\?intent=reject/);
  for (const id of ["review", "paying", "done"]) assert.ok(html.includes("request-" + id + "?intent=email#request-conversation"));
  assert.doesNotMatch(html, /request-(?:paying|done)\?intent=reject/);
  assert.doesNotMatch(html, /data-manual/);
});

test("request shortcuts accept only explicit email or reject intents", async () => {
  const h = dashboardHarness({ mocks: {
    "@/components/requests/RequestDetailView": { RequestDetailView: () => null },
  } });
  const page = h.load("app/(panel)/admin/(protected)/transactions/requests/[id]/page.tsx").default;
  for (const intent of ["email", "reject", "complete", ["reject"]]) {
    const tree = await page({ params: Promise.resolve({ id: "test-request" }), searchParams: Promise.resolve({ intent }) });
    const view = nodes(tree, node => node.props.id === "test-request")[0];
    assert.equal(view.props.initialIntent, intent === "email" || intent === "reject" ? intent : undefined);
  }
});

test("refund work takes precedence even after cancellation, and earliest due transfer sorts first", () => {
  const h = dashboardHarness();
  const { transactionQueueState, sortTransactionQueue } = h.load("lib/admin-transaction-workspace.ts");
  const refund = row("refund", { status: "cancelled", funding_status: "refund_pending" });
  assert.equal(transactionQueueState(refund).stage, "refund");
  const due = row("due", { handling_due_at: "2026-09-15T03:00:00Z" });
  const rows = [refund, row("manual"), due];
  assert.equal(sortTransactionQueue(rows)[0].id, "due");
  assert.equal(rows[0], refund);
  assert.equal(transactionQueueState(row("terminal", { status: "completed" })).stage, "closed");
});

test("history keeps exports and legacy edits but does not offer incompatible edits or approval for online requests", () => {
  const h = dashboardHarness({ pathname: "/admin/transactions", query: "view=history", mocks: {
    ...tableMocks,
    "@/app/actions/admin.actions": {},
    "@/components/admin/TransactionApproveButton": { TransactionApproveButton: manualApproval },
    "@/components/admin/EditableReferenceCode": { EditableReferenceCode: ({ transactionId }) => React.createElement("button", { "data-edit-ref": transactionId }, "Edit reference") },
    "@/components/admin/EditableAmount": { EditableAmount: ({ transactionId }) => React.createElement("button", { "data-edit-amount": transactionId }, "Edit amount") },
    "@/components/admin/SendReceiptButton": { SendReceiptButton: ({ transactionId }) => React.createElement("button", { "data-email": transactionId }, "Send receipt") },
    "@/components/admin/RejectApprovedButton": { RejectApprovedButton: ({ transactionId }) => React.createElement("button", { "data-reject": transactionId }, "Reject") },
    "@/components/admin/AdminPagination": { AdminPagination: () => null },
    "@/components/ui/SelectBox/SelectBox": { SelectBox: () => null },
    "@/components/ui/DatePicker/CustomDatePicker": { __esModule: true, default: () => null },
  } });
  const { TransactionTable } = h.load("components/admin/transactions/TransactionTable.tsx");
  const props = { rows: [row("manual", null, { status: "approved" }), row("online", { status: "completed" }, { status: "approved" })], isPending: false, bankAccounts: [] };
  let tree = h.render(TransactionTable, props);
  assert.doesNotMatch(markup(tree), /data-edit-ref/);
  assert.match(markup(tree), /data-email="manual"/);
  assert.match(markup(tree), /data-reject="manual"/);
  assert.match(markup(tree), /<strong><bdi>Taylor Smith<\/bdi><\/strong>/);
  nodes(tree, node => node.props["aria-label"] === "View details for ZE-manual")[0].props.onClick();
  tree = h.render(TransactionTable, props);
  const html = markup(tree);
  assert.match(html, /data-edit-ref="manual"/);
  assert.match(html, /data-email="manual"/);
  assert.match(html, /data-reject="manual"/);
  assert.doesNotMatch(html, /data-(?:edit-ref|edit-amount|reject|email)="online"/);
  assert.match(html, /Select transaction ZE-online/);
  assert.match(html, /role="dialog"[^>]+data-variant="drawer-right"/);
  const detail = nodes(tree, node => node.type?.name === "TransactionDetails")[0];
  detail.props.onClose();
  tree = h.render(TransactionTable, props);
  assert.doesNotMatch(markup(tree), /role="dialog"/);
  nodes(tree, node => node.props["aria-label"] === "View details for ZE-online")[0].props.onClick();
  const requestTree = h.render(TransactionTable, props);
  const requestHtml = markup(nodes(requestTree, node => node.type?.name === "TransactionDetails")[0]);
  assert.match(requestHtml, /\/api\/requests\/request-online\/receipt/);
  assert.doesNotMatch(requestHtml, /data-edit-ref|data-edit-amount|data-reject|data-email/);
});

test("manual review opens the existing approval controls and a refreshed request never gains manual editing", () => {
  const h = queueHarness();
  const { TransactionTable } = h.load("components/admin/transactions/TransactionTable.tsx");
  const props = { rows: [row("manual")], isPending: true, bankAccounts: [] };
  let tree = h.render(TransactionTable, props);
  nodes(tree, node => node.props["aria-label"] === "View details for ZE-manual")[0].props.onClick();
  assert.match(markup(h.render(TransactionTable, props)), /data-manual="manual"/);
  const refreshed = markup(h.render(TransactionTable, { ...props, rows: [row("manual", { status: "ready" })] }));
  assert.match(refreshed, /Reconcile &amp; complete/);
  assert.doesNotMatch(refreshed, /data-manual|data-edit-ref|data-edit-amount/);
});

test("settings sections keep both forms mounted when switching; old deep links open service settings", () => {
  const originalWindow = global.window;
  global.window = { location: { hash: "#request-notifications" }, history: { replaceState() {} }, addEventListener() {}, removeEventListener() {} };
  try {
    const h = dashboardHarness({ mocks: { "@/components/requests/RequestSettingsForm": { RequestSettingsForm: () => null } } });
    const { SettingsWorkspace } = h.load("components/admin/SettingsWorkspace.tsx");
    const platform = React.createElement("input", { defaultValue: "Unsaved rate" });
    h.render(SettingsWorkspace, { platform }); h.effects();
    let tree = h.render(SettingsWorkspace, { platform });
    assert.equal(nodes(tree, node => node.props.id === "transfer-settings")[0].props.hidden, false);
    nodes(tree, node => node.type === "button" && node.props["aria-controls"] === "platform-settings")[0].props.onClick();
    tree = h.render(SettingsWorkspace, { platform });
    assert.equal(nodes(tree, node => node.props.id === "platform-settings")[0].props.children, platform);
    assert.equal(nodes(tree, node => node.props.id === "transfer-settings").length, 1);
  } finally { global.window = originalWindow; }
});

test("old request URLs redirect into Transactions and keep the exact request identity", async () => {
  const destinations = [];
  const h = dashboardHarness({ mocks: { "next/navigation": { redirect: href => destinations.push(href) } } });
  h.load("app/(panel)/admin/(protected)/requests/page.tsx").default();
  await h.load("app/(panel)/admin/(protected)/requests/[id]/page.tsx").default({ params: Promise.resolve({ id: "existing-request" }) });
  assert.deepEqual(destinations, ["/admin/transactions", "/admin/transactions/requests/existing-request"]);
});

test("refresh updates workflow data atomically and retains the last good records on a failed read", async () => {
  let fail = false;
  const actions = {
    getPendingTransactionsWithDetails: async () => { if (fail) throw Error("Unavailable"); return [row("online", { status: "ready" })]; },
    getTransactionHistoryWithDetails: async () => ({ data: [], total: 0 }),
    getTransactionHistoryStatusCounts: async () => ({ all: 0, approved: 0, rejected: 0, archived: 0 }),
    getActiveBankAccountsForAdmin: async () => [],
  };
  const h = dashboardHarness({ mocks: { ...tableMocks, "@/app/actions/admin.actions": actions,
    "@/components/admin/AdminPagination": { AdminPagination: () => null },
    "@/components/ui/SelectBox/SelectBox": { SelectBox: () => null },
    "@/components/ui/DatePicker/CustomDatePicker": { __esModule: true, default: () => null },
  } });
  const { TransactionsManager } = h.load("components/admin/transactions/TransactionsManager.tsx");
  const props = { view: "active", search: "", pending: [row("online", {})], history: [], total: 0,
    currentPage: 1, pageSize: 10, historyStatus: "all", historyDirection: "all", startDate: "", endDate: "",
    statusTabs: [{ key: "all", label: "All", count: 0 }], bankAccounts: [] };
  let tree = h.render(TransactionsManager, props);
  await nodes(tree, node => node.type === "button" && text(node) === "Refresh")[0].props.onClick();
  tree = h.render(TransactionsManager, props);
  assert.equal(nodes(tree, node => node.type?.name === "TransactionQueue")[0].props.rows[0].request.status, "ready");
  fail = true;
  await nodes(tree, node => node.type === "button" && text(node) === "Refresh")[0].props.onClick();
  tree = h.render(TransactionsManager, props);
  assert.equal(nodes(tree, node => node.type?.name === "TransactionQueue")[0].props.rows[0].request.status, "ready");
  assert.match(text(nodes(tree, node => node.props.role === "alert")[0]), /last loaded records/);
});

test("a report selection cannot become a delete selection after a background status change", async () => {
  const approved = row("selected", null, { status: "approved" });
  const h = dashboardHarness({ mocks: { ...tableMocks, "@/app/actions/admin.actions": {
    getPendingTransactionsWithDetails: async () => [],
    getTransactionHistoryWithDetails: async () => ({ data: [{ ...approved, status: "rejected" }], total: 1 }),
    getTransactionHistoryStatusCounts: async () => ({ all: 1, approved: 0, rejected: 1, archived: 0 }),
    getActiveBankAccountsForAdmin: async () => [],
  },
  "@/components/admin/AdminPagination": { AdminPagination: () => null },
  "@/components/ui/SelectBox/SelectBox": { SelectBox: () => null },
  "@/components/ui/DatePicker/CustomDatePicker": { __esModule: true, default: () => null },
  } });
  const { TransactionsManager } = h.load("components/admin/transactions/TransactionsManager.tsx");
  const props = { view: "history", search: "", pending: [], history: [approved], total: 1, currentPage: 1, pageSize: 10,
    historyStatus: "all", historyDirection: "all", startDate: "", endDate: "", statusTabs: [{ key: "all", label: "All", count: 1 }], bankAccounts: [] };
  let tree = h.render(TransactionsManager, props);
  nodes(tree, node => node.type?.name === "TransactionTable")[0].props.onToggleRow("selected", true);
  tree = h.render(TransactionsManager, props);
  assert.equal(nodes(tree, node => node.type?.name === "TransactionTable")[0].props.selectionAction, "export");
  await nodes(tree, node => node.type === "button" && text(node) === "Refresh")[0].props.onClick();
  tree = h.render(TransactionsManager, props);
  const table = nodes(tree, node => node.type?.name === "TransactionTable")[0];
  assert.equal(table.props.selectedIds.size, 0);
  assert.equal(table.props.selectionAction, null);
  assert.equal(nodes(tree, node => node.type === "button" && text(node) === "Delete selected").length, 0);
});

test("date filters keep drafts, reject reversed ranges and preserve other filters when applied", () => {
  const pushed = [];
  const h = dashboardHarness({ mocks: { ...tableMocks,
    "next/navigation": {
      usePathname: () => "/admin/transactions",
      useSearchParams: () => new URLSearchParams("view=history&status=approved&q=Alex&page=3"),
      useRouter: () => ({ push: url => pushed.push(url) }),
    },
    "@/app/actions/admin.actions": {},
    "@/components/admin/AdminPagination": { AdminPagination: () => null },
    "@/components/ui/SelectBox/SelectBox": { SelectBox: () => null },
    "@/components/ui/DatePicker/CustomDatePicker": { __esModule: true, default: () => null },
  } });
  const { TransactionsManager } = h.load("components/admin/transactions/TransactionsManager.tsx");
  const props = { view: "history", search: "Alex", pending: [], history: [], total: 0, currentPage: 3, pageSize: 10,
    historyStatus: "approved", historyDirection: "all", startDate: "", endDate: "", statusTabs: [], bankAccounts: [] };
  let tree = h.render(TransactionsManager, props);
  assert.equal(nodes(tree, node => node.props.id === "history-date-filters")[0].props.hidden, true);
  nodes(tree, node => node.props["aria-controls"] === "history-date-filters")[0].props.onClick();
  nodes(tree, node => node.props.placeholder === "Start date")[0].props.onChange("2026-09-20");
  nodes(tree, node => node.props.placeholder === "End date")[0].props.onChange("2026-09-10");
  tree = h.render(TransactionsManager, props);
  nodes(tree, node => node.type === "button" && text(node) === "Apply dates")[0].props.onClick();
  tree = h.render(TransactionsManager, props);
  assert.match(text(nodes(tree, node => node.props.role === "alert")[0]), /end date must be on or after/);
  assert.equal(pushed.length, 0);
  nodes(tree, node => node.props["aria-controls"] === "history-date-filters")[0].props.onClick();
  tree = h.render(TransactionsManager, props);
  assert.equal(nodes(tree, node => node.props.placeholder === "Start date")[0].props.value, "2026-09-20");
  nodes(tree, node => node.props.placeholder === "End date")[0].props.onChange("2026-09-25");
  tree = h.render(TransactionsManager, props);
  nodes(tree, node => node.type === "button" && text(node) === "Apply dates")[0].props.onClick();
  const query = new URL(pushed[0], "https://example.test").searchParams;
  for (const [key, value] of Object.entries({ status: "approved", q: "Alex", page: "1", start: "2026-09-20", end: "2026-09-25" })) assert.equal(query.get(key), value);
});
