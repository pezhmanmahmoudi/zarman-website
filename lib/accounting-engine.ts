/**
 * lib/accounting-engine.ts
 *
 * Zarman Treasury — Accounting Engine (v2)
 *
 * Pure functions. Zero side effects. Zero database calls.
 * All inputs are raw data from server actions.
 * All outputs are normalized snapshots consumed by the UI.
 *
 * ─────────────────────────────────────────────────────────
 * INVENTORY METHODOLOGY: Moving Weighted Average Cost (WAC)
 * ─────────────────────────────────────────────────────────
 * The engine SORTS rows internally before processing.
 * Sort order: date_gregorian ASC, then created_at ASC.
 * Callers do NOT need to pre-sort.
 *
 * On each buy_aud:
 *   newWAC = (currentInventory × oldWAC + newAUD × newRate)
 *            / (currentInventory + newAUD)
 *
 * On each sell_aud:
 *   realizedProfit += IRT received − (AUD sold × currentWAC)
 *   WAC is unchanged; only inventory quantity decreases.
 *
 * ─────────────────────────────────────────────────────────
 * NEGATIVE INVENTORY DETECTION
 * ─────────────────────────────────────────────────────────
 * Negative inventory is never silently clamped to zero.
 * If a sell_aud would reduce inventory below zero, the actual
 * (negative) quantity is tracked and a warning is emitted.
 * The UI must surface this condition explicitly.
 *
 * ─────────────────────────────────────────────────────────
 * HISTORICAL EXCHANGE RATES
 * ─────────────────────────────────────────────────────────
 * AUD-denominated expenses and owner loans use the exchange_rate
 * field stored at the time of creation. If exchange_rate is
 * NULL for an AUD row, the engine falls back to currentBuyRate
 * and adds an entry to accountingWarnings[].
 *
 * This ensures historical figures are never recalculated
 * using today's rate.
 *
 * ─────────────────────────────────────────────────────────
 * EXCLUDED FROM ALL CALCULATIONS:
 *   - transfer entries (internal account movements)
 *   - owner_loan entries (balance-sheet liabilities, not revenue)
 * ─────────────────────────────────────────────────────────
 *
 * PROFIT HIERARCHY (never merged in UI):
 *   Realized Trading Profit  ← from completed AUD sales
 *   + Fee Income             ← earned transaction fees
 *   - Paid Expenses          ← operational costs (IRT equivalent)
 *   = Operating Profit
 *
 *   + Unrealized P/L         ← mark-to-market on current inventory
 *   = Total Profit
 */

// ── Input types ────────────────────────────────────────────────────────────

/**
 * A single row from the ledger table.
 * Sorting is performed internally by the engine.
 */
export type LedgerRowInput = {
  id: string;
  type: string;               // "buy_aud" | "sell_aud" (legacy) + entry_type for new entries
  entry_type: string | null;  // "trade" | "expense" | "owner_loan" | "adjustment" | "transfer"
  amount_aud: number | string;
  amount_toman: number | string;
  exchange_rate: number | string;
  fee_aud: number | string;
  date_gregorian: string;
  payer_account: string | null;
  receiver_account: string | null;
  created_at?: string;
};

export type ExpenseRowInput = {
  id: string;
  currency: "AUD" | "IRT";
  amount: number | string;
  /** Historical IRT/AUD exchange rate at time of expense. NULL triggers a warning for AUD rows. */
  exchange_rate?: number | string | null;
  status: "paid" | "pending";
  date: string;
  category: string;
  payer_account: string;
};

export type OwnerLoanRowInput = {
  id: string;
  currency: "AUD" | "IRT";
  amount: number | string;
  /** Historical IRT/AUD exchange rate at time of loan. NULL triggers a warning for AUD rows. */
  exchange_rate?: number | string | null;
  loan_type: "injection" | "repayment";
  account: string;
  date: string;
};

// ── Output types ───────────────────────────────────────────────────────────

export type AccountingSnapshot = {
  /**
   * AUD INVENTORY
   * Current AUD held by Zarman after all buys and sells.
   * MAY BE NEGATIVE if sells exceed buys — see accountingWarnings[].
   * = sum(buy_aud) − sum(sell_aud) across all trade entries
   */
  audInventory: number;

  /**
   * MOVING WEIGHTED AVERAGE COST (IRT per AUD)
   * The average IRT cost of the current AUD inventory,
   * recalculated on each purchase using moving WAC.
   * Zero if no inventory exists.
   */
  wac: number;

  /**
   * REALIZED TRADING PROFIT (IRT)
   * Profit from completed AUD disposals:
   * = sum over all sell_aud of (IRT received − AUD sold × WAC at time of sale)
   * Always realized cash-equivalent. Excludes fees.
   */
  realizedTradingProfit: number;

  /**
   * FEE INCOME (IRT)
   * Transaction fee income converted to IRT using each row's implied rate:
   * fee_aud × (amount_toman / amount_aud)
   * This is realized income.
   */
  feeIncomeIRT: number;

  /**
   * UNREALIZED PROFIT / LOSS (IRT)
   * Mark-to-market gain or loss on current AUD inventory:
   * = (currentBuyRate − WAC) × audInventory
   * Uses currentBuyRate as replacement cost basis (conservative assumption).
   */
  unrealizedPL: number;

  /**
   * INVENTORY COST VALUE (IRT)
   * Current AUD inventory valued at the Moving WAC (acquisition cost):
   * = audInventory × WAC
   * Represents what was paid to acquire the current inventory.
   */
  inventoryCostValueIRT: number;

  /**
   * INVENTORY MARKET VALUE (IRT)
   * Current AUD inventory valued at today's buy rate:
   * = audInventory × currentBuyRate
   * Represents what the inventory is worth at current market prices.
   * NOTE: Do not mix with inventoryCostValueIRT in any calculation.
   */
  inventoryMarketValueIRT: number;

  /**
   * @deprecated Use inventoryMarketValueIRT instead.
   * Kept for backward compatibility with existing UI code.
   */
  inventoryValueIRT: number;

  /**
   * PAID EXPENSES (IRT equivalent)
   * Only 'paid' expenses are deducted from Operating Profit.
   * AUD expenses use their stored historical exchange_rate.
   * IRT expenses are used directly.
   */
  paidExpensesIRT: number;

  /**
   * PENDING EXPENSES (IRT equivalent)
   * Accrued but not yet paid. Shown separately in UI.
   * NOT deducted from any profit figure.
   */
  pendingExpensesIRT: number;

  /**
   * OPERATING PROFIT (IRT)
   * = Realized Trading Profit + Fee Income − Paid Expenses
   * Core business performance metric.
   * Does NOT include unrealized mark-to-market.
   */
  operatingProfit: number;

  /**
   * TOTAL PROFIT (IRT)
   * = Operating Profit + Unrealized P/L
   * Displayed separately from Operating Profit in the UI.
   * Never merged into a single figure.
   */
  totalProfit: number;

  /**
   * OWNER LOAN BALANCE (IRT equivalent)
   * = sum(injections converted to IRT) − sum(repayments converted to IRT)
   * Represents what the business owes back to the owner.
   * AUD loans use their historical exchange_rate.
   * NEVER enters any profit formula.
   */
  ownerLoanBalanceIRT: number;

  /**
   * TOTAL ASSET VALUE (IRT)
   * = Inventory Market Value + Iran Liquidity (Kadoos + Pezhman)
   */
  totalAssetValueIRT: number;

  /**
   * NET BUSINESS VALUE (IRT)
   * = Total Asset Value − Outstanding Owner Balance
   * What genuinely belongs to the business (not owed to the owner).
   */
  netBusinessValueIRT: number;

  // ── Breakdown arrays ──────────────────────────────────────────────────
  expensesByCategory: Record<string, number>;
  monthlyExpenses: { month: string; amountIRT: number }[];

  // ── Diagnostic metadata ───────────────────────────────────────────────
  tradeRowsProcessed: number;
  buyRowsCount: number;
  sellRowsCount: number;
  totalBuyAUD: number;
  totalSellAUD: number;
  currentBuyRate: number;

  // ── WAC history (last 12 buy events) ──────────────────────────────────
  wacHistory: { date: string; wac: number; inventoryAfter: number }[];

  /**
   * ACCOUNTING WARNINGS
   * Non-fatal issues detected during calculation.
   * Surface these in the UI — never silently suppress them.
   *
   * Examples:
   *   "Inventory became negative after row <id>"
   *   "AUD expense <id> missing historical exchange_rate — used current rate"
   *   "AUD loan <id> missing historical exchange_rate — used current rate"
   *   "Sell row <id>: sold quantity exceeds available inventory"
   */
  accountingWarnings: string[];
};

// ── Internal running state for Moving WAC ──────────────────────────────────

type WACState = {
  inventoryAUD: number;  // may become negative; never clamped
  wac: number;
  realizedProfit: number;
};

// ── Helper: safe numeric coercion ─────────────────────────────────────────

function n(v: number | string | null | undefined): number {
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : 0;
}

// ── Internal sort ──────────────────────────────────────────────────────────

/**
 * Sort ledger rows chronologically: date_gregorian ASC, then created_at ASC.
 * Returns a NEW array — never mutates the input.
 */
function sortLedgerRows(rows: LedgerRowInput[]): LedgerRowInput[] {
  return [...rows].sort((a, b) => {
    const dateCmp = a.date_gregorian.localeCompare(b.date_gregorian);
    if (dateCmp !== 0) return dateCmp;
    const aTs = a.created_at ?? "";
    const bTs = b.created_at ?? "";
    return aTs.localeCompare(bTs);
  });
}

/**
 * Determines whether a ledger row is a trade entry (buy_aud or sell_aud).
 * Supports both legacy rows (no entry_type) and new rows with entry_type = 'trade'.
 * Transfers, expenses, owner_loans, and adjustments are explicitly excluded.
 */
function isTradeRow(row: LedgerRowInput): boolean {
  const et = row.entry_type ?? "trade";  // legacy rows default to trade
  if (et === "transfer" || et === "expense" || et === "owner_loan" || et === "adjustment") {
    return false;
  }
  return row.type === "buy_aud" || row.type === "sell_aud";
}

/**
 * calcMovingWAC
 *
 * Processes a CHRONOLOGICALLY SORTED array of ledger rows and
 * computes Moving WAC state after all trades.
 *
 * NEGATIVE INVENTORY:
 *   If a sell would drive inventory below zero, the actual negative
 *   quantity is preserved. A warning is pushed to `warnings[]`.
 *   The caller decides how to surface this to the user.
 *
 * @param rows     Pre-sorted ledger rows (sorted by the engine)
 * @param warnings Mutable array — warnings are appended here
 */
function calcMovingWAC(
  rows: LedgerRowInput[],
  warnings: string[],
): {
  state: WACState;
  wacHistory: { date: string; wac: number; inventoryAfter: number }[];
} {
  let state: WACState = { inventoryAUD: 0, wac: 0, realizedProfit: 0 };
  const wacHistory: { date: string; wac: number; inventoryAfter: number }[] = [];

  for (const row of rows) {
    if (!isTradeRow(row)) continue;

    const aud = n(row.amount_aud);
    const irt = n(row.amount_toman);

    if (aud <= 0 || irt <= 0) continue;

    if (row.type === "buy_aud") {
      // Moving WAC recalculation on purchase
      const prevInventory = state.inventoryAUD;
      const newInventory  = prevInventory + aud;
      const buyRate = irt / aud;

      // If inventory was negative (from earlier over-sells), WAC resets to buy rate
      const newWAC =
        prevInventory > 0
          ? (prevInventory * state.wac + aud * buyRate) / newInventory
          : buyRate;  // reset when starting from zero or negative

      state = {
        inventoryAUD: newInventory,
        wac: newWAC,
        realizedProfit: state.realizedProfit,
      };

      wacHistory.push({ date: row.date_gregorian, wac: newWAC, inventoryAfter: newInventory });

    } else if (row.type === "sell_aud") {
      // Realized profit on sale: IRT received − cost of AUD sold at current WAC
      const costBasis  = aud * state.wac;
      const saleProfit = irt - costBasis;
      const newInventory = state.inventoryAUD - aud;

      // Negative inventory detection — do NOT clamp
      if (newInventory < 0) {
        warnings.push(
          `\u0645\u0648\u062c\u0648\u062f\u06cc \u062f\u0644\u0627\u0631 \u0628\u0639\u062f \u0627\u0632 \u0631\u062f\u06cc\u0641 ${row.id} \u0645\u0646\u0641\u06cc \u0634\u062f (${newInventory.toFixed(2)} AUD). \u0641\u0631\u0648\u0634 \u0628\u06cc\u0634\u062a\u0631 \u0627\u0632 \u0645\u0648\u062c\u0648\u062f\u06cc \u0645\u0648\u062c\u0648\u062f.`
        );
      }

      state = {
        inventoryAUD: newInventory,
        wac: state.wac,  // WAC never changes on sale
        realizedProfit: state.realizedProfit + saleProfit,
      };
    }
  }

  // Keep only the last 12 WAC update events for audit display
  return { state, wacHistory: wacHistory.slice(-12) };
}

/**
 * calcFeeIncome
 *
 * Converts fee_aud to IRT using each row's implied rate.
 * Applies to ALL trade rows (buy and sell) that carry a fee.
 * Transfer, expense, owner_loan entries have no fee.
 */
function calcFeeIncome(rows: LedgerRowInput[]): number {
  let total = 0;
  for (const row of rows) {
    if (!isTradeRow(row)) continue;
    const fee = n(row.fee_aud);
    if (fee <= 0) continue;
    const aud = n(row.amount_aud);
    const irt = n(row.amount_toman);
    const rowRate = aud > 0 ? irt / aud : 0;
    total += fee * rowRate;
  }
  return total;
}

/**
 * calcExpenses
 *
 * Aggregates expenses from the expenses table.
 *
 * AUD expenses: use stored exchange_rate (historical rate).
 *   If exchange_rate is NULL, fall back to currentBuyRate and warn.
 * IRT expenses: used directly (no conversion needed).
 *
 * Pending expenses are tracked separately and never reduce profit.
 */
function calcExpenses(
  expenses: ExpenseRowInput[],
  currentBuyRate: number,
  warnings: string[],
): {
  paidIRT: number;
  pendingIRT: number;
  byCategory: Record<string, number>;
  monthlyPaid: { month: string; amountIRT: number }[];
} {
  let paidIRT = 0;
  let pendingIRT = 0;
  const byCategory: Record<string, number> = {};
  const byMonth: Record<string, number> = {};

  for (const exp of expenses) {
    const amt = n(exp.amount);
    let irtEquiv: number;

    if (exp.currency === "AUD") {
      const historicalRate = n(exp.exchange_rate ?? null);
      if (historicalRate > 0) {
        irtEquiv = amt * historicalRate;
      } else {
        // Missing historical rate — fall back, emit warning
        irtEquiv = amt * currentBuyRate;
        warnings.push(
          `\u0647\u0632\u06cc\u0646\u0647 ${exp.id} (\u0627\u0631\u0632 AUD) \u0641\u0627\u0642\u062f \u0646\u0631\u062e \u062a\u0627\u0631\u06cc\u062e\u06cc \u0627\u0633\u062a. \u0627\u0632 \u0646\u0631\u062e \u062c\u0627\u0631\u06cc (${Math.round(currentBuyRate).toLocaleString("en-AU")}) \u0627\u0633\u062a\u0641\u0627\u062f\u0647 \u0634\u062f.`
        );
      }
    } else {
      irtEquiv = amt;
    }

    if (exp.status === "paid") {
      paidIRT += irtEquiv;
      byCategory[exp.category] = (byCategory[exp.category] ?? 0) + irtEquiv;

      // Group by YYYY-MM for monthly trend
      const month = exp.date.slice(0, 7);
      byMonth[month] = (byMonth[month] ?? 0) + irtEquiv;
    } else {
      pendingIRT += irtEquiv;
    }
  }

  // Build sorted monthly array, last 6 months
  const monthlyPaid = Object.entries(byMonth)
    .sort(([a], [b]) => b.localeCompare(a))  // DESC
    .slice(0, 6)
    .map(([month, amountIRT]) => ({ month, amountIRT }))
    .reverse();  // ASC for chart display

  return { paidIRT, pendingIRT, byCategory, monthlyPaid };
}

/**
 * calcOwnerLoanBalance
 *
 * Computes Outstanding Owner Balance in IRT.
 *
 * AUD loans: use stored exchange_rate (historical rate at time of creation).
 *   If exchange_rate is NULL, fall back to currentBuyRate and warn.
 * IRT loans: used directly.
 *
 * injection increases balance; repayment decreases it.
 *
 * CRITICAL: This figure is NEVER used in any profit calculation.
 *
 * NOTE: Balance is allowed to go negative if repayments exceed injections
 * (over-repayment scenario). This is surfaced as a warning.
 */
function calcOwnerLoanBalance(
  loans: OwnerLoanRowInput[],
  currentBuyRate: number,
  warnings: string[],
): number {
  let balance = 0;
  for (const loan of loans) {
    const amt = n(loan.amount);
    let irtEquiv: number;

    if (loan.currency === "AUD") {
      const historicalRate = n(loan.exchange_rate ?? null);
      if (historicalRate > 0) {
        irtEquiv = amt * historicalRate;
      } else {
        irtEquiv = amt * currentBuyRate;
        warnings.push(
          `\u0648\u0627\u0645 \u0645\u0627\u0644\u06a9 ${loan.id} (\u0627\u0631\u0632 AUD) \u0641\u0627\u0642\u062f \u0646\u0631\u062e \u062a\u0627\u0631\u06cc\u062e\u06cc \u0627\u0633\u062a. \u0627\u0632 \u0646\u0631\u062e \u062c\u0627\u0631\u06cc (${Math.round(currentBuyRate).toLocaleString("en-AU")}) \u0627\u0633\u062a\u0641\u0627\u062f\u0647 \u0634\u062f.`
        );
      }
    } else {
      irtEquiv = amt;
    }

    if (loan.loan_type === "injection") {
      balance += irtEquiv;
    } else {
      balance -= irtEquiv;
    }
  }

  if (balance < 0) {
    warnings.push(
      `\u0645\u0627\u0646\u062f\u0647 \u0648\u0627\u0645 \u0645\u0627\u0644\u06a9 \u0645\u0646\u0641\u06cc \u0627\u0633\u062a (${Math.round(balance).toLocaleString("en-AU")} \u062a\u0648\u0645\u0627\u0646). \u0628\u0627\u0632\u067e\u0631\u062f\u0627\u062e\u062a\u200c\u0647\u0627 \u0628\u06cc\u0634\u062a\u0631 \u0627\u0632 \u062a\u0632\u0631\u06cc\u0642\u200c\u0647\u0627\u0633\u062a.`
    );
  }

  return balance;  // not clamped — negative balance is a valid warning state
}

// ── Main exported function ─────────────────────────────────────────────────

/**
 * calcAccountingSnapshot
 *
 * The primary accounting function. Call this from server components
 * or server actions. Never call from React client components.
 *
 * @param ledgerRows  Ledger rows in ANY order — engine sorts internally
 * @param expenses    All rows from the expenses table
 * @param ownerLoans  All rows from the owner_loans table
 * @param currentBuyRate  Current buy_aud rate from rates_history
 * @param iranLiquidityIRT  Kadoos + Pezhman balances (from treasury settings)
 *
 * @returns AccountingSnapshot — fully normalized, safe for UI consumption
 */
export function calcAccountingSnapshot(
  ledgerRows: LedgerRowInput[],
  expenses: ExpenseRowInput[],
  ownerLoans: OwnerLoanRowInput[],
  currentBuyRate: number,
  iranLiquidityIRT: number = 0,
): AccountingSnapshot {
  const warnings: string[] = [];

  // ── Guard: rate must be positive ────────────────────────────────────────
  const safeRate = currentBuyRate > 0 ? currentBuyRate : 0;

  // ── Step 1: Sort rows internally (callers don't need to pre-sort) ───────
  const sortedRows = sortLedgerRows(ledgerRows);

  // ── Step 2: Moving WAC + Realized Profit ────────────────────────────────
  const { state: wacState, wacHistory } = calcMovingWAC(sortedRows, warnings);

  // ── Step 3: Fee income ──────────────────────────────────────────────────
  const feeIncomeIRT = calcFeeIncome(sortedRows);

  // ── Step 4: Expenses (historical rates) ────────────────────────────────
  const { paidIRT, pendingIRT, byCategory, monthlyPaid } = calcExpenses(expenses, safeRate, warnings);

  // ── Step 5: Owner loan balance (historical rates) ───────────────────────
  const ownerLoanBalanceIRT = calcOwnerLoanBalance(ownerLoans, safeRate, warnings);

  // ── Step 6: Inventory metrics (two valuations) ──────────────────────────
  const audInventory = wacState.inventoryAUD;  // NOT clamped — may be negative
  const wac = wacState.wac;

  // Cost value: what we paid to acquire the current inventory
  const inventoryCostValueIRT = audInventory * wac;

  // Market value: what the inventory is worth at today's rate
  const inventoryMarketValueIRT = audInventory * safeRate;

  // ── Step 7: Unrealized P/L (mark-to-market) ─────────────────────────────
  // = (currentRate − WAC) × inventory
  const unrealizedPL = safeRate > 0 ? (safeRate - wac) * audInventory : 0;

  // ── Step 8: P&L waterfall ───────────────────────────────────────────────
  const realizedTradingProfit = wacState.realizedProfit;
  const operatingProfit = realizedTradingProfit + feeIncomeIRT - paidIRT;
  const totalProfit = operatingProfit + unrealizedPL;

  // ── Step 9: Net Business Value ──────────────────────────────────────────
  // Use MARKET value for total assets (conservative, matches what assets are worth now)
  const totalAssetValueIRT = inventoryMarketValueIRT + iranLiquidityIRT;
  const netBusinessValueIRT = totalAssetValueIRT - ownerLoanBalanceIRT;

  // ── Step 10: Diagnostic counts ──────────────────────────────────────────
  const tradeRows = sortedRows.filter(isTradeRow);
  const buyRows   = tradeRows.filter(r => r.type === "buy_aud");
  const sellRows  = tradeRows.filter(r => r.type === "sell_aud");
  const totalBuyAUD  = buyRows.reduce((s, r) => s + n(r.amount_aud), 0);
  const totalSellAUD = sellRows.reduce((s, r) => s + n(r.amount_aud), 0);

  return {
    audInventory,
    wac,
    realizedTradingProfit,
    feeIncomeIRT,
    unrealizedPL,
    inventoryCostValueIRT,
    inventoryMarketValueIRT,
    inventoryValueIRT: inventoryMarketValueIRT,  // backward-compat alias
    paidExpensesIRT: paidIRT,
    pendingExpensesIRT: pendingIRT,
    operatingProfit,
    totalProfit,
    ownerLoanBalanceIRT,
    totalAssetValueIRT,
    netBusinessValueIRT,
    expensesByCategory: byCategory,
    monthlyExpenses: monthlyPaid,
    tradeRowsProcessed: tradeRows.length,
    buyRowsCount: buyRows.length,
    sellRowsCount: sellRows.length,
    totalBuyAUD,
    totalSellAUD,
    currentBuyRate: safeRate,
    wacHistory,
    accountingWarnings: warnings,
  };
}

// ── Formatting helpers (pure, no locale dependency) ───────────────────────

/** Format IRT as rounded integer with thousands separator */
export function fmtIRT(v: number): string {
  return Math.round(v).toLocaleString("en-AU");
}

/** Format AUD with 2 decimal places */
export function fmtAUD(v: number): string {
  return v.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Format exchange rate as rounded integer */
export function fmtRate(v: number): string {
  return Math.round(v).toLocaleString("en-AU");
}

/** Returns positive/negative color token */
export function valColor(v: number): "positive" | "negative" | "neutral" {
  if (v > 0) return "positive";
  if (v < 0) return "negative";
  return "neutral";
}
