"use client";

import Link from "next/link";
import { useLocale } from "@/context/LocaleContext";
import { useFinanceConfig } from "@/context/FinanceConfigContext";
import { calcLoyaltyDiscountPct } from "@/lib/pricing";
import { dashboardCopy, dashboardHref } from "@/lib/dashboard/navigation";
import { filterDashboardRequests, requestNeedsAttention } from "@/lib/dashboard/activity";
import { RecentActivityList } from "./recent-activity-list";
import { useDashboard } from "./DashboardShell";
import { useDashboardRequests } from "@/hooks/useDashboardRequests";
import { TransferOverviewCard } from "./TransferOverviewCard";
import { DashboardButton, DashboardCard, DashboardPageHeader, DashboardReveal } from "@/components/dashboard/dashboard-ui";

export function DashboardRateCard({ tailoredRate, loyaltySavings, baseRate, loyaltyBonus = 0, txType = "buy_aud" }: {
  tailoredRate: number | null; loyaltySavings: number; baseRate?: number | null; loyaltyBonus?: number; txType?: "buy_aud" | "sell_aud";
}) {
  const locale = useLocale(), fa = locale === "fa", copy = dashboardCopy[locale];
  const number = (value: number) => value.toLocaleString("en-AU", { maximumFractionDigits: 0 });
  return <DashboardCard className="p-6">
    <h2 className="m-0! text-lg font-semibold text-[#182027]!">{copy.rate}</h2>
    <p className="mb-0 mt-2 text-xs text-[#626a76]">{txType === "buy_aud" ? fa ? "ایران به استرالیا" : "Iran to Australia" : fa ? "استرالیا به ایران" : "Australia to Iran"}</p>
    <div className="mt-5 text-[2rem] font-semibold leading-tight tracking-[-.035em] text-[#182027] tabular-nums"><bdi data-private-value>{tailoredRate ? number(tailoredRate) : "—"}</bdi> <span className="text-sm font-normal tracking-normal text-[#626a76]">{fa ? "تومان / 1 AUD" : "Toman / 1 AUD"}</span></div>
    <p className="mb-0 mt-3 text-xs leading-relaxed text-[#626a76]">{copy.rateHint}</p>
    <dl className="mb-0 mt-5 space-y-3 border-t border-[#e9ecf0] pt-5 text-xs">
      {baseRate != null && <div className="flex flex-wrap justify-between gap-2"><dt className="text-[#626a76]">{fa ? "نرخ پایه" : "Base rate"}</dt><dd className="m-0 font-medium text-[#182027]" data-private-value>{number(baseRate)}</dd></div>}
      <div className="flex flex-wrap justify-between gap-2"><dt className="text-[#626a76]">{fa ? "مزیت وفاداری در هر دلار" : "Loyalty benefit per AUD"}</dt><dd className="m-0 font-medium text-[#182027]" data-private-value>{number(loyaltyBonus)} {fa ? "تومان" : "Toman"}</dd></div>
      <div className="flex flex-wrap justify-between gap-2"><dt className="text-[#626a76]">{copy.saved}</dt><dd className="m-0 font-medium text-[#182027]" data-private-value>{number(loyaltySavings)} {fa ? "تومان" : "Toman"}</dd></div>
    </dl>
  </DashboardCard>;
}

function LoyaltyCard({ volume, savings }: { volume: number; savings: number }) {
  const locale = useLocale(), fa = locale === "fa", config = useFinanceConfig();
  const pct = calcLoyaltyDiscountPct(volume, config), maxed = pct >= config.max_discount_percent;
  const step = config.discount_step_volume > 0 ? config.discount_step_volume : 1000;
  const remaining = Math.max(0, (Math.floor(volume / step) + 1) * step - volume);
  const progress = maxed ? 100 : Math.min(100, Math.max(0, (volume % step) / step * 100));
  return <DashboardCard className="p-6">
    <div className="flex items-center justify-between gap-3"><h2 className="m-0! text-lg font-semibold text-[#182027]!">{fa ? "وفاداری زرمان" : "Zarman loyalty"}</h2><span className="rounded-full bg-[#f2f0ff] px-3 py-1 text-xs font-medium text-[#655cc4]">{fa ? "مزیت شما" : "Your benefit"}</span></div>
    <p className="mb-0 mt-6 text-[2.5rem] font-semibold leading-none tracking-[-.035em] text-[#182027] tabular-nums" dir="ltr">{(pct * 100).toLocaleString("en-AU", { maximumFractionDigits: 2 })}<span className="text-2xl">%</span></p>
    <p className="mb-0 mt-3 text-sm text-[#626a76]">{fa ? "تخفیف از فاصله نرخ خرید و فروش" : "discount on the exchange-rate spread"}</p>
    <div role="progressbar" aria-label={fa ? "پیشرفت مزیت وفاداری بعدی" : "Progress to your next loyalty benefit"} aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} className="mt-6 h-1.5 overflow-hidden rounded-full bg-[#eeeef4]"><span className="block h-full rounded-full bg-[#8a83d8]" style={{ width: `${progress}%` }} /></div>
    <p className="mb-0 mt-3 text-xs leading-relaxed text-[#626a76]">{maxed ? fa ? "بالاترین مزیت وفاداری فعلی را دارید." : "You’ve unlocked the maximum current loyalty benefit." : <><bdi data-private-value>{remaining.toLocaleString("en-AU", { maximumFractionDigits: 2 })} AUD</bdi> {fa ? "انتقال تکمیل‌شده تا مزیت بعدی." : "in completed transfers to your next benefit."}</>}</p>
    <div className="mt-5 flex flex-wrap justify-between gap-2 border-t border-[#e9ecf0] pt-4 text-xs"><span className="text-[#626a76]">{fa ? "صرفه‌جویی تا امروز" : "Saved so far"}</span><strong className="font-medium text-[#182027]" data-private-value>{savings.toLocaleString("en-AU", { maximumFractionDigits: 0 })} {fa ? "تومان" : "Toman"}</strong></div>
  </DashboardCard>;
}

export function DashboardOverview({ volume, completedCount, tailoredRate, baseRate, loyaltyBonus = 0, txType = "buy_aud" }: {
  volume: number; completedCount: number; tailoredRate: number | null; baseRate?: number | null; loyaltyBonus?: number; txType?: "buy_aud" | "sell_aud";
}) {
  const locale = useLocale(), fa = locale === "fa", copy = dashboardCopy[locale];
  const { profile, motionEnabled = true } = useDashboard(), feed = useDashboardRequests();
  const approved = profile?.kyc_status === "approved";
  const active = filterDashboardRequests(feed.requests, "active", "");
  const focus = active.find(requestNeedsAttention) || active[0] || feed.requests.find(request => request.status === "completed") || feed.requests[0] || null;
  const savings = Number(profile?.loyalty_discount_toman || 0);
  const metrics = [{ label: copy.count, value: completedCount }, { label: copy.inProgress, value: active.length }, { label: copy.attention, value: active.filter(requestNeedsAttention).length }];
  return <div className="min-w-0 space-y-6 sm:space-y-7">
    <DashboardPageHeader title={copy.overview} description={`${copy.hello}${profile?.first_name ? `, ${profile.first_name}` : ""}`} action={focus ? <DashboardButton tone="secondary" asChild><Link href={dashboardHref(locale, "transfer")}>{copy.newTransfer}</Link></DashboardButton> : undefined} />
    {!approved && <DashboardCard className="flex flex-row flex-wrap items-center justify-between gap-3 border-[#eee1c8] bg-[#fffbf1] px-5 py-3 sm:px-5 sm:py-3"><p className="m-0 text-sm text-[#805b20]">{profile?.kyc_status === "pending" ? copy.pending : profile?.kyc_status === "rejected" ? copy.correction : copy.verification}</p><DashboardButton tone="quiet" asChild><Link href={dashboardHref(locale, "profile")}>{copy.profile}</Link></DashboardButton></DashboardCard>}
    <TransferOverviewCard request={focus} locale={locale} loading={feed.loading} error={feed.error} refreshing={feed.refreshing} onRetry={() => void feed.refresh()} motionEnabled={motionEnabled} />
    <DashboardReveal motionEnabled={motionEnabled}>
      <DashboardCard className="grid grid-cols-2 gap-x-5 gap-y-6 p-6 xl:grid-cols-4">
        <div className="min-w-0"><p className="m-0 text-xs text-[#626a76]">{copy.volume}</p><p className="mb-0 mt-2 text-2xl font-semibold text-[#182027] tabular-nums" data-private-value><bdi>{volume.toLocaleString("en-AU", { maximumFractionDigits: 2 })}</bdi> <span className="text-xs font-medium text-[#626a76]">AUD</span></p></div>
        {metrics.map(({ label, value }, index) => <Link href={dashboardHref(locale, "history")} className="min-w-0 rounded-lg no-underline outline-none focus-visible:ring-2 focus-visible:ring-[#635bff]/30" key={label}><span className="block text-xs text-[#626a76]">{label}</span><strong className="mt-2 block text-2xl font-semibold text-[#182027] tabular-nums">{index > 0 && (feed.loading || feed.error) ? "—" : value.toLocaleString("en-AU")}</strong></Link>)}
      </DashboardCard>
    </DashboardReveal>
    <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,1fr)]">
      <div className="min-w-0 space-y-6"><RecentActivityList {...feed} locale={locale} onRefresh={() => void feed.refresh()} motionEnabled={motionEnabled} /><DashboardCard className="flex flex-row flex-wrap items-center justify-between gap-3 p-5 sm:p-6"><div><h2 className="m-0! text-base font-semibold text-[#182027]!">{fa ? "گیرندگان ذخیره‌شده" : "Saved recipients"}</h2><p className="mb-0 mt-1.5 text-xs text-[#626a76]">{fa ? "حساب‌های شما، آماده انتقال بعدی." : "Your accounts, ready for the next transfer."}</p></div><DashboardButton tone="quiet" asChild><Link href={dashboardHref(locale, "recipients")}>{fa ? "مدیریت گیرندگان" : "Manage recipients"}</Link></DashboardButton></DashboardCard></div>
      <div className="min-w-0 space-y-6"><LoyaltyCard volume={volume} savings={savings} /><DashboardRateCard tailoredRate={tailoredRate} baseRate={baseRate} loyaltyBonus={loyaltyBonus} loyaltySavings={savings} txType={txType} /></div>
    </div>
  </div>;
}
