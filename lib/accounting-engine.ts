/**
 * lib/accounting-engine.ts
 *
 * Zarman Treasury — Enterprise Accounting Engine (v3 - Multi-Pocket Sub-ledger)
 *
 * Pure functions. Zero side effects. Zero database calls.
 * * ویژگی‌های جدید این نسخه:
 * 1. Double-Entry: محاسبه پویای موجودی تمام کشوها (بانک‌ها و حساب‌های مجازی مشتریان).
 * 2. FX Translation: محاسبه دقیق سود و زیان ناشی از نوسان ارز روی بدهی‌ها.
 * 3. Transit Funds: ردیابی دقیق پول‌های در راه و کارمزدهای انتقالات بین‌حسابی.
 * 4. Accrual Basis: پشتیبانی از تعهدات ارزی مشتریان بدون کسر کاذب از انبار.
 */

import { calcFeeIncomeToman, calcPrincipalToman } from "@/lib/pricing";

// ── Input types ────────────────────────────────────────────────────────────

export type LedgerRowInput = {
  id: string;
  type: string;               
  entry_type: string | null;  // "trade" | "expense" | "owner_loan" | "adjustment" | "transfer"
  amount_aud: number | string;
  amount_toman: number | string;
  exchange_rate: number | string;
  fee_aud: number | string;   // کارمزد (از کشوی مبدأ کسر می‌شود)
  date_gregorian: string;
  // دو فیلد حیاتی برای سیستم دوطرفه:
  payer_account_id: string | null;    // کشوی مبدأ (بستانکار)
  receiver_account_id: string | null; // کشوی مقصد (بدهکار)
  created_at?: string;
  request_fee_entry_id?: string | null;
};

export type ExpenseRowInput = {
  id: string;
  currency: "AUD" | "IRT";
  amount: number | string;
  exchange_rate?: number | string | null; // نرخ تاریخی ثبت هزینه
  status: "paid" | "pending";
  date: string;
  category: string;
  payer_account_id: string | null;
  created_at?: string;
};

export type OwnerLoanRowInput = {
  id: string;
  currency: "AUD" | "IRT";
  amount: number | string;
  exchange_rate?: number | string | null; // نرخ تاریخی تزریق/برداشت
  loan_type: "injection" | "repayment";
  account_id: string | null;
  date: string;
  created_at?: string;
  /** Existing rows remain repayable loans until explicitly classified. */
  funding_type?: "loan" | "equity" | null;
  /** False when the cash movement is already recorded elsewhere. */
  cash_effect?: boolean | null;
  /** Cash settlement can differ from the funding's denomination. */
  settlement_currency?: "AUD" | "IRT" | null;
  settlement_amount?: number | string | null;
};

// اطلاعات متا برای کشوها تا موتور بداند هر کشو با چه ارزی کار می‌کند
export type AccountMeta = {
  id: string;
  name: string;
  currency: "AUD" | "IRT";
  type: "bank" | "virtual" | "transit";
};

// ── Output types ───────────────────────────────────────────────────────────

export type DrawerBalance = {
  accountId: string;
  accountName: string;
  currency: "AUD" | "IRT";
  type: "bank" | "virtual" | "transit";
  balance: number;
};

export type AccountingSnapshot = {
  // ... (مفاهیم قبلی حفظ شده‌اند)
  audInventory: number;
  /** Current purchase cost, or the last purchase cost when stock is depleted. */
  wac: number;
  /** Short positions use their sale proceeds for valuation, not purchase WAC. */
  inventoryValuationRate?: number;
  realizedTradingProfit: number;
  feeIncomeIRT: number;
  
  /**
   * سود و زیان محقق‌نشده (Unrealized P/L)
   * اکنون شامل دو بخش است: 
   * ۱. ارزش‌افزوده انبار دلار 
   * ۲. زیان/سود تسعیر ارز (FX Gain/Loss) روی بدهی‌های پرداخت‌نشده
   */
  unrealizedPL: number;
  fxTranslationGainLossIRT: number; // تفکیک تسعیر ارز برای شفافیت در داشبورد

  inventoryCostValueIRT: number;
  inventoryMarketValueIRT: number;
  paidExpensesIRT: number;
  pendingExpensesIRT: number;
  operatingProfit: number;
  totalProfit: number;
  ownerLoanBalanceIRT: number;
  totalAssetValueIRT: number;
  netBusinessValueIRT: number;
  /** Monetary assets in bank/transit drawers, before customer/funding liabilities. */
  totalAssetsAUD: number | null;
  customerAccountPositionAUD: number | null;
  ownerLoanBalanceAUD: number | null;
  ownerCapitalContributedAUD: number | null;
  ownerCapitalWithdrawnAUD: number | null;
  ownerCapitalNetAUD: number | null;
  ownerCapitalHistoricalIRT: number;
  netAssetsAUD: number | null;
  /** Cumulative earnings: withdrawals are added back through net contributions. */
  netProfitAUD: number | null;
  /** Expenses already deducted by the net-asset calculation, at current AUD value. */
  totalExpensesAUD: number | null;
  /** Period earnings before expenses on the same current-valuation basis as net profit. */
  incomeBeforeExpensesAUD: number | null;
  /** Surplus still held above gross contributions; withdrawals are not expenses. */
  retainedProfitAUD: number | null;
  unrealizedInventoryGainIRT: number;
  realizedFXGainLossIRT: number;
  transferFeesIRT: number;

  // موجودی دقیق و لحظه‌ای تمام کشوهای صرافی (بانک‌ها، مجازی‌ها، در راه)
  drawerBalances: Record<string, DrawerBalance>;

  expensesByCategory: Record<string, number>;
  monthlyExpenses: { month: string; amountIRT: number }[];
  currentBuyRate: number;
  wacHistory: { date: string; wac: number; inventoryAfter: number }[];
  accountingWarnings: string[];
};

// ── Helpers ───────────────────────────────────────────────────────────────

function n(v: number | string | null | undefined): number {
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortLedgerRows(rows: LedgerRowInput[]): LedgerRowInput[] {
  return [...rows].sort((a, b) => {
    const dateCmp = a.date_gregorian.localeCompare(b.date_gregorian);
    if (dateCmp !== 0) return dateCmp;
    const aTs = a.created_at ?? "";
    const bTs = b.created_at ?? "";
    return aTs.localeCompare(bTs);
  });
}

function executionRate(row: LedgerRowInput): number {
  const explicitRate = n(row.exchange_rate);
  if (explicitRate > 0) return explicitRate;
  const aud = n(row.amount_aud);
  return aud > 0 ? n(row.amount_toman) / aud : 0;
}

function fundingSettlement(loan: OwnerLoanRowInput) {
  const currency = loan.settlement_currency ?? loan.currency;
  return {
    currency,
    amount: n(loan.settlement_amount ?? (currency === loan.currency ? loan.amount : 0)),
  };
}

function historicalRate(
  value: number | string | null | undefined,
  currentRate: number,
  context: string,
  warnings: string[]
) {
  const rate = n(value);
  if (rate > 0) return rate;
  warnings.push(`${context} has no valid historical exchange rate; current rate used for IRT valuation.`);
  return currentRate;
}

// ── Core Engines ──────────────────────────────────────────────────────────

/**
 * موتور پویای کشوها (محاسبه‌گر سیستم دوطرفه)
 * بدون هیچ وابستگی به دیتابیس، خط سیر پول را در تمام حساب‌ها ردیابی می‌کند.
 */
function calcDynamicDrawerBalances(
  ledgerRows: LedgerRowInput[],
  expenses: ExpenseRowInput[],
  ownerLoans: OwnerLoanRowInput[],
  accountsMeta: AccountMeta[],
  warnings: string[]
): Record<string, DrawerBalance> {
  const balances: Record<string, DrawerBalance> = {};
  const unknownAccountWarnings = new Set<string>();

  function warnOnce(message: string) {
    if (unknownAccountWarnings.has(message)) return;
    unknownAccountWarnings.add(message);
    warnings.push(message);
  }

  // مقداردهی اولیه کشوها
  for (const acc of accountsMeta) {
    balances[acc.id] = {
      accountId: acc.id,
      accountName: acc.name,
      currency: acc.currency,
      type: acc.type,
      balance: 0,
    };
  }

  for (const row of ledgerRows) {
    const entryType = row.entry_type ?? "trade";
    if (entryType === "expense" || entryType === "owner_loan") continue;
    if (!['trade', 'transfer', 'adjustment'].includes(entryType)) {
      warnings.push(`Ledger row ${row.id} has unsupported entry type: ${entryType}`);
      continue;
    }

    const aud = n(row.amount_aud);
    const irt = n(row.amount_toman);
    const fee = n(row.fee_aud);

    if (entryType === "trade" && !row.payer_account_id && !row.receiver_account_id) {
      warnOnce(`Trade row ${row.id} has no payer/receiver account mapping.`);
    }

    if (row.payer_account_id && !balances[row.payer_account_id]) {
      warnOnce(`Ledger row ${row.id} references unknown payer account ${row.payer_account_id}.`);
    }

    if (row.receiver_account_id && !balances[row.receiver_account_id]) {
      warnOnce(`Ledger row ${row.id} references unknown receiver account ${row.receiver_account_id}.`);
    }

    // پردازش کشوی مبدأ (Payer) -> خروج پول
    if (row.payer_account_id && balances[row.payer_account_id]) {
      const payer = balances[row.payer_account_id];
      const amountToDeduct = payer.currency === "AUD"
        ? (entryType === "transfer" ? aud + fee : aud)
        : irt;
      payer.balance -= amountToDeduct;
    }

    // پردازش کشوی مقصد (Receiver) -> ورود پول
    if (row.receiver_account_id && balances[row.receiver_account_id]) {
      const receiver = balances[row.receiver_account_id];
      const amountToAdd = receiver.currency === "AUD" ? aud : irt;
      receiver.balance += amountToAdd;
    }
  }

  for (const expense of expenses) {
    if (expense.status !== "paid" || !expense.payer_account_id) continue;
    const account = balances[expense.payer_account_id];
    if (!account) {
      warnings.push(`Paid expense ${expense.id} references an unknown account.`);
      continue;
    }
    if (account.currency !== expense.currency) {
      warnings.push(`Paid expense ${expense.id} currency does not match its account.`);
      continue;
    }
    account.balance -= n(expense.amount);
  }

  for (const loan of ownerLoans) {
    if (loan.cash_effect === false) continue;
    if (!loan.account_id) {
      warnings.push(`Owner funding ${loan.id} has no cash settlement account.`);
      continue;
    }
    const account = balances[loan.account_id];
    if (!account) {
      warnings.push(`Owner loan ${loan.id} references an unknown account.`);
      continue;
    }
    const settlement = fundingSettlement(loan);
    if (settlement.amount <= 0) {
      warnings.push(`Owner funding ${loan.id} has no valid cash settlement amount; cash movement excluded.`);
      continue;
    }
    if (account.currency !== settlement.currency) {
      warnings.push(`Owner funding ${loan.id} settlement currency does not match its account; cash movement excluded.`);
      continue;
    }
    const movement = loan.loan_type === "injection" ? settlement.amount : -settlement.amount;
    account.balance += movement;
  }

  return balances;
}

/**
 * Value funded AUD and cash disposals chronologically, including covered shorts.
 */
function calcMovingWAC(
  rows: LedgerRowInput[],
  expenses: ExpenseRowInput[],
  funding: OwnerLoanRowInput[],
  accounts: AccountMeta[],
  currentRate: number,
  warnings: string[]
) {
  type Movement = {
    id: string; date: string; created: string; priority: number;
    aud: number; rate: number; trading: boolean;
  };
  const events: Movement[] = [];
  const accountById = new Map(accounts.map(account => [account.id, account]));
  let transferFeesIRT = 0;
  const push = (event: Movement) => {
    if (Math.abs(event.aud) > 0.00000001) events.push(event);
  };

  for (const row of rows) {
    const et = row.entry_type ?? "trade";
    const aud = n(row.amount_aud);
    const fee = n(row.fee_aud);
    const base = { id: row.id, date: row.date_gregorian, created: row.created_at ?? "", priority: 1 };
    if (et === "trade") {
      if (aud <= 0 || !["buy_aud", "sell_aud"].includes(row.type)) continue;
      const declaredMovement = row.type === "buy_aud" ? aud : -aud;
      const payer = accountById.get(row.payer_account_id ?? "");
      const receiver = accountById.get(row.receiver_account_id ?? "");
      const mappedMovement = (receiver?.currency === "AUD" ? aud : 0) - (payer?.currency === "AUD" ? aud : 0);
      if (payer || receiver) {
        if (Math.abs(mappedMovement - declaredMovement) >= 0.01) {
          warnings.push(`Trade ${row.id} on ${row.date_gregorian} moves ${mappedMovement.toFixed(2)} AUD through cash/customer accounts but its recorded type implies ${declaredMovement.toFixed(2)} AUD; review trade versus settlement classification.`);
        }
      }
      // A settlement between two known AUD drawers (including customer credit)
      // moves existing currency, not new trading stock. Known cash direction
      // also takes precedence over a contradictory legacy buy/sell label.
      const tradeMovement = payer && receiver ? mappedMovement : declaredMovement;
      if (Math.abs(tradeMovement) < 0.00000001) continue;
      const valuedDirection = tradeMovement > 0 ? "buy_aud" : "sell_aud";
      const principal = calcPrincipalToman(n(row.amount_toman), executionRate(row), fee, valuedDirection);
      if (principal <= 0) continue;
      push({ ...base, aud: tradeMovement, rate: principal / aud, trading: true });
    } else if (et === "transfer" || (et === "adjustment" && !row.request_fee_entry_id && row.type !== "transfer")) {
      const payerAUD = accountById.get(row.payer_account_id ?? "")?.currency === "AUD";
      const receiverAUD = accountById.get(row.receiver_account_id ?? "")?.currency === "AUD";
      const delta = (receiverAUD ? aud : 0) - (payerAUD ? aud : 0);
      const feeAUD = et === "transfer" && payerAUD ? fee : 0;
      if (delta === 0 && feeAUD === 0) continue;
      const rate = historicalRate(executionRate(row), currentRate, `Ledger movement ${row.id}`, warnings);
      push({ ...base, aud: delta, rate, trading: false });
      if (feeAUD > 0) {
        push({ ...base, id: `${row.id}:fee`, priority: 2, aud: -feeAUD, rate, trading: false });
        transferFeesIRT += feeAUD * rate;
      }
    }
    // Expense/funding ledger mirrors are supplied by their canonical tables.
    // Request fees remain outside trading stock, including pre-settlement deposits.
  }

  for (const loan of funding) {
    if (loan.cash_effect === false) continue;
    const cash = fundingSettlement(loan);
    if (cash.currency !== "AUD" || cash.amount <= 0 || accountById.get(loan.account_id ?? "")?.currency !== "AUD") continue;
    const rate = loan.currency === "IRT"
      ? n(loan.amount) / cash.amount
      : historicalRate(loan.exchange_rate, currentRate, `Owner funding ${loan.id}`, warnings);
    push({ id: loan.id, date: loan.date, created: loan.created_at ?? "", priority: loan.loan_type === "injection" ? 0 : 3,
      aud: loan.loan_type === "injection" ? cash.amount : -cash.amount, rate, trading: false });
  }
  for (const expense of expenses) {
    if (expense.status !== "paid" || expense.currency !== "AUD" || accountById.get(expense.payer_account_id ?? "")?.currency !== "AUD") continue;
    push({ id: expense.id, date: expense.date, created: expense.created_at ?? "", priority: 2,
      aud: -n(expense.amount), rate: historicalRate(expense.exchange_rate, currentRate, `Expense ${expense.id}`, warnings), trading: false });
  }
  // Funding precedes same-day payments; withdrawals follow settlements. created_at
  // is entry time, not bank execution time, so it only breaks ties within a class.
  events.sort((a, b) => a.date.localeCompare(b.date) || a.priority - b.priority || a.created.localeCompare(b.created) || a.id.localeCompare(b.id));

  let inventoryAUD = 0;
  let wac = 0;
  let purchaseWAC = 0;
  let realizedProfit = 0;
  let realizedAssetFX = 0;
  // Keep separate short proceeds pools so covers recognise the original activity.
  let shortTradingAUD = 0;
  let shortTradingProceeds = 0;
  let shortOtherAUD = 0;
  let shortOtherProceeds = 0;
  const wacHistory: { date: string; wac: number; inventoryAfter: number }[] = [];
  const eps = 0.00000001;

  for (const event of events) {
    if (event.aud > 0) {
      let incoming = event.aud;
      if (inventoryAUD < -eps) {
        const shortAUD = -inventoryAUD;
        const covered = Math.min(incoming, shortAUD);
        const fraction = covered / shortAUD;
        realizedProfit += fraction * (shortTradingProceeds - shortTradingAUD * event.rate);
        realizedAssetFX += fraction * (shortOtherProceeds - shortOtherAUD * event.rate);
        shortTradingAUD *= 1 - fraction;
        shortTradingProceeds *= 1 - fraction;
        shortOtherAUD *= 1 - fraction;
        shortOtherProceeds *= 1 - fraction;
        inventoryAUD += covered;
        incoming -= covered;
      }
      if (incoming > eps) {
        const existingCost = Math.max(inventoryAUD, 0) * wac;
        inventoryAUD += incoming;
        wac = (existingCost + incoming * event.rate) / inventoryAUD;
        purchaseWAC = wac;
      } else if (inventoryAUD < -eps) {
        wac = (shortTradingProceeds + shortOtherProceeds) / -inventoryAUD;
      }
    } else {
      let outgoing = -event.aud;
      const covered = Math.min(outgoing, Math.max(inventoryAUD, 0));
      const gain = covered * (event.rate - wac);
      if (event.trading) realizedProfit += gain;
      else realizedAssetFX += gain;
      inventoryAUD -= covered;
      outgoing -= covered;
      if (outgoing > eps) {
        if (event.trading) {
          shortTradingAUD += outgoing;
          shortTradingProceeds += outgoing * event.rate;
        } else {
          shortOtherAUD += outgoing;
          shortOtherProceeds += outgoing * event.rate;
        }
        inventoryAUD -= outgoing;
        wac = (shortTradingProceeds + shortOtherProceeds) / -inventoryAUD;
      }
    }
    if (Math.abs(inventoryAUD) < eps) { inventoryAUD = 0; wac = 0; }
    wacHistory.push({ date: event.date, wac: purchaseWAC, inventoryAfter: inventoryAUD });
  }
  if (inventoryAUD < -eps) {
    warnings.push(`موجودی خالص دلار ${fmtAUD(-inventoryAUD)} دلار منفی است؛ مانده حساب‌های دلاری و تعهدات مشتریان را تطبیق دهید.`);
  }
  return { inventoryAUD, wac: purchaseWAC, inventoryValuationRate: wac, realizedProfit, realizedAssetFX, transferFeesIRT, wacHistory: wacHistory.slice(-12) };
}

/**
 * محاسبه هزینه‌ها و "زیان تسعیر ارز" (FX Translation Gain/Loss)
 */
function calcExpensesWithFX(
  expenses: ExpenseRowInput[],
  currentBuyRate: number,
  warnings: string[]
) {
  let paidIRT = 0;
  let pendingIRT = 0;
  let fxTranslationGainLossIRT = 0; 
  let pendingCurrentIRT = 0;
  const byCategory: Record<string, number> = {};

  for (const exp of expenses) {
    const amt = n(exp.amount);
    let irtEquiv: number;

    if (exp.currency === "AUD") {
      const rate = historicalRate(exp.exchange_rate, currentBuyRate, `Expense ${exp.id}`, warnings);
      irtEquiv = amt * rate;

      // جادوی حسابداری: اگر هزینه AUD هنوز پرداخت نشده (Pending Liability)
      // تفاوت نرخ تاریخی و نرخ امروز، تبدیل به زیان/سود تسعیر می‌شود.
      if (exp.status === "pending" && currentBuyRate > 0) {
        // اگر نرخ امروز بیشتر از روز ثبت باشد، بدهی ما سنگین‌تر شده = زیان (عدد منفی)
        fxTranslationGainLossIRT += amt * (rate - currentBuyRate);
      }
    } else {
      irtEquiv = amt;
    }

    if (exp.status === "paid") {
      paidIRT += irtEquiv;
      byCategory[exp.category] = (byCategory[exp.category] ?? 0) + irtEquiv;
    } else {
      pendingIRT += irtEquiv;
      pendingCurrentIRT += exp.currency === "AUD" && currentBuyRate > 0 ? amt * currentBuyRate : irtEquiv;
    }
  }

  return { paidIRT, pendingIRT, pendingCurrentIRT, byCategory, fxTranslationGainLossIRT };
}

/**
 * محاسبه وام‌های مالک و "زیان تسعیر ارز" روی بدهی‌های ارزی به مالک
 */
function calcOwnerLoansWithFX(
  loans: OwnerLoanRowInput[],
  currentBuyRate: number,
  warnings: string[]
) {
  let audPrincipal = 0;
  let audHistoricalBasis = 0;
  let irtPrincipal = 0;
  let realizedFX = 0;
  let capitalHistoricalIRT = 0;
  let capitalContributedAUD = 0;
  let capitalWithdrawnAUD = 0;
  let capitalRateMissing = false;
  const ordered = [...loans].sort((a, b) => a.date.localeCompare(b.date)
    || (a.loan_type === b.loan_type ? 0 : a.loan_type === "injection" ? -1 : 1)
    || (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.id.localeCompare(b.id));

  for (const loan of ordered) {
    const amt = n(loan.amount);
    const sign = loan.loan_type === "injection" ? 1 : -1;
    if (loan.funding_type === "equity") {
      const recordedRate = n(loan.exchange_rate);
      const rate = loan.currency === "AUD"
        ? historicalRate(recordedRate, currentBuyRate, `Owner capital ${loan.id}`, warnings)
        : recordedRate;
      capitalHistoricalIRT += sign * (loan.currency === "IRT" ? amt : amt * rate);
      if (loan.currency === "IRT" && rate <= 0) {
        capitalRateMissing = true;
        warnings.push(`IRT owner capital ${loan.id} requires a transaction exchange rate to calculate AUD profit.`);
      } else {
        const aud = loan.currency === "AUD" ? amt : amt / rate;
        if (sign > 0) capitalContributedAUD += aud;
        else capitalWithdrawnAUD += aud;
      }
      continue;
    }
    if (loan.currency === "IRT") { irtPrincipal += sign * amt; continue; }
    const rate = historicalRate(loan.exchange_rate, currentBuyRate, `Owner loan ${loan.id}`, warnings);
    if (sign > 0) {
      audPrincipal += amt;
      audHistoricalBasis += amt * rate;
    } else {
      const matched = Math.min(amt, Math.max(audPrincipal, 0));
      const basisRate = audPrincipal > 0 ? audHistoricalBasis / audPrincipal : rate;
      realizedFX += matched * (basisRate - rate);
      audHistoricalBasis -= matched * basisRate + (amt - matched) * rate;
      audPrincipal -= amt;
    }
  }
  if (audPrincipal < -0.00000001 || irtPrincipal < -0.01) warnings.push("Owner loan repayments exceed recorded principal; reconcile the funding register.");
  return {
    balanceIRT: (currentBuyRate > 0 ? audPrincipal * currentBuyRate : audHistoricalBasis) + irtPrincipal,
    fxTranslationGainLossIRT: currentBuyRate > 0 ? audHistoricalBasis - audPrincipal * currentBuyRate : 0,
    realizedFX,
    capitalHistoricalIRT,
    capitalContributedAUD: capitalRateMissing ? null : capitalContributedAUD,
    capitalWithdrawnAUD: capitalRateMissing ? null : capitalWithdrawnAUD,
  };
}

// ── Main Export ────────────────────────────────────────────────────────────

export function calcAccountingSnapshot(
  ledgerRows: LedgerRowInput[],
  expenses: ExpenseRowInput[],
  ownerLoans: OwnerLoanRowInput[],
  accountsMeta: AccountMeta[], // ورودی جدید: لیست تمام کشوها از دیتابیس
  currentBuyRate: number,
  additionalServiceFeeIncomeIRT = 0,
  pendingServiceFeeLiabilityIRT = 0
): AccountingSnapshot {
  const warnings: string[] = [];
  const safeRate = Number.isFinite(currentBuyRate) && currentBuyRate > 0 ? currentBuyRate : 0;
  if (safeRate === 0) warnings.push("A valid current AUD/IRT buy rate is required; AUD asset and profit totals are unavailable.");
  const sortedRows = sortLedgerRows(ledgerRows);

  // ۱. محاسبه پویای تمام کشوها (حل گپ مغایرت‌گیری و تعهدی)
  const drawerBalances = calcDynamicDrawerBalances(sortedRows, expenses, ownerLoans, accountsMeta, warnings);

  // ۲. محاسبه WAC انبار و سود معاملات
  const { inventoryAUD, wac, inventoryValuationRate, realizedProfit, realizedAssetFX, transferFeesIRT, wacHistory } = calcMovingWAC(
    sortedRows, expenses, ownerLoans, accountsMeta, safeRate, warnings
  );

  // ۳. درآمد کارمزدها
  const feeIncomeIRT = sortedRows
    .filter(r => (r.entry_type ?? "trade") === "trade")
    .reduce((sum, r) => sum + calcFeeIncomeToman(n(r.fee_aud), executionRate(r)), n(additionalServiceFeeIncomeIRT));

  // ۴. هزینه‌ها + وام‌ها + محاسبه تسعیر ارز (FX Gain/Loss)
  const expCalc = calcExpensesWithFX(expenses, safeRate, warnings);
  const loanCalc = calcOwnerLoansWithFX(ownerLoans, safeRate, warnings);

  const totalFxTranslation = expCalc.fxTranslationGainLossIRT + loanCalc.fxTranslationGainLossIRT;

  // ۵. ارزش‌گذاری انبار
  const inventoryCostValueIRT = inventoryAUD * inventoryValuationRate;
  const inventoryMarketValueIRT = inventoryAUD * safeRate;

  // ۶. محاسبه P/L محقق نشده (سود انبار + زیان تسعیر ارز بدهی‌ها)
  const unrealizedInventoryGain = safeRate > 0 ? (safeRate - inventoryValuationRate) * inventoryAUD : 0;
  const unrealizedPL = unrealizedInventoryGain + totalFxTranslation;

  // ۷. آبشار سود (Profit Waterfall)
  const operatingProfit = realizedProfit + feeIncomeIRT - expCalc.paidIRT - transferFeesIRT;
  const realizedFXGainLossIRT = realizedAssetFX + loanCalc.realizedFX;
  const totalProfit = operatingProfit + unrealizedPL + realizedFXGainLossIRT;

  // AUD asset/profit cards reconcile actual account positions, independently of
  // trading-stock quantities. Virtual balances retain their signed receivable/
  // payable position; permanent capital is never deducted as a loan liability.
  let actualAssetValueIRT = 0;
  let customerAccountPositionIRT = 0;
  Object.values(drawerBalances).forEach(drawer => {
    const value = drawer.balance * (drawer.currency === "AUD" ? safeRate : 1);
    if (drawer.type === "virtual") customerAccountPositionIRT += value;
    else actualAssetValueIRT += value;
  });
  const totalAssetValueIRT = actualAssetValueIRT;
  const netBusinessValueIRT = totalAssetValueIRT + customerAccountPositionIRT
    - loanCalc.balanceIRT - expCalc.pendingCurrentIRT - n(pendingServiceFeeLiabilityIRT);
  const totalAssetsAUD = safeRate > 0 ? totalAssetValueIRT / safeRate : null;
  const netAssetsAUD = safeRate > 0 ? netBusinessValueIRT / safeRate : null;
  const ownerCapitalContributedAUD = safeRate > 0 ? loanCalc.capitalContributedAUD : null;
  const ownerCapitalWithdrawnAUD = safeRate > 0 ? loanCalc.capitalWithdrawnAUD : null;
  const ownerCapitalNetAUD = ownerCapitalContributedAUD !== null && ownerCapitalWithdrawnAUD !== null
    ? ownerCapitalContributedAUD - ownerCapitalWithdrawnAUD : null;
  const netProfitAUD = netAssetsAUD !== null && ownerCapitalNetAUD !== null ? netAssetsAUD - ownerCapitalNetAUD : null;
  const retainedProfitAUD = netAssetsAUD !== null && ownerCapitalContributedAUD !== null ? netAssetsAUD - ownerCapitalContributedAUD : null;

  // Reverse only costs already reflected in net assets. Canonical expenses
  // include posted bank fees; their ledger mirrors and accruals are not added
  // again. Owner withdrawals and unearned service fees are not expenses.
  const accountCurrencies = new Map(accountsMeta.map(account => [account.id, account.currency]));
  const totalExpensesAUD = safeRate > 0
    ? expenses.reduce((sum, expense) => {
      const recognized = expense.status === "pending" || (expense.status === "paid" &&
        accountCurrencies.get(expense.payer_account_id ?? "") === expense.currency);
      if (!recognized) return sum;
      return sum + n(expense.amount) / (expense.currency === "AUD" ? 1 : safeRate);
    }, 0) + sortedRows.reduce((sum, row) => sum + (
      row.entry_type === "transfer" && accountCurrencies.get(row.payer_account_id ?? "") === "AUD"
        ? n(row.fee_aud) : 0
    ), 0)
    : null;
  const incomeBeforeExpensesAUD = netProfitAUD !== null && totalExpensesAUD !== null
    ? netProfitAUD + totalExpensesAUD : null;

  return {
    audInventory: inventoryAUD,
    wac,
    inventoryValuationRate,
    realizedTradingProfit: realizedProfit,
    feeIncomeIRT,
    unrealizedPL,
    fxTranslationGainLossIRT: totalFxTranslation, // تفکیک شده برای نمایش در داشبورد
    inventoryCostValueIRT,
    inventoryMarketValueIRT,
    paidExpensesIRT: expCalc.paidIRT,
    pendingExpensesIRT: expCalc.pendingIRT,
    operatingProfit,
    totalProfit,
    ownerLoanBalanceIRT: loanCalc.balanceIRT,
    totalAssetValueIRT,
    netBusinessValueIRT,
    totalAssetsAUD,
    customerAccountPositionAUD: safeRate > 0 ? customerAccountPositionIRT / safeRate : null,
    ownerLoanBalanceAUD: safeRate > 0 ? loanCalc.balanceIRT / safeRate : null,
    ownerCapitalContributedAUD,
    ownerCapitalWithdrawnAUD,
    ownerCapitalNetAUD,
    ownerCapitalHistoricalIRT: loanCalc.capitalHistoricalIRT,
    netAssetsAUD,
    netProfitAUD,
    totalExpensesAUD,
    incomeBeforeExpensesAUD,
    retainedProfitAUD,
    unrealizedInventoryGainIRT: unrealizedInventoryGain,
    realizedFXGainLossIRT,
    transferFeesIRT,
    drawerBalances, // خروجی طلایی: ریز موجودی کادوس، مجازی مشتریان و...
    expensesByCategory: expCalc.byCategory,
    monthlyExpenses: [], // (موقتاً برای خلوتی کد خلاصه شد)
    currentBuyRate: safeRate,
    wacHistory,
    accountingWarnings: [...new Set(warnings)],
  };
}

function isolateNumber(text: string): string {
  // Keep minus sign and digits visually ordered in RTL containers.
  return `\u2066${text}\u2069`;
}

export function fmtIRT(v: number): string { return isolateNumber(Math.round(v).toLocaleString("en-AU")); }
export function fmtAUD(v: number): string { return isolateNumber(v.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })); }
export function fmtRate(v: number): string { return isolateNumber(Math.round(v).toLocaleString("en-AU")); }
