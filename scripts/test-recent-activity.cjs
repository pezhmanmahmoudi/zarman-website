/* eslint-disable @typescript-eslint/no-require-imports -- Offline integration checks. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { dashboardHarness, request } = require("./helpers/dashboard-harness.cjs");
const fixture = { ...request, version: 1, quote: { ...request.quote, applied_rate: 105000 } };
const now = Date.parse("2026-09-21T04:00:00Z");
const markup = element => renderToStaticMarkup(element);
const tick = () => new Promise(resolve => setImmediate(resolve));
function elements(tree, predicate) {
  const found = [];
  function walk(node) { if (!React.isValidElement(node)) return; if (predicate(node)) found.push(node); React.Children.forEach(node.props.children, walk); }
  walk(tree); return found;
}

test("recent records sort by real update time, deduplicate by ID, and never mutate the feed", () => {
  const { recentActivityRequests, requestActivityTime } = dashboardHarness().load("lib/dashboard/recent-activity.ts");
  const latest = { ...fixture, id: "latest", updated_at: "2026-09-21T03:59:00Z" };
  const older = { ...fixture, id: "older", updated_at: "2026-09-20T03:00:00Z" };
  const invalid = { ...fixture, id: "invalid", updated_at: "invalid", created_at: "invalid" };
  const improved = { ...older, updated_at: latest.updated_at, version: 2 };
  const feed = [older, invalid, latest, improved];
  assert.deepEqual(recentActivityRequests(feed).map(row => row.id), ["latest", "older", "invalid"]);
  assert.equal(recentActivityRequests(feed)[1], improved);
  assert.deepEqual(feed, [older, invalid, latest, improved]);
  assert.equal(recentActivityRequests(feed, 1).length, 1);
  assert.equal(requestActivityTime({ updated_at: "bad", created_at: fixture.created_at }), fixture.created_at);
  assert.equal(requestActivityTime(invalid), null);
});

test("relative timestamps use database instants, Persian language and safe invalid/future handling", () => {
  const { relativeActivityTime } = dashboardHarness().load("lib/dashboard/recent-activity.ts");
  assert.equal(relativeActivityTime("2026-09-21T02:00:00Z", "en", now), "2 hours ago");
  assert.equal(relativeActivityTime("2026-09-21T02:00:00Z", "fa", now), new Intl.RelativeTimeFormat("fa-IR", { numeric: "always" }).format(-2, "hour"));
  assert.equal(relativeActivityTime("2026-09-20T04:00:00Z", "en", now), "1 day ago");
  assert.equal(relativeActivityTime("2026-09-21T03:59:30Z", "en", now), "Just now");
  assert.equal(relativeActivityTime("2026-09-21T04:00:10Z", "fa", now), "همین حالا");
  assert.equal(relativeActivityTime("bad", "fa", now), "—");
});

test("status colors distinguish customer action from admin review and never show a refund as completed", () => {
  const { activityAppearance } = dashboardHarness().load("lib/dashboard/recent-activity.ts");
  const unpaid = { ...fixture, funding_status: "unpaid", funds_confirmed_at: null, evidence_submitted_at: null };
  assert.deepEqual(activityAppearance({ ...unpaid, status: "awaiting_funds" }), { tone: "attention", icon: "upload" });
  assert.deepEqual(activityAppearance({ ...unpaid, status: "under_review" }), { tone: "neutral", icon: "clock" });
  assert.deepEqual(activityAppearance(fixture), { tone: "neutral", icon: "clock" });
  assert.deepEqual(activityAppearance({ ...fixture, customer_action_required: "Please reply" }), { tone: "attention", icon: "message" });
  assert.deepEqual(activityAppearance({ ...fixture, status: "completed" }), { tone: "complete", icon: "check" });
  assert.equal(activityAppearance({ ...fixture, status: "rejected" }).tone, "failed");
  assert.equal(activityAppearance({ ...fixture, status: "expired" }).tone, "failed");
  assert.equal(activityAppearance({ ...fixture, status: "processing" }).tone, "processing");
  assert.equal(activityAppearance({ ...fixture, status: "completed", priority_fee_status: "refund_pending" }).tone, "neutral");
  assert.deepEqual(activityAppearance({ ...fixture, priority_fee_status: "refund_pending", customer_action_required: "Please confirm details" }), { tone: "attention", icon: "message" });
  assert.equal(activityAppearance({ ...fixture, funding_status: "refunded" }).tone, "neutral");
});

test("real record props render once in both locales with status, reference, privacy, date and detail URL", () => {
  for (const locale of ["en", "fa"]) {
    const h = dashboardHarness({ locale });
    const { RecentActivityList } = h.load("components/dashboard/recent-activity-list.tsx");
    const quoted = { ...fixture, updated_at: "2026-09-21T02:00:00Z", quote: { ...fixture.quote, recipient_snapshot: { full_name: "<script>recipient</script>" } } };
    h.values[0] = now;
    const html = markup(React.createElement(RecentActivityList, { requests: [quoted, quoted], locale, motionEnabled: false, onRefresh() {} }));
    assert.equal((html.match(/ZE36827/g) || []).length, 1);
    assert.equal((html.match(/role="listitem"/g) || []).length, 1);
    assert.match(html, new RegExp(`href="/${locale}/dashboard/requests/fixture-request"`));
    assert.match(html, /dateTime="2026-09-21T02:00:00Z"/);
    assert.match(html, /data-private-value="true"/);
    assert.match(html, locale === "en" ? /234,675,000 Toman/ : /۲۳۴٬۶۷۵٬۰۰۰ تومان/);
    assert.match(html, locale === "en" ? /2 hours ago/ : /۲ ساعت پیش/);
    assert.match(html, /&lt;script&gt;recipient&lt;\/script&gt;/);
    assert.doesNotMatch(html, /<script>|Magic UI|Payment received·15m/);
    assert.match(html, locale === "en" ? /dir="ltr"/ : /dir="rtl"/);
  }
});

test("live list displays every supplied item in its existing order, without a demo reveal timer", () => {
  const h = dashboardHarness();
  const { AnimatedList } = h.load("components/ui/animated-list.tsx");
  const tree = React.createElement(AnimatedList, { mode: "live", role: "list", motionEnabled: false },
    ["ZE30000", "ZE10000", "ZE20000"].map(code => React.createElement("a", { key: code, href: `#${code}` }, code)));
  const html = markup(tree);
  assert.equal((html.match(/role="listitem"/g) || []).length, 3);
  assert.ok(html.indexOf("ZE30000") < html.indexOf("ZE10000") && html.indexOf("ZE10000") < html.indexOf("ZE20000"));
  assert.doesNotMatch(html, /opacity:0|scale\(0\)/);
});

test("loading, empty and failed states stay distinct, and stale records remain available with retry", () => {
  const buttons = []; let refreshed = 0;
  const h = dashboardHarness({ mocks: { "@/components/ui/button": { Button: ({ asChild, children, ...props }) => {
    buttons.push(props); return asChild ? React.cloneElement(React.Children.only(children), props) : React.createElement("button", props, children);
  } } } });
  const { RecentActivityList } = h.load("components/dashboard/recent-activity-list.tsx");
  const render = props => markup(React.createElement(RecentActivityList, { requests: [], locale: "en", onRefresh() { refreshed++; }, motionEnabled: false, ...props }));
  assert.match(render({ loading: true }), /role="status"/);
  assert.doesNotMatch(render({ loading: true }), /Your next connection starts here/);
  assert.match(render({}), /href="\/en\/dashboard\?tab=transfer"/);
  assert.doesNotMatch(render({ error: true }), /Your next connection starts here/);
  buttons.length = 0;
  const html = render({ error: true, requests: [fixture] });
  assert.match(html, /Showing the last loaded updates/); assert.match(html, /ZE36827/);
  buttons.find(button => typeof button.onClick === "function").onClick(); assert.equal(refreshed, 1);
});

test("overview passes the same live feed and motion preference to the new recent list", () => {
  const Marker = () => null;
  const feed = { requests: [fixture], loading: false, error: false, refreshing: false, refresh() {} };
  const h = dashboardHarness({ mocks: {
    "./DashboardShell": { useDashboard: () => ({ profile: { kyc_status: "approved" }, motionEnabled: false }) },
    "@/hooks/useDashboardRequests": { useDashboardRequests: () => feed },
    "@/context/FinanceConfigContext": { useFinanceConfig: () => ({}) },
    "./recent-activity-list": { RecentActivityList: Marker },
  } });
  const { DashboardOverview } = h.load("components/dashboard/DashboardOverview.tsx");
  const row = elements(h.render(DashboardOverview, { volume: 0, completedCount: 0, tailoredRate: 105000 }), node => node.type === Marker)[0];
  assert.ok(row); assert.equal(row.props.requests, feed.requests); assert.equal(row.props.motionEnabled, false); assert.equal(row.props.locale, "en");
});

test("a Supabase realtime signal refreshes request data and the animated row follows the new status", async () => {
  const previous = { window: global.window, document: global.document };
  const listeners = new Map();
  global.window = { setInterval() { return 1; }, clearInterval() {}, addEventListener(event, fn) { listeners.set(event, fn); }, removeEventListener() {} };
  global.document = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
  let signal, calls = 0;
  let records = [{ ...fixture, status: "awaiting_funds", funding_status: "unpaid", funds_confirmed_at: null, evidence_submitted_at: null }];
  const hook = dashboardHarness({ mocks: {
    "@/app/actions/request.actions": { listMyRequests: async () => { calls++; return { data: records }; } },
    "@/lib/supabase": { supabase: { channel: () => ({ on(event, filter, callback) { assert.equal(filter.table, "exchange_request_realtime_signals"); signal = callback; return this; }, subscribe() { return this; } }), removeChannel: async () => {} } },
  } });
  const { useDashboardRequests } = hook.load("hooks/useDashboardRequests.ts");
  const { RecentActivityList } = dashboardHarness().load("components/dashboard/recent-activity-list.tsx");
  const show = () => markup(React.createElement(RecentActivityList, { ...hook.render(useDashboardRequests), locale: "en", onRefresh() {}, motionEnabled: false }));
  try {
    hook.render(useDashboardRequests); hook.effects(); await tick();
    assert.match(show(), /data-tone="attention"/);
    records = [{ ...fixture, updated_at: "2026-09-21T04:00:00Z" }]; signal(); await tick();
    const html = show(); assert.match(html, /Funds received/); assert.match(html, /data-tone="neutral"/);
    assert.equal((html.match(/ZE36827/g) || []).length, 1); assert.equal(calls, 2);
  } finally { hook.cleanup(); global.window = previous.window; global.document = previous.document; }
});
