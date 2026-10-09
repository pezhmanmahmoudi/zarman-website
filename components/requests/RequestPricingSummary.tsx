import { ArrowRight } from "lucide-react";
import type { ExchangeRequest } from "@/lib/requests/types";
import { requestMoney } from "./request-labels";
import { RequestPricingDetails } from "./RequestPricingDetails";
import workspace from "@/styles/requests/RequestWorkspace.module.css";

export function RequestPricingSummary({ request }: { request: ExchangeRequest }) {
  return <>
    <div className={workspace.summaryFlow}>
      <div><span>Customer pays</span><strong><bdi>{requestMoney(request.quote.funding_total, request.quote.funding_currency, "en")}</bdi></strong></div>
      <ArrowRight size={18} aria-hidden="true" className={workspace.summaryArrow}/>
      <div><span>Recipient gets</span><strong><bdi>{requestMoney(request.quote.recipient_amount, request.quote.recipient_currency, "en")}</bdi></strong></div>
    </div>
    <RequestPricingDetails request={request}/>
  </>;
}
