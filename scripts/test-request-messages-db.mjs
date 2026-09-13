// Real PostgreSQL migrations and synthetic identities. No network, environment
// files, provider sends or live databases are used by this suite.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const CUSTOMER = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';
const ADMIN = '00000000-0000-4000-8000-000000000003';
const AUD = '10000000-0000-4000-8000-000000000001';
const IRT = '10000000-0000-4000-8000-000000000002';
const RECIPIENT = '20000000-0000-4000-8000-000000000001';
let db, legacy, legacyEvents, legacyDeliveries, legacyReceipt;
const query = (sql, args = []) => db.query(sql, args);
const one = async (sql, args = []) => (await query(sql, args)).rows[0];
const rpc = async (sql, args = []) => (await one(sql, args)).result;
const get = id => one('SELECT * FROM exchange_requests WHERE id=$1', [id]);
const command = (r, action, payload = {}, actor = ADMIN, key = randomUUID()) => rpc(
  'SELECT transition_exchange_request($1,$2,$3,$4,$5,$6) AS result',
  [actor, r.id, r.version, key, action, { send_email: false, date_jalali: '1405/06/22', ...payload }]);
const message = (r, text, actor = ADMIN, sendEmail = false, key = randomUUID()) => rpc(
  'SELECT send_exchange_request_message($1,$2,$3,$4,$5,$6) AS result', [actor, r.id, r.version, key, text, sendEmail]);
const submit = (id, actor = CUSTOMER, key = randomUUID()) => rpc(
  'SELECT submit_exchange_request($1,$2,$3) AS result', [actor, id, key]);
const request = async (locale = 'en') => submit(await quote(locale));
const funding = () => ({ received_amount: 1000, received_currency: 'AUD', payment_reference: randomUUID(), receiver_account_id: AUD });
const settlement = () => ({ settlement_reference: randomUUID(), payer_account_id: IRT, receiver_account_id: AUD, transfer_method: 'satna' });
const events = async id => (await query('SELECT * FROM exchange_request_events WHERE request_id=$1 ORDER BY sequence', [id])).rows;
const deliveries = async id => (await query('SELECT * FROM exchange_request_notification_deliveries WHERE request_id=$1 ORDER BY event_sequence,audience,id', [id])).rows;
async function quote(locale = 'en') {
  const policy = await one('SELECT version,settings FROM exchange_request_settings WHERE id');
  const recipient = await one('SELECT * FROM recipients WHERE id=$1', [RECIPIENT]);
  const snapshot = { raw_amount_aud: 1000, equivalent_toman: 970000, applied_rate: 1000, base_fee_aud: 30,
    priority_fee_aud: 0, priority_fee_amount: 0, funding_currency: 'AUD', funding_total: 1000,
    recipient_amount: 970000, recipient_currency: 'IRT', service_tier: 'standard', locale,
    customer_request_type: 'sell_aud', company_trade_type: 'buy_aud', source_of_funds: 'Savings',
    reason_for_transfer: 'Family support', recipient_id: RECIPIENT, recipient_snapshot: recipient,
    sender_snapshot: { name: 'Synthetic Customer' }, policy_version: policy.version, policy_snapshot: policy.settings };
  return (await one("INSERT INTO exchange_request_quotes(user_id,snapshot,expires_at) VALUES($1,$2,now()+interval '10 minutes') RETURNING id", [CUSTOMER, snapshot])).id;
}
async function rejects(work, pattern) {
  await db.exec('SAVEPOINT expected_failure');
  await assert.rejects(work, pattern);
  await db.exec('ROLLBACK TO SAVEPOINT expected_failure');
}

describe('request conversations, staff approvals and email decisions', { concurrency: false }, () => {
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
      'supabase/migrations/20260913_26_request_fee_ledger_type.sql']) await db.exec(read(file));
    await query("INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES($1,'customer@example.invalid','{}'),($2,'other@example.invalid','{}'),($3,'admin@example.invalid','{\"role\":\"admin\"}')", [CUSTOMER, OTHER, ADMIN]);
    await query("INSERT INTO profiles(id,email,kyc_status) SELECT id,email,'approved' FROM auth.users");
    await query("INSERT INTO bank_accounts(id,account_name,currency) VALUES($1,'Synthetic AUD','AUD'),($2,'Synthetic IRT','IRT')", [AUD, IRT]);
    await query("INSERT INTO recipients(id,user_id,direction,full_name,bank_name,account_number) VALUES($1,$2,'irt','Synthetic Recipient','Synthetic Bank','123456')", [RECIPIENT, CUSTOMER]);
    await query('INSERT INTO rates_history(date,buy_aud,sell_aud) VALUES(current_date,1000,1000)');
    await query('UPDATE exchange_request_settings SET settings=settings||$1::jsonb', [{ enabled: true,
      management_emails: ['management@example.invalid'], payment_instructions_aud: 'BSB 000-000\nAccount 123456',
      business_days: [0, 1, 2, 3, 4, 5, 6], opening_hour: 0, closing_hour: 24 }]);
    // Real pre-upgrade history proves that new conversation support does not
    // rewrite references, immutable outbox payloads or issued final receipts.
    legacy = await request();
    legacy = await command(legacy, 'request_info', { message: 'Please confirm the recipient name.' });
    legacy = await command(legacy, 'respond', { message: 'The recipient name is correct.' }, CUSTOMER);
    legacy = await command(legacy, 'await_funds');
    legacy = await command(legacy, 'payment_evidence', { message: 'PRIVATE-BANK-REFERENCE' }, CUSTOMER);
    legacy = await command(legacy, 'confirm_funds', funding());
    legacy = await command(legacy, 'start_processing');
    legacy = await command(legacy, 'complete', settlement());
    legacyEvents = await events(legacy.id);
    legacyDeliveries = await deliveries(legacy.id);
    legacyReceipt = await one('SELECT * FROM exchange_request_completion_receipts WHERE request_id=$1', [legacy.id]);
    await db.exec(read('supabase/migrations/20260913_27_request_messages_and_notifications.sql'));
  });
  after(async () => db?.close());
  beforeEach(async () => db.exec('BEGIN'));
  afterEach(async () => db.exec('ROLLBACK'));

  test('upgrade preserves historical references and receipts and backfills only correspondence', async () => {
    assert.match(legacy.reference_code, /^ZE[A-F0-9]{12}$/);
    assert.equal((await get(legacy.id)).reference_code, legacy.reference_code);
    assert.deepEqual((await events(legacy.id)).map(event => Object.fromEntries(Object.entries(event).filter(([key]) => key !== 'send_email'))), legacyEvents);
    assert.deepEqual(await deliveries(legacy.id), legacyDeliveries);
    assert.deepEqual(await one('SELECT * FROM exchange_request_completion_receipts WHERE request_id=$1', [legacy.id]), legacyReceipt);
    assert.deepEqual((await query('SELECT sender_role,body FROM exchange_request_messages WHERE request_id=$1 ORDER BY event_sequence', [legacy.id])).rows.map(m => [m.sender_role, m.body]), [
      ['admin', 'Please confirm the recipient name.'], ['customer', 'The recipient name is correct.'],
    ]);
  });

  test('one existing-style transaction code is reused everywhere and submission awaits staff approval', async () => {
    const q = await quote('fa'), key = randomUUID(), r = await submit(q, CUSTOMER, key);
    assert.equal(r.status, 'submitted');
    assert.equal(r.version, 1);
    assert.match(r.reference_code, /^ZE\d{5}$/);
    assert.equal((await one('SELECT reference_code FROM transactions WHERE id=$1', [r.transaction_id])).reference_code, r.reference_code);
    assert.match(r.payment_instructions, /BSB 000-000/);
    assert.equal(r.handling_due_at, null);
    assert.deepEqual(await submit(q, CUSTOMER, key), r);
    const pending = await deliveries(r.id);
    assert.equal(pending.length, 2);
    assert.ok(pending.every(d => d.reference === r.reference_code && d.event_type === 'submitted'));
    assert.equal(pending.find(d => d.audience === 'customer').locale, 'fa');
    await rejects(() => submit(q, OTHER), /Quote unavailable/);
    await rejects(async () => submit(await quote(), CUSTOMER, key), /IDEMPOTENCY_CONFLICT/);
    await rejects(() => command(r, 'await_funds', {}, CUSTOMER), /Administrator required/);
    assert.equal((await command(r, 'await_funds')).status, 'awaiting_funds');
  });

  test('message authorization, direct table access and immutable evidence are enforced', async () => {
    const r = await request();
    await rejects(() => message(r, 'Cross-user attempt', OTHER), /Request unavailable/);
    await rejects(() => message(r, ' '.repeat(5)), /Invalid request message/);
    await rejects(() => message(r, 'x'.repeat(2001)), /Invalid request message/);
    const result = await message(r, 'Please review your bank receipt.');
    assert.equal(result.message.sender_role, 'admin');
    assert.equal(result.message.sender_id, ADMIN);
    assert.equal(result.request_version, r.version + 1);
    await rejects(() => query('UPDATE exchange_request_messages SET body=$1 WHERE id=$2', ['rewrite', result.message.id]), /immutable/);
    for (const role of ['anon', 'authenticated']) {
      assert.equal((await one("SELECT has_table_privilege($1,'exchange_request_messages','SELECT') AS allowed", [role])).allowed, false);
      assert.equal((await one("SELECT has_table_privilege($1,'exchange_request_messages','INSERT') AS allowed", [role])).allowed, false);
      assert.equal((await one("SELECT has_function_privilege($1,'send_exchange_request_message(uuid,uuid,integer,uuid,text,boolean)','EXECUTE') AS allowed", [role])).allowed, false);
    }
  });

  test('message retries are idempotent and stale versions or changed email intent cannot duplicate sends', async () => {
    const r = await request(), key = randomUUID();
    const result = await message(r, 'We have received your documents.', ADMIN, true, key);
    assert.deepEqual(await message(r, 'We have received your documents.', ADMIN, true, key), result);
    await rejects(() => message(r, 'We have received your documents.', ADMIN, false, key), /IDEMPOTENCY_CONFLICT/);
    await rejects(() => message(r, 'Another update'), /REQUEST_CONFLICT/);
    assert.equal(Number((await one('SELECT count(*) AS n FROM exchange_request_messages WHERE request_id=$1', [r.id])).n), 1);
    assert.equal((await deliveries(r.id)).filter(d => d.event_type === 'admin_message').length, 2);
  });

  test('staff must choose an email decision; skipped messages remain visible and never block later mail', async () => {
    let r = await request();
    await rejects(() => rpc('SELECT transition_exchange_request($1,$2,$3,$4,$5,$6) AS result',
      [ADMIN, r.id, r.version, randomUUID(), 'review', {}]), /Choose whether to send an email/);
    r = await command(r, 'review');
    const sent = await message(r, 'Your transfer is being checked.', ADMIN, false);
    r = await get(r.id);
    await message(r, 'Your bank details are approved.', ADMIN, true);
    const allEvents = await events(r.id), allDeliveries = await deliveries(r.id);
    assert.ok(allEvents.find(e => e.id === sent.message.event_id).customer_visible);
    assert.equal(allEvents.find(e => e.id === sent.message.event_id).send_email, false);
    const skipped = allDeliveries.filter(d => ['review', 'admin_message'].includes(d.event_type) && d.event_id !== allEvents.at(-1).id);
    assert.equal(skipped.length, 4);
    assert.ok(skipped.every(d => d.status === 'skipped' && d.attempts === 0 && d.last_error === 'admin_email_opt_out'));
    await query("UPDATE exchange_request_notification_deliveries SET status='delivered' WHERE request_id=$1 AND event_type='submitted'", [r.id]);
    const claimed = (await query('SELECT * FROM claim_request_notifications($1,25,120)', [randomUUID()])).rows.filter(d => d.request_id === r.id);
    assert.equal(claimed.length, 2);
    assert.ok(claimed.every(d => d.event_id === allEvents.at(-1).id));
  });

  test('customer replies are visible to management and return information requests for staff review', async () => {
    let r = await request();
    r = await command(r, 'request_info', { message: 'Please confirm the recipient.', send_email: false });
    const result = await message(r, 'گیرنده تأیید شد.', CUSTOMER, false);
    assert.equal(result.message.sender_role, 'customer');
    assert.equal(result.message.body, 'گیرنده تأیید شد.');
    assert.equal(result.message.send_email, true);
    const current = await get(r.id);
    assert.equal(current.status, 'under_review');
    assert.equal(current.action_required, null);
    assert.equal(current.funding_received, '0.00');
    assert.equal(current.handling_due_at, null);
    const notice = (await deliveries(r.id)).filter(d => d.event_id === result.message.event_id);
    assert.equal(notice.length, 1);
    assert.equal(notice[0].audience, 'management');
    assert.equal(notice[0].status, 'pending');
    assert.equal(notice[0].payload_snapshot.public_message, result.message.body);
    const reply = await message(current, 'Thank you.', CUSTOMER, false);
    assert.equal((await events(r.id)).at(-1).event_type, 'customer_message');
    assert.equal((await get(r.id)).status, 'under_review');
    assert.equal(reply.request_version, current.version + 1);
  });

  test('an opted-out completion still creates one receipt and accounting entry, with immutable audit intent', async () => {
    let r = await request();
    r = await command(r, 'await_funds');
    r = await command(r, 'confirm_funds', funding());
    r = await command(r, 'start_processing');
    const key = randomUUID(), payload = settlement(), before = r;
    r = await command(r, 'complete', payload, ADMIN, key);
    assert.deepEqual(await command(before, 'complete', payload, ADMIN, key), r);
    await rejects(() => command(before, 'complete', { ...payload, send_email: true }, ADMIN, key), /IDEMPOTENCY_CONFLICT/);
    const receipt = await one('SELECT snapshot FROM exchange_request_completion_receipts WHERE request_id=$1', [r.id]);
    assert.equal(receipt.snapshot.reference_code, r.reference_code);
    assert.equal(Number((await one("SELECT count(*) AS n FROM ledger WHERE transaction_id=$1 AND entry_type='trade'", [r.transaction_id])).n), 1);
    assert.ok((await deliveries(r.id)).filter(d => d.event_type === 'complete').every(d => d.status === 'skipped' && d.payload_snapshot.receipt.reference_code === r.reference_code));
    const audit = await one("SELECT new_value FROM audit_logs WHERE target_id=$1 AND action='REQUEST_COMPLETE'", [r.id]);
    const completion = (await events(r.id)).at(-1);
    assert.equal(completion.send_email, false);
    assert.equal(audit.new_value.command_key, key);
    const decision = await one("SELECT new_value FROM audit_logs WHERE target_id=$1 AND action='REQUEST_EMAIL_DECISION'", [completion.id]);
    assert.equal(decision.new_value.send_email, false);
    assert.equal(decision.new_value.request_id, r.id);
  });

  test('audit failure rolls back the message, state, command key and all email jobs', async () => {
    const r = await request(), originalEvents = await events(r.id), originalDeliveries = await deliveries(r.id), key = randomUUID();
    await query("SELECT set_config('test.reject_audit','on',true)");
    await rejects(() => message(r, 'Atomic update', ADMIN, true, key), /Synthetic audit unavailable/);
    assert.equal((await get(r.id)).version, r.version);
    assert.deepEqual(await events(r.id), originalEvents);
    assert.deepEqual(await deliveries(r.id), originalDeliveries);
    assert.equal(Number((await one('SELECT count(*) AS n FROM exchange_request_messages WHERE request_id=$1', [r.id])).n), 0);
    assert.equal(Number((await one('SELECT count(*) AS n FROM exchange_request_commands WHERE request_id=$1 AND command_key=$2', [r.id, key])).n), 0);
    await query("SELECT set_config('test.reject_audit','off',true)");
    assert.equal((await message(r, 'Atomic update', ADMIN, true, key)).request_version, r.version + 1);
  });
});
