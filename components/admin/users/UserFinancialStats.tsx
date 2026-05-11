"use client";

import React from "react";
import { TrendingUp, ArrowLeftRight, Coins } from "lucide-react";
import cardStyles from "@/styles/admin/AdminCards.module.css";

interface UserFinancialStatsProps {
  approvedVolume: number;
  approvedCount: number;
  loyaltyDiscountPct: number;
  currentRates?: { sellAUD: number | null; buyAUD: number | null };
}

export function UserFinancialStats({
  approvedVolume,
  approvedCount,
  loyaltyDiscountPct,
  currentRates,
}: UserFinancialStatsProps) {
  const spread = currentRates?.sellAUD && currentRates?.buyAUD 
    ? Math.abs(currentRates.sellAUD - currentRates.buyAUD) 
    : 0;
  
  const loyaltyPerAudToman = spread * loyaltyDiscountPct;

  return (
    <div className={cardStyles.statsGrid}>
      <div className={cardStyles.statCard}>
        <div className={`${cardStyles.statIcon} ${cardStyles.statIconAccent}`}>
          <TrendingUp size={20} />
        </div>
        <div className={cardStyles.statValueBlock}>
          <div className={cardStyles.statValue}>
            ${approvedVolume.toLocaleString("en-AU", { maximumFractionDigits: 2 })}
          </div>
          <div className={cardStyles.statLabel}>Approved Volume (AUD)</div>
        </div>
      </div>

      <div className={cardStyles.statCard}>
        <div className={`${cardStyles.statIcon} ${cardStyles.statIconSuccess}`}>
          <ArrowLeftRight size={20} />
        </div>
        <div className={cardStyles.statValueBlock}>
          <div className={cardStyles.statValue}>{approvedCount}</div>
          <div className={cardStyles.statLabel}>Approved Transactions</div>
        </div>
      </div>

      <div className={cardStyles.statCard}>
        <div className={`${cardStyles.statIcon} ${cardStyles.statIconWarning}`}>
          <TrendingUp size={20} />
        </div>
        <div className={cardStyles.statValueBlock}>
          <div className={cardStyles.statValue}>
            {(loyaltyDiscountPct * 100).toFixed(1)}%
          </div>
          <div className={cardStyles.statLabel}>Loyalty Spread Discount</div>
        </div>
      </div>

      <div className={cardStyles.statCard}>
        <div className={`${cardStyles.statIcon} ${cardStyles.statIconInfo}`}>
          <Coins size={20} />
        </div>
        <div className={cardStyles.statValueBlock}>
          <div className={cardStyles.statValue}>
            {Math.floor(loyaltyPerAudToman).toLocaleString("en-AU")} <span className={cardStyles.statLabel} style={{ display: 'inline-block', marginLeft: '0.25rem' }}>Toman</span>
          </div>
          <div className={cardStyles.statLabel}>Loyalty per AUD</div>
        </div>
      </div>
    </div>
  );
}
