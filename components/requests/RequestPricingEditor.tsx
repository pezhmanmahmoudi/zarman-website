"use client";

import { useRef, useState } from "react";
import { ArrowRight, Pencil } from "lucide-react";
import { updateAdminRequestPricing } from "@/app/actions/request.actions";
import type { ExchangeRequest } from "@/lib/requests/types";
import { isRequestConflict } from "@/lib/requests/conflicts";
import { isMoney } from "@/lib/requests/validation";
import { requestMoney } from "./request-labels";
import { RequestPricingDetails } from "./RequestPricingDetails";
import styles from "@/styles/requests/RequestPricing.module.css";
import workspace from "@/styles/requests/RequestWorkspace.module.css";

export function RequestPricingEditor({ request, disabled, onSaved, onBusyChange, onRefresh }: {
  request: ExchangeRequest; disabled: boolean; onSaved: (request: ExchangeRequest) => void; onBusyChange: (busy: boolean) => void; onRefresh?: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [funding, setFunding] = useState("");
  const [recipient, setRecipient] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const baseVersion = useRef(request.version);
  const pending = useRef(false);
  const stale = useRef(false);
  const attempt = useRef<{ signature: string; key: string } | null>(null);
  const editable = ["submitted", "under_review", "action_required", "awaiting_funds"].includes(request.status)
    && request.funding_status === "unpaid" && Number(request.funding_received) === 0 && !request.evidence_submitted_at;
  const open = () => {
    if (disabled || !editable) return;
    setFunding(String(request.quote.funding_total)); setRecipient(String(request.quote.recipient_amount));
    setReason(""); setError(""); baseVersion.current = request.version; attempt.current = null; stale.current = false; setEditing(true);
  };
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || disabled || !editable) return;
    if (stale.current) { baseVersion.current = request.version; stale.current = false; }
    const fundingTotal = Number(funding), recipientAmount = Number(recipient);
    if (!isMoney(fundingTotal) || !isMoney(recipientAmount)
      || (request.quote.funding_currency === "IRT" && !Number.isInteger(fundingTotal))
      || (request.quote.recipient_currency === "IRT" && !Number.isInteger(recipientAmount))) {
      setError("Enter whole Toman amounts and AUD amounts with at most two decimal places."); return;
    }
    if (reason.trim().length < 3 || reason.trim().length > 1000) { setError("Enter the reason for this correction (3–1,000 characters)."); return; }
    const payload = { requestId: request.id, expectedVersion: baseVersion.current, fundingTotal, recipientAmount, reason: reason.trim() };
    const signature = JSON.stringify(payload);
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() };
    pending.current = true; setSaving(true); onBusyChange(true); setError("");
    try {
      const result = await updateAdminRequestPricing({ ...payload, commandKey: attempt.current.key });
      if (result.error) {
        setError(result.error);
        if (isRequestConflict(result)) {
          attempt.current = null; stale.current = true;
          await onRefresh?.();
        }
      }
      else if (result.data) { onSaved(result.data); setEditing(false); attempt.current = null; }
    } catch { setError("The correction was not confirmed. Refresh the request, or retry these same values."); }
    finally { pending.current = false; setSaving(false); onBusyChange(false); }
  }
  return <>
    <div className={workspace.summaryFlow}>
      <div><span>Customer pays {editable && <button type="button" className={styles.edit} disabled={disabled} onClick={open} aria-label="Edit customer payment and recipient amount"><Pencil size={14}/></button>}</span><strong><bdi>{requestMoney(request.quote.funding_total, request.quote.funding_currency, "en")}</bdi></strong></div>
      <ArrowRight size={18} aria-hidden="true" className={workspace.summaryArrow}/>
      <div><span>Recipient gets {editable && <button type="button" className={styles.edit} disabled={disabled} onClick={open} aria-label="Edit recipient amount and customer payment"><Pencil size={14}/></button>}</span><strong><bdi>{requestMoney(request.quote.recipient_amount, request.quote.recipient_currency, "en")}</bdi></strong></div>
    </div>
    <RequestPricingDetails request={request}/>
    {editing && <form className={styles.form} onSubmit={save} aria-label="Correct transfer amounts">
      <label>Customer pays ({request.quote.funding_currency === "IRT" ? "Toman" : "AUD"})<input autoFocus type="number" min={request.quote.funding_currency === "IRT" ? "1" : "0.01"} step={request.quote.funding_currency === "IRT" ? "1" : "0.01"} value={funding} onChange={event => setFunding(event.target.value)} disabled={saving} required/></label>
      <label>Recipient gets ({request.quote.recipient_currency === "IRT" ? "Toman" : "AUD"})<input type="number" min={request.quote.recipient_currency === "IRT" ? "1" : "0.01"} step={request.quote.recipient_currency === "IRT" ? "1" : "0.01"} value={recipient} onChange={event => setRecipient(event.target.value)} disabled={saving} required/></label>
      <label className={styles.wide}>Reason for correction<textarea value={reason} onChange={event => setReason(event.target.value)} minLength={3} maxLength={1000} disabled={saving} required/></label>
      <p className={`${styles.caption} ${styles.wide}`}>The rate is calculated from these amounts and the existing fees. The original quote is retained. The customer must accept the revised amounts before payment is approved.</p>
      {error && <p className={`${styles.error} ${styles.wide}`} role="alert">{error}</p>}
      <div className={`${styles.actions} ${styles.wide}`}><button type="submit" className={styles.save} disabled={disabled || saving || !editable}>{saving ? "Saving…" : "Save revised amounts"}</button><button type="button" disabled={saving} onClick={() => setEditing(false)}>Cancel</button></div>
    </form>}
    {!editable && request.funding_status !== "confirmed" && ["awaiting_funds", "under_review", "action_required"].includes(request.status) && <span className={styles.caption}>Confirm or change the final amounts in the next step.</span>}
  </>;
}
