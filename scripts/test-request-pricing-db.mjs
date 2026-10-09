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
async function submit({ currency = "IRT", amount = 870000000, rate = 182600, txType = "buy_aud", priority = 0, legacy = false, education = false, fee = 30 } = {}) {
  const money = calculateQuoteMoney({ currency, amount, rate, txType, config: { ...config, applied_fee: fee }, priorityFeeAud: priority });
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
const fundingPayload = (r, extra = {}) => ({ send_email: false, payment_reference: randomUUID(),
  received_amount: r.quote.funding_total, received_currency: r.quote.funding_currency,
  receiver_account_id: r.quote.funding_currency === "IRT" ? IRT : AUD, date_jalali: "1405/07/17", ...extra });
const confirm = (r, payload, key = randomUUID(), actor = ADMIN) => rpc(
  "SELECT confirm_exchange_request_funds($1,$2,$3,$4,$5) AS result", [actor, r.id, r.version, key, payload]);

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
    // Deliberately omit _43: _52 must also repair a missing accounting schema.
    "supabase/migrations/20261008_51_request_pricing_integrity.APPLY_MANUALLY.sql",
    "supabase/migrations/20261009_52_atomic_request_accounting_terms.APPLY_MANUALLY.sql",
    "supabase/migrations/20261009_53_non_retryable_request_conflicts.APPLY_MANUALLY.sql",
    "supabase/migrations/20261009_54_correct_recorded_request_funds.APPLY_MANUALLY.sql",
    "supabase/migrations/20261009_55_admin_final_transfer_amounts.APPLY_MANUALLY.sql",
    "supabase/migrations/20261009_56_repair_final_amount_confirmation.APPLY_MANUALLY.sql"]) await db.exec(read(file));
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

test("business conflicts return PT409 without changing the request or recording a command", async () => {
  const original = await submit();
  const approved = await approve(original);
  const key = randomUUID();
  const cases = [
    () => rpc("SELECT transition_exchange_request($1,$2,$3,$4,'await_funds',$5) AS result", [ADMIN, original.id, original.version, key, { send_email: false }]),
    () => rpc("SELECT transition_exchange_request_notification_core($1,$2,$3,$4,'await_funds',$5) AS result", [ADMIN, original.id, original.version, key, { send_email: false }]),
    () => confirm(original, fundingPayload(original), key),
    () => rpc("SELECT send_exchange_request_message($1,$2,$3,$4,$5,false) AS result", [CUSTOMER, original.id, original.version, key, "Synthetic stale message"]),
    () => edit(original),
    () => accept(original),
  ];
  for (const operation of cases) {
    await rejected(operation, { code: "PT409", message: "REQUEST_CONFLICT: Reload request" });
  }
  assert.equal((await one("SELECT version FROM exchange_requests WHERE id=$1", [original.id])).version, approved.version);
  assert.equal((await one("SELECT count(*) AS n FROM exchange_request_commands WHERE request_id=$1 AND command_key=$2", [original.id, key])).n, 0);
  assert.equal((await one("SELECT count(*) AS n FROM exchange_request_payments WHERE request_id=$1", [original.id])).n, 0);
  // Fresh explicit commands still work, and successful idempotent replays retain
  // their identity even after a later command has incremented the row version.
  const message = await rpc("SELECT send_exchange_request_message($1,$2,$3,$4,$5,false) AS result", [CUSTOMER, original.id, approved.version, key, "Fresh message"]);
  assert.ok(message);
  assert.deepEqual(await rpc("SELECT send_exchange_request_message($1,$2,$3,$4,$5,false) AS result", [CUSTOMER, original.id, approved.version, key, "Fresh message"]), message);
});

test("conflict patch is idempotent and preserves live function definitions and access controls", async () => {
  const definitions = () => db.query("SELECT oid::text, prosrc, prosecdef, proconfig, proacl::text FROM pg_proc WHERE pronamespace='public'::regnamespace AND prosrc LIKE '%REQUEST_CONFLICT: Reload%' ORDER BY oid");
  const before = (await definitions()).rows;
  assert.ok(before.length >= 5, "outer transition, inner core, settings, message and pricing guards are covered");
  for (const row of before) {
    assert.doesNotMatch(row.prosrc, /ERRCODE\s*=\s*'40001'/i);
    assert.match(row.prosrc, /ERRCODE\s*=\s*'PT409'/i);
  }
  await db.exec(read("supabase/migrations/20261009_53_non_retryable_request_conflicts.APPLY_MANUALLY.sql").replace(/^BEGIN;$/m, "").replace(/^COMMIT;$/m, ""));
  assert.deepEqual((await definitions()).rows, before);
  for (const role of ["anon", "authenticated"]) {
    assert.equal((await one("SELECT has_function_privilege($1,'transition_exchange_request(uuid,uuid,integer,uuid,text,jsonb)','EXECUTE') AS ok", [role])).ok, false);
  }
  assert.equal((await one("SELECT has_function_privilege('service_role','transition_exchange_request(uuid,uuid,integer,uuid,text,jsonb)','EXECUTE') AS ok")).ok, true);
  assert.equal((await one("SELECT has_function_privilege('service_role','transition_exchange_request_accounting_core(uuid,uuid,integer,uuid,text,jsonb)','EXECUTE') AS ok")).ok, false);
});

test("conflict patch changes only business errors, preserving genuine serialization failures", async () => {
  await db.exec(`CREATE FUNCTION public.test_request_conflict_scope(stale boolean) RETURNS void LANGUAGE plpgsql AS $$
    BEGIN
      IF stale THEN RAISE EXCEPTION 'REQUEST_CONFLICT: Reload request' USING ERRCODE='40001'; END IF;
      RAISE EXCEPTION 'Synthetic engine serialization failure' USING ERRCODE='40001';
    END; $$;`);
  await db.exec(read("supabase/migrations/20261009_53_non_retryable_request_conflicts.APPLY_MANUALLY.sql").replace(/^BEGIN;$/m, "").replace(/^COMMIT;$/m, ""));
  await rejected(() => db.query("SELECT test_request_conflict_scope(true)"), { code: "PT409" });
  await rejected(() => db.query("SELECT test_request_conflict_scope(false)"), { code: "40001" });
});

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

for (const txType of ["buy_aud", "sell_aud"]) for (const [oldFee, newFee] of [[0, 10], [10, 0]]) {
  test(`${txType}: accounting fee ${oldFee} -> ${newFee} commits with funds and reaches settlement without repricing`, async () => {
    if (txType === "sell_aud") await db.query("UPDATE recipients SET direction='irt',full_name='Synthetic Recipient' WHERE id=$1", [RECIPIENT]);
    const initial = await approve(await submit({ txType, currency: "AUD", amount: 500, fee: oldFee }));
    assert.equal(initial.quote.base_fee_aud, oldFee);
    const key = randomUUID(), payload = fundingPayload(initial, { accounting_fee_aud: newFee, accounting_rate: 184000 });
    const funded = await confirm(initial, payload, key);
    assert.equal(funded.funding_status, "confirmed");
    assert.equal(funded.version, initial.version + 1);
    assert.deepEqual(funded.quote, initial.quote);
    assert.deepEqual(funded.accounting_overrides, { applied_rate: 184000, base_fee_aud: newFee });
    const tx = await one("SELECT * FROM transactions WHERE id=$1", [initial.transaction_id]);
    assert.equal(Number(tx.ledger_fee_aud), newFee); assert.equal(Number(tx.applied_rate), 184000);
    assert.equal(Number(tx.amount_aud), initial.quote.raw_amount_aud); assert.equal(Number(tx.equivalent_toman), initial.quote.equivalent_toman);
    assert.deepEqual(await confirm(initial, payload, key), funded);
    await rejected(() => confirm(initial, { ...payload, accounting_fee_aud: oldFee }, key), /IDEMPOTENCY_CONFLICT/);
    await rejected(() => confirm(initial, payload), /REQUEST_CONFLICT/);
    assert.equal((await one("SELECT count(*) AS n FROM exchange_request_payments WHERE request_id=$1", [initial.id])).n, 1);
    assert.equal((await one("SELECT count(*) AS n FROM audit_logs WHERE target_id=$1 AND action='REQUEST_ACCOUNTING_TERMS_UPDATED'", [initial.id])).n, 1);
    assert.equal((await one("SELECT accounting_date_jalali FROM exchange_request_commands WHERE request_id=$1 AND command_key=$2", [initial.id, key])).accounting_date_jalali, payload.date_jalali);
    const completed = await rpc("SELECT transition_exchange_request($1,$2,$3,$4,'reconcile_complete',$5) AS result", [ADMIN, funded.id, funded.version, randomUUID(),
      { send_email: false, settlement_reference: randomUUID(), payer_account_id: txType === "buy_aud" ? AUD : IRT,
        receiver_account_id: txType === "buy_aud" ? IRT : AUD, transfer_method: "free", date_jalali: "1405/07/17" }]);
    assert.equal(completed.status, "completed"); assert.deepEqual(completed.quote, initial.quote);
    const ledger = await one("SELECT * FROM ledger WHERE transaction_id=$1 AND entry_type='trade'", [initial.transaction_id]);
    assert.equal(Number(ledger.fee_aud), newFee); assert.equal(Number(ledger.exchange_rate), 184000);
    assert.equal(Number(ledger.amount_aud), initial.quote.raw_amount_aud); assert.equal(Number(ledger.amount_toman), initial.quote.equivalent_toman);
    const receipt = (await one("SELECT snapshot FROM exchange_request_completion_receipts WHERE request_id=$1", [initial.id])).snapshot;
    assert.equal(receipt.funding_total, initial.quote.funding_total); assert.equal(receipt.recipient_amount, initial.quote.recipient_amount);
    // A retry after settlement returns its original result without rewriting approved transactions.
    assert.deepEqual(await confirm(initial, payload, key), funded);
  });
}

test("accounting write failure rolls back funds, state, notifications, audit and command together", async () => {
  const r = await approve(await submit()), payload = fundingPayload(r, { send_email: true, accounting_fee_aud: 10 });
  const snapshot = async () => ({
    request: await one("SELECT * FROM exchange_requests WHERE id=$1", [r.id]),
    transaction: await one("SELECT * FROM transactions WHERE id=$1", [r.transaction_id]),
    counts: await one(`SELECT (SELECT count(*) FROM exchange_request_payments) AS payments,
      (SELECT count(*) FROM exchange_request_commands) AS commands, (SELECT count(*) FROM audit_logs) AS audits,
      (SELECT count(*) FROM exchange_request_events) AS events, (SELECT count(*) FROM exchange_request_notification_deliveries) AS deliveries`),
  });
  const before = await snapshot();
  await db.exec(`CREATE FUNCTION test_accounting_write_failure() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Synthetic accounting write failure'; END; $$;
    CREATE TRIGGER test_accounting_write_failure BEFORE UPDATE OF ledger_fee_aud ON transactions
      FOR EACH ROW EXECUTE FUNCTION test_accounting_write_failure();`);
  const key = randomUUID();
  await rejected(() => confirm(r, payload, key), /Synthetic accounting write failure/);
  assert.deepEqual(await snapshot(), before);
  await db.exec("DROP TRIGGER test_accounting_write_failure ON transactions");
  assert.equal((await confirm(r, payload, key)).accounting_overrides.base_fee_aud, 10);
});

test("funding terms work with the original managed-transaction guard still installed", async () => {
  // Some deployments retain these guards; _35 removes them in newer schemas.
  const source = read("supabase/migrations/20260913_23_request_funding_and_receipts.sql");
  const start = source.indexOf("CREATE OR REPLACE FUNCTION public.guard_exchange_request_transaction()");
  await db.exec(source.slice(start, source.indexOf("$$;", start) + 3));
  await db.exec("CREATE TRIGGER guard_exchange_request_transaction BEFORE UPDATE OR DELETE ON transactions FOR EACH ROW EXECUTE FUNCTION guard_exchange_request_transaction()");
  const r = await approve(await submit());
  await rejected(() => db.query("UPDATE transactions SET ledger_fee_aud=10 WHERE id=$1", [r.transaction_id]), /REQUEST_MANAGED_TRANSACTION/);
  const funded = await confirm(r, fundingPayload(r, { accounting_fee_aud: 10 }));
  assert.equal(funded.accounting_overrides.base_fee_aud, 10);
  await rejected(() => db.query("UPDATE transactions SET ledger_fee_aud=0 WHERE id=$1", [r.transaction_id]), /REQUEST_MANAGED_TRANSACTION/);
});

test("atomic accounting terms reject invalid input and unauthorized callers before recording funds", async () => {
  const r = await approve(await submit());
  for (const invalid of [{ accounting_fee_aud: -1 }, { accounting_fee_aud: 0.001 }, { accounting_fee_aud: 100001 },
    { accounting_fee_aud: "0" }, { accounting_fee_aud: null }, { accounting_rate: 0 }, { accounting_rate: -1 },
    { accounting_rate: 100000001 }, { accounting_rate: "184000" }, { accounting_rate: null }]) {
    await rejected(() => confirm(r, fundingPayload(r, invalid)), /Enter a valid/);
  }
  await rejected(() => confirm(r, fundingPayload(r, { accounting_fee_aud: 0 }), randomUUID(), CUSTOMER), /Administrator required/);
  assert.equal((await one("SELECT count(*) AS n FROM exchange_request_payments WHERE request_id=$1", [r.id])).n, 0);
  for (const role of ["anon", "authenticated", "service_role"]) {
    const grant = await one("SELECT has_function_privilege($1,'public.confirm_exchange_request_funds(uuid,uuid,integer,uuid,jsonb)','EXECUTE') AS allowed", [role]);
    assert.equal(grant.allowed, role === "service_role");
  }
});

test("partial deposits preserve omitted accounting terms and can explicitly return to the accepted fee", async () => {
  const r = await approve(await submit({ currency: "AUD", amount: 500, fee: 10 }));
  const part = r.quote.funding_total / 4;
  const first = await confirm(r, fundingPayload(r, { received_amount: part, accounting_fee_aud: 0, accounting_rate: 184000 }));
  const second = await confirm(first, fundingPayload(first, { received_amount: part, accounting_rate: 183000 }));
  assert.deepEqual(second.accounting_overrides, { applied_rate: 183000, base_fee_aud: 0 });
  const third = await confirm(second, fundingPayload(second, { received_amount: part }));
  assert.deepEqual(third.accounting_overrides, second.accounting_overrides);
  const final = await confirm(third, fundingPayload(third, { received_amount: part, accounting_rate: r.quote.applied_rate, accounting_fee_aud: 10 }));
  assert.equal(final.funding_status, "confirmed");
  assert.deepEqual(final.accounting_overrides, { applied_rate: r.quote.applied_rate, base_fee_aud: 10 });
  assert.equal(Number((await one("SELECT ledger_fee_aud FROM transactions WHERE id=$1", [r.transaction_id])).ledger_fee_aud), 10);
});

test("unchanged accounting terms create no override and the migration can be reapplied", async () => {
  await db.exec(read("supabase/migrations/20261009_52_atomic_request_accounting_terms.APPLY_MANUALLY.sql").replace(/^BEGIN;$/m, "").replace(/^COMMIT;$/m, ""));
  const r = await approve(await submit());
  const funded = await confirm(r, fundingPayload(r, { accounting_fee_aud: r.quote.base_fee_aud, accounting_rate: r.quote.applied_rate }));
  assert.equal(funded.accounting_overrides, null);
  assert.equal(funded.funding_status, "confirmed");
  assert.equal((await one("SELECT count(*) AS n FROM audit_logs WHERE target_id=$1 AND action='REQUEST_ACCOUNTING_TERMS_UPDATED'", [r.id])).n, 0);
});

const correctDeposits = (r, corrections, key = randomUUID(), actor = ADMIN) => rpc(
  "SELECT correct_exchange_request_funds($1,$2,$3,$4,$5) AS result", [actor, r.id, r.version, key,
    { payment_corrections: corrections, message: "Second record replaces the mistaken first entry", send_email: false, date_jalali: "1405/07/17" }]);

test("deposit correction: a duplicate is excluded once and immediately reaches settlement without another deposit", async () => {
  let r = await approve(await submit({ currency: "AUD", amount: 4000, rate: 181740, fee: 0 }));
  const expected = r.quote.funding_total;
  r = await confirm(r, fundingPayload(r, { received_amount: expected + 5000, accounting_fee_aud: 20 }));
  const first = await one("SELECT id FROM exchange_request_payments WHERE request_id=$1", [r.id]);
  r = await confirm(r, fundingPayload(r));
  assert.equal(r.funding_received, expected * 2 + 5000);
  assert.equal(r.status, "action_required");
  const key = randomUUID(), correction = [{ payment_id: first.id, amount: 0 }];
  const fixed = await correctDeposits(r, correction, key);
  assert.equal(fixed.status, "ready"); assert.equal(fixed.funding_status, "confirmed");
  assert.equal(fixed.funding_received, expected); assert.equal(fixed.version, r.version + 1);
  assert.equal(fixed.action_required, null); assert.deepEqual(fixed.quote, r.quote);
  assert.deepEqual(fixed.accounting_overrides, r.accounting_overrides);
  assert.equal((await one("SELECT count(*) AS n FROM exchange_request_payments WHERE request_id=$1", [r.id])).n, 2);
  assert.equal((await one("SELECT count(*) AS n FROM exchange_request_effective_payments WHERE request_id=$1", [r.id])).n, 1);
  assert.equal((await one("SELECT excluded FROM exchange_request_current_payments WHERE id=$1", [first.id])).excluded, true);
  assert.equal((await one("SELECT count(*) AS n FROM exchange_request_tasks WHERE request_id=$1 AND kind='funding_discrepancy' AND status='open'", [r.id])).n, 0);
  assert.deepEqual(await correctDeposits(r, correction, key), fixed);
  await rejected(() => correctDeposits(r, correction), /REQUEST_CONFLICT/);
  assert.equal((await one("SELECT count(*) AS n FROM exchange_request_payment_corrections WHERE request_id=$1", [r.id])).n, 1);
  const completed = await rpc("SELECT transition_exchange_request($1,$2,$3,$4,'reconcile_complete',$5) AS result", [ADMIN, r.id, fixed.version, randomUUID(),
    { send_email: false, settlement_reference: randomUUID(), payer_account_id: AUD, receiver_account_id: IRT, transfer_method: "free", date_jalali: "1405/07/17" }]);
  assert.equal(completed.status, "completed");
  assert.equal(Number((await one("SELECT fee_aud FROM ledger WHERE transaction_id=$1 AND entry_type='trade'", [r.transaction_id])).fee_aud), 20);
  await rejected(() => correctDeposits(completed, [{ payment_id: first.id, amount: 1 }]), /before settlement/);
});

test("deposit correction: amount edits preserve originals and partial totals count only corrected funds", async () => {
  let r = await approve(await submit());
  const expected = r.quote.funding_total;
  r = await confirm(r, fundingPayload(r, { received_amount: expected + 5000 }));
  const payment = await one("SELECT id,amount FROM exchange_request_payments WHERE request_id=$1", [r.id]);
  r = await correctDeposits(r, [{ payment_id: payment.id, amount: expected / 2 }]);
  assert.equal(r.status, "awaiting_funds"); assert.equal(r.funding_received, expected / 2);
  assert.equal(Number((await one("SELECT amount FROM exchange_request_payments WHERE id=$1", [payment.id])).amount), Number(payment.amount));
  assert.equal(Number((await one("SELECT amount FROM exchange_request_current_payments WHERE id=$1", [payment.id])).amount), expected / 2);
  r = await confirm(r, fundingPayload(r, { received_amount: expected / 2 }));
  assert.equal(r.status, "ready"); assert.equal(r.funding_received, expected);
});

test("deposit correction: invalid totals, unauthorized actors and failed release roll back every correction", async () => {
  let r = await approve(await submit());
  r = await confirm(r, fundingPayload(r, { received_amount: r.quote.funding_total + 5000 }));
  const payment = await one("SELECT id FROM exchange_request_payments WHERE request_id=$1", [r.id]);
  const correction = [{ payment_id: payment.id, amount: r.quote.funding_total }];
  await rejected(() => correctDeposits(r, correction, randomUUID(), CUSTOMER), /Administrator required/);
  await rejected(() => correctDeposits(r, [{ payment_id: payment.id, amount: r.quote.funding_total + 1 }]), /no more than/);
  await rejected(() => correctDeposits(r, [{ payment_id: payment.id, amount: 0 }]), /more than zero/);
  await rejected(() => correctDeposits(r, [{ payment_id: payment.id, amount: 1.5 }]), /whole Toman/);
  await rejected(() => correctDeposits(r, [{ payment_id: randomUUID(), amount: 1 }]), /unavailable/);
  await db.query("UPDATE profiles SET kyc_status='pending' WHERE id=$1", [CUSTOMER]);
  await rejected(() => correctDeposits(r, correction), /identity approval/);
  assert.equal((await one("SELECT count(*) AS n FROM exchange_request_payment_corrections WHERE request_id=$1", [r.id])).n, 0);
  assert.equal((await one("SELECT funding_received::float8 AS total,version FROM exchange_requests WHERE id=$1", [r.id])).total, r.funding_received);
  assert.equal((await one("SELECT version FROM exchange_requests WHERE id=$1", [r.id])).version, r.version);
  assert.equal((await one("SELECT count(*) AS n FROM audit_logs WHERE target_id=$1 AND action='REQUEST_FUNDS_CORRECTED'", [r.id])).n, 0);
});

test("deposit correction: a corrected Priority deposit is released and accounted exactly once", async () => {
  let r = await approve(await submit({ priority: 25 }));
  r = await confirm(r, fundingPayload(r, { received_amount: r.quote.funding_total + 5000 }));
  const payment = await one("SELECT id FROM exchange_request_payments WHERE request_id=$1", [r.id]);
  const key = randomUUID(), correction = [{ payment_id: payment.id, amount: r.quote.funding_total }];
  const fixed = await correctDeposits(r, correction, key);
  assert.equal(fixed.status, "ready"); assert.equal(fixed.priority_fee_status, "paid");
  assert.deepEqual(await correctDeposits(r, correction, key), fixed);
  assert.equal((await one("SELECT count(*) AS n FROM exchange_request_fee_entries WHERE request_id=$1", [r.id])).n, 1);
  assert.equal((await one("SELECT count(*) AS n FROM ledger WHERE request_fee_entry_id IN (SELECT id FROM exchange_request_fee_entries WHERE request_id=$1)", [r.id])).n, 1);
  await db.exec(read("supabase/migrations/20261009_54_correct_recorded_request_funds.APPLY_MANUALLY.sql").replace(/^BEGIN;$/m, "").replace(/^COMMIT;$/m, ""));
  assert.deepEqual(await correctDeposits(r, correction, key), fixed);
});

const finalizeFunds = (r, funding, recipient = r.quote.recipient_amount, { key = randomUUID(), actor = ADMIN, fee = 0, rate = 181740, account = r.quote.funding_currency === "IRT" ? IRT : AUD } = {}) => rpc(
  "SELECT finalize_exchange_request_funds($1,$2,$3,$4,$5) AS result", [actor, r.id, r.version, key,
    { final_funding_total: funding, final_recipient_amount: recipient, receiver_account_id: account, accounting_fee_aud: fee, accounting_rate: rate, send_email: false, date_jalali: "1405/07/17" }]);

for (const direction of ["buy_aud", "sell_aud"]) test(
  "final amounts: " + direction + " accepts higher and lower replacements through settlement and invoice", async () => {
  if (direction === "sell_aud") await db.query("UPDATE recipients SET direction='irt',full_name='Synthetic Recipient' WHERE id=$1", [RECIPIENT]);
  for (const multiplier of [.99, 1.01]) {
    const original = await approve(await submit({ txType: direction, currency: "AUD", amount: 3500, rate: 181740, fee: 0 }));
    const funding = direction === "buy_aud" ? (multiplier < 1 ? 630000000 : 637000000) : 3500 * multiplier;
    const recipient = direction === "buy_aud" ? 3500 + (multiplier < 1 ? -50 : 50) : Math.round(original.quote.recipient_amount * multiplier);
    const key = randomUUID(), fee = multiplier < 1 ? 0 : 10;
    const finalized = await finalizeFunds(original, funding, recipient, { key, fee });
    assert.equal(finalized.status, "ready"); assert.equal(finalized.funding_status, "confirmed");
    assert.equal(finalized.funding_received, funding); assert.equal(finalized.quote.funding_total, funding);
    assert.equal(finalized.quote.recipient_amount, recipient); assert.equal(finalized.version, original.version + 1);
    assert.deepEqual(finalized.original_quote, original.quote); assert.equal(finalized.pricing_pending_acceptance, false);
    assert.equal(finalized.customer_action_required, null); assert.equal(finalized.action_required, null);
    assert.deepEqual(await finalizeFunds(original, funding, recipient, { key, fee }), finalized);
    assert.equal((await one("SELECT count(*) AS n FROM exchange_request_effective_payments WHERE request_id=$1", [original.id])).n, 1);
    const completed = await rpc("SELECT transition_exchange_request($1,$2,$3,$4,'reconcile_complete',$5) AS result", [ADMIN, original.id, finalized.version, randomUUID(),
      { send_email: false, settlement_reference: randomUUID(), payer_account_id: direction === "buy_aud" ? AUD : IRT,
        receiver_account_id: direction === "buy_aud" ? IRT : AUD, transfer_method: "free", date_jalali: "1405/07/17" }]);
    assert.equal(completed.status, "completed");
    const receipt = (await one("SELECT snapshot FROM exchange_request_completion_receipts WHERE request_id=$1", [original.id])).snapshot;
    assert.equal(receipt.funding_total, funding); assert.equal(receipt.recipient_amount, recipient);
    const ledger = await one("SELECT * FROM ledger WHERE transaction_id=$1 AND entry_type='trade'", [original.transaction_id]);
    assert.equal(Number(ledger.amount_aud), finalized.quote.raw_amount_aud);
    assert.equal(Number(ledger.amount_toman), finalized.quote.equivalent_toman);
    assert.equal(Number(ledger.fee_aud), fee); assert.equal(Number(ledger.exchange_rate), 181740);
    await rejected(() => finalizeFunds(completed, funding, recipient), /before settlement/);
    assert.deepEqual(await finalizeFunds(original, funding, recipient, { key, fee }), finalized);
  }
});

test("final amounts: existing duplicate deposits become one replacement total, not another addition", async () => {
  let r = await approve(await submit({ amount: 639090000, currency: "IRT", fee: 0 }));
  r = await confirm(r, fundingPayload(r, { received_amount: 650000000 }));
  r = await confirm(r, fundingPayload(r, { received_amount: 637000000 }));
  const originalRows = (await db.query("SELECT id,amount FROM exchange_request_payments WHERE request_id=$1 ORDER BY id", [r.id])).rows;
  const key = randomUUID();
  const ready = await finalizeFunds(r, 637000000, r.quote.recipient_amount, { key });
  assert.equal(ready.status, "ready"); assert.equal(ready.quote.funding_total, 637000000);
  assert.equal(ready.funding_received, 637000000); assert.equal(ready.quote.recipient_amount, r.quote.recipient_amount);
  assert.deepEqual((await db.query("SELECT id,amount FROM exchange_request_payments WHERE request_id=$1 ORDER BY id", [r.id])).rows, originalRows);
  assert.equal(Number((await one("SELECT sum(amount) AS total FROM exchange_request_effective_payments WHERE request_id=$1", [r.id])).total), 637000000);
  assert.deepEqual(await finalizeFunds(r, 637000000, r.quote.recipient_amount, { key }), ready);
  await rejected(() => finalizeFunds(r, 637000000), /REQUEST_CONFLICT/);
  await rejected(() => finalizeFunds(r, 638000000, r.quote.recipient_amount, { key }), /IDEMPOTENCY_CONFLICT/);
});

test("final amounts: validation and failed authorization roll back final pricing and deposit records", async () => {
  const r = await approve(await submit());
  await rejected(() => finalizeFunds(r, 637000000, r.quote.recipient_amount, { actor: CUSTOMER }), /Administrator required/);
  await rejected(() => finalizeFunds(r, 0), /positive final/);
  await rejected(() => finalizeFunds(r, 637000000.5), /whole Toman/);
  await rejected(() => finalizeFunds(r, 637000000, 100000), /service limits/);
  await rejected(() => finalizeFunds(r, 637000000, r.quote.recipient_amount, { account: AUD }), /account that received/);
  await db.query("UPDATE profiles SET kyc_status='pending' WHERE id=$1", [CUSTOMER]);
  await rejected(() => finalizeFunds(r, 637000000), /identity approval/);
  const current = await one("SELECT quote,version,funding_received FROM exchange_requests WHERE id=$1", [r.id]);
  assert.deepEqual(current.quote, r.quote); assert.equal(current.version, r.version); assert.equal(Number(current.funding_received), 0);
  assert.equal((await one("SELECT count(*) AS n FROM exchange_request_payments WHERE request_id=$1", [r.id])).n, 0);
  assert.equal((await one("SELECT count(*) AS n FROM exchange_request_payment_corrections WHERE request_id=$1", [r.id])).n, 0);
});

test("final amounts: Priority fees and late approvals are finalized once without a second review", async () => {
  const r = await approve(await submit({ priority: 25 }));
  await db.query("UPDATE exchange_requests SET clearance_due_at=now()-interval '1 minute' WHERE id=$1", [r.id]);
  const key = randomUUID(), funding = r.quote.funding_total - 1000000;
  const finalized = await finalizeFunds(r, funding, r.quote.recipient_amount, { key });
  assert.equal(finalized.status, "ready"); assert.equal(finalized.priority_fee_status, "paid");
  assert.equal(finalized.quote.funding_total, funding);
  assert.deepEqual(await finalizeFunds(r, funding, r.quote.recipient_amount, { key }), finalized);
  assert.equal((await one("SELECT count(*) AS n FROM exchange_request_fee_entries WHERE request_id=$1", [r.id])).n, 1);
  assert.equal((await one("SELECT count(*) AS n FROM exchange_request_effective_payments WHERE request_id=$1", [r.id])).n, 1);
});


test("final amounts: missing pricing columns reproduce the live failure and repair permits unchanged confirmation", async () => {
  const r = await approve(await submit({ currency: "AUD", amount: 4235, rate: 181740, fee: 0 }));
  assert.equal(r.quote.funding_total, 769668900);
  // Reproduce the production schema: 52–55 installed without optional 51.
  await db.exec("DROP TRIGGER IF EXISTS guard_pending_request_pricing ON exchange_requests; ALTER TABLE exchange_requests DROP COLUMN original_quote, DROP COLUMN pricing_pending_acceptance;");
  await rejected(() => finalizeFunds(r, r.quote.funding_total, r.quote.recipient_amount), { code: "42703" });
  assert.equal((await one("SELECT count(*) AS n FROM exchange_request_payments WHERE request_id=$1", [r.id])).n, 0);
  const repair = read("supabase/migrations/20261009_56_repair_final_amount_confirmation.APPLY_MANUALLY.sql").replace(/^BEGIN;$/m, "").replace(/^COMMIT;$/m, "");
  await db.exec(repair); await db.exec(repair);
  const key = randomUUID(), ready = await finalizeFunds(r, r.quote.funding_total, r.quote.recipient_amount, { key });
  assert.equal(ready.status, "ready"); assert.equal(ready.funding_received, 769668900);
  assert.equal(ready.quote.recipient_amount, 4235); assert.deepEqual(ready.quote, r.quote);
  assert.deepEqual(await finalizeFunds(r, r.quote.funding_total, r.quote.recipient_amount, { key }), ready);
  assert.equal((await one("SELECT count(*) AS n FROM exchange_request_effective_payments WHERE request_id=$1", [r.id])).n, 1);
  for (const role of ["anon", "authenticated"]) assert.equal((await one("SELECT has_function_privilege($1,'finalize_exchange_request_funds(uuid,uuid,integer,uuid,jsonb)','EXECUTE') AS ok", [role])).ok, false);
});

test("final amounts: changing only zero fee or rate preserves both amounts and replaces accounting terms", async () => {
  let r = await approve(await submit({ currency: "AUD", amount: 4235, rate: 181740, fee: 0 }));
  const funding = r.quote.funding_total, recipient = r.quote.recipient_amount;
  for (const [fee, rate] of [[20, 184000], [0, 181740]]) {
    r = await finalizeFunds(r, funding, recipient, { fee, rate });
    assert.equal(r.status, "ready"); assert.equal(r.quote.funding_total, funding); assert.equal(r.quote.recipient_amount, recipient);
    assert.equal(Number(r.accounting_overrides.base_fee_aud), fee); assert.equal(Number(r.accounting_overrides.applied_rate), rate);
    const tx = await one("SELECT applied_rate,ledger_fee_aud FROM transactions WHERE id=$1", [r.transaction_id]);
    assert.equal(Number(tx.applied_rate), rate); assert.equal(Number(tx.ledger_fee_aud), fee);
    assert.equal((await one("SELECT count(*) AS n FROM exchange_request_effective_payments WHERE request_id=$1", [r.id])).n, 1);
  }
});

test("final amounts: a legacy revised quote needs only the admin final confirmation", async () => {
  const r = await edit(await approve(await submit()), 637000000, 3500);
  assert.equal(r.pricing_pending_acceptance, true); assert.equal(r.payment_approved_at, null);
  const ready = await finalizeFunds(r, 637000000, 3500);
  assert.equal(ready.status, "ready"); assert.equal(ready.pricing_pending_acceptance, false);
  assert.ok(ready.payment_approved_at); assert.equal(ready.customer_action_required, null);
});
