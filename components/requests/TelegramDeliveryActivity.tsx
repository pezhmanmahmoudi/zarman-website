"use client";

import { useRef, useState } from "react";
import { Send } from "lucide-react";
import { retryCustomerTelegram } from "@/app/actions/customer-telegram.actions";
import type { CustomerTelegramDelivery } from "@/lib/notifications/customer-telegram-types";
import { requestDate } from "./request-labels";
import { requestActivityLabel } from "@/lib/requests/journey";
import styles from "@/styles/requests/RequestWorkspace.module.css";

const labels = { pending: "Awaiting send", sending: "Sending", sent: "Sent to Telegram", failed: "Not sent", uncertain: "Delivery unconfirmed — check before retrying", cancelled: "Cancelled · connection unavailable" };
export function TelegramDeliveryActivity({ requestId, deliveries, unavailable, onUpdated }: { requestId: string; deliveries: CustomerTelegramDelivery[]; unavailable?: boolean; onUpdated: () => Promise<void> }) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const pending = useRef(false);
  async function retry(delivery: CustomerTelegramDelivery) {
    if (pending.current) return;
    pending.current = true; setBusy(delivery.id); setError("");
    try {
      const result = await retryCustomerTelegram({ requestId, deliveryId: delivery.id, allowDuplicate: confirmId === delivery.id });
      if (result.error) setError(result.error === "disconnected" ? "The customer has disconnected Telegram." : "Could not queue this notification. Refresh and try again.");
      else { setConfirmId(null); await onUpdated(); }
    } catch { setError("Could not queue this notification. Refresh and try again."); }
    finally { pending.current = false; setBusy(null); }
  }
  if (!deliveries.length && !unavailable) return null;
  return <section aria-label="Customer Telegram notifications">
    <h3 className="mb-3 mt-5 text-sm font-semibold">Customer Telegram</h3>
    {unavailable && <p role="status" className="text-sm text-amber-800">Telegram delivery history could not be loaded. Refresh to try again.</p>}
    <ul className={styles.emailActivity}>{deliveries.map(delivery => {
      const status = delivery.status;
      return <li key={delivery.id}>
      <span><Send size={13}/>{requestActivityLabel(delivery.event_type,"en")}</span><span>{labels[status]}</span><time className="text-xs" dateTime={delivery.created_at}>{requestDate(delivery.created_at,"en")}</time>
      {["pending","failed"].includes(status) && <button type="button" className={styles.emailRetry} disabled={busy !== null} onClick={() => void retry(delivery)}>{busy === delivery.id ? "Sending…" : "Retry Telegram"}</button>}
      {status === "uncertain" && (confirmId !== delivery.id ? <button type="button" className={styles.emailRetry} disabled={busy !== null} onClick={() => setConfirmId(delivery.id)}>Review retry</button> : <div className="basis-full rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm" role="group" aria-label="Confirm Telegram retry"><p className="mb-2">Telegram may already have delivered this message. Sending again may duplicate it.</p><button type="button" className={styles.emailRetry} disabled={busy !== null} onClick={() => void retry(delivery)}>Send again</button><button type="button" className="ms-4 min-h-11 underline" disabled={busy !== null} onClick={() => setConfirmId(null)}>Cancel</button></div>)}
    </li>;
    })}</ul>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
  </section>;
}
