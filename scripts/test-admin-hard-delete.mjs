import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, before, describe, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const CUSTOMER = "00000000-0000-4000-8000-000000000001";
const ADMIN = "00000000-0000-4000-8000-000000000003";
const ACCOUNT = "10000000-0000-4000-8000-000000000001";
const RECIPIENT = "20000000-0000-4000-8000-000000000001";
let db;

const query = (sql, args = []) => db.query(sql, args);
const one = async (sql, args = []) => (await query(sql, args)).rows[0];

describe("administrator hard delete", { concurrency: false }, () => {
  before(async () => {
    db = new PGlite();
    for (const file of [
      "scripts/fixtures/customer-requests.sql",
      "supabase/migrations/20260802_09_enterprise_reporting.sql",
      "supabase/migrations/20260802_10_ledger_accounting_controls.sql",
      "supabase/migrations/20260802_13_standardize_trade_fee_accounting.sql",
      "supabase/migrations/20260911_18_customer_requests.sql",
      "supabase/migrations/20260911_19_request_notifications.sql",
      "supabase/migrations/20260913_23_request_funding_and_receipts.sql",
      "supabase/migrations/20260913_24_request_receipt_notifications.sql",
      "supabase/migrations/20260913_25_request_fee_accounting.sql",
      "supabase/migrations/20260913_26_request_fee_ledger_type.sql",
      "supabase/migrations/20260913_27_request_messages_and_notifications.sql",
      "supabase/migrations/20260913_28_request_bank_details.sql",
      "supabase/migrations/20260915_29_request_payment_approval.sql",
      "supabase/migrations/20260915_30_request_customer_actions_and_received_funds.sql",
      "supabase/migrations/20260920_31_account_reconciliations.sql",
      "supabase/migrations/20260920_32_recipient_bank_city.sql",
      "supabase/migrations/20260921_33_customer_request_realtime_signals.sql",
      "supabase/migrations/20260921_34_recipient_relationship.sql",
      "supabase/migrations/20260924_35_admin_hard_delete.sql",
    ]) await db.exec(read(file));

    await query("INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES($1,'customer@example.invalid','{}'),($2,'admin@example.invalid','{\"role\":\"admin\"}')", [CUSTOMER, ADMIN]);
    await query("INSERT INTO profiles(id,email,first_name,last_name,kyc_status) SELECT id,email,'Synthetic','User','approved' FROM auth.users");
    await query("INSERT INTO bank_accounts(id,account_name,currency) VALUES($1,'Synthetic AUD','AUD')", [ACCOUNT]);
    await query("INSERT INTO recipients(id,user_id,direction,full_name,bank_name,account_number,relationship) VALUES($1,$2,'irt','Synthetic Recipient','Synthetic Bank','123456','family')", [RECIPIENT, CUSTOMER]);
    await query("INSERT INTO rates_history(date,buy_aud,sell_aud) VALUES(current_date,1000,1000)");
    await query("UPDATE exchange_request_settings SET settings=settings||$1::jsonb", [{
      enabled: true,
      priority_enabled: true,
      management_emails: ["management@example.invalid"],
      payment_details_aud: { account_name: "Synthetic AUD", bsb: "000-001", account_number: "00123456" },
      payment_details_irt: { account_name: "Synthetic IRT", account_number: "12345678" },
      payment_instructions_aud: "Synthetic account",
      payment_instructions_irt: "Synthetic account",
      payment_instructions_aud_fa: "Synthetic account",
      payment_instructions_irt_fa: "Synthetic account",
      business_days: [0, 1, 2, 3, 4, 5, 6],
      opening_hour: 0,
      closing_hour: 24,
    }]);
  });

  after(async () => db?.close());

  test("removes a request, its transaction, and the complete linked graph in one command", async () => {
    const settings = await one("SELECT version,settings FROM exchange_request_settings WHERE id");
    const recipient = await one("SELECT * FROM recipients WHERE id=$1", [RECIPIENT]);
    const snapshot = {
      raw_amount_aud: 1000,
      equivalent_toman: 970000,
      applied_rate: 1000,
      base_fee_aud: 30,
      priority_fee_aud: 0,
      priority_fee_amount: 0,
      funding_currency: "AUD",
      funding_total: 1000,
      recipient_amount: 970000,
      recipient_currency: "IRT",
      service_tier: "standard",
      locale: "en",
      customer_request_type: "sell_aud",
      company_trade_type: "buy_aud",
      source_of_funds: "Savings",
      reason_for_transfer: "Family support",
      recipient_id: RECIPIENT,
      recipient_snapshot: recipient,
      sender_snapshot: { name: "Synthetic User", email: "customer@example.invalid" },
      policy_version: settings.version,
      policy_snapshot: settings.settings,
    };
    const quoteId = (await one("INSERT INTO exchange_request_quotes(user_id,snapshot,expires_at) VALUES($1,$2,now()+interval '10 minutes') RETURNING id", [CUSTOMER, snapshot])).id;
    const request = (await one("SELECT submit_exchange_request($1,$2,$3) AS value", [CUSTOMER, quoteId, randomUUID()])).value;
    const event = await one("SELECT id,sequence FROM exchange_request_events WHERE request_id=$1 ORDER BY sequence LIMIT 1", [request.id]);
    const receiptId = randomUUID();
    const receiptPath = `${CUSTOMER}/${request.id}/${receiptId}.pdf`;

    await query("INSERT INTO exchange_request_receipts(id,request_id,storage_path,original_name,content_type,size_bytes,sha256,uploaded_by) VALUES($1,$2,$3,'receipt.pdf','application/pdf',100,$4,$5)", [receiptId, request.id, receiptPath, "a".repeat(64), CUSTOMER]);
    await query("INSERT INTO storage.objects(bucket_id,name) VALUES('exchange-request-receipts',$1)", [receiptPath]);
    await query("INSERT INTO exchange_request_messages(request_id,event_id,event_sequence,sender_id,sender_role,body,send_email) VALUES($1,$2,$3,$4,'customer','Synthetic message',false)", [request.id, event.id, event.sequence, CUSTOMER]);
    await query("INSERT INTO ledger(transaction_id,date_gregorian,date_jalali,type,entry_type,exchange_rate,amount_aud,amount_toman,fee_aud) VALUES($1,current_date,'1405/07/02','buy_aud','trade',1000,1000,970000,30)", [request.transaction_id]);

    const deleted = (await one("SELECT admin_hard_delete_exchange_request($1,$2) AS value", [ADMIN, request.id])).value;
    assert.equal(deleted.transaction_id, request.transaction_id);
    assert.deepEqual(deleted.receipt_paths, [receiptPath]);

    for (const [table, column, id] of [
      ["exchange_requests", "id", request.id],
      ["exchange_request_quotes", "id", quoteId],
      ["exchange_request_events", "request_id", request.id],
      ["exchange_request_messages", "request_id", request.id],
      ["exchange_request_receipts", "request_id", request.id],
      ["exchange_request_notification_deliveries", "request_id", request.id],
      ["exchange_request_realtime_signals", "request_id", request.id],
      ["transactions", "id", request.transaction_id],
      ["ledger", "transaction_id", request.transaction_id],
    ]) {
      const row = await one(`SELECT count(*)::int AS count FROM ${table} WHERE ${column}=$1`, [id]);
      assert.equal(row.count, 0, `${table} still has linked records`);
    }

    assert.equal((await one("SELECT count(*)::int AS count FROM audit_logs WHERE target_id IN ($1,$2)", [request.id, request.transaction_id])).count, 0);
    // SQL returns blob paths; the server action removes the physical objects
    // through the Storage API after the database transaction commits.
    assert.equal((await one("SELECT count(*)::int AS count FROM storage.objects WHERE bucket_id='exchange-request-receipts' AND name=$1", [receiptPath])).count, 1);
  });

  test("rejects a non-admin actor", async () => {
    const transactionId = randomUUID();
    await query("INSERT INTO transactions(id,user_id,type,amount_aud,equivalent_toman,status) VALUES($1,$2,'buy_aud',1,1000,'pending')", [transactionId, CUSTOMER]);
    await assert.rejects(
      query("SELECT admin_hard_delete_transaction($1,$2)", [CUSTOMER, transactionId]),
      /Administrator required/,
    );
  });
});
