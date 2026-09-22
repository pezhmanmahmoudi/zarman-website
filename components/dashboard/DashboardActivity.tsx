"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale } from "@/context/LocaleContext";
import { dashboardCopy, dashboardHref } from "@/lib/dashboard/navigation";
import { filterDashboardRequests, type ActivityFilter } from "@/lib/dashboard/activity";
import { AnimatedList } from "@/components/ui/animated-list";
import { dashboardNumber } from "@/lib/dashboard/numbers";
import { DashboardButton, DashboardCard, dashboardInputClass } from "@/components/dashboard/dashboard-ui";
import { TransferActivityRow } from "./recent-activity-list";
import { cn } from "@/lib/utils";
import type { ExchangeRequest } from "@/lib/requests/types";

export function DashboardActivity({ requests, loading, refreshing, error, onRefresh, compact = false, motionEnabled = true }: {
  requests: ExchangeRequest[]; loading: boolean; refreshing: boolean; error: boolean; onRefresh: () => void; compact?: boolean; motionEnabled?: boolean;
}) {
  const locale = useLocale(), fa = locale === "fa", copy = dashboardCopy[locale];
  const [filter, setFilter] = useState<ActivityFilter>("all"), [search, setSearch] = useState(""), [limit, setLimit] = useState(20);
  const filtered = filterDashboardRequests(requests, filter, search), visible = filtered.slice(0, compact ? 4 : limit);
  return <section aria-label={compact ? copy.recent : copy.history} className="min-w-0">
    <DashboardCard className="overflow-hidden p-0 sm:p-0">
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6"><h2 className="m-0! text-lg font-semibold text-[#182027]!">{compact ? copy.recent : fa ? "انتقال‌های شما" : "Your transfers"}</h2>
        {compact ? <DashboardButton tone="quiet" asChild><Link href={dashboardHref(locale, "history")}>{copy.allActivity}</Link></DashboardButton> : <DashboardButton tone="quiet" onClick={onRefresh} disabled={refreshing} aria-label={copy.refresh}>{refreshing ? fa ? "در حال تازه‌سازی…" : "Refreshing…" : copy.refresh}</DashboardButton>}
      </header>
      {!compact && <div className="flex flex-col gap-4 border-b border-[#e9ecf0] px-5 pb-5 pt-4 sm:px-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-1 rounded-2xl bg-[#f5f6f8] p-1" role="group" aria-label={fa ? "فیلتر فعالیت‌ها" : "Filter activity"}>
          {([["all", copy.all], ["active", copy.inProgress], ["attention", copy.attention], ["completed", copy.completed]] as const).map(([key, label]) => <button type="button" key={key} aria-pressed={filter === key} onClick={() => { setFilter(key); setLimit(20); }} className={cn("min-h-11 rounded-xl px-3 py-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#635bff]/30 motion-reduce:transition-none", filter === key ? "bg-white text-[#182027] shadow-[0_1px_3px_#1820270a]" : "text-[#626a76] hover:text-[#182027]")}>{label}</button>)}
        </div>
        <input type="search" aria-label={copy.search} placeholder={copy.search} value={search} onChange={event => { setSearch(event.target.value); setLimit(20); }} className={cn(dashboardInputClass, "min-w-0 xl:w-64")} />
      </div>}
      {error && <div role="alert" className="mx-5 my-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#fffbf1] px-4 py-3 text-sm text-[#805b20] sm:mx-6"><span>{fa ? "تازه‌سازی انتقال‌ها ممکن نشد. آخرین اطلاعات نمایش داده می‌شود." : "We couldn’t refresh your transfers. Showing your last update."}</span><DashboardButton tone="quiet" onClick={onRefresh} disabled={refreshing}>{copy.retry}</DashboardButton></div>}
      {loading && !visible.length ? <div className="px-5 py-9 text-sm text-[#626a76] sm:px-6" role="status">{copy.loading}</div> : <>
        {!!visible.length && <AnimatedList mode="live" motionEnabled={motionEnabled} role="list" aria-label={copy.history} className="gap-3 px-4 py-4 sm:px-5">{visible.map(request => <TransferActivityRow key={request.id} request={request} locale={locale} createdDate />)}</AnimatedList>}
        {!visible.length && !error && <div className="px-5 py-8 sm:px-6"><h3 className="m-0! text-base font-medium text-[#182027]!">{requests.length ? copy.emptySearch : fa ? "هنوز انتقالی ندارید" : "No transfers yet"}</h3><p className="mb-5 mt-2 max-w-md text-sm leading-relaxed text-[#626a76]">{requests.length ? copy.emptySearchHint : copy.noTransfersHint}</p>{requests.length ? <DashboardButton tone="secondary" onClick={() => { setFilter("all"); setSearch(""); setLimit(20); }}>{fa ? "پاک کردن فیلترها" : "Reset filters"}</DashboardButton> : <DashboardButton asChild><Link href={dashboardHref(locale, "transfer")}>{copy.newTransfer}</Link></DashboardButton>}</div>}
        {!compact && visible.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e9ecf0] px-5 py-4 sm:px-6"><span className="text-xs text-[#626a76]">{dashboardNumber(visible.length,locale)} {fa ? "از" : "of"} {dashboardNumber(filtered.length,locale)} {fa ? "انتقال" : "transfers"}</span>{filtered.length > visible.length && <DashboardButton tone="secondary" onClick={() => setLimit(value => value + 20)}>{copy.more}</DashboardButton>}</div>}
      </>}
    </DashboardCard>
  </section>;
}
