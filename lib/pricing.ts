export type TransactionType = "buy_aud" | "sell_aud";

/**
 * Single source of truth for pricing/loyalty/fee policy across client + server.
 */
export const PRICING_CONFIG = {
  DISCOUNT_STEP_VOLUME: 1000,
  DISCOUNT_PERCENT_PER_STEP: 0.005,
  MAX_DISCOUNT_PERCENT: 0.5,
  FEE_THRESHOLD: 1000,
  APPLIED_FEE: 15,
} as const;

export function getDiscountPercentByVolume(approvedVolume: number) {
  if (!Number.isFinite(approvedVolume) || approvedVolume <= 0) return 0;

  const volumeSteps = Math.floor(approvedVolume / PRICING_CONFIG.DISCOUNT_STEP_VOLUME);
  const rawDiscountPercent = volumeSteps * PRICING_CONFIG.DISCOUNT_PERCENT_PER_STEP;
  return Math.min(rawDiscountPercent, PRICING_CONFIG.MAX_DISCOUNT_PERCENT);
}

export function getLoyaltyBonusByVolume(spread: number, approvedVolume: number) {
  if (!Number.isFinite(spread) || spread <= 0) return 0;
  const discountPercent = getDiscountPercentByVolume(approvedVolume);
  return spread * discountPercent;
}

export function getAppliedFee(rawAmount: number) {
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) return 0;
  return rawAmount < PRICING_CONFIG.FEE_THRESHOLD ? PRICING_CONFIG.APPLIED_FEE : 0;
}

export function getTailoredRate(params: {
  txType: TransactionType;
  baseRate: number;
  loyaltyBonus: number;
}) {
  const { txType, baseRate, loyaltyBonus } = params;
  return txType === "buy_aud" ? baseRate - loyaltyBonus : baseRate + loyaltyBonus;
}