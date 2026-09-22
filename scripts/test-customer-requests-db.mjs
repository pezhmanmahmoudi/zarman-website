// Isolated PostgreSQL integration suite: real workflow migrations, synthetic
// baseline and identities only. No network, environment files or live data.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { before, after, beforeEach, afterEach, describe, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import vm from 'node:vm';
import ts from 'typescript';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
function compile(path, imports = {}) {
  const compiled = { exports: {} };
  const js = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInThisContext(`(function(require,module,exports){${js}\n})`)((name) => {
    if (name in imports) return imports[name];
    throw new Error(`Unexpected test dependency: ${name}`);
  }, compiled, compiled.exports);
  return compiled.exports;
}
const accounting = compile('lib/accounting-engine.ts', { '@/lib/pricing': compile('lib/pricing.ts') });
const CUSTOMER = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';
const ADMIN = '00000000-0000-4000-8000-000000000003';
const AUD = '10000000-0000-4000-8000-000000000001';
const IRT = '10000000-0000-4000-8000-000000000002';
const RECIPIENT = '20000000-0000-4000-8000-000000000001';
let db;
const query = (sql, args = []) => db.query(sql, args);
const one = async (sql, args = []) => (await query(sql, args)).rows[0];
const rpc = async (sql, args = []) => (await one(sql, args)).result;
const get = (id) => one('SELECT * FROM exchange_requests WHERE id=$1', [id]);
const count = async (table, request) => Number((await one(`SELECT count(*) AS n FROM ${table} WHERE request_id=$1`, [request])).n);
const command = (r, action, payload = {}, actor = ADMIN, key = randomUUID()) => rpc(
  'SELECT transition_exchange_request($1,$2,$3,$4,$5,$6) AS result', [actor, r.id, r.version, key, action, { date_jalali: '1405/06/22', ...payload }]);
const funding = (r, overrides = {}) => ({ received_amount: Number(r.quote.funding_total), received_currency: 'AUD',
  payment_reference: `bank-${randomUUID()}`, receiver_account_id: AUD, ...overrides });
const settlement = () => ({ settlement_reference: `settled-${randomUUID()}`, payer_account_id: IRT,
  receiver_account_id: AUD, transfer_method: 'satna', date_jalali: '1405/06/22' });
async function quote(tier = 'standard', customer = CUSTOMER, txType = 'sell_aud') {
  const policy = (await one('SELECT version,settings FROM exchange_request_settings WHERE id'));
  const recipient = await one('SELECT * FROM recipients WHERE id=$1', [RECIPIENT]);
  const q = { raw_amount_aud: 1000, equivalent_toman: 970000, applied_rate: 1000, base_fee_aud: 30,
    priority_fee_aud: tier === 'priority' ? 20 : 0, priority_fee_amount: tier === 'priority' ? 20 : 0,
    funding_currency: 'AUD', funding_total: tier === 'priority' ? 1020 : 1000,
    recipient_amount: 970000, recipient_currency: 'IRT', service_tier: tier, locale: 'en',
    customer_request_type: 'sell_aud', company_trade_type: 'buy_aud', source_of_funds: 'Savings',
    reason_for_transfer: 'Family support', recipient_id: RECIPIENT, recipient_snapshot: recipient,
    sender_snapshot: { name: 'Synthetic Customer' }, policy_version: policy.version, policy_snapshot: policy.settings };
  if (txType === 'buy_aud') Object.assign(q, { equivalent_toman: 1030000, customer_request_type: 'buy_aud', company_trade_type: 'sell_aud',
    funding_currency: 'IRT', recipient_currency: 'AUD', recipient_amount: 1000,
    priority_fee_amount: tier === 'priority' ? 20000 : 0, funding_total: tier === 'priority' ? 1050000 : 1030000 });
  return (await one("INSERT INTO exchange_request_quotes(user_id,snapshot,expires_at) VALUES($1,$2,now()+interval '10 minutes') RETURNING id", [customer, q])).id;
}
const submit = (quoteId, customer = CUSTOMER, key = randomUUID()) => rpc(
  'SELECT submit_exchange_request($1,$2,$3) AS result', [customer, quoteId, key]);
const request = async (tier = 'standard') => submit(await quote(tier));
async function cashSnapshot() {
  const rows = (await query('SELECT * FROM ledger ORDER BY date_gregorian,created_at,id')).rows.map(row => ({ ...row,
    date_gregorian: row.date_gregorian instanceof Date ? row.date_gregorian.toISOString().slice(0, 10) : row.date_gregorian,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at }));
  const earnings = Number((await one('SELECT get_exchange_request_fee_income() AS total')).total);
  return accounting.calcAccountingSnapshot(rows, [], [], [
    { id: AUD, name: 'AUD account', currency: 'AUD', type: 'bank' },
    { id: IRT, name: 'IRT account', currency: 'IRT', type: 'bank' },
  ], 1000, earnings);
}
async function attach(r, options = {}) {
  const actor = options.actor ?? CUSTOMER;
  const receiptId = options.id ?? randomUUID();
  const path = options.path ?? `${actor}/${r.id}/${receiptId}.pdf`;
  const hash = options.sha256 ?? 'a'.repeat(64);
  if (options.object !== false) await query("INSERT INTO storage.objects(bucket_id,name) VALUES('exchange-request-receipts',$1) ON CONFLICT DO NOTHING", [path]);
  return rpc('SELECT attach_exchange_request_receipt($1,$2,$3,$4,$5,$6,$7,$8,$9) AS result',
    [actor, r.id, receiptId, path, options.name ?? 'Bank receipt.pdf', options.type ?? 'application/pdf', options.size ?? 1000, hash, options.key ?? randomUUID()]);
}
async function rejects(work, pattern) {
  // A failed SQL command aborts a PostgreSQL transaction. A savepoint lets each
  // test verify the committed aggregate after rejection without resetting it.
  await db.exec('SAVEPOINT expected_failure');
  await assert.rejects(work, pattern);
  await db.exec('ROLLBACK TO SAVEPOINT expected_failure');
}

describe('customer request PostgreSQL workflow', { concurrency: false }, () => {
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
  });
  after(async () => { await db?.close(); });
  beforeEach(async () => {
    // Production request accounting is UTC (the fee journal function sets it
    // explicitly). Keep current_date aligned with those canonical timestamps,
    // including when this suite runs after midnight in a non-UTC host zone.
    await db.exec("BEGIN; SET LOCAL TIME ZONE 'UTC'");
    await query("INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES($1,'customer@example.invalid','{}'),($2,'other@example.invalid','{}'),($3,'admin@example.invalid','{\"role\":\"admin\"}')", [CUSTOMER, OTHER, ADMIN]);
    await query("INSERT INTO profiles(id,email,kyc_status) SELECT id,email,'approved' FROM auth.users");
    await query("INSERT INTO bank_accounts(id,account_name,currency) VALUES($1,'Synthetic AUD','AUD'),($2,'Synthetic IRT','IRT')", [AUD, IRT]);
    await query("INSERT INTO recipients(id,user_id,direction,full_name,bank_name,account_number) VALUES($1,$2,'irt','Synthetic Recipient','Synthetic Bank','123456')", [RECIPIENT, CUSTOMER]);
    await query('INSERT INTO rates_history(date,buy_aud,sell_aud) VALUES(current_date,1000,1000)');
    await query("UPDATE exchange_request_settings SET settings=settings||$1::jsonb", [{ enabled: true, priority_enabled: true,
      priority_fee_aud: 20, priority_capacity: 10, management_emails: ['management@example.invalid'],
      payment_instructions_aud: 'Synthetic bank\nBSB 000-000\nAccount 123456', payment_instructions_irt: 'Synthetic Iranian account',
      priority_terms: 'Handling target after cleared funds. Banking cycles apply.', priority_terms_fa: 'Synthetic terms',
      business_days: [0, 1, 2, 3, 4, 5, 6], opening_hour: 0, closing_hour: 24 }]);
  });
  afterEach(async () => { await db.exec('ROLLBACK'); });

  test('submission provides immutable instructions and two ordered milestone snapshots exactly once', async () => {
    const q = await quote(); const key = randomUUID(); const r = await submit(q, CUSTOMER, key);
    assert.equal(r.status, 'awaiting_funds');
    assert.match(r.payment_instructions, /BSB 000-000/);
    assert.match(r.reference_code, /^ZE[A-F0-9]{12}$/);
    assert.equal(r.handling_due_at, null); assert.equal(r.funds_confirmed_at, null);
    assert.equal(new Date(r.clearance_due_at) - new Date(r.funding_due_at), 24 * 60 * 60 * 1000);
    assert.deepEqual(await submit(q, CUSTOMER, key), r);
    const events = (await query('SELECT event_type,status FROM exchange_request_events WHERE request_id=$1 ORDER BY sequence', [r.id])).rows;
    assert.deepEqual(events, [{ event_type: 'submitted', status: 'submitted' }, { event_type: 'await_funds', status: 'awaiting_funds' }]);
    assert.equal(await count('exchange_request_notification_deliveries', r.id), 4);
    const delivery = await one("SELECT payload_snapshot,reference FROM exchange_request_notification_deliveries WHERE request_id=$1 AND event_type='await_funds' LIMIT 1", [r.id]);
    assert.equal(delivery.payload_snapshot.payment_instructions, r.payment_instructions);
    assert.equal(delivery.reference, r.reference_code);
    await query("UPDATE exchange_request_settings SET settings=jsonb_set(settings,'{payment_instructions_aud}','\"Changed later\"')");
    assert.equal((await get(r.id)).payment_instructions, r.payment_instructions);
    await rejects(() => query("UPDATE exchange_requests SET quote=jsonb_set(quote,'{funding_total}','1') WHERE id=$1", [r.id]), /immutable/);
    await rejects(() => submit(q, OTHER), /Quote unavailable/);
    await rejects(async () => submit(await quote(), CUSTOMER, key), /IDEMPOTENCY_CONFLICT/);
  });

  test('private evidence is owned, deduplicated and never starts the handling clock', async () => {
    const r = await request('priority'); const key = randomUUID();
    const receipt = await attach(r, { key });
    assert.equal(receipt.uploaded_by, CUSTOMER); assert.equal(receipt.request_version, r.version + 1);
    assert.equal((await attach(r, { key })).id, receipt.id);
    assert.equal((await attach(r)).id, receipt.id);
    assert.equal(await count('exchange_request_receipts', r.id), 1);
    const saved = await get(r.id);
    assert.ok(saved.evidence_submitted_at); assert.equal(saved.funding_status, 'unpaid');
    assert.equal(Number(saved.funding_received), 0); assert.equal(saved.handling_due_at, null); assert.equal(saved.funds_confirmed_at, null);
    assert.equal(await count('exchange_request_events', r.id), 3);
    assert.equal(await count('exchange_request_notification_deliveries', r.id), 6);
    assert.equal((await one("SELECT public FROM storage.buckets WHERE id='exchange-request-receipts'")).public, false);
    await rejects(() => attach(r, { actor: OTHER }), /Request unavailable/);
    await rejects(() => attach(r, { object: false, sha256: 'b'.repeat(64) }), /object unavailable/);
    await rejects(() => attach(r, { path: `${OTHER}/${r.id}/${randomUUID()}.pdf` }), /Invalid receipt metadata/);
    await rejects(() => attach(r, { size: 5242881 }), /Invalid receipt metadata/);
    await rejects(() => attach(r, { name: '../private.pdf' }), /Invalid receipt metadata/);
    await rejects(() => attach(r, { name: 'folder\\private.pdf' }), /Invalid receipt metadata/);
    await rejects(() => attach(r, { key, sha256: 'b'.repeat(64) }), /IDEMPOTENCY_CONFLICT/);
    await rejects(() => query('UPDATE exchange_request_receipts SET original_name=$1 WHERE id=$2', ['Changed.pdf', receipt.id]), /immutable/);
  });

  test('upload count is bounded and terminal requests refuse new evidence', async () => {
    let r = await request();
    for (let n = 0; n < 10; n++) await attach(r, { sha256: n.toString(16).padStart(64, '0') });
    await rejects(() => attach(r, { sha256: 'f'.repeat(64) }), /upload limit/);
    r = await command(await get(r.id), 'cancel', {}, CUSTOMER);
    await rejects(() => attach(r, { sha256: 'e'.repeat(64) }), /no longer accepts/);
  });

  test('authenticated and anonymous users cannot invoke privileged RPCs or read private evidence', async () => {
    const r = await request();
    for (const role of ['authenticated', 'anon']) {
      await db.exec(`SET LOCAL ROLE ${role}`);
      await rejects(() => query('SELECT * FROM exchange_request_receipts'), /permission denied/);
      await rejects(() => command(r, 'confirm_funds', funding(r)), /permission denied/);
      await rejects(() => submit(randomUUID()), /permission denied/);
      await db.exec('RESET ROLE');
    }
    await db.exec('SET LOCAL ROLE service_role');
    await rejects(() => command(r, 'confirm_funds', funding(r), CUSTOMER), /Administrator required/);
    await rejects(() => command(r, 'cancel', {}, OTHER), /Request unavailable/);
    await db.exec('RESET ROLE');
  });

  test('Australian clearance is allowed after the initiation window; evidence is never cleared cash', async () => {
    let r = await request('priority');
    await query("UPDATE exchange_requests SET funding_due_at=now()-interval '2 hours',clearance_due_at=now()+interval '22 hours' WHERE id=$1", [r.id]);
    await attach(r);
    await rpc('SELECT sweep_exchange_request_deadlines() AS result');
    r = await get(r.id); assert.equal(r.status, 'awaiting_funds'); assert.equal(r.handling_due_at, null);
    r = await command(r, 'confirm_funds', funding(r));
    assert.equal(r.status, 'ready'); assert.equal(r.funding_status, 'confirmed'); assert.equal(r.priority_fee_status, 'paid');
    assert.equal(new Date(r.handling_due_at) - new Date(r.funds_confirmed_at), 30 * 60 * 1000);
    assert.equal(await count('exchange_request_fee_entries', r.id), 1);
  });

  test('fixed clearance allowance never extends on upload and overdues with evidence get one internal review task', async () => {
    const r = await request();
    await query("UPDATE exchange_requests SET funding_due_at=now()-interval '27 hours',clearance_due_at=now()-interval '1 hour' WHERE id=$1", [r.id]);
    const beforeUpload = await get(r.id);
    await attach(r);
    await rpc('SELECT sweep_exchange_request_deadlines() AS result');
    await rpc('SELECT sweep_exchange_request_deadlines() AS result');
    const after = await get(r.id);
    assert.equal(after.status, 'awaiting_funds'); assert.equal(after.handling_due_at, null);
    assert.equal(after.clearance_due_at.toISOString(), beforeUpload.clearance_due_at.toISOString());
    assert.equal(Number((await one("SELECT count(*) AS n FROM exchange_request_tasks WHERE request_id=$1 AND kind='funding_clearance_review'", [r.id])).n), 1);
    assert.equal(Number((await one("SELECT count(*) AS n FROM exchange_request_notification_deliveries WHERE request_id=$1 AND event_type='funding_clearance_review' AND audience='customer'", [r.id])).n), 0);
  });

  test('late cleared funds require explicit acceptance of the original quote and remain recoverable after expiry', async () => {
    let r = await request('priority'); const accepted = r.quote;
    await query("UPDATE exchange_requests SET clearance_due_at=now()-interval '1 hour' WHERE id=$1", [r.id]);
    await rpc('SELECT sweep_exchange_request_deadlines() AS result'); r = await get(r.id);
    assert.equal(r.status, 'expired');
    r = await command(r, 'confirm_funds', funding(r));
    assert.equal(r.status, 'action_required'); assert.equal(r.handling_due_at, null);
    assert.equal(r.funding_status, 'confirmed'); assert.deepEqual(r.quote, accepted);
    await rejects(() => command(r, 'resume_funded_request'), /Explicit acceptance/);
    await rejects(() => command(r, 'resume_funded_request', { honour_quote: true }, CUSTOMER), /Administrator required/);
    r = await command(r, 'resume_funded_request', { honour_quote: true });
    assert.equal(r.status, 'ready'); assert.deepEqual(r.quote, accepted);
    assert.equal(new Date(r.handling_due_at) - new Date(r.funds_confirmed_at), 30 * 60 * 1000);
    r = await command(r, 'start_processing');
    r = await command(r, 'complete', settlement()); assert.equal(r.status, 'completed');
  });

  test('partial and wrong-currency funds cannot start payout and are protected from automatic expiry', async () => {
    let r = await request();
    r = await command(r, 'confirm_funds', funding(r, { received_amount: 400 }));
    assert.equal(r.funding_status, 'partial'); assert.equal(r.handling_due_at, null);
    await query("UPDATE exchange_requests SET clearance_due_at=now()-interval '1 hour' WHERE id=$1", [r.id]);
    await rpc('SELECT sweep_exchange_request_deadlines() AS result'); r = await get(r.id);
    assert.equal(r.status, 'awaiting_funds');
    await rejects(() => command(r, 'start_processing'), /not ready/);
    await rejects(() => command(r, 'resume_funded_request', { honour_quote: true }), /Only reconciled/);
    r = await command(r, 'confirm_funds', funding(r, { received_amount: 600, received_currency: 'IRT', receiver_account_id: IRT }));
    assert.equal(r.status, 'action_required'); assert.equal(Number(r.funding_received), 400);
    await rejects(() => command(r, 'resume_funded_request', { honour_quote: true }), /Only reconciled/);
  });

  test('KYC or AML holds stop readiness and payout; a cleared hold resumes without recording cash twice', async () => {
    let r = await request('priority');
    await query('UPDATE profiles SET compliance_customer_flagged=true WHERE id=$1', [CUSTOMER]);
    r = await command(r, 'confirm_funds', funding(r));
    assert.equal(r.status, 'under_review'); assert.equal(r.funding_status, 'confirmed'); assert.equal(r.handling_due_at, null);
    await rejects(() => command(r, 'resume_funded_request'), /identity approval/);
    await query('UPDATE profiles SET compliance_customer_flagged=false WHERE id=$1', [CUSTOMER]);
    r = await command(r, 'resume_funded_request'); assert.equal(r.status, 'ready');
    assert.equal(await count('exchange_request_payments', r.id), 1);
    await query("UPDATE profiles SET compliance_aml_flag='review_required' WHERE id=$1", [CUSTOMER]);
    await rejects(() => command(r, 'start_processing'), /identity approval/);
    assert.equal(await count('exchange_request_executions', r.id), 0);
  });

  test('processing waits for verified settlement and atomically completes ledger, fees, receipt and emails once', async () => {
    let r = await request('priority'); r = await command(r, 'confirm_funds', funding(r));
    const claimKey = randomUUID(); const ready = r;
    r = await command(ready, 'start_processing', {}, ADMIN, claimKey);
    assert.deepEqual(await command(ready, 'start_processing', {}, ADMIN, claimKey), r);
    assert.equal(r.status, 'processing'); assert.equal(await count('exchange_request_executions', r.id), 1);
    assert.equal(await count('exchange_request_completion_receipts', r.id), 0);
    assert.equal(Number((await one('SELECT count(*) AS n FROM ledger WHERE transaction_id=$1', [r.transaction_id])).n), 0);
    await rejects(() => command(r, 'complete', { ...settlement(), settlement_reference: '' }), /settlement reference/);
    const beforeComplete = r; const payload = settlement(); const key = randomUUID();
    r = await command(r, 'complete', payload, ADMIN, key);
    assert.deepEqual(await command(beforeComplete, 'complete', payload, ADMIN, key), r);
    assert.equal(r.status, 'completed'); assert.equal(await count('exchange_request_completion_receipts', r.id), 1);
    assert.equal(Number((await one('SELECT count(*) AS n FROM ledger WHERE transaction_id=$1', [r.transaction_id])).n), 1);
    assert.equal(Number((await one('SELECT count(*) AS n FROM bank_transfer_fee_accruals WHERE transaction_id=$1', [r.transaction_id])).n), 1);
    assert.equal((await one('SELECT status FROM transactions WHERE id=$1', [r.transaction_id])).status, 'approved');
    assert.equal(Number((await one("SELECT count(*) AS n FROM exchange_request_notification_deliveries WHERE request_id=$1 AND event_type='complete'", [r.id])).n), 2);
    const receipt = (await one('SELECT snapshot FROM exchange_request_completion_receipts WHERE request_id=$1', [r.id])).snapshot;
    assert.equal(receipt.reference_code, r.reference_code); assert.equal(receipt.funding_total, 1020);
    await rejects(() => query("UPDATE exchange_request_completion_receipts SET snapshot='{}' WHERE request_id=$1", [r.id]), /immutable/);
  });

  test('completion rolls back accounting, receipt and queued emails when audit fails', async () => {
    let r = await request(); r = await command(r, 'confirm_funds', funding(r)); r = await command(r, 'start_processing');
    const eventCount = await count('exchange_request_events', r.id);
    await query("SELECT set_config('test.reject_audit','on',true)");
    await rejects(() => command(r, 'complete', settlement()), /Synthetic audit unavailable/);
    assert.equal((await get(r.id)).status, 'processing');
    assert.equal((await one('SELECT status FROM transactions WHERE id=$1', [r.transaction_id])).status, 'pending');
    assert.equal(Number((await one('SELECT count(*) AS n FROM ledger WHERE transaction_id=$1', [r.transaction_id])).n), 0);
    assert.equal(await count('exchange_request_completion_receipts', r.id), 0);
    assert.equal(await count('exchange_request_events', r.id), eventCount);
  });

  test('legacy transaction and ledger mutations cannot bypass the managed settlement workflow', async () => {
    const r = await request();
    await rejects(() => query("UPDATE transactions SET status='approved' WHERE id=$1", [r.transaction_id]), /REQUEST_MANAGED_TRANSACTION/);
    await rejects(() => query('DELETE FROM transactions WHERE id=$1', [r.transaction_id]), /REQUEST_MANAGED_TRANSACTION/);
    await rejects(() => query("INSERT INTO ledger(transaction_id,date_gregorian,date_jalali,type,amount_aud,amount_toman) VALUES($1,current_date,'1405/06/22','buy_aud',1000,970000)", [r.transaction_id]), /REQUEST_MANAGED_TRANSACTION/);
    const legacy = await one("INSERT INTO transactions(user_id,type,amount_aud,equivalent_toman) VALUES($1,'buy_aud',100,100000) RETURNING id", [CUSTOMER]);
    await query("UPDATE transactions SET status='approved' WHERE id=$1", [legacy.id]);
    assert.equal((await one('SELECT status FROM transactions WHERE id=$1', [legacy.id])).status, 'approved');
  });

  test('legacy ledger types remain restricted outside linked request fee adjustments', async () => {
    for (const entryType of ['trade', 'adjustment']) {
      await rejects(() => query(
        "INSERT INTO ledger(date_gregorian,date_jalali,type,entry_type,amount_aud,amount_toman,receiver_account_id) VALUES(current_date,'1405/06/22','transfer',$1,20,20000,$2)",
        [entryType, AUD]), /ledger_type_check/);
    }
    assert.equal(Number((await one('SELECT count(*) AS n FROM ledger')).n), 0);
    for (const type of ['buy_aud', 'sell_aud']) {
      await query("INSERT INTO ledger(date_gregorian,date_jalali,type,entry_type,amount_aud,amount_toman) VALUES(current_date,'1405/06/22',$1,'trade',20,20000)", [type]);
    }
    assert.equal(Number((await one('SELECT count(*) AS n FROM ledger')).n), 2);
  });

  test('optimistic versions and banking reference uniqueness prevent duplicate cash and payout intent', async () => {
    let r = await request(); const original = r; const paid = funding(r); const key = randomUUID();
    r = await command(r, 'confirm_funds', paid, ADMIN, key);
    assert.deepEqual(await command(original, 'confirm_funds', paid, ADMIN, key), r);
    await rejects(() => command(original, 'confirm_funds', paid), /REQUEST_CONFLICT/);
    assert.equal(await count('exchange_request_payments', r.id), 1);
    const second = await request();
    await rejects(() => command(second, 'confirm_funds', paid), /duplicate key/);
    r = await command(r, 'start_processing');
    await rejects(() => command(r, 'start_processing'), /not ready/);
    r = await command(r, 'record_uncertain_payout', { message: 'Awaiting bank settlement result' });
    assert.equal(r.status, 'reconciliation');
    await rejects(() => command(r, 'cancel'), /committed payout/);
    await rejects(() => command(r, 'start_processing'), /not ready/);
    r = await command(r, 'complete', settlement()); assert.equal(r.status, 'completed');
  });

  test('business handling calendar counts Sydney opening hours, holidays and DST consistently', async () => {
    const policy = { timezone: 'Australia/Sydney', business_days: [1, 2, 3, 4, 5], opening_hour: 9, closing_hour: 17, holidays: ['2026-10-05'] };
    const due = await one('SELECT exchange_request_business_due($1,60,$2) AS due', ['2026-10-02T06:30:00Z', policy]);
    // Friday16:30 AEST + 30 min, skip weekend, DST begins, skip Monday holiday,
    // remaining30 min Tuesday09:00 AEDT => Monday22:30 UTC.
    assert.equal(due.due.toISOString(), '2026-10-05T22:30:00.000Z');
  });

  test('request settings reject a clearance allowance below 24 hours or unsafe priority pricing', async () => {
    const { settings, version } = await one('SELECT settings,version FROM exchange_request_settings WHERE id');
    await rejects(() => rpc('SELECT save_exchange_request_settings($1,$2,$3) AS result', [CUSTOMER, version, settings]), /Administrator required/);
    await rejects(() => rpc('SELECT save_exchange_request_settings($1,$2,$3) AS result', [ADMIN, version, { ...settings, australian_clearance_minutes: 60 }]), /Invalid request settings/);
    await rejects(() => rpc('SELECT save_exchange_request_settings($1,$2,$3) AS result', [ADMIN, version, { ...settings, priority_fee_aud: 0 }]), /Configure priority/);
    const saved = await rpc('SELECT save_exchange_request_settings($1,$2,$3) AS result', [ADMIN, version, { ...settings, australian_clearance_minutes: 2880 }]);
    assert.equal(saved.settings.australian_clearance_minutes, 2880);
  });

  test('priority AUD cash reaches current bank balances without becoming trade volume or earned income before settlement', async () => {
    let r = await request('priority'); const beforeFunding = r; const payload = funding(r); const key = randomUUID();
    r = await command(r, 'confirm_funds', payload, ADMIN, key);
    assert.deepEqual(await command(beforeFunding, 'confirm_funds', payload, ADMIN, key), r);
    const feeLedger = await one('SELECT * FROM ledger WHERE request_fee_entry_id IS NOT NULL');
    assert.equal(feeLedger.transaction_id, null); assert.equal(feeLedger.entry_type, 'adjustment');
    assert.equal(feeLedger.type, 'transfer'); assert.equal(feeLedger.date_jalali, '1405/06/22');
    assert.equal(Number(feeLedger.amount_aud), 20); assert.equal(Number(feeLedger.amount_toman), 0);
    const cash = await cashSnapshot();
    assert.equal(cash.drawerBalances[AUD].balance, 20); assert.equal(cash.audInventory, 0); assert.equal(cash.wac, 0);
    assert.equal(cash.feeIncomeIRT, 0);
    assert.equal(Number((await one('SELECT get_exchange_request_fee_income() AS total')).total), 0);
    await query('SELECT refresh_enterprise_reports()');
    let day = await one('SELECT * FROM reports_daily');
    assert.equal(Number(day.fee_income), 0); assert.equal(day.transaction_count, 0);
    assert.equal(Number(day.buy_volume), 0); assert.equal(Number(day.sell_volume), 0);
    assert.equal(Number((await one('SELECT closing_balance FROM report_account_daily WHERE account_id=$1', [AUD])).closing_balance), 20);
    const statement = (await query('SELECT * FROM get_report_account_statement($1,current_date,current_date)', [AUD])).rows;
    assert.equal(statement.length, 1); assert.equal(Number(statement[0].credit), 20);
    assert.equal(Number(statement[0].debit), 0);
    r = await command(r, 'start_processing'); r = await command(r, 'complete', settlement());
    assert.equal(Number((await one('SELECT get_exchange_request_fee_income() AS total')).total), 20000);
    assert.equal((await cashSnapshot()).drawerBalances[AUD].balance, 1020);
    assert.equal((await cashSnapshot()).audInventory, 1000); assert.equal((await cashSnapshot()).wac, 1000);
    assert.equal((await cashSnapshot()).feeIncomeIRT, 50000);
    await query('SELECT refresh_enterprise_reports()');
    day = await one('SELECT * FROM reports_daily');
    assert.equal(Number(day.fee_income), 50000); assert.equal(day.transaction_count, 1);
    assert.equal(Number(day.buy_volume), 1000); assert.equal(Number(day.aud_inventory), 1000); assert.equal(Number(day.wac), 1000);
    assert.equal(Number((await one('SELECT closing_balance FROM report_account_daily WHERE account_id=$1', [AUD])).closing_balance), 1020);
    assert.equal(Number((await one('SELECT fee_income FROM reports_monthly')).fee_income), 50000);
    assert.equal(Number((await one('SELECT fee_income FROM reports_yearly')).fee_income), 50000);
    assert.equal(Number((await one('SELECT fee_income FROM report_customer_daily WHERE customer_id=$1', [CUSTOMER])).fee_income), 50000);
    await query('SELECT refresh_enterprise_reports()');
    assert.equal(Number((await one('SELECT fee_income FROM reports_daily')).fee_income), 50000);
  });

  test('priority refunds reverse cash once and never create earned fees or artificial trading volume', async () => {
    let r = await request('priority'); r = await command(r, 'confirm_funds', funding(r));
    r = await command(r, 'cancel', {}, CUSTOMER);
    const beforeRefund = r; const key = randomUUID();
    const payload = { refund_kind: 'priority', refund_reference: 'refund-priority-001', payer_account_id: AUD };
    r = await command(r, 'confirm_refund', payload, ADMIN, key);
    assert.deepEqual(await command(beforeRefund, 'confirm_refund', payload, ADMIN, key), r);
    assert.equal((await cashSnapshot()).drawerBalances[AUD].balance, 0);
    assert.equal(Number((await one('SELECT count(*) AS n FROM ledger WHERE request_fee_entry_id IS NOT NULL')).n), 2);
    assert.equal(Number((await one('SELECT get_exchange_request_fee_income() AS total')).total), 0);
    await query('SELECT refresh_enterprise_reports()');
    const day = await one('SELECT * FROM reports_daily');
    assert.equal(Number(day.fee_income), 0); assert.equal(day.transaction_count, 0);
    assert.equal(Number(day.buy_volume), 0); assert.equal(Number(day.sell_volume), 0);
    assert.equal(Number(day.cash_in), 20000); assert.equal(Number(day.cash_out), 20000); assert.equal(Number(day.refunds), 20000);
    assert.equal(Number((await one('SELECT closing_balance FROM report_account_daily WHERE account_id=$1', [AUD])).closing_balance), 0);
  });

  test('Iranian surcharge cash uses the actual Toman account and preserves original currency in reports', async () => {
    await query("UPDATE recipients SET direction='aud' WHERE id=$1", [RECIPIENT]);
    let r = await submit(await quote('priority', CUSTOMER, 'buy_aud'));
    r = await command(r, 'confirm_funds', funding(r, { received_currency: 'IRT', receiver_account_id: IRT }));
    const feeLedger = await one('SELECT * FROM ledger WHERE request_fee_entry_id IS NOT NULL');
    assert.equal(feeLedger.receiver_account_id, IRT); assert.equal(Number(feeLedger.amount_aud), 0);
    assert.equal(Number(feeLedger.amount_toman), 20000); assert.equal((await cashSnapshot()).drawerBalances[IRT].balance, 20000);
    r = await command(r, 'start_processing');
    await command(r, 'complete', { ...settlement(), transfer_method: 'free', payer_account_id: AUD, receiver_account_id: IRT });
    assert.equal((await cashSnapshot()).drawerBalances[IRT].balance, 1050000);
    assert.equal(Number((await one('SELECT get_exchange_request_fee_income() AS total')).total), 20000);
    await query('SELECT refresh_enterprise_reports()');
    assert.equal(Number((await one('SELECT closing_balance FROM report_account_daily WHERE account_id=$1', [IRT])).closing_balance), 1050000);
    assert.equal(Number((await one('SELECT fee_income FROM reports_daily')).fee_income), 50000);
  });

  test('a missed priority target never becomes earned income even when the transfer completes', async () => {
    let r = await request('priority'); r = await command(r, 'confirm_funds', funding(r));
    await query("UPDATE exchange_requests SET handling_due_at=now()-interval '1 minute' WHERE id=$1", [r.id]);
    await rpc('SELECT sweep_exchange_request_deadlines() AS result'); r = await get(r.id);
    assert.equal(r.priority_fee_status, 'refund_pending');
    r = await command(r, 'start_processing'); r = await command(r, 'complete', settlement());
    assert.equal(Number((await one('SELECT get_exchange_request_fee_income() AS total')).total), 0);
    await query('SELECT refresh_enterprise_reports()');
    assert.equal(Number((await one('SELECT fee_income FROM reports_daily')).fee_income), 30000);
  });

  test('priority cash and recognized earnings are immutable and roll back with failed workflow audits', async () => {
    let r = await request('priority');
    await query("SELECT set_config('test.reject_audit','on',true)");
    await rejects(() => command(r, 'confirm_funds', funding(r)), /Synthetic audit unavailable/);
    assert.equal(Number((await one('SELECT count(*) AS n FROM ledger WHERE request_fee_entry_id IS NOT NULL')).n), 0);
    await query("SELECT set_config('test.reject_audit','off',true)");
    r = await command(r, 'confirm_funds', funding(r));
    const cash = await one('SELECT * FROM ledger WHERE request_fee_entry_id IS NOT NULL');
    await rejects(() => query('UPDATE ledger SET amount_aud=1 WHERE id=$1', [cash.id]), /immutable/);
    await rejects(() => query('UPDATE ledger SET request_fee_entry_id=NULL WHERE id=$1', [cash.id]), /immutable/);
    await rejects(() => query('DELETE FROM ledger WHERE id=$1', [cash.id]), /immutable/);
    await db.exec('SET LOCAL ROLE service_role');
    await rejects(() => query('SELECT post_exchange_request_fee_cash($1)', [cash.request_fee_entry_id]), /permission denied/);
    await rejects(() => rpc('SELECT transition_exchange_request_accounting_core($1,$2,$3,$4,$5,$6) AS result',
      [ADMIN, r.id, r.version, randomUUID(), 'start_processing', {}]), /permission denied/);
    await db.exec('RESET ROLE');
    r = await command(r, 'start_processing');
    await query("SELECT set_config('test.reject_audit','on',true)");
    await rejects(() => command(r, 'complete', settlement()), /Synthetic audit unavailable/);
    assert.equal(Number((await one('SELECT get_exchange_request_fee_income() AS total')).total), 0);
    await query("SELECT set_config('test.reject_audit','off',true)");
    r = await command(r, 'complete', settlement());
    await rejects(() => query('UPDATE exchange_request_fee_earnings SET amount_toman=1 WHERE request_id=$1', [r.id]), /immutable/);
    await db.exec('SET LOCAL ROLE authenticated');
    await rejects(() => query('SELECT get_exchange_request_fee_income()'), /permission denied/);
    await db.exec('RESET ROLE');
  });
});
