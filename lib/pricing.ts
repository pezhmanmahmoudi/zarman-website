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