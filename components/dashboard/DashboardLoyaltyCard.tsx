"use client";

import { ArrowDownLeft, ArrowUpRight, Crown, Gift } from "lucide-react";
import { useLocale } from "@/context/LocaleContext";
import { useFinanceConfig } from "@/context/FinanceConfigContext";
import { loyaltyJourney } from "@/lib/dashboard/loyalty";
import { dashboardNumber } from "@/lib/dashboard/numbers";
import { dashboardCopy } from "@/lib/dashboard/navigation";
import { DashboardMagicCard } from "./dashboard-ui";
import { DashboardOverviewCardHeading } from "./DashboardOverviewCardHeading";
import { LoyaltyProgress } from "./LoyaltyProgress";

export type DashboardLoyaltyRateProps = {
  customerBuyRate?: number | null;
  customerSellRate?: number | null;
  loyaltyBonus?: number;
};

/** Uses the existing finance configuration and quoted rates, never a second pricing rule. */
export function DashboardLoyaltyCard({ volume, savings, motionEnabled, customerBuyRate, customerSellRate, loyaltyBonus = 0 }: DashboardLoyaltyRateProps & { volume: number; savings: number; motionEnabled: boolean }) {
  const locale = useLocale(), fa = locale === "fa", config = useFinanceConfig();
  const journey = loyaltyJourney(volume, config), { maxed } = journey;
  const number = (value: number) => dashboardNumber(value, locale);
  const hasBenefit = loyaltyBonus > 0;
  const rates = [
    { id: "buy", label: fa ? "خرید دلار" : "You buy AUD", value: customerBuyRate, Icon: ArrowDownLeft },
    { id: "sell", label: fa ? "فروش دلار" : "You sell AUD", value: customerSellRate, Icon: ArrowUpRight },
  ];
  return <DashboardMagicCard tone={maxed ? "amber" : "teal"} replayLottieOnHover motionEnabled={motionEnabled} className="h-full" contentClassName="flex h-full flex-col p-0 sm:p-0" data-overview-card="loyalty" data-loyalty-cap={maxed || undefined}>
    <header className="px-5 pb-3 pt-5 sm:px-6 sm:pt-6"><DashboardOverviewCardHeading eyebrow={fa ? "باشگاه مشتریان زرمان" : "Zarman Loyalty Club"} title={fa ? "انتقال بیشتر، سود بیشتر" : "Transfer More, Save More"} scene="loyalty-savings" motionEnabled={motionEnabled}><p className="mb-0 mt-1.5 text-xs leading-6 text-[#3c7163]">{fa ? "با هر تراکنش، از نرخ‌های بهتر بهره‌مند شوید و در هزینه‌های خود صرفه‌جویی کنید." : "Enjoy better rates and maximize your savings with every transaction."}</p></DashboardOverviewCardHeading></header>
    <div className="flex-1 px-5 pb-5 sm:px-6">
      <div className="mt-3 rounded-2xl border border-[#c7e2d8] bg-white/60 p-4 sm:p-5">
        <p className="m-0 text-xs font-medium text-[#3c7163]">{fa ? "تخفیف شما برای هر دلار استرالیا" : "Your savings per AUD"}</p>
        <p className="mb-0 mt-2 flex flex-wrap items-baseline gap-x-2 text-[#194f43]" data-loyalty-discount><bdi className="text-3xl font-bold leading-tight tabular-nums sm:text-4xl" data-private-value data-number-locale={locale}>{number(loyaltyBonus)}</bdi><span className="text-sm font-semibold">{fa ? "تومان" : "Toman"}</span></p>
        <LoyaltyProgress journey={journey} locale={locale} motionEnabled={motionEnabled} />
      </div>
      {hasBenefit && <div className="mt-4 rounded-2xl border border-[#badbcf] bg-white/65 p-4" data-loyalty-rates>
        <p className="m-0 text-sm font-semibold leading-6 text-[#194f43]">{fa ? "نرخ اختصاصی شما" : "Your Exclusive Rate"} <span className="text-xs font-medium text-[#3c7163]">{fa ? "(برای هر دلار استرالیا)" : "(per AUD)"}</span></p>
        <dl className="mb-0 mt-3 divide-y divide-[#d4e6de]">{rates.map(({ id, label, value, Icon }) => <div key={id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3" data-loyalty-rate={id}><dt className="flex items-center gap-2 text-xs font-medium text-[#3c7163]"><Icon size={16} strokeWidth={1.7} aria-hidden="true" />{label}</dt><dd className="m-0 flex flex-wrap items-baseline gap-1 text-lg font-bold text-[#194f43]"><bdi data-private-value>{value != null && value > 0 ? number(value) : "—"}</bdi><span className="text-xs font-medium">{fa ? "تومان" : "Toman"}</span></dd></div>)}</dl>
        <p className="mb-0 mt-1 text-xs leading-5 text-[#3c7163]">{dashboardCopy[locale].rateHint}</p>
      </div>}
    </div>
    <footer className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-[#b9d9ce] bg-white/55 px-5 py-4 text-xs leading-6 sm:px-6"><span className="flex items-center gap-2 text-[#3c7163]">{maxed ? <Crown size={16} className="shrink-0 text-[#8b641d]" aria-hidden="true" /> : <Gift size={15} className="shrink-0" aria-hidden="true" />}{fa ? "مجموع صرفه‌جویی شما تا امروز" : "Total savings to date"}</span><strong className="font-bold text-[#194f43]" data-private-value>{number(savings)} {fa ? "تومان" : "Toman"}</strong></footer>
  </DashboardMagicCard>;
}
