// Funds received, finance release and explicit customer questions are separate
// facts. Exercise real migrations in PGlite only; no network or live credentials.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { before, after, beforeEach, afterEach, describe, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const CUSTOMER = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';
const ADMIN = '00000000-0000-4000-8000-000000000003';
const AUD = '10000000-0000-4000-8000-000000000001';
const IRT = '10000000-0000-4000-8000-000000000002';
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
let db, legacyMixed, legacyQuestion, legacyAnswered, legacyCompleted, legacySnapshots, legacySettings;
const query = (sql, params = []) => db.query(sql, params);
const one = async (sql, params = []) => (await query(sql, params)).rows[0];
const rpc = async (sql, params = []) => (await one(sql, params)).result;
const get = id => one('SELECT * FROM exchange_requests WHERE id=$1', [id]);
const count = async (table, id) => Number((await one(`SELECT count(*) AS n FROM ${table} WHERE request_id=$1`, [id])).n);
const command = (r, action, payload = {}, actor = ADMIN, key = randomUUID()) => rpc(
  'SELECT transition_exchange_request($1,$2,$3,$4,$5,$6) AS result',
  [actor, r.id, r.version, key, action, { send_email: false, date_jalali: '1405/06/24', ...payload }]);
const message = (r, body = 'Customer message', actor = CUSTOMER, key = randomUUID(), email = false) => rpc(
  'SELECT send_exchange_request_message($1,$2,$3,$4,$5,$6) AS result', [actor, r.id, r.version, key, body, email]);
const funding = (r, currency = r.quote.funding_currency, amount = Number(r.quote.funding_total)) => ({
  payment_reference: randomUUID(), received_amount: amount, received_currency: currency, receiver_account_id: currency === 'AUD' ? AUD : IRT,
});
const settlement = r => ({ settlement_reference: randomUUID(), payer_account_id: r.quote.recipient_currency === 'AUD' ? AUD : IRT,
  receiver_account_id: r.quote.funding_currency === 'AUD' ? AUD : IRT, transfer_method: 'free' });
async function submit(currency = 'IRT', tier = 'standard') {
  const policy = await one('SELECT version,settings FROM exchange_request_settings WHERE id');
  const priority = tier === 'priority' ? 20 : 0, rate = 105000, amount = 2235;
  const snapshot = { raw_amount_aud: amount, equivalent_toman: amount * rate, applied_rate: rate, base_fee_aud: 0,
    priority_fee_aud: priority, priority_fee_amount: currency === 'AUD' ? priority : priority * rate,
    funding_currency: currency, funding_total: currency === 'AUD' ? amount + priority : (amount + priority) * rate,
    recipient_amount: currency === 'AUD' ? amount * rate : amount, recipient_currency: currency === 'AUD' ? 'IRT' : 'AUD',
    service_tier: tier, locale: 'fa', customer_request_type: currency === 'AUD' ? 'sell_aud' : 'buy_aud',
    company_trade_type: currency === 'AUD' ? 'buy_aud' : 'sell_aud', source_of_funds: 'Synthetic savings', reason_for_transfer: 'Synthetic test',
    recipient_id: null, recipient_snapshot: { full_name: 'Synthetic recipient' }, sender_snapshot: { name: 'Synthetic customer' },
    payment_link: 'https://example.invalid/invoice', institution_name: 'Synthetic school', invoice_reference: randomUUID(),
    policy_version: policy.version, policy_snapshot: policy.settings };
  const quote = await one("INSERT INTO exchange_request_quotes(user_id,snapshot,expires_at) VALUES($1,$2,now()+interval '10 minutes') RETURNING id", [CUSTOMER, snapshot]);
  return rpc('SELECT submit_exchange_request($1,$2,$3) AS result', [CUSTOMER, quote.id, randomUUID()]);
}
async function mixed(tier = 'standard') {
  let r = await command(await submit('IRT', tier), 'await_funds');
  r = await command(r, 'confirm_funds', funding(r, 'AUD', 2235));
  return command(r, 'confirm_funds', funding(r));
}
async function rejects(work, pattern) {
  await db.exec('SAVEPOINT expected_failure');
  await assert.rejects(work, pattern);
  await db.exec('ROLLBACK TO SAVEPOINT expected_failure');
}
async function frozen(id) {
  return (await one(`SELECT jsonb_build_object(
    'identity',(SELECT jsonb_build_object('quote',quote,'reference',reference_code,'transaction',transaction_id) FROM exchange_requests WHERE id=$1),
    'payments',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM exchange_request_payments x WHERE request_id=$1),
    'commands',(SELECT jsonb_agg(to_jsonb(x) ORDER BY command_key) FROM exchange_request_commands x WHERE request_id=$1),
    'events',(SELECT jsonb_agg(to_jsonb(x) ORDER BY sequence) FROM exchange_request_events x WHERE request_id=$1),
    'deliveries',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM exchange_request_notification_deliveries x WHERE request_id=$1),
    'receipts',(SELECT jsonb_agg(to_jsonb(x)) FROM exchange_request_completion_receipts x WHERE request_id=$1)) AS value`, [id])).value;
}

describe('received funds and explicit customer action boundaries', { concurrency: false }, () => {
  before(async () => {
    db = new PGlite();
    for (const file of ['scripts/fixtures/customer-requests.sql',
      'supabase/migrations/20260802_09_enterprise_reporting.sql',
      'supabase/migrations/20260802_10_ledger_accounting_controls.sql',
      'supabase/migrations/20260802_13_standardize_trade_fee_accounting.sql',
      'supabase/migrations/20260911_18_customer_requests.sql',
      'supabase/migrations/20260911_19_request_notifications.sql',
      'supabase/migrations/20260913_23_request_funding_and_receipts.sql',
      'supabase/migrations/20260913_24_request_receipt_notifications.sql',
      'supabase/migrations/20260913_25_request_fee_accounting.sql',
      'supabase/migrations/20260913_26_request_fee_ledger_type.sql',
      'supabase/migrations/20260913_27_request_messages_and_notifications.sql',
      'supabase/migrations/20260913_28_request_bank_details.sql',
      'supabase/migrations/20260915_29_request_payment_approval.sql']) await db.exec(read(file));
    await query("INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES($1,'customer@example.invalid','{}'),($2,'other@example.invalid','{}'),($3,'admin@example.invalid','{\"role\":\"admin\"}')", [CUSTOMER, OTHER, ADMIN]);
    await query("INSERT INTO profiles(id,email,kyc_status) SELECT id,email,'approved' FROM auth.users");
    await query("INSERT INTO bank_accounts(id,account_name,currency) VALUES($1,'Synthetic AUD','AUD'),($2,'Synthetic IRT','IRT')", [AUD, IRT]);
    await query('INSERT INTO rates_history(date,buy_aud,sell_aud) VALUES(current_date,105000,105000)');
    await query('UPDATE exchange_request_settings SET settings=settings||$1::jsonb', [{ enabled: true, priority_enabled: true,
      priority_fee_aud: 20, priority_capacity: 10, management_emails: ['management@example.invalid'],
      payment_details_aud: { account_name: 'Synthetic AUD', bsb: '000-001', account_number: '00123456' },
      payment_details_irt: { account_name: 'Synthetic IRT', account_number: '12345678' },
      payment_instructions_aud: 'Synthetic account', payment_instructions_irt: 'Synthetic account',
      priority_terms: 'Synthetic terms', priority_terms_fa: 'Synthetic terms', business_days: [0, 1, 2, 3, 4, 5, 6], opening_hour: 0, closing_hour: 24 }]);
    legacyMixed = await mixed();
    assert.equal(legacyMixed.funding_status, 'partial');
    await message(legacyMixed, 'Already paid the full amount');
    legacyMixed = await get(legacyMixed.id); assert.equal(legacyMixed.status, 'under_review');
    legacyQuestion = await command(await submit(), 'request_info', { message: 'Please confirm the recipient name.' });
    legacyAnswered = await command(await submit(), 'request_info', { message: 'Please confirm the purpose.' });
    await message(legacyAnswered, 'Synthetic education expense'); legacyAnswered = await get(legacyAnswered.id);
    legacyCompleted = await command(await submit('AUD'), 'await_funds');
    legacyCompleted = await command(legacyCompleted, 'confirm_funds', funding(legacyCompleted));
    legacyCompleted = await command(legacyCompleted, 'reconcile_complete', settlement(legacyCompleted));
    legacySnapshots = await Promise.all([legacyMixed, legacyQuestion, legacyAnswered, legacyCompleted].map(r => frozen(r.id)));
    legacySettings = await one('SELECT * FROM exchange_request_settings WHERE id');
    await db.exec(read('supabase/migrations/20260915_30_request_customer_actions_and_received_funds.sql'));
  });
  after(async () => db?.close());
  beforeEach(async () => db.exec('BEGIN'));
  afterEach(async () => db.exec('ROLLBACK'));

  test('backfill repairs exact received-funds facts using original payment time without rewriting history', async () => {
    const r = await get(legacyMixed.id);
    const payment = await one("SELECT created_at FROM exchange_request_payments WHERE request_id=$1 AND currency='IRT'", [r.id]);
    assert.equal(r.funding_status, 'confirmed'); assert.equal(Number(r.funding_received), 234675000);
    assert.equal(new Date(r.funds_confirmed_at).getTime(), new Date(payment.created_at).getTime());
    assert.equal(r.status, 'under_review'); assert.equal(r.ready_at, null); assert.equal(r.handling_due_at, null);
    assert.equal(r.customer_action_required, null); assert.equal(r.version, legacyMixed.version + 1);
    assert.equal(await count('exchange_request_payments', r.id), 2);
    assert.deepEqual(await Promise.all([legacyMixed, legacyQuestion, legacyAnswered, legacyCompleted].map(row => frozen(row.id))), legacySnapshots);
    assert.deepEqual(await one('SELECT * FROM exchange_request_settings WHERE id'), legacySettings);
    const audit = await one("SELECT old_value,new_value FROM audit_logs WHERE target_id=$1 AND action='REQUEST_RECEIVED_FUNDS_FACTS_BACKFILL'", [r.id]);
    assert.equal(audit.old_value.funding_status, 'partial'); assert.equal(audit.new_value.funding_status, 'confirmed');
  });

  test('backfill keeps only unanswered explicit questions and does not reopen completed approvals', async () => {
    assert.equal((await get(legacyQuestion.id)).customer_action_required, 'Please confirm the recipient name.');
    assert.equal((await get(legacyAnswered.id)).customer_action_required, null);
    assert.equal((await get(legacyCompleted.id)).customer_action_required, null);
    assert.equal((await get(legacyCompleted.id)).version, legacyCompleted.version);
  });

  test('exact IRT funding becomes received despite extra AUD, while finance and payout remain blocked', async () => {
    let r = await command(await submit(), 'await_funds');
    r = await command(r, 'confirm_funds', funding(r, 'AUD', 2235));
    const before = r, payload = funding(r), key = randomUUID();
    r = await command(before, 'confirm_funds', payload, ADMIN, key);
    assert.equal(r.status, 'action_required'); assert.equal(r.funding_status, 'confirmed'); assert.ok(r.funds_confirmed_at);
    assert.equal(r.customer_action_required, null); assert.equal(r.ready_at, null); assert.equal(r.handling_due_at, null);
    assert.equal(Number(r.funding_received), Number(r.quote.funding_total));
    assert.deepEqual(await command(before, 'confirm_funds', payload, ADMIN, key), r);
    assert.equal(await count('exchange_request_payments', r.id), 2);
    await rejects(() => command(r, 'resume_funded_request', { honour_quote: true }), /Only reconciled fully funded/);
    await rejects(() => command(r, 'reconcile_complete', settlement(r)), /Confirmed funds are required/);
    await rejects(() => command(r, 'start_processing'), /Request is not ready/);
    await rejects(() => command(r, 'await_funds'), /current unpaid request/);
    assert.equal(await count('exchange_request_executions', r.id), 0); assert.equal(await count('exchange_request_completion_receipts', r.id), 0);
    const latest = await one("SELECT payload_snapshot FROM exchange_request_notification_deliveries WHERE request_id=$1 AND event_type='funds_recorded' ORDER BY event_sequence DESC LIMIT 1", [r.id]);
    assert.equal(new Date(latest.payload_snapshot.funds_confirmed_at).getTime(), new Date(r.funds_confirmed_at).getTime());
    assert.equal(latest.payload_snapshot.customer_action_required, null);
  });

  test('ordinary customer messages never dismiss internal finance holds or create a response step', async () => {
    const r = await mixed(), key = randomUUID();
    const result = await message(r, 'Thank you; please update me.', CUSTOMER, key);
    assert.equal(result.message.sender_role, 'customer');
    assert.deepEqual(await message(r, 'Thank you; please update me.', CUSTOMER, key), result);
    const after = await get(r.id);
    assert.equal(after.status, r.status); assert.equal(after.action_required, r.action_required);
    assert.equal(after.funding_status, 'confirmed'); assert.equal(after.customer_action_required, null);
    assert.equal(new Date(after.funds_confirmed_at).getTime(), new Date(r.funds_confirmed_at).getTime());
    const event = await one('SELECT event_type FROM exchange_request_events WHERE id=$1', [result.message.event_id]);
    assert.equal(event.event_type, 'customer_message');
    assert.equal((await query('SELECT audience FROM exchange_request_notification_deliveries WHERE event_id=$1', [result.message.event_id])).rows.length, 1);
    await rejects(() => command(after, 'respond', { message: 'Unrequested response' }, CUSTOMER), /explicit customer question/);
    assert.equal((await get(r.id)).version, after.version);
  });

  test('an explicit question survives funds confirmation without starting Priority clock or fee journal', async () => {
    let r = await command(await submit('AUD', 'priority'), 'await_funds');
    r = await command(r, 'request_info', { message: 'Please confirm who owns the destination account.' });
    const question = r.customer_action_required;
    r = await command(r, 'confirm_funds', funding(r));
    assert.equal(r.funding_status, 'confirmed'); assert.ok(r.funds_confirmed_at);
    assert.equal(r.status, 'under_review'); assert.equal(r.customer_action_required, question);
    assert.equal(r.ready_at, null); assert.equal(r.handling_due_at, null); assert.equal(r.priority_fee_status, 'unpaid');
    assert.equal(await count('exchange_request_fee_entries', r.id), 0);
    const job = await one("SELECT payload_snapshot FROM exchange_request_notification_deliveries WHERE request_id=$1 AND event_type='funds_recorded' LIMIT 1", [r.id]);
    assert.equal(job.payload_snapshot.customer_action_required, question);
    await rejects(() => command(r, 'start_processing'), /customer question/);
    await rejects(() => command(r, 'reconcile_complete', settlement(r)), /Confirmed funds are required/);
    const receivedAt = new Date(r.funds_confirmed_at).getTime();
    await message(r, 'I own the destination account.'); r = await get(r.id);
    assert.equal(r.customer_action_required, null); assert.equal(r.status, 'under_review');
    const beforeResume = r, key = randomUUID();
    r = await command(r, 'resume_funded_request', { honour_quote: true }, ADMIN, key);
    assert.equal(r.status, 'ready'); assert.ok(r.ready_at && r.handling_due_at); assert.equal(r.priority_fee_status, 'paid');
    assert.equal(new Date(r.funds_confirmed_at).getTime(), receivedAt);
    assert.deepEqual(await command(beforeResume, 'resume_funded_request', { honour_quote: true }, ADMIN, key), r);
    assert.equal(await count('exchange_request_fee_entries', r.id), 1);
    r = await command(r, 'reconcile_complete', settlement(r)); assert.equal(r.status, 'completed');
    assert.equal(await count('exchange_request_fee_earnings', r.id), 1);
    assert.equal(Number((await one("SELECT count(*) AS n FROM ledger WHERE transaction_id=$1 AND entry_type='trade'", [r.transaction_id])).n), 1);
  });

  test('staff can explicitly waive a funded question, but waiver cannot bypass wrong-currency checks', async () => {
    let r = await command(await submit('AUD'), 'await_funds');
    r = await command(r, 'request_info', { message: 'Please verify the beneficiary name.' });
    r = await command(r, 'confirm_funds', funding(r));
    await rejects(() => command(r, 'await_funds'), /current unpaid request/);
    assert.ok((await get(r.id)).customer_action_required);
    r = await command(r, 'resume_funded_request', { honour_quote: true });
    assert.equal(r.customer_action_required, null); assert.equal(r.status, 'ready');
    let held = await mixed();
    held = await command(held, 'request_info', { message: 'Please explain the extra AUD payment.' });
    await rejects(() => command(held, 'resume_funded_request', { honour_quote: true }), /Only reconciled fully funded/);
    assert.equal((await get(held.id)).customer_action_required, held.customer_action_required);
  });

  test('direct answers clear the explicit question while preserving a separate finance hold', async () => {
    let r = await mixed();
    r = await command(r, 'request_info', { message: 'What is the separate AUD payment for?' });
    const original = r, payload = { message: 'It was recorded in the wrong currency.' }, key = randomUUID();
    r = await command(r, 'respond', payload, CUSTOMER, key);
    assert.equal(r.customer_action_required, null); assert.equal(r.status, 'action_required');
    assert.equal(r.action_required, 'Finance is reviewing the recorded funds.'); assert.equal(r.funding_status, 'confirmed');
    assert.deepEqual(await command(original, 'respond', payload, CUSTOMER, key), r);
    await rejects(() => command(r, 'respond', payload, CUSTOMER), /explicit customer question/);
    await rejects(() => command(r, 'resume_funded_request', { honour_quote: true }), /Only reconciled fully funded/);
  });

  test('staff may ask after readiness without restarting Priority time or collecting its fee twice', async () => {
    let r = await command(await submit('AUD', 'priority'), 'await_funds');
    r = await command(r, 'confirm_funds', funding(r));
    // Distinct timestamps model elapsed handling time inside this fixed-now()
    // test transaction, so replacing the original deadline with a fresh one fails.
    await query("UPDATE exchange_requests SET ready_at=ready_at-interval '1 minute',handling_due_at=handling_due_at-interval '1 minute' WHERE id=$1", [r.id]);
    r = await get(r.id);
    const originalReady = new Date(r.ready_at).getTime(), originalDue = new Date(r.handling_due_at).getTime();
    const originalFees = (await query('SELECT * FROM exchange_request_fee_entries WHERE request_id=$1', [r.id])).rows;
    r = await command(r, 'request_info', { message: 'Please confirm the beneficiary before settlement.' });
    assert.equal(r.status, 'action_required'); assert.ok(r.customer_action_required);
    assert.equal(new Date(r.ready_at).getTime(), originalReady); assert.equal(new Date(r.handling_due_at).getTime(), originalDue);
    await rejects(() => command(r, 'start_processing'), /customer question/);
    await rejects(() => command(r, 'reconcile_complete', settlement(r)), /Confirmed funds are required/);
    await message(r, 'Beneficiary confirmed.'); r = await get(r.id);
    r = await command(r, 'resume_funded_request', { honour_quote: true });
    assert.equal(r.status, 'ready'); assert.equal(r.customer_action_required, null);
    assert.equal(new Date(r.ready_at).getTime(), originalReady); assert.equal(new Date(r.handling_due_at).getTime(), originalDue);
    assert.deepEqual((await query('SELECT * FROM exchange_request_fee_entries WHERE request_id=$1', [r.id])).rows, originalFees);
    assert.equal(Number((await one('SELECT count(*) AS n FROM ledger WHERE request_fee_entry_id=$1', [originalFees[0].id])).n), 1);
    r = await command(r, 'start_processing');
    await rejects(() => command(r, 'request_info', { message: 'Too late to pause the claimed payout.' }), /reviewable request/);
  });

  test('verified full funds are received during KYC review without becoming ready', async () => {
    let r = await command(await submit('AUD'), 'await_funds');
    await query("UPDATE profiles SET kyc_status='pending' WHERE id=$1", [CUSTOMER]);
    r = await command(r, 'confirm_funds', funding(r));
    assert.equal(r.funding_status, 'confirmed'); assert.ok(r.funds_confirmed_at); assert.equal(r.customer_action_required, null);
    assert.equal(r.status, 'under_review'); assert.equal(r.ready_at, null); assert.equal(r.handling_due_at, null);
    await message(r, 'Please let me know when your review finishes.'); r = await get(r.id);
    assert.equal(r.status, 'under_review');
    await rejects(() => command(r, 'resume_funded_request', { honour_quote: true }), /Current identity approval/);
    await query("UPDATE profiles SET kyc_status='approved' WHERE id=$1", [CUSTOMER]);
    assert.equal((await command(r, 'resume_funded_request', { honour_quote: true })).status, 'ready');
  });

  test('sweep refunds an overdue Priority target during a question hold without trapping funded resumption', async () => {
    for (const returnFeeBeforeResume of [false, true]) {
      let r = await command(await submit('AUD', 'priority'), 'await_funds');
      r = await command(r, 'confirm_funds', funding(r));
      r = await command(r, 'request_info', { message: 'Please confirm the beneficiary.' });
      await query("UPDATE exchange_requests SET handling_due_at=now()-interval '1 second',clearance_due_at=now()-interval '1 second' WHERE id=$1", [r.id]);
      r = await get(r.id); const originalDue = new Date(r.handling_due_at).getTime();
      await query('SELECT sweep_exchange_request_deadlines()');
      r = await get(r.id);
      assert.equal(r.status, 'action_required'); assert.equal(r.customer_action_required, 'Please confirm the beneficiary.');
      assert.equal(r.priority_fee_status, 'refund_pending'); assert.equal(r.funding_status, 'confirmed');
      assert.equal(new Date(r.handling_due_at).getTime(), originalDue);
      assert.equal(await count('exchange_request_refunds', r.id), 1);
      const secondSweep = await rpc('SELECT sweep_exchange_request_deadlines() AS result');
      assert.equal(secondSweep.updated, 0, 'Already-handled review rows must not recur through the funding-clearance arm');
      assert.equal(await count('exchange_request_refunds', r.id), 1);
      assert.equal(Number((await one("SELECT count(*) AS n FROM exchange_request_tasks WHERE request_id=$1 AND kind='funding_clearance_review'", [r.id])).n), 0);
      await message(r, 'Beneficiary confirmed.'); r = await get(r.id);
      if (returnFeeBeforeResume) {
        r = await command(r, 'confirm_refund', { refund_kind: 'priority', refund_reference: randomUUID(), payer_account_id: AUD });
        assert.equal(r.priority_fee_status, 'refunded');
      }
      r = await command(r, 'resume_funded_request', { honour_quote: true });
      assert.equal(r.status, 'ready'); assert.equal(r.customer_action_required, null);
      assert.equal(r.priority_fee_status, returnFeeBeforeResume ? 'refunded' : 'refund_pending');
      assert.equal(new Date(r.handling_due_at).getTime(), originalDue);
      const collected = await one("SELECT count(*) AS n FROM exchange_request_fee_entries WHERE request_id=$1 AND kind='collected'", [r.id]);
      assert.equal(Number(collected.n), 1);
      r = await command(r, 'reconcile_complete', settlement(r)); assert.equal(r.status, 'completed');
      assert.equal(await count('exchange_request_fee_earnings', r.id), 0);
    }
  });

  test('atomic resume then completion cannot evade a breached Priority refund before the next sweep', async () => {
    let r = await command(await submit('AUD', 'priority'), 'await_funds');
    r = await command(r, 'confirm_funds', funding(r));
    r = await command(r, 'request_info', { message: 'Please confirm the destination.' });
    await query("UPDATE exchange_requests SET handling_due_at=now()-interval '1 second' WHERE id=$1", [r.id]);
    r = await get(r.id); await message(r, 'Destination confirmed.'); r = await get(r.id);
    assert.equal(r.priority_fee_status, 'paid'); assert.equal(await count('exchange_request_refunds', r.id), 0);
    r = await command(r, 'resume_funded_request', { honour_quote: true });
    assert.equal(r.status, 'ready'); assert.equal(r.priority_fee_status, 'refund_pending');
    assert.equal(await count('exchange_request_refunds', r.id), 1);
    r = await command(r, 'reconcile_complete', settlement(r));
    assert.equal(r.status, 'completed'); assert.equal(r.priority_fee_status, 'refund_pending');
    assert.equal(await count('exchange_request_fee_earnings', r.id), 0);
    assert.equal((await one('SELECT snapshot FROM exchange_request_completion_receipts WHERE request_id=$1', [r.id])).snapshot.priority_fee_status, 'refund_pending');
  });

  test('relaxed Priority breach refund guard still rejects principal and unrelated refund reasons', async () => {
    for (const [kind, reason] of [['principal', 'cancel'], ['priority', 'cancelled_before_processing']]) {
      await db.exec('SAVEPOINT refund_guard_case');
      let r = await command(await submit('AUD', 'priority'), 'await_funds');
      r = await command(r, 'request_info', { message: 'Please confirm the account.' });
      r = await command(r, 'confirm_funds', funding(r));
      await query('INSERT INTO exchange_request_refunds(request_id,kind,amount,currency,reason) VALUES($1,$2,20,\'AUD\',$3)', [r.id, kind, reason]);
      await rejects(() => command(r, 'resume_funded_request', { honour_quote: true }), /Only reconciled fully funded/);
      assert.equal((await get(r.id)).customer_action_required, 'Please confirm the account.');
      await db.exec('ROLLBACK TO SAVEPOINT refund_guard_case');
    }
  });

  test('wrong-only, partial and excess amounts cannot claim exact quoted funds received', async () => {
    let wrong = await command(await submit(), 'await_funds');
    wrong = await command(wrong, 'confirm_funds', funding(wrong, 'AUD', 2235));
    assert.equal(wrong.funding_status, 'unpaid'); assert.equal(wrong.funds_confirmed_at, null);
    let partial = await command(await submit(), 'await_funds');
    partial = await command(partial, 'confirm_funds', funding(partial, 'IRT', Number(partial.quote.funding_total) / 2));
    assert.equal(partial.funding_status, 'partial'); assert.equal(partial.funds_confirmed_at, null);
    let excess = await command(await submit(), 'await_funds');
    excess = await command(excess, 'confirm_funds', funding(excess, 'IRT', Number(excess.quote.funding_total) + 1));
    assert.equal(excess.funding_status, 'partial'); assert.equal(excess.funds_confirmed_at, null); assert.equal(excess.status, 'action_required');
  });

  test('questions, replies and funding updates preserve email opt-out, exact retries and access controls', async () => {
    const r = await command(await submit('AUD'), 'await_funds'), questionKey = randomUUID();
    const question = await command(r, 'request_info', { message: 'Please confirm the recipient.' }, ADMIN, questionKey);
    assert.deepEqual(await command(r, 'request_info', { message: 'Please confirm the recipient.' }, ADMIN, questionKey), question);
    await rejects(() => command(r, 'request_info', { message: 'Changed intent' }, ADMIN, questionKey), /IDEMPOTENCY_CONFLICT/);
    await rejects(() => command(r, 'request_info', { message: 'Stale edit' }), /REQUEST_CONFLICT/);
    await rejects(() => command(question, 'respond', { message: 'Cross-user answer' }, OTHER), /Request unavailable/);
    await rejects(() => message(question, 'Cross-user message', OTHER), /Request unavailable/);
    const oldJobs = (await query("SELECT payload_snapshot,status FROM exchange_request_notification_deliveries WHERE request_id=$1 AND event_type='request_info'", [r.id])).rows;
    assert.equal(oldJobs.length, 2); assert.ok(oldJobs.every(job => job.status === 'skipped' && job.payload_snapshot.customer_action_required === question.customer_action_required));
    await message(question, 'An admin note does not answer the customer question.', ADMIN); const afterAdmin = await get(r.id);
    assert.equal(afterAdmin.customer_action_required, question.customer_action_required);
    await message(afterAdmin, 'Recipient confirmed.');
    assert.deepEqual((await query("SELECT payload_snapshot,status FROM exchange_request_notification_deliveries WHERE request_id=$1 AND event_type='request_info'", [r.id])).rows, oldJobs);
    for (const role of ['anon', 'authenticated', 'service_role']) {
      assert.equal((await one("SELECT has_function_privilege($1,'exchange_request_has_finance_hold(uuid)','EXECUTE') AS ok", [role])).ok, false);
      assert.equal((await one("SELECT has_function_privilege($1,'transition_exchange_request_accounting_core(uuid,uuid,integer,uuid,text,jsonb)','EXECUTE') AS ok", [role])).ok, false);
    }
  });

  test('a failed audit rolls back question/funding facts, payments and new notification snapshots together', async () => {
    let r = await command(await submit('AUD', 'priority'), 'await_funds');
    r = await command(r, 'request_info', { message: 'Please confirm the account owner.' });
    const before = await frozen(r.id), row = await get(r.id);
    await query("SELECT set_config('test.reject_audit','on',true)");
    await rejects(() => command(r, 'confirm_funds', funding(r)), /Synthetic audit unavailable/);
    assert.deepEqual(await get(r.id), row); assert.deepEqual(await frozen(r.id), before);
    assert.equal(await count('exchange_request_fee_entries', r.id), 0);
  });
});
