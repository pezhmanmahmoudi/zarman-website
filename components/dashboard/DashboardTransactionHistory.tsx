"use client";

import { useState } from "react";
import type { Transaction } from "@/app/[locale]/dashboard/dashboard.types";
import { requestDate, requestMoney } from "@/components/requests/request-labels";
import { useLocale } from "@/context/LocaleContext";
import { DashboardButton, DashboardCard, StatusBadge } from "@/components/dashboard/dashboard-ui";

export function DashboardTransactionHistory({ transactions, onDeleteTransaction }: {
  transactions: Transaction[]; onDeleteTransaction: (id: string | number) => void;
}) {
  const locale = useLocale(), fa = locale === "fa", [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(transactions.length / 10)), current = Math.min(page, pages);
  const visible = transactions.slice((current - 1) * 10, current * 10);
  const labels = { approved: fa ? "تکمیل‌شده" : "Completed", pending: fa ? "در حال بررسی" : "Under review", rejected: fa ? "رد شده" : "Declined", cancelled: fa ? "لغو شده" : "Cancelled" };
  return <article aria-label={fa ? "سوابق تراکنش‌ها" : "Transaction records"}>
    <DashboardCard className="overflow-hidden p-0 sm:p-0">
      <header className="border-b border-[#e9ecf0] px-5 py-5 sm:px-6"><h2 className="m-0! text-lg font-semibold text-[#182027]!">{fa ? "سوابق تراکنش‌ها" : "Transaction records"}</h2></header>
      {visible.map(tx => <div className="grid min-w-0 gap-3 border-b border-[#e9ecf0] px-5 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-6" key={tx.id}>
        <div className="min-w-0"><p className="m-0 truncate text-sm font-semibold text-[#182027]" data-private-value>{tx.recipients?.full_name || tx.recipients?.account_name || tx.recipients?.label || tx.reference_code || (fa ? "انتقال وجه" : "Money transfer")}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#626a76]"><bdi>{tx.reference_code || "—"}</bdi><time dir="ltr" dateTime={tx.created_at}>{requestDate(tx.created_at, locale)}</time></div>
          <div className="mt-3 flex flex-wrap items-center gap-3"><StatusBadge tone={tx.status === "approved" ? "success" : tx.status === "rejected" ? "danger" : "neutral"}>{labels[tx.status]}</StatusBadge><span className="text-xs text-[#626a76]" data-actor={tx.status === "pending" ? "zarman" : tx.status === "approved" ? "complete" : "closed"}>{tx.status === "pending" ? fa ? "نزد زرمان" : "With Zarman" : tx.status === "approved" ? fa ? "تکمیل شده" : "Complete" : fa ? "بسته شده" : "Closed"}</span></div>
        </div>
        <div className="min-w-0 sm:text-end"><bdi data-private-value className="block text-sm font-semibold text-[#182027] tabular-nums">{requestMoney(tx.amount_aud, "AUD", locale)}</bdi><bdi data-private-value className="mt-1 block text-xs text-[#626a76] tabular-nums">{requestMoney(tx.equivalent_toman, "IRT", locale)}</bdi>
          {tx.status === "pending" && <DashboardButton tone="quiet" onClick={() => onDeleteTransaction(tx.id)} className="mt-2 text-[#aa3545]" aria-label={`${fa ? "لغو درخواست" : "Cancel request"} ${tx.reference_code || ""}`}>{fa ? "لغو" : "Cancel"}</DashboardButton>}
        </div>
      </div>)}
      {!visible.length && <p className="m-0 px-5 py-8 text-sm text-[#626a76] sm:px-6">{fa ? "سابقه‌ای وجود ندارد." : "No transaction records."}</p>}
      {pages > 1 && <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6"><DashboardButton tone="quiet" onClick={() => setPage(current - 1)} disabled={current === 1} aria-label={fa ? "صفحه قبل" : "Previous page"}>{fa ? "قبلی" : "Previous"}</DashboardButton><span className="text-xs text-[#626a76]">{current} / {pages}</span><DashboardButton tone="quiet" onClick={() => setPage(current + 1)} disabled={current === pages} aria-label={fa ? "صفحه بعد" : "Next page"}>{fa ? "بعدی" : "Next"}</DashboardButton></div>}
    </DashboardCard>
  </article>;
}
