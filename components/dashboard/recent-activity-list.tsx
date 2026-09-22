"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BadgeCheck, CircleAlert, CircleDollarSign, Clock3, MessageSquare, Upload } from "lucide-react";
import { AnimatedList } from "@/components/ui/animated-list";
import { DashboardButton, DashboardMagicCard, StatusBadge } from "@/components/dashboard/dashboard-ui";
import { dashboardCopy, dashboardHref } from "@/lib/dashboard/navigation";
import { dashboardPalette, dashboardStageTones } from "@/lib/dashboard/palette";
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
const activityIcons = { check: BadgeCheck, clock: Clock3, upload: Upload, message: MessageSquare, error: CircleAlert, transfer: CircleDollarSign };

/** Shared visual vocabulary for recent activity and the complete transfer directory. */
export function TransferActivityRow({ request, locale, now = null, createdDate = false }: {
  request: ExchangeRequest; locale: RequestLocale; now?: number | null; createdDate?: boolean;
}) {
  const fa = locale === "fa", presentation = journeyPresentation(request, locale), appearance = activityAppearance(request);
  const recipient = request.quote.recipient_snapshot;
  const name = [request.quote.institution_name, recipient.full_name, recipient.account_name, recipient.label].find(value => typeof value === "string" && value.trim());
  const timestamp = createdDate ? request.created_at : requestActivityTime(request);
  const time = now === null ? requestDate(timestamp, locale) : relativeActivityTime(timestamp, locale, now);
  const Icon = activityIcons[appearance.icon];
  const colorTone = appearance.tone === "failed" ? "rose" : presentation.mood === "quiet" ? "slate" : appearance.tone === "attention" ? "amber" : dashboardStageTones[presentation.stage];
  const palette = dashboardPalette[colorTone];
  return <Link href={`/${locale}/dashboard/requests/${request.id}`} data-request-id={request.id} data-tone={appearance.tone} className="group/activity block min-w-0 rounded-2xl border px-4 py-4 text-start no-underline outline-none transition-[background-color,box-shadow] hover:shadow-[inset_0_0_0_1px_#ffffff] focus-visible:ring-2 focus-visible:ring-[#7651d4]/60 motion-reduce:transition-none sm:px-5" style={{ borderColor: palette.border, background: `linear-gradient(110deg, #ffffffed, ${palette.soft}bb)` }}>
    <div className="flex min-w-0 items-start gap-3">
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-white/80" style={{ color: palette.accent, borderColor: palette.border }}><Icon size={20} strokeWidth={1.7} /></span>
      <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-32"><span className="block truncate text-sm font-semibold leading-relaxed text-[#302b43]" data-private-value>{typeof name === "string" ? name : fa ? "انتقال وجه" : "Money transfer"}</span><bdi className="mt-1 block text-xs text-[#6a6279]">{request.reference_code}</bdi></div>
        <div className="max-w-full text-start sm:text-end"><bdi data-private-value className="break-words text-sm font-semibold leading-relaxed text-[#302b43] tabular-nums">{requestMoney(request.quote.funding_total, request.quote.funding_currency, locale)}</bdi>{request.service_tier === "priority" && <span className="mt-1 block text-xs text-[#6a6279]">{fa ? "اولویت‌دار" : "Priority"}</span>}</div>
      </div>
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2"><StatusBadge tone={tones[appearance.tone]}>{presentation.status}</StatusBadge><span className="text-xs font-medium" style={{ color: palette.ink }} data-actor={presentation.nextActor}>{presentation.actorLabel}</span></div>
    <div className="mt-2 text-xs text-[#6a6279]">{!createdDate && <>{fa ? "به‌روزرسانی" : "Updated"}{" "}</>}{timestamp ? <time dateTime={timestamp} title={`${requestDate(timestamp, locale)} (Sydney)`} dir={now === null ? "ltr" : fa ? "rtl" : "ltr"}>{time}</time> : "—"}</div>
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
    <DashboardMagicCard tone="violet" motionEnabled={motionEnabled} contentClassName="p-0 sm:p-0">
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4 pt-5 sm:px-6 sm:pt-6"><div><h2 className="m-0! text-lg font-semibold text-[#302b43]!">{copy.recent}</h2><p className="mb-0 mt-1.5 text-xs leading-5 text-[#6a6279]">{copy.recentHint}</p></div>{!error && <DashboardButton tone="quiet" onClick={onRefresh} disabled={refreshing || loading} aria-label={copy.refresh}>{refreshing ? fa ? "در حال تازه‌سازی…" : "Refreshing…" : copy.refresh}</DashboardButton>}</header>
      {error && <div role="status" className="mx-5 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#fffbf1] px-4 py-3 text-xs leading-relaxed text-[#805b20] sm:mx-6"><span>{requests.length ? fa ? "به‌روزرسانی ممکن نشد. آخرین اطلاعات دریافت‌شده نمایش داده می‌شود." : "Couldn’t refresh. Showing the last loaded updates." : fa ? "فعالیت‌ها دریافت نشد." : "Couldn’t load your activity."}</span><DashboardButton tone="quiet" onClick={onRefresh} disabled={refreshing}>{copy.retry}</DashboardButton></div>}
      <div aria-busy={loading || refreshing}>
        {loading && !visible.length ? <div role="status" className="space-y-4 px-5 pb-6 sm:px-6"><span className="sr-only">{copy.loading}</span>{[0, 1, 2].map(index => <div key={index} className="h-20 rounded-2xl bg-[#f3f4f6]" aria-hidden="true" />)}</div>
          : visible.length ? <AnimatedList mode="live" motionEnabled={motionEnabled} role="list" aria-label={copy.recent} className="gap-3 px-4 pb-4 sm:px-5 sm:pb-5">{visible.map(request => <TransferActivityRow key={request.id} request={request} locale={locale} now={now} />)}</AnimatedList>
            : !error && <div className="px-5 pb-7 pt-3 sm:px-6"><p className="m-0 text-base font-medium text-[#182027]">{fa ? "هنوز انتقالی ندارید" : "No transfers yet"}</p><p className="mb-4 mt-2 max-w-sm text-sm leading-relaxed text-[#626a76]">{copy.noTransfersHint}</p><DashboardButton tone="secondary" asChild><Link href={dashboardHref(locale, "transfer")}>{copy.newTransfer}</Link></DashboardButton></div>}
      </div>
      <footer className="flex justify-end border-t border-[#ded5ed] bg-white/55 px-5 py-2 sm:px-6"><DashboardButton tone="quiet" asChild><Link href={dashboardHref(locale, "history")}>{copy.allActivity}</Link></DashboardButton></footer>
    </DashboardMagicCard>
  </section>;
}
