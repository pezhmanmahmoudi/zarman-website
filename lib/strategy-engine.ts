/**
 * lib/strategy-engine.ts
 *
 * Zarman Treasury — Strategy Engine (v2)
 *
 * Pure functions. Zero side effects. Zero database calls.
 * Consumes TreasurySnapshot from treasury-engine.
 * Produces StrategyOutput consumed by the UI Section 1.
 *
 * ─────────────────────────────────────────────────────────
 * CRITICAL CONSTRAINTS (non-negotiable)
 * ─────────────────────────────────────────────────────────
 * 1. Never predict exchange rates.
 * 2. Never reference external market conditions.
 * 3. All recommendations based ONLY on:
 *    - Current AUD inventory vs. thresholds
 *    - Current IRT liquidity vs. thresholds
 *    - Exposure ratio vs. target_exposure_ratio / max_aud_exposure
 *    - Velocity and coverage days
 *    - Profitability (normalized)
 *    - Cash runway
 *    - Accounting warnings
 * ─────────────────────────────────────────────────────────
 *
 * HEALTH SCORE FORMULA:
 *
 * Score = 0.30 × S_inventory
 *       + 0.25 × S_liquidity
 *       + 0.20 × S_exposure
 *       + 0.15 × S_profitability
 *       + 0.10 × S_forecast
 *
 * S_inventory — BELL CURVE: peaks at target_aud_inventory.
 * S_exposure  — BELL CURVE: peaks at target_exposure_ratio (configurable).
 * S_profitability — NORMALIZED: operating profit / total assets.
 *
 * TREND ANALYSIS:
 *   Requires a previous TreasurySnapshot. If not provided,
 *   all trends default to "stable".
 *
 * PRICING GUIDANCE:
 *   StrategyOutput includes rateAdjustmentSuggestion with
 *   buy/sell rate deltas and a Persian explanation.
 */

import type { TreasurySnapshot } from "./treasury-engine";
import type { AccountingSnapshot } from "./accounting-engine";

// ── Output types ───────────────────────────────────────────────────────────

export type RecommendationType = "BUY_AUD" | "SELL_AUD" | "HOLD" | "CAUTION";
export type RiskLevel = "low" | "moderate" | "elevated" | "high" | "critical";
export type HealthCategory = "excellent" | "good" | "caution" | "critical";

export type HealthScoreBreakdown = {
  /** Inventory component score (0–100). Bell-curve: peaks at target. */
  inventory: number;
  /** Liquidity component score (0–100). Linear: rises with liquidity ratio. */
  liquidity: number;
  /** Exposure component score (0–100). Bell-curve: peaks at 50/50 balance. */
  exposure: number;
  /** Profitability component score (0/50/100). */
  profitability: number;
  /** Forecast component score (0–100). Based on coverage days vs. target. */
  forecast: number;
};

export type StrategyRecommendation = {
  /** Primary action recommendation */
  action: RecommendationType;

  /** Risk level associated with the current state */
  riskLevel: RiskLevel;

  /**
   * Confidence in this recommendation (0–1).
   * Lower when signals conflict (e.g., low inventory + low liquidity).
   */
  confidence: number;

  /** Persian: one-line headline for the recommendation panel */
  titleFA: string;

  /** Persian: 2–4 sentence explanation of WHY this was generated */
  reasoningFA: string;

  /** Persian: what will happen if no action is taken */
  inactionRiskFA: string;

  /** Persian: specific suggested action */
  suggestedActionFA: string;

  /** Key metrics that drove this recommendation */
  drivingMetrics: string[];
};

export type HealthScore = {
  /** Composite score 0–100 */
  score: number;

  /** Category label */
  category: HealthCategory;

  /** Persian category label */
  categoryFA: string;

  /** Component breakdown for explainability */
  breakdown: HealthScoreBreakdown;

  /** Persian explanation of the score */
  explanationFA: string;

  /** Trend direction (requires historical snapshots — set to "stable" if unavailable) */
  trend: "improving" | "stable" | "declining";
};

export type StrategyOutput = {
  recommendation: StrategyRecommendation;
  healthScore: HealthScore;
  /** Alerts are passed through from TreasurySnapshot for UI convenience */
  alerts: TreasurySnapshot["alerts"];
  /** Critical alert count (for badge in navigation) */
  criticalAlertCount: number;
  /** Pricing guidance — buy/sell rate adjustment recommendation */
  rateAdjustmentSuggestion: RateAdjustmentSuggestion;
  /** Trend analysis (requires previousSnapshot; all "stable" if absent) */
  trendAnalysis: TrendAnalysis;
  /** Accounting data quality warnings forwarded from accounting engine */
  accountingWarnings: string[];
};

export type RateAdjustmentSuggestion = {
  /**
   * Suggested delta to the buy rate (IRT per AUD).
   * Positive = raise buy rate (pay more per AUD to attract sellers).
   * Negative = lower buy rate (reduce cost when inventory is sufficient).
   * Zero = no adjustment.
   */
  buyRateDelta: number;
  /**
   * Suggested delta to the sell rate.
   * Positive = raise sell rate (earn more per AUD sold when demand is high).
   * Negative = lower sell rate (improve competitive position).
   * Zero = no adjustment.
   */
  sellRateDelta: number;
  /** Persian explanation of why these deltas were suggested */
  explanationFA: string;
};

export type TrendDirection = "improving" | "stable" | "declining";

export type TrendAnalysis = {
  inventoryTrend:    TrendDirection;
  liquidityTrend:    TrendDirection;
  exposureTrend:     TrendDirection;
  healthScoreTrend:  TrendDirection;
  profitabilityTrend: TrendDirection;
  inventoryChangePct:    number | null;
  liquidityChangePct:    number | null;
  exposureChangePoints:  number | null;  // absolute change in exposure ratio × 100
  healthScoreChangePts:  number | null;
  profitChangeIRT:       number | null;
};

// ── Helper ─────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

// ── Component score calculators ────────────────────────────────────────────

/**
 * Inventory Health Score — BELL CURVE
 *
 * Score = 100 at target_aud_inventory.
 * Declines linearly in both directions:
 *   - Below target: score decreases toward 0 at min_aud_inventory
 *   - Above target: score decreases toward 0 at max_aud_inventory
 *
 * This means a surplus is penalized equally to a shortage of
 * proportionally equal distance from target.
 *
 * If inventory exactly equals target → score = 100.
 * If inventory = 0 or > max → score approaches 0.
 */
function calcInventoryScore(
  audInventory: number,
  min: number,
  target: number,
  max: number,
): number {
  if (target <= 0) return 0;

  if (audInventory <= min) return 0;
  if (audInventory >= max) return 0;

  if (audInventory <= target) {
    // Shortage zone: linear from 0 at min → 100 at target
    const range = target - min;
    if (range <= 0) return 100;
    return clamp(((audInventory - min) / range) * 100, 0, 100);
  } else {
    // Surplus zone: linear from 100 at target → 0 at max
    const range = max - target;
    if (range <= 0) return 100;
    return clamp(((max - audInventory) / range) * 100, 0, 100);
  }
}

/**
 * Liquidity Health Score — LINEAR CAP
 * Score = min(100, liquidityRatio × 100)
 * 100 when at or above minimum. Declines linearly below.
 */
function calcLiquidityScore(liquidityRatio: number): number {
  return clamp(liquidityRatio * 100, 0, 100);
}

/**
 * Exposure Health Score — BELL CURVE centered at target_exposure_ratio
 *
 * Score = 100 − |exposureRatio − target| / (max − target) × 100
 *
 * Where:
 *   target = settings.target_exposure_ratio (configurable, default 0.50)
 *   max    = settings.max_aud_exposure
 *
 * Score = 100 exactly at target.
 * Score = 0 at max_aud_exposure or at 0.
 */
function calcExposureScore(
  exposureRatio: number,
  targetExposure: number,
  maxExposure: number,
): number {
  if (exposureRatio <= targetExposure) {
    // Below-target zone: linear from 0 at 0 → 100 at target
    const range = targetExposure;
    if (range <= 0) return 100;
    return clamp((exposureRatio / range) * 100, 0, 100);
  } else {
    // Above-target zone: linear from 100 at target → 0 at maxExposure
    const range = maxExposure - targetExposure;
    if (range <= 0) return 0;
    return clamp(((maxExposure - exposureRatio) / range) * 100, 0, 100);
  }
}

/**
 * Profitability Health Score — NORMALIZED
 *
 * Score = clamp(operatingProfit / totalAssets × 1000, 0, 100)
 *
 * Rationale:
 *   A return of 10% of total assets (0.10) maps to score 100.
 *   A return of 5% maps to score 50.
 *   Zero or negative profit maps to score 0–20 (stepped).
 *
 * Fallback:
 *   If totalAssets = 0, use the simple step function (0/50/100).
 */
function calcProfitabilityScore(
  operatingProfit: number,
  realizedTradingProfit: number,
  totalAssetValueIRT: number,
): number {
  if (totalAssetValueIRT > 0) {
    const returnOnAssets = operatingProfit / totalAssetValueIRT;
    // 10% ROA = 100 score; scale proportionally. Cap at 100.
    const normalized = clamp(returnOnAssets * 1000, 0, 100);
    // If ROA is negative but trading profit is positive, floor at 20
    if (normalized < 20 && realizedTradingProfit > 0 && operatingProfit < 0) return 20;
    return normalized;
  }
  // Fallback step function
  if (operatingProfit > 0) return 100;
  if (realizedTradingProfit > 0) return 50;
  return 0;
}

/**
 * Forecast Health Score — LINEAR CAP
 * Score = min(100, coverageDays / target × 100)
 * 100 when coverage meets or exceeds target. Linear below.
 * 50 when coverage = 50% of target. 0 when no coverage.
 */
function calcForecastScore(
  coverageDays: number | null,
  targetDays: number,
): number {
  if (coverageDays === null || targetDays <= 0) return 50; // neutral when no data
  return clamp((coverageDays / targetDays) * 100, 0, 100);
}

// ── Recommendation logic ───────────────────────────────────────────────────

/**
 * determineRecommendation
 *
 * Evaluates treasury state and produces a single prioritized recommendation.
 *
 * Decision priority (evaluated in order):
 * 1. Critical inventory shortage → BUY_AUD (highest priority)
 * 2. Critical liquidity shortage → CAUTION (cannot buy even if wanted)
 * 3. Critical exposure (too much AUD) → SELL_AUD
 * 4. Critical inventory surplus → SELL_AUD
 * 5. Coverage days critically low → BUY_AUD
 * 6. Approaching thresholds → appropriate action with lower confidence
 * 7. Default → HOLD
 *
 * When signals CONFLICT (e.g., low inventory AND low liquidity),
 * the recommendation is CAUTION with reduced confidence.
 */
function determineRecommendation(
  treasury: TreasurySnapshot,
  accounting: AccountingSnapshot,
): StrategyRecommendation {
  const s = treasury.settings;
  const inv = treasury.audInventory;
  const liq = treasury.totalIranLiquidityIRT;
  const exp = treasury.exposureRatio;
  const cov = treasury.coverageDays;

  const invCriticallyLow   = inv < s.min_aud_inventory;
  const invCriticallyHigh  = inv > s.max_aud_inventory;
  const liqCriticallyLow   = liq < s.min_irt_liquidity;
  const expCriticallyHigh  = exp > s.max_aud_exposure;
  const covCriticallyLow   = cov !== null && cov < s.inventory_coverage_target_days * 0.5;

  // ── Conflict detection ─────────────────────────────────────────────────
  const conflictingSignals = (invCriticallyLow && liqCriticallyLow) ||
                             (invCriticallyHigh && expCriticallyHigh);

  if (conflictingSignals) {
    const inventoryMsg = invCriticallyLow
      ? `\u0645\u0648\u062c\u0648\u062f\u06cc \u062f\u0644\u0627\u0631 \u067e\u0627\u06cc\u06cc\u0646 \u0627\u0633\u062a (${inv.toLocaleString("en-AU", { maximumFractionDigits: 0 })} AUD)`
      : `\u0645\u0648\u062c\u0648\u062f\u06cc \u062f\u0644\u0627\u0631 \u0628\u0627\u0644\u0627 \u0627\u0633\u062a (${inv.toLocaleString("en-AU", { maximumFractionDigits: 0 })} AUD)`;

    return {
      action: "CAUTION",
      riskLevel: "high",
      confidence: 0.5,
      titleFA: "\u0647\u0634\u062f\u0627\u0631: \u0633\u06cc\u06af\u0646\u0627\u0644\u200c\u0647\u0627\u06cc \u0645\u062a\u0636\u0627\u062f",
      reasoningFA: `${inventoryMsg} \u0648 \u062f\u0631 \u0639\u06cc\u0646 \u062d\u0627\u0644 \u0646\u0642\u062f\u06cc\u0646\u06af\u06cc \u062a\u0648\u0645\u0627\u0646 \u0646\u06cc\u0632 \u06a9\u0627\u0641\u06cc \u0646\u06cc\u0633\u062a. \u0633\u06cc\u0633\u062a\u0645 \u0642\u0627\u062f\u0631 \u0628\u0647 \u0627\u0631\u0627\u0626\u0647 \u062a\u0648\u0635\u06cc\u0647 \u0642\u0637\u0639\u06cc \u0646\u06cc\u0633\u062a.`,
      inactionRiskFA: "\u062f\u0631 \u0635\u0648\u0631\u062a \u0639\u062f\u0645 \u0627\u0642\u062f\u0627\u0645\u060c \u0648\u0636\u0639\u06cc\u062a \u062e\u0632\u0627\u0646\u0647\u062f\u0627\u0631\u06cc \u0628\u062f\u062a\u0631 \u062e\u0648\u0627\u0647\u062f \u0634\u062f.",
      suggestedActionFA: "\u0648\u0636\u0639\u06cc\u062a \u0631\u0627 \u0628\u0627 \u062f\u0642\u062a \u0628\u0631\u0631\u0633\u06cc \u06a9\u0646\u06cc\u062f. \u0627\u0628\u062a\u062f\u0627 \u0646\u0642\u062f\u06cc\u0646\u06af\u06cc \u062a\u0648\u0645\u0627\u0646 \u0631\u0627 \u062a\u0623\u0645\u06cc\u0646 \u06a9\u0646\u06cc\u062f\u060c \u0633\u067e\u0633 \u062f\u0631\u0628\u0627\u0631\u0647 \u062e\u0631\u06cc\u062f \u062f\u0644\u0627\u0631 \u062a\u0635\u0645\u06cc\u0645 \u0628\u06af\u06cc\u0631\u06cc\u062f.",
      drivingMetrics: ["aud_inventory", "irt_liquidity"],
    };
  }

  // ── Priority 1: Critical inventory shortage ──────────────────────────
  if (invCriticallyLow && !liqCriticallyLow) {
    const pct = inv / s.min_aud_inventory;
    return {
      action: "BUY_AUD",
      riskLevel: "critical",
      confidence: clamp(1 - pct * 0.5, 0.7, 1),
      titleFA: "\u062e\u0631\u06cc\u062f \u062f\u0644\u0627\u0631 \u0636\u0631\u0648\u0631\u06cc \u0627\u0633\u062a",
      reasoningFA: `\u0645\u0648\u062c\u0648\u062f\u06cc \u062f\u0644\u0627\u0631 (${inv.toLocaleString("en-AU", { maximumFractionDigits: 0 })} AUD) \u0632\u06cc\u0631 \u062d\u062f\u0627\u0642\u0644 \u062a\u0639\u0631\u06cc\u0641\u200c\u0634\u062f\u0647 (${s.min_aud_inventory.toLocaleString("en-AU", { maximumFractionDigits: 0 })} AUD) \u0627\u0633\u062a. \u0646\u0642\u062f\u06cc\u0646\u06af\u06cc \u062a\u0648\u0645\u0627\u0646 \u0628\u0631\u0627\u06cc \u062e\u0631\u06cc\u062f \u06a9\u0627\u0641\u06cc \u0627\u0633\u062a. \u0645\u06cc\u0627\u0646\u06af\u06cc\u0646 \u0647\u0632\u06cc\u0646\u0647 \u062e\u0631\u06cc\u062f \u0641\u0639\u0644\u06cc: ${Math.round(accounting.wac).toLocaleString("en-AU")} \u062a\u0648\u0645\u0627\u0646.`,
      inactionRiskFA: `\u062f\u0631 \u0635\u0648\u0631\u062a \u0639\u062f\u0645 \u062e\u0631\u06cc\u062f\u060c \u0645\u0648\u062c\u0648\u062f\u06cc \u062a\u0642\u0631\u06cc\u0628\u0627\u064b ${cov !== null ? Math.round(cov) + " \u0631\u0648\u0632 \u062f\u06cc\u06af\u0631" : "\u0628\u0647 \u0632\u0648\u062f\u06cc"} \u062a\u0645\u0627\u0645 \u0645\u06cc\u200c\u0634\u0648\u062f \u0648 \u06a9\u0633\u0628\u200c\u0648\u06a9\u0627\u0631 \u0645\u062a\u0648\u0642\u0641 \u062e\u0648\u0627\u0647\u062f \u0634\u062f.`,
      suggestedActionFA: `\u062e\u0631\u06cc\u062f \u062d\u062f\u0627\u0642\u0644 ${(s.target_aud_inventory - inv).toLocaleString("en-AU", { maximumFractionDigits: 0 })} AUD \u0628\u0631\u0627\u06cc \u0631\u0633\u06cc\u062f\u0646 \u0628\u0647 \u0633\u0637\u062d \u0647\u062f\u0641 \u062a\u0648\u0635\u06cc\u0647 \u0645\u06cc\u200c\u0634\u0648\u062f.`,
      drivingMetrics: ["aud_inventory", "coverage_days"],
    };
  }

  // ── Priority 2: Liquidity critical, cannot safely buy ─────────────────
  if (liqCriticallyLow && !invCriticallyLow) {
    return {
      action: "CAUTION",
      riskLevel: "elevated",
      confidence: 0.75,
      titleFA: "\u0646\u0642\u062f\u06cc\u0646\u06af\u06cc \u062a\u0648\u0645\u0627\u0646 \u062f\u0631 \u062d\u062f \u0647\u0634\u062f\u0627\u0631 \u0627\u0633\u062a",
      reasoningFA: `\u0646\u0642\u062f\u06cc\u0646\u06af\u06cc \u0627\u06cc\u0631\u0627\u0646 (${Math.round(liq).toLocaleString("en-AU")} \u062a\u0648\u0645\u0627\u0646) \u0632\u06cc\u0631 \u062d\u062f \u062a\u0639\u0631\u06cc\u0641\u200c\u0634\u062f\u0647 \u0627\u0633\u062a. \u0627\u06af\u0631\u0686\u0647 \u0645\u0648\u062c\u0648\u062f\u06cc \u062f\u0644\u0627\u0631 \u06a9\u0627\u0641\u06cc \u0627\u0633\u062a\u060c \u0641\u0631\u0648\u0634\u200c\u0647\u0627\u06cc \u0622\u06cc\u0646\u062f\u0647 \u062a\u0648\u0645\u0627\u0646 \u06a9\u0627\u0641\u06cc \u0628\u0631\u0627\u06cc \u067e\u0631\u062f\u0627\u062e\u062a \u0628\u0647 \u0645\u0634\u062a\u0631\u06cc\u0627\u0646 \u062a\u0623\u0645\u06cc\u0646 \u0646\u0645\u06cc\u200c\u06a9\u0646\u062f.`,
      inactionRiskFA: "\u0641\u0631\u0648\u0634\u0647\u0627\u06cc \u0622\u06cc\u0646\u062f\u0647 \u0645\u0645\u06a9\u0646 \u0627\u0633\u062a \u0646\u062a\u0648\u0627\u0646 \u062f\u0631 \u062a\u0623\u062f\u06cc\u0647 \u067e\u0631\u062f\u0627\u062e\u062a \u0628\u0647 \u0645\u0634\u062a\u0631\u06cc\u0627\u0646 \u0628\u0627\u0634\u0646\u062f.",
      suggestedActionFA: "\u0646\u0642\u062f\u06cc\u0646\u06af\u06cc \u062a\u0648\u0645\u0627\u0646 \u0631\u0627 \u0627\u0632 \u0637\u0631\u06cc\u0642 \u062a\u0632\u0631\u06cc\u0642 \u0633\u0631\u0645\u0627\u06cc\u0647 \u06cc\u0627 \u0641\u0631\u0648\u0634 \u0628\u062e\u0634\u06cc \u0627\u0632 \u0645\u0648\u062c\u0648\u062f\u06cc \u062f\u0644\u0627\u0631 \u062a\u0623\u0645\u06cc\u0646 \u06a9\u0646\u06cc\u062f.",
      drivingMetrics: ["irt_liquidity"],
    };
  }

  // ── Priority 3: Critical exposure (too much AUD) ─────────────────────
  if (expCriticallyHigh) {
    const profitMsg = accounting.wac > 0 && treasury.currentBuyRate > accounting.wac
      ? `\u0646\u0631\u062e \u062c\u0627\u0631\u06cc (${Math.round(treasury.currentBuyRate).toLocaleString("en-AU")}) \u0628\u0627\u0644\u0627\u062a\u0631 \u0627\u0632 \u0645\u06cc\u0627\u0646\u06af\u06cc\u0646 \u0647\u0632\u06cc\u0646\u0647 \u062e\u0631\u06cc\u062f (${Math.round(accounting.wac).toLocaleString("en-AU")}) \u0627\u0633\u062a — \u0641\u0631\u0648\u0634 \u0633\u0648\u062f\u0622\u0648\u0631 \u062e\u0648\u0627\u0647\u062f \u0628\u0648\u062f.`
      : "\u0641\u0631\u0648\u0634 \u0628\u0647 \u062a\u0639\u0627\u062f\u0644 \u062f\u0627\u0631\u0627\u06cc\u06cc \u06a9\u0645\u06a9 \u0645\u06cc\u200c\u06a9\u0646\u062f.";

    return {
      action: "SELL_AUD",
      riskLevel: "elevated",
      confidence: 0.8,
      titleFA: "\u062a\u0645\u0631\u06a9\u0632 \u0628\u06cc\u0634 \u0627\u0632 \u062d\u062f \u062f\u0644\u0627\u0631",
      reasoningFA: `${Math.round(exp * 100)}\u0025 \u0627\u0632 \u062f\u0627\u0631\u0627\u06cc\u06cc\u200c\u0647\u0627\u06cc \u06a9\u0633\u0628\u200c\u0648\u06a9\u0627\u0631 \u062f\u0631 \u062f\u0644\u0627\u0631 \u0642\u0641\u0644 \u0634\u062f\u0647 \u0627\u0633\u062a. \u062d\u062f \u0645\u062c\u0627\u0632 ${Math.round(s.max_aud_exposure * 100)}\u0025 \u0627\u0633\u062a. ${profitMsg}`,
      inactionRiskFA: "\u0646\u0642\u062f\u06cc\u0646\u06af\u06cc \u062a\u0648\u0645\u0627\u0646 \u0628\u0631\u0627\u06cc \u067e\u0631\u062f\u0627\u062e\u062a \u0628\u0647 \u0645\u0634\u062a\u0631\u06cc\u0627\u0646 \u06a9\u0627\u0641\u06cc \u0646\u062e\u0648\u0627\u0647\u062f \u0628\u0648\u062f.",
      suggestedActionFA: "\u0641\u0631\u0648\u0634 \u0628\u062e\u0634\u06cc \u0627\u0632 \u0645\u0648\u062c\u0648\u062f\u06cc \u062f\u0644\u0627\u0631 \u0628\u0631\u0627\u06cc \u0631\u0633\u06cc\u062f\u0646 \u0628\u0647 \u0633\u0637\u062d \u0647\u062f\u0641 \u0645\u0648\u062c\u0648\u062f\u06cc.",
      drivingMetrics: ["exposure_ratio", "irt_liquidity"],
    };
  }

  // ── Priority 4: Inventory surplus ────────────────────────────────────
  if (invCriticallyHigh) {
    return {
      action: "SELL_AUD",
      riskLevel: "moderate",
      confidence: 0.75,
      titleFA: "\u0645\u0648\u062c\u0648\u062f\u06cc \u062f\u0644\u0627\u0631 \u0628\u06cc\u0634 \u0627\u0632 \u062d\u062f \u0647\u062f\u0641 \u0627\u0633\u062a",
      reasoningFA: `\u0645\u0648\u062c\u0648\u062f\u06cc \u062f\u0644\u0627\u0631 (${inv.toLocaleString("en-AU", { maximumFractionDigits: 0 })} AUD) \u0627\u0632 \u062d\u062f\u0627\u06a9\u062b\u0631 \u062a\u0639\u0631\u06cc\u0641\u200c\u0634\u062f\u0647 (${s.max_aud_inventory.toLocaleString("en-AU", { maximumFractionDigits: 0 })} AUD) \u0641\u0631\u0627\u062a\u0631 \u0627\u0633\u062a. \u0633\u0631\u0645\u0627\u06cc\u0647 \u0628\u06cc\u0634 \u0627\u0632 \u062d\u062f \u062f\u0631 \u062f\u0644\u0627\u0631 \u0642\u0641\u0644 \u0634\u062f\u0647 \u0627\u0633\u062a.`,
      inactionRiskFA: "\u062f\u0627\u0631\u0627\u06cc\u06cc\u200c\u0647\u0627 \u0628\u06cc\u0634 \u0627\u0632 \u062d\u062f \u062f\u0631 \u0645\u0639\u0631\u0636 \u0646\u0648\u0633\u0627\u0646\u0627\u062a \u0646\u0631\u062e\u06cc \u0642\u0631\u0627\u0631 \u0645\u06cc\u200c\u06af\u06cc\u0631\u0646\u062f. \u0646\u0642\u062f\u06cc\u0646\u06af\u06cc \u062a\u0648\u0645\u0627\u0646 \u06a9\u0627\u0647\u0634 \u0645\u06cc\u200c\u06cc\u0627\u0628\u062f.",
      suggestedActionFA: `\u0641\u0631\u0648\u0634 \u062a\u062f\u0631\u06cc\u062c\u06cc \u062d\u062f\u0648\u062f ${(inv - s.target_aud_inventory).toLocaleString("en-AU", { maximumFractionDigits: 0 })} AUD \u0628\u0631\u0627\u06cc \u0631\u0633\u06cc\u062f\u0646 \u0628\u0647 \u0633\u0637\u062d \u0647\u062f\u0641.`,
      drivingMetrics: ["aud_inventory", "exposure_ratio"],
    };
  }

  // ── Priority 5: Coverage critically low (even with adequate inventory) ─
  if (covCriticallyLow) {
    return {
      action: "BUY_AUD",
      riskLevel: "moderate",
      confidence: 0.65,
      titleFA: "\u067e\u0648\u0634\u0634 \u0645\u0648\u062c\u0648\u062f\u06cc \u06a9\u0627\u0641\u06cc \u0646\u06cc\u0633\u062a",
      reasoningFA: `\u0628\u0631 \u0627\u0633\u0627\u0633 \u0631\u0648\u0646\u062f \u0641\u0639\u0644\u06cc\u060c \u0645\u0648\u062c\u0648\u062f\u06cc \u062a\u0642\u0631\u06cc\u0628\u0627\u064b ${cov !== null ? Math.round(cov) : "?"} \u0631\u0648\u0632 \u0622\u06cc\u0646\u062f\u0647 \u0631\u0627 \u067e\u0648\u0634\u0634 \u0645\u06cc\u200c\u062f\u0647\u062f. \u0647\u062f\u0641 ${s.inventory_coverage_target_days} \u0631\u0648\u0632 \u0627\u0633\u062a.`,
      inactionRiskFA: "\u0645\u0648\u062c\u0648\u062f\u06cc \u0628\u0647 \u0632\u0648\u062f\u06cc \u0628\u0647 \u067e\u0627\u06cc\u06cc\u0646\u200c\u062a\u0631\u06cc\u0646 \u0633\u0637\u062d \u062e\u0648\u0627\u0647\u062f \u0631\u0633\u06cc\u062f.",
      suggestedActionFA: "\u062e\u0631\u06cc\u062f \u062a\u062f\u0631\u06cc\u062c\u06cc \u062f\u0644\u0627\u0631 \u0628\u0631\u0627\u06cc \u0627\u0641\u0632\u0627\u06cc\u0634 \u067e\u0648\u0634\u0634 \u0628\u0647 \u062d\u062f\u0627\u0642\u0644 \u0647\u062f\u0641 \u062a\u0648\u0635\u06cc\u0647 \u0645\u06cc\u200c\u0634\u0648\u062f.",
      drivingMetrics: ["coverage_days"],
    };
  }

  // ── Default: HOLD ──────────────────────────────────────────────────────
  const invPct = Math.round(treasury.inventoryRatio * 100);
  return {
    action: "HOLD",
    riskLevel: "low",
    confidence: 0.8,
    titleFA: "\u0648\u0636\u0639\u06cc\u062a \u062e\u0632\u0627\u0646\u0647 \u0645\u0637\u0644\u0648\u0628 \u0627\u0633\u062a",
    reasoningFA: `\u0645\u0648\u062c\u0648\u062f\u06cc \u062f\u0644\u0627\u0631 (${invPct}\u0025 \u0647\u062f\u0641)\u060c \u0646\u0642\u062f\u06cc\u0646\u06af\u06cc \u0648 \u0631\u06cc\u0633\u06a9 \u062a\u0645\u0627\u0645\u0627\u064b \u062f\u0631 \u0645\u062d\u062f\u0648\u062f\u0647\u200c\u0647\u0627\u06cc \u0642\u0627\u0628\u0644 \u0642\u0628\u0648\u0644 \u0647\u0633\u062a\u0646\u062f. \u0647\u06cc\u0686 \u0627\u0642\u062f\u0627\u0645\u06cc \u0641\u0648\u0631\u06cc \u0644\u0627\u0632\u0645 \u0646\u06cc\u0633\u062a.`,
    inactionRiskFA: "\u0648\u0636\u0639\u06cc\u062a \u062f\u0631 \u062d\u0627\u0644 \u062d\u0627\u0636\u0631 \u067e\u0627\u06cc\u062f\u0627\u0631 \u0627\u0633\u062a.",
    suggestedActionFA: "\u0646\u0638\u0627\u0631\u062a \u0631\u0648\u0632\u0627\u0646\u0647 \u0631\u0627 \u062f\u0646\u0628\u0627\u0644 \u06a9\u0646\u06cc\u062f \u0648 \u062f\u0631 \u0635\u0648\u0631\u062a \u062a\u063a\u06cc\u06cc\u0631 \u0648\u0636\u0639\u06cc\u062a \u0627\u0642\u062f\u0627\u0645 \u06a9\u0646\u06cc\u062f.",
    drivingMetrics: [],
  };
}

// ── Health score builder ───────────────────────────────────────────────────

function buildHealthScore(
  treasury: TreasurySnapshot,
  accounting: AccountingSnapshot,
): HealthScore {
  const s = treasury.settings;

  const sInventory     = calcInventoryScore(treasury.audInventory, s.min_aud_inventory, s.target_aud_inventory, s.max_aud_inventory);
  const sLiquidity     = calcLiquidityScore(treasury.liquidityRatio);
  const sExposure      = calcExposureScore(treasury.exposureMarketBasis, s.target_exposure_ratio, s.max_aud_exposure);
  const sProfitability = calcProfitabilityScore(accounting.operatingProfit, accounting.realizedTradingProfit, accounting.totalAssetValueIRT);
  const sForecast      = calcForecastScore(treasury.coverageDays, s.inventory_coverage_target_days);

  // Weights: fixed in code as specified in design review
  const score = clamp(
    Math.round(
      0.30 * sInventory +
      0.25 * sLiquidity +
      0.20 * sExposure  +
      0.15 * sProfitability +
      0.10 * sForecast
    ),
    0,
    100,
  );

  const category: HealthCategory =
    score >= 80 ? "excellent" :
    score >= 60 ? "good" :
    score >= 40 ? "caution" :
    "critical";

  const categoryFA: Record<HealthCategory, string> = {
    excellent: "\u0639\u0627\u0644\u06cc",
    good:      "\u062e\u0648\u0628",
    caution:   "\u0647\u0634\u062f\u0627\u0631",
    critical:  "\u0628\u062d\u0631\u0627\u0646\u06cc",
  };

  const explanationFA =
    category === "excellent"
      ? `\u0627\u0645\u062a\u06cc\u0627\u0632 \u062e\u0632\u0627\u0646\u0647\u062f\u0627\u0631\u06cc ${score} \u0627\u0632 \u06f1\u06f0\u06f0. \u0645\u0648\u062c\u0648\u062f\u06cc\u060c \u0646\u0642\u062f\u06cc\u0646\u06af\u06cc \u0648 \u0633\u0648\u062f\u0622\u0648\u0631\u06cc \u062f\u0631 \u0648\u0636\u0639\u06cc\u062a \u0645\u0646\u0627\u0633\u0628 \u0642\u0631\u0627\u0631 \u062f\u0627\u0631\u0646\u062f.`
    : category === "good"
      ? `\u0627\u0645\u062a\u06cc\u0627\u0632 ${score}. \u0648\u0636\u0639\u06cc\u062a \u06a9\u0644\u06cc \u062e\u0648\u0628 \u0627\u0633\u062a \u0627\u0645\u0627 \u0628\u0631\u062e\u06cc \u0634\u0627\u062e\u0635\u200c\u0647\u0627 \u0646\u06cc\u0627\u0632 \u0628\u0647 \u062a\u0648\u062c\u0647 \u062f\u0627\u0631\u0646\u062f.`
    : category === "caution"
      ? `\u0627\u0645\u062a\u06cc\u0627\u0632 ${score}. \u0686\u0646\u062f \u0634\u0627\u062e\u0635 \u062f\u0631 \u0633\u0637\u062d \u0647\u0634\u062f\u0627\u0631 \u0647\u0633\u062a\u0646\u062f. \u0627\u0642\u062f\u0627\u0645 \u0636\u0631\u0648\u0631\u06cc \u0627\u0633\u062a.`
      : `\u0627\u0645\u062a\u06cc\u0627\u0632 ${score}. \u0648\u0636\u0639\u06cc\u062a \u062e\u0632\u0627\u0646\u0647\u062f\u0627\u0631\u06cc \u062d\u06cc\u0627\u062a\u06cc \u0627\u0633\u062a. \u0627\u0642\u062f\u0627\u0645 \u0641\u0648\u0631\u06cc \u0644\u0627\u0632\u0645 \u0627\u0633\u062a.`;

  return {
    score,
    category,
    categoryFA: categoryFA[category],
    breakdown: {
      inventory:     Math.round(sInventory),
      liquidity:     Math.round(sLiquidity),
      exposure:      Math.round(sExposure),
      profitability: Math.round(sProfitability),
      forecast:      Math.round(sForecast),
    },
    explanationFA,
    trend: "stable",  // set by generateStrategyOutput when previousSnapshot available
  };
}

// ── Rate Adjustment Suggestion ─────────────────────────────────────────────

/**
 * buildRateAdjustmentSuggestion
 *
 * Produces pricing guidance based on treasury state.
 * Never predicts future rates. Based only on inventory/liquidity position.
 *
 * Logic:
 *   BUY_AUD  + low inventory  → raise buy rate to attract sellers
 *   SELL_AUD + high inventory → lower buy rate / raise sell rate
 *   HOLD                      → no adjustment
 *   CAUTION                   → no adjustment (position unclear)
 */
function buildRateAdjustmentSuggestion(
  recommendation: StrategyRecommendation,
  treasury: TreasurySnapshot,
): RateAdjustmentSuggestion {
  const { action } = recommendation;
  const inv = treasury.audInventory;
  const s   = treasury.settings;

  if (action === "BUY_AUD") {
    // Shortage: we need to buy. Raise buy rate to incentivize senders.
    const severity = inv < s.min_aud_inventory * 0.5 ? 500 :   // critical shortage
                     inv < s.min_aud_inventory        ? 300 :   // below minimum
                                                        100;    // approaching minimum
    return {
      buyRateDelta: severity,
      sellRateDelta: 0,
      explanationFA: `\u0645\u0648\u062c\u0648\u062f\u06cc \u062f\u0644\u0627\u0631 \u067e\u0627\u06cc\u06cc\u0646 \u0627\u0633\u062a. \u0627\u0641\u0632\u0627\u06cc\u0634 \u0646\u0631\u062e \u062e\u0631\u06cc\u062f \u0628\u0647 \u0645\u06cc\u0632\u0627\u0646 +${severity} \u062a\u0648\u0645\u0627\u0646 \u0628\u0631\u0627\u06cc \u062c\u0630\u0628 \u0641\u0631\u0633\u062a\u0646\u062f\u06af\u0627\u0646 \u062f\u0644\u0627\u0631 \u062a\u0648\u0635\u06cc\u0647 \u0645\u06cc\u200c\u0634\u0648\u062f.`,
    };
  }

  if (action === "SELL_AUD") {
    // Surplus: we need to sell. Raise sell rate to maximize revenue on outflow.
    const surplus   = inv - s.target_aud_inventory;
    const severity  = surplus > s.target_aud_inventory * 0.5 ? 300 : 100;
    return {
      buyRateDelta:  -100,  // slightly lower buy rate to slow accumulation
      sellRateDelta: severity,
      explanationFA: `\u0645\u0648\u062c\u0648\u062f\u06cc \u062f\u0644\u0627\u0631 \u0628\u0627\u0644\u0627 \u0627\u0633\u062a. \u0646\u0631\u062e \u0641\u0631\u0648\u0634 \u0631\u0627 \u0628\u0647 \u0645\u06cc\u0632\u0627\u0646 +${severity} \u0627\u0641\u0632\u0627\u06cc\u0634 \u062f\u0647\u06cc\u062f \u062a\u0627 \u0633\u0648\u062f \u0628\u06cc\u0634\u062a\u0631\u06cc \u062f\u0631 \u0641\u0631\u0648\u0634\u200c\u0647\u0627 \u06a9\u0633\u0628 \u0634\u0648\u062f. \u0646\u0631\u062e \u062e\u0631\u06cc\u062f \u0631\u0627 \u06a9\u0645\u06cc \u06a9\u0627\u0647\u0634 \u062f\u0647\u06cc\u062f.`,
    };
  }

  // HOLD or CAUTION — no price adjustment
  return {
    buyRateDelta:  0,
    sellRateDelta: 0,
    explanationFA: "\u0648\u0636\u0639\u06cc\u062a \u062a\u0639\u0627\u062f\u0644 \u0627\u0633\u062a. \u062a\u063a\u06cc\u06cc\u0631 \u0646\u0631\u062e \u062a\u0648\u0635\u06cc\u0647 \u0646\u0645\u06cc\u200c\u0634\u0648\u062f.",
  };
}

// ── Trend Analysis ─────────────────────────────────────────────────────────

function trendDir(current: number, previous: number, threshold = 0.03): TrendDirection {
  const delta = previous > 0 ? (current - previous) / previous : 0;
  if (delta > threshold)  return "improving";
  if (delta < -threshold) return "declining";
  return "stable";
}

/**
 * buildTrendAnalysis
 *
 * Compares current treasury snapshot against a previous one.
 * Returns "stable" for all metrics if previousSnapshot is not provided.
 */
function buildTrendAnalysis(
  current: TreasurySnapshot,
  currentAccounting: AccountingSnapshot,
  currentHealthScore: number,
  previous?: TreasurySnapshot,
  previousHealthScore?: number,
  previousAccounting?: AccountingSnapshot,
): TrendAnalysis {
  if (!previous) {
    return {
      inventoryTrend:     "stable",
      liquidityTrend:     "stable",
      exposureTrend:      "stable",
      healthScoreTrend:   "stable",
      profitabilityTrend: "stable",
      inventoryChangePct:    null,
      liquidityChangePct:    null,
      exposureChangePoints:  null,
      healthScoreChangePts:  null,
      profitChangeIRT:       null,
    };
  }

  const invChangePct = previous.audInventory > 0
    ? ((current.audInventory - previous.audInventory) / previous.audInventory) * 100
    : null;

  const liqChangePct = previous.totalIranLiquidityIRT > 0
    ? ((current.totalIranLiquidityIRT - previous.totalIranLiquidityIRT) / previous.totalIranLiquidityIRT) * 100
    : null;

  const expChangePts = (current.exposureMarketBasis - previous.exposureMarketBasis) * 100;

  const hsChangePts = previousHealthScore !== undefined
    ? currentHealthScore - previousHealthScore
    : null;

  const profitChange = previousAccounting !== undefined
    ? currentAccounting.operatingProfit - previousAccounting.operatingProfit
    : null;

  // Exposure trend: closer to target is improving
  const targetExp   = current.settings.target_exposure_ratio;
  const curExpDist  = Math.abs(current.exposureMarketBasis  - targetExp);
  const prevExpDist = Math.abs(previous.exposureMarketBasis - targetExp);
  const exposureTrend: TrendDirection = curExpDist < prevExpDist - 0.02 ? "improving"
    : curExpDist > prevExpDist + 0.02 ? "declining" : "stable";

  return {
    inventoryTrend:     trendDir(current.audInventory, previous.audInventory),
    liquidityTrend:     trendDir(current.totalIranLiquidityIRT, previous.totalIranLiquidityIRT),
    exposureTrend,
    healthScoreTrend:   hsChangePts === null ? "stable" : hsChangePts > 3 ? "improving" : hsChangePts < -3 ? "declining" : "stable",
    profitabilityTrend: profitChange === null ? "stable" : trendDir(currentAccounting.operatingProfit, previousAccounting!.operatingProfit),
    inventoryChangePct:    invChangePct,
    liquidityChangePct:    liqChangePct,
    exposureChangePoints:  expChangePts,
    healthScoreChangePts:  hsChangePts,
    profitChangeIRT:       profitChange,
  };
}

// ── Main exported function ─────────────────────────────────────────────────

/**
 * generateStrategyOutput
 *
 * Produces the complete strategy assessment for the Treasury UI.
 *
 * @param treasury         Output of calcTreasurySnapshot
 * @param accounting       Output of calcAccountingSnapshot
 * @param previousSnapshot (optional) Previous treasury snapshot for trend analysis
 * @param previousAccounting (optional) Previous accounting snapshot for profitability trend
 * @param previousHealthScore (optional) Previous health score number for trend comparison
 */
export function generateStrategyOutput(
  treasury: TreasurySnapshot,
  accounting: AccountingSnapshot,
  previousSnapshot?: TreasurySnapshot,
  previousAccounting?: AccountingSnapshot,
  previousHealthScore?: number,
): StrategyOutput {
  const recommendation = determineRecommendation(treasury, accounting);
  const healthScore    = buildHealthScore(treasury, accounting);

  // Set health score trend if previous data available
  if (previousSnapshot && previousHealthScore !== undefined) {
    const delta = healthScore.score - previousHealthScore;
    healthScore.trend = delta > 3 ? "improving" : delta < -3 ? "declining" : "stable";
  }

  const rateAdjustmentSuggestion = buildRateAdjustmentSuggestion(recommendation, treasury);

  const trendAnalysis = buildTrendAnalysis(
    treasury,
    accounting,
    healthScore.score,
    previousSnapshot,
    previousHealthScore,
    previousAccounting,
  );

  return {
    recommendation,
    healthScore,
    alerts: treasury.alerts,
    criticalAlertCount: treasury.alerts.filter(a => a.severity === "critical").length,
    rateAdjustmentSuggestion,
    trendAnalysis,
    accountingWarnings: treasury.accountingWarnings,
  };
}
