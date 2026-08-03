import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const envPath = 'c:/Users/z5340863/zarman-next/.env.local';
const envRaw = fs.readFileSync(envPath, 'utf8');
for (const line of envRaw.split(/\r?\n/)) {
  const m = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  const k = m[1].trim();
  const v = m[2].trim();
  process.env[k] = v;
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const [{ data: accounts, error: accErr }, { data: ledger, error: ledErr }] = await Promise.all([
  db.from('bank_accounts').select('id,account_name,currency,account_type,country,is_active,created_at'),
  db.from('ledger').select('id,date_gregorian,type,entry_type,amount_aud,amount_toman,payer_account_id,receiver_account_id,created_at')
]);

if (accErr) throw accErr;
if (ledErr) throw ledErr;

const rows = ledger ?? [];
const allDates = rows.map(r => r.date_gregorian).filter(Boolean).sort();
const minDate = allDates.length ? allDates[0] : null;
const maxDate = allDates.length ? allDates[allDates.length - 1] : null;

const tradeRowsWithoutDrawerMapping = rows.filter(r => {
  const et = r.entry_type ?? 'trade';
  if (et !== 'trade') return false;
  const payerMissing = !r.payer_account_id;
  const receiverMissing = !r.receiver_account_id;
  return payerMissing ? receiverMissing : false;
}).length;

const invalidEntryTypeRows = rows.filter(r => !['trade', 'transfer', 'expense', 'owner_loan', 'adjustment', null].includes(r.entry_type)).length;

const buyAud = rows
  .filter(r => {
    if (r.type !== 'buy_aud') return false;
    const et = r.entry_type ?? 'trade';
    return et === 'trade';
  })
  .reduce((s, r) => s + Number(r.amount_aud ?? 0), 0);

const sellAud = rows
  .filter(r => {
    if (r.type !== 'sell_aud') return false;
    const et = r.entry_type ?? 'trade';
    return et === 'trade';
  })
  .reduce((s, r) => s + Number(r.amount_aud ?? 0), 0);

console.log(JSON.stringify({
  accountsCount: accounts?.length ?? 0,
  activeAccounts: (accounts ?? []).filter(a => a.is_active).length,
  ledgerRows: rows.length,
  ledgerDateRange: [minDate, maxDate],
  tradeRowsWithoutDrawerMapping,
  invalidEntryTypeRows,
  buyAud,
  sellAud,
  netAud: buyAud - sellAud
}, null, 2));
