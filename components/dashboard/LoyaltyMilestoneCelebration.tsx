"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/context/LocaleContext";
import { useFinanceConfig } from "@/context/FinanceConfigContext";
import { calcLoyaltyDiscountPct } from "@/lib/pricing";
import { dashboardNumber } from "@/lib/dashboard/numbers";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DashboardButton } from "./dashboard-ui";
import { DashboardLottieScene } from "./DashboardLottieScene";

export function LoyaltyMilestoneCelebration({ userId, volume, motionEnabled = true }: { userId?: string; volume: number; motionEnabled?: boolean }) {
  const locale = useLocale(), fa = locale === "fa", config = useFinanceConfig();
  const [open, setOpen] = useState(false);
  const stepVolume = config.discount_step_volume > 0 ? config.discount_step_volume : 1000;
  const stepPercent = config.discount_percent_per_step;
  const maxTier = stepPercent > 0 ? Math.floor(config.max_discount_percent / stepPercent) : 0;
  const tier = Math.min(Math.floor(Math.max(0, volume) / stepVolume), maxTier);
  const benefit = calcLoyaltyDiscountPct(volume, config) * 100;

  useEffect(() => {
    if (!userId || tier < 1) return;
    const storageKey = `zarman:loyalty-tier-seen:v1:${userId}`;
    try {
      const seen = Number(window.localStorage.getItem(storageKey) || 0);
      if (seen >= tier) return;
    } catch {
      // Storage may be disabled; the celebration still appears for this mount.
    }
    const timer = window.setTimeout(() => {
      try { window.localStorage.setItem(storageKey, String(tier)); } catch { /* Optional browser storage. */ }
      setOpen(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [tier, userId]);

  if (tier < 1) return null;
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent className="max-w-[calc(100%-2rem)] overflow-hidden rounded-[28px] border border-[#d8eadf] bg-[linear-gradient(155deg,#ffffff_25%,#eaf8f2_100%)] p-0 text-[#183a31] shadow-[0_28px_90px_-32px_#173f34] sm:max-w-md" overlayClassName="bg-[#1d2230]/20 backdrop-blur-sm">
      <div className="flex flex-col items-center px-6 pb-7 pt-8 text-center sm:px-9 sm:pb-9">
        <DashboardLottieScene name="loyalty-milestone" size={150} motionEnabled={motionEnabled} className="mb-1" />
        <span className="rounded-full border border-[#b9dfd0] bg-white/75 px-3 py-1.5 text-xs font-semibold text-[#26705c]">{fa ? `مرحله ${dashboardNumber(tier, locale)} وفاداری` : `Loyalty level ${dashboardNumber(tier, locale)}`}</span>
        <DialogTitle className="mb-0 mt-5 text-2xl font-semibold leading-snug text-[#183a31]">{fa ? "یک مزیت تازه برای شما باز شد!" : "You’ve unlocked a new benefit!"}</DialogTitle>
        <DialogDescription className="mb-0 mt-3 max-w-sm text-sm leading-7 text-[#4c7167]">{fa ? <>مزیت وفاداری شما اکنون <bdi dir="ltr">{dashboardNumber(benefit, locale, 2)}٪</bdi> از فاصله نرخ خرید و فروش است.</> : <>Your loyalty benefit is now <bdi>{dashboardNumber(benefit, locale, 2)}%</bdi> of the exchange-rate spread.</>}</DialogDescription>
        <DashboardButton className="mt-6 min-w-36" onClick={() => setOpen(false)}>{fa ? "عالیه" : "Lovely"}</DashboardButton>
      </div>
    </DialogContent>
  </Dialog>;
}
