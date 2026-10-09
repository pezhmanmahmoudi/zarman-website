import { formatLocalizedNumber } from "@/lib/numbers";

export { normaliseAmountDigits, localiseAmountDraft } from "@/lib/numbers";

/** Localised display only. Financial values and bank identifiers stay unchanged. */
export function dashboardNumber(value: number, locale: string, maximumFractionDigits = 0) {
  return formatLocalizedNumber(value, locale, { maximumFractionDigits });
}
