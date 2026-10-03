import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { Resend, type CreateEmailResponse } from "resend";
import {
  REQUEST_EMAIL_TEMPLATE_VERSION,
  renderRequestNotification,
  type RequestEmailPayload,
  type RequestEmailSnapshot,
} from "./notification-template";
import { renderRequestReceiptPdf } from "./receipt";
import { validNotificationEmail, validatedNotificationSettings } from "./notification-config";

const IDEMPOTENCY_SAFE_WINDOW_MS = 23 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 12;
const DATABASE_ATTEMPT_TIMEOUT_MS = 8_000;
// Bound post-response work: stop claiming further rounds after this.
const SEND_CLAIM_WINDOW_MS = 20_000;
const MAX_EMAILS_PER_RUN = 25;

export type NotificationDelivery = RequestEmailSnapshot & {
  attempts: number;
  first_attempt_at: string | null;
  rendered_payload: RequestEmailPayload | null;
  template_version: string | null;
};

type RpcResult = { data: unknown; error: unknown; status?: number };
export type NotificationDatabase = { rpc(name: string, args?: Record<string, unknown>): PromiseLike<RpcResult> };
type FinishStatus = "pending" | "provider_accepted" | "failed" | "reconciliation_required";

type NotificationRpcOperation = "claim_request_notifications_for_request"
  | "prepare_request_notification" | "finish_request_notification" | "record_request_email_event";
const SAFE_RPC_ERROR_CODES = new Set([
  "PGRST000", "PGRST001", "PGRST002", "PGRST003", "PGRST100", "PGRST102", "PGRST106",
  "PGRST202", "PGRST301", "PGRST302", "PGRST303", "42501", "42883", "57014", "55P03",
  "40P01", "40001", "53300", "08000", "08001", "08003", "08004", "08006", "08007", "08P01",
  "transport_error", "unclassified",
]);
const SAFE_CONFIGURATION_ERRORS = new Set([
  "notification_database_not_configured", "notification_sender_not_configured", "missing_site_url", "invalid_site_url",
]);
type TransportCategory = "timeout" | "aborted" | "socket_error" | "dns_error" | "invalid_response" | "unclassified";

function transportCategory(error: unknown): TransportCategory {
  if (!error || typeof error !== "object") return "unclassified";
  const fields = error as Record<string, unknown>;
  const cause = fields.cause && typeof fields.cause === "object" ? fields.cause as Record<string, unknown> : {};
  // The SDK flattens transport/body errors into message/details with status 0.
  // Inspect locally and retain only a fixed category, never the original text.
  const text = [fields.name, fields.code, fields.message, fields.details, cause.name, cause.code, cause.message]
    .filter((value): value is string => typeof value === "string").join("\n");
  if (/\b(TimeoutError|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT|UND_ERR_HEADERS_TIMEOUT|UND_ERR_BODY_TIMEOUT)\b/.test(text)) return "timeout";
  if (/\b(AbortError|ABORT_ERR|UND_ERR_ABORTED)\b/.test(text)) return "aborted";
  if (/\b(ENOTFOUND|EAI_AGAIN)\b/.test(text)) return "dns_error";
  if (/\b(SocketError|ECONNRESET|ECONNREFUSED|EPIPE|UND_ERR_SOCKET)\b/.test(text)) return "socket_error";
  if (/\b(SyntaxError|UND_ERR_RES_CONTENT_LENGTH_MISMATCH|HPE_INVALID_HEADER_TOKEN|HPE_INVALID_STATUS)\b/.test(text)) return "invalid_response";
  return "unclassified";
}

/** Discard provider messages, details and causes at the RPC boundary. */
class NotificationRpcError extends Error {
  readonly operation: NotificationRpcOperation;
  readonly code: string;
  readonly status: number | null;
  readonly category?: TransportCategory;

  constructor(operation: NotificationRpcOperation, code: unknown, status: unknown, category?: TransportCategory) {
    super(`notification_rpc_failed:${operation}`);
    this.operation = operation;
    this.code = typeof code === "string" && SAFE_RPC_ERROR_CODES.has(code) ? code : "unclassified";
    this.status = typeof status === "number" && Number.isInteger(status)
      && (status === 0 || (status >= 100 && status <= 599)) ? status : null;
    this.category = category;
  }
}

/** Only this explicit projection is safe to log; never serialize the error itself. */
export function notificationWorkerFailureDiagnostic(error: unknown) {
  const base = { event: "request_notification_worker_unavailable" };
  if (error instanceof NotificationRpcError) {
    return { ...base, stage: "database_rpc", operation: error.operation, code: error.code, status: error.status,
      ...(error.category ? { category: error.category } : {}) };
  }
  if (error instanceof Error && SAFE_CONFIGURATION_ERRORS.has(error.message)) {
    return { ...base, stage: "configuration", code: error.message };
  }
  return { ...base, stage: "unknown" };
}

export function createNotificationDatabase(): NotificationDatabase {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("notification_database_not_configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const callerSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
      const timeoutSignal = AbortSignal.timeout(DATABASE_ATTEMPT_TIMEOUT_MS);
      const headers = new Headers(input instanceof Request ? input.headers : undefined);
      new Headers(init?.headers).forEach((value, name) => headers.set(name, value));
      // Do not retain database HTTP sockets across idle serverless invocations.
      headers.set("Connection", "close");
      return fetch(input, {
        ...init, headers,
        signal: callerSignal ? AbortSignal.any([callerSignal, timeoutSignal]) : timeoutSignal,
      });
    } },
  });
}

export function notificationRuntimeSettings() {
  return validatedNotificationSettings(process.env);
}

/** Bound memory even when Content-Length is absent or dishonest. */
export async function readRequestEmailWebhookBody(request: Request, maxBytes: number): Promise<string> {
  if (Number(request.headers.get("content-length")) > maxBytes) throw new Error("webhook_body_too_large");
  const reader = request.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let body = "", bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); throw new Error("webhook_body_too_large"); }
      body += decoder.decode(next.value, { stream: true });
    }
    return body + decoder.decode();
  } finally { reader.releaseLock(); }
}

async function rpc<T>(db: NotificationDatabase, name: NotificationRpcOperation, args?: Record<string, unknown>): Promise<T> {
  let result: RpcResult;
  try { result = await db.rpc(name, args); }
  catch (error) { throw new NotificationRpcError(name, "transport_error", null, transportCategory(error)); }
  if (result.error) {
    const code = typeof result.error === "object" && "code" in result.error ? result.error.code : undefined;
    throw new NotificationRpcError(name, code, result.status, result.status === 0 ? transportCategory(result.error) : undefined);
  }
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

type NotificationWorkerOptions = {
  db: NotificationDatabase;
  send: (payload: RequestEmailPayload, key: string) => Promise<CreateEmailResponse>;
  from: string;
  siteUrl: string;
  now?: () => number;
  workerId?: string;
};

/** Fail closed for legacy stored payloads as well as newly rendered messages.
 * Never permit an extra recipient or a provider option such as cc/bcc. */
function isCustomerPayload(delivery: NotificationDelivery, payload: RequestEmailPayload): boolean {
  const allowed = new Set(["from", "to", "subject", "html", "text", "tags", "attachments"]);
  return delivery.audience === "customer" && validNotificationEmail(delivery.recipient_email)
    && payload !== null && typeof payload === "object"
    && Object.keys(payload).every(key => allowed.has(key))
    && Array.isArray(payload.to) && payload.to.length === 1 && payload.to[0] === delivery.recipient_email;
}

/** Invoked only by an explicit admin action after its durable commit. There is
 * no scheduler: a temporary failure waits for the next manual send/retry. An
 * explicit delivery selection never sends another email from the request. */
export async function sendRequestNotifications(options: NotificationWorkerOptions & { requestId: string; deliveryId?: string }) {
  const now = options.now ?? Date.now;
  const started = now();
  const workerId = options.workerId ?? randomUUID();
  const counts = { claimed: 0, accepted: 0, retrying: 0, failed: 0, reconciliation: 0 };

  const deliver = async (delivery: NotificationDelivery) => {
    if (delivery.request_id !== options.requestId || (options.deliveryId && delivery.id !== options.deliveryId)) {
      throw new Error("notification_claim_scope_mismatch");
    }
    counts.claimed += 1;
    const finish = async (status: FinishStatus, errorCode: string | null, providerId: string | null = null, retryAt: string | null = null) => {
      await rpc(options.db, "finish_request_notification", {
        p_id: delivery.id, p_worker_id: workerId, p_status: status,
        p_provider_id: providerId, p_error_code: errorCode, p_next_attempt_at: retryAt,
      });
    };
    // The database also excludes legacy management rows. Keep this boundary so
    // a delayed migration can never cause the application to send them.
    if (delivery.audience !== "customer") {
      await finish("failed", "management_email_disabled");
      counts.failed += 1;
      return;
    }
    if (requiresNotificationReconciliation(delivery.first_attempt_at, now())) {
      await finish("reconciliation_required", "idempotency_window_reconciliation_required");
      counts.reconciliation += 1;
      return;
    }
    let payload: RequestEmailPayload;
    try {
      payload = delivery.rendered_payload ?? renderRequestNotification(delivery, options);
      if (!delivery.rendered_payload && delivery.event_type === "complete") {
        const receipt = delivery.payload_snapshot?.receipt;
        if (!receipt) throw new Error("completion_receipt_unavailable");
        payload.attachments = [{
          filename: `zarman-receipt-${delivery.request_id}.pdf`,
          content: Buffer.from(await renderRequestReceiptPdf(receipt)).toString("base64"),
          contentType: "application/pdf",
        }];
      }
      if (!isCustomerPayload(delivery, payload)) throw new Error("invalid_customer_payload");
    } catch {
      await finish("failed", "recipient_or_snapshot_unavailable");
      counts.failed += 1;
      return;
    }
    // Persist the EXACT recipient, sender, template, body and first possible
    // send time before network I/O. A crash must never reset the 24h window.
    const prepared = await rpc<NotificationDelivery>(options.db, "prepare_request_notification", {
      p_id: delivery.id, p_worker_id: workerId, p_payload: payload,
      p_template_version: delivery.template_version ?? REQUEST_EMAIL_TEMPLATE_VERSION,
    });
    if (!prepared?.rendered_payload) throw new Error("notification_payload_not_persisted");
    if (!isCustomerPayload(prepared, prepared.rendered_payload)) {
      await finish("failed", "invalid_customer_payload");
      counts.failed += 1;
      return;
    }
    if (requiresNotificationReconciliation(prepared.first_attempt_at, now())) {
      await finish("reconciliation_required", "idempotency_window_reconciliation_required");
      counts.reconciliation += 1;
      return;
    }
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
      return;
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
  };

  // Claim only what can be processed now. Leasing a whole batch and sending
  // sequentially strands the untouched rows if the invocation is interrupted.
  // A retryable failure stops the current action. A selected delivery is the
  // sole permitted recipient of a manual retry, even if more rows are pending.
  while (counts.claimed < (options.deliveryId ? 1 : MAX_EMAILS_PER_RUN) && counts.retrying === 0 && now() - started < SEND_CLAIM_WINDOW_MS) {
    const rows = await rpc<NotificationDelivery[]>(options.db, "claim_request_notifications_for_request", {
      p_worker_id: workerId, p_request_id: options.requestId,
      ...(options.deliveryId ? { p_delivery_id: options.deliveryId } : {}),
      p_limit: 1, p_lease_seconds: 120,
    });
    if (!rows?.length) break;
    for (const delivery of rows) await deliver(delivery);
  }
  return counts;
}

export function createRequestEmailSender(apiKey: string) {
  const resend = new Resend(apiKey);
  return (payload: RequestEmailPayload, idempotencyKey: string) => {
    // The installed SDK forwards request options to fetch. Bound network I/O
    // below the claim lease and the admin action's execution budget.
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
