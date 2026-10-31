"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Mail } from "lucide-react";
import { getCompletionEmailStatus, sendCompletionEmail } from "@/app/actions/request.actions";
import type { CompletionEmailState } from "@/lib/requests/types";
import styles from "@/styles/admin/AdminWorkspace.module.css";

const POLL_MS = 3_000;
const MAX_POLLS = 10;

/** Sends the completion email (with the receipt) for a request completed without the email box ticked. */
export function CompletionEmailAction({ requestId }: { requestId: string }) {
  const [current, setCurrent] = useState<CompletionEmailState["state"] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await getCompletionEmailStatus(requestId);
    if (response.data) setCurrent(response.data.state);
  }, [requestId]);

  useEffect(() => {
    let live = true;
    void getCompletionEmailStatus(requestId).then(response => { if (live && response.data) setCurrent(response.data.state); });
    return () => { live = false; };
  }, [requestId]);

  // Delivery runs in the background after the click; follow it until it settles.
  useEffect(() => {
    if (current !== "sending") return;
    let polls = 0;
    const timer = setInterval(() => {
      polls += 1;
      void refresh();
      if (polls >= MAX_POLLS) clearInterval(timer);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [current, refresh]);

  async function send() {
    setBusy(true); setError(null);
    const response = await sendCompletionEmail(requestId);
    setBusy(false);
    if (response.error !== undefined) { setError(response.error); return; }
    setCurrent(response.data.state);
  }

  if (current === null) return null;
  if (current === "sent") return <span className={styles.emailSent} role="status"><Check size={15} aria-hidden="true" />Sent</span>;
  if (current === "sending") return <span className={styles.emailSent} role="status" data-pending><Loader2 size={15} aria-hidden="true" />Sending…</span>;
  return <>
    <button type="button" className={styles.action} onClick={send} disabled={busy}>
      <Mail size={15} aria-hidden="true" />{busy ? "Sending…" : current === "failed" ? "Retry email" : "Send email"}
    </button>
    {current === "failed" && !error && <p className={styles.description}>The last email attempt failed.</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
  </>;
}
