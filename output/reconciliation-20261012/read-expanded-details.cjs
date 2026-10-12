const fs = require('node:fs');
const path = require('node:path');
const { loadEnvConfig } = require('@next/env');
const { createClient } = require('@supabase/supabase-js');
loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const refs = ['ZE70018','ZE92705','ZE43751','ZE32449','ZE12365','ZE75405','ZE46874','ZE04028','ZE16124','ZE49151','ZE08781','ZE08094'];
async function data(query) { const r = await query; if(r.error) throw new Error(r.error.message); return r.data; }
(async () => {
  const transactions = await data(db.from('transactions').select('id,user_id,reference_code,type,amount_aud,equivalent_toman,applied_rate,ledger_fee_aud,status,created_at,approved_at,reason_for_transfer,profiles(first_name,last_name),recipients(full_name,account_name,label)').in('reference_code', refs));
  const ledger = await data(db.from('ledger').select('id,transaction_id,date_gregorian,amount_aud,amount_toman,exchange_rate,fee_aud,sender,recipient,notes,payer_account_id,receiver_account_id').in('transaction_id', transactions.map(x => x.id)));
  const arash = transactions.find(x => x.reference_code === 'ZE70018');
  const related_transactions = await data(db.from('transactions').select('id,reference_code,type,amount_aud,status,created_at,approved_at').eq('user_id',arash.user_id));
  const snapshot = { capturedAt: new Date().toISOString(), transactions, ledger, related_transactions };
  fs.writeFileSync(path.join(__dirname,'expanded-details.json'),JSON.stringify(snapshot,null,2));
  console.log(JSON.stringify(snapshot,null,2));
})().catch(e => { console.error(e.message);process.exitCode=1; });
