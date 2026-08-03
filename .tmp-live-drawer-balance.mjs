import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const envRaw = fs.readFileSync('c:/Users/z5340863/zarman-next/.env.local','utf8');
for (const line of envRaw.split(/\r?\n/)) {
  const m = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  process.env[m[1].trim()] = m[2].trim();
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const [accRes, ledRes, expRes, loanRes] = await Promise.all([
  db.from('bank_accounts').select('id,account_name,currency,account_type,is_active'),
  db.from('ledger').select('id,entry_type,type,amount_aud,amount_toman,fee_aud,date_gregorian,created_at,payer_account_id,receiver_account_id').order('date_gregorian', { ascending: true }).order('created_at', { ascending: true }),
  db.from('expenses').select('id,currency,amount,exchange_rate,status,payer_account_id'),
  db.from('owner_loans').select('id,currency,amount,exchange_rate,loan_type,account_id')
]);
if (accRes.error) throw accRes.error;
if (ledRes.error) throw ledRes.error;
if (expRes.error) throw expRes.error;
if (loanRes.error) throw loanRes.error;

const accounts = accRes.data ?? [];
const ledger = ledRes.data ?? [];
const expenses = expRes.data ?? [];
const loans = loanRes.data ?? [];

const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

const balances = {};
for (const a of accounts) {
  balances[a.id] = {
    accountId: a.id,
    accountName: a.account_name,
    currency: a.currency,
    type: a.account_type,
    active: a.is_active,
    balance: 0
  };
}

for (const row of ledger) {
  const entryType = row.entry_type ?? 'trade';
  if (entryType === 'expense' || entryType === 'owner_loan') continue;
  if (!['trade', 'transfer', 'adjustment'].includes(entryType)) continue;

  const aud = n(row.amount_aud);
  const irt = n(row.amount_toman);
  const fee = n(row.fee_aud);

  if (row.payer_account_id && balances[row.payer_account_id]) {
    const payer = balances[row.payer_account_id];
    const amountToDeduct = payer.currency === 'AUD' ? (entryType === 'transfer' ? aud + fee : aud) : irt;
    payer.balance -= amountToDeduct;
  }

  if (row.receiver_account_id && balances[row.receiver_account_id]) {
    const receiver = balances[row.receiver_account_id];
    const amountToAdd = receiver.currency === 'AUD' ? aud : irt;
    receiver.balance += amountToAdd;
  }
}

for (const exp of expenses) {
  if (exp.status !== 'paid') continue;
  if (!exp.payer_account_id) continue;
  const account = balances[exp.payer_account_id];
  if (!account) continue;
  if (account.currency !== exp.currency) continue;
  account.balance -= n(exp.amount);
}

for (const loan of loans) {
  if (!loan.account_id) continue;
  const account = balances[loan.account_id];
  if (!account) continue;
  if (account.currency !== loan.currency) continue;
  const movement = loan.loan_type === 'injection' ? n(loan.amount) : -n(loan.amount);
  account.balance += movement;
}

const rows = Object.values(balances)
  .sort((a,b)=>a.accountName.localeCompare(b.accountName))
  .map(a => ({ name: a.accountName, currency: a.currency, type: a.type, active: a.active, balance: Number(a.balance.toFixed(2)) }));

console.log(JSON.stringify(rows, null, 2));
