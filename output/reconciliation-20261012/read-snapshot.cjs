const fs = require('node:fs');
const path = require('node:path');
const { loadEnvConfig } = require('@next/env');
const { createClient } = require('@supabase/supabase-js');
loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// Reconciliation snapshot: SELECT only. No application actions or database RPCs.
const queries = {
  transactions: 'id,user_id,reference_code,type,amount_aud,equivalent_toman,status,created_at,approved_at,ledger_fee_aud',
  ledger: 'id,transaction_id,date_gregorian,type,entry_type,amount_aud,amount_toman,exchange_rate,fee_aud,payer_account_id,receiver_account_id,expense_id,owner_loan_id,created_at,notes',
  bank_accounts: 'id,account_name,currency,account_type,is_active',
  expenses: 'id,date,title,category,currency,amount,status,payer_account_id,created_at',
  owner_loans: 'id,date,currency,amount,loan_type,repayment_status,account_id,created_at',
  exchange_requests: 'id,transaction_id,reference_code,status,funding_status,funding_received,created_at,updated_at,funds_confirmed_at,handling_started_at,customer:quote->sender_snapshot->>name,funding_currency:quote->>funding_currency,funding_total:quote->>funding_total,recipient_currency:quote->>recipient_currency,recipient_amount:quote->>recipient_amount,raw_amount_aud:quote->>raw_amount_aud',
  exchange_request_current_payments: 'id,request_id,payment_reference,amount,currency,account_id,created_at,original_amount,corrected_at,excluded',
  account_reconciliations: 'id,account_id,as_of_date,currency,computed_balance,actual_balance,discrepancy,status,adjustment_ledger_id,created_at',
};

async function readTable(table, columns) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from(table).select(columns).order('id').range(offset, offset + 499);
    if (error) throw new Error(table + ': ' + error.message);
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}

(async () => {
  const snapshot = { capturedAt: new Date().toISOString(), tables: {} };
  for (const [table, columns] of Object.entries(queries)) {
    snapshot.tables[table] = await readTable(table, columns);
  }
  fs.writeFileSync(path.join(__dirname, process.argv[2] || 'website-snapshot.json'), JSON.stringify(snapshot, null, 2));
  console.log(JSON.stringify({ capturedAt: snapshot.capturedAt, counts: Object.fromEntries(Object.entries(snapshot.tables).map(([table, rows]) => [table, rows.length])), accounts: snapshot.tables.bank_accounts }));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
