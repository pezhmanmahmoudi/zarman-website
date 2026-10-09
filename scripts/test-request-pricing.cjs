/* eslint-disable @typescript-eslint/no-require-imports -- Offline financial and interaction tests. */
const assert = require("node:assert/strict"), { test } = require("node:test");
const React = require("react"), { renderToStaticMarkup } = require("react-dom/server");
const { dashboardHarness, request: fixture } = require("./helpers/dashboard-harness.cjs");
const h = dashboardHarness();
const policy = h.load("lib/requests/validation.ts").DEFAULT_REQUEST_SETTINGS;
const { calculateQuoteMoney } = h.load("lib/requests/quote-money.ts");
const config = { discount_step_volume: 1000, discount_percent_per_step: .005, max_discount_percent: .25, fee_threshold: 1000, applied_fee: 30 };
const money = extra => calculateQuoteMoney({ amount: 870000000, currency: "IRT", rate: 182600, txType: "buy_aud", config, ...extra });
const request = { ...fixture, version: 3, status: "awaiting_funds", funding_status: "unpaid", funding_received: 0, evidence_submitted_at: null,
  quote: { ...fixture.quote, customer_request_type: "buy_aud", applied_rate: 182600, funding_total: 870000000, recipient_amount: 4764.51, raw_amount_aud: 4764.51,
    policy_snapshot: policy, base_fee_aud: 0, priority_fee_aud: 0, priority_fee_amount: 0, loyalty_discount: 6688626, discount_amount: 123456, promo_code: "SAVE", rounding_adjustment_toman: 474 } };
function nodes(tree, match) {
  if (!React.isValidElement(tree)) return [];
  return [...(match(tree) ? [tree] : []), ...React.Children.toArray(tree.props.children).flatMap(child => nodes(child, match))];
}
const markup = renderToStaticMarkup;
const button = tree => nodes(tree, n => n.props.onClick && n.props.disabled !== undefined).at(-1);
test("fixed currency survives rate changes in both directions and includes express fees", () => {
  for (const txType of ["buy_aud", "sell_aud"]) for (const rate of [182100, 182600, 186700.123456]) {
    const q = money({ txType, rate, priorityFeeAud: 25 });
    assert.equal(txType === "buy_aud" ? q.fundingTotal : q.recipientAmount, 870000000);
    assert.equal(txType === "buy_aud" ? q.rawAmountAud : q.fundingTotal - 25, q.rawAmountAud);
    assert.ok(Math.abs(q.roundingAdjustmentToman) <= Math.ceil(rate / 200) + 1);
  }
  assert.equal(money().rawAmountAud, 4764.51);
  assert.equal(money({ priorityFeeAud: 25 }).rawAmountAud, 4739.51);
  assert.equal(money({ currency: "AUD", amount: 4777.59 }).fundingTotal, 872387934);
});
test("small transfers include the fee on the correct side and reject invalid precision or fee gaps", () => {
  assert.equal(money({ currency: "AUD", amount: 100, rate: 100000 }).fundingTotal, 13000000);
  assert.equal(money({ currency: "AUD", amount: 100, rate: 100000, txType: "sell_aud" }).recipientAmount, 7000000);
  assert.equal(money({ amount: 13000000, rate: 100000 }).rawAmountAud, 100);
  assert.equal(money({ amount: 7000000, rate: 100000, txType: "sell_aud" }).rawAmountAud, 100);
  for (const patch of [{ currency: "AUD", amount: 12.345 }, { amount: 100.5 }, { rate: .00000001 }, { priorityFeeAud: -.01 },
    { config: { ...config, applied_fee: .001 } }, { txType: "sell_aud", amount: 1 }, { currency: "AUD", txType: "sell_aud", amount: 20 },
    { amount: 98000000, rate: 100000, txType: "sell_aud" }]) assert.throws(() => money(patch));
});
test("pricing details show stored rate, Toman benefits and only applicable discounts", () => {
  const { RequestPricingDetails } = h.load("components/requests/RequestPricingDetails.tsx");
  const html = markup(React.createElement(RequestPricingDetails, { request }));
  for (const value of ["182,600 Toman", "6,688,626 Toman", "SAVE", "123,456 Toman"]) assert.ok(html.includes(value));
  const adjusted = markup(React.createElement(RequestPricingDetails, { request: { ...request, original_quote: request.quote,
    quote: { ...request.quote, admin_adjusted: true, loyalty_discount: 99999999 } } }));
  assert.match(adjusted, /Original loyalty savings/); assert.match(adjusted, /6,688,626/); assert.doesNotMatch(adjusted, /99,999,999/);
  const plain = markup(React.createElement(RequestPricingDetails, { request: { ...request, quote: { ...request.quote, loyalty_discount: 0, promo_code: null } } }));
  assert.doesNotMatch(plain, /Loyalty savings|Promo/);
});
function editorHarness(action) {
  const h = dashboardHarness({ mocks: { "@/app/actions/request.actions": { updateAdminRequestPricing: action } } });
  const { RequestPricingEditor } = h.load("components/requests/RequestPricingEditor.tsx");
  const saved = [], busy = [], props = { request, disabled: false, onSaved: r => saved.push(r), onBusyChange: b => busy.push(b) };
  const render = () => h.render(RequestPricingEditor, props);
  const open = () => nodes(render(), n => n.props["aria-label"] === "Edit customer payment and recipient amount")[0].props.onClick();
  const field = (type, index, value) => nodes(render(), n => n.type === type)[index].props.onChange({ target: { value } });
  const submit = () => nodes(render(), n => n.type === "form")[0].props.onSubmit({ preventDefault() {} });
  return { h, props, saved, busy, render, open, field, submit };
}
test("editor keeps rejected drafts, retries unknown outcomes once and saves both amounts atomically", async () => {
  const calls = []; let fail = true, release;
  const gate = new Promise(resolve => { release = resolve; });
  const e = editorHarness(async payload => { calls.push(payload); if (fail) throw Error("Disconnected after commit"); await gate; return { data: { ...request, version: 4 } }; });
  e.open(); e.field("input", 0, "870000000"); e.field("input", 1, "4777.59"); e.field("textarea", 0, "Requested correction");
  await e.submit();
  assert.equal(e.saved.length, 0); assert.match(markup(e.render()), /not confirmed/);
  assert.equal(nodes(e.render(), n => n.type === "input")[1].props.value, "4777.59");
  fail = false; const retry = e.submit(); await e.submit(); assert.equal(calls.length, 2);
  assert.deepEqual(calls[1], calls[0]); assert.equal(calls[1].fundingTotal, 870000000); assert.equal(calls[1].recipientAmount, 4777.59);
  release(); await retry; assert.equal(e.saved.length, 1); assert.equal(nodes(e.render(), n => n.type === "form").length, 0);
  assert.deepEqual(e.busy, [true, false, true, false]);
});
test("editing requires a reason, correct currency precision and no payment evidence", async () => {
  let calls = 0; const e = editorHarness(async () => { calls++; return { error: "Conflict" }; });
  e.open(); await e.submit(); assert.equal(calls, 0);
  e.field("textarea", 0, "Correction"); e.field("input", 0, "870000000.5"); await e.submit(); assert.equal(calls, 0);
  for (const patch of [{ evidence_submitted_at: "2026-10-08T00:00:00Z" }, { funding_received: 1 }, { status: "ready" }, { funding_status: "partial" }]) {
    e.props.request = { ...request, ...patch };
    assert.equal(nodes(e.render(), n => n.props["aria-label"]?.startsWith("Edit ")).length, 0);
  }
});
test("customer acceptance is explicit and repeated clicks retain the version and command key", async () => {
  const calls = [], accepted = []; let fail = true;
  const h = dashboardHarness({ mocks: { "@/app/actions/request.actions": { acceptMyRequestPricing: async payload => {
    calls.push(payload); if (fail) throw Error("Response lost"); return { data: { ...request, version: 4, pricing_pending_acceptance: false } };
  } } } });
  const { RequestPricingAcceptance } = h.load("components/requests/RequestPricingAcceptance.tsx");
  const props = { request: { ...request, pricing_pending_acceptance: true }, locale: "en", onAccepted: r => accepted.push(r) };
  const render = () => h.render(RequestPricingAcceptance, props);
  await button(render()).props.onClick(); assert.equal(calls.length, 0);
  nodes(render(), n => n.type === "input")[0].props.onChange({ target: { checked: true } });
  await button(render()).props.onClick(); assert.equal(accepted.length, 0); fail = false;
  await button(render()).props.onClick(); assert.deepEqual(calls[1], calls[0]); assert.equal(accepted.length, 1);
});
test("final amounts: legacy pricing is queued for admin confirmation without a customer action", () => {
  const { getRequestJourney, requestStageLabel } = h.load("lib/requests/journey.ts");
  const { transactionQueueState } = h.load("lib/admin-transaction-workspace.ts");
  const revised = { ...request, pricing_pending_acceptance: true, customer_action_required: null };
  const journey = getRequestJourney(revised);
  assert.equal(journey.approved, false); assert.equal(journey.canPay, false); assert.equal(journey.canUpload, false);
  assert.equal(journey.customerActionRequired, false); assert.equal(requestStageLabel(revised, "en"), "Admin review in progress");
  assert.equal(transactionQueueState({ request: revised, status: "pending" }).stage, "review");
});

test("pricing conflicts refresh without resubmitting and require renewed customer acceptance", async () => {
  for (const conflict of [{ error: "REQUEST_CONFLICT: Reload request" }, { error: "Version mismatch", code: "40001" }, { error: "Version mismatch", code: "PT409" }]) {
    const calls = []; let refreshes = 0;
    const h = dashboardHarness({ mocks: { "@/app/actions/request.actions": { acceptMyRequestPricing: async input => { calls.push(input); return conflict; } } } });
    const { RequestPricingAcceptance } = h.load("components/requests/RequestPricingAcceptance.tsx");
    const props = { request, locale: "en", onAccepted: () => assert.fail("conflict is not a commit"), onRefresh: async () => {
      refreshes++; props.request = { ...request, version: request.version + 1 };
    } };
    const render = () => h.render(RequestPricingAcceptance, props);
    nodes(render(), n => n.type === "input")[0].props.onChange({ target: { checked: true } });
    await button(render()).props.onClick();
    assert.equal(calls.length, 1); assert.equal(refreshes, 1);
    assert.equal(nodes(render(), n => n.type === "input")[0].props.checked, false);
    await button(render()).props.onClick(); assert.equal(calls.length, 1);
    nodes(render(), n => n.type === "input")[0].props.onChange({ target: { checked: true } });
    await button(render()).props.onClick();
    assert.equal(calls[1].expectedVersion, request.version + 1);
    assert.notEqual(calls[1].commandKey, calls[0].commandKey);
  }
});

test("pricing editor recognizes raw conflicts, keeps the draft and waits for another explicit save", async () => {
  const calls = []; let refreshes = 0;
  const e = editorHarness(async input => { calls.push(input); return { error: "REQUEST_CONFLICT: Reload request" }; });
  e.props.onRefresh = async () => { refreshes++; e.props.request = { ...request, version: request.version + 1 }; };
  e.open(); e.field("input", 0, "870000000"); e.field("input", 1, "4777.59"); e.field("textarea", 0, "Requested correction");
  await e.submit();
  assert.equal(calls.length, 1); assert.equal(refreshes, 1);
  assert.equal(nodes(e.render(), n => n.type === "input")[1].props.value, "4777.59");
  await e.submit();
  assert.equal(calls[1].expectedVersion, request.version + 1);
  assert.notEqual(calls[1].commandKey, calls[0].commandKey);
});
test("a final quote ignores cached preview drift, but invalidates on changed customer intent", async () => {
  const windowBefore = global.window; global.window = { setInterval: () => 1, clearInterval() {} };
  try {
    const publishes = [], quotes = [];
    const h = dashboardHarness({ mocks: {
      "@/app/actions/request.actions": { getRequestPolicy: async () => ({ data: { ...policy, enabled: true, standard_minutes: 60, funding_minutes: 60 } }),
        createRequestQuote: async input => { quotes.push(input); return { data: { id: "quote", snapshot: request.quote, expires_at: new Date(Date.now() + 60000).toISOString() } }; } },
      "@/components/dashboard/DashboardLottieScene": { DashboardLottieScene: () => null },
    } });
    const { OnlineRequestSubmit } = h.load("components/requests/OnlineRequestSubmit.tsx");
    const props = { input: { rawAmount: 4777.59, amountCurrency: "IRT", amountValue: 870000000, txType: "buy_aud", locale: "en" },
      disabled: false, validationMessage: null, onQuoteChange: q => publishes.push(q) };
    const render = () => h.render(OnlineRequestSubmit, props);
    render(); h.effects(); await new Promise(setImmediate); render(); h.effects();
    await nodes(render(), n => n.props.onClick && !n.props.disabled)[0].props.onClick(); render(); h.effects();
    assert.equal(quotes[0].amountValue, 870000000); assert.equal(publishes.at(-1), request.quote);
    props.input = { ...props.input, rawAmount: 4764.51 }; render(); h.effects(); assert.equal(publishes.at(-1), request.quote);
    props.input = { ...props.input, amountValue: 880000000 }; render(); h.effects(); assert.equal(publishes.at(-1), null);
    h.cleanup();
  } finally { global.window = windowBefore; }
});
test("Toman entry reaches the final quote unchanged and the dashboard summary adopts the server amounts", async () => {
  const frameBefore = global.requestAnimationFrame; global.requestAnimationFrame = fn => fn();
  try {
    const Wrap = ({ children, ...props }) => React.createElement("div", { "data-transfer-summary": props["data-transfer-summary"] }, children);
    const Submit = () => null, Picker = () => null;
    const h = dashboardHarness({ mocks: {
      "@/context/FinanceConfigContext": { useFinanceConfig: () => config },
      "@/components/requests/OnlineRequestSubmit": { OnlineRequestSubmit: Submit },
      "./TransferRecipientPicker": { TransferRecipientPicker: Picker, EDUCATION_RECIPIENT_ID: "__edu_exam__" },
      "./DashboardLottieScene": { DashboardLottieScene: () => null },
      "./DashboardIdentityCard": { DashboardIdentityCard: () => null },
      "@/components/dashboard/RecipientModal": { RecipientModal: () => null },
      "@/components/Stepper": { __esModule: true, default: () => null, Step: () => null },
      "@/components/ui/SelectBox/SelectBox": { SelectBox: () => null },
      "@/components/dashboard/dashboard-ui": { DashboardCard: Wrap, DashboardMagicCard: Wrap, DashboardButton: Wrap, DashboardPageHeader: () => null,
        DashboardReveal: Wrap, StatusBadge: Wrap, dashboardInputClass: "" },
      "@/app/actions/transaction.actions": { getRecipients: async () => ({ data: [{ id: "recipient", direction: "aud", account_name: "Sample", bsb: "000001", account_number: "123456" }] }) },
      "@/lib/supabase": { supabase: { from: () => ({ select() { return this; }, order() { return this; }, limit() { return this; }, single: async () => ({ data: { market_active: true } }) }) } },
    } });
    const { DashboardRequestHub } = h.load("components/dashboard/DashboardRequestHub.tsx");
    const props = { isApproved: true, txType: "buy_aud", amountStr: "", loyaltyBonus: 1400, tailoredRate: 182100, baseRate: 183500,
      profile: { id: "sample", kyc_status: "approved" }, setTxType: type => { props.txType = type; }, setAmountStr: value => { props.amountStr = value; } };
    const render = () => h.render(DashboardRequestHub, props);
    const settle = async () => { for (let i = 0; i < 3; i++) { render(); h.effects(); await new Promise(setImmediate); } };
    const next = () => nodes(render(), n => n.type === "button" && n.props.className === "wizardNext")[0].props.onClick();
    await settle(); nodes(render(), n => n.props.id === "request-amount-toman")[0].props.onChange({ target: { value: "870000000" } });
    await settle(); assert.equal(props.amountStr, "4,777.59");
    next(); nodes(render(), n => n.type === Picker)[0].props.onSelect("recipient"); next(); await settle();
    const submit = nodes(render(), n => n.type === Submit)[0];
    assert.equal(submit.props.input.amountCurrency, "IRT"); assert.equal(submit.props.input.amountValue, 870000000);
    submit.props.onQuoteChange({ ...request.quote, recipient_amount: 4764.51, loyalty_discount: 0, discount_amount: 0, applied_rate: 182600 });
    const summary = nodes(render(), n => n.props["data-transfer-summary"])[0];
    const html = markup(summary); assert.match(html, /870,000,000/); assert.match(html, /4,764\.51/); assert.match(html, /182,600/);
    assert.doesNotMatch(html, /4,777\.59|6,688,626/); assert.match(html, /Final quote/);
    h.cleanup();
  } finally { global.requestAnimationFrame = frameBefore; }
});
