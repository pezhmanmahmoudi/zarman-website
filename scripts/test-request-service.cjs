/* eslint-disable @typescript-eslint/no-require-imports */
// Exercise server actions with isolated auth/database/storage doubles. No env
// files, real credentials, network access, payments or notifications are used.
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

function compile(path, imports = {}, env = {}, globals = {}) {
  const code = ts.transpileModule(readFileSync(resolve(__dirname, "..", path), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const compiledModule = { exports: {} };
  const context = vm.createContext({ module: compiledModule, exports: compiledModule.exports, Buffer, URL, FormData, File, Uint8Array, Intl, Date, console, ...globals,
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://fixture.invalid", SUPABASE_SERVICE_ROLE_KEY: "test-only", ...env } },
    require: id => Object.hasOwn(imports, id) ? imports[id] : require(id),
  });
  vm.runInContext(code, context, { filename: path });
  return compiledModule.exports;
}
const validation = compile("lib/requests/validation.ts");
const upload = compile("lib/requests/receipt-upload.ts");
const navigation = compile("lib/requests/navigation.ts");
const notificationConfig = compile("lib/requests/notification-config.ts");
const pricing = compile("lib/pricing.ts");
const CUSTOMER = "10000000-0000-4000-8000-000000000001";
const OTHER = "10000000-0000-4000-8000-000000000002";
const RECIPIENT = "20000000-0000-4000-8000-000000000001";
const REQUEST = "30000000-0000-4000-8000-000000000001";
const COMMAND = "40000000-0000-4000-8000-000000000001";
const ACCOUNT = "50000000-0000-4000-8000-000000000001";
const input = { rawAmount: 1000, txType: "sell_aud", sourceOfFunds: "Salary", reasonForTransfer: "Family support", recipientId: RECIPIENT, serviceTier: "standard", locale: "en" };
const settings = { ...validation.DEFAULT_REQUEST_SETTINGS, enabled: true, priority_enabled: true, priority_fee_aud: 25, priority_capacity: 5,
  payment_instructions_aud: "Synthetic AUD bank details", payment_instructions_irt: "Synthetic IRT bank details",
  payment_details_aud: { account_name: "TEST ONLY", bsb: "000-000", account_number: "00123456" },
  payment_details_irt: { account_name: "TEST ONLY", iban: "IR" + "0".repeat(24) },
  management_emails: ["operations@example.invalid"], priority_terms: "Synthetic terms", priority_terms_fa: "شرایط آزمایشی" };

function harness(overrides = {}) {
  const state = { user: { id: CUSTOMER, email: "customer@example.invalid", email_confirmed_at: "2026-09-01T00:00:00Z" },
    kyc: "approved", admin: false, recipientOwner: CUSTOMER, requestOwner: CUSTOMER, direction: "irt", settings,
    calls: [], inserts: [], storageCalls: [], ...overrides };
  const db = {
    from(table) {
      const query = { table, filters: {}, operation: "read", value: undefined };
      const builder = {};
      for (const name of ["limit", "gte", "not", "in", "is"]) builder[name] = () => builder;
      builder.select = columns => { query.columns = columns; return builder; };
      builder.order = (column, options) => { query.order = { column, ...options }; return builder; };
      builder.eq = (field, value) => { query.filters[field] = value; return builder; };
      builder.insert = value => { query.operation = "insert"; query.value = value; return builder; };
      const finish = () => {
        state.calls.push({ ...query });
        if (query.operation === "insert") {
          state.inserts.push(query);
          return { data: { id: COMMAND, ...query.value, created_at: new Date().toISOString() }, error: null };
        }
        switch (table) {
          case "exchange_request_settings": return { data: { version: 1, settings: state.settings }, error: null };
          case "profiles": return { data: { id: CUSTOMER, first_name: "Test", last_name: "Customer", kyc_status: state.kyc }, error: null };
          case "rates_history": return { data: { id: 1, buy_aud: 50000, sell_aud: 52000, market_active: state.market !== false }, error: null };
          case "transactions": return { data: [], error: null };
          case "recipients": return query.filters.user_id !== state.recipientOwner ? { data: null, error: { code: "PGRST116" } } : {
            data: { id: RECIPIENT, user_id: state.recipientOwner, direction: state.direction, full_name: "Test Recipient", bank_type: "other", shaba_number: "IR" + "1".repeat(24), account_name: "Test Recipient", bsb: "062000", account_number: "12345678" }, error: null };
          case "exchange_request_quotes": return { data: [], count: 0, error: null };
          case "exchange_request_commands": {
            if (state.commandReadError) return { data: null, error: state.commandReadError };
            const row = (state.commands || []).find(command => Object.entries(query.filters).every(([key, value]) => command[key] === value));
            return { data: row ? { accounting_date_jalali: row.accounting_date_jalali } : null, error: null };
          }
          case "exchange_request_payments": {
            if (state.paymentReadError) return { data: null, error: state.paymentReadError };
            const rows = (state.payments || []).filter(payment => Object.entries(query.filters).every(([key, value]) => payment[key] === value));
            if (query.order) rows.sort((a, b) => (query.order.ascending ? 1 : -1) * String(a[query.order.column]).localeCompare(String(b[query.order.column])));
            return { data: rows.map(row => Object.fromEntries(query.columns.split(",").map(column => [column, row[column]]))), error: null };
          }
          case "exchange_requests": {
            if (query.filters.user_id && query.filters.user_id !== state.requestOwner) return { data: null, error: {} };
            const request = { id: REQUEST, user_id: state.requestOwner, status: "awaiting_funds", payment_approved_at: null, funding_status: "unpaid", priority_fee_status: "not_applicable", ...state.request };
            return { data: query.single ? request : [request], error: null };
          }
          case "exchange_request_receipts": return state.receipt ? { data: state.receipt, error: null } : { data: null, count: 0, error: null };
          default: return { data: [], error: null };
        }
      };
      builder.single = builder.maybeSingle = async () => { query.single = true; return finish(); };
      builder.then = (onSuccess, onFailure) => Promise.resolve(finish()).then(onSuccess, onFailure);
      return builder;
    },
    rpc: async (name, args) => { state.calls.push({ rpc: name, args }); return state.rpc ? state.rpc(name, args) : { data: { id: REQUEST, ...state.rpcRequest }, error: null }; },
    storage: { from: bucket => ({
      createSignedUrl: async (...args) => { state.storageCalls.push({ bucket, args }); return { data: { signedUrl: "https://fixture.invalid/private-download" }, error: null }; },
    }) },
  };
  const auth = { auth: { getUser: async () => ({ data: { user: state.user }, error: null }) } };
  const actions = compile("app/actions/request.actions.ts", {
    "@supabase/supabase-js": { createClient: () => db },
    "@/lib/supabase-server": { createSupabaseServerActionClient: async () => auth },
    "@/app/actions/admin.actions": { requireAdmin: async () => { if (!state.admin) throw new Error("Administrator required"); return state.user; } },
    "@/lib/requests/validation": validation, "@/lib/requests/receipt-upload": upload, "@/lib/pricing": pricing,
    "@/lib/requests/notification-config": notificationConfig,
  }, state.env, state.now ? { Date: class extends Date {
    constructor(...args) { super(...(args.length ? args : [state.now])); }
    static now() { return new Date(state.now).getTime(); }
  } } : {});
  return { actions, state };
}

test("priority is an additional collection line in both directions; recipient principal stays unchanged", async () => {
  const selling = harness();
  const quote = await selling.actions.createRequestQuote({ ...input, serviceTier: "priority", agreedEquivalentToman: 1 });
  assert.equal(quote.error, undefined);
  assert.equal(quote.data.snapshot.funding_total, 1025);
  assert.equal(quote.data.snapshot.recipient_amount, 50000000);
  assert.equal(quote.data.snapshot.priority_fee_amount, 25);
  assert.equal(quote.data.snapshot.equivalent_toman, 50000000);
  assert.equal(quote.data.snapshot.policy_snapshot.management_emails, undefined);
  assert.equal(quote.data.snapshot.policy_snapshot.payment_instructions_aud, undefined);
  const buying = harness({ direction: "aud" });
  const purchase = await buying.actions.createRequestQuote({ ...input, txType: "buy_aud", serviceTier: "priority" });
  assert.equal(purchase.data.snapshot.recipient_amount, 1000);
  assert.equal(purchase.data.snapshot.funding_total, 53300000);
  assert.equal(purchase.data.snapshot.priority_fee_amount, 1300000);
});

test("auth, KYC, market, recipient ownership/direction and finite amounts are enforced before quote insertion", async () => {
  for (const [overrides, changedInput] of [[{ user: null }, {}], [{ kyc: "pending" }, {}], [{ market: false }, {}],
    [{ recipientOwner: OTHER }, {}], [{ direction: "aud" }, {}], [{}, { rawAmount: Infinity }], [{}, { rawAmount: -1 }], [{}, { rawAmount: 1.001 }]]) {
    const { actions, state } = harness(overrides);
    const response = await actions.createRequestQuote({ ...input, ...changedInput });
    assert.ok(response.error);
    assert.equal(state.inserts.length, 0);
  }
});

test("submission binds the RPC actor to the authenticated session and forwards the retry key", async () => {
  const { actions, state } = harness();
  await actions.submitExchangeRequest({ quoteId: REQUEST, commandKey: COMMAND, userId: OTHER, status: "completed" });
  const call = state.calls.find(call => call.rpc === "submit_exchange_request");
  assert.equal(call.args.p_actor_id, CUSTOMER);
  assert.equal(call.args.p_idempotency_key, COMMAND);
  assert.equal(Object.hasOwn(call.args, "status"), false);
});

test("customer cannot complete or confirm funds, and admin must supply an actual receiving account", async () => {
  const { actions, state } = harness();
  const base = { requestId: REQUEST, commandKey: COMMAND, expectedVersion: 1, sendEmail: false };
  assert.ok((await actions.mutateMyRequest({ ...base, action: "complete" })).error);
  assert.ok((await actions.mutateMyRequest({ ...base, action: "confirm_funds" })).error);
  assert.equal(state.calls.filter(call => call.rpc).length, 0);
  state.admin = true;
  assert.ok((await actions.mutateAdminRequest({ ...base, action: "confirm_funds", payload: { received_amount: 1000, received_currency: "AUD", payment_reference: "BANK-123" } })).error);
  const valid = await actions.mutateAdminRequest({ ...base, action: "confirm_funds", payload: { received_amount: 1000, received_currency: "AUD", payment_reference: "BANK-123", receiver_account_id: ACCOUNT } });
  assert.equal(valid.error, undefined);
});

test("settlement dates use canonical Persian year/month/day and cannot be supplied by the browser", async () => {
  const { actions, state } = harness({ admin: true });
  const response = await actions.mutateAdminRequest({ requestId: REQUEST, commandKey: COMMAND, expectedVersion: 1, sendEmail: true, action: "complete", payload: {
    settlement_reference: "SETTLED-123", payer_account_id: ACCOUNT, receiver_account_id: OTHER, transfer_method: "free", date_jalali: "2000/01/01",
  } });
  assert.equal(response.error, undefined);
  const payload = state.calls.find(call => call.rpc).args.p_payload;
  assert.match(payload.date_jalali, /^14\d{2}\/\d{2}\/\d{2}$/);
  assert.notEqual(payload.date_jalali, "2000/01/01");
});

test("foreign request and receipt downloads never expose event history or a signed storage URL", async () => {
  const { actions, state } = harness({ requestOwner: OTHER, receipt: { request_id: REQUEST, storage_path: "private/object.pdf", original_name: "receipt.pdf" } });
  assert.ok((await actions.getMyRequest(REQUEST)).error);
  assert.equal(state.calls.some(call => call.table === "exchange_request_events"), false);
  assert.equal(state.calls.some(call => call.table === "exchange_request_messages"), false);
  assert.ok((await actions.getRequestReceiptUrl(COMMAND)).error);
  assert.equal(state.storageCalls.length, 0);
});

test("admin detail reads actual bank deposits in their recorded currency with only the permitted columns", async () => {
  const payment = { id: COMMAND, request_id: REQUEST, payment_reference: "BANK-AUD-2235", amount: "2235.00", currency: "AUD",
    account_id: ACCOUNT, actor_id: CUSTOMER, created_at: "2026-09-16T02:00:00Z" };
  const { actions, state } = harness({ admin: true, request: { funding_currency: "IRT", funding_total: 120000000, funds_received_at: null }, payments: [
    { ...payment, id: OTHER, payment_reference: "EARLIER-DEPOSIT", amount: 100, created_at: "2026-09-16T01:00:00Z" },
    { ...payment, id: RECIPIENT, request_id: OTHER, payment_reference: "PRIVATE-OTHER-REQUEST" },
    payment,
  ] });
  const response = await actions.getAdminRequest(REQUEST);
  assert.equal(response.error, undefined);
  assert.equal(response.data.request.funding_currency, "IRT");
  assert.equal(response.data.request.funds_received_at, null);
  assert.equal(response.data.payments.length, 2);
  assert.equal(response.data.payments[0].payment_reference, "BANK-AUD-2235");
  assert.equal(response.data.payments[0].amount, "2235.00");
  assert.equal(response.data.payments[0].currency, "AUD");
  assert.equal(response.data.payments[0].account_id, ACCOUNT);
  assert.equal(response.data.payments[1].amount, 100);
  assert.equal(Object.hasOwn(response.data.payments[0], "actor_id"), false);
  const reads = state.calls.filter(call => call.table === "exchange_request_payments");
  assert.equal(reads.length, 1);
  assert.equal(reads[0].columns, "id,request_id,payment_reference,amount,currency,account_id,created_at");
  assert.deepEqual(reads[0].filters, { request_id: REQUEST });
  assert.deepEqual(reads[0].order, { column: "created_at", ascending: false });
  assert.equal(state.calls.some(call => call.rpc || call.operation === "insert"), false);
});

test("customers cannot query or receive private funding payments, including through the admin action", async () => {
  const { actions, state } = harness({ payments: [{ request_id: REQUEST, payment_reference: "PRIVATE-BANK-REFERENCE" }] });
  const ownerDetail = await actions.getMyRequest(REQUEST);
  assert.equal(ownerDetail.error, undefined);
  assert.equal(Object.hasOwn(ownerDetail.data, "payments"), false);
  assert.equal(Object.hasOwn(ownerDetail.data, "deliveries"), false);
  assert.equal(state.calls.some(call => call.table === "exchange_request_payments"), false);
  assert.ok((await actions.getAdminRequest(REQUEST)).error);
  state.requestOwner = OTHER;
  assert.ok((await actions.getMyRequest(REQUEST)).error);
  state.user = null;
  assert.ok((await actions.getMyRequest(REQUEST)).error);
  assert.equal(state.calls.some(call => call.table === "exchange_request_payments"), false);
});

test("admin payment read failures do not masquerade as an empty deposit history", async () => {
  const { actions, state } = harness({ admin: true, paymentReadError: { code: "FETCH_ERROR", message: "Temporary read failure" } });
  const response = await actions.getAdminRequest(REQUEST);
  assert.ok(response.error);
  assert.equal(response.data, undefined);
  assert.equal(state.calls.filter(call => call.table === "exchange_request_payments").length, 1);
  assert.equal(state.calls.some(call => call.rpc || call.operation === "insert"), false);
});

test("file validation rejects HTML, mismatched MIME and oversized data; sanitises supplied filenames", () => {
  const pdf = Buffer.from("%PDF-1.7\nfixture");
  assert.equal(upload.inspectReceiptUpload(pdf, "../../receipt.pdf", "application/pdf").filename.includes("/"), false);
  assert.throws(() => upload.inspectReceiptUpload(Buffer.from("<svg onload=alert(1)>"), "receipt.svg", "image/svg+xml"));
  assert.throws(() => upload.inspectReceiptUpload(pdf, "receipt.png", "image/png"));
  assert.throws(() => upload.inspectReceiptUpload(new Uint8Array(upload.MAX_REQUEST_RECEIPT_BYTES + 1), "large.pdf", "application/pdf"));
});

test("service enablement requires bank instructions and notification recipients; clearance buffer cannot undercut 24h", () => {
  assert.equal(validation.settingsInputError(settings), null);
  assert.ok(validation.settingsInputError({ ...settings, management_emails: [] }));
  assert.ok(validation.settingsInputError({ ...settings, australian_clearance_minutes: 60 }));
  assert.ok(validation.settingsInputError({ ...settings, priority_fee_aud: NaN }));
  assert.ok(validation.settingsInputError({ ...settings, priority_minutes: settings.standard_minutes }));
  assert.ok(validation.settingsInputError({ ...settings, iran_banking_notice_fa: "" }));
  assert.ok(validation.bankDetailsError({ account_name: "TEST\nONLY" }, "aud"));
  assert.ok(validation.bankDetailsError({ account_name: " ".repeat(201) }, "aud"));
});

test("activation rejects unusable mail configuration before writing settings", async () => {
  const env = { RESEND_API_KEY: "test-key", REQUEST_NOTIFICATIONS_FROM: "Zarman <sender@example.invalid>", REQUEST_SITE_URL: "https://example.invalid", REQUEST_NOTIFICATIONS_CRON_SECRET: "x".repeat(32), RESEND_WEBHOOK_SECRET: "whsec_test" };
  for (const change of [{ REQUEST_NOTIFICATIONS_FROM: undefined }, { REQUEST_NOTIFICATIONS_CRON_SECRET: "short" }, { REQUEST_SITE_URL: "https://example.invalid/path" }, { RESEND_WEBHOOK_SECRET: "" }]) {
    const { actions, state } = harness({ admin: true, env: { ...env, ...change } });
    assert.ok((await actions.saveRequestSettings({ expectedVersion: 1, settings })).error);
    assert.equal(state.calls.some(call => call.rpc === "save_exchange_request_settings"), false);
  }
  const valid = harness({ admin: true, env });
  assert.equal((await valid.actions.saveRequestSettings({ expectedVersion: 1, settings })).error, undefined);
  assert.ok(valid.state.calls.some(call => call.rpc === "save_exchange_request_settings"));
});

test("login returns to tracking/draft URLs and rejects off-site and cross-locale redirects", () => {
  assert.equal(navigation.dashboardReturnPath(`/en/dashboard/requests/${REQUEST}`, "en"), `/en/dashboard/requests/${REQUEST}`);
  assert.equal(navigation.dashboardReturnPath("/en/dashboard?requestAmountAud=1000", "en"), "/en/dashboard?requestAmountAud=1000");
  for (const target of ["https://evil.invalid/en/dashboard", "//evil.invalid", "/fa/dashboard", "/en/dashboard/../../admin", "\\evil.invalid"]) {
    assert.equal(navigation.dashboardReturnPath(target, "en"), "/en/dashboard");
  }
});

test("legacy settings remain editable by admins, while new quotes require structured bank details", async () => {
  const legacy = { ...settings, payment_details_aud: {}, payment_details_irt: {} };
  const { actions, state } = harness({ settings: legacy, admin: true });
  assert.equal((await actions.getRequestSettings()).data.settings.enabled, true);
  assert.ok((await actions.createRequestQuote(input)).error);
  assert.equal(state.inserts.length, 0);
  state.admin = false;
  assert.ok((await actions.getRequestSettings()).error);
});

test("each admin approval requires an email decision, and customer payloads cannot control delivery", async () => {
  const { actions, state } = harness({ admin: true });
  const base = { requestId: REQUEST, commandKey: COMMAND, expectedVersion: 1, action: "await_funds" };
  assert.ok((await actions.mutateAdminRequest(base)).error);
  assert.equal(state.calls.filter(call => call.rpc).length, 0);
  for (const sendEmail of [false, true]) {
    assert.equal((await actions.mutateAdminRequest({ ...base, sendEmail, payload: { send_email: !sendEmail, private_note: "forged" } })).error, undefined);
    const payload = state.calls.filter(call => call.rpc).at(-1).args.p_payload;
    assert.equal(payload.send_email, sendEmail);
    assert.equal(payload.private_note, undefined);
  }
  assert.ok((await actions.mutateMyRequest({ ...base, action: "cancel", sendEmail: false })).error);
  assert.equal((await actions.mutateMyRequest({ ...base, action: "cancel", payload: { send_email: false } })).error, undefined);
  assert.equal(Object.hasOwn(state.calls.filter(call => call.rpc).at(-1).args.p_payload, "send_email"), false);
});

test("messages bind the actor and retry key, trim content, and restrict email decisions to admins", async () => {
  const { actions, state } = harness();
  const base = { requestId: REQUEST, commandKey: COMMAND, expectedVersion: 4, message: "  Please check the receipt.  " };
  assert.equal((await actions.sendMyRequestMessage({ ...base, actorId: OTHER, sender_role: "admin" })).error, undefined);
  const call = state.calls.find(call => call.rpc === "send_exchange_request_message");
  assert.equal(call.args.p_actor_id, CUSTOMER);
  assert.equal(call.args.p_command_key, COMMAND);
  assert.equal(call.args.p_expected_version, 4);
  assert.equal(call.args.p_message, "Please check the receipt.");
  assert.equal(call.args.p_send_email, false);
  assert.ok((await actions.sendMyRequestMessage({ ...base, sendEmail: true })).error);
  assert.ok((await actions.sendMyRequestMessage({ ...base, message: " " })).error);
  assert.ok((await actions.sendMyRequestMessage({ ...base, message: "x".repeat(2001) })).error);
  assert.ok((await actions.sendAdminRequestMessage({ ...base, sendEmail: false })).error);
  state.admin = true;
  assert.ok((await actions.sendAdminRequestMessage(base)).error);
  assert.equal((await actions.sendAdminRequestMessage({ ...base, sendEmail: false })).error, undefined);
  assert.equal(state.calls.filter(call => call.rpc).at(-1).args.p_send_email, false);
  assert.equal((await actions.sendAdminRequestMessage({ ...base, sendEmail: true })).error, undefined);
  assert.equal(state.calls.filter(call => call.rpc).at(-1).args.p_send_email, true);
  state.user = null;
  assert.ok((await actions.sendMyRequestMessage(base)).error);
});

test("unapproved customer responses never expose bank details through submit, list, detail or mutation", async () => {
  const bank = { payment_approved_at: null, payment_details: { bsb: "062000", account_number: "00123456" }, payment_instructions: "Private bank instructions", payment_instructions_fa: "مشخصات بانکی" };
  const { actions, state } = harness({ request: bank, rpcRequest: bank });
  const submit = await actions.submitExchangeRequest({ quoteId: REQUEST, commandKey: COMMAND });
  const list = await actions.listMyRequests();
  const detail = await actions.getMyRequest(REQUEST);
  const cancelled = await actions.mutateMyRequest({ requestId: REQUEST, commandKey: COMMAND, expectedVersion: 1, action: "cancel" });
  for (const request of [submit.data, list.data[0], detail.data.request, cancelled.data]) {
    assert.equal(request.payment_details, null);
    assert.equal(request.payment_instructions, null);
    assert.equal(request.payment_instructions_fa, null);
  }
  state.request = { ...bank, payment_approved_at: "2026-09-15T01:00:00Z" };
  assert.equal((await actions.getMyRequest(REQUEST)).data.request.payment_details.account_number, "00123456");
  state.admin = true;
  state.request = bank;
  assert.equal((await actions.getAdminRequest(REQUEST)).data.request.payment_details.account_number, "00123456");
});

test("receipt sending requires payment approval before storage or registration can be touched", async () => {
  const { actions, state } = harness({ request: { payment_approved_at: null } });
  const form = new FormData();
  form.set("requestId", REQUEST); form.set("commandKey", COMMAND);
  form.set("file", new File(["%PDF-1.7\nfixture"], "receipt.pdf", { type: "application/pdf" }));
  assert.match((await actions.uploadRequestReceipt(form)).error, /Wait for payment approval/);
  assert.equal(state.storageCalls.length, 0);
  assert.equal(state.calls.some(call => call.rpc || call.table === "exchange_request_receipts"), false);
});

test("final reconciliation is admin-only and sends one validated command with a server accounting date", async () => {
  const { actions, state } = harness({ admin: true });
  const input = { requestId: REQUEST, commandKey: COMMAND, expectedVersion: 5, action: "reconcile_complete", sendEmail: false,
    payload: { payer_account_id: ACCOUNT, receiver_account_id: OTHER, settlement_reference: "TEST-DESTINATION-PAID", transfer_method: "paya", date_jalali: "forged" } };
  assert.equal((await actions.mutateAdminRequest(input)).error, undefined);
  const calls = state.calls.filter(call => call.rpc);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].args.p_action, "reconcile_complete");
  assert.equal(calls[0].args.p_payload.send_email, false);
  assert.match(calls[0].args.p_payload.date_jalali, /^14\d{2}\/\d{2}\/\d{2}$/);
  assert.ok((await actions.mutateAdminRequest({ ...input, payload: { ...input.payload, settlement_reference: "" } })).error);
  assert.ok((await actions.mutateMyRequest({ ...input, sendEmail: undefined })).error);
});

const financialActions = {
  confirm_funds: { received_amount: 1000, received_currency: "AUD", payment_reference: "BANK-123", receiver_account_id: ACCOUNT },
  complete: { settlement_reference: "SETTLED-123", payer_account_id: ACCOUNT, receiver_account_id: OTHER, transfer_method: "paya" },
  reconcile_complete: { settlement_reference: "SETTLED-123", payer_account_id: ACCOUNT, receiver_account_id: OTHER, transfer_method: "satna" },
  resume_funded_request: { honour_quote: true },
  confirm_refund: { refund_reference: "REFUND-123", refund_kind: "principal", payer_account_id: ACCOUNT },
};

for (const [action, payload] of Object.entries(financialActions)) {
  test(`${action}: a committed retry across UTC midnight reuses the original accounting date and still invokes SQL`, async () => {
    const { actions, state } = harness({ admin: true, now: "2026-09-15T23:59:59Z", commands: [] });
    let commits = 0;
    state.rpc = (name, args) => {
      assert.equal(name, "transition_exchange_request");
      const prior = state.commands.find(command => command.request_id === args.p_request_id && command.command_key === args.p_command_key);
      if (prior) {
        if (prior.fingerprint !== JSON.stringify(args)) return { data: null, error: { code: "P0001", message: "COMMAND_PAYLOAD_CONFLICT" } };
        return { data: { id: REQUEST, version: 6 }, error: null };
      }
      state.commands.push({ request_id: args.p_request_id, command_key: args.p_command_key, actor_id: args.p_actor_id,
        accounting_date_jalali: args.p_payload.date_jalali, fingerprint: JSON.stringify(args) });
      commits += 1;
      return { data: null, error: { code: "FETCH_ERROR", message: "Response lost after commit" } };
    };
    const input = { requestId: REQUEST, commandKey: COMMAND, expectedVersion: 5, action, sendEmail: false, payload };
    assert.ok((await actions.mutateAdminRequest(input)).error);
    const first = state.calls.find(call => call.rpc).args;
    state.now = "2026-09-16T00:00:01Z";
    const replay = await actions.mutateAdminRequest(input);
    assert.equal(replay.error, undefined);
    assert.equal(replay.data.version, 6);
    assert.equal(commits, 1);
    assert.equal(JSON.stringify(state.calls.filter(call => call.rpc).at(-1).args), JSON.stringify(first));
    assert.equal(state.calls.filter(call => call.rpc).length, 2);
    const lookup = state.calls.filter(call => call.table === "exchange_request_commands").at(-1);
    assert.deepEqual(lookup.filters, { request_id: REQUEST, command_key: COMMAND, actor_id: CUSTOMER });
    assert.equal(lookup.columns, "accounting_date_jalali");

    // Saved dates must not bypass the SQL fingerprint check for any other intent.
    for (const changed of [{ sendEmail: true }, { expectedVersion: 6 }, { payload: { ...payload, message: "Changed intent" } }]) {
      const rejected = await actions.mutateAdminRequest({ ...input, ...changed });
      assert.equal(rejected.error, "COMMAND_PAYLOAD_CONFLICT");
      assert.equal(state.calls.filter(call => call.rpc).at(-1).args.p_payload.date_jalali, first.p_payload.date_jalali);
    }
    assert.equal(commits, 1);

    // A genuinely new command receives today's date, proving the clock crossed a day.
    assert.ok((await actions.mutateAdminRequest({ ...input, commandKey: OTHER })).error);
    const fresh = state.calls.filter(call => call.rpc).at(-1).args;
    assert.notEqual(fresh.p_payload.date_jalali, first.p_payload.date_jalali);
    assert.equal(commits, 2);
  });
}

test("accounting date lookup excludes commands from another actor, request or key and preserves legacy fallback", async () => {
  const input = { requestId: REQUEST, commandKey: COMMAND, expectedVersion: 5, action: "confirm_funds", sendEmail: false, payload: financialActions.confirm_funds };
  const { actions, state } = harness({ admin: true, now: "2026-09-16T00:00:01Z", commands: [
    { request_id: REQUEST, command_key: COMMAND, actor_id: OTHER, accounting_date_jalali: "1300/01/01" },
    { request_id: OTHER, command_key: COMMAND, actor_id: CUSTOMER, accounting_date_jalali: "1300/01/02" },
    { request_id: REQUEST, command_key: OTHER, actor_id: CUSTOMER, accounting_date_jalali: "1300/01/03" },
  ] });
  assert.equal((await actions.mutateAdminRequest(input)).error, undefined);
  const currentDate = state.calls.find(call => call.rpc).args.p_payload.date_jalali;
  assert.match(currentDate, /^14\d{2}\/\d{2}\/\d{2}$/);
  state.commands.push({ request_id: REQUEST, command_key: COMMAND, actor_id: CUSTOMER, accounting_date_jalali: null });
  assert.equal((await actions.mutateAdminRequest(input)).error, undefined);
  assert.equal(state.calls.filter(call => call.rpc).at(-1).args.p_payload.date_jalali, currentDate);
});

test("an unavailable or malformed saved accounting date fails without sending a differently fingerprinted command", async () => {
  const input = { requestId: REQUEST, commandKey: COMMAND, expectedVersion: 5, action: "confirm_funds", sendEmail: false, payload: financialActions.confirm_funds };
  for (const overrides of [
    { commandReadError: { code: "FETCH_ERROR", message: "Temporary read failure" } },
    { commands: [{ request_id: REQUEST, command_key: COMMAND, actor_id: CUSTOMER, accounting_date_jalali: "invalid" }] },
  ]) {
    const { actions, state } = harness({ admin: true, ...overrides });
    assert.ok((await actions.mutateAdminRequest(input)).error);
    assert.equal(state.calls.filter(call => call.table === "exchange_request_commands").length, 1);
    assert.equal(state.calls.some(call => call.rpc), false);
  }
});

test("authentication, financial action permissions and payload validation precede the accounting date lookup", async () => {
  const input = { requestId: REQUEST, commandKey: COMMAND, expectedVersion: 5, action: "confirm_funds", sendEmail: false, payload: financialActions.confirm_funds };
  const { actions, state } = harness();
  assert.ok((await actions.mutateAdminRequest(input)).error);
  assert.ok((await actions.mutateMyRequest({ ...input, sendEmail: undefined })).error);
  state.admin = true;
  assert.ok((await actions.mutateAdminRequest({ ...input, payload: { ...input.payload, received_amount: -1 } })).error);
  assert.equal(state.calls.some(call => call.table === "exchange_request_commands" || call.rpc), false);
});
