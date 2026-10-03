// Offline PostgreSQL regressions; no credentials, production reads or mail sends.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const migration = 'supabase/migrations/20261003_46_customer_only_email_recovery.APPLY_MANUALLY.sql';
const payload = { to: ['customer@example.test'], from: 'Zarman <mail@example.test>', subject: 'Transfer update', html: '<p>Update</p>', text: 'Update' };
async function setup(apply = true, latest = false) {
  const db = new PGlite();
  await db.exec(read('scripts/fixtures/customer-requests.sql'));
  // Match the ordinary recipient baseline column used by the archive migration.
  await db.exec('alter table recipients add column created_at timestamptz not null default now()');
  for (const filename of [
    '20260802_09_enterprise_reporting.sql', '20260802_10_ledger_accounting_controls.sql',
    '20260802_13_standardize_trade_fee_accounting.sql', '20260911_18_customer_requests.sql',
    '20260911_19_request_notifications.sql', '20260913_23_request_funding_and_receipts.sql',
    '20260913_24_request_receipt_notifications.sql', '20260913_25_request_fee_accounting.sql',
    '20260913_26_request_fee_ledger_type.sql', '20260913_27_request_messages_and_notifications.sql',
    '20260913_28_request_bank_details.sql',
    ...(latest ? [
      '20260915_29_request_payment_approval.sql', '20260915_30_request_customer_actions_and_received_funds.sql',
      '20260920_31_account_reconciliations.sql', '20260920_32_recipient_bank_city.sql',
      '20260921_33_customer_request_realtime_signals.sql', '20260921_34_recipient_relationship.sql',
      '20260924_35_admin_hard_delete.sql', '20260924_36_iran_bank_fee_1405.sql',
      '20260929_37_customer_kyc_evidence.APPLY_MANUALLY.sql', '20260930_38_payment_account_access.APPLY_MANUALLY.sql',
      '20260930_39_optional_institution_reference.APPLY_MANUALLY.sql', '20260930_40_quote_validity_one_hour.sql',
      '20260930_41_optional_banking_notices.APPLY_MANUALLY.sql', '20261001_42_recipient_archive.APPLY_MANUALLY.sql',
      '20261002_43_request_accounting_overrides.APPLY_MANUALLY.sql',
    ] : []),
    '20261003_44_request_immediate_admin_email.APPLY_MANUALLY.sql',
    ...(latest ? ['20261003_45_customer_approved_summary.APPLY_MANUALLY.sql'] : []),
  ]) await db.exec(read(`supabase/migrations/${filename}`));
  const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
  const user = randomUUID(), admin = randomUUID();
  await db.query("insert into auth.users(id,email) values($1,'customer@example.test')", [user]);
  await db.query(`insert into auth.users(id,email,raw_app_meta_data) values($1,'admin@example.test','{"role":"admin"}')`, [admin]);
  await db.query("insert into profiles(id,kyc_status) values($1,'approved')", [user]);
  await db.query('update exchange_request_settings set settings=settings||$1::jsonb', [{
    management_emails: ['management@example.test'],
    payment_details_aud: { account_name: 'Test', bsb: '123456', account_number: '12345678' },
    payment_details_irt: { account_name: 'Test', account_number: '12345678' },
  }]);
  if (apply) await db.exec(read(migration));
  const request = async () => {
    const id = randomUUID(), transaction = randomUUID(), quote = randomUUID();
    const snapshot = { locale: 'fa', sender_snapshot: { name: 'Snapshot Sender' }, recipient_snapshot: { full_name: 'Snapshot Recipient' },
      funding_total: 1000, funding_currency: 'AUD', recipient_amount: 100000000, recipient_currency: 'IRT',
      base_fee_aud: 0, priority_fee_aud: 0, priority_fee_amount: 0, applied_rate: 100000, service_tier: 'standard',
      policy_snapshot: (await one('select settings from exchange_request_settings where id')).settings };
    await db.query("insert into transactions(id,user_id,type,amount_aud,equivalent_toman) values($1,$2,'buy_aud',1000,100000000)", [transaction, user]);
    await db.query("insert into exchange_request_quotes(id,user_id,snapshot,expires_at) values($1,$2,$3,now()+interval '1 hour')", [quote, user, snapshot]);
    await db.query("insert into exchange_requests(id,transaction_id,user_id,quote_id,idempotency_key,reference_code,quote,service_tier,priority_fee_status,funding_due_at,clearance_due_at,payment_instructions) values($1,$2,$3,$4,$5,$6,$7,'standard','not_applicable',now()+interval '1 day',now()+interval '2 days','Synthetic instructions')", [id, transaction, user, quote, randomUUID(), `ZE${randomUUID()}`, snapshot]);
    return { id, transaction, snapshot };
  };
  const emit = async (id, type = 'review', actor = admin, email = true, message = null) => {
    await db.query("select set_config('app.exchange_request_send_email',$1,false)", [String(email)]);
    return (await one('select emit_exchange_request_event($1,$2,$3,$4) id', [id, type, actor, message])).id;
  };
  const customer = async event => one("select * from exchange_request_notification_deliveries where event_id=$1 and audience='customer'", [event]);
  const delivery = async id => one('select * from exchange_request_notification_deliveries where id=$1', [id]);
  const retry = async (requestId, deliveryId, actor = admin) => (await one('select retry_request_notification($1,$2,$3) result', [actor, requestId, deliveryId])).result;
  return { db, one, user, admin, request, emit, customer, delivery, retry };
}

test('_46 recovers the observed never-prepared Sending job and retires management without losing immutable history', async () => {
  const f = await setup(false);
  try {
    const r = await f.request(), event = await f.emit(r.id), customer = await f.customer(event);
    const manager = await f.one("select * from exchange_request_notification_deliveries where event_id=$1 and audience='management'", [event]);
    await f.db.query("update exchange_request_notification_deliveries set status='leased',attempts=1,lease_owner=$1,lease_expires_at=now()-interval '25 hours' where event_id=$2", [randomUUID(), event]);
    await f.db.query("update exchange_request_notification_deliveries set first_attempt_at=now()-interval '25 hours',rendered_payload=$2,template_version='old' where id=$1", [manager.id, { ...payload, to: [manager.recipient_email] }]);
    const frozenManagement = await f.delivery(manager.id);
    const ambiguousRequest = await f.request(), ambiguous = await f.customer(await f.emit(ambiguousRequest.id));
    await f.db.query("update exchange_request_notification_deliveries set status='leased',lease_expires_at=now()-interval '1 minute',first_attempt_at=now()-interval '24 hours' where id=$1", [ambiguous.id]);
    const acceptedRequest = await f.request(), accepted = await f.customer(await f.emit(acceptedRequest.id));
    await f.db.query("update exchange_request_notification_deliveries set status='provider_accepted',provider_id='already-sent',first_attempt_at=now()-interval '25 hours',provider_accepted_at=now()-interval '25 hours' where id=$1", [accepted.id]);
    const acceptedBefore = await f.delivery(accepted.id);
    await f.db.exec(read(migration));
    assert.equal((await f.delivery(customer.id)).status, 'pending');
    assert.equal((await f.delivery(customer.id)).first_attempt_at, null);
    assert.equal((await f.delivery(ambiguous.id)).status, 'reconciliation_required');
    assert.deepEqual(await f.delivery(accepted.id), acceptedBefore);
    const retired = await f.delivery(manager.id);
    assert.equal(retired.status, 'skipped'); assert.equal(retired.last_error, 'management_email_disabled');
    for (const field of ['id', 'first_attempt_at', 'rendered_payload', 'payload_snapshot', 'created_at', 'attempts']) assert.deepEqual(retired[field], frozenManagement[field]);
    const claims = (await f.db.query('select * from claim_request_notifications_for_request($1,$2,25,120)', [randomUUID(), r.id])).rows;
    assert.deepEqual(claims.map(d => d.id), [customer.id]);
    await f.db.exec(read(migration)); // Deployment retry is safe; accepted/history states stay intact.
    assert.equal((await f.delivery(customer.id)).status, 'leased');
  } finally { await f.db.close(); }
});

test('only explicitly approved customer emails enqueue with accepted transfer snapshots; completion receipt is unchanged', async () => {
  const f = await setup();
  try {
    const r = await f.request();
    for (const [type, actor, tick] of [['review', f.admin, false], ['receipt_uploaded', f.user, true], ['expired', null, true]]) {
      assert.equal((await f.customer(await f.emit(r.id, type, actor, tick))).status, 'skipped');
    }
    await f.db.query("select set_config('app.exchange_request_send_email','',false)");
    const implicitEvent = await f.one("select emit_exchange_request_event($1,'review',$2,null) id", [r.id, f.admin]);
    assert.equal((await f.customer(implicitEvent.id)).status, 'skipped');
    const approved = await f.customer(await f.emit(r.id));
    assert.equal(approved.status, 'pending');
    for (const [field, value] of Object.entries({ sender_name: 'Snapshot Sender', recipient_name: 'Snapshot Recipient', recipient_amount: 100000000, recipient_currency: 'IRT' })) assert.equal(approved.payload_snapshot[field], value);
    assert.equal((await f.one("select count(*)::int n from exchange_request_notification_deliveries where audience='management'")).n, 0);
    await assert.rejects(f.db.query("insert into exchange_request_notification_deliveries(request_id,event_id,event_sequence,event_type,audience,recipient_email,locale,reference,workflow_status,requested_tier) values($1,$2,1,'review','management','manager@example.test','en','ZE1','submitted','standard')", [r.id, approved.event_id]), /Only customer/);
    await f.db.exec("select set_config('app.exchange_request_write','on',false)");
    await f.db.query("update transactions set status='approved' where id=$1", [r.transaction]);
    await f.db.query("update exchange_requests set status='completed',funding_status='confirmed' where id=$1", [r.id]);
    await f.db.query("insert into exchange_request_executions(request_id,status,claimed_by,settlement_reference,settled_at) values($1,'settled',$2,'PRIVATE',now())", [r.id, f.admin]);
    const completion = await f.customer(await f.emit(r.id, 'complete'));
    const receipt = (await f.one('select snapshot from exchange_request_completion_receipts where request_id=$1', [r.id])).snapshot;
    assert.deepEqual(completion.payload_snapshot.receipt, receipt);
    assert.equal(receipt.sender_name, 'Snapshot Sender'); assert.equal(receipt.recipient_name, 'Snapshot Recipient');
    assert.doesNotMatch(JSON.stringify(receipt), /PRIVATE/);
    await assert.rejects(f.db.query("update exchange_request_completion_receipts set snapshot='{}' where request_id=$1", [r.id]), /immutable/);
  } finally { await f.db.close(); }
});

test('manual claims respect ordering, backoff, request boundaries and active leases; no global scheduled claim remains', async () => {
  const f = await setup();
  try {
    const r = await f.request(), other = await f.request(), worker = randomUUID();
    const first = await f.customer(await f.emit(r.id)), second = await f.customer(await f.emit(r.id, 'reject'));
    const otherMail = await f.customer(await f.emit(other.id));
    await f.db.query("update exchange_request_notification_deliveries set next_attempt_at=now()+interval '1 hour' where id=$1", [first.id]);
    assert.equal((await f.db.query('select * from claim_request_notifications_for_request($1,$2,25,120)', [worker, r.id])).rows.length, 0);
    await assert.rejects(f.db.query('select * from claim_request_notifications($1,25,120)', [worker]), /does not exist/);
    const scoped = (await f.db.query('select * from claim_request_notifications_for_request($1,$2,25,120)', [worker, other.id])).rows;
    assert.deepEqual(scoped.map(d => d.id), [otherMail.id]);
    await f.db.query('update exchange_request_notification_deliveries set next_attempt_at=now() where id=$1', [first.id]);
    assert.deepEqual((await f.db.query('select * from claim_request_notifications_for_request($1,$2,25,120)', [worker, r.id])).rows.map(d => d.id), [first.id]);
    assert.equal((await f.db.query('select * from claim_request_notifications_for_request($1,$2,25,120)', [randomUUID(), r.id])).rows.length, 0);
    await f.db.query("update exchange_request_notification_deliveries set lease_expires_at=now()-interval '1 second',first_attempt_at=now()-interval '24 hours' where id=$1", [first.id]);
    assert.equal((await f.db.query('select * from claim_request_notifications_for_request($1,$2,25,120)', [randomUUID(), r.id])).rows.length, 0);
    assert.equal((await f.delivery(first.id)).status, 'reconciliation_required');
    assert.equal((await f.delivery(second.id)).status, 'pending', 'ambiguous older milestone blocks unsafe ordering');
    await assert.rejects(f.db.query('select * from claim_request_notifications_for_request($1,$2,null,120)', [worker, r.id]), /Invalid/);
    await assert.rejects(f.db.query('select * from claim_request_notifications_for_request($1,null,1,120)', [worker]), /Invalid/);
  } finally { await f.db.close(); }
});

test('explicit retries retain identity and payload, enforce admin approval and never reopen sent or unsafe deliveries', async () => {
  const f = await setup();
  try {
    const r = await f.request(), d = await f.customer(await f.emit(r.id));
    await assert.rejects(f.retry(r.id, d.id, f.user), /Administrator/);
    await assert.rejects(f.retry(randomUUID(), d.id), /unavailable/);
    await f.db.query("update exchange_request_notification_deliveries set status='failed',first_attempt_at=now()-interval '1 hour',rendered_payload=$2,template_version='original' where id=$1", [d.id, payload]);
    const before = await f.delivery(d.id), retried = await f.retry(r.id, d.id);
    assert.equal(retried.status, 'pending'); assert.equal(retried.id, d.id);
    assert.equal(Date.parse(retried.first_attempt_at), +before.first_attempt_at);
    assert.deepEqual(retried.rendered_payload, payload); assert.equal(retried.template_version, 'original');
    assert.equal((await f.one("select count(*)::int n from audit_logs where action='REQUEST_EMAIL_RETRY'")).n, 1);
    for (const status of ['provider_accepted', 'delivered', 'suppressed', 'skipped', 'reconciliation_required']) {
      const row = await f.customer(await f.emit(r.id));
      await f.db.query('update exchange_request_notification_deliveries set status=$2 where id=$1', [row.id, status]);
      await assert.rejects(f.retry(r.id, row.id), /cannot be retried/);
    }
    for (const status of ['failed', 'pending']) {
      const row = await f.customer(await f.emit(r.id));
      await f.db.query("update exchange_request_notification_deliveries set status=$2,provider_id=$3 where id=$1", [row.id, status, randomUUID()]);
      await assert.rejects(f.retry(r.id, row.id), /cannot be retried/);
    }
    const active = await f.customer(await f.emit(r.id));
    await f.db.query("update exchange_request_notification_deliveries set status='leased',lease_expires_at=now()+interval '1 minute' where id=$1", [active.id]);
    await assert.rejects(f.retry(r.id, active.id), /cannot be retried/);
    await f.db.query("update exchange_request_notification_deliveries set lease_expires_at=now()-interval '1 minute' where id=$1", [active.id]);
    assert.equal((await f.retry(r.id, active.id)).status, 'pending');
    const stale = await f.customer(await f.emit(r.id));
    await f.db.query("update exchange_request_notification_deliveries set status='failed',first_attempt_at=now()-interval '24 hours' where id=$1", [stale.id]);
    assert.equal((await f.retry(r.id, stale.id)).status, 'reconciliation_required');
    assert.equal((await f.delivery(stale.id)).status, 'reconciliation_required', 'state commits instead of rolling back with an exception');
  } finally { await f.db.close(); }
});

test('prepared payloads have one customer recipient, no cc/bcc, immutable content and service-only RPC permissions', async () => {
  const f = await setup();
  try {
    const r = await f.request(), worker = randomUUID(), d = await f.customer(await f.emit(r.id));
    await f.db.query('select * from claim_request_notifications_for_request($1,$2,1,120)', [worker, r.id]);
    const prepare = body => f.db.query("select prepare_request_notification($1,$2,$3,'test')", [d.id, worker, body]);
    for (const body of [{ ...payload, cc: ['manager@example.test'] }, { ...payload, bcc: [] }, { ...payload, to: undefined }, { ...payload, to: 'customer@example.test' }, { ...payload, to: ['customer@example.test', 'manager@example.test'] }, { ...payload, html: null }]) await assert.rejects(prepare(body), /Invalid notification payload/);
    await prepare(payload);
    await assert.rejects(prepare({ ...payload, subject: 'changed' }), /immutable/);
    await f.db.exec('set role authenticated');
    await assert.rejects(f.db.query('select * from claim_request_notifications_for_request($1,$2,1,120)', [worker, r.id]), /permission denied/);
    await assert.rejects(f.db.query('select retry_request_notification($1,$2,$3)', [f.admin, r.id, d.id]), /permission denied/);
    await f.db.exec('reset role');
    await f.db.query("update exchange_request_notification_deliveries set lease_expires_at=null,lease_owner=null where id=$1", [d.id]);
    await assert.rejects(f.db.query("select prepare_request_notification($1,null,$2,'test')", [d.id, payload]), /lease lost/);
  } finally { await f.db.close(); }
});

test('selected-delivery retry only claims that email and cannot bypass an unresolved earlier milestone', async () => {
  const f = await setup();
  try {
    const r = await f.request(), first = await f.customer(await f.emit(r.id)), second = await f.customer(await f.emit(r.id));
    const worker = randomUUID();
    assert.equal((await f.db.query('select * from claim_request_notifications_for_request($1,$2,25,120,$3)', [worker, r.id, second.id])).rows.length, 0);
    const selected = (await f.db.query('select * from claim_request_notifications_for_request($1,$2,25,120,$3)', [worker, r.id, first.id])).rows;
    assert.deepEqual(selected.map(d => d.id), [first.id]);
    await f.db.query("select prepare_request_notification($1,$2,$3,'test')", [first.id, worker, payload]);
    await f.db.query("select finish_request_notification($1,$2,'provider_accepted','synthetic-provider',null,null)", [first.id, worker]);
    assert.equal((await f.db.query('select * from claim_request_notifications_for_request($1,$2,25,120,$3)', [worker, r.id, first.id])).rows.length, 0);
    assert.equal((await f.delivery(second.id)).status, 'pending', 'selected retry does not send another milestone');
    const wrongRequest = await f.request();
    assert.equal((await f.db.query('select * from claim_request_notifications_for_request($1,$2,25,120,$3)', [worker, wrongRequest.id, second.id])).rows.length, 0);
    assert.deepEqual((await f.db.query('select * from claim_request_notifications_for_request($1,$2,25,120,$3)', [worker, r.id, second.id])).rows.map(d => d.id), [second.id]);
  } finally { await f.db.close(); }
});

test('request settings can enable customer service without any management address and retain bank validation', async () => {
  const f = await setup();
  try {
    const current = await f.one('select settings,version from exchange_request_settings where id');
    assert.equal('management_emails' in current.settings, false);
    const saved = (await f.one('select save_exchange_request_settings($1,$2,$3) result', [f.admin, current.version, { ...current.settings, enabled: true }])).result;
    assert.equal(saved.settings.enabled, true); assert.equal('management_emails' in saved.settings, false);
    await assert.rejects(f.db.query('select save_exchange_request_settings($1,$2,$3)', [f.admin, saved.version, { ...saved.settings, payment_details_aud: {} }]), /bank details/);
    const legacyInput = (await f.one('select save_exchange_request_settings($1,$2,$3) result', [f.admin, saved.version, { ...saved.settings, management_emails: ['legacy@example.test'] }])).result;
    assert.equal('management_emails' in legacyInput.settings, false);
  } finally { await f.db.close(); }
});

test('_46 preserves every later request wrapper, payment approval snapshots, optional notices and existing default settings', async () => {
  const f = await setup(false, true);
  try {
    const definitions = async () => (await f.db.query(`select proname,pg_get_functiondef(oid) definition from pg_proc
      where pronamespace='public'::regnamespace and proname in ('save_exchange_request_settings',
        'transition_exchange_request','transition_exchange_request_notification_core','transition_exchange_request_accounting_core',
        'send_exchange_request_message','snapshot_request_delivery_bank_details','snapshot_request_customer_action',
        'submit_exchange_request','admin_hard_delete_transaction') order by proname`)).rows;
    const beforeFunctions = await definitions();
    const beforeSettings = await f.one('select * from exchange_request_settings where id');
    assert.equal(beforeSettings.settings.quote_minutes, 60);
    // Simulate a customized deployed default; only the retired field may change.
    const customDefault = { ...beforeSettings.settings, quote_minutes: 45, deployment_specific: 'retain-me' };
    await f.db.exec(`alter table exchange_request_settings alter column settings set default '${JSON.stringify(customDefault).replaceAll("'", "''")}'::jsonb`);
    await f.db.exec(read(migration));
    assert.deepEqual(await definitions(), beforeFunctions);
    const afterSettings = await f.one('select * from exchange_request_settings where id');
    const { management_emails: removed, ...expectedSettings } = beforeSettings.settings;
    assert.ok(removed); assert.deepEqual(afterSettings, { ...beforeSettings, settings: expectedSettings });
    const defaultExpression = (await f.one(`select pg_get_expr(d.adbin,d.adrelid) expression from pg_attrdef d
      join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum
      where d.adrelid='exchange_request_settings'::regclass and a.attname='settings'`)).expression;
    const { management_emails: ignored, ...expectedDefault } = customDefault;
    assert.ok(ignored);
    assert.deepEqual((await f.one(`select ${defaultExpression} value`)).value, expectedDefault);
    const updated = (await f.one('select save_exchange_request_settings($1,$2,$3) result', [f.admin, afterSettings.version,
      { ...afterSettings.settings, enabled: true, iran_banking_notice: '', iran_banking_notice_fa: '',
        payment_instructions_aud_fa: 'Synthetic Persian payment instructions' }])).result;
    assert.equal(updated.settings.iran_banking_notice, ''); assert.equal(updated.settings.iran_banking_notice_fa, '');
    assert.equal(updated.version, beforeSettings.version + 1, 'normal settings saves retain optimistic versioning');
    const r = await f.request();
    const hidden = await f.customer(await f.emit(r.id, 'await_funds'));
    assert.equal('payment_instructions' in hidden.payload_snapshot, false, 'unapproved bank details remain hidden');
    assert.equal('payment_details' in hidden.payload_snapshot, false);
    await f.db.query("update exchange_requests set customer_action_required='Synthetic customer question' where id=$1", [r.id]);
    assert.equal((await f.customer(await f.emit(r.id, 'review'))).payload_snapshot.customer_action_required, 'Synthetic customer question');
    await f.db.query('select transition_exchange_request($1,$2,1,$3,$4,$5)', [f.admin, r.id, randomUUID(), 'await_funds', { send_email: true }]);
    const approved = await f.one("select payload_snapshot from exchange_request_notification_deliveries where request_id=$1 and event_type='await_funds' order by event_sequence desc limit 1", [r.id]);
    assert.deepEqual(approved.payload_snapshot.payment_details, updated.settings.payment_details_aud);
    assert.equal(approved.payload_snapshot.payment_instructions_fa, 'Synthetic Persian payment instructions');
    assert.ok(approved.payload_snapshot.payment_approved_at);
    assert.equal(approved.payload_snapshot.customer_action_required, null);
    assert.equal(approved.payload_snapshot.recipient_name, 'Snapshot Recipient');
    assert.equal((await f.one("select count(*)::int n from exchange_request_notification_deliveries where audience='management'")).n, 0);
    await f.db.exec(read(migration));
    assert.deepEqual(await definitions(), beforeFunctions);
  } finally { await f.db.close(); }
});
