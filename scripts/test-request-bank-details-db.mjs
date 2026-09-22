// Structured funding details are validated and snapshotted by PostgreSQL.
// Synthetic PGlite baseline only: no credentials, network or provider calls.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const CUSTOMER = '00000000-0000-4000-8000-000000000001';
const ADMIN = '00000000-0000-4000-8000-000000000003';
const RECIPIENT = '20000000-0000-4000-8000-000000000001';
const AUD_DETAILS = { account_name: 'Zarman Test Account', bank_name: 'Synthetic Bank', bsb: '000-001', account_number: '0012 3456' };
const IRT_DETAILS = { account_name: 'حساب آزمایشی زرمان', bank_name: 'بانک آزمایشی', iban: 'IR00 1234 5678 9012 3456 7890 12' };
let db, historical, historicalDeliveries;
const query = (sql, args = []) => db.query(sql, args);
const one = async (sql, args = []) => (await query(sql, args)).rows[0];
const rpc = async (sql, args = []) => (await one(sql, args)).result;
const settings = () => one('SELECT version,settings FROM exchange_request_settings WHERE id');
const get = id => one('SELECT * FROM exchange_requests WHERE id=$1', [id]);
const submit = id => rpc('SELECT submit_exchange_request($1,$2,$3) AS result', [CUSTOMER, id, randomUUID()]);
const deliveries = async id => (await query('SELECT * FROM exchange_request_notification_deliveries WHERE request_id=$1 ORDER BY event_sequence,audience', [id])).rows;
async function quote(currency = 'AUD', locale = 'en') {
  const policy = await settings(), aud = currency === 'AUD';
  await query('UPDATE recipients SET direction=$1 WHERE id=$2', [aud ? 'irt' : 'aud', RECIPIENT]);
  const recipient = await one('SELECT * FROM recipients WHERE id=$1', [RECIPIENT]);
  const snapshot = { raw_amount_aud: 1000, equivalent_toman: aud ? 970000 : 1030000, applied_rate: 1000, base_fee_aud: 30,
    priority_fee_aud: 0, priority_fee_amount: 0, funding_currency: currency, funding_total: aud ? 1000 : 1030000,
    recipient_amount: aud ? 970000 : 1000, recipient_currency: aud ? 'IRT' : 'AUD', service_tier: 'standard', locale,
    customer_request_type: aud ? 'sell_aud' : 'buy_aud', company_trade_type: aud ? 'buy_aud' : 'sell_aud',
    source_of_funds: 'Savings', reason_for_transfer: 'Family support', recipient_id: RECIPIENT, recipient_snapshot: recipient,
    sender_snapshot: { name: 'Synthetic Customer' }, policy_version: policy.version, policy_snapshot: policy.settings };
  return (await one("INSERT INTO exchange_request_quotes(user_id,snapshot,expires_at) VALUES($1,$2,now()+interval '10 minutes') RETURNING id", [CUSTOMER, snapshot])).id;
}
async function save(patch, actor = ADMIN, version) {
  const current = await settings();
  return rpc('SELECT save_exchange_request_settings($1,$2,$3) AS result', [actor, version ?? current.version, { ...current.settings, ...patch }]);
}
async function rejects(work, pattern) {
  await db.exec('SAVEPOINT expected_failure');
  await assert.rejects(work, pattern);
  await db.exec('ROLLBACK TO SAVEPOINT expected_failure');
}

describe('immutable structured funding instructions', { concurrency: false }, () => {
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
      'supabase/migrations/20260913_27_request_messages_and_notifications.sql']) await db.exec(read(file));
    await query("INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES($1,'customer@example.invalid','{}'),($2,'admin@example.invalid','{\"role\":\"admin\"}')", [CUSTOMER, ADMIN]);
    await query("INSERT INTO profiles(id,email,kyc_status) SELECT id,email,'approved' FROM auth.users");
    await query("INSERT INTO recipients(id,user_id,direction,full_name,bank_name,account_number) VALUES($1,$2,'irt','Synthetic Recipient','Synthetic Bank','123456')", [RECIPIENT, CUSTOMER]);
    await query('INSERT INTO rates_history(date,buy_aud,sell_aud) VALUES(current_date,1000,1000)');
    await query('UPDATE exchange_request_settings SET settings=settings||$1::jsonb', [{ enabled: true,
      management_emails: ['management@example.invalid'], payment_instructions_aud: 'Legacy BSB 000-000\nAccount 123456',
      payment_instructions_irt: 'Legacy Iranian instructions', business_days: [0, 1, 2, 3, 4, 5, 6], opening_hour: 0, closing_hour: 24 }]);
    historical = await submit(await quote());
    historicalDeliveries = await deliveries(historical.id);
    await db.exec(read('supabase/migrations/20260913_28_request_bank_details.sql'));
  });
  after(async () => db?.close());
  beforeEach(async () => db.exec('BEGIN'));
  afterEach(async () => db.exec('ROLLBACK'));

  test('upgrade leaves historical instructions and queued email payloads unchanged', async () => {
    const r = await get(historical.id);
    assert.equal(r.payment_details, null);
    assert.equal(r.payment_instructions_fa, null);
    assert.equal(r.payment_instructions, historical.payment_instructions);
    assert.deepEqual(await deliveries(r.id), historicalDeliveries);
    assert.equal((await settings()).settings.payment_details_aud.constructor, Object);
    await rejects(async () => submit(await quote()), /Funding bank details are not configured/);
    assert.equal(Number((await one('SELECT count(*) AS n FROM transactions')).n), 1);
  });

  test('only staff can enable valid structured instructions; disabled drafts can be incomplete', async () => {
    await rejects(() => save({ enabled: false }, CUSTOMER), /Administrator required/);
    await rejects(() => save({ enabled: true }), /Configure valid AUD bank details/);
    const draft = await save({ enabled: false, payment_details_aud: {}, payment_details_irt: {} });
    assert.equal(draft.settings.enabled, false);
    const active = await save({ enabled: true, payment_details_aud: AUD_DETAILS, payment_details_irt: IRT_DETAILS,
      payment_instructions_aud: '', payment_instructions_irt: '', payment_instructions_aud_fa: '', payment_instructions_irt_fa: '' });
    assert.equal(active.settings.payment_instructions_aud, 'Include your transaction code in the transfer description.');
    assert.equal(active.settings.payment_instructions_irt_fa, 'کد تراکنش را در توضیحات انتقال بانکی وارد کنید.');
    assert.deepEqual(active.settings.payment_details_aud, AUD_DETAILS);
    assert.deepEqual(active.settings.payment_details_irt, IRT_DETAILS);
    await rejects(() => save({ enabled: false }, ADMIN, draft.version), /REQUEST_CONFLICT/);
  });

  test('wrong keys, types, excessive text and incomplete required bank identifiers are rejected', async () => {
    const valid = { enabled: true, payment_details_aud: AUD_DETAILS, payment_details_irt: IRT_DETAILS };
    for (const malformed of [null, [], { ...AUD_DETAILS, secret: 'unexpected' }, { ...AUD_DETAILS, account_number: 123456 },
      { ...AUD_DETAILS, bank_name: 'x'.repeat(201) }, { ...AUD_DETAILS, bank_name: 'two\nlines' }]) {
      await rejects(() => save({ ...valid, payment_details_aud: malformed }), /Configure valid AUD bank details/);
    }
    for (const malformed of [{ ...AUD_DETAILS, bsb: '12' }, { ...AUD_DETAILS, account_number: '1234' },
      { ...AUD_DETAILS, account_name: ' ' }]) {
      await rejects(() => save({ ...valid, payment_details_aud: malformed }), /Configure valid AUD bank details/);
    }
    await rejects(() => save({ ...valid, payment_details_irt: { account_name: 'Test', iban: 'IR123' } }), /Configure valid IRT bank details/);
    await rejects(() => save({ ...valid, payment_details_irt: { account_name: 'Test', account_number: '12345', iban: 'IR123' } }), /Configure valid IRT bank details/);
    await rejects(() => save({ ...valid, enabled: false, payment_details_aud: { bsb: 'wrong' } }), /Configure valid AUD bank details/);
    await rejects(() => save({ ...valid, payment_instructions_aud_fa: 'x'.repeat(4001) }), /Invalid Persian instructions/);
    await rejects(() => save({ ...valid, iran_banking_notice_fa: 'x'.repeat(2001) }), /Invalid Persian instructions/);
    for (const role of ['anon', 'authenticated', 'service_role']) {
      assert.equal((await one("SELECT has_function_privilege($1,'save_exchange_request_settings_legacy_core(uuid,integer,jsonb)','EXECUTE') AS allowed", [role])).allowed, false);
    }
  });

  test('AUD details and FA notes remain exact, immutable and shared by dashboard and email snapshots', async () => {
    const note = 'کد تراکنش را در شرح واریز درج کنید.';
    await save({ payment_details_aud: AUD_DETAILS, payment_details_irt: IRT_DETAILS, payment_instructions_aud_fa: note,
      iran_banking_notice_fa: 'پرداخت تابع چرخه بانکی است.' });
    const r = await submit(await quote('AUD', 'fa'));
    assert.equal(r.status, 'submitted');
    assert.deepEqual(r.payment_details, AUD_DETAILS);
    assert.equal(r.payment_instructions_fa, note);
    assert.equal(r.payment_details.account_number, '0012 3456');
    const initialDeliveries = await deliveries(r.id);
    for (const d of initialDeliveries) {
      assert.deepEqual(d.payload_snapshot.payment_details, AUD_DETAILS);
      assert.equal(d.payload_snapshot.payment_instructions_fa, note);
      assert.equal(d.payload_snapshot.iran_banking_notice_fa, 'پرداخت تابع چرخه بانکی است.');
    }
    await save({ payment_details_aud: { ...AUD_DETAILS, account_number: '999999' }, payment_instructions_aud_fa: 'توضیح جدید' });
    assert.deepEqual((await get(r.id)).payment_details, AUD_DETAILS);
    assert.equal((await get(r.id)).payment_instructions_fa, note);
    assert.deepEqual(await deliveries(r.id), initialDeliveries);
    await rejects(() => query('UPDATE exchange_requests SET payment_details=$1 WHERE id=$2', [{ ...AUD_DETAILS, bsb: '111111' }, r.id]), /immutable/);
    await rejects(() => query('UPDATE exchange_requests SET payment_instructions_fa=$1 WHERE id=$2', ['rewrite', r.id]), /immutable/);
    await rpc('SELECT transition_exchange_request($1,$2,$3,$4,$5,$6) AS result', [ADMIN, r.id, r.version, randomUUID(), 'await_funds', { send_email: true }]);
    const approved = (await deliveries(r.id)).filter(d => d.event_type === 'await_funds');
    assert.equal(approved.length, 2);
    assert.ok(approved.every(d => d.payload_snapshot.payment_details.account_number === '0012 3456'));
  });

  test('IRT IBAN, account number and card alternatives validate and snapshot the requested currency', async () => {
    const alternatives = [IRT_DETAILS, { account_name: 'Test', account_number: '00123456789' },
      { account_name: 'Test', card_number: '1234 5678 9012 3456' }];
    for (const details of alternatives) {
      await save({ payment_details_aud: AUD_DETAILS, payment_details_irt: details,
        payment_instructions_irt_fa: 'دستور واریز ریالی' });
      const r = await submit(await quote('IRT', 'fa'));
      assert.equal(r.quote.funding_currency, 'IRT');
      assert.deepEqual(r.payment_details, details);
      assert.equal(r.payment_instructions_fa, 'دستور واریز ریالی');
      assert.equal((await deliveries(r.id)).find(d => d.audience === 'customer').locale, 'fa');
    }
  });
});
