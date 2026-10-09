"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/context/LocaleContext";
import { useFinanceConfig } from "@/context/FinanceConfigContext";
import { Check } from "lucide-react";
import { loyaltyJourney } from "@/lib/dashboard/loyalty";
import { dashboardNumber } from "@/lib/dashboard/numbers";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DashboardButton } from "./dashboard-ui";
import { DashboardLottieScene } from "./DashboardLottieScene";
import styles from "@/styles/dashboard/Loyalty.module.css";

export function LoyaltyMilestoneCelebration({ userId, volume, motionEnabled = true }: { userId?: string; volume: number; motionEnabled?: boolean }) {
  const locale = useLocale(), fa = locale === "fa", config = useFinanceConfig();
  const [open, setOpen] = useState(false);
  const { level: tier, maxed } = loyaltyJourney(volume, config);
  const tierLabel = dashboardNumber(tier, locale);
  const firstLevel = tier === 1;

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
    <DialogContent dir={fa ? "rtl" : "ltr"} className={`${styles.celebration} ${motionEnabled ? "" : "animate-none! transition-none!"}`} data-cap={maxed} overlayClassName="bg-[#142f27]/30 backdrop-blur-sm">
      <div className={styles.celebrationBody}>
        <div className={styles.medallion} aria-hidden="true">
          <DashboardLottieScene name="loyalty-milestone" size={128} motionEnabled={motionEnabled} />
        </div>
        <span className={styles.celebrationSuccess}><Check size={16} className="shrink-0" aria-hidden="true" />{fa ? `مرحله ${tierLabel} وفاداری: موفقیت آمیز!` : `Loyalty level ${tierLabel}: unlocked!`}</span>
        <DialogTitle className={styles.celebrationTitle}>{firstLevel ? fa ? "شما حالا یک مشتری ویژه هستید!" : "You’re now a valued club member!" : fa ? "قدردانی از همراهی شما" : "Thank you for being with us"}</DialogTitle>
        <DialogDescription className={styles.celebrationDescription}>{firstLevel
          ? fa ? `با عبور از ${tierLabel} سطح وفاداری باشگاه مشتریان زرمان، حالا از نرخ‌های بهتر در خرید و فروش‌های خود بهره‌مند می‌شوید.` : `With your first Zarman Loyalty Club level unlocked, you now enjoy better rates when buying and selling.`
          : fa ? `شما ${tierLabel} سطح وفاداری را با موفقیت طی کردید! به پاس همراهی شما، از این پس معاملات شما با نرخ‌های مطلوب‌تر انجام خواهد شد.` : `You’ve successfully reached ${tierLabel} loyalty levels! To thank you for staying with us, your exchanges now benefit from more favourable rates.`}</DialogDescription>
        <DashboardButton className={styles.celebrationButton} onClick={() => setOpen(false)}>{fa ? "عالیه!" : "Wonderful!"}</DashboardButton>
      </div>
    </DialogContent>
  </Dialog>;
}
