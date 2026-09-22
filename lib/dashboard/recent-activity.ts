import { getRequestJourney } from "@/lib/requests/journey";
import type { ExchangeRequest, RequestLocale } from "@/lib/requests/types";

export type ActivityTone = "complete" | "attention" | "failed" | "neutral" | "processing";
export type ActivityIcon = "check" | "clock" | "upload" | "message" | "error" | "transfer";

export function activityAppearance(request: ExchangeRequest): { tone: ActivityTone; icon: ActivityIcon } {
  const journey = getRequestJourney(request);
  if (["rejected", "expired"].includes(request.status)) return { tone: "failed", icon: "error" };
  if (journey.closed) return { tone: "neutral", icon: "clock" };
  if (["refund_pending", "refunded"].includes(request.funding_status) || (request.priority_fee_status === "refund_pending" && !journey.customerActionRequired)) {
    return { tone: "neutral", icon: "transfer" };
  }
  if (request.status === "completed") return { tone: "complete", icon: "check" };
  if (journey.customerActionRequired) return { tone: "attention", icon: "message" };
  if (journey.canPay && !journey.receiptSubmitted) return { tone: "attention", icon: "upload" };
  if (request.status === "processing" || request.status === "reconciliation" || request.status === "ready") {
    return { tone: "processing", icon: "transfer" };
  }
  return { tone: "neutral", icon: "clock" };
}

/** Last record update, not a fabricated payment-completion time. */
export function requestActivityTime(request: Pick<ExchangeRequest, "updated_at" | "created_at">): string | null {
  for (const candidate of [request.updated_at, request.created_at]) {
    if (candidate && Number.isFinite(Date.parse(candidate))) return candidate;
  }
  return null;
}

export function recentActivityRequests(requests: ExchangeRequest[], limit = 5): ExchangeRequest[] {
  const unique = new Map<string, ExchangeRequest>();
  const timestamp = (request: ExchangeRequest) => Date.parse(requestActivityTime(request) || "") || 0;
  for (const request of requests) {
    const previous = unique.get(request.id);
    if (!previous || timestamp(request) > timestamp(previous) || (timestamp(request) === timestamp(previous) && request.version > previous.version)) {
      unique.set(request.id, request);
    }
  }
  return [...unique.values()].sort((a, b) => timestamp(b) - timestamp(a) || a.id.localeCompare(b.id)).slice(0, Math.max(0, limit));
}

export function relativeActivityTime(value: string | null, locale: RequestLocale, now: number): string {
  const timestamp = value ? Date.parse(value) : NaN;
  if (!Number.isFinite(timestamp) || !Number.isFinite(now)) return "—";
  // A slight difference between the database clock and browser clock is still "now".
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return locale === "fa" ? "همین حالا" : "Just now";
  const formatter = new Intl.RelativeTimeFormat(locale === "fa" ? "fa-IR" : "en-AU", { numeric: "always" });
  for (const [unit, duration] of [["year", 31536000], ["month", 2592000], ["day", 86400], ["hour", 3600], ["minute", 60]] as const) {
    if (seconds >= duration) return formatter.format(-Math.floor(seconds / duration), unit);
  }
  return "—";
}
