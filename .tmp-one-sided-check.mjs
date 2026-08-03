import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const envRaw = fs.readFileSync('c:/Users/z5340863/zarman-next/.env.local','utf8');
for (const line of envRaw.split(/\r?\n/)) {
  const m = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  process.env[m[1].trim()] = m[2].trim();
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: accounts } = await db.from('bank_accounts').select('id,account_name');
const nameById = new Map((accounts ?? []).map(a => [a.id, a.account_name]));

const { data: rows, error } = await db.from('ledger').select('id,date_gregorian,entry_type,type,payer_account_id,receiver_account_id,amount_aud,amount_toman');
if (error) throw error;

const targets = new Set(['Blu B_PM','St. Business','Revoult','NAB_PM']);
const stats = {};
for (const n of targets) stats[n] = { oneSidedRows: 0, totalRows: 0 };

for (const r of (rows ?? [])) {
  const et = r.entry_type ?? 'trade';
  if (et !== 'trade') continue;
  const payerName = r.payer_account_id ? nameById.get(r.payer_account_id) : null;
  const receiverName = r.receiver_account_id ? nameById.get(r.receiver_account_id) : null;

  const inTarget = targets.has(payerName) || targets.has(receiverName);
  if (!inTarget) continue;

  if (targets.has(payerName)) stats[payerName].totalRows += 1;
  if (targets.has(receiverName)) stats[receiverName].totalRows += 1;

  const oneSided = (!payerName && !!receiverName) || (!!payerName && !receiverName);
  if (oneSided) {
    if (targets.has(payerName)) stats[payerName].oneSidedRows += 1;
    if (targets.has(receiverName)) stats[receiverName].oneSidedRows += 1;
  }
}

console.log(JSON.stringify(stats, null, 2));
