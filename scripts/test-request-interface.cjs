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
function load(file, { states = {}, actions = {}, captureEffects = false } = {}) {
  let stateIndex = 0;
  let refIndex = 0;
  const values = { ...states };
  const refs = [];
  const effects = [];
  const hookReact = { ...React,
    useState: initial => {
      const index = stateIndex++;
      if (!(index in values)) values[index] = typeof initial === "function" ? initial() : initial;
      return [values[index], next => { values[index] = typeof next === "function" ? next(values[index]) : next; }];
    },
    useEffect: effect => { if (captureEffects) effects.push(effect); }, useCallback: fn => fn, useRef: initial => {
      const index = refIndex++;
      return refs[index] ||= { current: initial };
    },
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
  const exported = compile(path.resolve(projectRoot, file));
  return { ...exported, rerender(name, props) {
    stateIndex = 0; refIndex = 0;
    return exported[name](props);
  }, runEffects() { return effects.splice(0).map(effect => effect()).filter(cleanup => typeof cleanup === "function"); } };
}

const policy = {
  enabled: true, priority_enabled: true, priority_fee_aud: 25, priority_capacity: 10,
  standard_minutes: 240, priority_minutes: 60, quote_minutes: 10, funding_minutes: 120,
  australian_clearance_minutes: 1440, max_amount_aud: 100000, timezone: "Australia/Sydney",
  iran_banking_notice: "Settlement follows the receiving bank operating calendar.",
  iran_banking_notice_fa: "تسویه طبق تقویم کاری بانک گیرنده است.",
  business_days: [1, 2, 3, 4, 5], opening_hour: 9, closing_hour: 17, holidays: [],
  management_emails: ["ops@example.test"], payment_instructions_aud: "Zarman Test\nBSB 123-456\nAccount 12345678",
  payment_instructions_irt: "Test IRT account", priority_terms: "Handling after cleared funds.", priority_terms_fa: "رسیدگی پس از تأیید وجه",
  payment_instructions_aud_fa: "واریز فقط از حساب شخصی خودتان.", payment_instructions_irt_fa: "واریز به حساب ریالی آزمایشی.",
  payment_details_aud: { account_name: "Zarman Test", bank_name: "Test Bank", bsb: "012-345", account_number: "0012345678" },
  payment_details_irt: { account_name: "گیرنده آزمایشی", bank_name: "بانک آزمایشی", iban: "IR000000000000000000000000", card_number: "0000000000000000" },
};
const request = {
  id: "request-test", transaction_id: "tx-test", reference_code: "ZE01234", status: "awaiting_funds", version: 2,
  service_tier: "priority", funding_status: "unpaid", funding_received: 0, priority_fee_status: "unpaid",
  payment_instructions: policy.payment_instructions_aud, action_required: null,
  payment_instructions_fa: policy.payment_instructions_aud_fa, payment_details: policy.payment_details_aud,
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
const textOf = element => markup(element).replace(/<[^>]*>/g, "");

test("four-step progress keeps uploaded evidence awaiting funds and funds-confirmed requests queued", () => {
  const waiting = render("RequestProgress", { request: { ...request, evidence_submitted_at: "2026-09-13T01:00:00Z" }, locale: "en" });
  for (const label of ["Submitted", "Awaiting funds", "Processing", "Completed"]) assert.ok(waiting.includes(label));
  assert.equal((waiting.match(/aria-current="step"/g) || []).length, 1);
  assert.match(waiting, /data-current="true"[^>]*aria-current="step"[^]*?Awaiting funds/);
  assert.doesNotMatch(waiting, /Handling clock started:/);
  const ready = render("RequestProgress", { request: { ...request, status: "ready", funding_status: "confirmed", ready_at: "2026-09-14T01:00:00Z", funds_confirmed_at: "2026-09-14T01:00:00Z" }, locale: "en" });
  assert.match(ready, /Queued for processing/);
  assert.match(ready, /Handling clock started:/);
  assert.match(ready, /Funds confirmed:/);
  const closed = render("RequestProgress", { request: { ...request, status: "cancelled" }, locale: "en" });
  assert.doesNotMatch(closed, /aria-current="step"/);
  assert.match(closed, /Do not send further payment/);
  const submitted = render("RequestProgress", { request: { ...request, status: "submitted" }, locale: "en" });
  const current = submitted.match(/<li[^>]*aria-current="step"[^>]*>(.*?)<\/li>/s)?.[1];
  assert.match(current, /<span>Submitted<\/span>/); assert.doesNotMatch(current, /Awaiting funds/);
});

test("payment instructions expose real account details, reference description requirement and clearance timing", () => {
  const html = render("RequestPaymentInstructions", { request, locale: "en" });
  assert.match(html, /012-345/); assert.match(html, /0012345678/);
  assert.match(html, /1,025 AUD/); assert.match(html, /Use this transaction code as your bank transfer reference/);
  assert.match(html, /aria-label="Copy transaction code"/); assert.match(html, /Send payment by/);
  assert.match(html, /up to 24 hours, or longer/);
  assert.match(html, /Paya cycles, Satna hours/);
  assert.match(html, /Settlement follows the receiving bank operating calendar/);
  assert.match(html, /Priority timing starts after cleared funds and required checks are confirmed/);
  assert.match(html, /A receipt does not confirm cleared funds/);
  assert.match(html, /<details[^>]*><summary>Bank timing<\/summary>/);
  const uploaded = render("RequestPaymentInstructions", { request: { ...request, evidence_submitted_at: request.created_at }, locale: "en" });
  assert.match(uploaded, /Bank review after/); assert.doesNotMatch(uploaded, /Send payment by/);
  const fa = render("RequestPaymentInstructions", { request, locale: "fa" });
  assert.match(fa, /کد تراکنش/); assert.match(fa, /پایا/); assert.doesNotMatch(fa, /\?{3}/);
  assert.match(fa, /dir="rtl"/); assert.match(fa, /واریز فقط از حساب شخصی خودتان/);
  assert.match(fa, /تسویه طبق تقویم کاری بانک گیرنده/);
  assert.doesNotMatch(fa, /Settlement follows|Bank timing|Payment instructions|Copy transaction code/);
});

test("structured bank copy controls preserve exact values and show localized success and failure feedback", async () => {
  const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  const copied = [];
  try {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async text => { copied.push(text); } } });
    for (const locale of ["en", "fa"]) {
      const harness = load("components/requests/RequestPaymentInstructions.tsx");
      const props = { request, locale };
      let tree = harness.rerender("RequestPaymentInstructions", props);
      const controls = locale === "en"
        ? [["Copy BSB", "012-345"], ["Copy Account number", "0012345678"], ["Copy transaction code", "ZE01234"]]
        : [["کپی کد شعبه (BSB)", "012-345"], ["کپی شماره حساب", "0012345678"], ["کپی کد تراکنش", "ZE01234"]];
      for (const [label, value] of controls) {
        const button = elements(tree, node => node.type === "button" && node.props["aria-label"] === label)[0];
        assert.ok(button, `Missing ${label}`); button.props.onClick();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(copied.at(-1), value);
        tree = harness.rerender("RequestPaymentInstructions", props);
        assert.match(markup(elements(tree, node => node.type === "button" && node.props["aria-label"] === label)[0]), locale === "fa" ? /کپی شد/ : /Copied/);
        assert.match(markup(tree), /role="status"/);
      }
      navigator.clipboard.writeText = async () => { throw Error("Clipboard permission unavailable"); };
      elements(tree, node => node.type === "button")[0].props.onClick();
      await new Promise(resolve => setImmediate(resolve));
      const failure = markup(harness.rerender("RequestPaymentInstructions", props));
      assert.match(failure, /role="alert"/);
      assert.match(failure, locale === "fa" ? /متن را انتخاب و کپی کنید/ : /Select and copy the text/);
      assert.ok(failure.includes("0012345678"));
      navigator.clipboard.writeText = async text => { copied.push(text); };
    }
  } finally {
    if (original) Object.defineProperty(navigator, "clipboard", original);
    else delete navigator.clipboard;
  }
});

test("legacy payment details remain unchanged and never infer individual account values", async () => {
  const legacy = { ...request, reference_code: "ZEBA033B62AA45", payment_details: null, payment_instructions_fa: null,
    payment_instructions: "Old BSB: 111-222\nCurrent BSB: 333-444\nAccount: 00112233" };
  const html = render("RequestPaymentInstructions", { request: legacy, locale: "fa" });
  assert.match(html, /Old BSB: 111-222/); assert.match(html, /Current BSB: 333-444/); assert.match(html, /ZEBA033B62AA45/);
  assert.match(html, /aria-label="کپی مشخصات حساب"/); assert.doesNotMatch(html, /aria-label="کپی کد شعبه/);
  const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  let value;
  try {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async text => { value = text; } } });
    const harness = load("components/requests/RequestPaymentInstructions.tsx");
    const tree = harness.rerender("RequestPaymentInstructions", { request: legacy, locale: "en" });
    elements(tree, node => node.type === "button" && node.props["aria-label"] === "Copy bank details")[0].props.onClick();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(value, legacy.payment_instructions);
  } finally {
    if (original) Object.defineProperty(navigator, "clipboard", original);
    else delete navigator.clipboard;
  }
});

test("bank receipt control accepts constrained files and displays escaped private attachment metadata", () => {
  const html = render("RequestReceiptUpload", { request, receipts: [{ id: "r1", original_name: "<invoice>.pdf", size_bytes: 2048, created_at: request.created_at }], locale: "en", onUploaded: async () => {} });
  assert.match(html, /type="file"/); assert.match(html, /application\/pdf,image\/jpeg,image\/png/);
  assert.match(html, /up to 4 MB/); assert.match(html, /Upload receipt/);
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
  const html = render("RequestDetailView", { id: request.id, admin: true, locale: "en" }, { states: { 0: detail, 1: false, 6: "complete", 22: [
    { id: "aud-account", account_name: "AUD collection", currency: "AUD" }, { id: "irt-account", account_name: "Iran payout", currency: "IRT" },
  ] } });
  for (const method of ["free", "pol", "paya", "satna"]) assert.ok(html.includes(`value="${method}"`));
  assert.doesNotMatch(html, /value="bank_transfer"/); assert.match(html, /Confirm successful bank settlement/);
  const ready = render("RequestDetailView", { id: request.id, admin: true, locale: "en" }, { states: { 0: { ...detail, request: { ...detail.request, status: "ready" } }, 1: false } });
  assert.match(ready, /Approve &amp; start processing/); assert.doesNotMatch(ready, /Approve completion/);
  const customer = render("RequestDetailView", { id: request.id, locale: "en" }, { states: { 0: { ...detail, request: { ...detail.request, status: "completed" } }, 1: false } });
  assert.match(customer, /href="\/api\/requests\/request-test\/receipt"/);
  assert.doesNotMatch(customer, /Approve cleared funds|Approve completion|Review &amp; approve/);
});

test("service selector prices Priority separately and saved submissions immediately show bank instructions", () => {
  const props = { input: { locale: "en" }, disabled: false, validationMessage: null };
  const html = render("OnlineRequestSubmit", props, { states: { 0: policy, 1: false } });
  assert.match(html, /<legend>Service<\/legend>/); assert.match(html, /value="standard"/); assert.match(html, /value="priority"/);
  assert.match(html, /25 AUD/); assert.match(html, /Priority timing starts after cleared funds and required checks are confirmed/);
  assert.match(html, /<details[^>]*><summary>Service hours &amp; terms<\/summary>/);
  const saved = render("OnlineRequestSubmit", props, { states: { 0: policy, 1: false, 8: request } });
  assert.match(saved, /Request submitted/); assert.match(saved, /012-345/);
  assert.match(saved, /href="\/en\/dashboard\/requests\/request-test"/);
  assert.ok(saved.indexOf("012-345") < saved.indexOf("/en/dashboard/requests/request-test"));
  assert.doesNotMatch(saved, /will be notified|by email|queued for email/);
  const fa = render("OnlineRequestSubmit", { ...props, input: { locale: "fa" } }, { states: { 0: policy, 1: false } });
  assert.match(fa, /dir="rtl"/); assert.match(fa, /<legend>سرویس<\/legend>/);
  assert.match(fa, /ساعات و شرایط سرویس/); assert.doesNotMatch(fa, /Priority timing|Service hours|Handling target/);
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
  assert.match(html, /Payment window · minutes/);
  assert.match(html, /AU clearance · minutes \(1440 = 24h\)/);
  assert.match(html, /min="1440" max="10080" step="1" value="1440"/);
  assert.match(html, /Handling starts after cleared funds and checks/);
  assert.match(html, /Iran bank notice · English/); assert.match(html, /Iran bank notice · فارسی/);
  assert.match(html, /maxLength="2000"/i);
  assert.match(html, /id="request-timing"[^>]*hidden=""/);
  assert.match(html, /aria-controls="request-timing"/);
});

test("settings sections retain structured bank fields and separate English and Persian notes during editing", async () => {
  let saved;
  const harness = load("components/requests/RequestSettingsForm.tsx", { states: {
    0: { version: 1, settings: policy }, 1: policy.management_emails.join("\n"), 2: "", 3: false,
  }, actions: { saveRequestSettings: async input => { saved = input; return { data: { version: 2, settings: input.settings } }; } } });
  let tree = harness.rerender("RequestSettingsForm", {});
  let sections = elements(tree, node => node.type === "section");
  assert.equal(sections.filter(node => !node.props.hidden).length, 1);
  assert.equal(sections.find(node => !node.props.hidden).props.id, "request-service");
  elements(tree, node => node.type === "button" && node.props["aria-controls"] === "request-bank-details")[0].props.onClick();
  tree = harness.rerender("RequestSettingsForm", {});
  sections = elements(tree, node => node.type === "section");
  assert.equal(sections.find(node => !node.props.hidden).props.id, "request-bank-details");
  const bankSection = sections.find(node => node.props.id === "request-bank-details");
  const bsb = elements(bankSection, node => node.type === "label" && textOf(node) === "BSB")[0];
  assert.ok(bsb); const bsbInput = elements(bsb, node => node.type === "input")[0];
  assert.equal(bsbInput.props.type, "text"); assert.equal(bsbInput.props.dir, "ltr");
  assert.equal(bsbInput.props.value, "012-345");
  bsbInput.props.onChange({ target: { value: "000-123" } });
  const persian = elements(tree, node => node.type === "button" && textOf(node) === "فارسی")[0];
  persian.props.onClick(); tree = harness.rerender("RequestSettingsForm", {});
  const faNotes = elements(tree, node => node.type === "label" && textOf(node).startsWith("AUD notes · فارسی"))[0];
  const faTextarea = elements(faNotes, node => node.type === "textarea")[0];
  assert.equal(faTextarea.props.dir, "rtl"); assert.equal(faTextarea.props.lang, "fa");
  assert.equal(faTextarea.props.value, policy.payment_instructions_aud_fa);
  faTextarea.props.onChange({ target: { value: "شرح تراکنش را وارد کنید." } });
  tree = harness.rerender("RequestSettingsForm", {});
  assert.match(markup(tree), /Unsaved changes/);
  await elements(tree, node => node.type === "form")[0].props.onSubmit({ preventDefault() {} });
  assert.equal(saved.expectedVersion, 1); assert.equal(saved.settings.payment_details_aud.bsb, "000-123");
  assert.equal(saved.settings.payment_details_aud.account_number, "0012345678");
  assert.equal(saved.settings.payment_instructions_aud, policy.payment_instructions_aud);
  assert.equal(saved.settings.payment_instructions_aud_fa, "شرح تراکنش را وارد کنید.");
  assert.deepEqual(saved.settings.management_emails, policy.management_emails);
});

test("existing settings hash links open the corresponding section", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  const listeners = new Map();
  const fakeWindow = { location: { hash: "#request-terms" }, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  const cleanups = [];
  try {
    Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });
    const harness = load("components/requests/RequestSettingsForm.tsx", { captureEffects: true, states: { 0: { version: 1, settings: policy }, 3: false },
      actions: { getRequestSettings: async () => ({ data: { version: 1, settings: policy } }) } });
    let tree = harness.rerender("RequestSettingsForm", {});
    const panel = { open: false }; tree.props.ref.current = panel;
    cleanups.push(...harness.runEffects());
    await new Promise(resolve => setImmediate(resolve));
    tree = harness.rerender("RequestSettingsForm", {});
    assert.equal(panel.open, true);
    assert.equal(elements(tree, node => node.type === "section" && !node.props.hidden)[0].props.id, "request-terms");
    fakeWindow.location.hash = "#request-bank-details"; listeners.get("hashchange")();
    tree = harness.rerender("RequestSettingsForm", {});
    assert.equal(elements(tree, node => node.type === "section" && !node.props.hidden)[0].props.id, "request-bank-details");
  } finally {
    cleanups.forEach(cleanup => cleanup());
    if (original) Object.defineProperty(globalThis, "window", original); else delete globalThis.window;
  }
});

test("activity exposes private evidence details to management only", () => {
  const detail = { request, receipts: [], events: [{ id: "event-1", status: "awaiting_funds", event_type: "payment_evidence", public_message: "Payment reference submitted.", internal_message: "Private bank reference: ABC123", created_at: request.created_at }] };
  const admin = render("RequestDetailView", { id: request.id, admin: true, locale: "en" }, { states: { 0: detail, 1: false } });
  assert.match(admin, /Private bank reference: ABC123/);
  const customer = render("RequestDetailView", { id: request.id, locale: "en" }, { states: { 0: detail, 1: false } });
  assert.match(customer, /Status history/);
  assert.doesNotMatch(customer, /Private bank reference|ABC123/);
});

test("staff can record late or reviewed funds and release an already funded request without a second payment", () => {
  for (const status of ["submitted", "under_review", "awaiting_funds", "action_required", "expired"]) {
    const html = render("RequestDetailView", { id: request.id, admin: true, locale: "en" }, { states: { 0: { request: { ...request, status }, events: [], receipts: [] }, 1: false } });
    assert.match(html, /Approve cleared funds/, `Missing funds confirmation for ${status}`);
  }
  for (const status of ["under_review", "action_required"]) {
    const html = render("RequestDetailView", { id: request.id, admin: true, locale: "en" }, { states: { 0: { request: { ...request, status, funding_status: "confirmed" }, events: [], receipts: [] }, 1: false } });
    assert.match(html, /Approve funded request/);
    assert.doesNotMatch(html, /Approve cleared funds/);
  }
  const refund = render("RequestDetailView", { id: request.id, admin: true, locale: "en" }, { states: { 0: { request: { ...request, status: "action_required", funding_status: "refund_pending" }, events: [], receipts: [] }, 1: false } });
  assert.match(refund, /Approve returned refund/);
  assert.doesNotMatch(refund, /Approve cleared funds|Approve funded request/);
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

const messages = [
  { id: "message-1", sender_role: "admin", body: "Earlier admin guidance", send_email: false, created_at: "2026-09-13T01:00:00Z" },
  { id: "message-2", sender_role: "customer", body: "First customer response", created_at: "2026-09-13T01:01:00Z" },
  { id: "message-3", sender_role: "admin", body: "Please confirm the sender name.", send_email: true, created_at: "2026-09-13T01:02:00Z" },
  { id: "message-4", sender_role: "customer", body: "Name confirmed. <script>alert('test')</script>", created_at: "2026-09-13T01:03:00Z" },
];

test("customer banner highlights the latest admin message and links to a localized response panel", () => {
  const { RequestAdminMessageBanner } = load("components/requests/RequestConversation.tsx");
  for (const locale of ["en", "fa"]) {
    const banner = markup(RequestAdminMessageBanner({ messages, locale }));
    assert.match(banner, /Please confirm the sender name/);
    assert.doesNotMatch(banner, /Earlier admin guidance|First customer response|Name confirmed/);
    assert.match(banner, /href="#request-conversation"/);
    assert.match(banner, locale === "fa" ? /پیام زرمان/ : /Message from Zarman/);
    assert.match(banner, locale === "fa" ? /ارسال پاسخ/ : /Reply/);
    const thread = render("RequestConversation", { requestId: request.id, version: request.version, messages, locale, onUpdated: async () => {} });
    assert.match(thread, /id="request-conversation"/);
    assert.match(thread, locale === "fa" ? /پیام به مدیر/ : /Message to admin/);
    assert.match(thread, /dir="auto"/); assert.match(thread, /maxLength="2000"/i);
    assert.match(thread, /&lt;script&gt;/); assert.doesNotMatch(thread, /<script>|Send email|Email requested|Website only/);
  }
  const fallback = markup(RequestAdminMessageBanner({ messages: [], fallbackMessage: "Existing request requires a reply.", locale: "en" }));
  assert.match(fallback, /Existing request requires a reply/);
  assert.equal(RequestAdminMessageBanner({ messages: [], fallbackMessage: null, locale: "en" }), null);
});

test("management sees customer replies and email choices while the compact conversation can reveal older messages", () => {
  const props = { requestId: request.id, version: request.version, messages: [...messages,
    { id: "message-5", sender_role: "customer", body: "Second customer response", created_at: "2026-09-13T01:04:00Z" },
    { id: "message-6", sender_role: "admin", body: "Latest website-only update", send_email: false, created_at: "2026-09-13T01:05:00Z" },
  ], admin: true, locale: "en", onUpdated: async () => {} };
  const harness = load("components/requests/RequestConversation.tsx");
  let tree = harness.rerender("RequestConversation", props);
  let html = markup(tree);
  assert.match(html, /Customer messages|Reply to customer/); assert.match(html, /Second customer response/);
  assert.match(html, /Email requested/); assert.match(html, /Website only/); assert.match(html, /Send email/);
  assert.doesNotMatch(html, /Earlier admin guidance|First customer response/);
  const earlier = elements(tree, node => node.type === "button" && /earlier messages/.test(textOf(node)))[0];
  assert.ok(earlier); earlier.props.onClick();
  tree = harness.rerender("RequestConversation", props); html = markup(tree);
  assert.match(html, /Earlier admin guidance/); assert.match(html, /First customer response/);
  assert.match(html, /Show recent messages/);
});

test("message sending retains retry identity, honors admin website-only choice and leaves customer email policy server-controlled", async () => {
  for (const admin of [true, false]) {
    const calls = []; let refreshed = 0;
    const actions = { [admin ? "sendAdminRequestMessage" : "sendMyRequestMessage"]: async input => {
      calls.push(input);
      if (calls.length === 1) throw Error("Connection interrupted");
      return { data: { id: "saved-message" } };
    } };
    const harness = load("components/requests/RequestConversation.tsx", { states: { 0: "  Payment name confirmed.  ", 1: false }, actions });
    const props = { requestId: request.id, version: request.version, messages: [], admin, locale: "en", onUpdated: async () => { refreshed++; } };
    let tree = harness.rerender("RequestConversation", props);
    await elements(tree, node => node.type === "form")[0].props.onSubmit({ preventDefault() {} });
    tree = harness.rerender("RequestConversation", props);
    await elements(tree, node => node.type === "form")[0].props.onSubmit({ preventDefault() {} });
    assert.equal(calls.length, 2); assert.equal(calls[0].commandKey, calls[1].commandKey);
    assert.match(calls[0].commandKey, /^[\da-f-]{36}$/); assert.equal(calls[0].message, "Payment name confirmed.");
    assert.equal(calls[0].requestId, request.id); assert.equal(calls[0].expectedVersion, request.version);
    if (admin) assert.equal(calls[0].sendEmail, false);
    else assert.equal(Object.hasOwn(calls[0], "sendEmail"), false);
    assert.equal(refreshed, 1);
    const saved = markup(harness.rerender("RequestConversation", props));
    assert.match(saved, /Message sent/); assert.doesNotMatch(saved, /<textarea[^>]*>\s*Payment name confirmed/);
  }
});

test("blank messages never send, and Persian server errors stay localized without losing the draft", async () => {
  let calls = 0;
  const props = { requestId: request.id, version: request.version, messages: [], locale: "fa", onUpdated: async () => {} };
  const blank = load("components/requests/RequestConversation.tsx", { states: { 0: "   " }, actions: { sendMyRequestMessage: async () => { calls++; } } });
  await elements(blank.rerender("RequestConversation", props), node => node.type === "form")[0].props.onSubmit({ preventDefault() {} });
  assert.equal(calls, 0);
  const unavailable = load("components/requests/RequestConversation.tsx", { states: { 0: "نام واریزکننده تأیید شد" }, actions: { sendMyRequestMessage: async () => ({ error: "Request changed. Refresh before sending." }) } });
  await elements(unavailable.rerender("RequestConversation", props), node => node.type === "form")[0].props.onSubmit({ preventDefault() {} });
  const html = markup(unavailable.rerender("RequestConversation", props));
  assert.match(html, /نام واریزکننده تأیید شد/); assert.match(html, /role="alert"/);
  assert.match(html, /اطلاعات این درخواست تغییر کرده/); assert.doesNotMatch(html, /Request changed|Refresh before/);
});

test("a committed message with a lost response retries its original version and key after the thread refreshes", async () => {
  for (const admin of [true, false]) {
    const calls = []; const committed = new Map();
    let currentVersion = request.version;
    const harness = load("components/requests/RequestConversation.tsx", { states: { 0: "Confirming my payment details.", 1: false }, actions: {
      [admin ? "sendAdminRequestMessage" : "sendMyRequestMessage"]: async input => {
        calls.push(input);
        if (committed.has(input.commandKey)) return { data: committed.get(input.commandKey) };
        const message = { id: `message-${committed.size + 1}`, body: input.message };
        committed.set(input.commandKey, message); currentVersion++;
        return { error: "The response could not be received. Please retry." };
      },
    } });
    const props = () => ({ requestId: request.id, version: currentVersion, messages: [], admin, locale: "en", onUpdated: async () => {} });
    let tree = harness.rerender("RequestConversation", props());
    await elements(tree, node => node.type === "form")[0].props.onSubmit({ preventDefault() {} });
    assert.equal(currentVersion, request.version + 1);
    tree = harness.rerender("RequestConversation", props());
    await elements(tree, node => node.type === "form")[0].props.onSubmit({ preventDefault() {} });
    assert.equal(calls.length, 2); assert.equal(calls[1].expectedVersion, calls[0].expectedVersion);
    assert.equal(calls[1].commandKey, calls[0].commandKey); assert.equal(committed.size, 1);
    assert.match(markup(harness.rerender("RequestConversation", props())), /Message sent/);
  }
});

test("a definite stale message conflict refreshes the version and allows a fresh command identity", async () => {
  const calls = [];
  let currentVersion = request.version;
  const harness = load("components/requests/RequestConversation.tsx", { states: { 0: "Please review my transfer.", 1: false }, actions: {
    sendMyRequestMessage: async input => {
      calls.push(input);
      return calls.length === 1 ? { error: "This request has changed. Refresh the page before continuing." } : { data: { id: "message-saved" } };
    },
  } });
  const props = () => ({ requestId: request.id, version: currentVersion, messages: [], locale: "en", onUpdated: async () => { currentVersion = request.version + 1; } });
  let tree = harness.rerender("RequestConversation", props());
  await elements(tree, node => node.type === "form")[0].props.onSubmit({ preventDefault() {} });
  tree = harness.rerender("RequestConversation", props());
  await elements(tree, node => node.type === "form")[0].props.onSubmit({ preventDefault() {} });
  assert.equal(calls.length, 2); assert.equal(calls[1].expectedVersion, request.version + 1);
  assert.notEqual(calls[1].commandKey, calls[0].commandKey);
  assert.equal(calls[1].message, calls[0].message);
});

test("a committed partial-funds approval does not create a second payment when refreshed before retry", async () => {
  let latest = { request, events: [], receipts: [], messages: [] };
  const calls = []; const payments = new Map();
  const harness = load("components/requests/RequestDetailView.tsx", { states: {
    0: latest, 1: false, 6: "confirm_funds", 8: false, 9: "bank-payment-1", 10: "100", 11: "AUD", 15: "aud-account", 21: true,
  }, actions: {
    mutateAdminRequest: async input => {
      calls.push(input);
      if (payments.has(input.commandKey)) return { data: latest.request };
      payments.set(input.commandKey, input.payload.received_amount);
      latest = { ...latest, request: { ...latest.request, version: latest.request.version + 1, funding_status: "partial", funding_received: latest.request.funding_received + input.payload.received_amount } };
      return { error: "The response could not be received. Please retry." };
    },
    getAdminRequest: async () => ({ data: latest }),
  } });
  const props = { id: request.id, admin: true, locale: "en" };
  let tree = harness.rerender("RequestDetailView", props);
  await elements(tree, node => node.type === "form")[0].props.onSubmit({ preventDefault() {} });
  elements(tree, node => node.type === "button" && textOf(node) === "Refresh")[0].props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  tree = harness.rerender("RequestDetailView", props);
  await elements(tree, node => node.type === "form")[0].props.onSubmit({ preventDefault() {} });
  assert.equal(calls.length, 2); assert.equal(calls[1].commandKey, calls[0].commandKey);
  assert.equal(calls[1].expectedVersion, request.version); assert.equal(payments.size, 1);
  assert.equal(latest.request.funding_received, 100); assert.equal(calls[1].sendEmail, false);
});

test("a definite stale approval conflict can be retried using the refreshed request version", async () => {
  const detail = { request, events: [], receipts: [], messages: [] };
  const calls = [];
  const harness = load("components/requests/RequestDetailView.tsx", { states: {
    0: detail, 1: false, 6: "confirm_funds", 8: false, 9: "bank-payment-2", 10: "100", 11: "AUD", 15: "aud-account", 21: true,
  }, actions: {
    mutateAdminRequest: async input => {
      calls.push(input);
      return calls.length === 1 ? { error: "This request has changed. Refresh the page before continuing." } : { data: detail.request };
    },
    getAdminRequest: async () => ({ data: { ...detail, request: { ...request, version: request.version + 1 } } }),
  } });
  const props = { id: request.id, admin: true, locale: "en" };
  let tree = harness.rerender("RequestDetailView", props);
  await elements(tree, node => node.type === "form")[0].props.onSubmit({ preventDefault() {} });
  elements(tree, node => node.type === "button" && textOf(node) === "Refresh")[0].props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  tree = harness.rerender("RequestDetailView", props);
  const confirmation = elements(tree, node => node.type === "label" && textOf(node).includes("I verified this payment in the bank account."))[0];
  const checkbox = elements(confirmation, node => node.type === "input")[0];
  assert.equal(checkbox.props.checked, false);
  checkbox.props.onChange({ target: { checked: true } });
  tree = harness.rerender("RequestDetailView", props);
  await elements(tree, node => node.type === "form")[0].props.onSubmit({ preventDefault() {} });
  assert.equal(calls.length, 2); assert.equal(calls[1].expectedVersion, request.version + 1);
  assert.notEqual(calls[1].commandKey, calls[0].commandKey);
  assert.deepEqual(calls[1].payload, calls[0].payload);
});

test("admin approval steps each expose an explicit email option and require confirmation", () => {
  for (const [status, action] of [["submitted", "await_funds"], ["awaiting_funds", "confirm_funds"], ["ready", "start_processing"], ["processing", "complete"]]) {
    const html = render("RequestDetailView", { id: request.id, admin: true, locale: "en" }, { states: {
      0: { request: { ...request, status, funding_status: ["ready", "processing"].includes(status) ? "confirmed" : "unpaid" }, events: [], receipts: [], messages: [] },
      1: false, 6: action,
    } });
    assert.match(html, /aria-label="Approval actions"/);
    assert.match(html, /Send email to customer and management/);
    assert.match(html, /type="checkbox" required=""/);
    assert.match(html, /type="submit" disabled=""/);
    assert.match(html, /adminWorkspace/);
    assert.doesNotMatch(html, /class="[^"]*progressSteps/);
  }
});

test("admin approval submits the chosen email policy and customer actions do not expose that control", async () => {
  const detail = { request: { ...request, status: "submitted" }, events: [], receipts: [], messages: [] };
  const calls = [];
  const harness = load("components/requests/RequestDetailView.tsx", { states: { 0: detail, 1: false }, actions: {
    mutateAdminRequest: async input => { calls.push(input); return { data: detail.request }; },
    getAdminRequest: async () => ({ data: detail }),
  } });
  const props = { id: request.id, admin: true, locale: "en" };
  let tree = harness.rerender("RequestDetailView", props);
  const approve = elements(tree, node => node.type === "button" && textOf(node) === "Approve request")[0];
  assert.ok(approve); approve.props.onClick();
  tree = harness.rerender("RequestDetailView", props);
  const labels = elements(tree, node => node.type === "label");
  const email = labels.find(node => textOf(node).includes("Send email to customer and management"));
  const confirm = labels.find(node => textOf(node).includes("I reviewed and approve this update."));
  assert.ok(email); assert.ok(confirm);
  elements(email, node => node.type === "input")[0].props.onChange({ target: { checked: false } });
  elements(confirm, node => node.type === "input")[0].props.onChange({ target: { checked: true } });
  tree = harness.rerender("RequestDetailView", props);
  await elements(tree, node => node.type === "form")[0].props.onSubmit({ preventDefault() {} });
  assert.equal(calls.length, 1); assert.equal(calls[0].action, "await_funds"); assert.equal(calls[0].sendEmail, false);
  assert.equal(calls[0].requestId, request.id); assert.equal(calls[0].expectedVersion, request.version);
  assert.match(calls[0].commandKey, /^[\da-f-]{36}$/);
  const customer = render("RequestDetailView", { id: request.id, locale: "en" }, { states: { 0: detail, 1: false } });
  assert.doesNotMatch(customer, /Approval actions|Send email|Review &amp; approve|Approve cleared funds/);
  assert.match(customer, /customerLayout/); assert.doesNotMatch(customer, /adminWorkspace/);
  assert.match(customer, /class="[^"]*progressSteps/);
});
