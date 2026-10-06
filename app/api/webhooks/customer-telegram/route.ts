import { createHash } from "node:crypto";
import { after } from "next/server";
import { customerTelegramConfig, sendCustomerTelegram, telegramDatabase, telegramSecretMatches } from "@/lib/notifications/customer-telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function readUpdate(request: Request): Promise<unknown> {
  const maximum = 16_384;
  if (Number(request.headers.get("content-length")) > maximum) throw new Error("large_body");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("empty_body");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let body = "", size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maximum) { await reader.cancel(); throw new Error("large_body"); }
      body += decoder.decode(part.value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } finally { reader.releaseLock(); }
}
type Update = {
  update_id?: number;
  message?: { text?: string; chat?: { id?: number; type?: string }; from?: { id?: number; is_bot?: boolean; first_name?: string; last_name?: string; username?: string } };
  my_chat_member?: { chat?: { id?: number; type?: string }; from?: { id?: number }; new_chat_member?: { status?: string } };
};

export async function POST(request: Request) {
  const config = customerTelegramConfig();
  if (!config) return new Response(null, { status: 503 });
  if (!telegramSecretMatches(request.headers.get("x-telegram-bot-api-secret-token"), config.webhookSecret)) return new Response(null, { status: 403 });
  let update: Update;
  try {
    const value = await readUpdate(request);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_update");
    update = value as Update;
  } catch { return new Response(null, { status: 400 }); }
  if (!Number.isSafeInteger(update.update_id) || update.update_id! < 0) return new Response(null, { status: 400 });
  const blocked = update.my_chat_member?.new_chat_member?.status === "kicked";
  const chat = blocked ? update.my_chat_member?.chat : update.message?.chat;
  const actor = blocked ? update.my_chat_member?.from : update.message?.from;
  if (chat?.type !== "private" || !Number.isSafeInteger(chat.id) || chat.id! <= 0 || actor?.id !== chat.id || update.message?.from?.is_bot) {
    return Response.json({ received: true });
  }
  const text = typeof update.message?.text === "string" ? update.message.text.trim() : "";
  const start = text.match(/^\/start(?:@[A-Za-z0-9_]+)?\s+([A-Za-z0-9_-]{43})$/);
  const stop = /^\/stop(?:@[A-Za-z0-9_]+)?$/.test(text);
  const from = update.message?.from;
  try {
    const { data, error } = await telegramDatabase().rpc("customer_telegram_webhook", {
      p_bot_id: config.botId, p_update_id: update.update_id, p_chat_id: chat.id,
      p_action: blocked ? "blocked" : stop ? "stop" : start ? "start" : "help",
      p_token_hash: start ? createHash("sha256").update(start[1]).digest("hex") : null,
      p_display_name: [from?.first_name, from?.last_name].filter(value => typeof value === "string").join(" ").replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "").slice(0,160),
      p_username: typeof from?.username === "string" && /^[A-Za-z0-9_]{1,64}$/.test(from.username) ? from.username : null,
    });
    if (error) throw new Error("webhook_persistence_failed");
    if (data) after(async () => {
      const fa = data.locale === "fa";
      const responseText = data.kind === "confirm"
        ? (fa ? "برای فعال‌سازی اعلان‌های زرمان، به داشبورد برگردید و حساب تلگرام خود را تأیید کنید. تا قبل از تأیید، اطلاعات تراکنش ارسال نمی‌شود." : "Return to your Zarman dashboard and confirm this Telegram account to enable notifications. No transfer information is sent before you confirm.")
        : data.kind === "disconnected"
        ? (fa ? "اعلان‌های تلگرام زرمان قطع شد. برای اتصال مجدد به تنظیمات حساب خود بروید." : "Zarman Telegram notifications are disconnected. You can reconnect from your account settings.")
        : "Zarman Exchange | زرمان\n\nConnect Telegram from your signed-in Zarman dashboard. To reply to the team, use your transaction page. /stop disconnects notifications.\n\nبرای اتصال تلگرام وارد داشبورد زرمان شوید. پاسخ به تیم زرمان را در صفحهٔ تراکنش بنویسید. /stop اعلان‌ها را قطع می‌کند.";
      await sendCustomerTelegram(config, String(chat.id), responseText, {
        text: fa ? "بازگشت به داشبورد" : "Open Zarman dashboard",
        url: `${config.siteUrl}/${fa ? "fa" : "en"}/dashboard?tab=profile#telegram-notifications`,
      });
    });
    return Response.json({ received: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Ask Telegram to retry only when durable processing failed; do not log update bodies.
    return new Response(null, { status: 503 });
  }
}
