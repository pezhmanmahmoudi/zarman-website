import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { deliverAdminAlert } from "@/lib/admin-security/alerts";
import {
  buildChangeLines, BANK_CHANGE_HOLD_HOURS, type BankChangeLine, type BankProtectedValues, type PendingBankChangeView,
} from "@/lib/admin-security/bank-protected";

export * from "@/lib/admin-security/bank-protected";

const STEP_UP_WINDOW_MS = 15 * 60_000;
const STEP_UP_MAX_FAILURES = 5;

/**
 * Step-up authentication: the admin must prove they know the password right now, not just hold a session.
 * Uses a throw-away client so the admin's own session cookies are untouched, and throttles guessing.
 */
export async function verifyAdminPassword(db: SupabaseClient, admin: { id: string; email?: string | null }, password: unknown) {
  if (typeof password !== "string" || !password || password.length > 256 || !admin.email) throw new Error("Re-enter your password to continue.");
  const since = new Date(Date.now() - STEP_UP_WINDOW_MS).toISOString();
  const failures = await db.from("admin_stepup_attempts").select("id", { count: "exact", head: true })
    .eq("user_id", admin.id).eq("success", false).gte("created_at", since);
  if (!failures.error && (failures.count ?? 0) >= STEP_UP_MAX_FAILURES) throw new Error("Too many incorrect password attempts. Wait 15 minutes and try again.");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Authentication is not configured.");
  const probe = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data, error } = await probe.auth.signInWithPassword({ email: admin.email, password });
  await db.from("admin_stepup_attempts").insert({ user_id: admin.id, success: !error && data.user?.id === admin.id });
  if (error || data.user?.id !== admin.id) throw new Error("That password is incorrect.");
  await probe.auth.signOut({ scope: "local" }).catch(() => undefined);
}

// ── Alerts ──────────────────────────────────────────────────────────────

export type BankAlert = {
  kind: "requested" | "applied" | "cancelled";
  actorEmail: string;
  ip?: string | null;
  effectiveAfter?: string | null;
  changes: BankChangeLine[];
};

const escapeHtml = (value: string) => value.replace(/[&<>"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!);
const when = (iso?: string | null) => iso ? new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Australia/Sydney" }).format(new Date(iso)) + " (Sydney)" : "";

function headline(alert: BankAlert) {
  if (alert.kind === "requested") return "Bank details change REQUESTED";
  if (alert.kind === "applied") return "Bank details change APPLIED";
  return "Bank details change CANCELLED";
}

function summary(alert: BankAlert) {
  const intro = alert.kind === "requested"
    ? `${alert.actorEmail} asked to change the payment details customers see. It is NOT live yet${alert.effectiveAfter ? `: another admin can approve it now, or ${alert.actorEmail} can confirm it after ${when(alert.effectiveAfter)}` : ""}.`
    : alert.kind === "applied" ? `${alert.actorEmail} approved the change. Customers now see the new details.`
    : `${alert.actorEmail} cancelled the pending change. Nothing was changed.`;
  return { intro, action: alert.kind === "requested" ? "If this was not you or a colleague, open Settings → Transfer service → Bank details and CANCEL it now, then change your passwords." : "" };
}

function siteUrl() { return (process.env.REQUEST_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, ""); }

export function telegramBankAlert(alert: BankAlert) {
  const { intro, action } = summary(alert);
  const lines = alert.changes.flatMap(change => [`<b>${escapeHtml(change.label)}</b>`, `Before: ${escapeHtml(change.before.join(" · "))}`, `After:  ${escapeHtml(change.after.join(" · "))}`, ""]);
  const link = siteUrl() ? `\n<a href="${escapeHtml(siteUrl())}/admin/settings">Open settings</a>` : "";
  return [`🚨 <b>${headline(alert)}</b>`, "", escapeHtml(intro), ...(alert.ip ? [`IP: ${escapeHtml(alert.ip)}`] : []), "", ...lines, ...(action ? [escapeHtml(action)] : []), link].join("\n");
}

export function emailBankAlert(alert: BankAlert) {
  const { intro, action } = summary(alert);
  const rows = alert.changes.map(change => `<tr><td style="padding:8px;border:1px solid #e3e8f0;vertical-align:top"><strong>${escapeHtml(change.label)}</strong></td>`
    + `<td style="padding:8px;border:1px solid #e3e8f0;vertical-align:top;color:#8a2430">${change.before.map(escapeHtml).join("<br>")}</td>`
    + `<td style="padding:8px;border:1px solid #e3e8f0;vertical-align:top;color:#0b6b4f">${change.after.map(escapeHtml).join("<br>")}</td></tr>`).join("");
  const link = siteUrl() ? `<p><a href="${escapeHtml(siteUrl())}/admin/settings">Open admin settings</a></p>` : "";
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#172238"><h2 style="margin:0 0 12px">${headline(alert)}</h2><p>${escapeHtml(intro)}</p>`
    + (alert.ip ? `<p style="color:#526078">IP address: ${escapeHtml(alert.ip)}</p>` : "")
    + `<table style="border-collapse:collapse;width:100%;max-width:640px"><tr><th style="padding:8px;border:1px solid #e3e8f0;text-align:left">Field</th><th style="padding:8px;border:1px solid #e3e8f0;text-align:left">Before</th><th style="padding:8px;border:1px solid #e3e8f0;text-align:left">After</th></tr>${rows}</table>`
    + (action ? `<p style="color:#8a2430"><strong>${escapeHtml(action)}</strong></p>` : "") + link + `</div>`;
  const text = [headline(alert), "", intro, alert.ip ? `IP address: ${alert.ip}` : "", ...alert.changes.flatMap(c => [`${c.label}`, `  Before: ${c.before.join(" · ")}`, `  After:  ${c.after.join(" · ")}`]), action].filter(Boolean).join("\n");
  return { subject: `[Security] ${headline(alert)}`, html, text };
}

/** Tell every admin through two independent channels; see deliverAdminAlert for the failure policy. */
export async function notifyAdminsOfBankChange(db: SupabaseClient, alert: BankAlert) {
  const message = emailBankAlert(alert);
  await deliverAdminAlert(db, { ...message, telegramHtml: telegramBankAlert(alert) });
}

// ── Persistence ─────────────────────────────────────────────────────────

type PendingRow = {
  id: string; requested_by: string; requested_by_email: string | null; requested_at: string; effective_after: string;
  payload: BankProtectedValues; previous: BankProtectedValues; status: string;
};

/** Records the request, replacing any older one that was still waiting. Returns the new row. */
export async function createPendingBankChange(db: SupabaseClient, input: {
  admin: { id: string; email?: string | null }; previous: BankProtectedValues; payload: BankProtectedValues; ip?: string | null;
}) {
  const superseded = await db.from("pending_bank_changes").update({
    status: "cancelled", resolved_by: input.admin.id, resolved_by_email: input.admin.email ?? null, resolved_at: new Date().toISOString(), resolution_note: "superseded by a newer request",
  }).eq("status", "pending");
  if (superseded.error) throw superseded.error;
  const effectiveAfter = new Date(Date.now() + BANK_CHANGE_HOLD_HOURS * 3_600_000).toISOString();
  const inserted = await db.from("pending_bank_changes").insert({
    requested_by: input.admin.id, requested_by_email: input.admin.email ?? null, effective_after: effectiveAfter,
    payload: input.payload, previous: input.previous, request_ip: input.ip ?? null,
  }).select("*").single();
  if (inserted.error) throw inserted.error;
  return inserted.data as PendingRow;
}

export async function loadPendingBankChange(db: SupabaseClient, adminId: string): Promise<PendingBankChangeView | null> {
  const { data, error } = await db.from("pending_bank_changes").select("*").eq("status", "pending").maybeSingle();
  if (error) {
    // Table not created yet: behave as "nothing pending" so the settings page still loads.
    if (error.code === "42P01" || error.code === "PGRST205") return null;
    throw error;
  }
  if (!data) return null;
  const row = data as PendingRow;
  const isRequester = row.requested_by === adminId;
  return {
    id: row.id, requestedByEmail: row.requested_by_email ?? "an administrator", requestedAt: row.requested_at, effectiveAfter: row.effective_after,
    isRequester, canApplyNow: !isRequester || new Date(row.effective_after).getTime() <= Date.now(),
    changes: buildChangeLines(row.previous, row.payload),
  };
}

export async function pendingBankChangeRow(db: SupabaseClient, id: string) {
  const { data, error } = await db.from("pending_bank_changes").select("*").eq("id", id).eq("status", "pending").maybeSingle();
  if (error) throw error;
  return data as PendingRow | null;
}
