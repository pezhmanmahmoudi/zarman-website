"use client";

// Customer Telegram status for one activity event, laid out exactly like the "Customer email" line
// above it (icon + label on the left, status on the right, retry underneath when needed).

import { useRef, useState } from "react";
import { Send } from "lucide-react";
import { retryCustomerTelegram } from "@/app/actions/customer-telegram.actions";
import type { CustomerTelegramDelivery } from "@/lib/notifications/customer-telegram-types";
import styles from "@/styles/requests/RequestWorkspace.module.css";

const labels: Record<CustomerTelegramDelivery["status"], string> = {
  pending: "Queued for sending", sending: "Sending", sent: "Sent to Telegram", failed: "Delivery failed",
  uncertain: "Delivery needs checking", cancelled: "Not sent · Telegram not connected",
};
const tones: Partial<Record<CustomerTelegramDelivery["status"], "good" | "bad">> = { sent: "good", failed: "bad", uncertain: "bad" };

export function TelegramUnavailableNote() {
  return <p role="status" className={styles.fieldHint}>Telegram delivery history could not be loaded. Refresh to try again.</p>;
}

/** `delivery` is null when no Telegram message was queued for this event. */
export function TelegramEventLine({ requestId, delivery, onUpdated }: { requestId: string; delivery: CustomerTelegramDelivery | null; onUpdated: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);

  async function retry() {
    if (!delivery || pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try {
      const result = await retryCustomerTelegram({ requestId, deliveryId: delivery.id, allowDuplicate: confirming });
      if (result.error) setError(result.error === "disconnected" ? "The customer has disconnected Telegram." : "Could not queue this notification. Refresh and try again.");
      else { setConfirming(false); await onUpdated(); }
    } catch { setError("Could not queue this notification. Refresh and try again."); }
    finally { pending.current = false; setBusy(false); }
  }

  const status = delivery?.status;
  return <li data-tone={status ? tones[status] : undefined}>
    <span><Send size={13} aria-hidden="true" />Customer Telegram</span>
    <span>{status ? labels[status] : "Not sent"}</span>
    {(status === "pending" || status === "failed") && <button type="button" className={styles.emailRetry} disabled={busy} onClick={() => void retry()}>{busy ? "Queuing…" : "Retry Telegram"}</button>}
    {status === "uncertain" && (!confirming
      ? <button type="button" className={styles.emailRetry} disabled={busy} onClick={() => setConfirming(true)}>Review retry</button>
      : <div className={styles.retryWarning} role="group" aria-label="Confirm Telegram retry">
          <p>Telegram may already have delivered this message. Sending again may duplicate it.</p>
          <div><button type="button" className={styles.emailRetry} disabled={busy} onClick={() => void retry()}>Send again</button>
            <button type="button" className={styles.textButton} disabled={busy} onClick={() => setConfirming(false)}>Cancel</button></div>
        </div>)}
    {error && <p role="alert" className={styles.retryError}>{error}</p>}
  </li>;
}
