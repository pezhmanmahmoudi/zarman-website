import { getRequestJourney } from "@/lib/requests/journey";
import type { ExchangeRequest } from "@/lib/requests/types";

export type ActivityFilter = "all" | "active" | "attention" | "completed";
export function requestNeedsAttention(request: ExchangeRequest): boolean {
  const journey = getRequestJourney(request);
  return !journey.closed && request.status !== "completed" &&
    (journey.customerActionRequired || (journey.canPay && !journey.receiptSubmitted));
}
export function filterDashboardRequests(requests: ExchangeRequest[], filter: ActivityFilter, search: string) {
  const term = search.trim().toLocaleLowerCase();
  return requests.filter(request => {
    const journey = getRequestJourney(request);
    if (filter === "attention" && !requestNeedsAttention(request)) return false;
    if (filter === "active" && (journey.closed || request.status === "completed")) return false;
    if (filter === "completed" && request.status !== "completed") return false;
    const recipient = request.quote.recipient_snapshot;
    return [request.reference_code, recipient.full_name, recipient.account_name, recipient.label, request.quote.institution_name]
      .some(value => typeof value === "string" && value.toLocaleLowerCase().includes(term));
  }).sort((a,b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}
