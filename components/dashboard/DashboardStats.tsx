import React from "react";
import { BarChart3, CheckCircle2, ArrowLeftRight, Crown, Gift, Coins } from "lucide-react";
import { formatAUD, formatNumberFa, formatToman } from "@/app/[locale]/dashboard/dashboard.utils";
import styles from "@/styles/dashboard/DashboardStats.module.css";

export function DashboardStats({ totalVolume, transactionCount, baseRate, loyaltyBonus, loyaltySavings, tailoredRate, txType }: any) {
  return (
    <section className={styles.topStats}>
      {/* Approved Volume — Sky Blue */}
      <div className={`${styles.statCard} ${styles.cardBlue}`}>
        <div className={styles.statIcon}><BarChart3 size={22} /></div>
        <div>
          <span className={styles.statLabel}>حجم تبادلات تایید شده</span>
          <strong className={styles.statValue}>{formatAUD(totalVolume)}</strong>
        </div>
      </div>

      {/* Transaction Count — Violet */}
      <div className={`${styles.statCard} ${styles.cardViolet}`}>
        <div className={styles.statIcon}><CheckCircle2 size={22} /></div>
        <div>
          <span className={styles.statLabel}>تعداد تراکنش‌های موفق</span>
          <strong className={styles.statValue}>{formatNumberFa(transactionCount)}</strong>
        </div>
      </div>

      {/* Base Exchange Rate — Amber */}
      <div className={`${styles.statCard} ${styles.cardAmber}`}>
        <div className={styles.statIcon}><ArrowLeftRight size={22} /></div>
        <div>
          <span className={styles.statLabel}>{txType === "sell_aud" ? "نرخ پایه فروش" : "نرخ پایه خرید"}</span>
          <strong className={styles.statValue}>{formatToman(baseRate)}</strong>
        </div>
      </div>

      {/* Tailored Rate — Rose */}
      <div className={`${styles.statCard} ${styles.cardRose}`}>
        <div className={styles.statIcon}><Crown size={22} /></div>
        <div>
          <span className={styles.statLabel}>نرخ اختصاصی شما</span>
          <strong className={styles.statValue}>{tailoredRate ? formatToman(tailoredRate) : "—"}</strong>
        </div>
      </div>

      {/* Loyalty Discount per tx — Teal */}
      <div className={`${styles.statCard} ${styles.cardTeal}`}>
        <div className={styles.statIcon}><Gift size={22} /></div>
        <div>
          <span className={styles.statLabel}>تخفیف وفاداری هر تراکنش</span>
          <strong className={styles.statValue}>{formatToman(loyaltyBonus)}</strong>
        </div>
      </div>

      {/* Total Loyalty Savings — Emerald */}
      <div className={`${styles.statCard} ${styles.cardGreen}`}>
        <div className={styles.statIcon}><Coins size={22} /></div>
        <div>
          <span className={styles.statLabel}>مجموع صرفه‌جویی وفاداری</span>
          <strong className={styles.statValue}>{formatToman(Number(loyaltySavings ?? 0))}</strong>
        </div>
      </div>
    </section>
  );
}