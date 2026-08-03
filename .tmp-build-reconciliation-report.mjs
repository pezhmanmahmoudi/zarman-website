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

const n = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
const day = (iso) => (iso || '').slice(0, 10);
const addDays = (d, delta) => {
  const dt = new Date(`${d}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
};

const { data: accounts, error: accErr } = await db
  .from('bank_accounts')
  .select('id,account_name,currency,account_type');
if (accErr) throw accErr;
const accountByName = new Map((accounts ?? []).map(a => [a.account_name, a]));

const targets = ['St. Business', 'Revoult', 'NAB_PM', 'Blu B_PM'];
const targetIds = (accounts ?? []).filter(a => targets.includes(a.account_name)).map(a => a.id);

const [ledgerRes, expRes, loanRes] = await Promise.all([
  db.from('ledger')
    .select('id,date_gregorian,created_at,type,entry_type,amount_aud,amount_toman,fee_aud,payer_account_id,receiver_account_id,sender,recipient,notes')
    .or(`payer_account_id.in.(${targetIds.join(',')}),receiver_account_id.in.(${targetIds.join(',')})`)
    .order('date_gregorian', { ascending: true })
    .order('created_at', { ascending: true }),
  db.from('expenses')
    .select('id,date,title,currency,amount,status,payer_account_id,category,notes')
    .in('payer_account_id', targetIds)
    .order('date', { ascending: true }),
  db.from('owner_loans')
    .select('id,date,currency,amount,loan_type,account_id,notes')
    .in('account_id', targetIds)
    .order('date', { ascending: true }),
]);
if (ledgerRes.error) throw ledgerRes.error;
if (expRes.error) throw expRes.error;
if (loanRes.error) throw loanRes.error;

const ledger = ledgerRes.data ?? [];
const expenses = expRes.data ?? [];
const loans = loanRes.data ?? [];

function buildSystemEvents(accountName) {
  const acc = accountByName.get(accountName);
  if (!acc) return [];
  const events = [];

  for (const r of ledger) {
    const et = r.entry_type ?? 'trade';
    if (!['trade', 'transfer', 'adjustment'].includes(et)) continue;
    const aud = n(r.amount_aud);
    const irt = n(r.amount_toman);
    const fee = n(r.fee_aud);

    if (r.payer_account_id === acc.id) {
      const amt = acc.currency === 'AUD' ? (et === 'transfer' ? aud + fee : aud) : irt;
      events.push({
        source: 'ledger',
        id: String(r.id),
        date: day(r.date_gregorian),
        dir: 'out',
        amount: round2(amt),
        memo: `${r.type || ''} ${r.sender || ''} ${r.recipient || ''}`.trim()
      });
    }

    if (r.receiver_account_id === acc.id) {
      const amt = acc.currency === 'AUD' ? aud : irt;
      events.push({
        source: 'ledger',
        id: String(r.id),
        date: day(r.date_gregorian),
        dir: 'in',
        amount: round2(amt),
        memo: `${r.type || ''} ${r.sender || ''} ${r.recipient || ''}`.trim()
      });
    }
  }

  for (const e of expenses) {
    if (e.status !== 'paid') continue;
    if (e.payer_account_id !== acc.id) continue;
    if (e.currency !== acc.currency) continue;
    events.push({
      source: 'expense',
      id: `expense:${e.id}`,
      date: day(e.date),
      dir: 'out',
      amount: round2(n(e.amount)),
      memo: `${e.title || ''} ${e.category || ''}`.trim()
    });
  }

  for (const l of loans) {
    if (l.account_id !== acc.id) continue;
    if (l.currency !== acc.currency) continue;
    const dir = l.loan_type === 'injection' ? 'in' : 'out';
    events.push({
      source: 'owner_loan',
      id: `loan:${l.id}`,
      date: day(l.date),
      dir,
      amount: round2(n(l.amount)),
      memo: `${l.loan_type || ''}`
    });
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

function parseStBusinessStatementCsv(path) {
  const raw = fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const header = lines.shift();
  const rows = [];

  // naive CSV parse enough for current file shape (commas and occasional escaped commas in descriptions)
  const parseLine = (line) => {
    const out = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) {
        out.push(cur); cur = '';
      } else cur += ch;
    }
    out.push(cur);
    return out;
  };

  for (const line of lines) {
    const [Date, Description, Debit, Credit] = parseLine(line);
    if (!Date) continue;
    const [dd, mm, yyyy] = Date.split('/');
    const iso = `${yyyy}-${mm}-${dd}`;
    if (Debit) rows.push({ date: iso, dir: 'out', amount: round2(n(Debit)), memo: Description || '' });
    if (Credit) rows.push({ date: iso, dir: 'in', amount: round2(n(Credit)), memo: Description || '' });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

const revolutStatement = [
  { date: '2026-04-12', dir: 'in', amount: 2.99, memo: 'Apple Pay top-up' },
  { date: '2026-04-12', dir: 'out', amount: 2.99, memo: 'Card Delivery Fee' },
  { date: '2026-04-13', dir: 'in', amount: 9615.38, memo: 'MCHANGE PTY LTD' },
  { date: '2026-05-04', dir: 'out', amount: 5000.00, memo: 'To Mchange Pty Ltd' },
  { date: '2026-05-13', dir: 'out', amount: 4500.00, memo: 'To A NIKOUI' },
  { date: '2026-06-20', dir: 'in', amount: 1.00, memo: 'MO SHIRKAVAND' },
  { date: '2026-06-20', dir: 'in', amount: 1.00, memo: 'MR JAVAD SHEYKH SOFLA' },
  { date: '2026-06-20', dir: 'in', amount: 1.00, memo: 'BANOO AKRAMI FATH' },
  { date: '2026-06-21', dir: 'in', amount: 1.00, memo: 'BEHRANG MOHAMMADIGERAVAND' },
  { date: '2026-06-21', dir: 'in', amount: 820.00, memo: 'MR SALAR SEHAT' },
  { date: '2026-06-21', dir: 'in', amount: 500.00, memo: 'ELNAZ HOSSEINI' },
  { date: '2026-06-21', dir: 'in', amount: 999.00, memo: 'MO SHIRKAVAND' },
  { date: '2026-06-21', dir: 'in', amount: 1949.00, memo: 'BEHRANG MOHAMMADIGERAVAND' },
  { date: '2026-06-22', dir: 'in', amount: 1200.00, memo: 'ARASH SAHEBGHARANI' },
  { date: '2026-06-23', dir: 'in', amount: 2000.00, memo: 'BANOO AKRAMI FATH' },
  { date: '2026-06-30', dir: 'out', amount: 3254.94, memo: 'Department of Home Affairs' },
  { date: '2026-07-01', dir: 'out', amount: 648.16, memo: 'Australian Medical' },
  { date: '2026-07-02', dir: 'out', amount: 648.16, memo: 'Australian Medical' },
  { date: '2026-07-05', dir: 'out', amount: 2948.03, memo: 'Australian Medical' },
  { date: '2026-07-06', dir: 'in', amount: 1.00, memo: 'MARZIYEH TAHERI' },
  { date: '2026-07-07', dir: 'in', amount: 1499.00, memo: 'MARZIYEH TAHERI' },
  { date: '2026-07-09', dir: 'in', amount: 501.00, memo: 'SOMAYEH TAHERI' },
  { date: '2026-07-14', dir: 'out', amount: 648.16, memo: 'Australian Medical' },
  { date: '2026-07-17', dir: 'in', amount: 1.00, memo: 'MEHDI SHOORIJAZEH' },
  { date: '2026-07-18', dir: 'in', amount: 500.00, memo: 'MAJID NASIRI' },
  { date: '2026-07-19', dir: 'in', amount: 1399.00, memo: 'MEHDI SHOORIJAZEH' },
  { date: '2026-07-21', dir: 'out', amount: 2948.03, memo: 'Australian Medical' },
  { date: '2026-07-22', dir: 'out', amount: 392.00, memo: 'To Zarman Exchange' },
  { date: '2026-07-24', dir: 'in', amount: 1.00, memo: 'MR ARMIN KAVEHEI' },
  { date: '2026-07-24', dir: 'out', amount: 1.00, memo: 'To KAVEHEI ARMIN HOSSEINI' },
  { date: '2026-07-30', dir: 'in', amount: 260.00, memo: 'GOLNAZ FLETT' },
];

const nabStatement = [
  { date: '2026-05-11', dir: 'out', amount: 2.31, memo: 'Transportfornsw' },
  { date: '2026-05-18', dir: 'in', amount: 501.00, memo: 'Laleh Abdollahzadeh debt' },
  { date: '2026-05-27', dir: 'in', amount: 205.00, memo: 'Somayeh Taheri gift' },
  { date: '2026-06-01', dir: 'out', amount: 4.03, memo: 'Transportfornsw' },
  { date: '2026-06-01', dir: 'out', amount: 19.20, memo: 'Transportfornsw' },
  { date: '2026-06-01', dir: 'out', amount: 42.28, memo: 'Midjourney' },
  { date: '2026-06-01', dir: 'out', amount: 648.16, memo: 'Australian Medical' },
  { date: '2026-06-02', dir: 'out', amount: 1.48, memo: 'Intl Txn Fee' },
  { date: '2026-06-17', dir: 'in', amount: 100.00, memo: 'bet365 refund/in' },
  { date: '2026-07-07', dir: 'out', amount: 100.00, memo: 'bet365 + H Babaei Lakeh' },
];

function matchEvents(statement, system, dateToleranceDays = 1) {
  const sys = system.map((e, i) => ({ ...e, _i: i, matched: false }));
  const matched = [];
  const unmatchedStatement = [];

  for (const st of statement) {
    const candidates = [];
    for (const s of sys) {
      if (s.matched) continue;
      if (s.dir !== st.dir) continue;
      if (round2(s.amount) !== round2(st.amount)) continue;
      const d0 = st.date;
      const ok = [d0, addDays(d0, -dateToleranceDays), addDays(d0, dateToleranceDays)].includes(s.date);
      if (!ok) continue;
      const dateScore = s.date === d0 ? 0 : 1;
      candidates.push({ s, dateScore });
    }
    candidates.sort((a, b) => a.dateScore - b.dateScore);
    if (candidates.length) {
      const pick = candidates[0].s;
      pick.matched = true;
      matched.push({ statement: st, system: pick });
    } else {
      unmatchedStatement.push(st);
    }
  }

  const unmatchedSystem = sys.filter(s => !s.matched).map(({ matched, _i, ...rest }) => rest);
  return { matched, unmatchedStatement, unmatchedSystem };
}

const systemStBusiness = buildSystemEvents('St. Business');
const systemRevolut = buildSystemEvents('Revoult');
const systemNab = buildSystemEvents('NAB_PM');
const systemBlu = buildSystemEvents('Blu B_PM');

const stBusinessStatement = parseStBusinessStatementCsv('c:/Users/z5340863/Downloads/trans030826 (1).csv');

const repStBusiness = matchEvents(stBusinessStatement, systemStBusiness, 1);
const repRevolut = matchEvents(revolutStatement, systemRevolut, 1);
const repNab = matchEvents(nabStatement, systemNab, 1);

const blueStatementTotalsRial = {
  opening: 18180524,
  inTotal: 72085631016,
  outTotal: 71176547030,
  closing: 927264510,
};

const blueStatementTotalsToman = {
  opening: Math.round(blueStatementTotalsRial.opening / 10),
  inTotal: Math.round(blueStatementTotalsRial.inTotal / 10),
  outTotal: Math.round(blueStatementTotalsRial.outTotal / 10),
  closing: Math.round(blueStatementTotalsRial.closing / 10),
};

const blueSystemTotals = {
  inTotal: round2(systemBlu.filter(e => e.dir === 'in').reduce((s, e) => s + e.amount, 0)),
  outTotal: round2(systemBlu.filter(e => e.dir === 'out').reduce((s, e) => s + e.amount, 0)),
  closingFromZero: round2(systemBlu.reduce((s, e) => s + (e.dir === 'in' ? e.amount : -e.amount), 0)),
};

const report = {
  generatedAt: new Date().toISOString(),
  note: 'Blu statement values converted from Rial to Toman by dividing by 10.',
  summary: {
    stBusiness: {
      statementRows: stBusinessStatement.length,
      systemRows: systemStBusiness.length,
      matchedRows: repStBusiness.matched.length,
      unmatchedStatementRows: repStBusiness.unmatchedStatement.length,
      unmatchedSystemRows: repStBusiness.unmatchedSystem.length,
      unmatchedStatementSample: repStBusiness.unmatchedStatement.slice(0, 20),
      unmatchedSystemSample: repStBusiness.unmatchedSystem.slice(0, 20),
      systemClosingFromZero: round2(systemStBusiness.reduce((s, e) => s + (e.dir === 'in' ? e.amount : -e.amount), 0))
    },
    revolut: {
      statementRows: revolutStatement.length,
      systemRows: systemRevolut.length,
      matchedRows: repRevolut.matched.length,
      unmatchedStatementRows: repRevolut.unmatchedStatement.length,
      unmatchedSystemRows: repRevolut.unmatchedSystem.length,
      unmatchedStatementSample: repRevolut.unmatchedStatement.slice(0, 20),
      unmatchedSystemSample: repRevolut.unmatchedSystem.slice(0, 20),
      systemClosingFromZero: round2(systemRevolut.reduce((s, e) => s + (e.dir === 'in' ? e.amount : -e.amount), 0))
    },
    nab: {
      statementRows: nabStatement.length,
      systemRows: systemNab.length,
      matchedRows: repNab.matched.length,
      unmatchedStatementRows: repNab.unmatchedStatement.length,
      unmatchedSystemRows: repNab.unmatchedSystem.length,
      unmatchedStatementSample: repNab.unmatchedStatement.slice(0, 20),
      unmatchedSystemSample: repNab.unmatchedSystem.slice(0, 20),
      systemClosingFromZero: round2(systemNab.reduce((s, e) => s + (e.dir === 'in' ? e.amount : -e.amount), 0))
    },
    bluToman: {
      statementTotalsRial: blueStatementTotalsRial,
      statementTotalsToman: blueStatementTotalsToman,
      systemTotalsToman: blueSystemTotals,
      closingDeltaToman: round2(blueSystemTotals.closingFromZero - blueStatementTotalsToman.closing)
    }
  }
};

const outPath = 'c:/Users/z5340863/zarman-next/.tmp-reconciliation-report.json';
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(outPath);
