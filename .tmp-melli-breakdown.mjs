import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const envRaw = fs.readFileSync('c:/Users/z5340863/zarman-next/.env.local','utf8');
for (const line of envRaw.split(/\r?\n/)) {
  const m = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  process.env[m[1].trim()] = m[2].trim();
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const { data: account, error: accErr } = await db
  .from('bank_accounts')
  .select('id,account_name,currency,account_type')
  .eq('account_name', 'Melli B_NB')
  .maybeSingle();
if (accErr) throw accErr;
if (!account) throw new Error('Melli B_NB not found');

const [ledgerRes, expRes, loanRes] = await Promise.all([
  db.from('ledger')
    .select('id,date_gregorian,created_at,type,entry_type,amount_aud,amount_toman,fee_aud,payer_account_id,receiver_account_id,sender,recipient,notes')
    .or(`payer_account_id.eq.${account.id},receiver_account_id.eq.${account.id}`)
    .order('date_gregorian', { ascending: true })
    .order('created_at', { ascending: true }),
  db.from('expenses')
    .select('id,date,title,currency,amount,status,payer_account_id,category')
    .eq('payer_account_id', account.id)
    .order('date', { ascending: true }),
  db.from('owner_loans')
    .select('id,date,currency,amount,loan_type,account_id')
    .eq('account_id', account.id)
    .order('date', { ascending: true }),
]);
if (ledgerRes.error) throw ledgerRes.error;
if (expRes.error) throw expRes.error;
if (loanRes.error) throw loanRes.error;

const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const ledger = ledgerRes.data ?? [];
const expenses = expRes.data ?? [];
const loans = loanRes.data ?? [];

let ledgerNet = 0;
let ledgerIn = 0;
let ledgerOut = 0;
for (const r of ledger) {
  const et = r.entry_type ?? 'trade';
  if (!['trade','transfer','adjustment'].includes(et)) continue;
  const amount = n(r.amount_toman);
  if (r.receiver_account_id === account.id) {
    ledgerNet += amount;
    ledgerIn += amount;
  }
  if (r.payer_account_id === account.id) {
    ledgerNet -= amount;
    ledgerOut += amount;
  }
}

let expenseOut = 0;
for (const e of expenses) {
  if (e.status !== 'paid') continue;
  if (e.currency !== 'IRT') continue;
  expenseOut += n(e.amount);
}

let loanNet = 0;
for (const l of loans) {
  if (l.currency !== 'IRT') continue;
  const amt = n(l.amount);
  loanNet += l.loan_type === 'injection' ? amt : -amt;
}

const { data: reportLatest } = await db
  .from('report_account_daily')
  .select('period_start,closing_balance')
  .eq('account_id', account.id)
  .order('period_start', { ascending: false })
  .limit(1)
  .maybeSingle();

console.log(JSON.stringify({
  account,
  ledgerRows: ledger.length,
  ledgerIn,
  ledgerOut,
  ledgerNet,
  paidExpenseOutIRT: expenseOut,
  ownerLoansNetIRT: loanNet,
  computedTreasuryBalance: ledgerNet - expenseOut + loanNet,
  latestReportAccountDaily: reportLatest ?? null,
  recentLedgerSample: ledger.slice(-10).map(r => ({
    date: r.date_gregorian,
    entry_type: r.entry_type ?? 'trade',
    type: r.type,
    amount_toman: n(r.amount_toman),
    payer: r.payer_account_id === account.id ? 'Melli B_NB' : 'other',
    receiver: r.receiver_account_id === account.id ? 'Melli B_NB' : 'other',
    sender: r.sender,
    recipient: r.recipient,
  }))
}, null, 2));
