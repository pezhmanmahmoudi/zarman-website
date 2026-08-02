import React from "react";
import { BarChart3, CheckCircle2, ArrowLeftRight, Crown, Gift, Coins } from "lucide-react";
import styles from "@/styles/dashboard/DashboardStats.module.css";
import { useT } from "@/hooks/useT";
import { useLocale } from "@/context/LocaleContext";

function toFaDigits(input: string) {
  return String(input).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

function formatNumberByLocale(value: number, locale: string, maxFractionDigits = 2) {
  const en = Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  });
  if (locale === "fa") return toFaDigits(en).replace(/,/g, "،");
  return en;
}

function formatAudByLocale(value: number, locale: string) {
  if (!value) return locale === "fa" ? "$۰" : "$0";
  return `$${formatNumberByLocale(value, locale, 2)}`;
}

function formatTomanByLocale(value: number | null | undefined, locale: string) {
  if (!value) return "—";
  const amount = formatNumberByLocale(value, locale, 0);
  return `${amount} ${locale === "fa" ? "تومان" : "Toman"}`;
}

export function DashboardStats({ totalVolume, transactionCount, baseRate, loyaltyBonus, loyaltySavings, tailoredRate, txType }: any) {
  const t = useT();
  const locale = useLocale();
  return (
    <section className={styles.topStats}>
      <div className={`${styles.statCard} ${styles.cardBlue}`}>
        <div className={styles.statIcon}><BarChart3 size={22} /></div>
        <div>
          <span className={styles.statLabel}>{t.stats.approvedVolume}</span>
          <strong className={styles.statValue}>{formatAudByLocale(totalVolume, locale)}</strong>
        </div>
      </div>

      <div className={`${styles.statCard} ${styles.cardViolet}`}>
        <div className={styles.statIcon}><CheckCircle2 size={22} /></div>
        <div>
          <span className={styles.statLabel}>{t.stats.successfulTx}</span>
          <strong className={styles.statValue}>{formatNumberByLocale(transactionCount, locale, 0)}</strong>
        </div>
      </div>

      <div className={`${styles.statCard} ${styles.cardAmber}`}>
        <div className={styles.statIcon}><ArrowLeftRight size={22} /></div>
        <div>
          <span className={styles.statLabel}>{txType === "sell_aud" ? t.stats.baseSellRate : t.stats.baseBuyRate}</span>
          <strong className={styles.statValue}>{formatTomanByLocale(baseRate, locale)}</strong>
        </div>
      </div>

      <div className={`${styles.statCard} ${styles.cardRose}`}>
        <div className={styles.statIcon}><Crown size={22} /></div>
        <div>
          <span className={styles.statLabel}>{t.stats.tailoredRate}</span>
          <strong className={styles.statValue}>{tailoredRate ? formatTomanByLocale(tailoredRate, locale) : "—"}</strong>
        </div>
      </div>

      <div className={`${styles.statCard} ${styles.cardTeal}`}>
        <div className={styles.statIcon}><Gift size={22} /></div>
        <div>
          <span className={styles.statLabel}>{t.stats.loyaltyPerTx}</span>
          <strong className={styles.statValue}>{formatTomanByLocale(loyaltyBonus, locale)}</strong>
        </div>
      </div>

      <div className={`${styles.statCard} ${styles.cardGreen}`}>
        <div className={styles.statIcon}><Coins size={22} /></div>
        <div>
          <span className={styles.statLabel}>{t.stats.totalSavings}</span>
          <strong className={styles.statValue}>{formatTomanByLocale(Number(loyaltySavings ?? 0), locale)}</strong>
        </div>
      </div>
    </section>
  );
}