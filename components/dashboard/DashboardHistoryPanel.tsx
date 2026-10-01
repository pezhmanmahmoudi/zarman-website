"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useReducedMotion } from "framer-motion";
import { Archive, ChevronDown, Plus } from "lucide-react";
import { useLocale } from "@/context/LocaleContext";
import { useDashboardRequestPage } from "@/hooks/useDashboardRequests";
import { useDashboard } from "./DashboardShell";
import { DashboardActivity } from "./DashboardActivity";
import { deleteTransactionSecurely, getLegacyTransactions } from "@/app/actions/transaction.actions";
import type { Transaction } from "@/app/[locale]/dashboard/dashboard.types";
import { dashboardCopy, dashboardHref } from "@/lib/dashboard/navigation";
import { dashboardNumber } from "@/lib/dashboard/numbers";
import { DashboardButton, DashboardPageHeader } from "@/components/dashboard/dashboard-ui";
import { DashboardLottieScene } from "./DashboardLottieScene";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const History = dynamic(() => import("./DashboardTransactionHistory").then(module => module.DashboardTransactionHistory), {
  loading: () => <p role="status" className="m-0 py-4 text-sm text-[#626a76]">…</p>,
});

export function DashboardHistoryPanel() {
  const locale = useLocale(), fa = locale === "fa", copy = dashboardCopy[locale], feed = useDashboardRequestPage(), account = useDashboard();
  const reducedMotion = useReducedMotion(), animate = account.motionEnabled && reducedMotion === false;
  const trigger = useRef<HTMLElement | null>(null), busyRef = useRef(false);
  const [selected, setSelected] = useState<string | number | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const [showLegacy, setShowLegacy] = useState(false);
  const [legacy, setLegacy] = useState<Transaction[]>([]), [legacyAttempt, setLegacyAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    getLegacyTransactions().then(result => { if (active && "data" in result && result.data) setLegacy(result.data); }).catch(() => {});
    return () => { active = false; };
  }, [legacyAttempt]);
  function close() { if (!busyRef.current) setSelected(null); }
  async function cancel() {
    if (busyRef.current || selected === null) return;
    busyRef.current = true; setBusy(true); setError(false);
    try {
      const result = await deleteTransactionSecurely(selected);
      if (result?.error) throw new Error("cancel_failed");
      setSelected(null); setLegacyAttempt(value => value + 1);
    } catch { setError(true); }
    finally { busyRef.current = false; setBusy(false); }
  }
  return <div className="min-w-0 space-y-6 sm:space-y-7">
    <DashboardPageHeader title={copy.history} description={fa ? "پیگیری وضعیت تمامی تراکنش‌ها، از ثبت درخواست تا واریز نهایی." : "Track the status of all your transactions, from request to final payout."} action={<DashboardButton className="min-w-0 flex-1 sm:flex-none" asChild><Link href={dashboardHref(locale, "transfer")}><Plus size={18} aria-hidden="true" />{copy.newTransfer}</Link></DashboardButton>} />
    <DashboardActivity requests={feed.requests} loading={feed.loading} refreshing={feed.refreshing} error={feed.error} onRefresh={feed.refresh} motionEnabled={account.motionEnabled}
      paging={{ filter: feed.filter, search: feed.search, page: feed.page, total: feed.total, counts: feed.counts, onFilter: feed.setFilter, onSearch: feed.setSearch, onPage: feed.setPage }} />
    {!feed.loading && !feed.error && legacy.length > 0 && <details className="group rounded-3xl border border-[#eae8f2] bg-white shadow-[0_1px_2px_#1a1a2e08,0_10px_28px_-20px_#1a1a2e26]" onToggle={event => setShowLegacy(event.currentTarget.open)}>
      <summary className="flex min-h-16 cursor-pointer list-none items-center gap-4 rounded-3xl px-5 py-4 outline-none focus-visible:ring-2 focus-visible:ring-[#635bff]/30 sm:px-7 [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#d0d8e2] bg-[#f0f3f7] text-[#68788d]"><Archive size={20} strokeWidth={1.7} /></span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[#302346]">{copy.legacy}</span><span className="mt-0.5 block text-xs leading-5 text-[#6a6279]">{fa ? `${dashboardNumber(legacy.length, locale)} تراکنش ثبت‌شده پیش از سامانه جدید` : `${dashboardNumber(legacy.length, locale)} recorded before our new transfer system`}</span></span>
        <ChevronDown size={18} aria-hidden="true" className="shrink-0 text-[#7d8490] transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      {showLegacy && <div className="border-t border-[#e4ddef] px-4 py-5 sm:px-7"><History transactions={legacy} onDeleteTransaction={(id: string | number) => { trigger.current = document.activeElement as HTMLElement; setError(false); setSelected(id); }} /></div>}
    </details>}
    <Dialog open={selected !== null} onOpenChange={open => { if (!open) close(); }}>
      <DialogContent showCloseButton={false} dir={fa ? "rtl" : "ltr"} overlayClassName={!animate ? "animate-none! transition-none!" : undefined} className={cn("max-w-[440px] rounded-3xl border border-[#e9ecf0] bg-white p-6 sm:max-w-[440px]", !animate && "animate-none! transition-none!")}
        onEscapeKeyDown={event => { if (busyRef.current) event.preventDefault(); }} onPointerDownOutside={event => { if (busyRef.current) event.preventDefault(); }} onCloseAutoFocus={event => { event.preventDefault(); if (trigger.current?.isConnected) trigger.current.focus(); }}>
        <span aria-hidden="true" className="flex size-16 items-center justify-center rounded-2xl border border-[#eddbb3] bg-[#fff8e8]"><DashboardLottieScene name="warning" size={52} motionEnabled={animate} /></span>
        <DialogTitle className="m-0! text-xl! font-semibold text-[#302346]!">{fa ? "لغو این درخواست؟" : "Cancel this request?"}</DialogTitle>
        <DialogDescription className="text-sm leading-6 text-[#665876]">{fa ? "با لغو، این درخواست بسته می‌شود. فقط درخواست‌های در انتظار تأیید قابل لغو هستند." : "Cancelling closes this request. Only requests still awaiting approval can be cancelled."}</DialogDescription>
        {error && <p role="alert" className="m-0 rounded-2xl bg-[#fff3f3] p-3 text-sm text-[#aa3545]">{fa ? "لغو ممکن نشد. وضعیت درخواست را بررسی کنید." : "Cancellation failed. Check the request status and try again."}</p>}
        <div className="mt-2 flex flex-wrap-reverse justify-end gap-3"><DashboardButton tone="secondary" onClick={close} disabled={busy} autoFocus>{fa ? "بازگشت" : "Keep request"}</DashboardButton><DashboardButton onClick={() => void cancel()} disabled={busy} aria-busy={busy} className="bg-[#aa3545] hover:bg-[#922b39]">{busy ? fa ? "در حال لغو…" : "Cancelling…" : fa ? "لغو درخواست" : "Cancel request"}</DashboardButton></div>
      </DialogContent>
    </Dialog>
  </div>;
}
