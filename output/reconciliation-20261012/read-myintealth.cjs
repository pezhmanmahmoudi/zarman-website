const fs = require('node:fs');
const path = require('node:path');
const {loadEnvConfig} = require('@next/env');
const {createClient} = require('@supabase/supabase-js');
loadEnvConfig(process.cwd(),true,{info(){},error(){}});
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const refs=['ZE43751','ZE92705','ZE12365','ZE32449'];
async function rows(q) { const r=await q; if(r.error)throw new Error(r.error.message);return r.data; }
(async()=>{
  const rawTransactions=await rows(db.from('transactions').select('id,reference_code,amount_aud,equivalent_toman,ledger_fee_aud,status,created_at,approved_at,payment_link,profiles(first_name,last_name)').gte('created_at','2026-09-20T14:00:00Z').lt('created_at','2026-10-12T13:00:00Z').or('payment_link.ilike.%intealth%,reference_code.in.('+refs.join(',')+')').order('created_at'));
  const transactions=rawTransactions.map(({payment_link,...x})=>{let payment_host=null;if(payment_link){try{payment_host=new URL(payment_link).hostname;}catch{payment_host='unparseable';}}return{...x,payment_host};});
  const rawLedger=await rows(db.from('ledger').select('id,transaction_id,date_gregorian,entry_type,amount_aud,amount_toman,fee_aud,sender,recipient,notes').eq('payer_account_id','a60ca17c-47ad-41da-a370-88ad222968d9').gte('date_gregorian','2026-09-20').lte('date_gregorian','2026-10-12').order('date_gregorian'));
  const ids=new Set(transactions.map(x=>x.id));
  const ledger=rawLedger.filter(x=>ids.has(x.transaction_id)||/intealth/i.test(x.recipient||''));
  const result={capturedAt:new Date().toISOString(),transactions,ledger};
  fs.writeFileSync(path.join(__dirname,'myintealth-snapshot.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
