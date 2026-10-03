"use client";

import { useMemo } from "react";
import { DashboardTabLink as Link } from "./DashboardTabLink";
import { DashboardButton, DashboardMagicCard } from "@/components/dashboard/dashboard-ui";
import { dashboardCopy, dashboardHref } from "@/lib/dashboard/navigation";
import { recentActivityRequests } from "@/lib/dashboard/recent-activity";
import { DashboardOverviewCardHeading } from "./DashboardOverviewCardHeading";
import { TransactionSummaryCard } from "./TransactionSummaryCard";
import type { ExchangeRequest, RequestLocale } from "@/lib/requests/types";

type RecentActivityListProps = {
  requests: ExchangeRequest[];
  locale: RequestLocale;
  loading?: boolean;
  refreshing?: boolean;
  error?: boolean;
  motionEnabled?: boolean;
};

/** The latest transfer, drawn with the same card as the Transactions list. */
export function RecentActivityList({ requests, locale, loading = false, refreshing = false, error = false, motionEnabled = true }: RecentActivityListProps) {
  const fa = locale === "fa", copy = dashboardCopy[locale], title = fa ? "آخرین تراکنش شما" : "Your latest transaction";
  const latest = useMemo(() => recentActivityRequests(requests, 1)[0], [requests]);

  return <section dir={fa ? "rtl" : "ltr"} aria-label={title} data-recent-activity className="h-full min-w-0">
    <DashboardMagicCard tone="violet" replayLottieOnHover motionEnabled={motionEnabled} className="h-full" contentClassName="flex h-full flex-col p-0 sm:p-0" data-overview-card="activity">
      <header className="px-5 pb-3 pt-5 sm:px-6 sm:pt-6"><DashboardOverviewCardHeading eyebrow={fa ? "تاریخچه تراکنش‌ها" : "Your transaction history"} title={title} scene="activity-history" motionEnabled={motionEnabled}><p className="mb-0 mt-1.5 text-xs leading-5 text-[#6a6279]">{fa ? "وضعیت آخرین تراکنش شما در یک نگاه. برای مشاهده همه تراکنش‌ها روی دکمه «همه تراکنش‌ها» کلیک کنید." : "Your most recent transaction at a glance. Use “View all transactions” to see the full list."}</p></DashboardOverviewCardHeading></header>
      {error && <div role="status" className="mx-5 mb-3 rounded-2xl bg-[#fffbf1] px-4 py-3 text-xs leading-relaxed text-[#805b20] sm:mx-6">{requests.length ? fa ? "به‌روزرسانی ممکن نشد. آخرین اطلاعات دریافت‌شده نمایش داده می‌شود." : "Couldn’t refresh. Showing the last loaded updates." : fa ? "فعالیت‌ها دریافت نشد." : "Couldn’t load your activity."}</div>}
      <div aria-busy={loading || refreshing}>
        {loading && !latest ? <div role="status" className="px-5 pb-5 text-sm text-[#6a6279] sm:px-6">{copy.loading}</div>
          : latest ? <div className="px-4 pb-5 sm:px-5"><TransactionSummaryCard request={latest} locale={locale} /></div>
            : !error && <div className="px-5 pb-6 pt-1 sm:px-6"><p className="mb-3 mt-4 text-sm leading-relaxed text-[#554b68]">{fa ? "هنوز تراکنشی نداشته‌اید. همین حالا اولین انتقال وجه خود را ثبت کنید." : "No transactions yet. Start your first transfer right now."}</p></div>}
      </div>
      <footer className="mt-auto flex justify-end border-t border-[#ded5ed] bg-white/55 px-5 py-3 sm:px-6"><DashboardButton tone="secondary" asChild><Link href={dashboardHref(locale, "history")}>{copy.allActivity}</Link></DashboardButton></footer>
    </DashboardMagicCard>
  </section>;
}
