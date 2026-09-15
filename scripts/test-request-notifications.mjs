// Offline only: real PostgreSQL functions in PGlite and mocked mail delivery.
// No env files, real accounts, database connections or email sends are used.
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import { PDFDocument } from "pdf-lib";

const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
function compile(file, dependencies = {}) {
  const source = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const compiledModule = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename: file })((id) => {
    if (id in dependencies) return dependencies[id];
    if (id.startsWith("node:") || ["pdf-lib", "@pdf-lib/fontkit", "resend"].includes(id)) return require(id);
    throw new Error(`Unexpected dependency ${id}`);
  }, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const receipts = compile("lib/requests/receipt.ts");
const configuration = compile("lib/requests/notification-config.ts");
const templates = compile("lib/requests/notification-template.ts", { "./receipt": receipts, "./notification-config": configuration });
const notifications = compile("lib/requests/notifications.ts", {
  "./receipt": receipts, "./notification-template": templates, "./notification-config": configuration,
  "@supabase/supabase-js": { createClient() { throw new Error("Live database connections forbidden in tests"); } },
});
const requestId = "10000000-0000-4000-8000-000000000001";
const transactionId = "20000000-0000-4000-8000-000000000001";
const deliveryId = "30000000-0000-4000-8000-000000000001";
const settings = { from: "Zarman <test@example.test>", siteUrl: "https://example.test" };
const completion = {
  version: 1, request_id: requestId, transaction_id: transactionId, reference_code: "ZE123456",
  completed_at: "2026-09-13T01:00:00.000Z", sender_name: "Test Sender", recipient_name: "علی رضایی",
  funding_currency: "AUD", funding_total: 1025, recipient_currency: "IRT", recipient_amount: 100000000,
  base_fee_aud: 0, priority_fee_aud: 25, priority_fee_amount: 25, priority_fee_status: "paid",
  applied_rate: 100000, service_tier: "priority",
};
function delivery(overrides = {}) {
  return { id: deliveryId, request_id: requestId, audience: "customer", recipient_email: "customer@example.test",
    locale: "en", reference: "ZE123456", workflow_status: "awaiting_funds", event_type: "await_funds",
    requested_tier: "priority", priority_fee_aud: 25, created_at: "2026-09-13T01:00:00Z",
    attempts: 1, first_attempt_at: null, rendered_payload: null, template_version: null,
    payload_snapshot: { payment_instructions: "Account: Zarman\nBSB: 000000\nNumber: 123456", funding_currency: "AUD", funding_total: 1025 },
    ...overrides };
}

test("funding emails include snapshotted instructions, reference, clearance and priority timing in both locales", () => {
  for (const locale of ["en", "fa"]) {
    const result = templates.renderRequestNotification(delivery({ locale }), settings);
    assert.match(result.text, /ZE123456/);
    assert.match(result.text, /BSB: 000000/);
    assert.match(result.text, /1,025\.00/);
    assert.match(result.text, locale === "fa" ? /فقط پس از تأیید دریافت وجه/ : /starts only after funds are confirmed received/);
    assert.match(result.text, locale === "fa" ? /۲۴|24/ : /24 hours/);
    assert.match(result.html, new RegExp(`/${locale}/dashboard/requests/${requestId}`));
  }
  assert.throws(() => templates.renderRequestNotification(delivery({ payload_snapshot: {} }), settings), /funding_instructions/);
  assert.throws(() => templates.renderRequestNotification(delivery({ recipient_email: "victim@example.test\r\nBcc: other@example.test" }), settings), /recipient_unavailable/);
  assert.throws(() => templates.validatedRequestSiteUrl("http://example.test"), /invalid_site_url/);
  assert.throws(() => templates.validatedRequestSiteUrl("https://attacker@example.test"), /invalid_site_url/);
});

test("receipt and status templates escape content and do not confuse upload evidence with cleared funds", () => {
  const receipt = templates.renderRequestNotification(delivery({ event_type: "complete", workflow_status: "completed", payload_snapshot: { receipt: { ...completion, sender_name: "<script>bad()</script>" } } }), settings);
  assert.match(receipt.text, /final PDF receipt is attached/);
  assert.match(receipt.text, /Additional priority fee: AUD 25.00/);
  assert.doesNotMatch(receipt.html, /<script>/);
  assert.match(receipt.html, /&lt;script&gt;/);
  assert.throws(() => templates.renderRequestNotification(delivery({ event_type: "complete", workflow_status: "completed" }), settings), /completion_receipt_unavailable/);
  const uploaded = templates.renderRequestNotification(delivery({ event_type: "receipt_uploaded" }), settings);
  assert.match(uploaded.subject, /Receipt submitted.*checking your payment/);
  assert.match(uploaded.text, /will confirm when funds have cleared/);
});

test("bank delay advice is conditional on the incoming currency and ends after funds confirmation", () => {
  for (const locale of ["en", "fa"]) {
    const aud = templates.renderRequestNotification(delivery({ locale }), settings);
    assert.match(aud.text, locale === "fa" ? /انتظار اجباری ۲۴ ساعته نداریم/ : /do not impose a 24-hour wait/);
    assert.doesNotMatch(aud.text, /700|۷۰۰/);
    const irt = templates.renderRequestNotification(delivery({ locale, payload_snapshot: {
      payment_instructions: "Test bank", funding_currency: "IRT", funding_total: 234675000,
    } }), settings);
    assert.doesNotMatch(irt.text, /24|۲۴|Satna|ساتنا/);
    assert.match(irt.text, locale === "fa" ? /پرداخت تومانی/ : /incoming Toman payment/);
    for (const event_type of ["ready", "resume_funded_request", "start_processing"]) {
      const ready = templates.renderRequestNotification(delivery({ event_type, workflow_status: "ready", locale }), settings);
      assert.doesNotMatch(ready.text, /24|۲۴|first-time/);
    }
  }
});

test("submission waits for approval and never releases bank details, even from a legacy snapshot", () => {
  for (const locale of ["en", "fa"]) {
    const message = templates.renderRequestNotification(delivery({ event_type: "submitted", workflow_status: "submitted", locale }), settings);
    assert.doesNotMatch(message.text, /BSB|Number: 123456|Account: Zarman|Description Code/mi);
    assert.match(message.text, locale === "fa" ? /منتظر تأیید درخواست/ : /Wait for approval/);
    assert.match(message.text, /13 Sept 2026/);
    assert.doesNotMatch(message.text, /[۰-۹]/);
    assert.equal(templates.renderRequestNotification(delivery({ event_type: "submitted", workflow_status: "submitted", locale, payload_snapshot: {} }), settings).to[0], "customer@example.test");
  }
});

test("new bank snapshots preserve copy values and Persian notes without English fallback prose", () => {
  const payload_snapshot = {
    payment_details: { account_name: "TEST ONLY", bsb: "000-000", account_number: "00123456" },
    funding_currency: "AUD", funding_total: 1025,
    payment_instructions: "English note only.", payment_instructions_fa: "فقط یادداشت فارسی.",
    iran_banking_notice: "English banking notice.", iran_banking_notice_fa: "یادداشت چرخه بانکی فارسی.",
  };
  const en = templates.renderRequestNotification(delivery({ payload_snapshot }), settings);
  const fa = templates.renderRequestNotification(delivery({ locale: "fa", payload_snapshot }), settings);
  for (const result of [en, fa]) {
    assert.match(result.text, /BSB: 000-000/);
    assert.match(result.text, /00123456/);
  }
  assert.match(en.text, /English note only/);
  assert.match(fa.text, /فقط یادداشت فارسی/);
  assert.match(fa.text, /یادداشت چرخه بانکی فارسی/);
  assert.doesNotMatch(fa.text, /English/);
  assert.match(fa.html, /lang="fa" dir="rtl"/);
  const noNote = templates.renderRequestNotification(delivery({ locale: "fa", payload_snapshot: { ...payload_snapshot, payment_instructions_fa: null, iran_banking_notice_fa: undefined } }), settings);
  assert.doesNotMatch(noNote.text, /English/);
  assert.match(noNote.text, /ساتنا و پایا/);
});

test("conversation emails have concise localized subjects, escaped messages and audience-specific reply links", () => {
  for (const locale of ["en", "fa"]) for (const audience of ["customer", "management"]) {
    const event_type = audience === "customer" ? "admin_message" : "customer_message";
    const result = templates.renderRequestNotification(delivery({ locale, audience, event_type,
      payload_snapshot: { public_message: "<b>Test reply</b>\nSecond line" } }), settings);
    assert.match(result.subject, locale === "fa" ? /پیام زرمان|پاسخ مشتری/ : /Message from Zarman|Customer reply/);
    assert.match(result.html, /&lt;b&gt;Test reply&lt;\/b&gt;/);
    assert.doesNotMatch(result.html, /<b>Test reply/);
    assert.match(result.text, /Test reply/);
    assert.doesNotMatch(result.text, /24 hours|additional fee|Bank clearance/);
    assert.match(result.html, new RegExp(audience === "management" ? `/admin/requests/${requestId}` : `/${locale}/dashboard/requests/${requestId}`));
  }
});

test("PDF keeps Persian names and pins metadata to settlement; repeated rendering is deterministic", async () => {
  const first = await receipts.renderRequestReceiptPdf(completion);
  const second = await receipts.renderRequestReceiptPdf(completion);
  assert.deepEqual(first, second);
  const pdf = await PDFDocument.load(first, { updateMetadata: false });
  assert.equal(pdf.getPageCount(), 1);
  assert.equal(pdf.getCreationDate().toISOString(), completion.completed_at);
  assert.equal(pdf.getModificationDate().toISOString(), completion.completed_at);
  assert.match(pdf.getTitle(), /ZE123456/);
  const long = await receipts.renderRequestReceiptPdf({ ...completion, recipient_name: "علی رضایی ".repeat(45) });
  assert.ok((await PDFDocument.load(long)).getPageCount() >= 1);
});

function workerDb(row, options = {}) {
  let claimed = false;
  const calls = [];
  return { calls, row, async rpc(name, args) {
    calls.push({ name, args });
    if (name === "sweep_exchange_request_deadlines") return { data: 0, error: null };
    if (name === "claim_request_notifications") { if (claimed) return { data: [], error: null }; claimed = true; return { data: [row], error: null }; }
    if (name === "prepare_request_notification") {
      row.rendered_payload ??= structuredClone(args.p_payload); row.template_version ??= args.p_template_version;
      row.first_attempt_at ??= "2026-09-13T01:00:00Z";
      return { data: structuredClone(row), error: null };
    }
    if (name === "finish_request_notification") return options.failFinish ? { error: "simulated connection loss", data: null } : { error: null, data: row };
    throw new Error(`Unexpected RPC ${name}`);
  } };
}
const now = () => Date.parse("2026-09-13T01:00:00Z");

test("only a transient deadline sweep retries once; lease and send mutations remain single-attempt", async () => {
  for (const status of [0, 502, 503, 504, "rejected"]) {
    let sweeps = 0, claims = 0;
    const db = { async rpc(name) {
      if (name === "sweep_exchange_request_deadlines") {
        if (++sweeps === 1) {
          if (status === "rejected") throw new Error("Synthetic transport loss");
          return { data: null, error: { code: "", message: "Synthetic gateway failure" }, status };
        }
        return { data: { updated: 0 }, error: null, status: 200 };
      }
      assert.equal(name, "claim_request_notifications"); claims++;
      return { data: [], error: null, status: 200 };
    } };
    const result = await notifications.runRequestNotificationWorker({ ...settings, db, now, send: async () => assert.fail("Queue is empty") });
    assert.equal(sweeps, 2); assert.equal(claims, 1); assert.equal(result.claimed, 0);
  }
  for (const [operation, status, code, expectedCalls] of [
    ["sweep_exchange_request_deadlines", 504, "", 2],
    ["sweep_exchange_request_deadlines", 403, "42501", 1],
    ["sweep_exchange_request_deadlines", 400, "PGRST202", 1],
    ["claim_request_notifications", 504, "", 1],
    ["prepare_request_notification", 503, "", 1],
    ["finish_request_notification", 502, "", 1],
  ]) {
    const base = workerDb(delivery()); let failures = 0, sends = 0;
    const db = { async rpc(name, args) {
      if (name === operation) { failures++; return { data: null, error: { code }, status }; }
      return base.rpc(name, args);
    } };
    await assert.rejects(notifications.runRequestNotificationWorker({ ...settings, db, now, send: async () => {
      sends++; return { data: { id: "synthetic-provider-id" }, error: null, headers: null };
    } }), /notification_rpc_failed/);
    assert.equal(failures, expectedCalls, operation);
    assert.equal(sends, operation === "finish_request_notification" ? 1 : 0);
  }
});

test("database transport preserves cancellation and limits each HTTP attempt without retrying fetch", async (t) => {
  let clientOptions, calls = 0, timeoutMs;
  const timeoutController = new AbortController();
  t.mock.method(AbortSignal, "timeout", (ms) => { timeoutMs = ms; return timeoutController.signal; });
  t.mock.method(globalThis, "fetch", async (_input, init) => {
    calls++;
    return { signal: init.signal, headers: init.headers };
  });
  const compiled = compile("lib/requests/notifications.ts", {
    "./receipt": receipts, "./notification-template": templates, "./notification-config": configuration,
    "@supabase/supabase-js": { createClient(_url, _key, options) { clientOptions = options; return {}; } },
  });
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://synthetic.example.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-only";
    compiled.createNotificationDatabase();
    const caller = new AbortController();
    const originalHeaders = new Headers({ authorization: "Bearer synthetic-token", apikey: "synthetic-key" });
    const response = await clientOptions.global.fetch("https://synthetic.example.test", { signal: caller.signal, headers: originalHeaders });
    assert.equal(timeoutMs, 8000); assert.equal(calls, 1); assert.equal(response.signal.aborted, false);
    assert.equal(response.headers.get("connection"), "close");
    assert.equal(response.headers.get("authorization"), "Bearer synthetic-token");
    assert.equal(response.headers.get("apikey"), "synthetic-key");
    assert.equal(originalHeaders.has("connection"), false);
    caller.abort(); assert.equal(response.signal.aborted, true);
    const timed = await clientOptions.global.fetch(new Request("https://synthetic.example.test", {
      headers: { authorization: "Bearer request-token", "x-request-header": "preserved" },
    }), { headers: { apikey: "init-key", "x-init-header": "preserved" } });
    assert.equal(timed.headers.get("connection"), "close");
    assert.equal(timed.headers.get("authorization"), "Bearer request-token");
    assert.equal(timed.headers.get("apikey"), "init-key");
    assert.equal(timed.headers.get("x-request-header"), "preserved");
    assert.equal(timed.headers.get("x-init-header"), "preserved");
    timeoutController.abort(); assert.equal(timed.signal.aborted, true); assert.equal(calls, 2);
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  }
});

test("worker freezes PDF before send and retries ambiguous acceptance with identical payload/key", async () => {
  const row = delivery({ event_type: "complete", workflow_status: "completed", payload_snapshot: { receipt: completion } });
  const db = workerDb(row);
  const sent = [];
  const result = await notifications.runRequestNotificationWorker({ ...settings, db, now, send: async (payload, key) => {
    assert.ok(row.rendered_payload, "persist before network I/O");
    sent.push({ payload: structuredClone(payload), key }); throw new Error("network reset after acceptance");
  } });
  assert.equal(result.retrying, 1);
  assert.equal(sent[0].key, `request-notification/${deliveryId}`);
  assert.match(Buffer.from(sent[0].payload.attachments[0].content, "base64").toString("ascii", 0, 8), /%PDF/);
  const retryDb = workerDb({ ...row, attempts: 2 });
  await notifications.runRequestNotificationWorker({ ...settings, from: "Changed <changed@example.test>", db: retryDb, now,
    send: async (payload, key) => { assert.deepEqual({ payload, key }, sent[0]); return { data: { id: "provider-id" }, error: null, headers: null }; } });
  assert.equal(retryDb.calls.find(call => call.name === "finish_request_notification").args.p_status, "provider_accepted");
});

test("stale ambiguity requires reconciliation; permanent errors fail; DB acknowledgement failure never sends twice", async () => {
  const db = workerDb(delivery({ first_attempt_at: "2026-09-12T00:00:00Z" }));
  let sends = 0;
  const stale = await notifications.runRequestNotificationWorker({ ...settings, db, now, send: async () => { sends++; throw new Error(); } });
  assert.equal(stale.reconciliation, 1); assert.equal(sends, 0);
  const permanent = await notifications.runRequestNotificationWorker({ ...settings, db: workerDb(delivery()), now, send: async () => ({ data: null, error: { name: "validation_error", statusCode: 422 }, headers: null }) });
  assert.equal(permanent.failed, 1);
  await assert.rejects(notifications.runRequestNotificationWorker({ ...settings, db: workerDb(delivery(), { failFinish: true }), now, send: async () => { sends++; return { data: { id: "accepted" }, error: null, headers: null }; } }), /notification_rpc_failed/);
  assert.equal(sends, 1);
  assert.equal(notifications.notificationRetryAt(1, now(), "120", 0), "2026-09-13T01:02:00.000Z");
  assert.equal(notifications.authorizedNotificationCron("Bearer short", "short"), false);
  assert.equal(notifications.authorizedNotificationCron(`Bearer ${"a".repeat(32)}`, "a".repeat(32)), true);
  assert.equal(notifications.authorizedNotificationCron(`Bearer ${"b".repeat(32)}`, "a".repeat(32)), false);
});

test("worker route logs only allowlisted diagnostics and never exposes RPC secrets", async (t) => {
  const secret = "whsec_TEST_ONLY_NEVER_LOG_recipient@example.test";
  const records = [];
  t.mock.method(console, "error", (...args) => records.push(args));
  let scenario;
  const route = compile("app/api/cron/request-notifications/route.ts", {
    "@/lib/requests/notifications": {
      ...notifications,
      authorizedNotificationCron: () => true,
      notificationRuntimeSettings: () => {
        if (scenario.configurationError) throw scenario.configurationError;
        return settings;
      },
      createNotificationDatabase: () => ({ async rpc(name) {
        if (name === scenario.operation) {
          if (scenario.thrown) throw scenario.thrown;
          return { data: null, error: scenario.error, status: scenario.status };
        }
        return { data: [], error: null, status: 200 };
      } }),
      createRequestEmailSender: () => async () => { assert.fail("Failed RPC must not send email"); },
    },
  });
  const cases = [
    { operation: "sweep_exchange_request_deadlines", error: { code: "PGRST202", message: secret, details: secret, hint: secret }, status: 404,
      expected: { stage: "database_rpc", operation: "sweep_exchange_request_deadlines", code: "PGRST202", status: 404 } },
    { operation: "claim_request_notifications", error: { code: secret, message: secret }, status: 700,
      expected: { stage: "database_rpc", operation: "claim_request_notifications", code: "unclassified", status: null } },
    { operation: "sweep_exchange_request_deadlines", error: { code: "", message: secret }, status: 504,
      expected: { stage: "database_rpc", operation: "sweep_exchange_request_deadlines", code: "unclassified", status: 504 } },
    { operation: "sweep_exchange_request_deadlines", thrown: new Error(secret, { cause: { secret } }),
      expected: { stage: "database_rpc", operation: "sweep_exchange_request_deadlines", code: "transport_error", status: null, category: "unclassified" } },
    { operation: "claim_request_notifications", thrown: new Error(secret, { cause: { code: "ENOTFOUND", message: secret } }),
      expected: { stage: "database_rpc", operation: "claim_request_notifications", code: "transport_error", status: null, category: "dns_error" } },
    { configurationError: new Error(`invalid_site_url:${secret}`), expected: { stage: "unknown" } },
    { configurationError: new Error("missing_site_url"), expected: { stage: "configuration", code: "missing_site_url" } },
  ];
  for (const [category, marker] of [
    ["timeout", "TimeoutError"], ["aborted", "AbortError"], ["socket_error", "UND_ERR_SOCKET"],
    ["dns_error", "EAI_AGAIN"], ["invalid_response", "SyntaxError"], ["unclassified", "unknown error"],
  ]) cases.push({ operation: "claim_request_notifications", error: { code: "", message: secret, details: `${marker}: ${secret}` }, status: 0,
    expected: { stage: "database_rpc", operation: "claim_request_notifications", code: "unclassified", status: 0, category } });
  for (scenario of cases) {
    records.length = 0;
    const response = await route.GET(new Request("https://example.test/api/cron/request-notifications"));
    const body = await response.text();
    assert.equal(response.status, 503);
    assert.deepEqual(JSON.parse(body), { error: "Notification worker unavailable; inspect the queue and configuration." });
    assert.deepEqual(records, [[{ event: "request_notification_worker_unavailable", ...scenario.expected }]]);
    assert.ok(!`${JSON.stringify(records)}${body}`.includes(secret));
  }
});

test("webhook verifies raw signed body and rejects replayed signatures over altered content", () => {
  const key = Buffer.from("synthetic test signing key only 12345");
  const secret = `whsec_${key.toString("base64")}`;
  const id = "test-event-1", timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({ type: "email.delivered", created_at: "2026-09-13T01:00:00Z", data: { email_id: "provider-id" } });
  const signature = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
  const headers = new Headers({ "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${signature}` });
  const event = notifications.verifyRequestEmailEvent(body, headers, secret);
  assert.equal(event.eventId, id); assert.equal(event.providerId, "provider-id");
  assert.match(event.payloadHash, /^[0-9a-f]{64}$/);
  assert.throws(() => notifications.verifyRequestEmailEvent(body.replace("delivered", "bounced"), headers, secret));
  assert.throws(() => notifications.verifyRequestEmailEvent(body, new Headers(), secret));
});

test("webhook reads exact UTF-8 bytes with a memory limit even without a valid length header", async () => {
  const body = JSON.stringify({ name: "علی" });
  assert.equal(await notifications.readRequestEmailWebhookBody(new Request("https://example.test", { method: "POST", body }), 1024), body);
  await assert.rejects(notifications.readRequestEmailWebhookBody(new Request("https://example.test", { method: "POST", body: "x".repeat(100), headers: { "content-length": "1" } }), 10), /too_large/);
  await assert.rejects(notifications.readRequestEmailWebhookBody(new Request("https://example.test", { method: "POST", body: "small", headers: { "content-length": "9999" } }), 10), /too_large/);
});

async function loadNotificationDatabase(db) {
  await db.exec(read("scripts/fixtures/customer-requests.sql"));
  for (const migration of [
    "20260802_09_enterprise_reporting.sql", "20260802_10_ledger_accounting_controls.sql",
    "20260802_13_standardize_trade_fee_accounting.sql", "20260911_18_customer_requests.sql",
    "20260911_19_request_notifications.sql", "20260913_23_request_funding_and_receipts.sql",
    "20260913_24_request_receipt_notifications.sql", "20260913_25_request_fee_accounting.sql",
    "20260913_26_request_fee_ledger_type.sql",
  ]) await db.exec(read(`supabase/migrations/${migration}`));
}

test("a committed sweep with a lost response retries without duplicate tasks, refunds or notification events", async () => {
  const db = new PGlite();
  try {
    await loadNotificationDatabase(db);
    const user = randomUUID();
    await db.query("insert into auth.users(id,email) values($1,'customer@example.test')", [user]);
    await db.query("insert into profiles(id) values($1)", [user]);
    await db.exec("update exchange_request_settings set settings=jsonb_set(settings,'{management_emails}','[\"manager@example.test\"]')");
    for (const [status, tier, feeStatus, evidence] of [
      ["ready", "priority", "paid", false],
      ["awaiting_funds", "standard", "not_applicable", true],
      ["awaiting_funds", "standard", "not_applicable", false],
    ]) {
      const id = randomUUID(), transaction = randomUUID(), quote = randomUUID();
      const snapshot = { ...completion, locale: "en", policy_snapshot: {}, service_tier: tier,
        priority_fee_aud: tier === "priority" ? 25 : 0, priority_fee_amount: tier === "priority" ? 25 : 0 };
      await db.query("insert into transactions(id,user_id,type,amount_aud,equivalent_toman) values($1,$2,'buy_aud',1000,100000000)", [transaction, user]);
      await db.query("insert into exchange_request_quotes(id,user_id,snapshot,expires_at) values($1,$2,$3,now()+interval '1 hour')", [quote, user, snapshot]);
      await db.query(`insert into exchange_requests(id,transaction_id,user_id,quote_id,idempotency_key,reference_code,quote,
        status,service_tier,priority_fee_status,funding_due_at,clearance_due_at,handling_due_at,evidence_submitted_at,payment_instructions)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now()-interval '2 days',now()-interval '1 day',now()-interval '1 hour',
        case when $11::boolean then now()-interval '1 day' end,'Synthetic bank details')`,
      [id, transaction, user, quote, randomUUID(), `ZE${id}`, snapshot, status, tier, feeStatus, evidence]);
    }
    let sweeps = 0, committed;
    const facts = async () => ({
      tasks: (await db.query("select request_id,kind,dedupe_key from exchange_request_tasks order by request_id,kind")).rows,
      refunds: (await db.query("select request_id,kind,amount,status from exchange_request_refunds order by request_id,kind")).rows,
      events: (await db.query("select id,request_id,sequence,event_type from exchange_request_events order by id")).rows,
      requests: (await db.query("select id,status,version,priority_fee_status from exchange_requests order by id")).rows,
    });
    const adapter = { async rpc(name, args) {
      if (name === "sweep_exchange_request_deadlines") {
        const result = (await db.query("select sweep_exchange_request_deadlines() as result")).rows[0].result;
        if (++sweeps === 1) {
          committed = await facts();
          return { data: null, error: { code: "", message: "Synthetic response lost after commit" }, status: 504 };
        }
        assert.deepEqual(await facts(), committed); assert.equal(result.updated, 0);
        return { data: result, error: null, status: 200 };
      }
      const statements = {
        claim_request_notifications: ["select * from claim_request_notifications($1,$2,$3)", [args.p_worker_id, args.p_limit, args.p_lease_seconds]],
        prepare_request_notification: ["select prepare_request_notification($1,$2,$3,$4) as result", [args.p_id, args.p_worker_id, args.p_payload, args.p_template_version]],
        finish_request_notification: ["select finish_request_notification($1,$2,$3,$4,$5,$6) as result", [args.p_id, args.p_worker_id, args.p_status, args.p_provider_id, args.p_error_code, args.p_next_attempt_at]],
      };
      assert.ok(statements[name], `Unexpected RPC ${name}`);
      const [sql, params] = statements[name], result = await db.query(sql, params);
      return { data: name === "claim_request_notifications" ? result.rows : result.rows[0].result, error: null, status: 200 };
    } };
    const sent = [];
    const result = await notifications.runRequestNotificationWorker({ ...settings, db: adapter, send: async (_payload, key) => {
      sent.push(key); return { data: { id: randomUUID() }, error: null, headers: null };
    } });
    assert.equal(sweeps, 2); assert.equal(committed.tasks.length, 2); assert.equal(committed.refunds.length, 1);
    assert.equal(committed.events.length, 3); assert.deepEqual(await facts(), committed);
    assert.equal(result.accepted, 5); assert.equal(sent.length, 5); assert.equal(new Set(sent).size, 5);
    assert.equal((await db.query("select count(*)::int n from exchange_request_notification_deliveries")).rows[0].n, 5);
    assert.equal((await db.query("select max(attempts)::int n from exchange_request_notification_deliveries")).rows[0].n, 1);
  } finally { await db.close(); }
});

test("real SQL outbox preserves order, excludes internal customer events, freezes completion, and reconciles early/reordered callbacks", async () => {
  const db = new PGlite();
  try {
    await loadNotificationDatabase(db);
    const user = randomUUID(), quote = randomUUID();
    const snapshot = { ...completion, locale: "en", sender_snapshot: { name: "Original sender" }, recipient_snapshot: { full_name: "Original recipient" }, policy_snapshot: {} };
    await db.query("insert into auth.users(id,email) values($1,'customer@example.test')", [user]);
    await db.query("insert into profiles(id) values($1)", [user]);
    await db.query("insert into transactions(id,user_id,type,amount_aud,equivalent_toman) values($1,$2,'buy_aud',1000,100000000)", [transactionId, user]);
    await db.query("insert into exchange_request_quotes(id,user_id,snapshot,expires_at) values($1,$2,$3,now()+interval '1 hour')", [quote, user, snapshot]);
    await db.query("insert into exchange_requests(id,transaction_id,user_id,quote_id,idempotency_key,reference_code,quote,service_tier,priority_fee_status,funding_due_at,clearance_due_at,payment_instructions) values($1,$2,$3,$4,$5,'ZE123456',$6,'priority','unpaid',now()+interval '1 day',now()+interval '2 days','Bank details')", [requestId, transactionId, user, quote, randomUUID(), snapshot]);
    await db.exec("update exchange_request_settings set settings=jsonb_set(settings,'{management_emails}','[\"manager@example.test\"]')");
    await db.query("select emit_exchange_request_event($1,'submitted',$2,null)", [requestId, user]);
    await db.query("select emit_exchange_request_event($1,'receipt_uploaded',$2,'PRIVATE BANK REFERENCE')", [requestId, user]);
    await db.query("select emit_exchange_request_event($1,'handling_overdue',null,'INTERNAL NOTE')", [requestId]);
    const deliveries = (await db.query("select * from exchange_request_notification_deliveries order by event_sequence,audience")).rows;
    assert.equal(deliveries.length, 5);
    assert.equal(deliveries.filter(d => d.event_type === "handling_overdue" && d.audience === "customer").length, 0);
    assert.doesNotMatch(JSON.stringify(deliveries), /PRIVATE BANK REFERENCE|INTERNAL NOTE/);
    const hidden = (await db.query("select customer_visible,public_message,internal_message from exchange_request_events where event_type='handling_overdue'")).rows[0];
    assert.equal(hidden.customer_visible, false); assert.equal(hidden.public_message, null);
    assert.equal(hidden.internal_message, "INTERNAL NOTE");
    assert.equal((await db.query("select internal_message from exchange_request_events where event_type='receipt_uploaded'")).rows[0].internal_message, "PRIVATE BANK REFERENCE");

    const worker = randomUUID();
    const claim = (await db.query("select * from claim_request_notifications($1,25,120)", [worker])).rows;
    assert.equal(claim.length, 2, "only first customer/manager events can be leased");
    const first = claim.find(d => d.audience === "customer");
    const payload = templates.renderRequestNotification(first, settings);
    await assert.rejects(db.query("select prepare_request_notification($1,$2,$3,'test')", [first.id, randomUUID(), payload]), /lease lost/);
    await db.query("select prepare_request_notification($1,$2,$3,'test')", [first.id, worker, payload]);
    await assert.rejects(db.query("select prepare_request_notification($1,$2,$3,'test')", [first.id, worker, { ...payload, subject: "Changed" }]), /immutable/);
    await assert.rejects(db.query("update exchange_request_notification_deliveries set recipient_email='other@example.test' where id=$1", [first.id]), /immutable/);
    await db.query("select record_request_email_event('early-delivery','email.delivered','provider-early',now(),$1)", ["a".repeat(64)]);
    await db.query("select finish_request_notification($1,$2,'provider_accepted','provider-early',null,null)", [first.id, worker]);
    assert.equal((await db.query("select status from exchange_request_notification_deliveries where id=$1", [first.id])).rows[0].status, "delivered");
    await db.query("select record_request_email_event('late-sent','email.sent','provider-early',now()-interval '1 minute',$1)", ["b".repeat(64)]);
    assert.equal((await db.query("select status from exchange_request_notification_deliveries where id=$1", [first.id])).rows[0].status, "delivered");
    await db.query("select record_request_email_event('bounce','email.bounced','provider-early',now(),$1)", ["c".repeat(64)]);
    await db.query("select record_request_email_event('bounce','email.bounced','provider-early',now(),$1)", ["c".repeat(64)]);
    assert.equal((await db.query("select count(*)::int n from exchange_request_tasks where kind='contact_update'")).rows[0].n, 1);
    await assert.rejects(db.query("select record_request_email_event('bounce','email.bounced','provider-early',now(),$1)", ["d".repeat(64)]), /payload conflict/);
    const manager = claim.find(d => d.audience === "management");
    await db.query("update exchange_request_notification_deliveries set lease_expires_at=now()-interval '1 second' where id=$1", [manager.id]);
    const nextWorker = randomUUID();
    const reclaimed = (await db.query("select * from claim_request_notifications($1,1,120)", [nextWorker])).rows[0];
    assert.equal(reclaimed.id, manager.id); assert.equal(reclaimed.attempts, 2);
    await assert.rejects(db.query("select finish_request_notification($1,$2,'failed',null,'validation_error',null)", [manager.id, worker]), /lease lost/);

    await assert.rejects(db.query("select emit_exchange_request_event($1,'complete',$2,null)", [requestId, user]), /Verified settlement/);
    await db.exec("select set_config('app.exchange_request_write','on',false)");
    await db.query("update transactions set status='approved' where id=$1", [transactionId]);
    await db.query("update exchange_requests set status='completed',funding_status='confirmed',priority_fee_status='paid' where id=$1", [requestId]);
    await db.query("insert into exchange_request_executions(request_id,status,claimed_by,settlement_reference,settled_at) values($1,'settled',$2,'PRIVATE-SETTLEMENT',now())", [requestId, user]);
    await db.query("select emit_exchange_request_event($1,'complete',$2,null)", [requestId, user]);
    const final = (await db.query("select snapshot from exchange_request_completion_receipts where request_id=$1", [requestId])).rows[0].snapshot;
    assert.equal(final.sender_name, "Original sender"); assert.equal(final.recipient_name, "Original recipient");
    assert.equal(final.priority_fee_aud, 25); assert.doesNotMatch(JSON.stringify(final), /PRIVATE-SETTLEMENT/);
    await db.query("update profiles set first_name='Changed profile' where id=$1", [user]);
    assert.deepEqual((await db.query("select snapshot from exchange_request_completion_receipts where request_id=$1", [requestId])).rows[0].snapshot, final);
    await assert.rejects(db.query("update exchange_request_completion_receipts set snapshot='{}' where request_id=$1", [requestId]), /immutable/i);
    const completedMails = (await db.query("select payload_snapshot from exchange_request_notification_deliveries where event_type='complete'")).rows;
    assert.equal(completedMails.length, 2); assert.deepEqual(completedMails[0].payload_snapshot.receipt, final);
    await db.exec("set role authenticated");
    await assert.rejects(db.query("select * from exchange_request_completion_receipts"), /permission denied/);
    await assert.rejects(db.query("select * from claim_request_notifications($1,1,120)", [randomUUID()]), /permission denied/);
    await db.exec("reset role");
  } finally { await db.close(); }
});
