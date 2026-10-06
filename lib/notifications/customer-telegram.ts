// Server only: imported by server actions and route handlers, never client components.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

export function customerTelegramConfig() {
  if (process.env.CUSTOMER_TELEGRAM_ENABLED !== "true") return null;
  const token = process.env.CUSTOMER_TELEGRAM_BOT_TOKEN?.trim() || "";
  const username = process.env.CUSTOMER_TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "") || "";
  const webhookSecret = process.env.CUSTOMER_TELEGRAM_WEBHOOK_SECRET || "";
  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token) || !/^[A-Za-z0-9_]{5,32}$/.test(username)
    || !/^[A-Za-z0-9_-]{32,256}$/.test(webhookSecret)) return null;
  // A separate bot identity prevents customer onboarding from altering the admin bot.
  const botId = token.split(":")[0];
  if (botId === process.env.TELEGRAM_BOT_TOKEN?.split(":")[0]) return null;
  try {
    const site = new URL(process.env.REQUEST_SITE_URL || "");
    if (site.protocol !== "https:" || site.username || site.password) return null;
    return { token, username, webhookSecret, botId, siteUrl: site.origin };
  } catch { return null; }
}

export function telegramDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("telegram_unavailable");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8_000) }) } });
}

/** Check setup only when creating a link, so a missing webhook cannot leave customers waiting. */
export async function customerTelegramReady(config: NonNullable<ReturnType<typeof customerTelegramConfig>>) {
  try {
    const read = async (method: "getMe" | "getWebhookInfo") => {
      const response = await fetch(`https://api.telegram.org/bot${config.token}/${method}`, {
        method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) throw new Error("telegram_unavailable");
      const data = await response.json();
      if (data.ok !== true) throw new Error("telegram_unavailable");
      return data.result;
    };
    const [bot, webhook] = await Promise.all([read("getMe"), read("getWebhookInfo")]);
    return bot?.is_bot === true && typeof bot.username === "string"
      && bot.username.toLowerCase() === config.username.toLowerCase()
      && webhook?.url === `${config.siteUrl}/api/webhooks/customer-telegram`
      && (!Array.isArray(webhook.allowed_updates) || !webhook.allowed_updates.length || webhook.allowed_updates.includes("message"));
  } catch {
    // Fetch errors can contain the bot token. Return a fixed result, never log them.
    return false;
  }
}

export function telegramSecretMatches(received: string | null, expected: string) {
  if (!received || !expected) return false;
  return timingSafeEqual(createHash("sha256").update(received).digest(), createHash("sha256").update(expected).digest());
}

type SendResult = { status: "sent" | "failed" | "uncertain" | "blocked"; error?: string; providerId?: string };
export async function sendCustomerTelegram(config: NonNullable<ReturnType<typeof customerTelegramConfig>>, chatId: string, text: string, button?: { text: string; url: string }): Promise<SendResult> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", redirect: "error",
      signal: AbortSignal.timeout(6_000),
      body: JSON.stringify({ chat_id: chatId, text, protect_content: true, link_preview_options: { is_disabled: true },
        ...(button ? { reply_markup: { inline_keyboard: [[button]] } } : {}) }),
    });
    const data = await response.json() as { ok?: boolean; error_code?: number; result?: { message_id?: number }; parameters?: { retry_after?: number } };
    if (response.ok && data.ok === true && Number.isSafeInteger(data.result?.message_id)) return { status: "sent", providerId: String(data.result!.message_id) };
    // Failed sends stay visible for a manual retry. A timeout/5xx may already have delivered.
    if (data.ok === false && data.error_code === 429) return { status: "failed", error: "telegram_rate_limited" };
    if (data.ok === false && data.error_code === 403) return { status: "blocked", error: "bot_blocked" };
    if (data.ok === false && [400,401,404].includes(data.error_code || 0)) return { status: "failed", error: `telegram_${data.error_code}` };
    return { status: "uncertain", error: "delivery_unconfirmed" };
  } catch {
    // Never log fetch errors: they can include the bot token in the request URL.
    return { status: "uncertain", error: "delivery_unconfirmed" };
  }
}

type PreparedDelivery = {
  id: string; chatId: string; requestId: string; eventType: string; reference: string; status: string;
  fundingStatus: string; locale: "en" | "fa"; attempts: number; createdAt: string; message: string | null;
};
const eventCopy: Record<string, [string, string]> = {
  admin_message: ["You have a new message from the Zarman team.", "پیام جدیدی از تیم زرمان دارید."],
  review: ["Your transfer is being reviewed.", "درخواست انتقال شما در حال بررسی است."],
  await_funds: ["Your transfer is approved. Payment details are ready in your dashboard.", "درخواست شما تأیید شد. اطلاعات واریز در داشبورد آماده است."],
  request_info: ["We need some information from you. Please check your dashboard.", "برای ادامه به اطلاعات شما نیاز داریم. لطفاً داشبورد را بررسی کنید."],
  funds_recorded: ["A payment has been recorded for your transfer.", "واریزی برای درخواست انتقال شما ثبت شد."],
  ready: ["Your funds have been received and verified.", "دریافت وجه شما بررسی و تأیید شد."],
  confirm_funds: ["Your funds have been received and verified.", "دریافت وجه شما بررسی و تأیید شد."],
  resume_funded_request: ["Your transfer is approved for settlement.", "انتقال شما برای تسویه تأیید شد."],
  start_processing: ["Your transfer is being processed.", "انتقال شما در حال انجام است."],
  record_uncertain_payout: ["We are checking the outcome of your transfer.", "نتیجهٔ پرداخت انتقال شما در حال بررسی است."],
  complete: ["Your transfer is complete. Your receipt is available in your dashboard.", "انتقال شما تکمیل شد. رسید در داشبورد شما آماده است."],
  reconcile_complete: ["Your transfer is complete. Your receipt is available in your dashboard.", "انتقال شما تکمیل شد. رسید در داشبورد شما آماده است."],
  reject: ["Your transfer request was declined. Please check your dashboard for details.", "درخواست انتقال شما رد شد. جزئیات را در داشبورد ببینید."],
  cancel: ["Your transfer request was cancelled.", "درخواست انتقال شما لغو شد."],
  refund_pending: ["A refund is pending for your transfer.", "بازپرداخت انتقال شما در انتظار انجام است."],
  refund_returned: ["A refund has been confirmed. See your dashboard for details.", "بازپرداخت تأیید شد. جزئیات را در داشبورد ببینید."],
  expired: ["Your transfer request has expired.", "مهلت درخواست انتقال شما پایان یافت."],
};

export function customerTelegramMessage(delivery: PreparedDelivery, siteUrl: string) {
  const fa = delivery.locale === "fa";
  const copy = eventCopy[delivery.eventType] || ["Your transfer has an update. See your dashboard for the latest status.", "درخواست انتقال شما به‌روزرسانی شد. وضعیت را در داشبورد ببینید."];
  const clean = (value: string) => value.replace(/[\u0000-\u0008\u000b-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "");
  const date = new Intl.DateTimeFormat(fa ? "fa-IR" : "en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Australia/Sydney" }).format(new Date(delivery.createdAt));
  return {
    text: [fa ? "زرمان | اطلاع‌رسانی انتقال" : "Zarman | Transfer update", `${fa ? "کد تراکنش" : "Reference"}: ${clean(delivery.reference).slice(0,80)}`, "", copy[fa ? 1 : 0],
      ...(delivery.message ? ["", fa ? "پیام تیم زرمان:" : "Message from Zarman:", clean(delivery.message).slice(0,2000)] : []),
      "", `${date} · ${fa ? "سیدنی" : "Sydney"}`, fa ? "برای پاسخ و مشاهدهٔ آخرین وضعیت، وارد داشبورد شوید." : "Open your dashboard to reply and see the latest status."].join("\n"),
    button: { text: fa ? "مشاهده تراکنش" : "View transfer", url: `${siteUrl}/${fa ? "fa" : "en"}/dashboard/requests/${encodeURIComponent(delivery.requestId)}` },
  };
}

async function dispatchCustomerTelegram(requestId: string, deliveryId?: string) {
  const config = customerTelegramConfig();
  if (!config) return { processed: 0 };
  const db = telegramDatabase(), workerId = randomUUID(), started = Date.now();
  let processed = 0;
  while (processed < 12 && Date.now() - started < 18_000) {
    const claim = await db.rpc("claim_customer_telegram_delivery", { p_bot_id: config.botId, p_worker_id: workerId, p_request_id: requestId, p_delivery_id: deliveryId || null });
    if (claim.error) throw new Error("telegram_queue_unavailable");
    if (!claim.data) break;
    const prepared = await db.rpc("prepare_customer_telegram_delivery", { p_id: claim.data, p_worker_id: workerId, p_bot_id: config.botId });
    if (prepared.error) throw new Error("telegram_queue_unavailable");
    const delivery = prepared.data as PreparedDelivery | null;
    let outcome: SendResult | { status: "cancelled"; error: string };
    if (!delivery) outcome = { status: "cancelled", error: "connection_changed" };
    else {
      const message = customerTelegramMessage(delivery, config.siteUrl);
      outcome = await sendCustomerTelegram(config, delivery.chatId, message.text, message.button);
    }
    const finished = await db.rpc("finish_customer_telegram_delivery", {
      p_id: claim.data, p_worker_id: workerId, p_status: outcome.status, p_error: outcome.error || null,
      p_provider_id: "providerId" in outcome ? outcome.providerId || null : null,
    });
    if (finished.error) throw new Error("telegram_queue_unavailable");
    processed++;
    if (deliveryId) break;
    // Space the few notifications from one action without a scheduler or background service.
    await new Promise(resolve => setTimeout(resolve, 1_100));
  }
  return { processed };
}

export async function dispatchCustomerTelegramSafely(requestId: string, deliveryId?: string) {
  try { await dispatchCustomerTelegram(requestId, deliveryId); }
  catch { console.error("[CustomerTelegram] Send interrupted; delivery history retained for manual retry."); }
}
