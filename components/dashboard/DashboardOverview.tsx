"use client";

import { useEffect, useState } from "react";
import { DashboardTabLink as Link } from "./DashboardTabLink";
import { ArrowDownLeft, ArrowUpRight, BarChart3, CheckCircle2, type LucideIcon } from "lucide-react";
import { useLocale } from "@/context/LocaleContext";
import { dashboardCopy, dashboardHref } from "@/lib/dashboard/navigation";
import { dashboardNumber } from "@/lib/dashboard/numbers";
import type { DashboardTone } from "@/lib/dashboard/palette";
import { filterDashboardRequests, requestNeedsAttention } from "@/lib/dashboard/activity";
import { AuroraText } from "@/components/ui/aurora-text";
import { BentoGrid } from "@/components/ui/bento-grid";
import { RecentActivityList } from "./recent-activity-list";
import { useDashboard } from "./DashboardShell";
import { useDashboardRequests } from "@/hooks/useDashboardRequests";
import { TransferOverviewCard } from "./TransferOverviewCard";
import { DashboardOverviewNotice } from "./DashboardOverviewNotice";
import { LoyaltyMilestoneCelebration } from "./LoyaltyMilestoneCelebration";
import { DashboardOverviewRecipients } from "./DashboardOverviewRecipients";
import { DashboardLoyaltyCard, type DashboardLoyaltyRateProps } from "./DashboardLoyaltyCard";
import { DashboardButton, DashboardMagicCard, DashboardPageHeader, DashboardReveal } from "@/components/dashboard/dashboard-ui";

const SEEN_FINISHED_KEY = "zarman:dashboard:seen-finished-transfers";
function readSeenFinished(): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(SEEN_FINISHED_KEY) || "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch { return []; }
}

function OverviewMetricCard({ id, label, value, unit, Icon, tone, accent, ink, fill, border, locale, motionEnabled, href, privateValue = false }: {
  id: string; label: string; value: string; unit?: string; Icon: LucideIcon; tone: DashboardTone; accent: string; ink: string; fill: string; border: string; locale: "fa" | "en"; motionEnabled: boolean; href?: string; privateValue?: boolean;
}) {
  const content = <><span aria-hidden="true" className="grid size-10 place-items-center rounded-xl border bg-white/80" style={{ borderColor: border, color: accent }}><Icon size={20} strokeWidth={1.7} /></span><span className="flex min-h-10 min-w-0 items-center justify-center text-center text-sm font-semibold leading-5 text-[#4d5366]">{label}</span><strong className="flex min-h-8 min-w-0 flex-wrap items-center justify-center gap-x-1 break-words text-center text-[clamp(1.375rem,2.4vw,1.875rem)] font-bold leading-snug tabular-nums" style={{ color: ink }} data-private-value={privateValue || undefined}><bdi dir="auto" data-number-locale={locale}>{value}</bdi>{unit && <span className="text-xs font-medium leading-5">{unit}</span>}</strong></>;
  const surface = "grid h-full min-h-40 min-w-0 grid-rows-[2.5rem_minmax(2.5rem,auto)_minmax(2rem,auto)] place-items-center gap-2 rounded-[inherit] p-3 no-underline outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#635bff]/60 sm:min-h-42 sm:p-5";
  return <DashboardMagicCard tone={tone} motionEnabled={motionEnabled} className="h-full" contentClassName="h-full p-0 sm:p-0" data-overview-card={id} style={{ background: fill, borderColor: border }}>
    {href ? <Link href={href} className={surface}>{content}</Link> : <div className={surface}>{content}</div>}
  </DashboardMagicCard>;
}

export function DashboardOverview({ volume, completedCount, baseBuyRate, baseSellRate, ...loyaltyRates }: DashboardLoyaltyRateProps & {
  volume: number; completedCount: number; baseBuyRate: number | null; baseSellRate: number | null;
}) {
  const locale = useLocale(), fa = locale === "fa", copy = dashboardCopy[locale];
  const { profile, motionEnabled = true } = useDashboard(), feed = useDashboardRequests({ overview: true });
  const active = filterDashboardRequests(feed.requests, "active", "");
  // Read once per visit, so a finished transfer stays visible until the customer leaves the overview.
  const [seenBefore] = useState(() => typeof window === "undefined" ? [] : readSeenFinished());
  const latest = active.find(requestNeedsAttention) || active[0] || feed.requests.find(request => request.status === "completed") || feed.requests[0] || null;
  const finishedId = latest && !active.includes(latest) ? latest.id : null;
  const focus = finishedId && seenBefore.includes(finishedId) ? null : latest;
  useEffect(() => {
    if (!finishedId || seenBefore.includes(finishedId)) return;
    try { window.localStorage.setItem(SEEN_FINISHED_KEY, JSON.stringify([finishedId, ...readSeenFinished().filter(id => id !== finishedId)].slice(0, 50))); } catch {}
  }, [finishedId, seenBefore]);
  const metrics: { id: string; label: string; value: string; unit?: string; tone: DashboardTone; accent: string; ink: string; fill: string; border: string; Icon: LucideIcon; href?: string; privateValue?: boolean }[] = [
    { id: "volume", label: fa ? "حجم تبادلات تأییدشده" : "Approved exchange volume", value: dashboardNumber(volume, locale, 2), unit: "AUD", tone: "sky", accent: "#4b64d8", ink: "#304b9f", fill: "linear-gradient(155deg,#f7faff 0%,#e3eaff 100%)", border: "#cad6ff", Icon: BarChart3, privateValue: true },
    { id: "completed", label: fa ? "تعداد تراکنش‌های موفق" : "Successful transfers", value: dashboardNumber(completedCount, locale), tone: "violet", accent: "#9b3fb2", ink: "#713385", fill: "linear-gradient(155deg,#fff8ff 0%,#f4e2f4 100%)", border: "#e8c3e8", Icon: CheckCircle2 },
    { id: "buy-rate", label: fa ? "نرخ پایه خرید" : "Base buy rate", value: baseBuyRate != null && baseBuyRate > 0 ? dashboardNumber(baseBuyRate, locale) : "—", unit: baseBuyRate != null && baseBuyRate > 0 ? fa ? "تومان" : "Toman" : undefined, tone: "amber", accent: "#bd6c0b", ink: "#81500c", fill: "linear-gradient(155deg,#fffcf6 0%,#ffebcf 100%)", border: "#eccf9f", Icon: ArrowDownLeft, privateValue: true },
    { id: "sell-rate", label: fa ? "نرخ پایه فروش" : "Base sell rate", value: baseSellRate != null && baseSellRate > 0 ? dashboardNumber(baseSellRate, locale) : "—", unit: baseSellRate != null && baseSellRate > 0 ? fa ? "تومان" : "Toman" : undefined, tone: "rose", accent: "#be4a68", ink: "#95344f", fill: "linear-gradient(155deg,#fff9f9 0%,#fbe3e8 100%)", border: "#eebcc8", Icon: ArrowUpRight, privateValue: true },
  ];
  const customerName = profile?.first_name?.trim();
  return <div className="min-w-0 space-y-6 sm:space-y-7">
    <LoyaltyMilestoneCelebration userId={profile?.id} volume={volume} motionEnabled={motionEnabled} />
    <DashboardPageHeader title={<AuroraText className="max-w-full break-words [overflow-wrap:anywhere]" motionEnabled={motionEnabled} colors={["#6841b8", "#ac3978", "#30699d", "#287a70"]}>{fa ? customerName ? "سلام، " : "به زرمان خوش آمدید" : customerName ? "Welcome back, " : "Welcome to Zarman"}{customerName && <bdi dir="auto">{customerName}</bdi>}</AuroraText>} description={fa ? "به پنل جدید مدیریت تراکنش خوش آمدید." : "Welcome to your newtransaction panel."} action={focus ? <DashboardButton asChild><Link href={dashboardHref(locale, "transfer")}>{copy.newTransfer}</Link></DashboardButton> : undefined} />
    <DashboardOverviewNotice profile={profile} motionEnabled={motionEnabled} />
    <TransferOverviewCard request={focus} locale={locale} loading={feed.loading} error={feed.error} refreshing={feed.refreshing} onRetry={() => void feed.refresh()} motionEnabled={motionEnabled} />
    <DashboardReveal motionEnabled={motionEnabled}>
      <BentoGrid className="grid-cols-2 gap-3 lg:grid-cols-4 sm:gap-4">
        {metrics.map(metric => <OverviewMetricCard key={metric.id} {...metric} locale={locale} motionEnabled={motionEnabled} />)}
      </BentoGrid>
    </DashboardReveal>
    <BentoGrid className="items-stretch gap-5 lg:grid-cols-2 2xl:grid-cols-3">
      <RecentActivityList {...feed} locale={locale} motionEnabled={motionEnabled} />
      <DashboardOverviewRecipients locale={locale} ownerId={profile?.id} motionEnabled={motionEnabled} />
      <div className="min-w-0 lg:col-span-2 2xl:col-span-1"><DashboardLoyaltyCard volume={volume} savings={Number(profile?.loyalty_discount_toman || 0)} motionEnabled={motionEnabled} {...loyaltyRates} /></div>
    </BentoGrid>
  </div>;
}
