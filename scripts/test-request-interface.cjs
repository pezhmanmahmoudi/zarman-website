/* eslint-disable @typescript-eslint/no-require-imports -- Offline TSX render and interaction harness. */
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

// Render actual UI with controlled state; no account, database, provider or network access.
function load(file, { states = {}, actions = {} } = {}) {
  let stateIndex = 0;
  const hookReact = { ...React,
    useState: initial => [stateIndex in states ? states[stateIndex++] : (++stateIndex, typeof initial === "function" ? initial() : initial), () => {}],
    useEffect: () => {}, useCallback: fn => fn, useRef: initial => ({ current: initial }),
  };
  const cache = new Map();
  function compile(filename) {
    if (cache.has(filename)) return cache.get(filename);
    const js = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const compiled = { exports: {} };
    const localRequire = id => {
      if (id === "react") return hookReact;
      if (id === "@/app/actions/request.actions") return new Proxy(actions, { get: (target, key) => target[key] || (() => { throw Error(`Unexpected server action: ${String(key)}`); }) });
      if (id === "next/link") return { __esModule: true, default: props => React.createElement("a", props) };
      if (id.endsWith(".module.css")) {
        const cssPath = path.resolve(projectRoot, id.replace(/^@\//, ""));
        const classes = {};
        postcss.parse(fs.readFileSync(cssPath, "utf8")).walkRules(rule => {
          for (const match of rule.selector.matchAll(/\.([a-zA-Z_][\w-]*)/g)) classes[match[1]] = match[1];
        });
        return { __esModule: true, default: new Proxy(classes, { get(target, key) {
          if (typeof key !== "string" || key in target) return target[key];
          throw Error(`Missing CSS class ${id}: ${key}`);
        } }) };
      }
      if (id.startsWith("./") || id.startsWith("@/")) {
        const base = id.startsWith("@/") ? path.resolve(projectRoot, id.slice(2)) : path.resolve(path.dirname(filename), id);
        const dependency = [base, `${base}.tsx`, `${base}.ts`].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
        if (dependency) return compile(dependency);
      }
      return require(id);
    };
    vm.runInThisContext(`(function(require,module,exports){${js}\n})`, { filename })(localRequire, compiled, compiled.exports);
    cache.set(filename, compiled.exports);
    return compiled.exports;
  }
  return compile(path.resolve(projectRoot, file));
}

const policy = {
  enabled: true, priority_enabled: true, priority_fee_aud: 25, priority_capacity: 10,
  standard_minutes: 240, priority_minutes: 60, quote_minutes: 10, funding_minutes: 120,
  australian_clearance_minutes: 1440, max_amount_aud: 100000, timezone: "Australia/Sydney",
  iran_banking_notice: "Settlement follows the receiving bank operating calendar.",
  business_days: [1, 2, 3, 4, 5], opening_hour: 9, closing_hour: 17, holidays: [],
  management_emails: ["ops@example.test"], payment_instructions_aud: "Zarman Test\nBSB 123-456\nAccount 12345678",
  payment_instructions_irt: "Test IRT account", priority_terms: "Handling after cleared funds.", priority_terms_fa: "رسیدگی پس از تأیید وجه",
};
const request = {
  id: "request-test", transaction_id: "tx-test", reference_code: "ZAR-TEST123", status: "awaiting_funds", version: 2,
  service_tier: "priority", funding_status: "unpaid", funding_received: 0, priority_fee_status: "unpaid",
  payment_instructions: policy.payment_instructions_aud, action_required: null,
  created_at: "2026-09-13T00:00:00Z", updated_at: "2026-09-13T00:00:00Z", funding_due_at: "2026-09-13T02:00:00Z",
  clearance_due_at: "2026-09-14T02:00:00Z", funds_confirmed_at: null, ready_at: null, handling_due_at: null, handling_started_at: null,
  quote: { funding_total: 1025, funding_currency: "AUD", recipient_amount: 55000000, recipient_currency: "IRT", service_tier: "priority",
    priority_fee_aud: 25, priority_fee_amount: 25, base_fee_aud: 0, applied_rate: 55000, recipient_snapshot: { full_name: "Test Recipient" },
    sender_snapshot: { name: "Customer", email: "customer@example.test" }, policy_snapshot: policy,
  },
};
const markup = element => renderToStaticMarkup(element);
function render(name, props, options) {
  const exported = load(`components/requests/${name}.tsx`, options);
  return markup(React.createElement(exported[name], props));
}
function elements(element, predicate) {
  const found = [];
  const visit = node => {
    if (!React.isValidElement(node)) return;
    if (predicate(node)) found.push(node);
    React.Children.forEach(node.props.children, visit);
  };
  visit(element); return found;
}

test("four-step progress keeps uploaded evidence awaiting funds and funds-confirmed requests queued", () => {
  const waiting = render("RequestProgress", { request: { ...request, evidence_submitted_at: "2026-09-13T01:00:00Z" }, locale: "en" });
  for (const label of ["Submitted", "Awaiting Funds", "Processing", "Completed"]) assert.ok(waiting.includes(label));
  assert.equal((waiting.match(/aria-current="step"/g) || []).length, 1);
  assert.match(waiting, /data-current="true"[^>]*aria-current="step"[^]*?Awaiting Funds/);
  assert.doesNotMatch(waiting, /Handling time target starts:/);
  const ready = render("RequestProgress", { request: { ...request, status: "ready", funding_status: "confirmed", ready_at: "2026-09-14T01:00:00Z", funds_confirmed_at: "2026-09-14T01:00:00Z" }, locale: "en" });
  assert.match(ready, /queued for processing/);
  assert.match(ready, /Handling time target starts:/);
  assert.match(ready, /Cleared funds confirmed:/);
  const closed = render("RequestProgress", { request: { ...request, status: "cancelled" }, locale: "en" });
  assert.doesNotMatch(closed, /aria-current="step"/);
  assert.match(closed, /Do not send a new payment/);
});

test("payment instructions expose real account details, reference description requirement and clearance timing", () => {
  const html = render("RequestPaymentInstructions", { request, locale: "en" });
  assert.match(html, /BSB 123-456/); assert.match(html, /Account 12345678/);
  assert.match(html, /1,025 AUD/); assert.match(html, /Put your Reference Code in the description or reference field/);
  assert.match(html, /Copy Reference Code/); assert.match(html, /Initiate your bank transfer by/);
  assert.match(html, /Bank clearance review after/); assert.match(html, /up to 24 hours, or longer/);
  assert.match(html, /Paya clearing cycles, Satna operating hours/);
  assert.match(html, /Settlement follows the receiving bank operating calendar/);
  assert.match(html, /not at submission or receipt upload/);
  const fa = render("RequestPaymentInstructions", { request, locale: "fa" });
  assert.match(fa, /کد پیگیری/); assert.match(fa, /پایا/); assert.doesNotMatch(fa, /\?{3}/);
});

test("bank receipt control accepts constrained files and displays escaped private attachment metadata", () => {
  const html = render("RequestReceiptUpload", { request, receipts: [{ id: "r1", original_name: "<invoice>.pdf", size_bytes: 2048, created_at: request.created_at }], locale: "en", onUploaded: async () => {} });
  assert.match(html, /type="file"/); assert.match(html, /application\/pdf,image\/jpeg,image\/png/);
  assert.match(html, /maximum 4 MB/); assert.match(html, /Upload bank receipt/);
  assert.match(html, /&lt;invoice&gt;\.pdf/); assert.match(html, /2 KB/);
  assert.doesNotMatch(html, /storage\/v1|public\/request-receipts/);
  const admin = render("RequestReceiptUpload", { request, receipts: [], admin: true, locale: "en", onUploaded: async () => {} });
  assert.doesNotMatch(admin, /type="file"/);
  const completed = render("RequestReceiptUpload", { request: { ...request, status: "completed" }, receipts: [], locale: "en", onUploaded: async () => {} });
  assert.doesNotMatch(completed, /type="file"/);
});

test("receipt uploads retain their command key after an uncertain result and refresh after success", async () => {
  const file = new File(["%PDF-test"], "bank.pdf", { type: "application/pdf" });
  const calls = []; let refreshed = 0;
  const { RequestReceiptUpload } = load("components/requests/RequestReceiptUpload.tsx", {
    states: { 0: file }, actions: { uploadRequestReceipt: async body => {
      calls.push({ requestId: body.get("requestId"), commandKey: body.get("commandKey"), file: body.get("file") });
      if (calls.length === 1) throw Error("Connection interrupted");
      return { data: { id: "receipt-saved" } };
    } },
  });
  const element = RequestReceiptUpload({ request, receipts: [], locale: "en", onUploaded: async () => { refreshed++; } });
  const form = elements(element, node => node.type === "form")[0];
  await form.props.onSubmit({ preventDefault() {} }); await form.props.onSubmit({ preventDefault() {} });
  assert.equal(calls.length, 2); assert.equal(calls[0].requestId, request.id);
  assert.match(calls[0].commandKey, /^[\da-f-]{36}$/); assert.equal(calls[0].commandKey, calls[1].commandKey);
  assert.equal(calls[0].file.name, "bank.pdf"); assert.equal(refreshed, 1);
});

test("unsupported and oversized receipts never call the upload action", async () => {
  for (const file of [new File(["unsafe"], "receipt.html", { type: "text/html" }), new File([new Uint8Array(4 * 1024 * 1024 + 1)], "big.pdf", { type: "application/pdf" })]) {
    let called = false;
    const { RequestReceiptUpload } = load("components/requests/RequestReceiptUpload.tsx", { states: { 0: file }, actions: { uploadRequestReceipt: async () => { called = true; } } });
    const element = RequestReceiptUpload({ request, receipts: [], locale: "en", onUploaded: async () => {} });
    await elements(element, node => node.type === "form")[0].props.onSubmit({ preventDefault() {} });
    assert.equal(called, false);
  }
});

test("completion is available only during settlement processing and uses supported bank methods", () => {
  const detail = { request: { ...request, status: "processing", funding_status: "confirmed" }, events: [], receipts: [] };
  const html = render("RequestDetailView", { id: request.id, admin: true, locale: "en" }, { states: { 0: detail, 1: false, 6: "complete", 21: [
    { id: "aud-account", account_name: "AUD collection", currency: "AUD" }, { id: "irt-account", account_name: "Iran payout", currency: "IRT" },
  ] } });
  for (const method of ["free", "pol", "paya", "satna"]) assert.ok(html.includes(`value="${method}"`));
  assert.doesNotMatch(html, /value="bank_transfer"/); assert.match(html, /Confirm successful bank settlement before completing/);
  const ready = render("RequestDetailView", { id: request.id, admin: true, locale: "en" }, { states: { 0: { ...detail, request: { ...detail.request, status: "ready" } }, 1: false } });
  assert.match(ready, /value="start_processing"/); assert.doesNotMatch(ready, /value="complete"/);
  const customer = render("RequestDetailView", { id: request.id, locale: "en" }, { states: { 0: { ...detail, request: { ...detail.request, status: "completed" } }, 1: false } });
  assert.match(customer, /href="\/api\/requests\/request-test\/receipt"/);
  assert.doesNotMatch(customer, /value="confirm_funds"|value="complete"/);
});

test("service selector prices Priority separately and saved submissions immediately show bank instructions", () => {
  const props = { input: { locale: "en" }, disabled: false, validationMessage: null };
  const html = render("OnlineRequestSubmit", props, { states: { 0: policy, 1: false } });
  assert.match(html, /Choose your service/); assert.match(html, /value="standard"/); assert.match(html, /value="priority"/);
  assert.match(html, /25 AUD/); assert.match(html, /not at submission or receipt upload/);
  const saved = render("OnlineRequestSubmit", props, { states: { 0: policy, 1: false, 8: request } });
  assert.match(saved, /Your request has been submitted/); assert.match(saved, /BSB 123-456/);
  assert.match(saved, /href="\/en\/dashboard\/requests\/request-test"/);
});

test("main dashboard composes self-service submission and discoverable request history", () => {
  const hub = fs.readFileSync(path.join(projectRoot, "components/dashboard/DashboardRequestHub.tsx"), "utf8");
  const dashboard = fs.readFileSync(path.join(projectRoot, "app/[locale]/dashboard/page.tsx"), "utf8");
  assert.match(hub, /<OnlineRequestSubmit/); assert.match(hub, /institutionName:/); assert.match(hub, /invoiceReference:/);
  assert.doesNotMatch(hub, /buildWhatsAppUrl|whatsappWindow|onSaveTransaction/);
  assert.match(dashboard, /<RequestList locale=\{locale\} embedded/);
  assert.doesNotMatch(dashboard, /processTransactionSecurely/);
});

test("management settings keep payment initiation and Australian bank clearance as separate windows", () => {
  const html = render("RequestSettingsForm", {}, { states: { 0: { version: 1, settings: policy }, 3: false } });
  assert.match(html, /Customer payment initiation window \(minutes\)/);
  assert.match(html, /Australian bank clearance buffer \(minutes; 1440 = 24 hours\)/);
  assert.match(html, /min="1440" max="10080" step="1" value="1440"/);
  assert.match(html, /uploaded evidence or partial receipts require finance review if late/);
  assert.match(html, /Iranian banking cycles and holidays advisory/);
  assert.match(html, /maxLength="2000"/i);
});

test("timeline exposes private evidence details to management only", () => {
  const detail = { request, receipts: [], events: [{ id: "event-1", status: "awaiting_funds", event_type: "payment_evidence", public_message: "Payment reference submitted.", internal_message: "Private bank reference: ABC123", created_at: request.created_at }] };
  const admin = render("RequestDetailView", { id: request.id, admin: true, locale: "en" }, { states: { 0: detail, 1: false } });
  assert.match(admin, /Private bank reference: ABC123/);
  const customer = render("RequestDetailView", { id: request.id, locale: "en" }, { states: { 0: detail, 1: false } });
  assert.match(customer, /Payment reference submitted/);
  assert.doesNotMatch(customer, /Private bank reference|ABC123/);
});

test("staff can record late or reviewed funds and release an already funded request without a second payment", () => {
  for (const status of ["submitted", "under_review", "awaiting_funds", "action_required", "expired"]) {
    const html = render("RequestDetailView", { id: request.id, admin: true, locale: "en" }, { states: { 0: { request: { ...request, status }, events: [], receipts: [] }, 1: false } });
    assert.match(html, /value="confirm_funds"/, `Missing funds confirmation for ${status}`);
  }
  for (const status of ["under_review", "action_required"]) {
    const html = render("RequestDetailView", { id: request.id, admin: true, locale: "en" }, { states: { 0: { request: { ...request, status, funding_status: "confirmed" }, events: [], receipts: [] }, 1: false } });
    assert.match(html, /value="resume_funded_request"/);
    assert.doesNotMatch(html, /value="confirm_funds"/);
  }
  const refund = render("RequestDetailView", { id: request.id, admin: true, locale: "en" }, { states: { 0: { request: { ...request, status: "action_required", funding_status: "refund_pending" }, events: [], receipts: [] }, 1: false } });
  assert.match(refund, /value="confirm_refund"/);
  assert.doesNotMatch(refund, /value="confirm_funds"|value="resume_funded_request"/);
});

test("receipt upload is unavailable once funds are confirmed or a refund is in progress", () => {
  for (const fields of [
    { status: "expired" },
    { status: "under_review", funding_status: "confirmed" },
    { status: "action_required", funding_status: "confirmed" },
    { status: "action_required", funding_status: "refund_pending" },
    { status: "action_required", funding_status: "refunded" },
    { status: "action_required", priority_fee_status: "refund_pending" },
    { status: "action_required", priority_fee_status: "refunded" },
  ]) {
    const html = render("RequestReceiptUpload", { request: { ...request, ...fields }, receipts: [], locale: "en", onUploaded: async () => {} });
    assert.doesNotMatch(html, /type="file"/, JSON.stringify(fields));
  }
  const partial = render("RequestReceiptUpload", { request: { ...request, funding_status: "partial" }, receipts: [], locale: "en", onUploaded: async () => {} });
  assert.match(partial, /type="file"/);
});
