"use server";

import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { requireAdmin } from "@/app/actions/admin.actions";
import {
  buildChangeLines, loadPendingBankChange, notifyAdminsOfBankChange, pendingBankChangeRow, verifyAdminPassword,
  type PendingBankChangeView,
} from "@/lib/admin-security/bank-change";
import type { ActionResult } from "@/lib/requests/types";

function database() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Service is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function clientIp() {
  const list = await headers();
  return list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip") || null;
}

function friendly(error: unknown): string {
  const message = error instanceof Error ? error.message : (error as { message?: string } | null)?.message || "";
  if (message.includes("BANK_CHANGE_HOLD")) return "You requested this change yourself, so it can only be confirmed after the hold period. Another admin can approve it now.";
  if (message.includes("BANK_CHANGE_NOT_PENDING")) return "This change is no longer waiting. Refresh the page.";
  if (message.includes("apply_pending_bank_change") || message.includes("pending_bank_changes")) return "Bank-change approvals are not set up yet. Apply migration 20261031_67_bank_change_approvals first.";
  return message || "The change could not be processed.";
}

/** The single change (if any) waiting for approval, shaped for the signed-in admin. */
export async function getPendingBankChange(): Promise<ActionResult<PendingBankChangeView | null>> {
  try {
    const admin = await requireAdmin();
    return { data: await loadPendingBankChange(database(), admin.id) };
  } catch (error) { return { error: friendly(error) }; }
}

/**
 * Approve (apply) or cancel the pending change. Applying needs the admin's password again.
 * The database decides whether this admin may apply it yet (a different admin: always; the requester: after the hold).
 */
export async function resolveBankChange(input: { id: string; decision: "apply" | "cancel"; password?: string }): Promise<ActionResult<{ applied: boolean }>> {
  try {
    const admin = await requireAdmin();
    const db = database();
    if (!input || typeof input.id !== "string" || !["apply", "cancel"].includes(input.decision)) return { error: "Invalid request." };
    const row = await pendingBankChangeRow(db, input.id);
    if (!row) return { error: "This change is no longer waiting. Refresh the page." };
    const changes = buildChangeLines(row.previous, row.payload);
    const ip = await clientIp();

    if (input.decision === "cancel") {
      const { error } = await db.from("pending_bank_changes").update({
        status: "cancelled", resolved_by: admin.id, resolved_by_email: admin.email ?? null, resolved_at: new Date().toISOString(), resolution_note: "cancelled by an administrator",
      }).eq("id", row.id).eq("status", "pending");
      if (error) throw error;
      await db.from("audit_logs").insert({ actor_id: admin.id, actor_email: admin.email ?? "", action: "BANK_DETAILS_CHANGE_CANCELLED", target_type: "exchange_request_settings", target_id: row.id, new_value: { requested_by: row.requested_by_email } });
      await notifyAdminsOfBankChange(db, { kind: "cancelled", actorEmail: admin.email ?? "an administrator", ip, changes });
      return { data: { applied: false } };
    }

    await verifyAdminPassword(db, admin, input.password);
    const { error } = await db.rpc("apply_pending_bank_change", { p_change_id: row.id, p_actor_id: admin.id });
    if (error) throw error;
    await notifyAdminsOfBankChange(db, { kind: "applied", actorEmail: admin.email ?? "an administrator", ip, changes });
    return { data: { applied: true } };
  } catch (error) { return { error: friendly(error) }; }
}
