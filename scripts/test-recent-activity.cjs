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
    const html = markup(React.createElement(RecentActivityList, { requests: [quoted, quoted], locale, motionEnabled: false }));
    assert.equal((html.match(/data-transaction-summary=/g) || []).length, 1);
    assert.equal((html.match(/ZE36827/g) || []).length, 1);
    assert.match(html, new RegExp(`href="/${locale}/dashboard/requests/fixture-request"`));
    assert.match(html, new RegExp(`dateTime="${fixture.created_at}"`));
    assert.match(html, /data-private-value="true"/);
    assert.match(html, locale === "en" ? /Funds received/ : /وجه دریافت شد/);
    assert.match(html, /&lt;script&gt;recipient&lt;\/script&gt;/);
    assert.doesNotMatch(html, /<script>|Magic UI|Payment received·15m/);
    assert.match(html, locale === "en" ? /dir="ltr"/ : /dir="rtl"/);
  }
});

test("overview activity preview shows only the newest real record", () => {
  const h = dashboardHarness();
  const { RecentActivityList } = h.load("components/dashboard/recent-activity-list.tsx");
  const rows = [
    { ...fixture, id: "old", reference_code: "ZE-OLD", updated_at: "2026-09-19T00:00:00Z" },
    { ...fixture, id: "middle", reference_code: "ZE-MIDDLE", updated_at: "2026-09-20T00:00:00Z" },
    { ...fixture, id: "new", reference_code: "ZE-NEW", updated_at: "2026-09-21T00:00:00Z" },
  ];
  const html = markup(React.createElement(RecentActivityList, { requests: rows, locale: "en", motionEnabled: false }));
  assert.match(html, /ZE-NEW/);
  assert.doesNotMatch(html, /ZE-MIDDLE|ZE-OLD/);
  assert.equal((html.match(/data-transaction-summary=/g) || []).length, 1);
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

test("loading and empty states have no fake rows, and activity has no refresh or new-transfer buttons", () => {
  const buttons = []; let refreshed = 0;
  const h = dashboardHarness({ mocks: { "@/components/ui/button": { Button: ({ asChild, children, ...props }) => {
    buttons.push(props); return asChild ? React.cloneElement(React.Children.only(children), props) : React.createElement("button", props, children);
  } } } });
  const { RecentActivityList } = h.load("components/dashboard/recent-activity-list.tsx");
  const render = props => markup(React.createElement(RecentActivityList, { requests: [], locale: "en", onRefresh() { refreshed++; }, motionEnabled: false, ...props }));
  assert.match(render({ loading: true }), /role="status"/);
  assert.doesNotMatch(render({ loading: true }), /Your next connection starts here/);
  assert.match(render({}), /No transactions yet/);
  assert.doesNotMatch(render({}), /href="\/en\/dashboard\?tab=transfer"|h-12 rounded-2xl|role="listitem"/);
  assert.doesNotMatch(render({ error: true }), /Your next connection starts here/);
  buttons.length = 0;
  const html = render({ error: true, requests: [fixture] });
  assert.match(html, /Showing the last loaded updates/); assert.match(html, /ZE36827/);
  assert.equal(buttons.filter(button => typeof button.onClick === "function").length, 0);
  assert.equal(refreshed, 0);
  assert.match(html, /href="\/en\/dashboard\?tab=history"/);
});

test("overview passes the same live feed and motion preference to the new recent list", () => {
  const Marker = () => null;
  const feed = { requests: [fixture], loading: false, error: false, refreshing: false, refresh() {} };
  const h = dashboardHarness({ mocks: {
    "./DashboardShell": { useDashboard: () => ({ profile: { kyc_status: "approved" }, motionEnabled: false }) },
    "@/hooks/useDashboardRequests": { useDashboardRequests: () => feed },
    "@/context/FinanceConfigContext": { useFinanceConfig: () => ({}) },
    "./recent-activity-list": { RecentActivityList: Marker },
    "./DashboardOverviewRecipients": { DashboardOverviewRecipients: () => null },
  } });
  const { DashboardOverview } = h.load("components/dashboard/DashboardOverview.tsx");
  const row = elements(h.render(DashboardOverview, { volume: 0, completedCount: 0, baseBuyRate: 105000, baseSellRate: 106000 }), node => node.type === Marker)[0];
  assert.ok(row); assert.equal(row.props.requests, feed.requests); assert.equal(row.props.motionEnabled, false); assert.equal(row.props.locale, "en");
});

test("a due Supabase realtime signal refreshes request data and the latest card follows the new status", async () => {
  const previous = { window: global.window, document: global.document };
  const originalNow = Date.now; let clock = now; Date.now = () => clock;
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
    assert.match(show(), /data-transaction-summary="amber"/);
    records = [{ ...fixture, updated_at: "2026-09-21T04:00:00Z" }];
    signal(); await tick(); assert.equal(calls, 1, "signals inside the refresh window are throttled");
    clock += 300000; signal(); await tick();
    const html = show(); assert.match(html, /Funds received/); assert.doesNotMatch(html, /data-transaction-summary="amber"/);
    assert.equal((html.match(/ZE36827/g) || []).length, 1); assert.equal(calls, 2);
  } finally { hook.cleanup(); Date.now = originalNow; global.window = previous.window; global.document = previous.document; }
});

test("completed transaction summary cards link to Zarman Google Maps review with Already Reviewed confirmation and undo", () => {
  const previousWindow = global.window;
  const storage = new Map();
  global.window = {
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key),
    },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true; },
  };
  try {
    for (const locale of ["en", "fa"]) {
      storage.clear();
      const h = dashboardHarness({ locale });
      const { TransactionSummaryCard } = h.load("components/dashboard/TransactionSummaryCard.tsx");
      const { GoogleReviewPrompt, ZARMAN_GOOGLE_REVIEW_URL, GOOGLE_REVIEW_STORAGE_KEY } = h.load("components/dashboard/GoogleReviewPrompt.tsx");
      const completed = { ...fixture, status: "completed" };
      const html = markup(React.createElement(TransactionSummaryCard, { request: completed, locale }));
      assert.match(html, /data-feedback-prompt/);
      assert.match(html, /data-google-review-link/);
      assert.match(html, /data-already-reviewed-google/);
      assert.ok(html.includes(`href="${ZARMAN_GOOGLE_REVIEW_URL}"`));
      assert.match(html, /target="_blank"/);
      assert.match(html, /rel="noopener noreferrer"/);
      assert.doesNotMatch(html, /href="\/(?:en|fa)\/dashboard\?tab=feedback"/);
      assert.match(html, locale === "fa" ? /ثبت نظر در گوگل مپ/ : /Post a Review on Google/);
      assert.match(html, locale === "fa" ? /قبلاً نظر داده‌ام/ : /Already reviewed/);
      assert.match(html, locale === "fa" ? /از این انتقال راضی بودید؟/ : /Happy with this transfer\?/);

      // Refunded or in-progress transfers never show the review prompt.
      assert.doesNotMatch(markup(React.createElement(TransactionSummaryCard, { request: fixture, locale })), /data-feedback-prompt/);
      assert.doesNotMatch(markup(React.createElement(TransactionSummaryCard, { request: { ...completed, funding_status: "refunded" }, locale })), /data-feedback-prompt/);

      // Clicking "Already reviewed" transitions to the thank-you confirmation and persists "done" for future visits.
      let tree = h.render(GoogleReviewPrompt, { locale });
      assert.equal(tree.props["data-google-review-prompt"], "active");
      elements(tree, node => node.props["data-already-reviewed-google"])[0].props.onClick();
      assert.equal(storage.get(GOOGLE_REVIEW_STORAGE_KEY), "done");
      tree = h.render(GoogleReviewPrompt, { locale });
      assert.equal(tree.props["data-google-review-prompt"], "thanked");

      // Subsequent visits hide the prompt completely so the customer is not nagged again.
      const hNextVisit = dashboardHarness({ locale });
      const { GoogleReviewPrompt: PromptNextVisit } = hNextVisit.load("components/dashboard/GoogleReviewPrompt.tsx");
      assert.equal(hNextVisit.render(PromptNextVisit, { locale }), null);

      // Clicking "Undo" restores the active prompt and clears storage.
      elements(tree, node => node.props["data-undo-google-review"])[0].props.onClick();
      assert.equal(storage.get(GOOGLE_REVIEW_STORAGE_KEY), undefined);
      tree = h.render(GoogleReviewPrompt, { locale });
      assert.equal(tree.props["data-google-review-prompt"], "active");
    }
  } finally {
    global.window = previousWindow;
  }
});

test("message chime establishes a baseline when no messages exist, announces the first admin message, and resumes suspended audio", async () => {
  const previous = { window: global.window, document: global.document };
  const storage = new Map(), timers = [];
  let oscillators = 0, resumed = 0, latestMessage = null, onSignal = null;
  class FakeAudioContext {
    constructor() { this.state = "suspended"; this.currentTime = 0; this.destination = {}; }
    async resume() { resumed++; this.state = "running"; }
    createOscillator() {
      oscillators++;
      return { type: "sine", frequency: { value: 0 }, connect() { return { connect() {} }; }, start() {}, stop() { if (this.onended) this.onended(); }, disconnect() {} };
    }
    createGain() {
      return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} };
    }
  }
  global.window = {
    AudioContext: FakeAudioContext,
    location: { pathname: "/fa/dashboard" },
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)) },
    setTimeout(fn) { timers.push(fn); return timers.length; },
    clearTimeout() {},
    addEventListener() {},
    removeEventListener() {},
  };
  global.document = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
  try {
    const h = dashboardHarness({
      locale: "fa",
      pathname: "/fa/dashboard",
      mocks: {
        "@/app/actions/request.actions": { getMyLatestAdminMessage: async () => ({ data: latestMessage }) },
        "@/lib/supabase": { supabase: { channel: () => ({ on(_e, _f, cb) { onSignal = cb; return this; }, subscribe() { return this; } }), removeChannel: async () => {} } },
      },
    });
    const { DashboardMessageChime, ADMIN_MESSAGE_SEEN_KEY } = h.load("components/dashboard/DashboardMessageChime.tsx");
    h.render(DashboardMessageChime, { locale: "fa", sound: true });
    h.effects();
    // Run initial check when customer has zero messages.
    await timers.pop()();
    await tick();
    assert.equal(storage.get(ADMIN_MESSAGE_SEEN_KEY), "1970-01-01T00:00:00.000Z");
    assert.equal(oscillators, 0);

    // First admin message ever arrives via realtime signal -> resumes suspended AudioContext, plays 2-note chime, and shows notice.
    latestMessage = { id: "msg-1", requestId: "req-1", createdAt: "2026-10-19T03:00:00.000Z" };
    onSignal();
    await timers.pop()();
    await tick();
    await tick();
    assert.equal(resumed, 1);
    assert.equal(oscillators, 2);
    const html = markup(h.render(DashboardMessageChime, { locale: "fa", sound: true }));
    assert.match(html, /پیام جدید از زرمان/);
    assert.match(html, /href="\/fa\/dashboard\/requests\/req-1#request-conversation"/);
  } finally {
    global.window = previous.window;
    global.document = previous.document;
  }
});


