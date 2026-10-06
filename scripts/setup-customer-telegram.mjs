// Run with secrets injected through the environment, never command-line token arguments.
// Default is read-only. --configure updates only the dedicated customer bot.
const token = process.env.CUSTOMER_TELEGRAM_BOT_TOKEN?.trim() || "";
const username = process.env.CUSTOMER_TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "") || "";
const secret = process.env.CUSTOMER_TELEGRAM_WEBHOOK_SECRET || "";
const configure = process.argv.includes("--configure");

async function api(method, payload = {}) {
  let response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000), redirect: "error",
    });
    const data = await response.json();
    if (!response.ok || data.ok !== true) throw new Error("provider_rejected");
    return data.result;
  } catch { throw new Error(`Telegram ${method} failed; check configuration and connectivity.`); }
}

async function main() {
  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token) || !/^[A-Za-z0-9_]{5,32}$/.test(username)) throw new Error("Set the dedicated customer bot token and username in the environment.");
  if (token.split(":")[0] === process.env.TELEGRAM_BOT_TOKEN?.split(":")[0]) throw new Error("Use a different bot from the internal admin bot.");
  const bot = await api("getMe");
  if (!bot.is_bot || bot.username?.toLowerCase() !== username.toLowerCase()) throw new Error("The customer bot token and username do not match.");
  if (configure) {
    let site;
    try { site = new URL(process.env.REQUEST_SITE_URL || ""); } catch { throw new Error("Configure REQUEST_SITE_URL."); }
    if (site.protocol !== "https:" || site.username || site.password) throw new Error("REQUEST_SITE_URL must use HTTPS.");
    if (!/^[A-Za-z0-9_-]{32,256}$/.test(secret)) throw new Error("Configure a webhook secret of at least 32 URL-safe characters.");
    await api("setWebhook", { url: `${site.origin}/api/webhooks/customer-telegram`, secret_token: secret,
      allowed_updates: ["message","my_chat_member"], max_connections: 5, drop_pending_updates: false });
    await api("setMyCommands", { commands: [{ command: "start", description: "Connect from your Zarman dashboard" }, { command: "stop", description: "Disconnect Telegram notifications" }, { command: "help", description: "How to connect or contact Zarman" }] });
    await api("setMyCommands", { language_code: "fa", commands: [{ command: "start", description: "اتصال از طریق داشبورد زرمان" }, { command: "stop", description: "قطع اعلان‌های تلگرام" }, { command: "help", description: "راهنمای اتصال و ارتباط با زرمان" }] });
    await api("setMyDescription", { description: "Official Zarman Exchange transfer notifications. Connect from your Zarman dashboard to receive status updates and team messages. Reply securely in your dashboard. Never share passwords with this bot." });
    await api("setMyDescription", { language_code: "fa", description: "اعلان‌های انتقال صرافی زرمان. از داشبورد خود متصل شوید و وضعیت تراکنش و پیام‌های تیم را دریافت کنید. پاسخ‌ها را در داشبورد بنویسید. رمز عبور خود را برای ربات ارسال نکنید." });
  }
  const webhook = await api("getWebhookInfo");
  // Emit only public identity and coarse health, never API URLs containing a token or provider errors.
  console.log(JSON.stringify({ bot: `@${bot.username}`, configured: configure, webhookSet: Boolean(webhook.url),
    pendingUpdates: webhook.pending_update_count, webhookHasError: Boolean(webhook.last_error_date),
    groupJoiningEnabled: bot.can_join_groups }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
