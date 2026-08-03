import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const envRaw = fs.readFileSync('c:/Users/z5340863/zarman-next/.env.local','utf8');
for (const line of envRaw.split(/\r?\n/)) {
  const m = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  process.env[m[1].trim()] = m[2].trim();
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: accounts, error: accErr } = await db.from('bank_accounts').select('id,account_name,currency,account_type,country,is_active').order('account_name');
if (accErr) throw accErr;

const { data: refreshState, error: rsErr } = await db.from('report_refresh_state').select('*').eq('id', true).maybeSingle();
if (rsErr) throw rsErr;

const { data: reportRows, error: repErr } = await db.from('report_account_daily').select('account_id,period_start,closing_balance').order('period_start', { ascending: false }).limit(5000);
if (repErr) throw repErr;

const latestByAccount = new Map();
for (const r of reportRows ?? []) {
  if (latestByAccount.has(r.account_id)) continue;
  latestByAccount.set(r.account_id, r);
}

const accountSummary = (accounts ?? []).map(a => {
  const latest = latestByAccount.get(a.id);
  return {
    name: a.account_name,
    currency: a.currency,
    type: a.account_type,
    active: a.is_active,
    latestReportDate: latest?.period_start ?? null,
    latestReportedClosing: latest?.closing_balance ?? null,
  };
});

console.log(JSON.stringify({
  reportState: refreshState,
  accountSummary
}, null, 2));
