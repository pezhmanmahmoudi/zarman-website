import type { SupabaseClient } from "@supabase/supabase-js";
import { sendTelegramAdminMessage } from "@/lib/notifications/telegram";

export const escapeHtml = (value: string) => value.replace(/[&<>"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!);

export function siteUrl() { return (process.env.REQUEST_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, ""); }

/** Every administrator's address, taken from their accounts (not from editable settings). */
async function adminEmails(db: SupabaseClient): Promise<string[]> {
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  return data.users.filter(user => user.app_metadata?.role === "admin" && user.email).map(user => user.email!);
}

/**
 * Tell every admin through two independent channels (Telegram and email). Delivery problems are logged
 * and never block the action that triggered the alert: the alert is a tripwire, not a gate.
 */
export async function deliverAdminAlert(db: SupabaseClient, message: { subject: string; html: string; text: string; telegramHtml: string }) {
  const sends: Promise<unknown>[] = [sendTelegramAdminMessage(message.telegramHtml)];
  sends.push((async () => {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not set");
    const to = await adminEmails(db);
    if (!to.length) throw new Error("no admin email addresses found");
    const { Resend } = await import("resend");
    const response = await new Resend(key).emails.send({ from: "Zarman Exchange <info@zarman.com.au>", to, subject: message.subject, html: message.html, text: message.text });
    if (response.error) throw new Error(response.error.message);
  })());
  const results = await Promise.allSettled(sends);
  results.forEach((outcome, index) => {
    if (outcome.status === "rejected") console.error(`[admin alert] ${index === 0 ? "telegram" : "email"} failed:`, outcome.reason instanceof Error ? outcome.reason.message : "unknown error");
  });
}

export type SecurityEvent = {
  headline: string;
  intro: string;
  /** One line each: "Field: before → after". */
  details?: string[];
  /** What the reader should do if the action was not expected. */
  action?: string;
  ip?: string | null;
};

/** A generic "something sensitive just happened" alert (rates, promo codes, payout details, ...). */
export async function notifyAdminsOfSecurityEvent(db: SupabaseClient, event: SecurityEvent) {
  const details = event.details ?? [];
  const link = siteUrl();
  const telegramHtml = [`🚨 <b>${escapeHtml(event.headline)}</b>`, "", escapeHtml(event.intro), ...(event.ip ? [`IP: ${escapeHtml(event.ip)}`] : []),
    ...(details.length ? ["", ...details.map(escapeHtml)] : []), ...(event.action ? ["", escapeHtml(event.action)] : []),
    ...(link ? [`\n<a href="${escapeHtml(link)}/admin/audit">Open audit log</a>`] : [])].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#172238"><h2 style="margin:0 0 12px">${escapeHtml(event.headline)}</h2><p>${escapeHtml(event.intro)}</p>`
    + (event.ip ? `<p style="color:#526078">IP address: ${escapeHtml(event.ip)}</p>` : "")
    + (details.length ? `<ul>${details.map(line => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` : "")
    + (event.action ? `<p style="color:#8a2430"><strong>${escapeHtml(event.action)}</strong></p>` : "")
    + (link ? `<p><a href="${escapeHtml(link)}/admin/audit">Open the audit log</a></p>` : "") + `</div>`;
  const text = [event.headline, "", event.intro, event.ip ? `IP address: ${event.ip}` : "", ...details, event.action ?? ""].filter(Boolean).join("\n");
  await deliverAdminAlert(db, { subject: `[Security] ${event.headline}`, html, text, telegramHtml });
}
