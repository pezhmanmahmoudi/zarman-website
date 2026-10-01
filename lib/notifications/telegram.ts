import type { ExchangeRequest } from "@/lib/requests/types";
import { transactionRequestHref } from "@/lib/admin-transaction-workspace";

const escapeHtml = (value: string) => value.replace(/[&<>]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character]!);
const amount = (value: number, currency: string) => `${new Intl.NumberFormat("en-AU", { maximumFractionDigits: currency === "IRT" ? 0 : 2 }).format(value)} ${currency === "IRT" ? "Toman" : currency}`;

/** Server-only: the bot token never reaches the browser. Throws on API failure so callers can log. */
export async function sendTelegramAdminMessage(html: string, chatId = process.env.TELEGRAM_ADMIN_CHAT_ID) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) {
    console.warn("[Telegram] Skipping notification: TELEGRAM_BOT_TOKEN or chat ID is not set.");
    return;
  }
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: "HTML", disable_web_page_preview: true }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Telegram API error ${response.status}`);
}

/** Summary only; bank details, payment-account credentials and documents stay in the admin panel. */
export function newRequestTelegramMessage(request: ExchangeRequest, siteUrl = process.env.REQUEST_SITE_URL) {
  const { quote } = request, recipient = quote.recipient_snapshot;
  const recipientName = [quote.institution_name, recipient.full_name, recipient.account_name, recipient.label].find(value => typeof value === "string" && value.trim());
  let link = "";
  try { if (siteUrl) link = new URL(transactionRequestHref(request.id), siteUrl).href; } catch { /* invalid site URL: send without link */ }
  return [
    `🆕 <b>New transfer request ${escapeHtml(request.reference_code)}</b>`,
    "",
    `👤 Customer: ${escapeHtml(quote.sender_snapshot?.name || "Unknown")}${quote.sender_snapshot?.email ? ` (${escapeHtml(quote.sender_snapshot.email)})` : ""}`,
    `💱 ${quote.customer_request_type === "buy_aud" ? "Buy AUD" : "Sell AUD"}${request.service_tier === "priority" ? " · ⚡ Express" : " · Standard"}`,
    `💰 Customer pays: ${amount(quote.funding_total, quote.funding_currency)}`,
    `🎯 Recipient receives: ${amount(quote.recipient_amount, quote.recipient_currency)}`,
    `👥 Recipient: ${escapeHtml(typeof recipientName === "string" ? recipientName : "—")}`,
    ...(link ? ["", `<a href="${escapeHtml(link)}">Open in admin</a>`] : []),
  ].join("\n");
}
