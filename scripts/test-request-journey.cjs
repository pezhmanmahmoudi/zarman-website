/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");
const vm = require("node:vm");
function compile(file) {
  const source = ts.transpileModule(readFileSync(resolve(__dirname, "..", file), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const compiled = { exports: {} };
  vm.runInNewContext(source, { module: compiled, exports: compiled.exports, Intl, Date });
  return compiled.exports;
}
const journey = compile("lib/requests/journey.ts");
const labels = compile("components/requests/request-labels.ts");
const submitted = { status: "submitted", funding_status: "unpaid", priority_fee_status: "not_applicable", payment_approved_at: null,
  evidence_submitted_at: null, funds_confirmed_at: null, created_at: "2026-09-15T01:00:00Z", updated_at: "2026-09-15T05:00:00Z" };

test("the next customer step follows recorded approvals and evidence, never mere bank details or review loops", () => {
  assert.equal(journey.getRequestJourney({ ...submitted, payment_details: { bsb: "000000" } }).canPay, false);
  const approved = { ...submitted, status: "awaiting_funds", payment_approved_at: "2026-09-15T02:00:00Z" };
  assert.equal(journey.getRequestJourney(approved).stageKey, "payment");
  assert.equal(journey.getRequestJourney(approved).canPay, true);
  assert.equal(journey.getRequestJourney(approved).canUpload, true);
  assert.equal(journey.getRequestJourney({ ...approved, status: "submitted" }).canUpload, true);
  assert.equal(journey.requestStageLabel({ ...approved, status: "under_review" }, "en"), "Admin review in progress");
  const receipt = { ...approved, evidence_submitted_at: "2026-09-15T03:00:00Z" };
  assert.equal(journey.getRequestJourney(receipt).stageKey, "receipt_review");
  assert.equal(journey.getRequestJourney({ ...receipt, status: "under_review" }).stageKey, "receipt_review");
  const funded = { ...receipt, funding_status: "confirmed", funds_confirmed_at: "2026-09-15T04:00:00Z", status: "ready" };
  assert.equal(journey.getRequestJourney(funded).stageKey, "funds_received");
  assert.equal(journey.getRequestJourney(funded).canUpload, false);
  assert.equal(journey.getRequestJourney({ ...funded, status: "action_required" }).stageKey, "funds_received");
  assert.equal(journey.requestStageLabel({ ...funded, status: "action_required" }, "en"), "Funds received · under admin review");
  assert.equal(journey.getRequestJourney({ ...funded, status: "completed" }).stageKey, "completed");
});

test("milestones collapse repeated internal reviews and retain factual dates after later messages", () => {
  const request = { ...submitted, status: "completed", payment_approved_at: "2026-09-15T02:00:00Z", evidence_submitted_at: "2026-09-15T03:30:00Z", funds_confirmed_at: "2026-09-15T04:00:00Z", funding_status: "confirmed", updated_at: "2026-09-18T05:00:00Z" };
  const events = ["submitted", "review", "request_info", "respond", "await_funds", "review", "receipt_uploaded", "receipt_uploaded", "ready", "complete", "customer_message"]
    .map((event_type, sequence) => ({ event_type, sequence, created_at: `2026-09-15T${String(sequence + 1).padStart(2, "0")}:00:00Z` }));
  const result = journey.requestMilestones(request, events);
  assert.equal(result.length, 5);
  assert.equal(new Set(result.map(row => row.key)).size, 5);
  assert.equal(result.find(row => row.key === "receipt").at, events[6].created_at);
  assert.equal(result.find(row => row.key === "completed").at, events[9].created_at);
  assert.equal(journey.requestMilestones(request).find(row => row.key === "completed").at, null);
});

test("closed requests and pending refunds cannot offer new customer payments or receipts", () => {
  const approved = { ...submitted, status: "awaiting_funds", payment_approved_at: "2026-09-15T02:00:00Z" };
  for (const patch of [{ status: "cancelled" }, { status: "expired" }, { status: "rejected" }, { funding_status: "refund_pending" }, { priority_fee_status: "refund_pending" }]) {
    const state = journey.getRequestJourney({ ...approved, ...patch });
    assert.equal(state.canPay, false);
    assert.equal(state.canUpload, false);
  }
});

test("funds received remains factual during internal review and never reopens funding or asks for a customer reply", () => {
  for (const status of ["under_review", "action_required", "awaiting_funds"]) {
    for (const funding of [{ funding_status: "confirmed", funds_confirmed_at: null }, { funding_status: "partial", funds_confirmed_at: "2026-09-15T04:00:00Z" }]) {
      const request = { ...submitted, ...funding, status, payment_approved_at: "2026-09-15T02:00:00Z", evidence_submitted_at: "2026-09-15T03:00:00Z",
        action_required: "Finance must verify the credited account.", customer_action_required: null };
      const state = journey.getRequestJourney(request);
      assert.equal(state.fundsReceived, true);
      assert.equal(state.stageKey, "funds_received");
      assert.equal(state.canPay, false);
      assert.equal(state.canUpload, false);
      assert.equal(state.customerActionRequired, false);
      assert.equal(state.customerActionMessage, null);
      assert.equal(state.readyForSettlement, false);
      assert.doesNotMatch(journey.requestStageLabel(request, "en"), /Reply|your payment|Checking your payment/);
      assert.doesNotMatch(journey.requestStageLabel(request, "fa"), /نیاز به پاسخ|آماده پرداخت|بررسی واریز/);
    }
  }
});

test("only an explicit open customer question requires a reply, independently of internal financial notes", () => {
  const question = "Please confirm the sender's account name.";
  const request = { ...submitted, status: "under_review", funding_status: "confirmed", action_required: "Internal account reconciliation", customer_action_required: question };
  assert.equal(journey.getRequestJourney(request).customerActionRequired, true);
  assert.equal(journey.getRequestJourney(request).customerActionMessage, question);
  assert.equal(journey.requestStageLabel(request, "en"), "Reply needed");
  assert.equal(journey.requestStageLabel(request, "fa"), "نیاز به پاسخ شما");
  for (const customer_action_required of [undefined, null, "", "   "]) {
    assert.equal(journey.getRequestJourney({ ...request, customer_action_required }).customerActionRequired, false);
    assert.equal(journey.getRequestJourney({ ...request, customer_action_required }).customerActionMessage, null);
  }
  for (const status of ["completed", "cancelled", "rejected", "expired"]) {
    assert.equal(journey.getRequestJourney({ ...request, status }).customerActionRequired, false);
  }
});

test("settlement readiness requires released confirmed funds and no outstanding customer question", () => {
  const ready = { ...submitted, status: "ready", funding_status: "confirmed", funds_confirmed_at: "2026-09-15T04:00:00Z" };
  assert.equal(journey.getRequestJourney(ready).readyForSettlement, true);
  for (const patch of [{ status: "under_review" }, { status: "action_required" }, { funding_status: "partial" }, { customer_action_required: "Please confirm the recipient." }]) {
    const state = journey.getRequestJourney({ ...ready, ...patch });
    assert.equal(state.fundsReceived, true);
    assert.equal(state.readyForSettlement, false);
  }
});

test("a Priority fee refund preserves an open customer question while principal refunds close that prompt", () => {
  const question = "Please confirm the recipient account before settlement.";
  const funded = { ...submitted, status: "action_required", funding_status: "confirmed", funds_confirmed_at: "2026-09-15T04:00:00Z",
    customer_action_required: question, action_required: "Priority handling overdue; fee refund pending." };
  for (const priority_fee_status of ["refund_pending", "refunded"]) {
    const request = { ...funded, priority_fee_status };
    const state = journey.getRequestJourney(request);
    assert.equal(state.customerActionRequired, true);
    assert.equal(state.customerActionMessage, question);
    assert.equal(state.fundsReceived, true);
    assert.equal(state.readyForSettlement, false);
    assert.equal(state.canPay, false);
    assert.equal(state.canUpload, false);
    assert.equal(journey.requestStageLabel(request, "en"), "Reply needed");
    assert.equal(journey.requestStageLabel(request, "fa"), "نیاز به پاسخ شما");
    const answered = journey.getRequestJourney({ ...request, status: "under_review", customer_action_required: null });
    assert.equal(answered.customerActionRequired, false);
    assert.equal(answered.fundsReceived, true);
    assert.equal(answered.readyForSettlement, false);
    for (const funding_status of ["refund_pending", "refunded"]) {
      const principal = journey.getRequestJourney({ ...request, funding_status });
      assert.equal(principal.customerActionRequired, false);
      assert.equal(principal.customerActionMessage, null);
      assert.equal(principal.readyForSettlement, false);
    }
  }
});

test("all workflow dates remain English and Gregorian in both interface languages", () => {
  const fa = labels.requestDate("2026-09-15T01:00:00Z", "fa");
  assert.equal(fa, labels.requestDate("2026-09-15T01:00:00Z", "en"));
  assert.match(fa, /15 Sept 2026/);
  assert.doesNotMatch(fa, /[۰-۹\u0600-\u06ff]/);
  assert.equal(labels.requestDate(null, "fa"), "—");
});

test("activity and email summaries describe the action without leaking internal identifiers", () => {
  assert.match(journey.requestActivityLabel("await_funds", "en"), /Payment approved/);
  assert.match(journey.requestActivityLabel("receipt_uploaded", "en"), /sent a payment receipt/);
  assert.equal(journey.requestEmailStatus("skipped", "admin_email_opt_out"), "Email not requested");
  assert.equal(journey.requestEmailStatus("failed", "PRIVATE raw provider response"), "Delivery failed");
  assert.equal(journey.requestActivityLabel("internal_new_unknown_event", "en"), "Request updated");
});
