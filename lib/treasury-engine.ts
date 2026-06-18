/**
 * lib/treasury-engine.ts
 *
 * Zarman Treasury — Treasury Engine (v2)
 *
 * Pure functions. Zero side effects. Zero database calls.
 * Consumes AccountingSnapshot from accounting-engine.
 * Produces TreasurySnapshot consumed by the Strategy Engine and UI.
 *
 * ─────────────────────────────────────────────────────────
 * RESPONSIBILITIES
 * ─────────────────────────────────────────────────────────
 * - Per-account IRT balance (Kadoos, Pezhman)
 * - Total Iran Liquidity
 * - AUD inventory ratios vs. configured thresholds
 * - Liquidity ratio vs. minimum threshold
 * - Dual exposure ratios (cost basis and market basis)
 * - Inventory Coverage Days (using net velocity)
 * - Dual Cash Runway (liquid + total)
 * - Forecast: net inventory velocity (buys − sells)
 * ─────────────────────────────────────────────────────────
 *
 * VELOCITY FORMULA (NET):
 *   Net velocity = avg daily buys − avg daily sells
 *   V_sell_7  = sum(sell_aud last 7 days) / 7
 *   V_sell_30 = sum(sell_aud last 30 days) / 30
 *   V_buy_30  = sum(buy_aud last 30 days) / 30
 *   V_sell = 0.40 × V_sell_7 + 0.60 × V_sell_30
 *   Net velocity = V_buy_30 − V_sell  (positive = accumulating)
 *   Forecast uses abs(V_sell) for depletion timing when net < 0
 *
 * EXPOSURE:
 *   Two ratios:
 *     exposureCostBasis   = inventoryCostValueIRT / (costValue + iranLiquidity)
 *     exposureMarketBasis = inventoryMarketValueIRT / (marketValue + iranLiquidity)
 */

import type { AccountingSnapshot, LedgerRowInput } from "./accounting-engine";

// ── Input types ────────────────────────────────────────────────────────────

export type TreasurySettingsInput = {
  min_aud_inventory: number;
  target_aud_inventory: number;
  max_aud_inventory: number;
  min_irt_liquidity: number;
  max_aud_exposure: number;
  /** Ideal fraction of total assets held in AUD. Exposure score peaks here. Default 0.5. */
  target_exposure_ratio: number;
  inventory_coverage_target_days: number;
  cash_runway_target_months: number;
  recommendation_sensitivity: "low" | "medium" | "high";
};

export type AccountBalancesInput = {
  kadoosBalanceIRT: number;
  pezhmanBalanceIRT: number;
};

// ── Output types ───────────────────────────────────────────────────────────

export type ForecastResult =
  | {
      available: true;
      /** Weighted sell velocity: 40% × 7-day + 60% × 30-day (AUD/day outflow) */
      dailyVelocityAUD: number;
      /** 7-day average AUD sold per day */
      velocity7d: number;
      /** 30-day average AUD sold per day */
      velocity30d: number;
      /** 30-day average AUD bought per day */
      buyVelocity30d: number;
      /**
       * NET VELOCITY (AUD/day)
       * = buyVelocity30d − dailyVelocityAUD
       * Positive: accumulating AUD. Negative: depleting inventory.
       */
      netVelocity: number;
      /** Inventory / sell velocity — days until depletion at current sell rate */
      coverageDays: number;
      forecastDaysMin: number;
      forecastDaysMax: number;
      depletionDate: string | null;
      forecastLabel: string;
    }
  | {
      available: false;
      reason: "insufficient_data" | "no_sales_history" | "zero_velocity";
    };

export type TreasuryAlert = {
  id: string;
  severity: "critical" | "warning" | "info";
  category: "inventory" | "liquidity" | "exposure" | "forecast" | "cash_runway";
  titleFA: string;
  messageFA: string;
  metric: string;        // machine-readable metric name
  value: number;
  threshold: number;
};

export type TreasurySnapshot = {
  // ── Account balances ────────────────────────────────────────────────
  kadoosBalanceIRT: number;
  pezhmanBalanceIRT: number;
  totalIranLiquidityIRT: number;

  // ── Inventory ───────────────────────────────────────────────────────
  audInventory: number;
  inventoryValueIRT: number;       // = inventoryMarketValueIRT (backward compat)
  inventoryCostValueIRT: number;   // audInventory × WAC
  inventoryMarketValueIRT: number; // audInventory × currentBuyRate
  wac: number;
  currentBuyRate: number;

  /** audInventory / target_aud_inventory */
  inventoryRatio: number;

  /** audInventory − target_aud_inventory (positive = surplus, negative = shortage) */
  inventoryDistanceFromTarget: number;

  /** audInventory (explicit) */
  currentInventory: number;
  /** settings.target_aud_inventory (explicit) */
  targetInventory: number;
  /** audInventory − target_aud_inventory (same as inventoryDistanceFromTarget) */
  inventoryGap: number;
  /** inventoryGap / target_aud_inventory × 100 (signed %) */
  inventoryGapPercent: number;

  // ── Liquidity ───────────────────────────────────────────────────────
  liquidityRatio: number;       // totalIranLiquidity / min_irt_liquidity

  // ── Exposure ────────────────────────────────────────────────────────
  /**
   * COST BASIS EXPOSURE
   * = inventoryCostValueIRT / (inventoryCostValueIRT + totalIranLiquidityIRT)
   * Uses WAC as cost. Reflects accounting book value.
   */
  exposureCostBasis: number;

  /**
   * MARKET BASIS EXPOSURE
   * = inventoryMarketValueIRT / (inventoryMarketValueIRT + totalIranLiquidityIRT)
   * Uses current rate. Reflects real-time portfolio composition.
   * This is the primary exposure metric used for risk management.
   */
  exposureMarketBasis: number;

  /**
   * @deprecated Use exposureMarketBasis instead.
   * Kept for backward compatibility with existing UI code.
   */
  exposureRatio: number;

  // ── Forecast ────────────────────────────────────────────────────────
  forecast: ForecastResult;

  // ── Coverage ────────────────────────────────────────────────────────
  coverageDays: number | null;

  // ── Cash Runway (two metrics) ────────────────────────────────────────
  /**
   * LIQUID RUNWAY
   * = totalIranLiquidityIRT / avgMonthlyExpensesIRT
   * Months covered by IRT cash only. Conservative metric.
   */
  liquidRunwayMonths: number | null;

  /**
   * TOTAL RUNWAY
   * = (totalIranLiquidityIRT + inventoryMarketValueIRT) / avgMonthlyExpensesIRT
   * Months covered if all assets (including AUD inventory) were liquidated.
   */
  totalRunwayMonths: number | null;

  /**
   * @deprecated Use liquidRunwayMonths instead.
   * Kept for backward compatibility.
   */
  cashRunwayMonths: number | null;

  avgMonthlyExpensesIRT: number;

  // ── Composite assets ────────────────────────────────────────────────
  totalAssetValueIRT: number;
  netBusinessValueIRT: number;
  ownerLoanBalanceIRT: number;

  // ── Accounting warnings forwarded from accounting engine ─────────────
  accountingWarnings: string[];

  // ── Alerts (priority-sorted, critical first) ────────────────────────
  alerts: TreasuryAlert[];

  // ── Settings echo (for UI display) ──────────────────────────────────
  settings: TreasurySettingsInput;
};

// ── Helper: safe number ────────────────────────────────────────────────────

function n(v: number | null | undefined): number {
  return Number.isFinite(v as number) ? (v as number) : 0;
}

// ── Velocity calculation ───────────────────────────────────────────────────

/**
 * calcVelocity
 *
 * Computes AUD inflow (buy_aud) and outflow (sell_aud) velocity.
 *
 * Net velocity = buy_velocity − sell_velocity.
 *   Positive: business is accumulating AUD (buying more than selling).
 *   Negative: inventory is depleting (selling more than buying).
 *
 * For depletion forecast, the raw sell velocity is used.
 * Net velocity provides directional context.
 *
 * Weights: 40% 7-day + 60% 30-day for sell velocity.
 * Buy velocity: 30-day only (purchases are less frequent).
 */
function calcVelocity(
  ledgerRows: LedgerRowInput[],
  today: Date,
): {
  sellV7: number;
  sellV30: number;
  sellVelocity: number;       // weighted sell
  buyV30: number;             // 30-day avg buy
  netVelocity: number;        // buyV30 - sellVelocity (positive = accumulating)
  hasSufficientData: boolean;
} {
  const MS_PER_DAY = 86_400_000;
  const todayMs = today.getTime();

  let sumSell7 = 0;
  let sumSell30 = 0;
  let sumBuy30 = 0;
  let hasSales30 = false;
  let hasSales7 = false;

  for (const row of ledgerRows) {
    const et = row.entry_type ?? "trade";
    if (et === "transfer" || et === "expense" || et === "owner_loan" || et === "adjustment") continue;

    const rowDate = new Date(row.date_gregorian + "T00:00:00Z");
    if (isNaN(rowDate.getTime())) continue;

    const daysAgo = (todayMs - rowDate.getTime()) / MS_PER_DAY;
    if (daysAgo < 0) continue; // future-dated rows ignored

    const aud = Number(row.amount_aud) || 0;

    if (row.type === "sell_aud") {
      if (daysAgo <= 30) { sumSell30 += aud; hasSales30 = true; }
      if (daysAgo <= 7)  { sumSell7  += aud; hasSales7  = true; }
    } else if (row.type === "buy_aud") {
      if (daysAgo <= 30) { sumBuy30 += aud; }
    }
  }

  const sellV30 = hasSales30 ? sumSell30 / 30 : 0;
  const sellV7  = hasSales7  ? sumSell7  / 7  : 0;
  const buyV30  = sumBuy30 / 30;

  // Weighted sell velocity: 40% 7-day + 60% 30-day
  const sellVelocity =
    hasSales7  ? 0.40 * sellV7 + 0.60 * sellV30 :
    hasSales30 ? sellV30 :
    0;

  const netVelocity = buyV30 - sellVelocity;

  return {
    sellV7,
    sellV30,
    sellVelocity,
    buyV30,
    netVelocity,
    hasSufficientData: hasSales30,
  };
}

// ── Cash Runway calculation ────────────────────────────────────────────────

/**
 * calcCashRunway
 *
 * Produces two runway metrics from the last 3 months of paid expenses.
 *
 * LIQUID RUNWAY = IRT cash / avg monthly expenses
 *   Conservative — only counts immediately available IRT.
 *
 * TOTAL RUNWAY = (IRT cash + inventory market value) / avg monthly expenses
 *   Optimistic — assumes AUD inventory can be sold at market rate.
 *
 * Returns null for both if no expense history exists.
 */
function calcCashRunway(
  monthlyExpenses: { month: string; amountIRT: number }[],
  totalIranLiquidityIRT: number,
  inventoryMarketValueIRT: number,
): {
  liquidRunwayMonths: number | null;
  totalRunwayMonths: number | null;
  avgMonthly: number;
} {
  if (monthlyExpenses.length === 0) {
    return { liquidRunwayMonths: null, totalRunwayMonths: null, avgMonthly: 0 };
  }

  const recent = monthlyExpenses.slice(-3);
  const totalMonths = recent.length;
  const totalExpenses = recent.reduce((s, m) => s + m.amountIRT, 0);
  const avgMonthly = totalMonths > 0 ? totalExpenses / totalMonths : 0;

  if (avgMonthly <= 0) {
    return { liquidRunwayMonths: null, totalRunwayMonths: null, avgMonthly: 0 };
  }

  const liquidRunwayMonths = totalIranLiquidityIRT / avgMonthly;
  const totalRunwayMonths  = (totalIranLiquidityIRT + inventoryMarketValueIRT) / avgMonthly;

  return { liquidRunwayMonths, totalRunwayMonths, avgMonthly };
}

// ── Alert generation ───────────────────────────────────────────────────────

/**
 * generateAlerts
 *
 * Evaluates all treasury metrics against configured thresholds.
 * Returns alerts sorted by severity: critical first, then warning, then info.
 *
 * Sensitivity levels (from treasury_settings):
 *   low:    only alert on hard threshold breaches
 *   medium: alert when within 15% of threshold
 *   high:   alert when within 5% of threshold
 */
function generateAlerts(params: {
  audInventory: number;
  settings: TreasurySettingsInput;
  liquidityRatio: number;
  totalIranLiquidityIRT: number;
  exposureRatio: number;
  coverageDays: number | null;
  cashRunwayMonths: number | null;
  cashRunwayTarget: number;
}): TreasuryAlert[] {
  const {
    audInventory,
    settings,
    liquidityRatio,
    totalIranLiquidityIRT,
    exposureRatio,
    coverageDays,
    cashRunwayMonths,
    cashRunwayTarget,
  } = params;

  const alerts: TreasuryAlert[] = [];

  const sensitivityBuffer =
    settings.recommendation_sensitivity === "high"   ? 0.05 :
    settings.recommendation_sensitivity === "medium" ? 0.15 :
    0;  // low: no approach-warning, only hard breaches

  // ── 1. Inventory shortage ──────────────────────────────────────────────
  if (audInventory < settings.min_aud_inventory) {
    alerts.push({
      id: "inv_critical_low",
      severity: "critical",
      category: "inventory",
      titleFA: "\u0645\u0648\u062c\u0648\u062f\u06cc \u062f\u0644\u0627\u0631 \u062d\u06cc\u0627\u062a\u06cc",
      messageFA: `\u0645\u0648\u062c\u0648\u062f\u06cc \u062f\u0644\u0627\u0631 (${audInventory.toLocaleString("en-AU", { maximumFractionDigits: 0 })} AUD) \u0632\u06cc\u0631 \u062d\u062f\u0627\u0642\u0644 \u062a\u0639\u0631\u06cc\u0641\u200c\u0634\u062f\u0647 (${settings.min_aud_inventory.toLocaleString("en-AU", { maximumFractionDigits: 0 })} AUD) \u0627\u0633\u062a. \u062e\u0631\u06cc\u062f \u0641\u0648\u0631\u06cc \u062f\u0644\u0627\u0631 \u062a\u0648\u0635\u06cc\u0647 \u0645\u06cc\u200c\u0634\u0648\u062f.`,
      metric: "aud_inventory",
      value: audInventory,
      threshold: settings.min_aud_inventory,
    });
  } else if (
    sensitivityBuffer > 0 &&
    audInventory < settings.min_aud_inventory * (1 + sensitivityBuffer)
  ) {
    alerts.push({
      id: "inv_warn_low",
      severity: "warning",
      category: "inventory",
      titleFA: "\u0645\u0648\u062c\u0648\u062f\u06cc \u062f\u0644\u0627\u0631 \u062f\u0631 \u062d\u0627\u0644 \u06a9\u0627\u0647\u0634",
      messageFA: `\u0645\u0648\u062c\u0648\u062f\u06cc \u062f\u0644\u0627\u0631 \u062f\u0627\u0631\u062f \u0628\u0647 \u062d\u062f \u062d\u06cc\u0627\u062a\u06cc \u0646\u0632\u062f\u06cc\u06a9 \u0645\u06cc\u200c\u0634\u0648\u062f.`,
      metric: "aud_inventory",
      value: audInventory,
      threshold: settings.min_aud_inventory,
    });
  }

  // ── 2. Inventory surplus ───────────────────────────────────────────────
  if (audInventory > settings.max_aud_inventory) {
    alerts.push({
      id: "inv_critical_high",
      severity: "critical",
      category: "inventory",
      titleFA: "\u0645\u0648\u062c\u0648\u062f\u06cc \u062f\u0644\u0627\u0631 \u0628\u06cc\u0634 \u0627\u0632 \u062d\u062f",
      messageFA: `\u0645\u0648\u062c\u0648\u062f\u06cc \u062f\u0644\u0627\u0631 (${audInventory.toLocaleString("en-AU", { maximumFractionDigits: 0 })} AUD) \u0627\u0632 \u062d\u062f\u0627\u06a9\u062b\u0631 \u062a\u0639\u0631\u06cc\u0641\u200c\u0634\u062f\u0647 (${settings.max_aud_inventory.toLocaleString("en-AU", { maximumFractionDigits: 0 })} AUD) \u0641\u0631\u0627\u062a\u0631 \u0627\u0633\u062a. \u0641\u0631\u0648\u0634 \u062f\u0644\u0627\u0631 \u0628\u0631\u0627\u06cc \u062a\u0639\u0627\u062f\u0644 \u062f\u0627\u0631\u0627\u06cc\u06cc \u062a\u0648\u0635\u06cc\u0647 \u0645\u06cc\u200c\u0634\u0648\u062f.`,
      metric: "aud_inventory",
      value: audInventory,
      threshold: settings.max_aud_inventory,
    });
  } else if (
    sensitivityBuffer > 0 &&
    audInventory > settings.max_aud_inventory * (1 - sensitivityBuffer)
  ) {
    alerts.push({
      id: "inv_warn_high",
      severity: "warning",
      category: "inventory",
      titleFA: "\u0645\u0648\u062c\u0648\u062f\u06cc \u062f\u0644\u0627\u0631 \u062f\u0627\u0631\u062f \u0628\u0647 \u062d\u062f \u0645\u0627\u06a9\u0632\u06cc\u0645\u0648\u0645 \u0646\u0632\u062f\u06cc\u06a9 \u0645\u06cc\u200c\u0634\u0648\u062f",
      messageFA: "\u0645\u0648\u062c\u0648\u062f\u06cc \u062f\u0644\u0627\u0631 \u062f\u0627\u0631\u062f \u0628\u0647 \u062d\u062f \u0645\u0627\u06a9\u0632\u06cc\u0645\u0648\u0645 \u0646\u0632\u062f\u06cc\u06a9 \u0645\u06cc\u200c\u0634\u0648\u062f.",
      metric: "aud_inventory",
      value: audInventory,
      threshold: settings.max_aud_inventory,
    });
  }

  // ── 3. Liquidity shortage ──────────────────────────────────────────────
  if (liquidityRatio < 1) {
    alerts.push({
      id: "liq_critical",
      severity: "critical",
      category: "liquidity",
      titleFA: "\u0646\u0642\u062f\u06cc\u0646\u06af\u06cc \u062a\u0648\u0645\u0627\u0646 \u06a9\u0627\u0641\u06cc \u0646\u06cc\u0633\u062a",
      messageFA: `\u0645\u062c\u0645\u0648\u0639 \u0646\u0642\u062f\u06cc\u0646\u06af\u06cc \u0627\u06cc\u0631\u0627\u0646 (${Math.round(totalIranLiquidityIRT).toLocaleString("en-AU")} \u062a\u0648\u0645\u0627\u0646) \u0632\u06cc\u0631 \u062d\u062f\u0627\u0642\u0644 \u062a\u0639\u0631\u06cc\u0641\u200c\u0634\u062f\u0647 \u0627\u0633\u062a.`,
      metric: "irt_liquidity",
      value: totalIranLiquidityIRT,
      threshold: settings.min_irt_liquidity,
    });
  } else if (sensitivityBuffer > 0 && liquidityRatio < 1 + sensitivityBuffer) {
    alerts.push({
      id: "liq_warn",
      severity: "warning",
      category: "liquidity",
      titleFA: "\u0646\u0642\u062f\u06cc\u0646\u06af\u06cc \u062f\u0627\u0631\u062f \u0628\u0647 \u062d\u062f \u06a9\u0645\u062a\u0631\u06cc\u0646 \u0646\u0632\u062f\u06cc\u06a9 \u0645\u06cc\u200c\u0634\u0648\u062f",
      messageFA: "\u0646\u0642\u062f\u06cc\u0646\u06af\u06cc \u062a\u0648\u0645\u0627\u0646 \u062f\u0627\u0631\u062f \u0628\u0647 \u062d\u062f \u0647\u0634\u062f\u0627\u0631 \u0646\u0632\u062f\u06cc\u06a9 \u0645\u06cc\u200c\u0634\u0648\u062f.",
      metric: "irt_liquidity",
      value: totalIranLiquidityIRT,
      threshold: settings.min_irt_liquidity,
    });
  }

  // ── 4. Exposure too high ───────────────────────────────────────────────
  if (exposureRatio > settings.max_aud_exposure) {
    alerts.push({
      id: "exp_critical",
      severity: "critical",
      category: "exposure",
      titleFA: "\u0631\u06cc\u0633\u06a9 \u062a\u0645\u0631\u06a9\u0632 \u062f\u0644\u0627\u0631 \u0628\u06cc\u0634 \u0627\u0632 \u062d\u062f",
      messageFA: `${Math.round(exposureRatio * 100)}\u0025 \u0627\u0632 \u062f\u0627\u0631\u0627\u06cc\u06cc\u200c\u0647\u0627 \u062f\u0631 \u062f\u0644\u0627\u0631 \u0646\u06af\u0647\u062f\u0627\u0631\u06cc \u0645\u06cc\u200c\u0634\u0648\u062f. \u0641\u0631\u0648\u0634 \u062f\u0644\u0627\u0631 \u0628\u0631\u0627\u06cc \u062a\u0639\u0627\u062f\u0644 \u0646\u0642\u062f\u06cc\u0646\u06af\u06cc \u062a\u0648\u0635\u06cc\u0647 \u0645\u06cc\u200c\u0634\u0648\u062f.`,
      metric: "exposure_ratio",
      value: exposureRatio,
      threshold: settings.max_aud_exposure,
    });
  }

  // ── 5. Coverage days low ───────────────────────────────────────────────
  if (coverageDays !== null && coverageDays < settings.inventory_coverage_target_days) {
    const severity: TreasuryAlert["severity"] = coverageDays < 7 ? "critical" : "warning";
    alerts.push({
      id: "cov_low",
      severity,
      category: "forecast",
      titleFA: "\u0631\u0648\u0632\u0647\u0627\u06cc \u067e\u0648\u0634\u0634 \u06a9\u0645 \u0627\u0633\u062a",
      messageFA: `\u0645\u0648\u062c\u0648\u062f\u06cc \u062c\u0627\u0631\u06cc \u0641\u0642\u0637 \u062a\u0642\u0631\u06cc\u0628\u0627\u064b ${Math.round(coverageDays)} \u0631\u0648\u0632 \u062a\u0642\u0627\u0636\u0627 \u0631\u0627 \u067e\u0648\u0634\u0634 \u0645\u06cc\u200c\u062f\u0647\u062f.`,
      metric: "coverage_days",
      value: coverageDays,
      threshold: settings.inventory_coverage_target_days,
    });
  }

  // ── 6. Cash runway low ─────────────────────────────────────────────────
  if (cashRunwayMonths !== null && cashRunwayMonths < cashRunwayTarget) {
    const severity: TreasuryAlert["severity"] = cashRunwayMonths < 1 ? "critical" : "warning";
    alerts.push({
      id: "runway_low",
      severity,
      category: "cash_runway",
      titleFA: "\u067e\u0648\u0634\u0634 \u0647\u0632\u06cc\u0646\u0647\u200c\u0647\u0627\u06cc \u062c\u0627\u0631\u06cc \u06a9\u0645 \u0627\u0633\u062a",
      messageFA: `\u0646\u0642\u062f\u06cc\u0646\u06af\u06cc \u062c\u0627\u0631\u06cc \u0641\u0642\u0637 ${cashRunwayMonths.toFixed(1)} \u0645\u0627\u0647 \u0647\u0632\u06cc\u0646\u0647\u200c\u0647\u0627\u06cc \u0639\u0645\u0644\u06cc\u0627\u062a\u06cc \u0631\u0627 \u067e\u0648\u0634\u0634 \u0645\u06cc\u200c\u062f\u0647\u062f.`,
      metric: "cash_runway_months",
      value: cashRunwayMonths,
      threshold: cashRunwayTarget,
    });
  }

  // Sort: critical → warning → info
  const order = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}

// ── Forecast label builder ─────────────────────────────────────────────────

function buildForecastLabel(coverageDays: number, targetDays: number): string {
  if (coverageDays >= targetDays * 3) {
    return `\u0645\u0648\u062c\u0648\u062f\u06cc \u062a\u0642\u0631\u06cc\u0628\u0627\u064b ${Math.round(coverageDays)} \u0631\u0648\u0632 \u0622\u06cc\u0646\u062f\u0647 \u0631\u0627 \u067e\u0648\u0634\u0634 \u0645\u06cc\u200c\u062f\u0647\u062f`;
  }
  if (coverageDays >= targetDays) {
    return `\u0645\u0648\u062c\u0648\u062f\u06cc \u062a\u0642\u0631\u06cc\u0628\u0627\u064b ${Math.round(coverageDays)} \u0631\u0648\u0632 \u067e\u0648\u0634\u0634 \u062f\u0627\u0631\u062f — \u0648\u0636\u0639\u06cc\u062a \u0645\u0637\u0644\u0648\u0628`;
  }
  if (coverageDays >= 7) {
    return `\u0645\u0648\u062c\u0648\u062f\u06cc \u062a\u0642\u0631\u06cc\u0628\u0627\u064b ${Math.round(coverageDays)} \u0631\u0648\u0632 \u067e\u0648\u0634\u0634 \u062f\u0627\u0631\u062f — \u0632\u06cc\u0631 \u0647\u062f\u0641`;
  }
  return `\u0645\u0648\u062c\u0648\u062f\u06cc \u062f\u0644\u0627\u0631 \u062a\u0646\u0647\u0627 \u062d\u062f\u0648\u062f ${Math.round(coverageDays)} \u0631\u0648\u0632 \u067e\u0648\u0634\u0634 \u062f\u0627\u0631\u062f — \u062e\u0631\u06cc\u062f \u0641\u0648\u0631\u06cc \u062a\u0648\u0635\u06cc\u0647 \u0645\u06cc\u200c\u0634\u0648\u062f`;
}

// ── Main exported function ─────────────────────────────────────────────────

/**
 * calcTreasurySnapshot
 *
 * Produces the complete treasury state object consumed by
 * the Strategy Engine and the UI sections.
 *
 * @param accounting   Output of calcAccountingSnapshot
 * @param ledgerRows   All ledger rows (for velocity calculation)
 * @param balances     Current Kadoos and Pezhman IRT balances (manually entered)
 * @param settings     Current row from treasury_settings table
 * @param today        Reference date (default: now). Injectable for testing.
 */
export function calcTreasurySnapshot(
  accounting: AccountingSnapshot,
  ledgerRows: LedgerRowInput[],
  balances: AccountBalancesInput,
  settings: TreasurySettingsInput,
  today: Date = new Date(),
): TreasurySnapshot {
  const kadoosBalanceIRT   = n(balances.kadoosBalanceIRT);
  const pezhmanBalanceIRT  = n(balances.pezhmanBalanceIRT);
  const totalIranLiquidityIRT = kadoosBalanceIRT + pezhmanBalanceIRT;

  const audInventory           = accounting.audInventory;
  const inventoryCostValueIRT  = accounting.inventoryCostValueIRT;
  const inventoryMarketValueIRT = accounting.inventoryMarketValueIRT;
  const currentBuyRate         = accounting.currentBuyRate;
  const wac                    = accounting.wac;

  // ── Inventory position metrics ───────────────────────────────────────────
  const targetInventory = settings.target_aud_inventory;
  const inventoryRatio  = targetInventory > 0 ? audInventory / targetInventory : 0;
  const inventoryGap    = audInventory - targetInventory;
  const inventoryGapPercent = targetInventory > 0 ? (inventoryGap / targetInventory) * 100 : 0;

  // ── Liquidity ratio ──────────────────────────────────────────────────────
  const liquidityRatio = settings.min_irt_liquidity > 0
    ? totalIranLiquidityIRT / settings.min_irt_liquidity
    : 0;

  // ── Dual exposure ratios ─────────────────────────────────────────────────
  const costAssets   = inventoryCostValueIRT  + totalIranLiquidityIRT;
  const marketAssets = inventoryMarketValueIRT + totalIranLiquidityIRT;

  const exposureCostBasis   = costAssets   > 0 ? inventoryCostValueIRT   / costAssets   : 0;
  const exposureMarketBasis = marketAssets > 0 ? inventoryMarketValueIRT / marketAssets : 0;

  // ── Net Velocity + Forecast ──────────────────────────────────────────────
  const {
    sellV7,
    sellV30,
    sellVelocity,
    buyV30,
    netVelocity,
    hasSufficientData,
  } = calcVelocity(ledgerRows, today);

  let forecast: ForecastResult;
  let coverageDays: number | null = null;

  if (!hasSufficientData || sellVelocity <= 0) {
    forecast = {
      available: false,
      reason: sellVelocity <= 0 ? "zero_velocity" : "insufficient_data",
    };
  } else {
    // Coverage = inventory / sell velocity (depletion timing)
    coverageDays = audInventory > 0 ? audInventory / sellVelocity : 0;

    const minDays = coverageDays * 0.80;
    const maxDays = coverageDays * 1.20;

    let depletionDate: string | null = null;
    if (coverageDays > 0 && coverageDays < 90 && audInventory > 0) {
      const depletion = new Date(today.getTime() + coverageDays * 86_400_000);
      depletionDate = depletion.toISOString().slice(0, 10);
    }

    forecast = {
      available: true,
      dailyVelocityAUD: sellVelocity,
      velocity7d:       sellV7,
      velocity30d:      sellV30,
      buyVelocity30d:   buyV30,
      netVelocity,
      coverageDays,
      forecastDaysMin: minDays,
      forecastDaysMax: maxDays,
      depletionDate,
      forecastLabel: buildForecastLabel(coverageDays, settings.inventory_coverage_target_days),
    };
  }

  // ── Dual Cash Runway ─────────────────────────────────────────────────────
  const {
    liquidRunwayMonths,
    totalRunwayMonths,
    avgMonthly,
  } = calcCashRunway(
    accounting.monthlyExpenses,
    totalIranLiquidityIRT,
    inventoryMarketValueIRT,
  );

  // ── Composite assets ─────────────────────────────────────────────────────
  // Use market value for total assets (what assets are worth right now)
  const totalAssetValueIRT  = inventoryMarketValueIRT + totalIranLiquidityIRT;
  const netBusinessValueIRT = totalAssetValueIRT - accounting.ownerLoanBalanceIRT;

  // ── Alerts ───────────────────────────────────────────────────────────────
  const alerts = generateAlerts({
    audInventory,
    settings,
    liquidityRatio,
    totalIranLiquidityIRT,
    exposureRatio: exposureMarketBasis,  // use market basis for alerts
    coverageDays,
    cashRunwayMonths: liquidRunwayMonths,
    cashRunwayTarget: settings.cash_runway_target_months,
  });

  return {
    kadoosBalanceIRT,
    pezhmanBalanceIRT,
    totalIranLiquidityIRT,

    audInventory,
    inventoryValueIRT:       inventoryMarketValueIRT,  // backward compat
    inventoryCostValueIRT,
    inventoryMarketValueIRT,
    wac,
    currentBuyRate,

    inventoryRatio,
    inventoryDistanceFromTarget: inventoryGap,
    currentInventory: audInventory,
    targetInventory,
    inventoryGap,
    inventoryGapPercent,

    liquidityRatio,

    exposureCostBasis,
    exposureMarketBasis,
    exposureRatio: exposureMarketBasis,  // backward compat

    forecast,
    coverageDays,

    liquidRunwayMonths,
    totalRunwayMonths,
    cashRunwayMonths: liquidRunwayMonths,  // backward compat
    avgMonthlyExpensesIRT: avgMonthly,

    totalAssetValueIRT,
    netBusinessValueIRT,
    ownerLoanBalanceIRT: accounting.ownerLoanBalanceIRT,

    accountingWarnings: accounting.accountingWarnings,

    alerts,
    settings,
  };
}
