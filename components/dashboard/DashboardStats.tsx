import React from "react";
import { Wallet, FileText, ArrowDownLeft, ShieldCheck } from "lucide-react";
import { formatAUD, formatNumberFa, formatToman } from "@/app/fa/dashboard/dashboard.utils";
import styles from "@/styles/dashboard/DashboardStats.module.css";

type DashboardStatsProps = {
  totalVolume: number;
  transactionCount: number;
  baseRate: number | null;
  loyaltyBonus: number;
  txType: "buy_aud" | "sell_aud";
};

export function DashboardStats({ totalVolume, transactionCount, baseRate, loyaltyBonus, txType }: DashboardStatsProps) {
  return (
    <section className={styles.topStats}>
      <div className={styles.statCard}>
        <div className={styles.statIcon}><Wallet size={24} /></div>
        <div><span className={styles.statLabel}>حجم کل مبادلات</span><strong className={styles.statValue}>{formatAUD(totalVolume)}</strong></div>
      </div>
      <div className={styles.statCard}>
        <div className={styles.statIcon}><FileText size={24} /></div>
        <div><span className={styles.statLabel}>تعداد تراکنش‌های موفق</span><strong className={styles.statValue}>{formatNumberFa(transactionCount)}</strong></div>
      </div>
      <div className={styles.statCard}>
        <div className={styles.statIcon}><ArrowDownLeft size={24} /></div>
        <div><span className={styles.statLabel}>{txType === "sell_aud" ? "نرخ فروش دلار به زرمان" : "نرخ خرید دلار از زرمان"}</span><strong className={styles.statValue}>{formatToman(baseRate)}</strong></div>
      </div>
      <div className={styles.statCard}>
        <div className={`${styles.statIcon} ${styles.statIconAccent}`}><ShieldCheck size={24} /></div>
        <div><span className={styles.statLabel}>تخفیف وفاداری شما</span><strong className={`${styles.statValue} ${styles.successText}`}>{formatToman(loyaltyBonus)}</strong></div>
      </div>
    </section>
  );
}