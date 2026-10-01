"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck, Hourglass, ReceiptText, RefreshCw, SearchX, Send } from "lucide-react";
import { useLocale } from "@/context/LocaleContext";
import { dashboardCopy, dashboardHref } from "@/lib/dashboard/navigation";
import { filterDashboardRequests, requestNeedsAttention, type ActivityFilter } from "@/lib/dashboard/activity";
import { dashboardNumber } from "@/lib/dashboard/numbers";
import { getRequestJourney } from "@/lib/requests/journey";
import { DashboardButton, DashboardMagicCard } from "@/components/dashboard/dashboard-ui";
import { DashboardEmptyState as ActivityState, DashboardFilterPills, DashboardListFooter, DashboardListHeader, DashboardListToolbar, DashboardPagination, DashboardSearchInput, pageSlice } from "./dashboard-list";
import { DASHBOARD_PAGE_SIZE } from "@/lib/dashboard/paging";
import { TransactionSummaryCard } from "./TransactionSummaryCard";
import type { ExchangeRequest } from "@/lib/requests/types";

/** Customer-action items first, then other in-progress transfers, then finished records. */
function listRank(request: ExchangeRequest) {
  if (requestNeedsAttention(request)) return 0;
  return !getRequestJourney(request).closed && request.status !== "completed" ? 1 : 2;
}

export type ActivityPaging = { filter: ActivityFilter; search: string; page: number; total: number; counts: Record<ActivityFilter, number>; onFilter: (filter: ActivityFilter) => void; onSearch: (search: string) => void; onPage: (page: number) => void };

/** With `paging`, `requests` is already the server page; without it the list is filtered and paged locally. */
export function DashboardActivity({ requests, loading, refreshing, error, onRefresh, motionEnabled = true, paging }: {
  requests: ExchangeRequest[]; loading: boolean; refreshing: boolean; error: boolean; onRefresh: () => void; motionEnabled?: boolean; paging?: ActivityPaging;
}) {
  const locale = useLocale(), fa = locale === "fa", copy = dashboardCopy[locale];
  const text = (en: string, persian: string) => fa ? persian : en;
  const [localFilter, setLocalFilter] = useState<ActivityFilter>("all"), [localSearch, setLocalSearch] = useState(""), [localPage, setLocalPage] = useState(1);
  const listRef = useRef<HTMLDivElement>(null);
  const filter = paging?.filter ?? localFilter, search = paging?.search ?? localSearch;
  const local = paging ? null : pageSlice(filterDashboardRequests(requests, filter, search).sort((a, b) => listRank(a) - listRank(b)), localPage);
  const visible = local ? local.items : requests, total = paging ? paging.total : local!.total;
  const current = paging ? paging.page : local!.page, pageCount = Math.max(1, Math.ceil(total / DASHBOARD_PAGE_SIZE)), start = (current - 1) * DASHBOARD_PAGE_SIZE;
  const hasAny = paging ? paging.counts.all > 0 : requests.length > 0;
  const filters = ([["all", copy.all], ["active", copy.inProgress], ["attention", copy.attention], ["completed", copy.completed]] as const)
    .map(([value, label]) => ({ value, label, shortLabel: value === "attention" ? text("Action needed", "نیازمند اقدام") : undefined, count: paging ? paging.counts[value] : filterDashboardRequests(requests, value, "").length, attention: value === "attention" }));
  function choose(next: ActivityFilter) { if (paging) paging.onFilter(next); else { setLocalFilter(next); setLocalPage(1); } }
  function find(value: string) { if (paging) paging.onSearch(value); else { setLocalSearch(value); setLocalPage(1); } }
  function goTo(next: number) { if (paging) paging.onPage(next); else setLocalPage(next); listRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }); }

  return <DashboardMagicCard tone="violet" motionEnabled={motionEnabled} contentClassName="p-0 sm:p-0" aria-label={copy.history} data-activity-directory>
    <DashboardListHeader title={text("Transaction List", "لیست تراکنش‌ها")} description={text("View your transaction status at a glance. Click any item for full details.", "وضعیت تراکنش‌های خود را در یک نگاه ببینید. برای مشاهده جزئیات، روی هر مورد کلیک کنید.")} scene="activity-history" motionEnabled={motionEnabled} />
    <DashboardListToolbar>
      <DashboardFilterPills label={text("Filter transactions", "فیلتر تراکنش‌ها")} options={filters} value={filter} onChange={choose} dataKey="data-activity-filter" locale={locale} />
      <DashboardSearchInput value={search} onChange={find} label={copy.search} placeholder={copy.search} clearLabel={text("Clear search", "پاک کردن جستجو")} />
    </DashboardListToolbar>
    {error && hasAny && <div role="alert" className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#eddbb3] bg-[#fff8e8] px-4 py-3 text-sm leading-relaxed text-[#765018] sm:mx-7"><span>{copy.refreshError}</span><DashboardButton tone="secondary" onClick={onRefresh} disabled={refreshing}><RefreshCw size={16} aria-hidden="true" />{copy.retry}</DashboardButton></div>}
    <div ref={listRef} aria-busy={loading || refreshing} className="scroll-mt-24">
      {loading && !hasAny ? <ActivityState role="status" title={text("Loading your transactions…", "در حال دریافت تراکنش‌ها…")} />
        : error && !hasAny ? <ActivityState role="alert" icon={CircleAlert} title={text("We couldn’t load your transactions.", "دریافت تراکنش‌ها ممکن نشد.")} description={text("Please check your connection and try again.", "لطفاً اتصال اینترنت خود را بررسی کنید و دوباره تلاش کنید.")} action={<DashboardButton tone="secondary" onClick={onRefresh} disabled={refreshing}><RefreshCw size={16} aria-hidden="true" />{copy.retry}</DashboardButton>} />
          : !hasAny ? <ActivityState icon={Send} title={copy.noTransfers} description={copy.noTransfersHint} action={<DashboardButton asChild><Link href={dashboardHref(locale, "transfer")}>{copy.newTransfer}</Link></DashboardButton>} />
            : !visible.length ? search.trim() ? <ActivityState icon={SearchX} title={text("No Transactions Found", "تراکنشی یافت نشد")} />
              : filter === "attention" ? <ActivityState icon={CircleCheck} title={text("You’re All Caught Up", "همه‌چیز مرتب است")} description={text("Currently, there are no transactions waiting for your review or action.", "در حال حاضر هیچ تراکنشی منتظر بررسی یا اقدام از سوی شما نیست.")} action={<DashboardButton tone="secondary" onClick={() => choose("all")}>{text("View All Transactions", "مشاهده همه تراکنش‌ها")}</DashboardButton>} />
                : filter === "active" ? <ActivityState icon={Hourglass} title={text("No Transactions in Progress", "تراکنش در حال انجامی ندارید")} description={text("No transactions are being processed right now. Once you submit a new transfer, you can follow every step here.", "در حال حاضر هیچ تراکنشی در حال پردازش نیست. پس از ثبت انتقال جدید، مراحل آن را اینجا دنبال کنید.")} action={<DashboardButton asChild><Link href={dashboardHref(locale, "transfer")}>{copy.newTransfer}</Link></DashboardButton>} />
                  : <ActivityState icon={ReceiptText} title={text("No Completed Transactions Yet", "هنوز تراکنش تکمیل‌شده‌ای ندارید")} description={text("Completed transactions and their receipts will appear here.", "تراکنش‌های تکمیل‌شده همراه با رسید آن‌ها اینجا نمایش داده می‌شوند.")} action={<DashboardButton tone="secondary" onClick={() => choose("all")}>{text("View All Transactions", "مشاهده همه تراکنش‌ها")}</DashboardButton>} />
              : <ul aria-label={copy.history} className="m-0 grid list-none gap-4 p-4 sm:gap-5 sm:p-6 lg:grid-cols-2">{visible.map(request => <li key={request.id} className="min-w-0"><TransactionSummaryCard request={request} locale={locale} stageMotion={motionEnabled} /></li>)}</ul>}
    </div>
    {visible.length > 0 && <DashboardListFooter><span className="text-xs font-medium text-[#6a6279]" aria-live="polite">{fa ? `${dashboardNumber(start + 1, locale)} تا ${dashboardNumber(start + visible.length, locale)} از ${dashboardNumber(total, locale)} تراکنش` : `Showing ${dashboardNumber(start + 1, locale)}–${dashboardNumber(start + visible.length, locale)} of ${dashboardNumber(total, locale)} transactions`}</span><DashboardPagination page={current} pageCount={pageCount} onChange={goTo} label={text("Transaction pages", "صفحه‌های تراکنش‌ها")} locale={locale} /></DashboardListFooter>}
  </DashboardMagicCard>;
}
