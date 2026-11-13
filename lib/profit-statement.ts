/**
 * lib/profit-statement.ts
 *
 * One profit statement for a month or the whole history, in AUD and toman.
 * Pure function — every total is a difference between two accounting snapshots,
 * so the statement can never disagree with the treasury's own numbers.
 */

import {
  calcAccountingSnapshot,
  executionRate,
  expenseCostAUD,
  transferFeeAUD,
  type AccountingSnapshot,
  type AccountMeta,
  type ExpenseRowInput,
  type LedgerRowInput,
  type OwnerLoanRowInput,
} from "@/lib/accounting-engine";

export type MoneyLine = { aud: number; irt: number };
export type ProfitStatementLedgerRow = LedgerRowInput & { date_jalali?: string | null; notes?: string | null };
export type ProfitPeriodRange = { period: string; from: string | null; to: string; openingDate: string | null };

export type ProfitStatement = {
  period: string;
  periodLabel: string;
  from: string | null;
  to: string;
  months: { value: string; label: string }[];
  closingRate: number;
  net: MoneyLine;
  realized: MoneyLine;
  paper: MoneyLine;
  /** Change in AUD profit if the closing buy rate were 1,000 toman higher. */
  rateSensitivityAUD: number;
  /** Profit on the toman cost basis, before removing the dollar's rise on capital. */
  tomanCostBasisProfitIRT: number;
  lines: {
    trading: MoneyLine; fees: MoneyLine; expenses: MoneyLine; operating: MoneyLine; realizedFx: MoneyLine;
    unpaidExpenses: MoneyLine; adjustments: MoneyLine; rateEffect: MoneyLine; inventory: MoneyLine; translation: MoneyLine;
  };
  owner: { openingNetAssets: MoneyLine; contributed: MoneyLine; withdrawn: MoneyLine; retained: MoneyLine; closingNetAssets: MoneyLine };
  balances: { audBanks: MoneyLine; irtBanks: MoneyLine; transit: MoneyLine; customers: MoneyLine; ownerLoan: MoneyLine; unpaid: MoneyLine; freeAUD: number };
  expenses: {
    categories: (MoneyLine & { category: string })[];
    transferFees: MoneyLine;
    months: (MoneyLine & { month: string; label: string })[];
  };
  adjustmentRows: { id: string; date: string; account: string; aud: number; irt: number; notes: string | null }[];
  checks: { balancesDifferenceAUD: number; stockDifferenceAUD: number };
};

type ProfitStatementInput = {
  range: ProfitPeriodRange;
  firstDate: string | null;
  today: string;
  ledgerRows: ProfitStatementLedgerRow[];
  expenses: ExpenseRowInput[];
  ownerLoans: OwnerLoanRowInput[];
  accounts: AccountMeta[];
  closingRate: number;
  openingRate: number;
  serviceFeeIncomeIRT: number;
  pendingServiceFeeLiabilityIRT: number;
};

const MONTHS_FA = ["ژانویه", "فوریه", "مارس", "آوریل", "مه", "ژوئن", "ژوئیه", "اوت", "سپتامبر", "اکتبر", "نوامبر", "دسامبر"];
const EXPENSE_TREND_MONTHS = 6;

function shiftMonth(month: string, by: number): string {
  const [year, index] = month.split("-").map(Number);
  return new Date(Date.UTC(year, index - 1 + by, 1)).toISOString().slice(0, 7);
}

function monthLabel(month: string): string {
  const [year, index] = month.split("-").map(Number);
  return `${MONTHS_FA[index - 1]} ${year}`;
}

export function firstActivityDate(ledgerRows: LedgerRowInput[], expenses: ExpenseRowInput[], ownerLoans: OwnerLoanRowInput[]): string | null {
  const dates = [...ledgerRows.map(r => r.date_gregorian), ...expenses.map(e => e.date), ...ownerLoans.map(l => l.date)].filter(Boolean);
  return dates.length ? dates.reduce((first, date) => date < first ? date : first) : null;
}

function activityMonths(firstDate: string | null, today: string): string[] {
  const months: string[] = [];
  if (!firstDate) return months;
  for (let month = firstDate.slice(0, 7); month <= today.slice(0, 7); month = shiftMonth(month, 1)) months.unshift(month);
  return months;
}

function dayBefore(date: string): string {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A free date range (the ledger's filters). No bounds means the whole history. */
export function dateRangePeriod(start?: string | null, end?: string | null): ProfitPeriodRange {
  const from = start && ISO_DATE.test(start) ? start : null;
  const to = end && ISO_DATE.test(end) ? end : null;
  if (!from && !to) return { period: "all", from: null, to: "9999-12-31", openingDate: null };
  return { period: "range", from, to: to ?? "9999-12-31", openingDate: from ? dayBefore(from) : null };
}

function rangeLabel(range: ProfitPeriodRange): string {
  if (range.period === "all") return "کل دوره";
  if (/^\d{4}-\d{2}$/.test(range.period)) return monthLabel(range.period);
  if (range.from && range.to !== "9999-12-31") return `${range.from} تا ${range.to}`;
  return range.from ? `از ${range.from}` : `تا ${range.to}`;
}

/** A month outside the recorded history falls back to the whole history. */
export function profitPeriodRange(requested: string, firstDate: string | null, today: string): ProfitPeriodRange {
  if (!activityMonths(firstDate, today).includes(requested)) return { period: "all", from: null, to: "9999-12-31", openingDate: null };
  const from = `${requested}-01`;
  const [year, index] = requested.split("-").map(Number);
  return {
    period: requested,
    from,
    to: new Date(Date.UTC(year, index, 0)).toISOString().slice(0, 10),
    openingDate: new Date(Date.UTC(year, index - 1, 0)).toISOString().slice(0, 10),
  };
}

function sumLines(...lines: MoneyLine[]): MoneyLine {
  return lines.reduce((total, line) => ({ aud: total.aud + line.aud, irt: total.irt + line.irt }), { aud: 0, irt: 0 });
}

function minusLine(line: MoneyLine, other: MoneyLine): MoneyLine {
  return { aud: line.aud - other.aud, irt: line.irt - other.irt };
}

export function buildProfitStatement(input: ProfitStatementInput): ProfitStatement | null {
  const { range, ledgerRows, expenses, ownerLoans, accounts, closingRate: rate, openingRate, pendingServiceFeeLiabilityIRT } = input;
  if (!(rate > 0)) return null;

  // Service-fee income and liability are undated lifetime totals, so holding them
  // constant keeps them out of a month's movement.
  const snapshotThrough = (date: string, snapshotRate: number) => calcAccountingSnapshot(
    ledgerRows.filter(row => row.date_gregorian <= date),
    expenses.filter(expense => expense.date <= date),
    ownerLoans.filter(loan => loan.date <= date),
    accounts, snapshotRate, input.serviceFeeIncomeIRT, pendingServiceFeeLiabilityIRT,
  );
  const closing = snapshotThrough(range.to, rate);
  const opening = range.openingDate ? snapshotThrough(range.openingDate, openingRate) : null;
  if (closing.netProfitAUD === null || closing.netAssetsAUD === null || (opening && opening.netProfitAUD === null)) return null;

  const change = (pick: (snapshot: AccountingSnapshot) => number | null) => (pick(closing) ?? 0) - (opening ? pick(opening) ?? 0 : 0);
  const fromIRT = (irt: number): MoneyLine => ({ aud: irt / rate, irt });
  const fromAUD = (aud: number): MoneyLine => ({ aud, irt: aud * rate });
  const inPeriod = (date: string) => (!range.from || date >= range.from) && date <= range.to;
  const accountById = new Map(accounts.map(account => [account.id, account]));
  const currencies = new Map(accounts.map(account => [account.id, account.currency as string]));
  const signedLeg = (row: LedgerRowInput, currency: "AUD" | "IRT", amount: number) =>
    (currencies.get(row.receiver_account_id ?? "") === currency ? amount : 0) - (currencies.get(row.payer_account_id ?? "") === currency ? amount : 0);

  // ── Expenses ─────────────────────────────────────────────────────────────
  const expenseIRT = (expense: ExpenseRowInput) => expense.currency === "AUD"
    ? Number(expense.amount) * (Number(expense.exchange_rate) > 0 ? Number(expense.exchange_rate) : rate)
    : Number(expense.amount);
  const feeRows = ledgerRows.map(row => ({ row, fee: transferFeeAUD(row, currencies) })).filter(item => item.fee > 0);
  const feeIRT = (row: LedgerRowInput, fee: number) => fee * (executionRate(row) || rate);
  const paid = expenses.filter(expense => expense.status === "paid");

  const byCategory = new Map<string, MoneyLine>();
  for (const expense of paid.filter(item => inPeriod(item.date))) {
    byCategory.set(expense.category, sumLines(byCategory.get(expense.category) ?? { aud: 0, irt: 0 },
      { aud: expenseCostAUD(expense, currencies, rate), irt: expenseIRT(expense) }));
  }
  const periodFees = feeRows.filter(item => inPeriod(item.row.date_gregorian));
  const transferFees = { aud: periodFees.reduce((sum, item) => sum + item.fee, 0), irt: change(a => a.transferFeesIRT) };
  const paidAUD = [...byCategory.values()].reduce((sum, line) => sum + line.aud, 0) + transferFees.aud;
  const unpaidAUD = expenses.filter(e => e.status === "pending" && inPeriod(e.date)).reduce((sum, e) => sum + expenseCostAUD(e, currencies, rate), 0);

  const lastMonth = (range.to < input.today ? range.to : input.today).slice(0, 7);
  const firstMonth = input.firstDate?.slice(0, 7) ?? lastMonth;
  const monthExpenses = (month: string) => sumLines(
    ...paid.filter(e => e.date.slice(0, 7) === month).map(e => ({ aud: expenseCostAUD(e, currencies, rate), irt: expenseIRT(e) })),
    ...feeRows.filter(item => item.row.date_gregorian.slice(0, 7) === month).map(item => ({ aud: item.fee, irt: feeIRT(item.row, item.fee) })),
  );
  const trend = Array.from({ length: EXPENSE_TREND_MONTHS }, (_, index) => shiftMonth(lastMonth, -index))
    .filter(month => month >= firstMonth)
    .map(month => ({ month, label: monthLabel(month), ...monthExpenses(month) }));

  // ── Statement ────────────────────────────────────────────────────────────
  const trading = fromIRT(change(a => a.realizedTradingProfit));
  const fees = fromIRT(change(a => a.feeIncomeIRT));
  const expenseLine = { aud: -paidAUD, irt: -(change(a => a.paidExpensesIRT) + transferFees.irt) };
  const operating = sumLines(trading, fees, expenseLine);
  const realizedFx = fromIRT(change(a => a.realizedFXGainLossIRT));
  const unpaidExpenses = { aud: -unpaidAUD, irt: -change(a => a.pendingExpensesIRT) };
  // Net value not explained by capital or the toman result: manual corrections and non-cash funding.
  const adjustments = fromIRT(change(a => a.netBusinessValueIRT - a.ownerCapitalHistoricalIRT - a.totalProfit + a.pendingExpensesIRT));
  const inventory = fromIRT(change(a => a.unrealizedInventoryGainIRT));
  const translation = fromIRT(change(a => a.fxTranslationGainLossIRT));
  const net = fromAUD(change(a => a.netProfitAUD));
  const paper = sumLines(inventory, translation);
  const realized = minusLine(net, paper);
  const rateEffect = minusLine(realized, sumLines(operating, realizedFx, unpaidExpenses, adjustments));

  // ── Owner and balances ───────────────────────────────────────────────────
  const contributed = fromAUD(change(a => a.ownerCapitalContributedAUD));
  const withdrawn = fromAUD(change(a => a.ownerCapitalWithdrawnAUD));
  const drawers = Object.values(closing.drawerBalances);
  const drawerTotal = (currency: "AUD" | "IRT", type: AccountMeta["type"]) =>
    drawers.filter(d => d.currency === currency && d.type === type).reduce((sum, d) => sum + d.balance, 0);
  const balances = {
    audBanks: fromAUD(drawerTotal("AUD", "bank")),
    irtBanks: fromIRT(drawerTotal("IRT", "bank")),
    transit: sumLines(fromAUD(drawerTotal("AUD", "transit")), fromIRT(drawerTotal("IRT", "transit"))),
    customers: fromAUD(closing.customerAccountPositionAUD ?? 0),
    ownerLoan: fromAUD(-(closing.ownerLoanBalanceAUD ?? 0)),
    unpaid: fromIRT(-(closing.pendingExpensesCurrentIRT + pendingServiceFeeLiabilityIRT)),
  };

  // Request fees and internal adjustment transfers stay out of trading stock by design.
  const outsideStockAUD = ledgerRows
    .filter(r => r.date_gregorian <= range.to && r.entry_type === "adjustment" && (r.request_fee_entry_id || r.type === "transfer"))
    .reduce((sum, r) => sum + signedLeg(r, "AUD", Number(r.amount_aud)), 0);
  const audDrawers = drawers.filter(d => d.currency === "AUD").reduce((sum, d) => sum + d.balance, 0);

  return {
    period: range.period,
    periodLabel: rangeLabel(range),
    from: range.from,
    to: range.to,
    months: activityMonths(input.firstDate, input.today).map(month => ({ value: month, label: monthLabel(month) })),
    closingRate: rate,
    net, realized, paper,
    rateSensitivityAUD: (snapshotThrough(range.to, rate + 1000).netProfitAUD ?? 0) - closing.netProfitAUD,
    tomanCostBasisProfitIRT: change(a => a.totalProfit),
    lines: { trading, fees, expenses: expenseLine, operating, realizedFx, unpaidExpenses, adjustments, rateEffect, inventory, translation },
    owner: {
      openingNetAssets: fromAUD(opening?.netAssetsAUD ?? 0),
      contributed, withdrawn,
      retained: minusLine(net, withdrawn),
      closingNetAssets: fromAUD(closing.netAssetsAUD),
    },
    balances: { ...balances, freeAUD: closing.audInventory },
    expenses: {
      categories: [...byCategory.entries()].map(([category, line]) => ({ category, ...line })).sort((a, b) => b.aud - a.aud),
      transferFees,
      months: trend,
    },
    adjustmentRows: ledgerRows
      .filter(r => r.entry_type === "adjustment" && !r.request_fee_entry_id && inPeriod(r.date_gregorian))
      .sort((a, b) => b.date_gregorian.localeCompare(a.date_gregorian))
      .map(r => ({
        id: r.id,
        date: r.date_jalali || r.date_gregorian,
        account: (accountById.get(r.receiver_account_id ?? "") ?? accountById.get(r.payer_account_id ?? ""))?.name ?? "—",
        aud: signedLeg(r, "AUD", Number(r.amount_aud)),
        irt: signedLeg(r, "IRT", Number(r.amount_toman)),
        notes: r.notes ?? null,
      }))
      .filter(r => r.aud !== 0 || r.irt !== 0),
    checks: {
      balancesDifferenceAUD: sumLines(...Object.values(balances)).aud - closing.netAssetsAUD,
      stockDifferenceAUD: closing.audInventory - (audDrawers - outsideStockAUD),
    },
  };
}

export type ProfitTrendPoint = {
  month: string;
  label: string;
  /** True for the month still in progress; it is valued at today's rate. */
  partial: boolean;
  /** Net profit earned in the month, AUD (closing minus opening snapshot). */
  netAUD: number;
  /** Net profit since the first recorded day, AUD, at the month-end rate. */
  cumulativeAUD: number;
  netAssetsAUD: number;
};

type ProfitTrendInput = Omit<ProfitStatementInput, "range" | "closingRate" | "openingRate"> & {
  /** Buy rate in force on a date; month ends use the rate recorded on or before that day. */
  rateAt: (date: string) => number;
};

/**
 * Month-by-month net profit for the whole history. Each month is the same
 * snapshot difference the monthly statement uses, so a bar always equals the
 * headline of that month's statement.
 */
function monthEnd(month: string): string {
  const [year, index] = month.split("-").map(Number);
  return new Date(Date.UTC(year, index, 0)).toISOString().slice(0, 10);
}

/** The dates whose buy rate values each trend month: its last day, or today for the month in progress. */
export function profitTrendRateDates(firstDate: string | null, today: string): string[] {
  return activityMonths(firstDate, today).reverse().map(month => monthEnd(month) >= today ? today : monthEnd(month));
}

export function buildProfitTrend(input: ProfitTrendInput): ProfitTrendPoint[] {
  const months = activityMonths(input.firstDate, input.today).reverse();
  const points: ProfitTrendPoint[] = [];
  let previous = 0;
  for (const month of months) {
    const end = monthEnd(month);
    const partial = end >= input.today;
    const rate = input.rateAt(partial ? input.today : end);
    if (!(rate > 0)) return [];
    const snapshot = calcAccountingSnapshot(
      input.ledgerRows.filter(row => row.date_gregorian <= end),
      input.expenses.filter(expense => expense.date <= end),
      input.ownerLoans.filter(loan => loan.date <= end),
      input.accounts, rate, input.serviceFeeIncomeIRT, input.pendingServiceFeeLiabilityIRT,
    );
    if (snapshot.netProfitAUD === null || snapshot.netAssetsAUD === null) return [];
    points.push({
      month, label: monthLabel(month), partial,
      netAUD: snapshot.netProfitAUD - previous,
      cumulativeAUD: snapshot.netProfitAUD,
      netAssetsAUD: snapshot.netAssetsAUD,
    });
    previous = snapshot.netProfitAUD;
  }
  return points;
}
