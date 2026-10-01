import { getRequestJourney } from "./requests/journey";
import type { ExchangeRequest } from "./requests/types";

export type TransactionQueueStage = "review" | "funding" | "ready" | "waiting" | "refund" | "closed";
export type RequestLinkedTransaction = { request?: ExchangeRequest | ExchangeRequest[] | null; status: string | null };

export function transactionRequest(row: RequestLinkedTransaction): ExchangeRequest | null {
  return Array.isArray(row.request) ? row.request[0] ?? null : row.request ?? null;
}

export function transactionRequestHref(requestId: string): string {
  return `/admin/transactions/requests/${encodeURIComponent(requestId)}`;
}

/** Use request milestones rather than the accounting record's coarse pending status. */
export function transactionQueueState(row: RequestLinkedTransaction): { stage: TransactionQueueStage; label: string; next: string } {
  const request = transactionRequest(row);
  if (!request) return row.status === "pending"
    ? { stage: "review", label: "Awaiting approval", next: "Review transaction" }
    : { stage: "closed", label: row.status === "approved" ? "Approved" : row.status === "archived" ? "Archived" : "Rejected", next: "View record" };

  if (request.funding_status === "refund_pending" || request.priority_fee_status === "refund_pending") {
    return { stage: "refund", label: "Refund required", next: "Confirm refund" };
  }
  const journey = getRequestJourney(request);
  if (request.status === "completed") return { stage: "closed", label: "Completed", next: "View transfer" };
  if (journey.closed) return { stage: "closed", label: request.status === "expired" ? "Expired" : request.status === "cancelled" ? "Cancelled" : "Rejected", next: "View transfer" };
  if (journey.customerActionRequired) return { stage: "waiting", label: "Waiting for customer", next: "View conversation" };
  if (journey.fundsReceived) return journey.readyForSettlement || ["processing", "reconciliation"].includes(request.status)
    ? { stage: "ready", label: request.status === "reconciliation" ? "Settlement under review" : request.status === "processing" ? "Settlement in progress" : "Funds received", next: "Reconcile & complete" }
    : { stage: "review", label: "Funds received · on hold", next: "Review funds" };
  if (request.action_required) return { stage: "review", label: "Admin review needed", next: "Review request" };
  if (!journey.approved) return { stage: "review", label: "Awaiting approval", next: "Approve request" };
  if (journey.receiptSubmitted) return { stage: "funding", label: request.funding_status === "partial" ? "Part payment received" : "Payment to verify", next: "Verify bank payment" };
  if (["submitted", "under_review"].includes(request.status)) return { stage: "review", label: "Payment paused", next: "Resume payment" };
  return { stage: "waiting", label: "Awaiting customer payment", next: "View transfer" };
}

export function matchesTransactionSearch(row: {
  id: string; reference_code?: string | null;
  profiles?: { first_name?: string | null; last_name?: string | null; email?: string | null; customer_code?: string | null } | null;
  recipients?: { full_name?: string | null; account_name?: string | null; label?: string | null } | null;
} & RequestLinkedTransaction, search: string): boolean {
  const request = transactionRequest(row);
  const profile = row.profiles;
  const recipient = row.recipients;
  const text = [row.id, row.reference_code, request?.reference_code, profile?.first_name, profile?.last_name,
    profile?.email, profile?.customer_code, recipient?.full_name, recipient?.account_name, recipient?.label,
    request?.quote.sender_snapshot.name, request?.quote.sender_snapshot.email].filter(Boolean).join(" ").toLocaleLowerCase("en");
  return text.includes(search.trim().toLocaleLowerCase("en"));
}

export function sortTransactionQueue<T extends { id: string; created_at: string } & RequestLinkedTransaction>(rows: T[]): T[] {
  const due = (row: T) => {
    const at = transactionRequest(row)?.handling_due_at;
    return at ? new Date(at).getTime() : Number.POSITIVE_INFINITY;
  };
  return [...rows].sort((a, b) => (due(a) - due(b) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime() || a.id.localeCompare(b.id)));
}
