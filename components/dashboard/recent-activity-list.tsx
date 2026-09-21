"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatedList } from "@/components/ui/animated-list";
import { DashboardButton, DashboardCard, StatusBadge } from "@/components/dashboard/dashboard-ui";
import { dashboardCopy, dashboardHref } from "@/lib/dashboard/navigation";
import { journeyPresentation } from "@/lib/dashboard/journey-presentation";
import { activityAppearance, recentActivityRequests, relativeActivityTime, requestActivityTime, type ActivityTone } from "@/lib/dashboard/recent-activity";
import { requestDate, requestMoney } from "@/components/requests/request-labels";
import type { ExchangeRequest, RequestLocale } from "@/lib/requests/types";

type RecentActivityListProps = {
  requests: ExchangeRequest[];
  locale: RequestLocale;
  loading?: boolean;
  refreshing?: boolean;
  error?: boolean;
  onRefresh: () => void;
  motionEnabled?: boolean;
};
const tones: Record<ActivityTone, "success" | "attention" | "danger" | "neutral" | "brand"> = { complete: "success", attention: "attention", failed: "danger", neutral: "neutral", processing: "brand" };

/** Shared visual vocabulary for recent activity and the complete transfer directory. */
export function TransferActivityRow({ request, locale, now = null, createdDate = false }: {
  request: ExchangeRequest; locale: RequestLocale; now?: number | null; createdDate?: boolean;
}) {
  const fa = locale === "fa", presentation = journeyPresentation(request, locale), appearance = activityAppearance(request);
  const recipient = request.quote.recipient_snapshot;
  const name = [request.quote.institution_name, recipient.full_name, recipient.account_name, recipient.label].find(value => typeof value === "string" && value.trim());
  const timestamp = createdDate ? request.created_at : requestActivityTime(request);
  const time = now === null ? requestDate(timestamp, locale) : relativeActivityTime(timestamp, locale, now);
  return <Link href={`/${locale}/dashboard/requests/${request.id}`} data-request-id={request.id} data-tone={appearance.tone} className="block min-w-0 border-b border-[#e9ecf0] px-5 py-5 text-start no-underline outline-none transition-colors hover:bg-[#f8f9fb] focus-visible:bg-[#f5f4ff] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#635bff]/30 motion-reduce:transition-none sm:px-6">
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="min-w-0 flex-1 basis-36"><span className="block truncate text-sm font-semibold leading-relaxed text-[#182027]" data-private-value>{typeof name === "string" ? name : fa ? "انتقال وجه" : "Money transfer"}</span><bdi className="mt-1 block text-xs text-[#626a76]">{request.reference_code}</bdi></div>
      <div className="max-w-full text-start sm:text-end"><bdi data-private-value className="break-words text-sm font-semibold leading-relaxed text-[#182027] tabular-nums">{requestMoney(request.quote.funding_total, request.quote.funding_currency, locale)}</bdi>{request.service_tier === "priority" && <span className="mt-1 block text-xs text-[#626a76]">{fa ? "اولویت‌دار" : "Priority"}</span>}</div>
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2"><StatusBadge tone={tones[appearance.tone]}>{presentation.status}</StatusBadge><span className="text-xs text-[#626a76]" data-actor={presentation.nextActor}>{presentation.actorLabel}</span></div>
    <div className="mt-2 text-xs text-[#626a76]">{!createdDate && <>{fa ? "به‌روزرسانی" : "Updated"}{" "}</>}{timestamp ? <time dateTime={timestamp} title={`${requestDate(timestamp, locale)} (Sydney)`} dir={now === null ? "ltr" : fa ? "rtl" : "ltr"}>{time}</time> : "—"}</div>
  </Link>;
}

/** Uses the overview's authenticated feed without adding another subscription. */
export function RecentActivityList({ requests, locale, loading = false, refreshing = false, error = false, onRefresh, motionEnabled = true }: RecentActivityListProps) {
  const copy = dashboardCopy[locale], fa = locale === "fa";
  const visible = useMemo(() => recentActivityRequests(requests), [requests]);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!visible.length) return;
    const updateClock = () => { if (document.visibilityState !== "hidden") setNow(Date.now()); };
    const initial = window.setTimeout(updateClock, 0), timer = window.setInterval(updateClock, 60000);
    window.addEventListener("focus", updateClock); document.addEventListener("visibilitychange", updateClock);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); window.removeEventListener("focus", updateClock); document.removeEventListener("visibilitychange", updateClock); };
  }, [visible.length]);

  return <section dir={fa ? "rtl" : "ltr"} aria-label={copy.recent} data-recent-activity className="min-w-0">
    <DashboardCard className="overflow-hidden p-0 sm:p-0">
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4 pt-5 sm:px-6 sm:pt-6"><h2 className="m-0! text-lg font-semibold text-[#182027]!">{copy.recent}</h2>{!error && <DashboardButton tone="quiet" onClick={onRefresh} disabled={refreshing || loading} aria-label={copy.refresh}>{refreshing ? fa ? "در حال تازه‌سازی…" : "Refreshing…" : copy.refresh}</DashboardButton>}</header>
      {error && <div role="status" className="mx-5 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#fffbf1] px-4 py-3 text-xs leading-relaxed text-[#805b20] sm:mx-6"><span>{requests.length ? fa ? "به‌روزرسانی ممکن نشد. آخرین اطلاعات دریافت‌شده نمایش داده می‌شود." : "Couldn’t refresh. Showing the last loaded updates." : fa ? "فعالیت‌ها دریافت نشد." : "Couldn’t load your activity."}</span><DashboardButton tone="quiet" onClick={onRefresh} disabled={refreshing}>{copy.retry}</DashboardButton></div>}
      <div aria-busy={loading || refreshing}>
        {loading && !visible.length ? <div role="status" className="space-y-4 px-5 pb-6 sm:px-6"><span className="sr-only">{copy.loading}</span>{[0, 1, 2].map(index => <div key={index} className="h-20 rounded-2xl bg-[#f3f4f6]" aria-hidden="true" />)}</div>
          : visible.length ? <AnimatedList mode="live" motionEnabled={motionEnabled} role="list" aria-label={copy.recent} className="gap-0 [&>div:last-child_a]:border-b-0">{visible.map(request => <TransferActivityRow key={request.id} request={request} locale={locale} now={now} />)}</AnimatedList>
            : !error && <div className="px-5 pb-7 pt-3 sm:px-6"><p className="m-0 text-base font-medium text-[#182027]">{fa ? "هنوز انتقالی ندارید" : "No transfers yet"}</p><p className="mb-4 mt-2 max-w-sm text-sm leading-relaxed text-[#626a76]">{copy.noTransfersHint}</p><DashboardButton tone="secondary" asChild><Link href={dashboardHref(locale, "transfer")}>{copy.newTransfer}</Link></DashboardButton></div>}
      </div>
      <footer className="flex justify-end border-t border-[#e9ecf0] px-5 py-2 sm:px-6"><DashboardButton tone="quiet" asChild><Link href={dashboardHref(locale, "history")}>{copy.allActivity}</Link></DashboardButton></footer>
    </DashboardCard>
  </section>;
}
