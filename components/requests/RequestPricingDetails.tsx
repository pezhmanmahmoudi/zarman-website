import type { ExchangeRequest } from "@/lib/requests/types";
import { requestMoney, requestRate } from "./request-labels";
import styles from "@/styles/requests/RequestPricing.module.css";

export function RequestPricingDetails({ request }: { request: ExchangeRequest }) {
  const quote = request.quote;
  const benefits = quote.admin_adjusted ? request.original_quote ?? quote : quote;
  return <aside className={styles.details} aria-label="Transaction pricing">
    <dl>
      <div><dt>Exchange rate</dt><dd>1 AUD = <bdi>{requestRate(quote.applied_rate, "en")}</bdi></dd></div>
      {Number(benefits.loyalty_discount) > 0 && <div><dt>{quote.admin_adjusted ? "Original loyalty savings" : "Loyalty savings · included"}</dt><dd><bdi>{requestMoney(benefits.loyalty_discount, "IRT", "en")}</bdi></dd></div>}
      {benefits.promo_code && <div><dt>{quote.admin_adjusted ? "Original promo" : "Promo · included"} <bdi className={styles.code}>{benefits.promo_code}</bdi></dt><dd><bdi>{requestMoney(benefits.discount_amount, "IRT", "en")}</bdi></dd></div>}
      {quote.base_fee_aud > 0 && <div><dt>Transfer fee · included</dt><dd>{requestMoney(quote.base_fee_aud, "AUD", "en")}</dd></div>}
      {!!quote.rounding_adjustment_toman && <div><dt>Currency rounding</dt><dd>{requestMoney(quote.rounding_adjustment_toman, "IRT", "en")}</dd></div>}
    </dl>
    {quote.admin_adjusted && <span className={styles.caption}>Admin adjusted · original quote retained</span>}
    {request.pricing_pending_acceptance && ["submitted", "under_review", "action_required", "awaiting_funds"].includes(request.status) && <span className={styles.caption}>Awaiting customer acceptance of revised amounts</span>}
  </aside>;
}
