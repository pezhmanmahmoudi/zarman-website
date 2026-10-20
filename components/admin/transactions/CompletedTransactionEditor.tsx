"use client";

import { useRef, useState, type FormEvent } from "react";
import { LoaderCircle, Pencil } from "lucide-react";
import { correctCompletedTransactionAmounts, getCompletedTransactionCorrection } from "@/app/actions/transaction-correction.actions";
import { useAdminRefresh } from "@/components/admin/ui/useAdminRefresh";
import { isMoney } from "@/lib/requests/validation";
import { isRequestConflict } from "@/lib/requests/conflicts";
import type { CompletedTransactionCorrection } from "@/lib/transaction-corrections";
import { requestMoney } from "@/components/requests/request-labels";
import styles from "@/styles/requests/RequestPricing.module.css";

export function CompletedTransactionEditor({ transactionId, disabled = false, onSaved, onBusyChange }: {
  transactionId: string;
  disabled?: boolean;
  onSaved?: () => Promise<void> | void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const refreshAdmin = useAdminRefresh();
  const [context, setContext] = useState<CompletedTransactionCorrection | null>(null);
  const [funding, setFunding] = useState("");
  const [recipient, setRecipient] = useState("");
  const [deposits, setDeposits] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const pending = useRef(false);
  const attempt = useRef<{ signature: string; key: string } | null>(null);

  async function open() {
    if (pending.current || disabled) return;
    pending.current = true; setBusy(true); onBusyChange?.(true); setError(""); setNotice("");
    try {
      const result = await getCompletedTransactionCorrection(transactionId);
      if (result.error) { setError(result.error); return; }
      if (result.data) {
        setContext(result.data); setFunding(String(result.data.fundingTotal)); setRecipient(String(result.data.recipientAmount));
        setDeposits(Object.fromEntries(result.data.payments.map(payment => [payment.id, String(payment.amount)])));
        setReason(""); setStale(false); attempt.current = null;
      }
    } catch { setError("The current amounts could not be loaded. Try again."); }
    finally { pending.current = false; setBusy(false); onBusyChange?.(false); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context || pending.current || disabled || stale) return;
    const fundingTotal = Number(funding), recipientAmount = Number(recipient);
    const valid = (value: number, currency: "AUD" | "IRT") => isMoney(value) && (currency !== "IRT" || Number.isInteger(value));
    if (!valid(fundingTotal, context.fundingCurrency) || !valid(recipientAmount, context.recipientCurrency)) {
      setError("Enter whole Toman amounts and AUD amounts with at most two decimal places."); return;
    }
    if (fundingTotal === Number(context.fundingTotal) && recipientAmount === Number(context.recipientAmount)) {
      setError("Change a transfer amount before saving."); return;
    }
    if (reason.trim().length < 3 || reason.trim().length > 1000) { setError("Enter the reason for the correction (3–1,000 characters)."); return; }
    const payments = context.payments.map(payment => ({ id: payment.id,
      amount: context.payments.length === 1 ? fundingTotal : Number(deposits[payment.id]) }));
    if (context.requestId && (payments.some(payment => payment.amount !== 0 && !valid(payment.amount, context.fundingCurrency))
      || Math.round(payments.reduce((total, payment) => total + payment.amount, 0) * 100) !== Math.round(fundingTotal * 100))) {
      setError("The recorded deposits must add up to the corrected customer payment."); return;
    }
    const payload = { transactionId, revision: context.revision, fundingTotal, recipientAmount, reason: reason.trim(), payments };
    const signature = JSON.stringify(payload);
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() };
    pending.current = true; setBusy(true); onBusyChange?.(true); setError("");
    try {
      const result = await correctCompletedTransactionAmounts({ ...payload, commandKey: attempt.current.key });
      if (result.error) { setError(result.error); if (isRequestConflict(result)) setStale(true); return; }
      if (result.data) {
        setContext(null); attempt.current = null; setNotice("Amounts updated.");
        refreshAdmin();
        try { await onSaved?.(); } catch { setNotice("Amounts saved. Refresh to see the updated record."); }
      }
    } catch { setError("The correction was not confirmed. Retry the same values or reload the amounts."); }
    finally { pending.current = false; setBusy(false); onBusyChange?.(false); }
  }

  return <>
    {!context && <button type="button" className={styles.editAmounts} disabled={busy || disabled} aria-busy={busy} onClick={open}>
      {busy ? <LoaderCircle size={16} className={styles.loadingIcon} aria-hidden="true" /> : <Pencil size={16} aria-hidden="true" />}
      <span>{busy ? "Loading…" : "Edit amounts"}</span>
    </button>}
    {context && <form className={styles.form} onSubmit={save} aria-label="Correct completed transfer amounts">
      <label>Customer pays ({context.fundingCurrency === "IRT" ? "Toman" : "AUD"})
        <input autoFocus type="number" min={context.fundingCurrency === "IRT" ? 1 : 0.01} step={context.fundingCurrency === "IRT" ? 1 : 0.01}
          value={funding} onChange={event => setFunding(event.target.value)} disabled={busy || stale} required />
        <span>Recorded: {requestMoney(context.fundingTotal, context.fundingCurrency, "en")}</span>
      </label>
      <label>Recipient gets ({context.recipientCurrency === "IRT" ? "Toman" : "AUD"})
        <input type="number" min={context.recipientCurrency === "IRT" ? 1 : 0.01} step={context.recipientCurrency === "IRT" ? 1 : 0.01}
          value={recipient} onChange={event => setRecipient(event.target.value)} disabled={busy || stale} required />
        <span>Recorded: {requestMoney(context.recipientAmount, context.recipientCurrency, "en")}</span>
      </label>
      {context.payments.length > 1 && <div className={styles.wide}>
        <p className={styles.caption}>Allocate the corrected customer payment to its recorded deposits.</p>
        {context.payments.map(payment => <label key={payment.id}>{payment.accountName} · {payment.reference}
          <input type="number" min="0" step={context.fundingCurrency === "IRT" ? 1 : 0.01} value={deposits[payment.id] ?? ""}
            onChange={event => setDeposits(previous => ({ ...previous, [payment.id]: event.target.value }))} disabled={busy || stale} required />
        </label>)}
      </div>}
      <label className={styles.wide}>Reason for correction
        <textarea value={reason} onChange={event => setReason(event.target.value)} minLength={3} maxLength={1000} disabled={busy || stale} required />
      </label>
      <p className={`${styles.caption} ${styles.wide}`}>Updates the customer record and receipt. The rate is recalculated using the recorded service fees, while ledger entries remain independent.</p>
      {error && <p className={`${styles.error} ${styles.wide}`} role="alert">{error}</p>}
      <div className={`${styles.actions} ${styles.wide}`}>
        {stale ? <button type="button" onClick={open} disabled={busy || disabled}>Reload amounts</button>
          : <button type="submit" className={styles.save} disabled={busy || disabled}>{busy ? "Saving…" : "Save correction"}</button>}
        <button type="button" disabled={busy} onClick={() => { setContext(null); setError(""); }}>Cancel</button>
      </div>
    </form>}
    {!context && error && <p className={styles.error} role="alert">{error}</p>}
    {notice && <p className={styles.caption} role="status">{notice}</p>}
  </>;
}
