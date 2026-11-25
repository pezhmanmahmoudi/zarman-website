import { formatLocalizedNumber } from "@/lib/numbers";
import type { FinanceConfig } from "@/lib/pricing";

/**
 * Articles quote the current fee rule with {{feeThreshold}} and {{appliedFee}}
 * placeholders so published copy cannot drift from the live pricing settings.
 */
export function fillLiveValues(content: string, locale: string, config: FinanceConfig): string {
  const values: Record<string, number> = {
    feeThreshold: config.fee_threshold,
    appliedFee: config.applied_fee,
  };
  return content.replace(/\{\{(feeThreshold|appliedFee)\}\}/g, (_, key: string) =>
    formatLocalizedNumber(values[key], locale, { maximumFractionDigits: 2 }));
}

export function hasLiveValues(content: string): boolean {
  return /\{\{(feeThreshold|appliedFee)\}\}/.test(content);
}
