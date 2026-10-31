// Browser-side reader for /api/admin/compliance/view (see the route for why it is not a server action).

import type { CustomerComplianceView, RequestComplianceView } from "@/lib/compliance/types";
import type { RecipientCompliance } from "@/lib/compliance/request-compliance";

type Result<T> = { data?: T; error?: string };

async function read<T>(query: Record<string, string>, signal?: AbortSignal): Promise<Result<T>> {
  const response = await fetch(`/api/admin/compliance/view?${new URLSearchParams(query)}`, { cache: "no-store", signal });
  const body = (await response.json().catch(() => null)) as Result<T> | null;
  if (body?.error || body?.data) return body;
  return { error: `The compliance status could not be loaded (HTTP ${response.status}).` };
}

export const fetchRequestCompliance = (id: string, signal?: AbortSignal) => read<RequestComplianceView>({ kind: "request", id }, signal);
export const fetchCustomerCompliance = (id: string, signal?: AbortSignal) => read<CustomerComplianceView>({ kind: "customer", id }, signal);
export const fetchRecipientsCompliance = (id: string, run: boolean, signal?: AbortSignal) => read<RecipientCompliance[]>({ kind: "recipients", id, run: run ? "1" : "0" }, signal);
