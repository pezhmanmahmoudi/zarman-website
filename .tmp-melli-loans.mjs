import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const envRaw = fs.readFileSync('c:/Users/z5340863/zarman-next/.env.local','utf8');
for (const line of envRaw.split(/\r?\n/)) {
  const m = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  process.env[m[1].trim()] = m[2].trim();
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession:false, autoRefreshToken:false } });

const { data: acc } = await db.from('bank_accounts').select('id').eq('account_name','Melli B_NB').single();
const { data: loans, error } = await db.from('owner_loans').select('id,date,currency,amount,loan_type,exchange_rate,notes,account_id').eq('account_id', acc.id).order('date', {ascending:true});
if (error) throw error;

const net = (loans ?? []).reduce((s,l)=> s + (l.loan_type === 'injection' ? Number(l.amount||0) : -Number(l.amount||0)), 0);
console.log(JSON.stringify({count: loans?.length ?? 0, netIRT: net, loans}, null, 2));
