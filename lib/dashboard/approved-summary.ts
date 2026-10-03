import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/app/[locale]/dashboard/dashboard.types";

export type ApprovedSummary = { volume: number; count: number };
export type DashboardInitialAccount = { profile: Profile; approved: ApprovedSummary };

const SUMMARY_BATCH = 1000;

/** Fallback used until the summary function exists in the database. */
async function sumApprovedRows(client: SupabaseClient, userId: string, signal?: AbortSignal): Promise<ApprovedSummary> {
  let volume = 0, count = 0;
  for (let from = 0; ; from += SUMMARY_BATCH) {
    let query = client.from("transactions").select("amount_aud").eq("user_id", userId).eq("status", "approved")
      .order("id", { ascending: true }).range(from, from + SUMMARY_BATCH - 1);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    for (const row of data ?? []) volume += Number(row.amount_aud) || 0;
    count += data?.length ?? 0;
    if ((data?.length ?? 0) < SUMMARY_BATCH) return { volume, count };
  }
}

/** Approved volume and count for the signed-in customer, aggregated in the database. */
export async function readApprovedSummary(client: SupabaseClient, userId: string, signal?: AbortSignal): Promise<ApprovedSummary> {
  let query = client.rpc("my_approved_transaction_summary");
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query.single<{ volume: number | string | null; approved_count: number | string | null }>();
  if (error) {
    if (signal?.aborted) throw error;
    return sumApprovedRows(client, userId, signal);
  }
  return { volume: Number(data?.volume) || 0, count: Number(data?.approved_count) || 0 };
}
