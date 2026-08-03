import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const envRaw = fs.readFileSync('c:/Users/z5340863/zarman-next/.env.local','utf8');
for (const line of envRaw.split(/\r?\n/)) {
  const m = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  process.env[m[1].trim()] = m[2].trim();
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const targetNames = new Set(['Blu B_PM','Revoult','NAB_PM','St. Business']);
const { data: accounts, error: accErr } = await db.from('bank_accounts').select('id,account_name,currency,account_type');
if (accErr) throw accErr;
const targetAccounts = (accounts ?? []).filter(a => targetNames.has(a.account_name));
const targetIds = targetAccounts.map(a => a.id);

const { data: ledger, error: ledErr } = await db
  .from('ledger')
  .select('id,date_gregorian,created_at,type,entry_type,amount_aud,amount_toman,fee_aud,payer_account_id,receiver_account_id,notes,sender,recipient')
  .or(`payer_account_id.in.(${targetIds.join(',')}),receiver_account_id.in.(${targetIds.join(',')})`)
  .order('date_gregorian', { ascending: true })
  .order('created_at', { ascending: true });
if (ledErr) throw ledErr;

const { data: expenses, error: expErr } = await db
  .from('expenses')
  .select('id,date,title,currency,amount,status,payer_account_id,category,notes')
  .in('payer_account_id', targetIds)
  .order('date', { ascending: true });
if (expErr) throw expErr;

const { data: loans, error: loanErr } = await db
  .from('owner_loans')
  .select('id,date,currency,amount,loan_type,account_id,notes')
  .in('account_id', targetIds)
  .order('date', { ascending: true });
if (loanErr) throw loanErr;

const accountMap = new Map(targetAccounts.map(a => [a.id, a]));
const n = v => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

const perAccount = {};
for (const a of targetAccounts) perAccount[a.account_name] = { currency: a.currency, net: 0, fromLedger: 0, fromExpenses: 0, fromLoans: 0, ledgerRows: 0, expenseRows: 0, loanRows: 0 };

for (const row of ledger ?? []) {
  const et = row.entry_type ?? 'trade';
  if (et === 'expense' || et === 'owner_loan') continue;
  if (!['trade','transfer','adjustment'].includes(et)) continue;

  for (const side of ['payer','receiver']) {
    const accountId = side === 'payer' ? row.payer_account_id : row.receiver_account_id;
    if (!accountId || !accountMap.has(accountId)) continue;
    const a = accountMap.get(accountId);
    const aud = n(row.amount_aud);
    const irt = n(row.amount_toman);
    const fee = n(row.fee_aud);

    let delta = 0;
    if (side === 'payer') {
      delta = a.currency === 'AUD' ? -(et === 'transfer' ? aud + fee : aud) : -irt;
    } else {
      delta = a.currency === 'AUD' ? aud : irt;
    }

    const box = perAccount[a.account_name];
    box.net += delta;
    box.fromLedger += delta;
    box.ledgerRows += 1;
  }
}

for (const e of expenses ?? []) {
  if (e.status !== 'paid') continue;
  const a = accountMap.get(e.payer_account_id);
  if (!a) continue;
  if (a.currency !== e.currency) continue;
  const delta = -n(e.amount);
  const box = perAccount[a.account_name];
  box.net += delta;
  box.fromExpenses += delta;
  box.expenseRows += 1;
}

for (const l of loans ?? []) {
  const a = accountMap.get(l.account_id);
  if (!a) continue;
  if (a.currency !== l.currency) continue;
  const delta = l.loan_type === 'injection' ? n(l.amount) : -n(l.amount);
  const box = perAccount[a.account_name];
  box.net += delta;
  box.fromLoans += delta;
  box.loanRows += 1;
}

const recentCut = '2026-07-01';
const recentLedger = (ledger ?? []).filter(r => (r.date_gregorian ?? '') >= recentCut).map(r => ({
  date: r.date_gregorian,
  type: r.type,
  entry_type: r.entry_type ?? 'trade',
  aud: n(r.amount_aud),
  irt: n(r.amount_toman),
  fee_aud: n(r.fee_aud),
  payer: accountMap.get(r.payer_account_id)?.account_name ?? null,
  receiver: accountMap.get(r.receiver_account_id)?.account_name ?? null,
  sender: r.sender,
  recipient: r.recipient
}));

console.log(JSON.stringify({ perAccount, recentLedgerCount: recentLedger.length, recentLedgerSample: recentLedger.slice(-25) }, null, 2));
