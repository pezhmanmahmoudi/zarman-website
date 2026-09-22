"use client";

import Link from "next/link";
import { BadgeCheck, CircleAlert, Clock3, Gift, Sparkles, Trophy, Users } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useLocale } from "@/context/LocaleContext";
import { useFinanceConfig } from "@/context/FinanceConfigContext";
import { calcLoyaltyDiscountPct } from "@/lib/pricing";
import { dashboardCopy, dashboardHref } from "@/lib/dashboard/navigation";
import { dashboardNumber } from "@/lib/dashboard/numbers";
import { dashboardPalette } from "@/lib/dashboard/palette";
import { filterDashboardRequests, requestNeedsAttention } from "@/lib/dashboard/activity";
import { AuroraText } from "@/components/ui/aurora-text";
import { BentoGrid } from "@/components/ui/bento-grid";
import { RecentActivityList } from "./recent-activity-list";
import { useDashboard } from "./DashboardShell";
import { useDashboardRequests } from "@/hooks/useDashboardRequests";
import { TransferOverviewCard } from "./TransferOverviewCard";
import { DashboardButton, DashboardCard, DashboardMagicCard, DashboardPageHeader, DashboardReveal } from "@/components/dashboard/dashboard-ui";

export function DashboardRateCard({ tailoredRate, loyaltySavings, baseRate, loyaltyBonus = 0, txType = "buy_aud" }: {
  tailoredRate: number | null; loyaltySavings: number; baseRate?: number | null; loyaltyBonus?: number; txType?: "buy_aud" | "sell_aud";
}) {
  const locale = useLocale(), fa = locale === "fa", copy = dashboardCopy[locale];
  const number = (value: number) => dashboardNumber(value,locale);
  return <DashboardMagicCard tone="violet" data-overview-card="rate">
    <div className="flex items-center justify-between gap-3"><h2 className="m-0! text-lg font-semibold text-[#302346]!">{copy.rate}</h2><span aria-hidden="true" className="flex size-10 items-center justify-center rounded-xl border border-[#dacef6] bg-white/80 text-[#7851c1]"><Sparkles size={18} strokeWidth={1.7} /></span></div>
    <p className="mb-0 mt-2 text-xs text-[#6a6078]">{txType === "buy_aud" ? fa ? "ایران به استرالیا" : "Iran to Australia" : fa ? "استرالیا به ایران" : "Australia to Iran"}</p>
    <div className="mt-5 text-[2.35rem] font-medium leading-tight tracking-[-.04em] text-[#302346] tabular-nums"><bdi data-private-value>{tailoredRate ? number(tailoredRate) : "—"}</bdi> <span className="text-xs font-normal tracking-normal text-[#6a6078]">{fa ? "تومان / ۱ AUD" : "Toman / 1 AUD"}</span></div>
    <p className="mb-0 mt-3 text-xs leading-relaxed text-[#6a6078]">{copy.rateHint}</p>
    <dl className="mb-0 mt-5 space-y-3 border-t border-[#dbd1ee] pt-5 text-xs">
      {baseRate != null && <div className="flex flex-wrap justify-between gap-2"><dt className="text-[#6a6078]">{fa ? "نرخ پایه" : "Base rate"}</dt><dd className="m-0 font-medium text-[#302346]" data-private-value>{number(baseRate)}</dd></div>}
      <div className="flex flex-wrap justify-between gap-2"><dt className="text-[#6a6078]">{fa ? "مزیت وفاداری در هر دلار" : "Loyalty benefit per AUD"}</dt><dd className="m-0 font-medium text-[#302346]" data-private-value>{number(loyaltyBonus)} {fa ? "تومان" : "Toman"}</dd></div>
      <div className="flex flex-wrap justify-between gap-2"><dt className="text-[#6a6078]">{copy.saved}</dt><dd className="m-0 font-medium text-[#302346]" data-private-value>{number(loyaltySavings)} {fa ? "تومان" : "Toman"}</dd></div>
    </dl>
  </DashboardMagicCard>;
}

function LoyaltyCard({ volume, savings, motionEnabled }: { volume: number; savings: number; motionEnabled: boolean }) {
  const locale = useLocale(), fa = locale === "fa", config = useFinanceConfig(), reduced = useReducedMotion();
  const pct = calcLoyaltyDiscountPct(volume, config), maxed = pct >= config.max_discount_percent;
  const step = config.discount_step_volume > 0 ? config.discount_step_volume : 1000;
  const remaining = Math.max(0, (Math.floor(volume / step) + 1) * step - volume);
  const progress = maxed ? 100 : Math.min(100, Math.max(0, (volume % step) / step * 100));
  const animate = motionEnabled && reduced === false;
  return <DashboardMagicCard tone="teal" motionEnabled={motionEnabled} contentClassName="p-0 sm:p-0" data-overview-card="loyalty">
    <div className="relative overflow-hidden p-6 pb-5 sm:p-7 sm:pb-5" style={{ background: "radial-gradient(ellipse at 100% 0%, #d5f2e9, transparent 75%)" }}>
      <div aria-hidden="true" className="pointer-events-none absolute -end-12 -top-12 size-44 rounded-full border border-[#b0dcd0]/65" />
      <div className="relative flex items-center justify-between gap-4">
        <div><p className="mb-2 mt-0 text-xs font-medium text-[#3f766a]">{fa ? "پاداش وفاداری زرمان" : "Zarman rewards"}</p><h2 className="m-0! text-xl font-semibold leading-snug! text-[#194f43]!">{fa ? "انتقال شما، پاداش شما." : "Your transfers. Your reward."}</h2></div>
        <div aria-hidden="true" className="relative flex size-16 shrink-0 items-center justify-center rounded-full border-2 border-[#bd9643] bg-[#fff0b9] text-[#8e5e13] shadow-[0_6px_24px_-12px_#bd964360,inset_0_0_0_5px_#fff7dc]"><Trophy size={27} strokeWidth={1.6} /></div>
      </div>
      <div className="relative mt-7 flex flex-wrap items-end justify-between gap-3">
        <p className="m-0 text-[3.25rem] font-medium leading-none tracking-[-.045em] text-[#194f43] tabular-nums" dir="ltr" data-number-locale={locale}>{dashboardNumber(pct * 100,locale,2)}<span className="ms-1 text-2xl">{fa ? "٪" : "%"}</span></p>
        <span className="rounded-lg border border-[#b1d5c8] bg-white/70 px-2.5 py-1.5 text-xs font-semibold text-[#246451]">{pct > 0 ? fa ? "مزیت بازشده شما" : "Your unlocked benefit" : fa ? "با هر انتقال، نزدیک‌تر" : "Every transfer counts"}</span>
      </div>
      <p className="mb-0 mt-3 text-sm leading-relaxed text-[#3c7163]">{fa ? "تخفیف از فاصله نرخ خرید و فروش" : "discount on the exchange-rate spread"}</p>
      <div role="progressbar" aria-label={fa ? "پیشرفت مزیت وفاداری بعدی" : "Progress to your next loyalty benefit"} aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} className="mt-6 h-2.5 overflow-hidden rounded-full border border-[#badbcf] bg-white/80"><motion.span initial={animate ? { width: 0 } : false} animate={{ width: `${progress}%` }} transition={{ duration: animate ? .7 : 0, ease: [.22, 1, .36, 1] }} className="block h-full rounded-full bg-linear-to-r from-[#269d89] to-[#62bd92]" /></div>
      <p className="mb-0 mt-3 text-xs leading-relaxed text-[#3c7163]">{maxed ? fa ? "بالاترین مزیت وفاداری فعلی را دارید." : "You’ve unlocked the maximum current loyalty benefit." : <><bdi data-private-value>{dashboardNumber(remaining,locale,2)} AUD</bdi> {fa ? "انتقال تکمیل‌شده تا مزیت بعدی." : "in completed transfers to your next benefit."}</>}</p>
    </div>
    <div className="relative flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-[#a9cabc] bg-white/60 px-6 py-4 text-xs sm:px-7"><span className="flex items-center gap-2 text-[#3c7163]"><Gift size={15} aria-hidden="true" />{fa ? "صرفه‌جویی تا امروز" : "Saved so far"}</span><strong className="font-semibold text-[#194f43]" data-private-value>{dashboardNumber(savings,locale)} {fa ? "تومان" : "Toman"}</strong></div>
  </DashboardMagicCard>;
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
  const metrics = [
    { label: copy.count, value: completedCount, tone: "emerald" as const, Icon: BadgeCheck },
    { label: copy.inProgress, value: active.length, tone: "sky" as const, Icon: Clock3 },
    { label: copy.attention, value: active.filter(requestNeedsAttention).length, tone: "amber" as const, Icon: CircleAlert },
  ];
  const customerName = profile?.first_name?.trim();
  return <div className="min-w-0 space-y-6 sm:space-y-7">
    <DashboardPageHeader eyebrow={copy.overview} title={<AuroraText className="max-w-full break-words [overflow-wrap:anywhere]" motionEnabled={motionEnabled} colors={["#6841b8", "#ac3978", "#30699d", "#287a70"]}>{fa ? "سلااام" : "Helloooo"}{customerName && <>{fa ? "، " : ", "}<bdi dir="auto">{customerName}</bdi></>}</AuroraText>} description={copy.overviewHint} action={focus ? <DashboardButton asChild><Link href={dashboardHref(locale, "transfer")}>{copy.newTransfer}</Link></DashboardButton> : undefined} />
    {!approved && <DashboardCard className="flex flex-row flex-wrap items-center justify-between gap-3 border-[#e9ce9f] bg-[#fff4df] px-5 py-3 sm:px-5 sm:py-3"><p className="m-0 text-sm text-[#805b20]">{profile?.kyc_status === "pending" ? copy.pending : profile?.kyc_status === "rejected" ? copy.correction : copy.verification}</p><DashboardButton tone="quiet" asChild><Link href={dashboardHref(locale, "profile")}>{copy.profile}</Link></DashboardButton></DashboardCard>}
    <TransferOverviewCard request={focus} locale={locale} loading={feed.loading} error={feed.error} refreshing={feed.refreshing} onRetry={() => void feed.refresh()} motionEnabled={motionEnabled} />
    <DashboardReveal motionEnabled={motionEnabled}>
      <BentoGrid className="grid-cols-2 gap-3 lg:grid-cols-4 sm:gap-4">
        <DashboardMagicCard tone="violet" motionEnabled={motionEnabled} contentClassName="p-4 sm:p-5" data-overview-card="volume"><p className="m-0 text-xs leading-5 text-[#645477]">{copy.volume}</p><p className="mb-0 mt-3 break-words text-2xl font-medium text-[#3d2862] tabular-nums" data-private-value><bdi>{dashboardNumber(volume,locale,2)}</bdi> <span className="text-xs font-medium text-[#645477]">AUD</span></p></DashboardMagicCard>
        {metrics.map(({ label, value, tone, Icon }, index) => <DashboardMagicCard key={label} tone={tone} motionEnabled={motionEnabled} contentClassName="p-0 sm:p-0"><Link href={dashboardHref(locale, "history")} className="block h-full min-w-0 rounded-[inherit] p-4 no-underline outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#635bff]/60 sm:p-5"><span className="block text-xs leading-5" style={{ color: dashboardPalette[tone].ink }}>{label}</span><span className="mt-3 flex items-center justify-between gap-2"><strong className="block text-2xl font-medium tabular-nums" style={{ color: dashboardPalette[tone].ink }}>{index > 0 && (feed.loading || feed.error) ? "—" : dashboardNumber(value,locale)}</strong><Icon size={20} strokeWidth={1.7} style={{ color: dashboardPalette[tone].accent }} aria-hidden="true" /></span></Link></DashboardMagicCard>)}
      </BentoGrid>
    </DashboardReveal>
    <BentoGrid className="items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
      <div className="min-w-0 space-y-6">
        <RecentActivityList {...feed} locale={locale} onRefresh={() => void feed.refresh()} motionEnabled={motionEnabled} />
        <DashboardMagicCard tone="sky" motionEnabled={motionEnabled} contentClassName="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6" data-overview-card="recipients"><div className="flex min-w-0 items-center gap-3"><span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[#bed7ea] bg-white/75 text-[#386f95]"><Users size={21} strokeWidth={1.7} /></span><div><h2 className="m-0! text-base font-semibold text-[#204b68]!">{fa ? "گیرندگان ذخیره‌شده" : "Saved recipients"}</h2><p className="mb-0 mt-1.5 text-xs leading-5 text-[#4e7187]">{fa ? "حساب‌های شما، آماده انتقال بعدی." : "Your accounts, ready for the next transfer."}</p></div></div><DashboardButton tone="quiet" asChild><Link href={dashboardHref(locale, "recipients")}>{fa ? "مدیریت گیرندگان" : "Manage recipients"}</Link></DashboardButton></DashboardMagicCard>
      </div>
      <div className="min-w-0 space-y-6"><LoyaltyCard volume={volume} savings={savings} motionEnabled={motionEnabled} /><DashboardRateCard tailoredRate={tailoredRate} baseRate={baseRate} loyaltyBonus={loyaltyBonus} loyaltySavings={savings} txType={txType} /></div>
    </BentoGrid>
  </div>;
}
