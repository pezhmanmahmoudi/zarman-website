// Server only: imported by server actions and route handlers, never client components.
import { randomUUID } from "node:crypto";
import webpush, { WebPushError, type PushSubscription } from "web-push";
import { telegramDatabase } from "./customer-telegram";

/** Push is enabled only when all three VAPID settings are present and well formed. */
export function customerPushConfig() {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() || "";
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim() || "";
  const subject = process.env.WEB_PUSH_SUBJECT?.trim() || "";
  if (!/^[A-Za-z0-9_-]{87}$/.test(publicKey) || !/^[A-Za-z0-9_-]{43}$/.test(privateKey)
    || !/^(mailto:[^\s@]+@[^\s@]+|https:\/\/\S+)$/.test(subject)) return null;
  return { publicKey, privateKey, subject };
}

export const pushDatabase = telegramDatabase;

// The server sends an HTTP request to the endpoint a browser hands us, so only
// the browser vendors' push services are accepted (no requests to arbitrary hosts).
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /^(updates\.)?push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/, /^[a-z0-9-]+\.push\.apple\.com$/, /^[a-z0-9-]+\.notify\.windows\.com$/];

export function validPushSubscription(input: unknown): { endpoint: string; p256dh: string; auth: string } | null {
  if (!input || typeof input !== "object") return null;
  const { endpoint, keys } = input as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof endpoint !== "string" || endpoint.length > 1024 || typeof keys?.p256dh !== "string" || typeof keys?.auth !== "string") return null;
  if (!/^[A-Za-z0-9_-]{80,100}$/.test(keys.p256dh) || !/^[A-Za-z0-9_-]{16,32}$/.test(keys.auth)) return null;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")
      || !PUSH_HOSTS.some(host => host.test(url.hostname))) return null;
  } catch { return null; }
  return { endpoint, p256dh: keys.p256dh, auth: keys.auth };
}

type Subscription = { id: string; endpoint: string; p256dh: string; auth: string; locale: "en" | "fa" };
export type PushPayload = { title: string; body: string; url: string; tag: string; lang: "en"; timestamp?: number };
type SendOutcome = "delivered" | "failed" | "gone";

export async function sendCustomerPush(config: NonNullable<ReturnType<typeof customerPushConfig>>, subscription: Omit<Subscription, "id" | "locale">, payload: PushPayload): Promise<SendOutcome> {
  if (!validPushSubscription({ endpoint: subscription.endpoint, keys: subscription })) return "gone";
  const target: PushSubscription = { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } };
  try {
    await webpush.sendNotification(target, JSON.stringify(payload), {
      vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey },
      TTL: 24 * 60 * 60, urgency: "high", timeout: 6_000,
    });
    return "delivered";
  } catch (error) {
    // 404/410: the browser unsubscribed or the app was uninstalled; forget the device.
    if (error instanceof WebPushError && [404, 410].includes(error.statusCode)) return "gone";
    return "failed";
  }
}

// Notifications are sent in English only. {ref} is the transfer's reference code.
// The title says what happened; the body names the transfer and adds only the next step,
// never repeating the title. The app name is already shown by the system above the title.
// Bodies never include amounts or messages written by the team: lock screens show them.
const PUSH_COPY: Record<string, [title: string, body: string]> = {
  reopened: ["Transfer reopened", "{ref} · Back under review."],
  admin_message: ["New message", "{ref} · Open to read and reply."],
  review: ["Under review", "{ref} · We'll update you shortly."],
  await_funds: ["Transfer approved", "{ref} · Payment details are ready."],
  request_info: ["Action needed", "{ref} · We need a few more details."],
  funds_recorded: ["Payment recorded", "{ref} · We'll verify it shortly."],
  ready: ["Payment received", "{ref} · Verified and confirmed."],
  resume_funded_request: ["Approved for settlement", "{ref} · We'll start shortly."],
  start_processing: ["Transfer in progress", "{ref} · We'll let you know once it's done."],
  record_uncertain_payout: ["Confirming your transfer", "{ref} · We'll update you shortly."],
  complete: ["Transfer complete", "{ref} · Your receipt is ready."],
  reject: ["Transfer declined", "{ref} · Open for details."],
  cancel: ["Transfer cancelled", "{ref} · Open for details."],
  refund_pending: ["Refund in progress", "{ref} · We'll confirm once it's done."],
  refund_returned: ["Refund completed", "{ref} · Open for details."],
  expired: ["Request expired", "{ref} · Start a new one any time."],
};
PUSH_COPY.confirm_funds = PUSH_COPY.ready;
PUSH_COPY.reconcile_complete = PUSH_COPY.complete;
const FALLBACK_COPY: [string, string] = ["Transfer update", "{ref} · Open to see what's new."];

/**
 * The text is always English. `siteLocale` is the language the customer uses
 * on the site, so tapping the notification opens the page in that language.
 */
export function customerPushPayload(delivery: { requestId: string; eventType: string; reference: string; createdAt?: string }, siteLocale: "en" | "fa"): PushPayload {
  const [title, body] = PUSH_COPY[delivery.eventType] || FALLBACK_COPY;
  const reference = delivery.reference.replace(/[^A-Za-z0-9-]/g, "").slice(0, 40);
  const timestamp = delivery.createdAt ? Date.parse(delivery.createdAt) : NaN;
  return {
    title,
    body: body.replace("{ref}", reference),
    url: `/${siteLocale}/dashboard/requests/${encodeURIComponent(delivery.requestId)}`,
    // One notification per transfer: a newer update replaces the older one.
    tag: `request-${delivery.requestId}`,
    lang: "en",
    ...(Number.isFinite(timestamp) ? { timestamp } : {}),
  };
}

/** The confirmation sent by "Send a test". */
export function customerPushTestPayload(siteLocale: "en" | "fa"): PushPayload {
  return { title: "Notifications are on", body: "Your transfer updates will appear here.",
    url: `/${siteLocale}/dashboard`, tag: "zarman-test", lang: "en" };
}

type ClaimedDelivery = { id: string; requestId: string; eventType: string; reference: string; createdAt: string; subscriptions: Subscription[] };

async function dispatchCustomerPush(requestId: string) {
  const config = customerPushConfig();
  if (!config) return;
  const db = pushDatabase(), workerId = randomUUID(), started = Date.now(), seen = new Set<string>();
  while (seen.size < 12 && Date.now() - started < 18_000) {
    const claim = await db.rpc("claim_customer_push_delivery", { p_worker_id: workerId, p_request_id: requestId });
    if (claim.error) throw new Error("push_queue_unavailable");
    const delivery = claim.data as ClaimedDelivery | null;
    if (!delivery) break;
    const retried = seen.has(delivery.id);
    seen.add(delivery.id);
    const results = await Promise.all(delivery.subscriptions.map(async subscription =>
      [subscription.id, await sendCustomerPush(config, subscription, customerPushPayload(delivery, subscription.locale))] as const));
    const ids = (outcome: SendOutcome) => results.filter(([, result]) => result === outcome).map(([id]) => id);
    const delivered = ids("delivered"), failed = ids("failed"), gone = ids("gone");
    const status = delivered.length ? "sent" : failed.length ? "failed" : "cancelled";
    const finished = await db.rpc("finish_customer_push_delivery", {
      p_id: delivery.id, p_worker_id: workerId, p_status: status,
      p_error: status === "failed" ? "push_service_error" : status === "cancelled" ? "no_devices" : null,
      p_delivered: delivered, p_failed: failed, p_gone: gone,
    });
    if (finished.error) throw new Error("push_queue_unavailable");
    // A failed delivery returns to the queue; leave it for the next update on this transfer.
    if (retried || status === "failed") break;
  }
}

export async function dispatchCustomerPushSafely(requestId: string) {
  try { await dispatchCustomerPush(requestId); }
  catch { console.error("[CustomerPush] Send interrupted; queued deliveries are retried on the next update."); }
}
