import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const envRaw = fs.readFileSync('c:/Users/z5340863/zarman-next/.env.local','utf8');
for (const line of envRaw.split(/\r?\n/)) {
  const m = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  process.env[m[1].trim()] = m[2].trim();
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: accounts } = await db.from('bank_accounts').select('id,account_name,currency').in('account_name', ['Revoult','NAB_PM']);
const map = new Map((accounts ?? []).map(a => [a.id, a]));
const ids = (accounts ?? []).map(a => a.id);

const { data: ledger } = await db.from('ledger').select('id,date_gregorian,type,entry_type,amount_aud,amount_toman,fee_aud,payer_account_id,receiver_account_id,sender,recipient').or(`payer_account_id.in.(${ids.join(',')}),receiver_account_id.in.(${ids.join(',')})`).order('date_gregorian', {ascending:true}).order('created_at',{ascending:true});
const { data: expenses } = await db.from('expenses').select('id,date,title,currency,amount,status,payer_account_id,category').in('payer_account_id', ids).order('date',{ascending:true});

const n=v=>{const x=Number(v); return Number.isFinite(x)?x:0;};
const out=[];
for(const r of (ledger??[])){
  const et = r.entry_type ?? 'trade';
  if (!['trade','transfer','adjustment'].includes(et)) continue;
  for(const side of ['payer','receiver']){
    const id = side==='payer' ? r.payer_account_id : r.receiver_account_id;
    if(!id || !map.has(id)) continue;
    const a = map.get(id);
    const delta = side==='payer' ? -n(r.amount_aud) : n(r.amount_aud);
    out.push({account:a.account_name,date:r.date_gregorian,source:'ledger',type:r.type,entry_type:et,deltaAud:Number(delta.toFixed(2)),amount_aud:n(r.amount_aud),sender:r.sender,recipient:r.recipient});
  }
}
for(const e of (expenses??[])){
  if(e.status!=='paid') continue;
  const a = map.get(e.payer_account_id); if(!a) continue;
  out.push({account:a.account_name,date:e.date,source:'expense',type:e.title,entry_type:e.category,deltaAud:Number((-n(e.amount)).toFixed(2)),amount_aud:n(e.amount),sender:null,recipient:null});
}
out.sort((a,b)=> (a.account.localeCompare(b.account)) || (a.date.localeCompare(b.date)) || (a.source.localeCompare(b.source)));
console.log(JSON.stringify(out,null,2));
