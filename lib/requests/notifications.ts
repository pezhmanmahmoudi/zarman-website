import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { Resend, type CreateEmailResponse } from "resend";
import {
  REQUEST_EMAIL_TEMPLATE_VERSION,
  renderRequestNotification,
  validatedRequestSiteUrl,
  type RequestEmailPayload,
  type RequestEmailSnapshot,
} from "./notification-template";

const IDEMPOTENCY_SAFE_WINDOW_MS = 23 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 12;

export type NotificationDelivery = RequestEmailSnapshot & {
  attempts: number;
  first_attempt_at: string | null;
  rendered_payload: RequestEmailPayload | null;
  template_version: string | null;
};

type RpcResult = { data: unknown; error: unknown };
export type NotificationDatabase = { rpc(name: string, args?: Record<string, unknown>): PromiseLike<RpcResult> };
type FinishStatus = "pending" | "provider_accepted" | "failed" | "reconciliation_required";

export function authorizedNotificationCron(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 32 || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function createNotificationDatabase(): NotificationDatabase {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("notification_database_not_configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function notificationRuntimeSettings() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REQUEST_NOTIFICATIONS_FROM;
  if (!apiKey || !from || /[\r\n]/.test(from)) throw new Error("notification_sender_not_configured");
  return { apiKey, from, siteUrl: validatedRequestSiteUrl(process.env.REQUEST_SITE_URL) };
}

async function rpc<T>(db: NotificationDatabase, name: string, args?: Record<string, unknown>): Promise<T> {
  const result = await db.rpc(name, args);
  if (result.error) throw new Error(`notification_rpc_failed:${name}`);
  return result.data as T;
}

export function notificationRetryAt(attempts: number, now: number, retryAfter?: string | null, jitter = Math.random()): string {
  const delay = Math.min(60 * 60 * 1000, 30_000 * 2 ** Math.min(Math.max(attempts - 1, 0), 7));
  const retrySeconds = retryAfter && /^\d+(\.\d+)?$/.test(retryAfter) ? Number(retryAfter) * 1000 : 0;
  const retryDate = retryAfter && !retrySeconds ? Date.parse(retryAfter) - now : 0;
  return new Date(now + Math.max(delay * (1 + Math.max(0, Math.min(jitter, 1)) * 0.25), retrySeconds, Number.isFinite(retryDate) ? retryDate : 0)).toISOString();
}

export function requiresNotificationReconciliation(firstAttemptAt: string | null, now: number): boolean {
  return firstAttemptAt !== null && (!Number.isFinite(Date.parse(firstAttemptAt)) || now - Date.parse(firstAttemptAt) >= IDEMPOTENCY_SAFE_WINDOW_MS);
}

function outcomeForProviderError(response: CreateEmailResponse): { retry: boolean; code: string } {
  const error = response.error;
  if (!error) return { retry: true, code: "provider_response_ambiguous" };
  const code = /^[a-z_]{1,80}$/.test(error.name) ? error.name : "provider_error";
  return {
    retry: error.statusCode === null || error.statusCode === undefined || error.statusCode >= 500 || error.statusCode === 429 || error.name === "concurrent_idempotent_requests",
    code,
  };
}

/** Claim one message at a time so later claims cannot expire while waiting on
 * slow provider calls. The database enforces audience-specific milestone order. */
export async function runRequestNotificationWorker(options: {
  db: NotificationDatabase;
  send: (payload: RequestEmailPayload, key: string) => Promise<CreateEmailResponse>;
  from: string;
  siteUrl: string;
  now?: () => number;
  limit?: number;
  workerId?: string;
}) {
  const now = options.now ?? Date.now;
  const started = now();
  const workerId = options.workerId ?? randomUUID();
  const counts = { claimed: 0, accepted: 0, retrying: 0, failed: 0, reconciliation: 0 };
  await rpc(options.db, "sweep_exchange_request_deadlines");
  for (let i = 0; i < Math.min(Math.max(options.limit ?? 10, 1), 25) && now() - started < 40_000; i += 1) {
    const rows = await rpc<NotificationDelivery[]>(options.db, "claim_request_notifications", {
      p_worker_id: workerId, p_limit: 1, p_lease_seconds: 120,
    });
    const delivery = rows?.[0];
    if (!delivery) break;
    counts.claimed += 1;
    const finish = async (status: FinishStatus, errorCode: string | null, providerId: string | null = null, retryAt: string | null = null) => {
      await rpc(options.db, "finish_request_notification", {
        p_id: delivery.id, p_worker_id: workerId, p_status: status,
        p_provider_id: providerId, p_error_code: errorCode, p_next_attempt_at: retryAt,
      });
    };
    if (requiresNotificationReconciliation(delivery.first_attempt_at, now())) {
      await finish("reconciliation_required", "idempotency_window_reconciliation_required");
      counts.reconciliation += 1;
      continue;
    }
    let payload: RequestEmailPayload;
    try {
      payload = delivery.rendered_payload ?? renderRequestNotification(delivery, options);
    } catch {
      await finish("failed", "recipient_or_snapshot_unavailable");
      counts.failed += 1;
      continue;
    }
    // Persist the EXACT recipient, sender, template, body and first possible
    // send time before network I/O. A crash must never reset the 24h window.
    const prepared = await rpc<NotificationDelivery>(options.db, "prepare_request_notification", {
      p_id: delivery.id, p_worker_id: workerId, p_payload: payload,
      p_template_version: delivery.template_version ?? REQUEST_EMAIL_TEMPLATE_VERSION,
    });
    if (!prepared?.rendered_payload) throw new Error("notification_payload_not_persisted");
    let response: CreateEmailResponse;
    try {
      response = await options.send(prepared.rendered_payload, `request-notification/${delivery.id}`);
    } catch {
      // A network exception can occur AFTER provider acceptance. Retry only
      // inside the same idempotency window and with the persisted payload.
      response = { data: null, error: { name: "application_error", message: "", statusCode: null }, headers: null };
    }
    if (response.data?.id && !response.error) {
      // On DB failure leave the lease intact: do not enqueue a different send.
      await finish("provider_accepted", null, response.data.id);
      counts.accepted += 1;
      continue;
    }
    const failure = outcomeForProviderError(response);
    if (failure.retry && prepared.attempts < MAX_ATTEMPTS) {
      await finish("pending", failure.code, null, notificationRetryAt(prepared.attempts, now(), response.headers?.["retry-after"]));
      counts.retrying += 1;
    } else {
      // Even exhausted ambiguous sends require investigation, not a new key.
      await finish(failure.retry ? "reconciliation_required" : "failed", failure.retry ? "attempts_exhausted_reconciliation_required" : failure.code);
      if (failure.retry) counts.reconciliation += 1;
      else counts.failed += 1;
    }
  }
  return counts;
}

export function createRequestEmailSender(apiKey: string) {
  const resend = new Resend(apiKey);
  return (payload: RequestEmailPayload, idempotencyKey: string) => {
    // The installed SDK forwards request options to fetch. Bound network I/O
    // below both the lease duration and the route's execution budget.
    const options = { idempotencyKey, signal: AbortSignal.timeout(12_000) };
    return resend.emails.send(payload, options);
  };
}

/** Signature verification uses the unmodified HTTP body, before parsing or DB
 * access. Only minimal provider metadata is retained; no full email contents. */
export function verifyRequestEmailEvent(rawBody: string, headers: Headers, webhookSecret: string) {
  const eventId = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signature = headers.get("svix-signature");
  if (!eventId || !timestamp || !signature || eventId.length > 200) throw new Error("invalid_webhook_headers");
  // Verification is local; this SDK constructor does not contact Resend.
  const resend = new Resend("webhook-verification-only");
  const event = resend.webhooks.verify({
    payload: rawBody, headers: { id: eventId, timestamp, signature }, webhookSecret,
  });
  const emailId = "email_id" in event.data ? event.data.email_id : null;
  if (!event.type || !event.created_at || !Number.isFinite(Date.parse(event.created_at))) throw new Error("invalid_webhook_event");
  return {
    eventId, eventType: event.type, providerId: emailId,
    occurredAt: event.created_at,
    payloadHash: createHash("sha256").update(rawBody).digest("hex"),
  };
}

export async function persistRequestEmailEvent(db: NotificationDatabase, event: ReturnType<typeof verifyRequestEmailEvent>) {
  return rpc(db, "record_request_email_event", {
    p_event_id: event.eventId, p_event_type: event.eventType,
    p_provider_id: event.providerId, p_occurred_at: event.occurredAt, p_payload_hash: event.payloadHash,
  });
}
