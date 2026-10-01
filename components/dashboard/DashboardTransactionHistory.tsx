"use client";

import { useState } from "react";
import { BadgeCheck, CircleAlert, Clock3 } from "lucide-react";
import type { Transaction } from "@/app/[locale]/dashboard/dashboard.types";
import { requestDate, requestMoney } from "@/components/requests/request-labels";
import { useLocale } from "@/context/LocaleContext";
import { dashboardNumber } from "@/lib/dashboard/numbers";
import { dashboardPalette } from "@/lib/dashboard/palette";
import { DashboardButton, StatusBadge } from "@/components/dashboard/dashboard-ui";

export function DashboardTransactionHistory({ transactions, onDeleteTransaction }: {
  transactions: Transaction[]; onDeleteTransaction: (id: string | number) => void;
}) {
  const locale = useLocale(), fa = locale === "fa", [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(transactions.length / 10)), current = Math.min(page, pages);
  const visible = transactions.slice((current - 1) * 10, current * 10);
  const labels = { approved: fa ? "تکمیل‌شده" : "Completed", pending: fa ? "در حال بررسی" : "Under review", rejected: fa ? "رد شده" : "Declined", cancelled: fa ? "لغو شده" : "Cancelled" };
  return <article aria-label={fa ? "سوابق تراکنش‌ها" : "Transaction records"}>
    <div role="list" className="grid gap-3">
      {visible.map(tx => {
        const palette = dashboardPalette[tx.status === "approved" ? "emerald" : tx.status === "pending" ? "violet" : tx.status === "rejected" ? "rose" : "slate"];
        const Icon = tx.status === "approved" ? BadgeCheck : tx.status === "pending" ? Clock3 : CircleAlert;
        return <div role="listitem" key={tx.id} data-tone={tx.status} className="min-w-0 rounded-2xl border px-4 py-4 sm:px-5" style={{ borderColor: palette.border, background: `linear-gradient(110deg, #ffffffed, ${palette.soft}bb)` }}>
          <div className="flex min-w-0 items-start gap-3">
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-white/80" style={{ color: palette.accent, borderColor: palette.border }}><Icon size={20} strokeWidth={1.7} /></span>
            <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-3 gap-y-2">
              <div className="min-w-0 flex-1 basis-32"><p className="m-0 truncate text-sm font-semibold leading-relaxed text-[#302b43]" data-private-value>{tx.recipients?.full_name || tx.recipients?.account_name || tx.recipients?.label || tx.reference_code || (fa ? "انتقال وجه" : "Money transfer")}</p><bdi className="mt-1 block text-xs text-[#6a6279]">{tx.reference_code || "—"}</bdi></div>
              <div className="max-w-full text-start sm:text-end"><bdi data-private-value className="block text-sm font-semibold leading-relaxed text-[#302b43] tabular-nums">{requestMoney(tx.amount_aud, "AUD", locale)}</bdi><bdi data-private-value className="mt-1 block text-xs text-[#6a6279] tabular-nums">{requestMoney(tx.equivalent_toman, "IRT", locale)}</bdi></div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2"><StatusBadge tone={tx.status === "approved" ? "success" : tx.status === "rejected" ? "danger" : "neutral"}>{labels[tx.status]}</StatusBadge><span className="text-xs font-medium" style={{ color: palette.ink }} data-actor={tx.status === "pending" ? "zarman" : tx.status === "approved" ? "complete" : "closed"}>{tx.status === "pending" ? fa ? "در حال بررسی توسط زرمان" : "Under review by Zarman" : tx.status === "approved" ? fa ? "تکمیل شده" : "Complete" : fa ? "بسته شده" : "Closed"}</span></div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#6a6279]"><time dir="ltr" dateTime={tx.created_at}>{requestDate(tx.created_at, locale)}</time>
            {tx.status === "pending" && <DashboardButton tone="quiet" onClick={() => onDeleteTransaction(tx.id)} className="min-h-9 px-3 py-1.5 text-xs text-[#aa3545] hover:bg-[#fff0f2] hover:text-[#922b39]" aria-label={`${fa ? "لغو درخواست" : "Cancel request"} ${tx.reference_code || ""}`}>{fa ? "لغو درخواست" : "Cancel request"}</DashboardButton>}
          </div>
        </div>;
      })}
    </div>
    {!visible.length && <p className="m-0 py-6 text-center text-sm text-[#6a6279]">{fa ? "سابقه‌ای وجود ندارد." : "No transaction records."}</p>}
    {pages > 1 && <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><DashboardButton tone="secondary" onClick={() => setPage(current - 1)} disabled={current === 1} aria-label={fa ? "صفحه قبل" : "Previous page"}>{fa ? "قبلی" : "Previous"}</DashboardButton><span className="text-xs font-medium text-[#6a6279]">{dashboardNumber(current, locale)} / {dashboardNumber(pages, locale)}</span><DashboardButton tone="secondary" onClick={() => setPage(current + 1)} disabled={current === pages} aria-label={fa ? "صفحه بعد" : "Next page"}>{fa ? "بعدی" : "Next"}</DashboardButton></div>}
  </article>;
}
