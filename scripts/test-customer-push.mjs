// Offline only: the push migration in PGlite plus the pure helpers. No env files, network or real push services.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";

const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
function compile(file, dependencies = {}) {
  const source = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const compiledModule = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename: file })((id) => {
    if (id in dependencies) return dependencies[id];
    if (id.startsWith("node:")) return require(id);
    throw new Error(`Unexpected dependency ${id}`);
  }, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}

const sent = [];
const webpush = {
  __esModule: true,
  default: { sendNotification: async (target, payload) => { sent.push({ target, payload: JSON.parse(payload) }); return {}; } },
  WebPushError: class extends Error {},
};
const push = compile("lib/notifications/customer-push.ts", {
  "web-push": webpush,
  "./customer-telegram": { telegramDatabase: () => null },
});

const keys = { p256dh: "B".repeat(87), auth: "a".repeat(22) };

test("only official push services are accepted as endpoints", () => {
  for (const endpoint of ["https://fcm.googleapis.com/fcm/send/abc", "https://updates.push.services.mozilla.com/wpush/v2/x",
    "https://web.push.apple.com/QF2", "https://wns2-sg2p.notify.windows.com/w/?token=x"]) {
    assert.ok(push.validPushSubscription({ endpoint, keys }), endpoint);
  }
  for (const endpoint of ["http://fcm.googleapis.com/fcm/send/abc", "https://fcm.googleapis.com.evil.com/x", "https://169.254.169.254/latest",
    "https://localhost/x", "https://user:pw@fcm.googleapis.com/x", "https://fcm.googleapis.com:8443/x", "https://evilweb.push.apple.com.attacker.io/x"]) {
    assert.equal(push.validPushSubscription({ endpoint, keys }), null, endpoint);
  }
  assert.equal(push.validPushSubscription({ endpoint: "https://fcm.googleapis.com/x", keys: { p256dh: "short", auth: keys.auth } }), null);
  assert.equal(push.validPushSubscription(null), null);
});

test("notifications are English, link to the transfer in the customer's site language, and group by transfer", () => {
  const payload = push.customerPushPayload({ requestId: "r-1", eventType: "complete", reference: "ZE3F9A‮1B2C", createdAt: "2026-11-12T01:02:03Z" }, "fa");
  assert.equal(payload.url, "/fa/dashboard/requests/r-1", "a Persian-site customer opens the Persian page");
  assert.equal(payload.tag, "request-r-1");
  assert.equal(payload.lang, "en");
  assert.equal(payload.title, "Transfer complete");
  assert.equal(payload.body, "Transfer ZE3F9A1B2C has been completed. Your receipt is ready.", "bidi controls are stripped from the reference");
  assert.equal(payload.timestamp, Date.parse("2026-11-12T01:02:03Z"));
  const unknown = push.customerPushPayload({ requestId: "r-2", eventType: "admin_note", reference: "ZE2" }, "en");
  assert.deepEqual([unknown.title, unknown.body, unknown.url], ["Transfer update", "There's a new update on transfer ZE2.", "/en/dashboard/requests/r-2"]);
});

test("every customer-facing event has its own English title and body, with no amounts", () => {
  const events = ["reopened","admin_message","review","await_funds","request_info","funds_recorded","ready","confirm_funds","resume_funded_request",
    "start_processing","record_uncertain_payout","complete","reconcile_complete","reject","cancel","refund_pending","refund_returned","expired"];
  for (const eventType of events) {
    for (const siteLocale of ["en", "fa"]) {
      const payload = push.customerPushPayload({ requestId: "r", eventType, reference: "ZEABCD" }, siteLocale);
      const text = payload.title + payload.body;
      assert.notEqual(payload.title, "Transfer update", `${eventType} uses the generic fallback`);
      assert.ok(payload.body.includes("ZEABCD") && !payload.body.includes("{ref}"), `${eventType} names the transfer`);
      assert.ok(payload.title.length <= 40 && payload.body.length <= 140, `${eventType} fits a lock screen`);
      assert.doesNotMatch(text, /[؀-ۿ]/, `${eventType}/${siteLocale} must be English`);
      assert.doesNotMatch(text, /\$|AUD|\d{3,}/, "no amounts");
    }
  }
  const testPayload = push.customerPushTestPayload("fa");
  assert.equal(testPayload.lang, "en");
  assert.doesNotMatch(testPayload.title + testPayload.body, /[؀-ۿ]/);
  assert.equal(testPayload.url, "/fa/dashboard");
});

test("service worker shows notifications left-to-right in English", () => {
  const source = read("public/sw.js");
  assert.match(source, /lang: "en"/);
  assert.match(source, /dir: "ltr"/);
});

test("config requires well-formed VAPID settings", () => {
  const saved = { ...process.env };
  try {
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY = "B".repeat(87);
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY = "k".repeat(43);
    process.env.WEB_PUSH_SUBJECT = "mailto:info@zarman.com.au";
    assert.ok(push.customerPushConfig());
    process.env.WEB_PUSH_SUBJECT = "info@zarman.com.au";
    assert.equal(push.customerPushConfig(), null);
  } finally { process.env = saved; }
});

async function database() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE public.profiles (id uuid PRIMARY KEY);
    CREATE TABLE public.admins (id uuid PRIMARY KEY);
    CREATE FUNCTION public.exchange_request_is_admin(p uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM public.admins WHERE id=p) $$;
    CREATE TABLE public.exchange_requests (id uuid PRIMARY KEY, user_id uuid NOT NULL, reference_code text NOT NULL);
    CREATE TABLE public.exchange_request_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES public.exchange_requests(id),
      sequence integer NOT NULL, event_type text NOT NULL, status text NOT NULL, public_message text,
      actor_id uuid, customer_visible boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
  `);
  await db.exec(read("supabase/migrations/20261112_71_customer_web_push.APPLY_MANUALLY.sql"));
  return db;
}

test("migration queues admin updates for customers with devices and cleans up dead devices", async () => {
  const db = await database();
  const customer = randomUUID(), other = randomUUID(), admin = randomUUID(), request = randomUUID(), worker = randomUUID();
  await db.query("INSERT INTO public.profiles VALUES ($1),($2)", [customer, other]);
  await db.query("INSERT INTO public.admins VALUES ($1)", [admin]);
  await db.query("INSERT INTO public.exchange_requests VALUES ($1,$2,'ZR-100')", [request, customer]);
  const event = (sequence, actor, type = "complete", visible = true) => db.query(
    "INSERT INTO public.exchange_request_events(request_id,sequence,event_type,status,actor_id,customer_visible) VALUES ($1,$2,$3,'x',$4,$5)",
    [request, sequence, type, actor, visible]);

  // No device yet: nothing is queued.
  await event(1, admin);
  assert.equal((await db.query("SELECT count(*)::int n FROM public.customer_push_deliveries")).rows[0].n, 0);

  const sub = (endpoint) => db.query("INSERT INTO public.customer_push_subscriptions(user_id,endpoint,p256dh,auth,locale) VALUES ($1,$2,$3,$4,'fa') RETURNING id",
    [customer, endpoint, keys.p256dh, keys.auth]).then(r => r.rows[0].id);
  const phone = await sub("https://fcm.googleapis.com/fcm/send/phone");
  const laptop = await sub("https://updates.push.services.mozilla.com/wpush/v2/laptop");

  await event(2, customer, "customer_message");     // the customer's own action
  await event(3, admin, "internal", false);         // not visible to the customer
  await event(4, admin, "complete");
  const queued = (await db.query("SELECT event_sequence FROM public.customer_push_deliveries")).rows;
  assert.deepEqual(queued.map(r => r.event_sequence), [4]);

  const claim = (await db.query("SELECT public.claim_customer_push_delivery($1,$2) d", [worker, request])).rows[0].d;
  assert.equal(claim.reference, "ZR-100");
  assert.equal(claim.subscriptions.length, 2);
  assert.equal((await db.query("SELECT public.claim_customer_push_delivery($1,$2) d", [randomUUID(), request])).rows[0].d, null, "a claimed delivery is not handed out twice");

  await db.query("SELECT public.finish_customer_push_delivery($1,$2,'sent',NULL,$3::uuid[],'{}'::uuid[],$4::uuid[])", [claim.id, worker, [phone], [laptop]]);
  const delivery = (await db.query("SELECT status, sent_at FROM public.customer_push_deliveries WHERE id=$1", [claim.id])).rows[0];
  assert.equal(delivery.status, "sent");
  assert.ok(delivery.sent_at);
  const remaining = (await db.query("SELECT id, last_success_at FROM public.customer_push_subscriptions")).rows;
  assert.deepEqual(remaining.map(r => r.id), [phone], "a device the push service reports gone is removed");
  assert.ok(remaining[0].last_success_at);

  // A failed send goes back to the queue, up to five attempts.
  await event(5, admin, "cancel");
  for (let attempt = 1; attempt <= 5; attempt++) {
    const retry = (await db.query("SELECT public.claim_customer_push_delivery($1,$2) d", [worker, request])).rows[0].d;
    assert.ok(retry, `attempt ${attempt}`);
    await db.query("SELECT public.finish_customer_push_delivery($1,$2,'failed','push_service_error','{}'::uuid[],$3::uuid[],'{}'::uuid[])", [retry.id, worker, [phone]]);
  }
  assert.equal((await db.query("SELECT public.claim_customer_push_delivery($1,$2) d", [worker, request])).rows[0].d, null);
  assert.equal((await db.query("SELECT status FROM public.customer_push_deliveries WHERE event_sequence=5")).rows[0].status, "failed");

  // Customers and the public API role cannot touch the tables or functions.
  await db.exec("SET ROLE authenticated");
  await assert.rejects(db.query("SELECT * FROM public.customer_push_subscriptions"));
  await assert.rejects(db.query("SELECT public.claim_customer_push_delivery($1,$2)", [worker, request]));
  await db.exec("RESET ROLE");
  await db.close();
});

test("service worker only opens same-site links", () => {
  const source = read("public/sw.js");
  assert.match(source, /target\.origin !== self\.location\.origin\) return/);
  assert.doesNotMatch(source, /addEventListener\("fetch"/, "no caching of financial pages");
});
