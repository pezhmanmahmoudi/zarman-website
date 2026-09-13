/* eslint-disable @typescript-eslint/no-require-imports */
// Exercise server actions with isolated auth/database/storage doubles. No env
// files, real credentials, network access, payments or notifications are used.
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

function compile(path, imports = {}, env = {}) {
  const code = ts.transpileModule(readFileSync(resolve(__dirname, "..", path), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const compiledModule = { exports: {} };
  const context = vm.createContext({ module: compiledModule, exports: compiledModule.exports, Buffer, URL, FormData, File, Uint8Array, Intl, Date, console,
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
  management_emails: ["operations@example.invalid"], priority_terms: "Synthetic terms", priority_terms_fa: "شرایط آزمایشی" };

function harness(overrides = {}) {
  const state = { user: { id: CUSTOMER, email: "customer@example.invalid", email_confirmed_at: "2026-09-01T00:00:00Z" },
    kyc: "approved", admin: false, recipientOwner: CUSTOMER, requestOwner: CUSTOMER, direction: "irt", settings,
    calls: [], inserts: [], storageCalls: [], ...overrides };
  const db = {
    from(table) {
      const query = { table, filters: {}, operation: "read", value: undefined };
      const builder = {};
      for (const name of ["select", "order", "limit", "gte", "not", "in", "is"]) builder[name] = () => builder;
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
          case "exchange_requests": return query.filters.user_id && query.filters.user_id !== state.requestOwner ? { data: null, error: {} } : { data: { id: REQUEST, user_id: state.requestOwner, status: "awaiting_funds" }, error: null };
          case "exchange_request_receipts": return state.receipt ? { data: state.receipt, error: null } : { data: null, count: 0, error: null };
          default: return { data: [], error: null };
        }
      };
      builder.single = builder.maybeSingle = async () => finish();
      builder.then = (onSuccess, onFailure) => Promise.resolve(finish()).then(onSuccess, onFailure);
      return builder;
    },
    rpc: async (name, args) => { state.calls.push({ rpc: name, args }); return { data: { id: REQUEST }, error: null }; },
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
  }, state.env);
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
  const base = { requestId: REQUEST, commandKey: COMMAND, expectedVersion: 1 };
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
  const response = await actions.mutateAdminRequest({ requestId: REQUEST, commandKey: COMMAND, expectedVersion: 1, action: "complete", payload: {
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
  assert.ok((await actions.getRequestReceiptUrl(COMMAND)).error);
  assert.equal(state.storageCalls.length, 0);
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
