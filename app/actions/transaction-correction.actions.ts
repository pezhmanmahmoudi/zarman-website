"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/app/actions/admin.actions";
import { isMoney, isUuid } from "@/lib/requests/validation";
import { isRequestConflict } from "@/lib/requests/conflicts";
import type { ActionResult } from "@/lib/requests/types";
import type { CompletedTransactionCorrection, CorrectCompletedTransactionInput } from "@/lib/transaction-corrections";

function database() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Transaction service is unavailable.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function failure(error: unknown): Extract<ActionResult<never>, { error: string }> {
  if (isRequestConflict(error)) return { error: "This transfer has changed. Reload its amounts before saving.", code: "REQUEST_CONFLICT", retryable: false };
  const value = error as { code?: string; message?: string } | null;
  if (["PGRST202", "PGRST205", "42P01", "42883"].includes(value?.code ?? "")) {
    return { error: "Amount corrections are not enabled yet. Apply the database update before trying again." };
  }
  if (value?.code === "42501") return { error: "You do not have permission to correct this transfer." };
  if (value?.code === "P0001" || error instanceof Error && !value?.code) return { error: value?.message || "The correction could not be saved." };
  return { error: "The correction was not confirmed. Retry the same values or reload the transfer." };
}

export async function getCompletedTransactionCorrection(transactionId: string): Promise<ActionResult<CompletedTransactionCorrection>> {
  try {
    const admin = await requireAdmin();
    if (!isUuid(transactionId)) throw new Error("Transaction not found.");
    const response = await database().rpc("get_completed_transaction_correction", { p_actor_id: admin.id, p_transaction_id: transactionId });
    if (response.error) throw response.error;
    return { data: response.data as CompletedTransactionCorrection };
  } catch (error) { return failure(error); }
}

export async function correctCompletedTransactionAmounts(input: CorrectCompletedTransactionInput): Promise<ActionResult<{ transactionId: string; requestId: string | null }>> {
  try {
    const admin = await requireAdmin();
    if (!input || !isUuid(input.transactionId) || !isUuid(input.commandKey) || !/^[a-f0-9]{32}$/.test(input.revision)
      || !isMoney(input.fundingTotal) || !isMoney(input.recipientAmount)
      || typeof input.reason !== "string" || input.reason.trim().length < 3 || input.reason.trim().length > 1000
      || !Array.isArray(input.payments) || input.payments.length > 100
      || input.payments.some(payment => !payment || !isUuid(payment.id) || payment.amount !== 0 && !isMoney(payment.amount))) {
      throw new Error("Enter valid amounts and a reason for the correction.");
    }
    const response = await database().rpc("correct_completed_transaction_amounts", {
      p_actor_id: admin.id, p_transaction_id: input.transactionId, p_revision: input.revision,
      p_command_key: input.commandKey, p_funding_total: input.fundingTotal, p_recipient_amount: input.recipientAmount,
      p_reason: input.reason.trim(), p_payments: input.payments,
    });
    if (response.error) throw response.error;
    // Reports, treasury, customer history and fresh receipt downloads all read
    // the committed rows. Invalidate both server route trees after the commit.
    revalidatePath("/admin", "layout");
    revalidatePath("/[locale]/dashboard", "layout");
    return { data: response.data as { transactionId: string; requestId: string | null } };
  } catch (error) { return failure(error); }
}
