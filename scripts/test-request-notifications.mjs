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
  assert.match(uploaded.subject, /Payment receipt received/);
  assert.match(uploaded.text, /will confirm when funds have cleared/);
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

test("real SQL outbox preserves order, excludes internal customer events, freezes completion, and reconciles early/reordered callbacks", async () => {
  const db = new PGlite();
  try {
    await db.exec(read("scripts/fixtures/customer-requests.sql"));
    for (const migration of ["20260911_18_customer_requests.sql", "20260911_19_request_notifications.sql", "20260913_23_request_funding_and_receipts.sql", "20260913_24_request_receipt_notifications.sql"]) {
      await db.exec(read(`supabase/migrations/${migration}`));
    }
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
