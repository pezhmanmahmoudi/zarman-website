// Real PostgreSQL procedures, synthetic data, no network or notifications.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { before, after, beforeEach, afterEach, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";
const require = createRequire(import.meta.url);
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
function compile(file, imports = {}) {
  const output = { exports: {} };
  const code = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`)(id => imports[id] ?? require(id), output, output.exports);
  return output.exports;
}
const pricing = compile("lib/pricing.ts");
const { calculateQuoteMoney } = compile("lib/requests/quote-money.ts", { "@/lib/pricing": pricing });
const ADMIN = "00000000-0000-4000-8000-000000000003", CUSTOMER = "00000000-0000-4000-8000-000000000001", OTHER = "00000000-0000-4000-8000-000000000002";
const RECIPIENT = "20000000-0000-4000-8000-000000000001";
const AUD = "10000000-0000-4000-8000-000000000001", IRT = "10000000-0000-4000-8000-000000000002";
const config = { discount_step_volume: 1000, discount_percent_per_step: .005, max_discount_percent: .25, fee_threshold: 1000, applied_fee: 30 };
let db;
const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
const rpc = async (sql, args) => (await one(sql, args)).result;
async function rejected(work, pattern) {
  await db.exec("SAVEPOINT rejected_command"); await assert.rejects(work, pattern); await db.exec("ROLLBACK TO SAVEPOINT rejected_command");
}
async function submit({ currency = "IRT", amount = 870000000, rate = 182600, txType = "buy_aud", priority = 0, legacy = false, education = false } = {}) {
  const money = calculateQuoteMoney({ currency, amount, rate, txType, config, priorityFeeAud: priority });
  const policy = await one("SELECT version,settings FROM exchange_request_settings WHERE id");
  const recipient = await one("SELECT * FROM recipients WHERE id=$1", [RECIPIENT]);
  const q = { raw_amount_aud: money.rawAmountAud, equivalent_toman: money.equivalentToman, applied_rate: rate, base_fee_aud: money.baseFeeAud,
    priority_fee_aud: priority, priority_fee_amount: money.priorityFeeAmount,
    funding_currency: txType === "buy_aud" ? "IRT" : "AUD", funding_total: money.fundingTotal,
    recipient_amount: money.recipientAmount, recipient_currency: txType === "buy_aud" ? "AUD" : "IRT",
    service_tier: priority ? "priority" : "standard", locale: "fa", customer_request_type: txType,
    company_trade_type: txType === "buy_aud" ? "sell_aud" : "buy_aud", source_of_funds: "Savings", reason_for_transfer: "Family support",
    recipient_id: RECIPIENT, recipient_snapshot: recipient, sender_snapshot: { name: "Synthetic Customer" },
    policy_version: policy.version, policy_snapshot: policy.settings, loyalty_discount: 1234, discount_amount: 500, promo_code: null };
  if (education) Object.assign(q, { recipient_id: null, recipient_snapshot: { institution_name: "Synthetic School" }, institution_name: "Synthetic School", payment_link: "https://example.invalid/invoice", invoice_reference: null });
  if (!legacy) Object.assign(q, { locked_amount_currency: currency, locked_amount_value: amount, rounding_adjustment_toman: money.roundingAdjustmentToman });
  const quote = await one("INSERT INTO exchange_request_quotes(user_id,snapshot,expires_at) VALUES($1,$2,now()+interval '1 hour') RETURNING id", [CUSTOMER, q]);
  return rpc("SELECT submit_exchange_request($1,$2,$3) AS result", [CUSTOMER, quote.id, randomUUID()]);
}
const edit = (r, funding = 870000000, recipient = 4777.59, actor = ADMIN, key = randomUUID(), reason = "Customer requested a correction") => rpc(
  "SELECT admin_update_request_pricing($1,$2,$3,$4,$5,$6,$7) AS result", [actor, r.id, r.version, key, funding, recipient, reason]);
const accept = (r, actor = CUSTOMER, key = randomUUID()) => rpc("SELECT accept_request_pricing($1,$2,$3,$4) AS result", [actor, r.id, r.version, key]);
const approve = r => rpc("SELECT transition_exchange_request($1,$2,$3,$4,'await_funds',$5) AS result", [ADMIN, r.id, r.version, randomUUID(), { send_email: false }]);

before(async () => {
  db = new PGlite();
  for (const file of ["scripts/fixtures/customer-requests.sql", "supabase/migrations/20260802_09_enterprise_reporting.sql",
    "supabase/migrations/20260802_10_ledger_accounting_controls.sql", "supabase/migrations/20260802_13_standardize_trade_fee_accounting.sql",
    "supabase/migrations/20260911_18_customer_requests.sql", "supabase/migrations/20260911_19_request_notifications.sql",
    "supabase/migrations/20260913_23_request_funding_and_receipts.sql", "supabase/migrations/20260913_24_request_receipt_notifications.sql",
    "supabase/migrations/20260913_25_request_fee_accounting.sql", "supabase/migrations/20260913_26_request_fee_ledger_type.sql",
    "supabase/migrations/20260913_27_request_messages_and_notifications.sql", "supabase/migrations/20260913_28_request_bank_details.sql",
    "supabase/migrations/20260915_29_request_payment_approval.sql", "supabase/migrations/20260915_30_request_customer_actions_and_received_funds.sql",
    "supabase/migrations/20260921_33_customer_request_realtime_signals.sql", "supabase/migrations/20260924_35_admin_hard_delete.sql",
    "supabase/migrations/20260930_39_optional_institution_reference.APPLY_MANUALLY.sql",
    "supabase/migrations/20261002_43_request_accounting_overrides.APPLY_MANUALLY.sql",
    "supabase/migrations/20261008_51_request_pricing_integrity.APPLY_MANUALLY.sql"]) await db.exec(read(file));
  await db.query("INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES($1,'customer@example.invalid','{}'),($2,'other@example.invalid','{}'),($3,'admin@example.invalid','{\"role\":\"admin\"}')", [CUSTOMER, OTHER, ADMIN]);
  await db.exec("INSERT INTO profiles(id,email,kyc_status) SELECT id,email,'approved' FROM auth.users");
  await db.query("INSERT INTO recipients(id,user_id,direction,account_name,bank_name,bsb,account_number) VALUES($1,$2,'aud','Synthetic Recipient','Synthetic Bank','000001','00123456')", [RECIPIENT, CUSTOMER]);
  await db.exec("INSERT INTO rates_history(date,buy_aud,sell_aud) VALUES(current_date,180000,184000)");
  await db.query("INSERT INTO bank_accounts(id,account_name,currency) VALUES($1,'Synthetic AUD','AUD'),($2,'Synthetic IRT','IRT')", [AUD, IRT]);
  await db.query("UPDATE exchange_request_settings SET settings=settings||$1::jsonb", [{ enabled: true, priority_enabled: true, priority_fee_aud: 25,
    priority_capacity: 10, max_amount_aud: 50000, payment_details_aud: { account_name: "TEST", bsb: "000001", account_number: "00123456" },
    payment_details_irt: { account_name: "TEST", account_number: "123456" }, business_days: [0,1,2,3,4,5,6], opening_hour: 0, closing_hour: 24 }]);
});
after(async () => { await db?.close(); });
beforeEach(async () => { await db.exec("BEGIN"); });
afterEach(async () => { await db.exec("ROLLBACK"); });

test("870 million Toman remains fixed at the fresh rate, with only the AUD payout changing", async () => {
  const before = calculateQuoteMoney({ currency: "IRT", amount: 870000000, rate: 182100, txType: "buy_aud", config });
  const r = await submit();
  assert.equal(before.rawAmountAud, 4777.59);
  assert.equal(r.quote.funding_total, 870000000);
  assert.equal(r.quote.recipient_amount, 4764.51);
  assert.equal(r.quote.locked_amount_currency, "IRT");
  assert.ok(Math.abs(r.quote.rounding_adjustment_toman) <= Math.ceil(182600 / 200) + 1);
  const t = await one("SELECT * FROM transactions WHERE id=$1", [r.transaction_id]);
  assert.equal(Number(t.equivalent_toman), 870000000);
});
test("express fees fit within the fixed Toman budget; AUD quotes retain their original payout", async () => {
  const budget = await submit({ priority: 25 });
  assert.equal(budget.quote.funding_total, 870000000);
  assert.equal(budget.quote.recipient_amount, 4739.51);
  const aud = await submit({ currency: "AUD", amount: 4777.59 });
  assert.equal(aud.quote.recipient_amount, 4777.59);
  assert.equal(aud.quote.funding_total, 872387934);
});
test("legacy quotes and their original rounding equation remain supported", async () => {
  const r = await submit({ currency: "AUD", amount: 4777.59, legacy: true });
  assert.equal(r.quote.funding_total, 872387934);
  assert.equal(r.quote.locked_amount_currency, undefined);
});
test("database rejects fabricated fixed amounts and unbounded rounding adjustments", async () => {
  const r = await submit();
  for (const q of [{ ...r.quote, funding_total: r.quote.funding_total + 1 }, { ...r.quote, rounding_adjustment_toman: 50000 }]) {
    await rejected(() => db.query("INSERT INTO exchange_request_quotes(user_id,snapshot,expires_at) VALUES($1,$2,now()+interval '1 hour')", [CUSTOMER, q]), /Fixed Toman/);
  }
});
test("admin correction is atomic, retains the original quote, and requires customer acceptance", async () => {
  const initial = await approve(await submit());
  const original = initial.quote;
  const updated = await edit(initial);
  assert.deepEqual(updated.original_quote, original);
  assert.equal(updated.quote.funding_total, 870000000);
  assert.equal(updated.quote.recipient_amount, 4777.59);
  assert.equal(updated.pricing_pending_acceptance, true);
  assert.equal(updated.payment_approved_at, null);
  assert.equal(updated.version, initial.version + 1);
  assert.equal((await one("SELECT count(*) AS n FROM ledger WHERE transaction_id=$1", [initial.transaction_id])).n, 0);
  const audit = await one("SELECT * FROM audit_logs WHERE action='REQUEST_PRICING_REVISED' AND target_id=$1", [initial.id]);
  assert.deepEqual(audit.old_value.quote, original);
  assert.equal(audit.new_value.reason, "Customer requested a correction");
  await rejected(() => approve(updated), /must accept revised amounts/);
  const accepted = await accept(updated);
  assert.equal(accepted.pricing_pending_acceptance, false);
  assert.ok((await approve(accepted)).payment_approved_at);
  assert.deepEqual((await one("SELECT snapshot FROM exchange_request_quotes WHERE id=$1", [initial.quote_id])).snapshot, original);
});
test("correction retries commit once, conflicting versions and unauthorized actors fail", async () => {
  const r = await submit(), key = randomUUID();
  const changed = await edit(r, 870000000, 4777.59, ADMIN, key);
  assert.deepEqual(await edit(r, 870000000, 4777.59, ADMIN, key), changed);
  await rejected(() => edit(r, 870000001, 4777.59, ADMIN, key), /IDEMPOTENCY_CONFLICT/);
  await rejected(() => edit(r), /REQUEST_CONFLICT/);
  await rejected(() => edit(changed, 870000000, 4777.59, CUSTOMER), /Administrator required/);
  await rejected(() => accept(changed, OTHER), /Request unavailable/);
  assert.equal((await one("SELECT count(*) AS n FROM exchange_request_commands WHERE request_id=$1", [r.id])).n, 1);
});
test("audit failure rolls back the quote, transaction and command together", async () => {
  const r = await submit();
  await db.exec("SET LOCAL test.reject_audit='on'");
  await rejected(() => edit(r), /Synthetic audit unavailable/);
  assert.deepEqual((await one("SELECT quote FROM exchange_requests WHERE id=$1", [r.id])).quote, r.quote);
  assert.equal((await one("SELECT count(*) AS n FROM exchange_request_commands WHERE request_id=$1", [r.id])).n, 0);
});
test("payment evidence and cleared funds prevent a price rewrite", async () => {
  const r = await submit();
  await db.query("UPDATE exchange_requests SET evidence_submitted_at=now() WHERE id=$1", [r.id]);
  await rejected(() => edit(r), /Amounts are locked/);
  await db.query("UPDATE exchange_requests SET evidence_submitted_at=NULL,funding_received=100,funding_status='partial' WHERE id=$1", [r.id]);
  await rejected(() => edit(r), /Amounts are locked/);
});
test("selling AUD preserves a fixed Toman payout and can revise both sides before payment", async () => {
  await db.query("UPDATE recipients SET direction='irt',full_name='Synthetic Recipient' WHERE id=$1", [RECIPIENT]);
  const r = await submit({ txType: "sell_aud" });
  assert.equal(r.quote.recipient_amount, 870000000);
  assert.equal(r.quote.funding_total, 4764.51);
  const revised = await edit(r, 4777.59, 870000000);
  assert.equal(revised.quote.funding_total, 4777.59);
  assert.equal(revised.quote.recipient_amount, 870000000);
  assert.equal(Number((await one("SELECT amount_aud FROM transactions WHERE id=$1", [r.transaction_id])).amount_aud), 4777.59);
  assert.equal((await accept(revised)).pricing_pending_acceptance, false);
});
test("general customer replies cannot substitute for accepting revised financial terms", async () => {
  const revised = await edit(await submit());
  const replied = await rpc("SELECT transition_exchange_request($1,$2,$3,$4,'respond',$5) AS result",
    [CUSTOMER, revised.id, revised.version, randomUUID(), { message: "I have a question about these amounts" }]);
  assert.equal(replied.pricing_pending_acceptance, true);
  assert.equal(replied.customer_action_required, null);
  await rejected(() => approve(replied), /must accept revised amounts/);
  await rejected(() => db.query("UPDATE exchange_requests SET funding_status='confirmed',funding_received=870000000,status='ready' WHERE id=$1", [revised.id]), /must accept revised amounts/);
  await rejected(() => db.query("UPDATE exchange_requests SET evidence_submitted_at=now() WHERE id=$1", [revised.id]), /must accept revised amounts/);
  assert.ok((await approve(await accept(replied))).payment_approved_at);
});
test("cancellation closes revised pricing without fabricating customer acceptance", async () => {
  const revised = await edit(await submit());
  const cancelled = await rpc("SELECT transition_exchange_request($1,$2,$3,$4,'cancel',$5) AS result",
    [CUSTOMER, revised.id, revised.version, randomUUID(), { message: "I no longer need this transfer" }]);
  assert.equal(cancelled.status, "cancelled"); assert.equal(cancelled.pricing_pending_acceptance, false);
  assert.equal((await one("SELECT count(*) AS n FROM audit_logs WHERE target_id=$1 AND action='REQUEST_PRICING_ACCEPTED'", [revised.id])).n, 0);
  await rejected(() => accept(cancelled), /No pricing revision awaiting acceptance/);
});
test("multiple explicit revisions preserve the first accepted quote and audit each previous version", async () => {
  const original = await submit();
  const first = await edit(original);
  const second = await edit(first, 860000000, 4750);
  assert.deepEqual(second.original_quote, original.quote);
  assert.equal(second.quote.funding_total, 860000000);
  const audits = (await db.query("SELECT old_value FROM audit_logs WHERE action='REQUEST_PRICING_REVISED' AND target_id=$1", [original.id])).rows;
  assert.equal(audits.length, 2);
  assert.ok(audits.some(a => JSON.stringify(a.old_value.quote) === JSON.stringify(first.quote)));
  await rejected(() => accept(first), /REQUEST_CONFLICT/);
  assert.equal((await accept(second)).pricing_pending_acceptance, false);
});
test("pricing migration preserves optional institution references and applies safely twice", async () => {
  await db.exec(read("supabase/migrations/20261008_51_request_pricing_integrity.APPLY_MANUALLY.sql").replace(/^BEGIN;$/m, "").replace(/^COMMIT;$/m, ""));
  const r = await submit({ education: true });
  assert.equal(r.quote.invoice_reference, null); assert.equal(r.quote.funding_total, 870000000);
});
test("fixed budget and corrected quotes carry their exact amounts into payment, settlement and ledger", async () => {
  for (const corrected of [false, true]) {
    let r = await submit();
    if (corrected) r = await accept(await edit(r));
    const finalQuote = r.quote;
    r = await approve(r);
    r = await rpc("SELECT transition_exchange_request($1,$2,$3,$4,'confirm_funds',$5) AS result", [ADMIN, r.id, r.version, randomUUID(),
      { send_email: false, payment_reference: randomUUID(), received_amount: finalQuote.funding_total, received_currency: "IRT", receiver_account_id: IRT, date_jalali: "1405/07/16" }]);
    assert.equal(r.funding_status, "confirmed"); assert.equal(r.funding_received, finalQuote.funding_total);
    r = await rpc("SELECT transition_exchange_request($1,$2,$3,$4,'reconcile_complete',$5) AS result", [ADMIN, r.id, r.version, randomUUID(),
      { send_email: false, settlement_reference: randomUUID(), payer_account_id: AUD, receiver_account_id: IRT, transfer_method: "free", date_jalali: "1405/07/16" }]);
    assert.equal(r.status, "completed"); assert.deepEqual(r.quote, finalQuote);
    const ledger = await one("SELECT * FROM ledger WHERE transaction_id=$1 AND entry_type='trade'", [r.transaction_id]);
    assert.equal(Number(ledger.amount_toman), finalQuote.equivalent_toman);
    assert.equal(Number(ledger.amount_aud), finalQuote.raw_amount_aud);
    const receipt = (await one("SELECT snapshot FROM exchange_request_completion_receipts WHERE request_id=$1", [r.id])).snapshot;
    assert.equal(receipt.funding_total, finalQuote.funding_total); assert.equal(receipt.recipient_amount, finalQuote.recipient_amount);
  }
});
