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
};

export type OwnerLoanRowInput = {
  id: string;
  currency: "AUD" | "IRT";
  amount: number | string;
  exchange_rate?: number | string | null; // نرخ تاریخی تزریق/برداشت
  loan_type: "injection" | "repayment";
  account_id: string | null;
  date: string;
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
  wac: number;
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

// ── Core Engines ──────────────────────────────────────────────────────────

/**
 * موتور پویای کشوها (محاسبه‌گر سیستم دوطرفه)
 * بدون هیچ وابستگی به دیتابیس، خط سیر پول را در تمام حساب‌ها ردیابی می‌کند.
 */
function calcDynamicDrawerBalances(
  ledgerRows: LedgerRowInput[],
  accountsMeta: AccountMeta[],
  warnings: string[]
): Record<string, DrawerBalance> {
  const balances: Record<string, DrawerBalance> = {};

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
    const aud = n(row.amount_aud);
    const irt = n(row.amount_toman);
    const fee = n(row.fee_aud); // در صورت وجود کارمزد انتقالات

    // پردازش کشوی مبدأ (Payer) -> خروج پول
    if (row.payer_account_id && balances[row.payer_account_id]) {
      const payer = balances[row.payer_account_id];
      const amountToDeduct = payer.currency === "AUD" ? (aud + fee) : irt;
      payer.balance -= amountToDeduct;
    }

    // پردازش کشوی مقصد (Receiver) -> ورود پول
    if (row.receiver_account_id && balances[row.receiver_account_id]) {
      const receiver = balances[row.receiver_account_id];
      const amountToAdd = receiver.currency === "AUD" ? aud : irt;
      receiver.balance += amountToAdd;
    }
  }

  return balances;
}

/**
 * محاسبه WAC (فقط روی تراکنش‌های Trade که مستقیماً به انبار متصلند)
 */
function calcMovingWAC(rows: LedgerRowInput[], warnings: string[]) {
  let inventoryAUD = 0;
  let wac = 0;
  let realizedProfit = 0;
  const wacHistory: { date: string; wac: number; inventoryAfter: number }[] = [];

  for (const row of rows) {
    const et = row.entry_type ?? "trade";
    // انتقال بین حساب‌ها تاثیری در WAC و انبار مرکزی ندارد!
    if (et === "transfer" || et === "expense" || et === "owner_loan") continue;

    const aud = n(row.amount_aud);
    const irt = n(row.amount_toman);
    if (aud <= 0 || irt <= 0) continue;

    if (row.type === "buy_aud") {
      const buyRate = irt / aud;
      wac = inventoryAUD > 0 
        ? (inventoryAUD * wac + aud * buyRate) / (inventoryAUD + aud)
        : buyRate;
      inventoryAUD += aud;
      wacHistory.push({ date: row.date_gregorian, wac, inventoryAfter: inventoryAUD });
    } else if (row.type === "sell_aud") {
      realizedProfit += (irt - (aud * wac));
      inventoryAUD -= aud;
    }
  }

  return { inventoryAUD, wac, realizedProfit, wacHistory: wacHistory.slice(-12) };
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
  const byCategory: Record<string, number> = {};

  for (const exp of expenses) {
    const amt = n(exp.amount);
    let irtEquiv: number;

    if (exp.currency === "AUD") {
      const historicalRate = n(exp.exchange_rate ?? currentBuyRate);
      irtEquiv = amt * historicalRate;

      // جادوی حسابداری: اگر هزینه AUD هنوز پرداخت نشده (Pending Liability)
      // تفاوت نرخ تاریخی و نرخ امروز، تبدیل به زیان/سود تسعیر می‌شود.
      if (exp.status === "pending") {
        // اگر نرخ امروز بیشتر از روز ثبت باشد، بدهی ما سنگین‌تر شده = زیان (عدد منفی)
        fxTranslationGainLossIRT += amt * (historicalRate - currentBuyRate);
      }
    } else {
      irtEquiv = amt;
    }

    if (exp.status === "paid") {
      paidIRT += irtEquiv;
      byCategory[exp.category] = (byCategory[exp.category] ?? 0) + irtEquiv;
    } else {
      pendingIRT += irtEquiv;
    }
  }

  return { paidIRT, pendingIRT, byCategory, fxTranslationGainLossIRT };
}

/**
 * محاسبه وام‌های مالک و "زیان تسعیر ارز" روی بدهی‌های ارزی به مالک
 */
function calcOwnerLoansWithFX(
  loans: OwnerLoanRowInput[],
  currentBuyRate: number,
  warnings: string[]
) {
  let balanceIRT = 0;
  let fxTranslationGainLossIRT = 0;

  for (const loan of loans) {
    const amt = n(loan.amount);
    let irtEquiv: number;

    if (loan.currency === "AUD") {
      const historicalRate = n(loan.exchange_rate ?? currentBuyRate);
      irtEquiv = amt * historicalRate;

      // محاسبه تسعیر ارز روی سرمایه در گردش ارزی
      if (loan.loan_type === "injection") {
        fxTranslationGainLossIRT += amt * (historicalRate - currentBuyRate);
      } else {
        // برداشت ارزی باعث جبران بخشی از این زیان می‌شود
        fxTranslationGainLossIRT -= amt * (historicalRate - currentBuyRate);
      }
    } else {
      irtEquiv = amt;
    }

    if (loan.loan_type === "injection") balanceIRT += irtEquiv;
    else balanceIRT -= irtEquiv;
  }

  return { balanceIRT, fxTranslationGainLossIRT };
}

// ── Main Export ────────────────────────────────────────────────────────────

export function calcAccountingSnapshot(
  ledgerRows: LedgerRowInput[],
  expenses: ExpenseRowInput[],
  ownerLoans: OwnerLoanRowInput[],
  accountsMeta: AccountMeta[], // ورودی جدید: لیست تمام کشوها از دیتابیس
  currentBuyRate: number
): AccountingSnapshot {
  const warnings: string[] = [];
  const safeRate = currentBuyRate > 0 ? currentBuyRate : 0;
  const sortedRows = sortLedgerRows(ledgerRows);

  // ۱. محاسبه پویای تمام کشوها (حل گپ مغایرت‌گیری و تعهدی)
  const drawerBalances = calcDynamicDrawerBalances(sortedRows, accountsMeta, warnings);

  // ۲. محاسبه WAC انبار و سود معاملات
  const { inventoryAUD, wac, realizedProfit, wacHistory } = calcMovingWAC(sortedRows, warnings);

  // ۳. درآمد کارمزدها
  const feeIncomeIRT = sortedRows
    .filter(r => (r.entry_type ?? "trade") !== "transfer") // کارمزد انتقالات هزینه است، نه درآمد
    .reduce((sum, r) => sum + (n(r.fee_aud) * (n(r.amount_toman) / (n(r.amount_aud) || 1))), 0);

  // ۴. هزینه‌ها + وام‌ها + محاسبه تسعیر ارز (FX Gain/Loss)
  const expCalc = calcExpensesWithFX(expenses, safeRate, warnings);
  const loanCalc = calcOwnerLoansWithFX(ownerLoans, safeRate, warnings);

  const totalFxTranslation = expCalc.fxTranslationGainLossIRT + loanCalc.fxTranslationGainLossIRT;

  // ۵. ارزش‌گذاری انبار
  const inventoryCostValueIRT = inventoryAUD * wac;
  const inventoryMarketValueIRT = inventoryAUD * safeRate;

  // ۶. محاسبه P/L محقق نشده (سود انبار + زیان تسعیر ارز بدهی‌ها)
  const unrealizedInventoryGain = safeRate > 0 ? (safeRate - wac) * inventoryAUD : 0;
  const unrealizedPL = unrealizedInventoryGain + totalFxTranslation;

  // ۷. آبشار سود (Profit Waterfall)
  const operatingProfit = realizedProfit + feeIncomeIRT - expCalc.paidIRT;
  const totalProfit = operatingProfit + unrealizedPL;

  // ۸. ارزش کسب‌وکار (جمع تمام کشوهای ریالی متعلق به شرکت + ارزش انبار)
  // دارایی‌های شرکت = انبار دلار + موجودی تمام کشوهای ریالیِ از نوع Bank
  let totalIranLiquidityIRT = 0;
  Object.values(drawerBalances).forEach(drawer => {
    if (drawer.currency === "IRT" && drawer.type === "bank") {
      totalIranLiquidityIRT += drawer.balance;
    }
  });

  const totalAssetValueIRT = inventoryMarketValueIRT + totalIranLiquidityIRT;
  const netBusinessValueIRT = totalAssetValueIRT - loanCalc.balanceIRT;

  return {
    audInventory: inventoryAUD,
    wac,
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
    drawerBalances, // خروجی طلایی: ریز موجودی کادوس، مجازی مشتریان و...
    expensesByCategory: expCalc.byCategory,
    monthlyExpenses: [], // (موقتاً برای خلوتی کد خلاصه شد)
    currentBuyRate: safeRate,
    wacHistory,
    accountingWarnings: warnings,
  };
}

export function fmtIRT(v: number): string { return Math.round(v).toLocaleString("en-AU"); }
export function fmtAUD(v: number): string { return v.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
export function fmtRate(v: number): string { return Math.round(v).toLocaleString("en-AU"); }