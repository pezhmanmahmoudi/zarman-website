import assert from "node:assert/strict";
import { test } from "node:test";
import { completion, delivery, settings, templates } from "./fixtures/request-email-template.mjs";

test("customer completion email mirrors the compact transfer summary and preserves PDF access", () => {
  const original = delivery();
  const originalJson = JSON.stringify(original);
  const mail = templates.renderRequestNotification(original, settings);
  assert.deepEqual(mail.to, ["customer@example.test"]);
  assert.match(mail.subject, /^Transaction ZE123456: Your transfer was successful/);
  assert.match(mail.text, /Hi Sam Example,/);
  assert.match(mail.text, /To: Alex Example\nSent: AUD 1,150.00\nOn \(Sydney time\): 2 Oct 2026, 3:12 pm\nTransaction code: ZE123456/);
  assert.match(mail.html, /Transaction code<\/span><br><strong dir="ltr"[^>]*font-size:24px[^>]*>ZE123456<\/strong>/);
  assert.doesNotMatch(mail.html + mail.text, /Reference:/);
  assert.match(mail.text, /Your final PDF receipt is attached/);
  assert.match(mail.text, /https:\/\/example.test\/en\/dashboard\/requests\//);
  assert.doesNotMatch(mail.text, /115,000,000|Applied rate|Express processing fee/);
  assert.doesNotMatch(mail.html + mail.text, /Expected arrival|estimated arrival|\bETA\b|24\/7|Revolut|زمان تخمینی|زمان تقریبی/i);
  assert.equal(JSON.stringify(original), originalJson, "rendering never rewrites the immutable receipt");
});

test("stored Persian locale still renders the single English template while preserving actual names", () => {
  const mail = templates.renderRequestNotification(delivery({ locale: "fa", payload_snapshot: { receipt: {
    ...completion, sender_name: "سام نمونه", recipient_name: "علی نمونه", recipient_currency: "IRT", recipient_amount: 115000000,
  } } }), settings);
  assert.match(mail.html, /lang="en" dir="ltr"/);
  assert.match(mail.text, /Hi سام نمونه,/);
  assert.match(mail.text, /To: علی نمونه\nSent: Toman \(IRT\) 115,000,000/);
  assert.match(mail.text, /Transaction code: ZE123456/);
  assert.match(mail.html, /dir="ltr"[^>]*>ZE123456<\/strong>/);
  assert.match(mail.html, /\/en\/dashboard\/requests\//);
  assert.match(mail.subject, /Transaction ZE123456: Your transfer was successful/);
  assert.doesNotMatch(mail.text, /سلام|گیرنده|شماره پیگیری|Expected arrival/);
  assert.doesNotMatch(mail.html, /\/fa\/dashboard\/|lang="fa"|dir="rtl"/);
  const en = templates.renderRequestNotification(delivery(), settings);
  assert.deepEqual(templates.renderRequestNotification(delivery({ locale: "fa" }), settings), en);
  assert.deepEqual(templates.renderRequestNotification(delivery({ locale: "unknown" }), settings), en);
});

test("only immutable completed settlement claims money was sent; intermediate emails show current stage", () => {
  for (const [event_type, workflow_status, expected] of [
    ["review", "under_review", /Under review/], ["start_processing", "processing", /Processing/],
    ["cancel", "cancelled", /Cancelled/], ["reject", "rejected", /Rejected/],
    ["receipt_uploaded", "awaiting_funds", /checking your payment/],
  ]) {
    const mail = templates.renderRequestNotification(delivery({ event_type, workflow_status, payload_snapshot: {
      sender_name: "Sam Example", recipient_name: "Alex Example", recipient_amount: 1150, recipient_currency: "AUD",
    } }), settings);
    assert.match(mail.subject, expected);
    assert.match(mail.text, /Recipient amount: AUD 1,150.00/);
    assert.doesNotMatch(mail.html + mail.text, /transfer was successful|You sent|Sent:|PDF receipt is attached/);
  }
  assert.throws(() => templates.renderRequestNotification(delivery({ payload_snapshot: {} }), settings), /completion_receipt_unavailable/);
  assert.throws(() => templates.renderRequestNotification(delivery({ payload_snapshot: { receipt: { ...completion, recipient_amount: -1 } } }), settings), /invalid_completion_receipt/);
});

test("historical management deliveries are rejected before rendering or selecting a recipient", () => {
  assert.throws(() => templates.renderRequestNotification(delivery({ audience: "management" }), settings), /management_email_disabled/);
  assert.throws(() => templates.renderRequestNotification(delivery({ audience: null }), settings), /management_email_disabled/);
  assert.doesNotMatch(templates.renderRequestNotification(delivery(), settings).html, /\/admin\//);
});

test("names, reference and messages cannot inject markup or subject headers", () => {
  const mail = templates.renderRequestNotification(delivery({ reference: "ZE123\r\nBcc: hidden@example.test", event_type: "admin_message", workflow_status: "processing", payload_snapshot: {
    sender_name: "<script>alert(1)</script>", public_message: '<a href="https://attacker.test">Click me</a>\nSecond line',
  } }), settings);
  assert.doesNotMatch(mail.html, /<script>|href="https:\/\/attacker/);
  assert.match(mail.html, /&lt;script&gt;/);
  assert.match(mail.html, /&lt;a href=&quot;/);
  assert.doesNotMatch(mail.subject, /[\r\n]/);
  assert.deepEqual(mail.to, ["customer@example.test"]);
  assert.match(mail.text, /Second line/);
  const persianMessage = "لطفاً نام فرستنده را تأیید کنید.";
  const originalMessage = templates.renderRequestNotification(delivery({ locale: "fa", event_type: "admin_message", payload_snapshot: { public_message: persianMessage } }), settings);
  assert.ok(originalMessage.text.includes(persianMessage), "a customer's or administrator's text is never silently translated");
  assert.match(originalMessage.subject, /Message from Zarman/);
});

test("legacy public snapshots work without fabricated identities or amounts", () => {
  const mail = templates.renderRequestNotification(delivery({ workflow_status: "processing", event_type: "start_processing", payload_snapshot: {} }), settings);
  assert.match(mail.text, /Hello,/);
  assert.doesNotMatch(mail.text, /Hi customer|To:|Recipient amount:|undefined|null|NaN/);
});

test("payment approval retains bank values and Commonwealth warning only for Australian deposits", () => {
  for (const locale of ["en", "fa"]) for (const funding_currency of ["AUD", "IRT"]) {
    const mail = templates.renderRequestNotification(delivery({ locale, event_type: "await_funds", workflow_status: "awaiting_funds", payload_snapshot: {
      funding_currency, funding_total: 1150,
      payment_details: { account_name: "Zarman Preview", bsb: "000-000", account_number: "00123456" },
    } }), settings);
    assert.match(mail.text, /00123456/);
    assert.match(mail.text, /BSB: 000-000/);
    if (funding_currency === "AUD") assert.match(mail.text, /Commonwealth Bank/);
    else assert.doesNotMatch(mail.text, /Commonwealth Bank/);
    assert.doesNotMatch(mail.html, /Expected arrival|زمان تخمینی|زمان تقریبی/);
  }
});

test("email layout has mobile sizing, inline presentation tables, preheader and no external assets", () => {
  const { html, text } = templates.renderRequestNotification(delivery(), settings);
  assert.match(html, /name="viewport"/);
  assert.match(html, /role="presentation"/);
  assert.match(html, /max-width:600px/);
  assert.match(html, /mso-hide:all/);
  assert.match(html, /background-color:#f4f5f6/);
  assert.doesNotMatch(html, /<script|<link|<img|display:flex|display:grid|@font-face/i);
  assert.doesNotMatch(text, /<table|<p style|&amp;/);
});
