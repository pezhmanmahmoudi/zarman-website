// DB-facing helpers backing the AUSTRAC compliance dashboard. Plain
// (non-"use server") module so both the admin server actions and the IFTI
// export Route Handlers can share the exact same queue/batch logic — the
// caller is responsible for admin authorization before calling any of these.
import {
  calcAustracDueDate,
  calcBusinessDaysRemaining,
  classifyAustracUrgency,
  type AustracUrgency,
} from "@/lib/reporting/austrac-deadlines";

// Callers each construct their own service-role client locally (consistent
// with the rest of this codebase), and each resolves to a slightly different
// SupabaseClient generic instantiation — so this is intentionally loose.
type ServiceClient = any;

export type AustracReportType = "outgoing" | "incoming";

// outgoing = AUD leaves Australia (buy_aud) · incoming = AUD enters Australia (sell_aud).
export const AUSTRAC_TRANSACTION_TYPE: Record<AustracReportType, "buy_aud" | "sell_aud"> = {
  outgoing: "buy_aud",
  incoming: "sell_aud",
};

export type AustracPendingTransaction = {
  id: string;
  referenceCode: string | null;
  customerName: string;
  amountAud: number;
  approvedAt: string;
  dueDate: string;
  daysRemaining: number;
  urgency: AustracUrgency;
};

export type AustracReportBatchSummary = {
  id: string;
  reportType: AustracReportType;
  transactionCount: number;
  periodStart: string | null;
  periodEnd: string | null;
  fileName: string | null;
  submittedByEmail: string | null;
  createdAt: string;
  revertedAt: string | null;
};

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function getAustracPendingQueue(
  db: ServiceClient,
  reportType: AustracReportType,
  nowIso?: string,
): Promise<AustracPendingTransaction[]> {
  const { data, error } = await db
    .from("transactions")
    .select("id, reference_code, amount_aud, approved_at, created_at, profiles(first_name, last_name)")
    .eq("status", "approved")
    .eq("type", AUSTRAC_TRANSACTION_TYPE[reportType])
    .is("austrac_reported_at", null)
    .order("approved_at", { ascending: true });

  if (error) throw new Error(error.message);

  return ((data ?? []) as any[]).map((row) => {
    const referenceDate: string = row.approved_at ?? row.created_at;
    const dueDate = calcAustracDueDate(referenceDate);
    const daysRemaining = calcBusinessDaysRemaining(dueDate, nowIso);
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const customerName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() || "Unknown customer";
    return {
      id: String(row.id),
      referenceCode: row.reference_code ?? null,
      customerName,
      amountAud: toNumber(row.amount_aud),
      approvedAt: referenceDate,
      dueDate,
      daysRemaining,
      urgency: classifyAustracUrgency(daysRemaining),
    };
  });
}

const BATCH_COLUMNS = "id, report_type, transaction_count, period_start, period_end, file_name, submitted_by_email, created_at, reverted_at";

function mapBatchRow(row: any): AustracReportBatchSummary {
  return {
    id: String(row.id),
    reportType: row.report_type,
    transactionCount: toNumber(row.transaction_count),
    periodStart: row.period_start,
    periodEnd: row.period_end,
    fileName: row.file_name,
    submittedByEmail: row.submitted_by_email,
    createdAt: row.created_at,
    revertedAt: row.reverted_at,
  };
}

export async function getLatestAustracBatch(
  db: ServiceClient,
  reportType: AustracReportType,
): Promise<AustracReportBatchSummary | null> {
  const { data, error } = await db
    .from("austrac_report_batches")
    .select(BATCH_COLUMNS)
    .eq("report_type", reportType)
    .is("reverted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapBatchRow(data) : null;
}

export async function getRecentAustracBatches(db: ServiceClient, limit = 15): Promise<AustracReportBatchSummary[]> {
  const { data, error } = await db
    .from("austrac_report_batches")
    .select(BATCH_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map(mapBatchRow);
}

export async function recordAustracReportBatch(
  db: ServiceClient,
  args: {
    reportType: AustracReportType;
    transactionIds: string[];
    referenceDates: Array<string | null | undefined>;
    fileName: string;
    submittedById: string | null;
    submittedByEmail: string | null;
  },
): Promise<{ batchId: string; updatedCount: number }> {
  const sortedDates = args.referenceDates
    .map((value) => value?.slice(0, 10))
    .filter((value): value is string => Boolean(value))
    .sort();

  const { data: batch, error: insertError } = await db
    .from("austrac_report_batches")
    .insert({
      report_type: args.reportType,
      transaction_count: args.transactionIds.length,
      period_start: sortedDates[0] ?? null,
      period_end: sortedDates[sortedDates.length - 1] ?? null,
      file_name: args.fileName,
      submitted_by: args.submittedById,
      submitted_by_email: args.submittedByEmail,
    })
    .select("id")
    .single();

  if (insertError || !batch) throw new Error(insertError?.message ?? "Failed to record AUSTRAC report batch.");

  // Only stamp transactions not already marked reported, so re-including an
  // already-reported row (e.g. reprinting a copy) keeps its original batch.
  const { data: updated, error: updateError } = await db
    .from("transactions")
    .update({ austrac_reported_at: new Date().toISOString(), austrac_report_batch_id: (batch as any).id })
    .in("id", args.transactionIds)
    .is("austrac_reported_at", null)
    .select("id");

  if (updateError) throw new Error(updateError.message);

  return { batchId: String((batch as any).id), updatedCount: updated?.length ?? 0 };
}

export async function revertAustracReportBatch(
  db: ServiceClient,
  batchId: string,
  revertedByEmail: string,
): Promise<void> {
  const { error: transactionsError } = await db
    .from("transactions")
    .update({ austrac_reported_at: null, austrac_report_batch_id: null })
    .eq("austrac_report_batch_id", batchId);
  if (transactionsError) throw new Error(transactionsError.message);

  const { error: batchError } = await db
    .from("austrac_report_batches")
    .update({ reverted_at: new Date().toISOString(), reverted_by_email: revertedByEmail })
    .eq("id", batchId)
    .is("reverted_at", null);
  if (batchError) throw new Error(batchError.message);
}
