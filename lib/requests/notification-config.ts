/** Shared by activation checks and the mail worker. No network or secret reads. */
export function validNotificationEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(value);
}

export function validatedRequestSiteUrl(value: string | undefined): string {
  if (!value) throw new Error("missing_site_url");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("invalid_site_url");
  }
  return url.origin;
}

export function validatedNotificationSettings(env: Record<string, string | undefined>) {
  const apiKey = env.RESEND_API_KEY;
  const from = env.REQUEST_NOTIFICATIONS_FROM;
  const senderEmail = from?.match(/^[^<>]*<([^<>]+)>$/)?.[1] ?? from;
  if (!apiKey?.trim() || !from || from.length > 320 || /[\u0000-\u001f]/.test(from) || !validNotificationEmail(senderEmail)) throw new Error("notification_sender_not_configured");
  return { apiKey, from, siteUrl: validatedRequestSiteUrl(env.REQUEST_SITE_URL) };
}
