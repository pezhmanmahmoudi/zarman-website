"use client";
import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useLocale } from "@/context/LocaleContext";
import { useDashboardRequests } from "@/hooks/useDashboardRequests";
import { useDashboard } from "./DashboardShell";
import { DashboardActivity } from "./DashboardActivity";
import { deleteTransactionSecurely } from "@/app/actions/transaction.actions";
import { dashboardCopy } from "@/lib/dashboard/navigation";
import styles from "@/styles/dashboard/DashboardHome.module.css";
const History = dynamic(() => import("./DashboardTransactionHistory").then(module => module.DashboardTransactionHistory));
export function DashboardHistoryPanel() {
  const locale = useLocale(), copy = dashboardCopy[locale], feed = useDashboardRequests(), account = useDashboard();
  const dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLElement | null>(null);
  const [selected, setSelected] = useState<string | number | null>(null), [busy,setBusy] = useState(false), [error,setError] = useState(false);
  const [showLegacy,setShowLegacy] = useState(false);
  const linked = new Set(feed.requests.map(request => request.transaction_id));
  const legacy = account.transactions.filter(transaction => !linked.has(transaction.id));
  function close() { if (busy) return; dialog.current?.close(); setSelected(null); trigger.current?.focus(); }
  async function cancel() {
    if (busy || selected === null) return;
    setBusy(true); setError(false);
    try {
      const result = await deleteTransactionSecurely(selected);
      if (result?.error) throw new Error("cancel_failed");
      dialog.current?.close(); setSelected(null); trigger.current?.focus();
      await account.refresh();
    } catch { setError(true); }
    finally {setBusy(false);}
  }
  return <div className={styles.page}>
    <div className={styles.pageHeading}><div><h1>{copy.history}</h1><p className={styles.subtitle}>{copy.recentHint}</p></div></div>
    <DashboardActivity {...feed} onRefresh={() => void feed.refresh()}/>
    {!feed.loading && !feed.error && legacy.length > 0 && <details className={styles.legacy} onToggle={event => setShowLegacy(event.currentTarget.open)}><summary>{copy.legacy} ({legacy.length})</summary>{showLegacy && <History transactions={legacy} onDeleteTransaction={(id: string | number) => {trigger.current = document.activeElement as HTMLElement; setError(false); setSelected(id); dialog.current?.showModal();}}/>}</details>}
    <dialog ref={dialog} className={styles.cancelDialog} aria-labelledby="cancel-transaction-title" onCancel={event => {if(busy) event.preventDefault(); else {setSelected(null); trigger.current?.focus();}}}>
      <h2 id="cancel-transaction-title">{locale === "fa" ? "لغو این درخواست؟" : "Cancel this request?"}</h2><p>{locale === "fa" ? "فقط درخواست‌های در انتظار تأیید قابل لغو هستند." : "Only eligible pending requests can be cancelled."}</p>
      {error && <p role="alert">{locale === "fa" ? "لغو ممکن نشد. وضعیت درخواست را بررسی کنید." : "Cancellation failed. Check the request status and try again."}</p>}
      <div><button className={styles.secondary} onClick={close} disabled={busy} autoFocus>{locale === "fa" ? "بازگشت" : "Keep request"}</button><button className={styles.primary} onClick={() => void cancel()} disabled={busy}>{locale === "fa" ? "لغو درخواست" : "Cancel request"}</button></div>
    </dialog>
  </div>;
}
