/**
 * Hard-coded fallback defaults — used only when DB values are null/missing.
 * The live values are read from `rates_history` via `getFinanceConfig()`.
 */
export const FINANCE_CONFIG_DEFAULTS = {
  DISCOUNT_STEP_VOLUME: 1000,
  DISCOUNT_PERCENT_PER_STEP: 0.005,
  MAX_DISCOUNT_PERCENT: 0.25,
  FEE_THRESHOLD: 1000,
  APPLIED_FEE: 30,
} as const;

/** Shape of the finance configuration row returned from the DB / context. */
export type FinanceConfig = {
  discount_step_volume: number;
  discount_percent_per_step: number;
  max_discount_percent: number;
  fee_threshold: number;
  applied_fee: number;
};

/**
 * Returns the loyalty-discount bonus in Toman per AUD (spread-based).
 * Pure function — no side effects, identical math to the old FINANCE_CONFIG usage.
 */
export function calcLoyaltyDiscount(
  approvedVolume: number,
  spread: number,
  config: FinanceConfig,
): number {
  if (spread === 0 || approvedVolume === 0) return 0;
  const volumeSteps = Math.floor(approvedVolume / config.discount_step_volume);
  const rawPct = volumeSteps * config.discount_percent_per_step;
  const finalPct = Math.min(rawPct, config.max_discount_percent);
  return spread * finalPct;
}

/**
 * Returns the loyalty-discount percentage (0–1) for a given approved volume.
 * Used for display purposes (e.g. admin CRM panel).
 */
export function calcLoyaltyDiscountPct(
  approvedVolume: number,
  config: FinanceConfig,
): number {
  const volumeSteps = Math.floor(approvedVolume / config.discount_step_volume);
  return Math.min(
    volumeSteps * config.discount_percent_per_step,
    config.max_discount_percent,
  );
}

/**
 * Returns the flat fee in AUD applied when rawAmountAud is below the threshold.
 * Pure function — identical math to the old FINANCE_CONFIG usage.
 */
export function calcAppliedFee(rawAmountAud: number, config: FinanceConfig): number {
  return rawAmountAud > 0 && rawAmountAud < config.fee_threshold
    ? config.applied_fee
    : 0;
}

// ---------------------------------------------------------------------------
// Promo code discount types and calculation
// ---------------------------------------------------------------------------

export type PromoDiscountType = "percentage" | "fixed";

export type PromoCodeData = {
  code: string;
  discount_type: PromoDiscountType;
  /** percentage: 0–100 (e.g. 10 = 10%). fixed: AUD amount. */
  discount_value: number;
  max_uses: number | null;
  used_count: number;
  active: boolean;
  expires_at: string | null;
};

export type PromoValidationResult =
  | { valid: true; discount_amount: number; final_amount: number; effectiveRate: number }
  | { valid: false; error: string };

/**
 * Validates a promo code and returns the effective exchange rate and discount.
 * Pure function — no DB access. DB lookup is handled in the server action.
 *
 * - percentage: improves the customer's exchange rate in their favour.
 *     sell_aud (customer sells AUD, receives IRT) → rate increases → more IRT.
 *     buy_aud  (customer buys  AUD, pays    IRT) → rate decreases → less IRT paid.
 *     AUD amount is unchanged; discount_amount is the AUD-equivalent of the rate benefit.
 * - fixed: reduces the AUD amount the customer pays/sends. Rate is unchanged.
 */
export function applyPromoCode(
  baseAmountAud: number,
  baseRate: number,
  direction: "buy_aud" | "sell_aud",
  promo: PromoCodeData,
): PromoValidationResult {
  if (!promo.active) {
    return { valid: false, error: "این کد تخفیف فعال نیست." };
  }
  if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
    return { valid: false, error: "این کد تخفیف منقضی شده است." };
  }
  if (promo.max_uses !== null && promo.used_count >= promo.max_uses) {
    return { valid: false, error: "این کد تخفیف به حداکثر استفاده خود رسیده است." };
  }

  // Rate bonus in IRT per AUD — applied in the customer's favour:
  //   sell_aud (customer sells AUD → receives IRT): rate increases → more IRT
  //   buy_aud  (customer buys  AUD → pays    IRT): rate decreases → less IRT paid
  let rateBonus: number;
  if (promo.discount_type === "percentage") {
    const pct = Math.min(Math.max(promo.discount_value, 0), 100) / 100;
    rateBonus = parseFloat((baseRate * pct).toFixed(2));
  } else {
    // fixed: discount_value is in IRT/AUD (e.g. 200 = 200 Toman per AUD better rate)
    rateBonus = promo.discount_value;
  }

  const effectiveRate = direction === "sell_aud"
    ? parseFloat((baseRate + rateBonus).toFixed(2))
    : parseFloat((Math.max(baseRate - rateBonus, 0)).toFixed(2));

  // discount_amount = total IRT benefit for this transaction (rateBonus × AUD amount)
  const discount_amount = parseFloat((rateBonus * baseAmountAud).toFixed(2));

  // AUD amount is unchanged — the benefit is entirely in the improved rate
  return { valid: true, discount_amount, final_amount: baseAmountAud, effectiveRate };
}