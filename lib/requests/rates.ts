import type { QuoteSnapshot } from "./types";

export type ExchangeRates = {
  base: number | null;
  loyalty: number | null;
  applied: number | null;
  original?: boolean;
};

const positiveRate = (value: number | undefined) =>
  value !== undefined && Number.isFinite(value) && value > 0 ? value : null;

/** Derive display rates only from the saved quote, never from today's prices. */
export function quoteExchangeRates(quote: QuoteSnapshot): ExchangeRates {
  const base = positiveRate(quote.base_rate);
  const applied = positiveRate(quote.applied_rate);
  const discount = quote.loyalty_rate_discount;
  const direction = quote.customer_request_type === "buy_aud" ? -1 : quote.customer_request_type === "sell_aud" ? 1 : null;
  let loyalty: number | null = null;
  if (base !== null && discount !== undefined && Number.isFinite(discount) && discount >= 0 && direction !== null) {
    loyalty = positiveRate(Math.round((base + direction * discount) * 1_000_000) / 1_000_000);
  } else if (!quote.admin_adjusted && !quote.promo_code && !quote.discount_amount && !quote.promo_rate_discount) {
    // Older snapshots may only retain the applied rate. Do not invent a base rate
    // or derive a per-unit loyalty benefit from a rounded total saving.
    loyalty = applied;
  }
  return { base, loyalty, applied, original: quote.admin_adjusted };
}
