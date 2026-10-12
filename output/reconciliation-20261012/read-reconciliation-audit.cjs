const fs=require('node:fs');
const path=require('node:path');
const {loadEnvConfig}=require('@next/env');
const {createClient}=require('@supabase/supabase-js');
loadEnvConfig(process.cwd(),true,{info(){},error(){}});
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const details=JSON.parse(fs.readFileSync(path.join(__dirname,'expanded-details.json'),'utf8'));
const fields=['amount_aud','equivalent_toman','amount_toman','fee_aud','ledger_fee_aud','exchange_rate','applied_rate','status','notes','payer_account_id','receiver_account_id'];
const amounts=value=>value?Object.fromEntries(fields.filter(k=>Object.hasOwn(value,k)).map(k=>[k,value[k]])):null;
async function rows(q){const r=await q;if(r.error)throw new Error(r.error.message);return r.data;}
(async()=>{
 const targets=[...details.transactions.map(x=>x.id),...details.ledger.map(x=>x.id)];
 const audit=await rows(db.from('audit_logs').select('action,target_id,old_value,new_value,created_at').in('target_id',targets).in('action',['TRANSACTION_APPROVED','TRANSACTION_UPDATED','LEDGER_ENTRY_UPDATED']).order('created_at').limit(500));
 const rawlinks=await rows(db.from('transactions').select('reference_code,payment_link').in('reference_code',['ZE43751','ZE92705','ZE12365','ZE32449']));
 const links=rawlinks.map(x=>{let host=null;if(x.payment_link){try{host=new URL(x.payment_link).hostname;}catch{host='unparseable';}}return{reference:x.reference_code,host};});
 const result={audit:audit.map(x=>({...x,old_value:amounts(x.old_value),new_value:amounts(x.new_value)})),links};
 fs.writeFileSync(path.join(__dirname,'reconciliation-audit.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
