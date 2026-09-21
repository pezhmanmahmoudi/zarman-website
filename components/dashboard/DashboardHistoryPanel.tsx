"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "framer-motion";
import { useLocale } from "@/context/LocaleContext";
import { useDashboardRequests } from "@/hooks/useDashboardRequests";
import { useDashboard } from "./DashboardShell";
import { DashboardActivity } from "./DashboardActivity";
import { deleteTransactionSecurely } from "@/app/actions/transaction.actions";
import { dashboardCopy } from "@/lib/dashboard/navigation";
import { DashboardButton, DashboardPageHeader } from "@/components/dashboard/dashboard-ui";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const History = dynamic(() => import("./DashboardTransactionHistory").then(module => module.DashboardTransactionHistory));

export function DashboardHistoryPanel() {
  const locale = useLocale(), fa = locale === "fa", copy = dashboardCopy[locale], feed = useDashboardRequests(), account = useDashboard();
  const reducedMotion = useReducedMotion(), animate = account.motionEnabled && reducedMotion === false;
  const trigger = useRef<HTMLElement | null>(null), busyRef = useRef(false);
  const [selected, setSelected] = useState<string | number | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const [showLegacy, setShowLegacy] = useState(false);
  const linked = new Set(feed.requests.map(request => request.transaction_id)), legacy = account.transactions.filter(transaction => !linked.has(transaction.id));
  function close() { if (!busyRef.current) setSelected(null); }
  async function cancel() {
    if (busyRef.current || selected === null) return;
    busyRef.current = true; setBusy(true); setError(false);
    try {
      const result = await deleteTransactionSecurely(selected);
      if (result?.error) throw new Error("cancel_failed");
      setSelected(null); await account.refresh();
    } catch { setError(true); }
    finally { busyRef.current = false; setBusy(false); }
  }
  return <div className="min-w-0 space-y-6 sm:space-y-7">
    <DashboardPageHeader title={copy.history} description={fa ? "انتقال‌ها و وضعیت هر کدام، یکجا." : "Your transfers and their latest status, together."} />
    <DashboardActivity {...feed} onRefresh={() => void feed.refresh()} motionEnabled={account.motionEnabled} />
    {!feed.loading && !feed.error && legacy.length > 0 && <details className="rounded-2xl border border-[#e9ecf0] bg-[#f5f6f8] p-4 sm:p-5" onToggle={event => setShowLegacy(event.currentTarget.open)}><summary className="min-h-8 cursor-pointer text-sm font-medium text-[#626a76] outline-none focus-visible:ring-2 focus-visible:ring-[#635bff]/30">{copy.legacy} ({legacy.length})</summary>{showLegacy && <div className="mt-4"><History transactions={legacy} onDeleteTransaction={(id: string | number) => { trigger.current = document.activeElement as HTMLElement; setError(false); setSelected(id); }} /></div>}</details>}
    <Dialog open={selected !== null} onOpenChange={open => { if (!open) close(); }}>
      <DialogContent showCloseButton={false} dir={fa ? "rtl" : "ltr"} overlayClassName={!animate ? "animate-none! transition-none!" : undefined} className={cn("max-w-[440px] rounded-3xl border border-[#e9ecf0] bg-white p-6 sm:max-w-[440px]", !animate && "animate-none! transition-none!")}
        onEscapeKeyDown={event => { if (busyRef.current) event.preventDefault(); }} onPointerDownOutside={event => { if (busyRef.current) event.preventDefault(); }} onCloseAutoFocus={event => { event.preventDefault(); if (trigger.current?.isConnected) trigger.current.focus(); }}>
        <DialogTitle className="m-0! text-xl! font-semibold text-[#182027]!">{fa ? "لغو این درخواست؟" : "Cancel this request?"}</DialogTitle>
        <DialogDescription className="text-sm leading-relaxed text-[#626a76]">{fa ? "فقط درخواست‌های در انتظار تأیید قابل لغو هستند." : "Only eligible pending requests can be cancelled."}</DialogDescription>
        {error && <p role="alert" className="m-0 rounded-2xl bg-[#fff3f3] p-3 text-sm text-[#aa3545]">{fa ? "لغو ممکن نشد. وضعیت درخواست را بررسی کنید." : "Cancellation failed. Check the request status and try again."}</p>}
        <div className="mt-2 flex flex-wrap justify-end gap-3"><DashboardButton tone="secondary" onClick={close} disabled={busy} autoFocus>{fa ? "بازگشت" : "Keep request"}</DashboardButton><DashboardButton onClick={() => void cancel()} disabled={busy} aria-busy={busy} className="bg-[#aa3545] hover:bg-[#922b39]">{busy ? fa ? "در حال لغو…" : "Cancelling…" : fa ? "لغو درخواست" : "Cancel request"}</DashboardButton></div>
      </DialogContent>
    </Dialog>
  </div>;
}
