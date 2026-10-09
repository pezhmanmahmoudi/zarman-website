import type { FinanceConfig } from "@/lib/pricing";

/** Presentation of the existing volume-based rewards; never changes quoted rates. */
export function loyaltyJourney(volume: number, config: FinanceConfig) {
  const stepVolume = config.discount_step_volume > 0 ? config.discount_step_volume : 1000;
  const increment = config.discount_percent_per_step;
  const ratio = increment > 0 ? config.max_discount_percent / increment : 0;
  // A partial final increment still earns the cap. Avoid an extra level caused
  // only by floating-point division (for example, 0.14 / 0.02).
  const totalLevels = Number.isFinite(ratio) && ratio > 0
    ? Math.ceil(ratio - Number.EPSILON * Math.max(1, ratio) * 4) : 0;
  const approvedVolume = Number.isFinite(volume) ? Math.max(0, volume) : 0;
  const level = Math.min(Math.floor(approvedVolume / stepVolume), totalLevels);
  const maxed = totalLevels > 0 && level >= totalLevels;
  return {
    level, totalLevels, maxed, stepVolume, approvedVolume,
    progress: totalLevels > 0 ? Math.min(100, approvedVolume / (totalLevels * stepVolume) * 100) : 0,
    remaining: totalLevels > 0 && !maxed ? Math.max(0, (level + 1) * stepVolume - approvedVolume) : 0,
  };
}
