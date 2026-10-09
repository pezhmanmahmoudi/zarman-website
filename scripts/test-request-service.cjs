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
  const context = vm.createContext({ module: compiledModule, exports: compiledModule.exports, Buffer, URL, URLSearchParams, FormData, File, Uint8Array, Intl, Date, console, ...globals,
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
const institutions = compile("lib/payments/institutions.ts");
const accountAccess = compile("lib/payments/account-access.ts", { "server-only": {} }, { PAYMENT_ACCESS_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64") });
const journey = compile("lib/requests/journey.ts");
const activity = compile("lib/dashboard/activity.ts", { "@/lib/requests/journey": journey });
const paging = compile("lib/dashboard/paging.ts");
const conflicts = compile("lib/requests/conflicts.ts");
test("payment account encryption authenticates owner and quote, preserves password, and fails closed", () => {
  const credentials = { username: "synthetic@example.invalid", password: "  synthetic-secret!  " };
  const encrypted = accountAccess.encryptPaymentAccountAccess(credentials, "owner", "quote");
  assert.equal(encrypted.includes(credentials.password), false);
  assert.equal(encrypted.includes(credentials.username), false);
  assert.notEqual(encrypted, accountAccess.encryptPaymentAccountAccess(credentials, "owner", "quote"));
  assert.equal(accountAccess.decryptPaymentAccountAccess(encrypted, "owner", "quote").password, credentials.password);
  assert.throws(() => accountAccess.decryptPaymentAccountAccess(encrypted, "other", "quote"));
  assert.throws(() => accountAccess.decryptPaymentAccountAccess(encrypted, "owner", "other-quote"));
  assert.throws(() => accountAccess.decryptPaymentAccountAccess(encrypted.slice(0, -8) + "AAAAAAAA", "owner", "quote"));
  assert.throws(() => accountAccess.validatePaymentAccountAccess({ username: "one", password: "" }));
  assert.throws(() => accountAccess.validatePaymentAccountAccess({ username: "", password: "one" }));
  assert.throws(() => accountAccess.validatePaymentAccountAccess({ username: "one", password: "x".repeat(1025) }));
  assert.equal(accountAccess.validatePaymentAccountAccess({ username: "", password: "" }), undefined);
  const unconfigured = compile("lib/payments/account-access.ts", { "server-only": {} });
  assert.throws(() => unconfigured.encryptPaymentAccountAccess(credentials, "owner", "quote"), /not configured/);
});
test("Other company quotes validate custom names without adding a reporting beneficiary", async () => {
  const h = harness();
  const args = { ...input, recipientId: "__edu_exam__", institutionId: "other", institutionName: "  Example Exam Ltd  ", paymentLink: "https://example.invalid/pay" };
  const result = await h.actions.createRequestQuote(args);
  assert.equal(result.error, undefined);
  assert.equal(result.data.snapshot.institution_name, "Example Exam Ltd");
  assert.equal(result.data.snapshot.recipient_snapshot.institution_id, "other");
  assert.equal(result.data.snapshot.invoice_reference, null);
  assert.equal(result.data.snapshot.recipient_snapshot.invoice_reference, null);
  assert.ok((await h.actions.createRequestQuote({ ...args, institutionName: " " })).error);
  assert.ok((await h.actions.createRequestQuote({ ...args, institutionId: "unrecognised" })).error);
});
test("account submission sends only encrypted data to the atomic RPC", async () => {
  const h = harness();
  const account = { username: "synthetic-user", password: "synthetic-secret" };
  assert.equal((await h.actions.submitExchangeRequest({ quoteId: COMMAND, commandKey: REQUEST, paymentAccount: account })).error, undefined);
  const call = h.state.calls.find(item => item.rpc);
  assert.equal(call.rpc, "submit_exchange_request_with_payment_access");
  assert.equal(JSON.stringify(call).includes(account.password), false);
  assert.equal(JSON.stringify(call).includes(account.username), false);
  assert.equal(accountAccess.decryptPaymentAccountAccess(call.args.p_encrypted_account, CUSTOMER, COMMAND).username, account.username);
  const bad = harness();
  assert.ok((await bad.actions.submitExchangeRequest({ quoteId: COMMAND, commandKey: REQUEST, paymentAccount: { username: "only", password: "" } })).error);
  assert.equal(bad.state.calls.length, 0);
});
test("payment account reveal requires admin and confirmed customer funding", async () => {
  const customer = harness();
  assert.ok((await customer.actions.getAdminPaymentAccount(REQUEST)).error);
  assert.equal(customer.state.calls.length, 0);
  for (const funding_status of ["unpaid", "partial", "refund_pending", "refunded"]) {
    const h = harness({ admin: true, request: { funding_status } });
    assert.ok((await h.actions.getAdminPaymentAccount(REQUEST)).error);
    assert.equal(h.state.calls.some(call => call.rpc), false);
  }
  const account = { username: "synthetic-user", password: "synthetic-secret" };
  const h = harness({ admin: true, request: { funding_status: "confirmed" }, rpc: name => ({ data: name === "read_funded_request_payment_access" ? [{ user_id: CUSTOMER, quote_id: COMMAND, encrypted_account: accountAccess.encryptPaymentAccountAccess(account, CUSTOMER, COMMAND) }] : null, error: null }) });
  const result = await h.actions.getAdminPaymentAccount(REQUEST);
  assert.equal(result.data.password, account.password);
});
const pricing = compile("lib/pricing.ts");
const quoteMoney = compile("lib/requests/quote-money.ts", { "@/lib/pricing": pricing });
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
      for (const name of ["gte", "not", "in", "is"]) builder[name] = () => builder;
      builder.limit = limit => { query.limit = limit; return builder; };
      builder.select = columns => { query.columns = columns; return builder; };
      builder.order = (column, options) => { query.order = { column, ...options }; return builder; };
      builder.eq = (field, value) => { query.filters[field] = value; return builder; };
      builder.insert = value => { query.operation = "insert"; query.value = value; return builder; };
      builder.update = value => { query.operation = "update"; query.value = value; return builder; };
      const finish = () => {
        state.calls.push({ ...query });
        if (query.operation === "update") return { data: null, error: null };
        if (query.operation === "insert") {
          state.inserts.push(query);
          return { data: { id: COMMAND, ...query.value, created_at: new Date().toISOString() }, error: null };
        }
        switch (table) {
          case "exchange_request_settings": return { data: { version: 1, settings: state.settings }, error: null };
          case "profiles": return { data: { id: CUSTOMER, first_name: "Test", last_name: "Customer", kyc_status: state.kyc }, error: null };
          case "rates_history": return { data: { id: 1, buy_aud: 50000, sell_aud: 52000, market_active: state.market !== false, ...state.rate }, error: null };
          case "transactions": return { data: state.volume || [], error: null };
          case "promo_codes": return { data: state.promo || null, error: null };
          case "recipients": return query.filters.user_id !== state.recipientOwner ? { data: null, error: { code: "PGRST116" } } : {
            data: { id: RECIPIENT, user_id: state.recipientOwner, direction: state.direction, full_name: "Test Recipient", bank_type: "other", shaba_number: "IR" + "1".repeat(24), account_name: "Test Recipient", bsb: "062000", account_number: "12345678" }, error: null };
          case "exchange_request_quotes": return { data: [], count: 0, error: null };
          case "exchange_request_commands": {
            if (state.commandReadError) return { data: null, error: state.commandReadError };
            const row = (state.commands || []).find(command => Object.entries(query.filters).every(([key, value]) => command[key] === value));
            return { data: row ? { accounting_date_jalali: row.accounting_date_jalali } : null, error: null };
          }
          case "exchange_request_current_payments": {
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
          case "exchange_request_notification_deliveries": return { data: state.deliveries || [], error: state.deliveryReadError || null };
          default: return { data: [], error: null };
        }
      };
      const execute = async () => {
        const response = finish();
        await state.readGate?.(query);
        return response;
      };
      builder.single = builder.maybeSingle = async () => { query.single = true; return execute(); };
      builder.then = (onSuccess, onFailure) => execute().then(onSuccess, onFailure);
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
    "@/lib/requests/quote-money": quoteMoney,
    "@/lib/notifications/customer-telegram": { customerTelegramConfig: () => ({ enabled: false }), dispatchCustomerTelegramSafely: async () => {} },
    "@/lib/requests/validation": validation, "@/lib/requests/receipt-upload": upload, "@/lib/pricing": pricing,
    "@/lib/requests/notification-config": notificationConfig,
    "@/lib/requests/conflicts": conflicts,
    "@/lib/requests/notifications": {
      notificationRuntimeSettings: () => ({ apiKey: "test-key", from: "Zarman <sender@example.invalid>", siteUrl: "https://example.invalid" }),
      createNotificationDatabase: () => ({ notification: true }),
      createRequestEmailSender: apiKey => ({ apiKey }),
      notificationWorkerFailureDiagnostic: () => ({ event: "request_notification_worker_unavailable", stage: "unknown" }),
      sendRequestNotifications: async options => {
        state.emailSends = (state.emailSends || []).concat([options]);
        if (state.mailGate) await state.mailGate;
        if (state.mailError) throw state.mailError;
        return { claimed: 2, accepted: 2, retrying: 0, failed: 0, reconciliation: 0 };
      },
    },
    "@/lib/payments/institutions": institutions,
    "@/lib/payments/account-access": accountAccess,
    "@/lib/dashboard/activity": activity,
    "@/lib/dashboard/paging": paging,
    "next/server": { after: callback => { state.after = (state.after || []).concat(callback); } },
    "@/lib/notifications/telegram": { newRequestTelegramMessage: request => `New request ${request.reference_code || ""}`, sendTelegramAdminMessage: async (...args) => { state.telegram = (state.telegram || []).concat([args]); } },
  }, state.env, state.now ? { Date: class extends Date {
    constructor(...args) { super(...(args.length ? args : [state.now])); }
    static now() { return new Date(state.now).getTime(); }
  } } : {});
  return { actions, state };
}

test("quotes default to one hour and continue to respect administrator validity settings", async () => {
  assert.equal(validation.DEFAULT_REQUEST_SETTINGS.quote_minutes, 60);
  const now = "2026-09-30T02:00:00.000Z";
  for (const minutes of [60, 30]) {
    const h = harness({ now, settings: { ...settings, quote_minutes: minutes } });
    const result = await h.actions.createRequestQuote(input);
    assert.equal(result.error, undefined);
    assert.equal(Date.parse(result.data.expires_at) - Date.parse(now), minutes * 60_000);
    assert.equal(result.data.snapshot.policy_snapshot.quote_minutes, minutes);
  }
});

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

test("exam quotes resolve the reporting company on the server and never persist account passwords", async () => {
  for (const institution of institutions.paymentInstitutions) {
    const { actions, state } = harness({ direction: "aud" });
    const response = await actions.createRequestQuote({ ...input, txType: "buy_aud", recipientId: "__edu_exam__", institutionId: institution.id,
      institutionName: "Untrusted browser company", invoiceReference: "CANDIDATE-TEST", paymentLink: "https://example.com/pay?token=temporary", password: "must-not-be-stored", username: "must-not-be-stored" });
    assert.equal(response.error, undefined);
    assert.equal(response.data.snapshot.institution_name, institution.companyName);
    assert.equal(response.data.snapshot.recipient_snapshot.institution_id, institution.id);
    assert.doesNotMatch(JSON.stringify(state.inserts), /must-not-be-stored|Untrusted browser company/);
  }
  for (const changed of [{ institutionId: "unknown" }, { paymentLink: "https://example.com/?password=secret" }, { paymentLink: "https://user:secret@example.com/pay" }]) {
    const { actions, state } = harness();
    const response = await actions.createRequestQuote({ ...input, txType: "buy_aud", recipientId: "__edu_exam__", institutionId: "amc", institutionName: "AMC", invoiceReference: "TEST", paymentLink: "https://example.com/pay", ...changed });
    assert.ok(response.error); assert.equal(state.inserts.length, 0);
  }
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
  const reads = state.calls.filter(call => call.table === "exchange_request_current_payments");
  assert.equal(reads.length, 1);
  assert.equal(reads[0].columns, "id,request_id,payment_reference,amount,currency,account_id,created_at,original_amount,corrected_at,excluded");
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
  assert.equal(state.calls.some(call => call.table === "exchange_request_current_payments"), false);
  assert.ok((await actions.getAdminRequest(REQUEST)).error);
  state.requestOwner = OTHER;
  assert.ok((await actions.getMyRequest(REQUEST)).error);
  state.user = null;
  assert.ok((await actions.getMyRequest(REQUEST)).error);
  assert.equal(state.calls.some(call => call.table === "exchange_request_current_payments"), false);
});

test("admin payment read failures do not masquerade as an empty deposit history", async () => {
  const { actions, state } = harness({ admin: true, paymentReadError: { code: "FETCH_ERROR", message: "Temporary read failure" } });
  const response = await actions.getAdminRequest(REQUEST);
  assert.ok(response.error);
  assert.equal(response.data, undefined);
  assert.equal(state.calls.filter(call => call.table === "exchange_request_current_payments").length, 1);
  assert.equal(state.calls.some(call => call.rpc || call.operation === "insert"), false);
});

test("admin detail starts independent delivery and deposit reads while event history is still loading", async () => {
  let releaseHistory;
  const historyGate = new Promise(resolve => { releaseHistory = resolve; });
  const { actions, state } = harness({ admin: true, readGate: query => query.table === "exchange_request_events" ? historyGate : undefined });
  const response = actions.getAdminRequest(REQUEST);
  try {
    await new Promise(setImmediate);
    for (const table of ["exchange_request_events", "exchange_request_receipts", "exchange_request_messages", "exchange_request_notification_deliveries", "exchange_request_current_payments"]) {
      assert.ok(state.calls.some(call => call.table === table), `${table} should not wait for event history`);
    }
    assert.equal(state.calls[0].table, "exchange_requests", "authorize the request before related reads");
  } finally { releaseHistory(); }
  assert.equal((await response).error, undefined);
});

test("delivery progress reads are admin-only, bounded and do not reload unrelated request data", async () => {
  const customer = harness();
  assert.ok((await customer.actions.getAdminRequestDeliveries(REQUEST)).error);
  assert.equal(customer.state.calls.length, 0);
  const admin = harness({ admin: true, deliveries: [{ id: COMMAND, request_id: REQUEST, status: "pending" }] });
  assert.ok((await admin.actions.getAdminRequestDeliveries("not-a-uuid")).error);
  assert.equal(admin.state.calls.length, 0);
  const response = await admin.actions.getAdminRequestDeliveries(REQUEST);
  assert.equal(response.error, undefined);
  assert.equal(response.data[0].status, "pending");
  assert.equal(admin.state.calls.length, 1);
  const read = admin.state.calls[0];
  assert.equal(read.table, "exchange_request_notification_deliveries");
  assert.deepEqual(read.filters, { request_id: REQUEST });
  assert.equal(read.limit, 100);
  assert.equal(read.columns, "id,event_id,request_id,audience,recipient_email,locale,status,attempts,last_error,created_at,first_attempt_at,lease_expires_at,provider_id");
  admin.state.deliveryReadError = { code: "FETCH_ERROR", message: "Temporary read failure" };
  assert.ok((await admin.actions.getAdminRequestDeliveries(REQUEST)).error);
});

test("file validation rejects HTML, mismatched MIME and oversized data; sanitises supplied filenames", () => {
  const pdf = Buffer.from("%PDF-1.7\nfixture");
  assert.equal(upload.inspectReceiptUpload(pdf, "../../receipt.pdf", "application/pdf").filename.includes("/"), false);
  assert.throws(() => upload.inspectReceiptUpload(Buffer.from("<svg onload=alert(1)>"), "receipt.svg", "image/svg+xml"));
  assert.throws(() => upload.inspectReceiptUpload(pdf, "receipt.png", "image/png"));
  assert.throws(() => upload.inspectReceiptUpload(new Uint8Array(upload.MAX_REQUEST_RECEIPT_BYTES + 1), "large.pdf", "application/pdf"));
});

test("service enablement requires bank instructions without management recipients; clearance buffer cannot undercut 24h", () => {
  assert.equal(validation.settingsInputError(settings), null);
  assert.equal(validation.settingsInputError({ ...settings, management_emails: [] }), null);
  assert.ok(validation.settingsInputError({ ...settings, australian_clearance_minutes: 60 }));
  assert.ok(validation.settingsInputError({ ...settings, priority_fee_aud: NaN }));
  assert.ok(validation.settingsInputError({ ...settings, priority_minutes: settings.standard_minutes }));
  assert.equal(validation.settingsInputError({ ...settings, iran_banking_notice: "", iran_banking_notice_fa: "" }), null);
  assert.equal(validation.settingsInputError({ ...settings, iran_banking_notice_fa: "" }), null);
  assert.equal(validation.settingsInputError({ ...settings, iran_banking_notice: "" }), null);
  assert.ok(validation.settingsInputError({ ...settings, iran_banking_notice: "x".repeat(2001) }));
  assert.ok(validation.bankDetailsError({ account_name: "TEST\nONLY" }, "aud"));
  assert.ok(validation.bankDetailsError({ account_name: " ".repeat(201) }, "aud"));
});

test("activation rejects unusable mail configuration before writing settings", async () => {
  const env = { RESEND_API_KEY: "test-key", REQUEST_NOTIFICATIONS_FROM: "Zarman <sender@example.invalid>", REQUEST_SITE_URL: "https://example.invalid", RESEND_WEBHOOK_SECRET: "whsec_test" };
  for (const change of [{ REQUEST_NOTIFICATIONS_FROM: undefined }, { REQUEST_SITE_URL: "https://example.invalid/path" }, { RESEND_WEBHOOK_SECRET: "" }]) {
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

test("only approved admin emails run after the response; mail problems never undo the action", async () => {
  const { actions, state } = harness({ admin: true });
  const base = { requestId: REQUEST, commandKey: COMMAND, expectedVersion: 1, action: "await_funds" };
  assert.equal((await actions.mutateAdminRequest({ ...base, sendEmail: false })).error, undefined);
  assert.equal(state.emailSends, undefined);
  await Promise.all((state.after || []).splice(0).map(callback => callback()));
  assert.equal((await actions.mutateAdminRequest({ ...base, sendEmail: true })).error, undefined);
  assert.equal(state.emailSends, undefined);
  assert.ok(state.after.length >= 1);
  await Promise.all(state.after.splice(0).map(callback => callback()));
  assert.equal(state.emailSends.length, 1);
  assert.equal(state.emailSends[0].requestId, REQUEST);
  assert.deepEqual(state.emailSends[0].send, { apiKey: "test-key" });
  const message = { requestId: REQUEST, commandKey: COMMAND, expectedVersion: 1, message: "Your transfer is complete." };
  assert.equal((await actions.sendAdminRequestMessage({ ...message, sendEmail: false })).error, undefined);
  assert.equal(state.emailSends.length, 1);
  await Promise.all(state.after.splice(0).map(callback => callback()));
  assert.equal(state.after.length, 0);
  assert.equal((await actions.sendAdminRequestMessage({ ...message, sendEmail: true })).error, undefined);
  assert.equal(state.emailSends.length, 1);
  await Promise.all(state.after.splice(0).map(callback => callback()));
  assert.equal(state.emailSends.length, 2);
  state.mailError = new Error("PRIVATE provider detail");
  const logged = [], original = console.error;
  console.error = (...args) => logged.push(args);
  try {
    assert.equal((await actions.mutateAdminRequest({ ...base, sendEmail: true })).error, undefined);
    await Promise.all(state.after.splice(0).map(callback => callback()));
  }
  finally { console.error = original; }
  assert.doesNotMatch(JSON.stringify(logged), /PRIVATE/);
  state.mailError = undefined;
  state.admin = false;
  assert.equal((await actions.mutateMyRequest({ ...base, action: "cancel" })).error, undefined);
  assert.equal((await actions.sendMyRequestMessage(message)).error, undefined);
  await Promise.all((state.after || []).splice(0).map(callback => callback()));
  assert.equal(state.emailSends.length, 3);
  state.rpc = () => ({ data: null, error: { code: "P0001", message: "Rejected" } });
  state.admin = true;
  assert.ok((await actions.mutateAdminRequest({ ...base, sendEmail: true })).error);
  assert.equal(state.emailSends.length, 3);
  assert.equal(state.after.length, 0);
  assert.ok((await actions.sendAdminRequestMessage({ ...message, sendEmail: true })).error);
  assert.equal(state.after.length, 0);
});

test("status and message commits return while deferred email delivery remains unresolved", async () => {
  for (const action of ["mutateAdminRequest", "sendAdminRequestMessage"]) {
    let releaseMail;
    const mailGate = new Promise(resolve => { releaseMail = resolve; });
    const { actions, state } = harness({ admin: true, mailGate });
    const args = { requestId: REQUEST, commandKey: COMMAND, expectedVersion: 1, sendEmail: true,
      ...(action === "mutateAdminRequest" ? { action: "await_funds" } : { message: "Your transfer is being reviewed." }) };
    let background;
    try {
      const response = await Promise.race([actions[action](args), new Promise(resolve => setImmediate(() => resolve("blocked-on-mail")))]);
      assert.notEqual(response, "blocked-on-mail", `${action} must return the committed result before mail completes`);
      assert.equal(response.error, undefined);
      assert.equal(state.emailSends, undefined);
      assert.ok(state.after.length >= 1);
      let finished = false;
      background = Promise.all(state.after.splice(0).map(callback => callback())).then(() => { finished = true; });
      await new Promise(setImmediate);
      assert.equal(state.emailSends.length, 1);
      assert.equal(finished, false, "the provider is still pending after the action has returned");
    } finally { releaseMail(); if (background) await background; }
  }
});

test("conflicts terminate one RPC attempt and return a non-retryable reload result", async () => {
  const errors = [
    { code: "40001", message: "serialization failure" },
    { code: "PT409", message: "version mismatch" },
    { code: "P0001", message: "REQUEST_CONFLICT: Reload request" },
    { message: "REQUEST_CONFLICT: Reload request" },
    new Error("REQUEST_CONFLICT: Reload request"),
    Object.assign(new Error("version mismatch"), { code: "40001" }),
  ];
  for (const error of errors) for (const thrown of [false, true]) for (const admin of [false, true]) {
    const { actions, state } = harness({ admin, rpc: () => {
      if (thrown) throw error;
      return { data: null, error };
    } });
    const result = await (admin ? actions.mutateAdminRequest : actions.mutateMyRequest)({
      requestId: REQUEST, commandKey: COMMAND, expectedVersion: 4,
      action: admin ? "await_funds" : "cancel", ...(admin ? { sendEmail: true } : {}),
      payload: { message: "Cancel this transfer" },
    });
    assert.equal(result.error, conflicts.REQUEST_CONFLICT_MESSAGE);
    assert.equal(result.code, "REQUEST_CONFLICT");
    assert.equal(result.retryable, false);
    assert.equal(state.calls.filter(call => call.rpc).length, 1);
    assert.equal(state.after, undefined, "conflicts must not enqueue notification work");
  }
  for (const error of [null, {}, "Connection lost", { code: "23505" }, new Error("Connection lost")]) {
    assert.equal(conflicts.isRequestConflict(error), false);
  }
});

test("the installed Supabase client sends a single HTTP request on a conflict", async () => {
  const { createClient } = require("@supabase/supabase-js");
  for (const code of ["40001", "PT409"]) {
    let sends = 0;
    const db = createClient("https://fixture.invalid", "test-only", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async () => {
        sends++;
        return new Response(JSON.stringify({ code, message: "REQUEST_CONFLICT: Reload request" }), {
          status: code === "PT409" ? 409 : 500, headers: { "Content-Type": "application/json" },
        });
      } },
    });
    const result = await db.rpc("transition_exchange_request", { p_expected_version: 1 });
    assert.equal(result.error.code, code);
    assert.equal(sends, 1);
  }
});

test("opening the admin queue runs the deadline sweep without a scheduler, and a sweep failure never hides the list", async () => {
  const { actions, state } = harness({ admin: true });
  assert.equal((await actions.listAdminRequests()).error, undefined);
  assert.ok(state.calls.some(call => call.rpc === "sweep_exchange_request_deadlines"));
  state.rpc = () => ({ data: null, error: { code: "PGRST202" } });
  const original = console.error;
  console.error = () => {};
  try { assert.equal((await actions.listAdminRequests()).error, undefined); }
  finally { console.error = original; }
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
  assert.equal((await actions.mutateAdminRequest({ ...input, payload: { ...input.payload, settlement_reference: "" } })).error, undefined);
  assert.equal(state.calls.filter(call => call.rpc).at(-1).args.p_payload.settlement_reference, `AUTO-${COMMAND.slice(0, 13).toUpperCase()}`);
  assert.ok((await actions.mutateMyRequest({ ...input, sendEmail: undefined })).error);
});

test("admin confirm_funds sends zero and nonzero accounting terms in one atomic command", async () => {
  const quote = { applied_rate: 50000, base_fee_aud: 10 };
  const { actions, state } = harness({ admin: true, rpcRequest: { transaction_id: ACCOUNT, quote } });
  const base = { requestId: REQUEST, commandKey: COMMAND, expectedVersion: 2, action: "confirm_funds", sendEmail: false,
    payload: { received_amount: 1000, received_currency: "AUD", receiver_account_id: ACCOUNT, accounting_rate: 50000, accounting_fee_aud: 10 } };
  assert.equal((await actions.mutateAdminRequest(base)).error, undefined);
  const payload = state.calls.filter(call => call.rpc).at(-1).args.p_payload;
  assert.equal(payload.payment_reference, `AUTO-${COMMAND.slice(0, 13).toUpperCase()}`);
  assert.equal(state.calls.filter(call => call.rpc).at(-1).rpc, "confirm_exchange_request_funds");
  assert.equal(payload.accounting_rate, 50000);
  assert.equal(payload.accounting_fee_aud, 10);
  assert.equal(state.calls.some(call => call.operation === "update"), false);
  assert.equal((await actions.mutateAdminRequest({ ...base, payload: { ...base.payload, accounting_rate: 51000, accounting_fee_aud: 0 } })).error, undefined);
  const changed = state.calls.filter(call => call.rpc).at(-1);
  assert.equal(changed.rpc, "confirm_exchange_request_funds");
  assert.equal(changed.args.p_payload.accounting_rate, 51000);
  assert.equal(changed.args.p_payload.accounting_fee_aud, 0);
  assert.equal(state.calls.some(call => call.operation === "update"), false);
  assert.ok((await actions.mutateAdminRequest({ ...base, payload: { ...base.payload, accounting_rate: -1 } })).error);
});

test("a missing atomic funding migration cannot fall back to recording funds without the fee", async () => {
  const { actions, state } = harness({ admin: true, rpc: () => ({ data: null, error: { code: "PGRST202" } }) });
  const result = await actions.mutateAdminRequest({ requestId: REQUEST, commandKey: COMMAND, expectedVersion: 2,
    action: "confirm_funds", sendEmail: true, payload: { received_amount: 1000, received_currency: "AUD", receiver_account_id: ACCOUNT, accounting_fee_aud: 0 } });
  assert.match(result.error, /Funds were not recorded by this attempt/);
  assert.match(result.error, /20261009_52_atomic_request_accounting_terms/);
  assert.deepEqual(state.calls.filter(call => call.rpc).map(call => call.rpc), ["confirm_exchange_request_funds"]);
  assert.equal(state.calls.some(call => call.operation === "update"), false);
  assert.equal(state.emailSends, undefined);
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
      assert.equal(name, action === "confirm_funds" ? "confirm_exchange_request_funds" : "transition_exchange_request");
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


test("manual email retry authenticates, isolates one delivery and never replays financial actions", async () => {
  const input = { requestId: REQUEST, deliveryId: COMMAND };
  const denied = harness();
  assert.ok((await denied.actions.retryAdminRequestEmail(input)).error);
  assert.equal(denied.state.calls.length, 0);
  const invalid = harness({ admin: true });
  assert.ok((await invalid.actions.retryAdminRequestEmail({ ...input, deliveryId: "invalid" })).error);
  assert.equal(invalid.state.calls.length, 0);
  const h = harness({ admin: true, rpc: () => ({ data: { id: COMMAND, status: "pending", last_error: null, first_attempt_at: null, lease_expires_at: null, rendered_payload: { private: "never return email body" } }, error: null }) });
  const response = await h.actions.retryAdminRequestEmail(input);
  assert.equal(response.error, undefined);
  assert.equal(response.data.rendered_payload, undefined);
  assert.equal(h.state.calls.length, 1);
  assert.equal(h.state.calls[0].rpc, "retry_request_notification");
  assert.equal(h.state.calls[0].args.p_delivery_id, COMMAND);
  assert.equal(h.state.after.length, 1);
  assert.equal(h.state.emailSends, undefined);
  await h.state.after[0]();
  assert.equal(h.state.emailSends[0].deliveryId, COMMAND);
  assert.equal(h.state.emailSends[0].requestId, REQUEST);
});

test("manual retry never sends when the database requires reconciliation or rejects the retry", async () => {
  for (const rpc of [
    () => ({ data: { id: COMMAND, status: "reconciliation_required" }, error: null }),
    () => ({ data: null, error: { code: "22023", message: "Email cannot be retried." } }),
  ]) {
    const h = harness({ admin: true, rpc });
    await h.actions.retryAdminRequestEmail({ requestId: REQUEST, deliveryId: COMMAND });
    assert.equal(h.state.after, undefined);
    assert.equal(h.state.emailSends, undefined);
  }
});

test("retired management email settings are discarded on read and write", async () => {
  const h = harness({ admin: true, rpc: (name, args) => ({ data: { version: 2, settings: args.p_settings }, error: null }) });
  const read = await h.actions.getRequestSettings();
  assert.equal(read.data.settings.management_emails, undefined);
  const saved = await h.actions.saveRequestSettings({ expectedVersion: 1, settings: { ...settings, enabled: false, priority_enabled: false } });
  assert.equal(saved.error, undefined);
  assert.equal(h.state.calls.find(call => call.rpc === "save_exchange_request_settings").args.p_settings.management_emails, undefined);
});

test("server quote preserves the original Toman budget at fresh rates, including loyalty and promo", async () => {
  const h = harness({ direction: "aud", rate: { buy_aud: 180000, sell_aud: 184000 }, volume: [{ amount_aud: 70000 }],
    promo: { code: "SAVE", active: true, discount_type: "fixed", discount_value: 400, max_uses: null, used_count: 0, expires_at: null } });
  const result = await h.actions.createRequestQuote({ ...input, txType: "buy_aud", rawAmount: 4777.59, amountCurrency: "IRT", amountValue: 870000000, promoCode: "save" });
  assert.equal(result.error, undefined);
  const q = result.data.snapshot;
  assert.equal(q.funding_total, 870000000); assert.equal(q.applied_rate, 182600); assert.equal(q.recipient_amount, 4764.51);
  assert.equal(q.loyalty_rate_discount, 1000); assert.equal(q.promo_rate_discount, 400);
  assert.equal(q.loyalty_discount, 4764510); assert.equal(q.discount_amount, 1905804); assert.equal(q.promo_code, "SAVE");
  assert.equal(q.locked_amount_value, 870000000); assert.equal(q.locked_amount_currency, "IRT");
  const tooLarge = await h.actions.createRequestQuote({ ...input, txType: "buy_aud", rawAmount: 1, amountCurrency: "IRT", amountValue: 184000 * (settings.max_amount_aud + 1) });
  assert.ok(tooLarge.error);
});
test("explicit amount precision and currency are validated before quoting", async () => {
  for (const patch of [{ amountCurrency: "IRT", amountValue: 1.5 }, { amountCurrency: "AUD", amountValue: 12.345 },
    { amountCurrency: "USD", amountValue: 100 }, { amountCurrency: "IRT" }, { amountValue: 100 }]) {
    const h = harness(); assert.ok((await h.actions.createRequestQuote({ ...input, ...patch })).error); assert.equal(h.state.inserts.length, 0);
  }
});
test("pricing correction requires admin and forwards the authenticated actor and atomic command", async () => {
  const payload = { requestId: REQUEST, commandKey: COMMAND, expectedVersion: 7, fundingTotal: 870000000, recipientAmount: 4777.59, reason: " Correction requested " };
  const customer = harness(); assert.ok((await customer.actions.updateAdminRequestPricing(payload)).error); assert.equal(customer.state.calls.length, 0);
  const h = harness({ admin: true }); assert.equal((await h.actions.updateAdminRequestPricing(payload)).error, undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(h.state.calls[0])), { rpc: "admin_update_request_pricing", args: { p_actor_id: CUSTOMER, p_request_id: REQUEST, p_expected_version: 7,
    p_command_key: COMMAND, p_funding_total: 870000000, p_recipient_amount: 4777.59, p_reason: "Correction requested" } });
  for (const patch of [{ fundingTotal: NaN }, { recipientAmount: 12.345 }, { reason: " " }, { expectedVersion: 0 }, { commandKey: "invalid" }]) assert.ok((await h.actions.updateAdminRequestPricing({ ...payload, ...patch })).error);
  assert.equal(h.state.calls.length, 1);
});
test("pricing acceptance uses the authenticated owner, masks bank details and rejects bad commands", async () => {
  const h = harness({ rpcRequest: { payment_approved_at: null, payment_details: { private: true }, payment_instructions: "Private bank" } });
  const payload = { requestId: REQUEST, commandKey: COMMAND, expectedVersion: 2 };
  const response = await h.actions.acceptMyRequestPricing(payload); assert.equal(response.error, undefined);
  assert.equal(h.state.calls[0].rpc, "accept_request_pricing"); assert.equal(h.state.calls[0].args.p_actor_id, CUSTOMER);
  assert.equal(response.data.payment_details, null); assert.equal(response.data.payment_instructions, null);
  assert.ok((await h.actions.acceptMyRequestPricing({ ...payload, expectedVersion: 0 })).error);
  assert.equal(h.state.calls.length, 1);
});

test("deposit correction: the action sends existing payment changes to one dedicated RPC", async () => {
  const { actions, state } = harness({ admin: true });
  const input = { requestId: REQUEST, commandKey: COMMAND, expectedVersion: 2, action: "correct_funds", sendEmail: false,
    payload: { message: "Duplicate entry replaces the first record", payment_corrections: [{ payment_id: ACCOUNT, amount: 0, forged: true }] } };
  assert.equal((await actions.mutateAdminRequest(input)).error, undefined);
  const calls = state.calls.filter(call => call.rpc);
  assert.equal(calls.length, 1); assert.equal(calls[0].rpc, "correct_exchange_request_funds");
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].args.p_payload.payment_corrections)), [{ payment_id: ACCOUNT, amount: 0 }]);
  assert.equal(calls[0].args.p_payload.payment_reference, undefined);
  assert.equal(calls[0].args.p_payload.received_amount, undefined);
  assert.equal(state.calls.some(call => ["insert", "update", "delete"].includes(call.operation)), false);
  assert.ok((await actions.mutateMyRequest({ ...input, sendEmail: undefined })).error);
  assert.ok((await actions.mutateAdminRequest({ ...input, payload: { ...input.payload, payment_corrections: [{ payment_id: ACCOUNT, amount: -1 }] } })).error);
  assert.ok((await actions.mutateAdminRequest({ ...input, payload: { ...input.payload, payment_corrections: [{ payment_id: ACCOUNT, amount: 0 }, { payment_id: ACCOUNT, amount: 1 }] } })).error);
});

test("final amounts: admin replacement uses one RPC and never submits another deposit", async () => {
  const { actions, state } = harness({ admin: true });
  const input = { requestId: REQUEST, commandKey: COMMAND, expectedVersion: 2, action: "finalize_funds", sendEmail: false,
    payload: { final_funding_total: 637000000, final_recipient_amount: 3500, receiver_account_id: ACCOUNT, accounting_fee_aud: 0, accounting_rate: 181740 } };
  assert.equal((await actions.mutateAdminRequest(input)).error, undefined);
  const calls = state.calls.filter(call => call.rpc);
  assert.equal(calls.length, 1); assert.equal(calls[0].rpc, "finalize_exchange_request_funds");
  assert.equal(calls[0].args.p_payload.final_funding_total, 637000000);
  assert.equal(calls[0].args.p_payload.final_recipient_amount, 3500);
  assert.equal(calls[0].args.p_payload.accounting_fee_aud, 0);
  assert.equal(calls[0].args.p_payload.received_amount, undefined);
  assert.equal(calls[0].args.p_payload.payment_reference, undefined);
  assert.ok((await actions.mutateMyRequest({ ...input, sendEmail: undefined })).error);
  assert.ok((await actions.mutateAdminRequest({ ...input, payload: { ...input.payload, final_funding_total: -1 } })).error);
});


test("final amounts: an incomplete schema returns a repair instruction without retrying or adding deposits", async () => {
  const { actions, state } = harness({ admin: true, rpc: async () => ({ data: null, error: { code: "42703", message: 'record r has no field original_quote' } }) });
  const result = await actions.mutateAdminRequest({ requestId: REQUEST, commandKey: COMMAND, expectedVersion: 2, action: "finalize_funds", sendEmail: false,
    payload: { final_funding_total: 769668900, final_recipient_amount: 4235, receiver_account_id: ACCOUNT, accounting_fee_aud: 0, accounting_rate: 181740 } });
  assert.match(result.error, /No changes were saved/); assert.match(result.error, /20261009_56/);
  assert.equal(state.calls.filter(call => call.rpc).length, 1); assert.equal(state.inserts.length, 0);
});
