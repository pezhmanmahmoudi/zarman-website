// Sequential request approvals use real migrations in an isolated PostgreSQL
// runtime, with synthetic users/accounts only. No network or live credentials.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { before, after, beforeEach, afterEach, describe, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const CUSTOMER = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';
const ADMIN = '00000000-0000-4000-8000-000000000003';
const AUD = '10000000-0000-4000-8000-000000000001';
const IRT = '10000000-0000-4000-8000-000000000002';
const RECIPIENT = '20000000-0000-4000-8000-000000000001';
let db, oldCompleted, oldEvidence, oldUntouched, oldApproval, oldSnapshots;
const query = (sql, args = []) => db.query(sql, args);
const one = async (sql, args = []) => (await query(sql, args)).rows[0];
const rpc = async (sql, args = []) => (await one(sql, args)).result;
const get = id => one('SELECT * FROM exchange_requests WHERE id=$1', [id]);
const command = (r, action, payload = {}, actor = ADMIN, key = randomUUID()) => rpc(
  'SELECT transition_exchange_request($1,$2,$3,$4,$5,$6) AS result',
  [actor, r.id, r.version, key, action, { send_email: false, date_jalali: '1405/06/24', ...payload }]);
const funding = r => ({ received_amount: Number(r.quote.funding_total), received_currency: 'AUD', payment_reference: randomUUID(), receiver_account_id: AUD });
const settlement = () => ({ settlement_reference: randomUUID(), payer_account_id: IRT, receiver_account_id: AUD, transfer_method: 'satna' });
const count = async (table, request) => Number((await one(`SELECT count(*) AS n FROM ${table} WHERE request_id=$1`, [request])).n);
const submit = async (tier = 'standard', customer = CUSTOMER) => {
  const policy = await one('SELECT version,settings FROM exchange_request_settings WHERE id');
  const recipient = await one('SELECT * FROM recipients WHERE id=$1', [RECIPIENT]);
  const snapshot = { raw_amount_aud: 1000, equivalent_toman: 970000, applied_rate: 1000, base_fee_aud: 30,
    priority_fee_aud: tier === 'priority' ? 20 : 0, priority_fee_amount: tier === 'priority' ? 20 : 0,
    funding_currency: 'AUD', funding_total: tier === 'priority' ? 1020 : 1000,
    recipient_amount: 970000, recipient_currency: 'IRT', service_tier: tier, locale: 'fa',
    customer_request_type: 'sell_aud', company_trade_type: 'buy_aud', source_of_funds: 'Savings', reason_for_transfer: 'Family support',
    recipient_id: customer === CUSTOMER ? RECIPIENT : null, recipient_snapshot: recipient,
    sender_snapshot: { name: 'Synthetic Customer' }, policy_version: policy.version, policy_snapshot: policy.settings };
  if (customer !== CUSTOMER) Object.assign(snapshot, { payment_link: 'https://example.invalid/invoice', institution_name: 'Synthetic School', invoice_reference: 'TEST-001' });
  const quote = await one("INSERT INTO exchange_request_quotes(user_id,snapshot,expires_at) VALUES($1,$2,now()+interval '10 minutes') RETURNING id", [customer, snapshot]);
  return rpc('SELECT submit_exchange_request($1,$2,$3) AS result', [customer, quote.id, randomUUID()]);
};
async function attach(r, options = {}) {
  const actor = options.actor ?? CUSTOMER, id = options.id ?? randomUUID(), key = options.key ?? id;
  const path = `${actor}/${r.id}/${id}.pdf`;
  await query("INSERT INTO storage.objects(bucket_id,name) VALUES('exchange-request-receipts',$1) ON CONFLICT DO NOTHING", [path]);
  return rpc('SELECT attach_exchange_request_receipt($1,$2,$3,$4,$5,$6,$7,$8,$9) AS result',
    [actor, r.id, id, path, 'Synthetic receipt.pdf', 'application/pdf', 1000, options.hash ?? 'a'.repeat(64), key]);
}
async function rejects(work, pattern) {
  await db.exec('SAVEPOINT expected_failure');
  await assert.rejects(work, pattern);
  await db.exec('ROLLBACK TO SAVEPOINT expected_failure');
}
async function snapshot(id) {
  return one(`SELECT jsonb_build_object('reference',(SELECT reference_code FROM exchange_requests WHERE id=$1),
    'events',(SELECT jsonb_agg(to_jsonb(e) ORDER BY sequence) FROM exchange_request_events e WHERE request_id=$1),
    'deliveries',(SELECT jsonb_agg(to_jsonb(d) ORDER BY id) FROM exchange_request_notification_deliveries d WHERE request_id=$1),
    'receipt',(SELECT snapshot FROM exchange_request_completion_receipts WHERE request_id=$1)) AS value`, [id]);
}

describe('sequential request payment and settlement approvals', { concurrency: false }, () => {
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
      'supabase/migrations/20260913_28_request_bank_details.sql']) await db.exec(read(file));
    await query("INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES($1,'customer@example.invalid','{}'),($2,'other@example.invalid','{}'),($3,'admin@example.invalid','{\"role\":\"admin\"}')", [CUSTOMER, OTHER, ADMIN]);
    await query("INSERT INTO profiles(id,email,kyc_status) SELECT id,email,'approved' FROM auth.users");
    await query("INSERT INTO bank_accounts(id,account_name,currency) VALUES($1,'Synthetic AUD','AUD'),($2,'Synthetic IRT','IRT')", [AUD, IRT]);
    await query("INSERT INTO recipients(id,user_id,direction,full_name,bank_name,account_number) VALUES($1,$2,'irt','Synthetic Recipient','Synthetic Bank','123456')", [RECIPIENT, CUSTOMER]);
    await query('INSERT INTO rates_history(date,buy_aud,sell_aud) VALUES(current_date,1000,1000)');
    await query('UPDATE exchange_request_settings SET settings=settings||$1::jsonb', [{ enabled: true, priority_enabled: true,
      priority_fee_aud: 20, priority_capacity: 10, management_emails: ['management@example.invalid'],
      payment_details_aud: { account_name: 'Synthetic AUD', bsb: '000-001', account_number: '00123456' },
      payment_details_irt: { account_name: 'Synthetic IRT', account_number: '12345678' },
      payment_instructions_aud: 'Synthetic bank instructions', payment_instructions_irt: 'Synthetic bank instructions',
      payment_instructions_aud_fa: 'دستور آزمایشی پرداخت', payment_instructions_irt_fa: 'دستور آزمایشی پرداخت',
      priority_terms: 'Synthetic terms', priority_terms_fa: 'شرایط آزمایشی',
      business_days: [0, 1, 2, 3, 4, 5, 6], opening_hour: 0, closing_hour: 24 }]);
    oldCompleted = await command(await submit(), 'await_funds');
    oldApproval = (await one("SELECT created_at FROM exchange_request_events WHERE request_id=$1 AND event_type='await_funds'", [oldCompleted.id])).created_at;
    oldCompleted = await command(oldCompleted, 'confirm_funds', funding(oldCompleted));
    oldCompleted = await command(oldCompleted, 'start_processing');
    oldCompleted = await command(oldCompleted, 'complete', settlement());
    oldEvidence = await submit();
    await attach(oldEvidence);
    oldUntouched = await submit();
    oldSnapshots = await Promise.all([oldCompleted.id, oldEvidence.id, oldUntouched.id].map(snapshot));
    await db.exec(read('supabase/migrations/20260915_29_request_payment_approval.sql'));
  });
  after(async () => db?.close());
  beforeEach(async () => db.exec('BEGIN'));
  afterEach(async () => db.exec('ROLLBACK'));

  test('historical approvals and sent receipts are grandfathered without rewriting frozen history', async () => {
    assert.equal(new Date((await get(oldCompleted.id)).payment_approved_at).toISOString(), new Date(oldApproval).toISOString());
    assert.ok((await get(oldEvidence.id)).payment_approved_at);
    assert.equal((await get(oldUntouched.id)).payment_approved_at, null);
    assert.deepEqual(await Promise.all([oldCompleted.id, oldEvidence.id, oldUntouched.id].map(snapshot)), oldSnapshots);
  });

  test('new submissions reveal no bank data in outbox and have no payment clock or evidence permission', async () => {
    const r = await submit('priority');
    assert.equal(r.status, 'submitted');
    assert.equal(r.payment_approved_at, null);
    assert.equal(r.funding_due_at, null);
    assert.equal(r.clearance_due_at, null);
    assert.equal(r.handling_due_at, null);
    assert.match(r.reference_code, /^ZE\d{5}$/);
    const jobs = (await query('SELECT payload_snapshot FROM exchange_request_notification_deliveries WHERE request_id=$1', [r.id])).rows;
    assert.equal(jobs.length, 2);
    assert.ok(jobs.every(({ payload_snapshot: p }) => !('payment_details' in p) && !('payment_instructions' in p) && !('payment_instructions_fa' in p)));
    await rejects(() => attach(r), /staff payment approval/);
    await rejects(() => command(r, 'payment_evidence', { message: 'Transfer made' }, CUSTOMER), /staff payment approval/);
    await rejects(() => command(r, 'confirm_funds', funding(r)), /staff payment approval/);
    await rejects(() => command(r, 'await_funds', {}, CUSTOMER), /Administrator required/);
    await rejects(() => attach(r, { actor: OTHER }), /Request unavailable/);
    assert.equal(await count('exchange_request_receipts', r.id), 0);
    assert.equal(await count('exchange_request_payments', r.id), 0);
  });

  test('unapproved requests do not expire and first approval starts accepted windows exactly once', async () => {
    let r = await submit();
    // Even legacy deadlines cannot expire a record which has no approval.
    await query("UPDATE exchange_requests SET created_at=now()-interval '5 days',funding_due_at=now()-interval '4 days',clearance_due_at=now()-interval '3 days' WHERE id=$1", [r.id]);
    await query('SELECT sweep_exchange_request_deadlines()');
    assert.equal((await get(r.id)).status, 'submitted');
    assert.equal(await count('exchange_request_tasks', r.id), 0);
    await query("UPDATE exchange_request_settings SET settings=settings||'{\"funding_minutes\":999,\"australian_clearance_minutes\":2880}'::jsonb");
    const key = randomUUID(), before = r;
    r = await command(r, 'await_funds', { send_email: true }, ADMIN, key);
    assert.deepEqual(await command(before, 'await_funds', { send_email: true }, ADMIN, key), r);
    assert.equal(new Date(r.funding_due_at) - new Date(r.payment_approved_at), 120 * 60_000);
    assert.equal(new Date(r.clearance_due_at) - new Date(r.funding_due_at), 1440 * 60_000);
    const approved = r;
    r = await command(r, 'review');
    r = await command(r, 'await_funds');
    assert.equal(r.payment_approved_at, approved.payment_approved_at);
    assert.equal(r.funding_due_at, approved.funding_due_at);
    assert.equal(r.clearance_due_at, approved.clearance_due_at);
    const bankMail = await one("SELECT payload_snapshot FROM exchange_request_notification_deliveries WHERE request_id=$1 AND event_type='await_funds' LIMIT 1", [r.id]);
    assert.equal(bankMail.payload_snapshot.payment_details.account_number, '00123456');
    assert.ok(bankMail.payload_snapshot.payment_approved_at);
    await rejects(() => query('UPDATE exchange_requests SET payment_approved_at=NULL WHERE id=$1', [r.id]), /approval is immutable/);
  });

  test('approval validates current KYC and priority capacity and rolls back a failed approval', async () => {
    const r = await submit('priority'), other = await submit('priority', OTHER);
    await query("UPDATE profiles SET kyc_status='pending' WHERE id=$1", [CUSTOMER]);
    await rejects(() => command(r, 'await_funds'), /Current identity approval/);
    assert.equal((await get(r.id)).payment_approved_at, null);
    assert.equal((await get(r.id)).funding_due_at, null);
    await query("UPDATE profiles SET kyc_status='approved' WHERE id=$1", [CUSTOMER]);
    await query("UPDATE exchange_request_settings SET settings=jsonb_set(settings,'{priority_capacity}','1')");
    await command(r, 'await_funds');
    await rejects(() => command(other, 'await_funds'), /PRIORITY_CAPACITY/);
    assert.equal((await get(other.id)).payment_approved_at, null);
  });

  test('sending approved evidence is idempotent and only actual cleared funds start handling', async () => {
    let r = await command(await submit('priority'), 'await_funds');
    const receiptId = randomUUID();
    const receipt = await attach(r, { id: receiptId });
    assert.deepEqual(await attach(r, { id: receiptId }), receipt);
    r = await get(r.id);
    assert.ok(r.evidence_submitted_at);
    assert.equal(r.funds_confirmed_at, null);
    assert.equal(r.ready_at, null);
    assert.equal(r.handling_due_at, null);
    assert.equal(r.status, 'awaiting_funds');
    assert.equal(await count('exchange_request_receipts', r.id), 1);
    r = await command(r, 'confirm_funds', funding(r));
    assert.equal(r.status, 'ready');
    assert.ok(r.funds_confirmed_at && r.handling_due_at);
    assert.equal(r.priority_fee_status, 'paid');
  });

  test('approved late funds retain the existing finance reconciliation path', async () => {
    let r = await command(await submit(), 'await_funds');
    await query("UPDATE exchange_requests SET clearance_due_at=now()-interval '1 second' WHERE id=$1", [r.id]);
    await query('SELECT sweep_exchange_request_deadlines()');
    r = await get(r.id);
    assert.equal(r.status, 'expired');
    r = await command(r, 'confirm_funds', funding(r));
    assert.equal(r.status, 'action_required');
    assert.equal(r.funding_status, 'confirmed');
    await rejects(() => command(r, 'resume_funded_request'), /Explicit acceptance/);
    r = await command(r, 'resume_funded_request', { honour_quote: true });
    assert.equal(r.status, 'ready');
  });

  test('final reconciliation atomically claims, settles and queues only the selected final receipt once', async () => {
    let r = await command(await submit('priority'), 'await_funds');
    r = await command(r, 'confirm_funds', funding(r));
    const before = r, key = randomUUID(), payload = { ...settlement(), send_email: true };
    r = await command(r, 'reconcile_complete', payload, ADMIN, key);
    assert.equal(r.status, 'completed');
    assert.equal(r.version, before.version + 2);
    assert.deepEqual(await command(before, 'reconcile_complete', payload, ADMIN, key), r);
    await rejects(() => command(before, 'reconcile_complete', { ...payload, send_email: false }, ADMIN, key), /IDEMPOTENCY_CONFLICT/);
    assert.equal(await count('exchange_request_executions', r.id), 1);
    const execution = await one('SELECT claimed_by,status FROM exchange_request_executions WHERE request_id=$1', [r.id]);
    assert.deepEqual(execution, { claimed_by: ADMIN, status: 'settled' });
    assert.equal(Number((await one("SELECT count(*) AS n FROM ledger WHERE transaction_id=$1 AND entry_type='trade'", [r.transaction_id])).n), 1);
    assert.equal(await count('exchange_request_completion_receipts', r.id), 1);
    const jobs = (await query("SELECT event_type,status,payload_snapshot FROM exchange_request_notification_deliveries WHERE request_id=$1 AND event_type IN ('start_processing','complete')", [r.id])).rows;
    assert.equal(jobs.length, 4);
    assert.ok(jobs.filter(j => j.event_type === 'start_processing').every(j => j.status === 'skipped'));
    assert.ok(jobs.filter(j => j.event_type === 'complete').every(j => j.status === 'pending' && j.payload_snapshot.receipt.reference_code === r.reference_code));
    assert.equal((await one("SELECT new_value FROM audit_logs WHERE action='REQUEST_RECONCILE_COMPLETE' AND target_id=$1", [r.id])).new_value.command_key, key);
  });

  test('final reconciliation cannot bypass owner access, versions, KYC or bank ledger checks', async () => {
    let r = await command(await submit(), 'await_funds');
    await rejects(() => command(r, 'reconcile_complete', settlement()), /Confirmed funds/);
    r = await command(r, 'confirm_funds', funding(r));
    await rejects(() => command(r, 'reconcile_complete', settlement(), OTHER), /Request unavailable/);
    await rejects(() => command(r, 'reconcile_complete', settlement(), CUSTOMER), /Administrator required/);
    await rejects(() => command({ ...r, version: r.version - 1 }, 'reconcile_complete', settlement()), /REQUEST_CONFLICT/);
    await query("UPDATE profiles SET kyc_status='pending' WHERE id=$1", [CUSTOMER]);
    await rejects(() => command(r, 'reconcile_complete', settlement()), /Current identity approval/);
    await query("UPDATE profiles SET kyc_status='approved' WHERE id=$1", [CUSTOMER]);
    await rejects(() => command(r, 'reconcile_complete', { ...settlement(), payer_account_id: AUD }), /Settlement accounts/);
    assert.equal((await get(r.id)).status, 'ready');
    assert.equal(await count('exchange_request_executions', r.id), 0);
    assert.equal(await count('exchange_request_completion_receipts', r.id), 0);
  });

  test('outer financial commands preserve the exact accounting date for midnight retries', async () => {
    const old = await one('SELECT accounting_date_jalali FROM exchange_request_commands WHERE request_id=$1 LIMIT 1', [oldCompleted.id]);
    assert.equal(old.accounting_date_jalali, null);
    let r = await command(await submit(), 'await_funds');
    const original = r, fundingKey = randomUUID(), payload = { ...funding(r), date_jalali: '1405/06/23' };
    r = await command(original, 'confirm_funds', payload, ADMIN, fundingKey);
    const stored = await one('SELECT accounting_date_jalali FROM exchange_request_commands WHERE request_id=$1 AND command_key=$2', [r.id, fundingKey]);
    assert.equal(stored.accounting_date_jalali, '1405/06/23');
    assert.deepEqual(await command(original, 'confirm_funds', payload, ADMIN, fundingKey), r);
    await rejects(() => command(original, 'confirm_funds', { ...payload, date_jalali: '1405/06/24' }, ADMIN, fundingKey), /IDEMPOTENCY_CONFLICT/);
    const finalKey = randomUUID(), finalPayload = { ...settlement(), date_jalali: '1405/06/23' };
    const completed = await command(r, 'reconcile_complete', finalPayload, ADMIN, finalKey);
    assert.equal((await one('SELECT accounting_date_jalali FROM exchange_request_commands WHERE request_id=$1 AND command_key=$2', [r.id, finalKey])).accounting_date_jalali, '1405/06/23');
    assert.deepEqual(await command(r, 'reconcile_complete', finalPayload, ADMIN, finalKey), completed);
    await rejects(() => command(r, 'reconcile_complete', { ...finalPayload, date_jalali: '1405/06/24' }, ADMIN, finalKey), /IDEMPOTENCY_CONFLICT/);
    assert.equal(Number((await one('SELECT count(*) AS n FROM ledger WHERE transaction_id=$1', [r.transaction_id])).n), 1);
  });

  test('late audit failure rolls back both internal commands, receipt, ledger and email jobs', async () => {
    let r = await command(await submit('priority'), 'await_funds');
    r = await command(r, 'confirm_funds', funding(r));
    await db.exec(`CREATE FUNCTION reject_final_reconciliation_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.action='REQUEST_RECONCILE_COMPLETE' THEN RAISE EXCEPTION 'Final audit rejected'; END IF; RETURN NEW; END; $$;
      CREATE TRIGGER reject_final_reconciliation_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_final_reconciliation_audit();`);
    const before = await snapshot(r.id), commands = await count('exchange_request_commands', r.id), key = randomUUID(), payload = settlement();
    await rejects(() => command(r, 'reconcile_complete', payload, ADMIN, key), /Final audit rejected/);
    assert.equal((await get(r.id)).status, 'ready');
    assert.equal((await get(r.id)).version, r.version);
    assert.deepEqual(await snapshot(r.id), before);
    assert.equal(await count('exchange_request_commands', r.id), commands);
    assert.equal(await count('exchange_request_executions', r.id), 0);
    assert.equal(Number((await one('SELECT count(*) AS n FROM ledger WHERE transaction_id=$1', [r.transaction_id])).n), 0);
    await db.exec('DROP TRIGGER reject_final_reconciliation_audit ON audit_logs');
    const completed = await command(r, 'reconcile_complete', payload, ADMIN, key);
    assert.equal(completed.status, 'completed');
    assert.ok((await query("SELECT status FROM exchange_request_notification_deliveries WHERE request_id=$1 AND event_type='complete'", [r.id])).rows.every(j => j.status === 'skipped'));
  });

  test('existing processing completion works and private cores/direct receipt registration remain denied', async () => {
    let r = await command(await submit(), 'await_funds');
    r = await command(r, 'confirm_funds', funding(r));
    r = await command(r, 'start_processing');
    assert.equal((await command(r, 'complete', settlement())).status, 'completed');
    for (const role of ['anon', 'authenticated', 'service_role']) {
      for (const signature of ['transition_exchange_request_notification_core(uuid,uuid,integer,uuid,text,jsonb)',
        'transition_exchange_request_accounting_core(uuid,uuid,integer,uuid,text,jsonb)',
        'attach_exchange_request_receipt_core(uuid,uuid,uuid,text,text,text,integer,text,uuid)']) {
        assert.equal((await one('SELECT has_function_privilege($1,$2,\'EXECUTE\') AS allowed', [role, signature])).allowed, false);
      }
    }
    assert.equal((await one("SELECT has_table_privilege('service_role','exchange_request_receipts','INSERT') AS allowed")).allowed, false);
  });
});
