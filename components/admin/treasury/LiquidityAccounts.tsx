import React from "react";
import { Coins, Calendar, HandCoins, Wallet } from "lucide-react";
import { fmtIRT } from "@/lib/accounting-engine";
import { FA, trendBadgeCls, trendFA, fmtMonths } from "@/lib/treasury-utils";
import type { TreasurySnapshot } from "@/lib/treasury-engine";
import type { StrategyOutput } from "@/lib/strategy-engine";
import Tooltip from "@/components/ui/Tooltip/Tooltip";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import s from "@/styles/admin/Treasury.module.css";

export default function LiquidityAccounts({
  treasury: t,
  strategy,
  accounting,
}: {
  treasury: TreasurySnapshot;
  strategy: StrategyOutput;
  accounting: { ownerLoanBalanceIRT: number };
}) {
  const { trendAnalysis: trend } = strategy;
  const ownerLoanLiability = Number(accounting?.ownerLoanBalanceIRT ?? 0);
  const netAvailableCash = t.totalIranLiquidityIRT - ownerLoanLiability;

  return (
    <section>
      <div className={`${cardStyles.sectionHeader} ${cardStyles.sectionHeaderMd}`}>
        <div>
          <h2 className={cardStyles.sectionTitle}>{FA.sec3}</h2>
          <p className={cardStyles.sectionDesc}>{FA.sec3Desc}</p>
        </div>
      </div>

      <div className={`${s.liquidityHeroCard} ${t.liquidityRatio < 1 ? s.liquidityHeroCritical : s.liquidityHeroOk}`}>
        <div className={s.liquidityHeroLeft}>
          <div className={`${s.liquidityIconWrap} ${t.liquidityRatio < 1 ? s.liquidityIconCritical : s.liquidityIconOk} ${t.liquidityRatio < 1 ? cardStyles.statIconDanger : cardStyles.statIconSuccess}`}>
            <Coins size={22} color={t.liquidityRatio < 1 ? "#ef4444" : "#059669"} />
          </div>
          <div className={s.liquidityHeroInfo}>
            <div className={s.liquidityHeroValueRow}>
              <span className={`${s.liquidityHeroValue} ${t.liquidityRatio < 1 ? s.valNegative : s.valPositive}`} dir="ltr">
                {fmtIRT(t.totalIranLiquidityIRT)}
              </span>
              <span className={`${s.trendBadge} ${trendBadgeCls(trend.liquidityTrend)}`}>
                {trendFA(trend.liquidityTrend)}
              </span>
            </div>
            <div className={s.liquidityHeroTitle}>
              <Tooltip text="کل پول نقدِ ریالی در حساب های فیزیکی بانکی (بدون در نظر گرفتن حساب های مجازی و تعهدی مشتریان).">{FA.totalLiquidity}</Tooltip>
            </div>
          </div>
        </div>
      </div>

      <div className={`${cardStyles.statsGrid} ${s.statsGridTopMd}`}>
        <div className={cardStyles.statCardCompact}>
          <div className={`${cardStyles.statIconCompact} ${ownerLoanLiability > 0 ? cardStyles.statIconWarning : cardStyles.statIconSuccess}`}>
            <HandCoins size={20} />
          </div>
          <div className={cardStyles.statInfo}>
            <span className={`${cardStyles.statValue} ${ownerLoanLiability > 0 ? s.valAmber : s.valPositive}`}>
              {fmtIRT(ownerLoanLiability)}
            </span>
            <span className={cardStyles.statLabel}>
              <Tooltip text="این مبلغ بدهی کسب وکار به مالک است (Owner Loan Payable). عدد مثبت یعنی باید به مالک بازپرداخت شود.">
                بدهی به مالک (قابل پرداخت)
              </Tooltip>
            </span>
          </div>
        </div>

        <div className={cardStyles.statCardCompact}>
          <div className={`${cardStyles.statIconCompact} ${netAvailableCash >= 0 ? cardStyles.statIconSuccess : cardStyles.statIconDanger}`}>
            <Wallet size={20} />
          </div>
          <div className={cardStyles.statInfo}>
            <span className={`${cardStyles.statValue} ${netAvailableCash >= 0 ? s.valPositive : s.valNegative}`}>
              {fmtIRT(netAvailableCash)}
            </span>
            <span className={cardStyles.statLabel}>
              <Tooltip text="نقدینگی قابل استفاده = کل نقدینگی ایران - بدهی به مالک. این شاخص تصویر محافظه کارانه تری از قدرت نقدی واقعی می دهد.">
                نقدینگی قابل استفاده (خالص)
              </Tooltip>
            </span>
          </div>
        </div>

        <div className={cardStyles.statCardCompact}>
          <div className={`${cardStyles.statIconCompact} ${
            t.liquidRunwayMonths === null ? cardStyles.statIconInfo
            : t.liquidRunwayMonths < t.settings.cash_runway_target_months ? cardStyles.statIconWarning
            : cardStyles.statIconSuccess
          }`}>
            <Calendar size={20} />
          </div>
          <div className={cardStyles.statInfo}>
            <span className={`${cardStyles.statValue} ${
              t.liquidRunwayMonths === null ? s.valNeutral
              : t.liquidRunwayMonths < t.settings.cash_runway_target_months ? s.valAmber
              : s.valPositive
            }`}>
              {fmtMonths(t.liquidRunwayMonths)}
            </span>
            <span className={cardStyles.statLabel}>
              <Tooltip text="تعداد ماه هایی که صرافی می تواند فقط با اتکا به نقدینگی ریالی فعلی، تمامی هزینه های جاری خود را پرداخت کند.">
                {FA.cashRunwayLiquid}
              </Tooltip>
            </span>
          </div>
        </div>
      </div>

      <details className={`${s.detailsBlock} ${s.detailsBlockSpaced}`}>
        <summary className={s.detailsSummary}>{FA.runwayDetailTitle}</summary>
        <div className={s.detailsContent}>
          <div className={`${s.detailsGrid} ${s.detailsGridTwo}`}>
            <div className={s.detailCard}>
              <span className={s.detailCardLabel}>
                <Tooltip text="پوشش هزینه ها فقط بر اساس موجودی نقد ریالی">{FA.cashRunwayLiquid}</Tooltip>
              </span>
              <span className={`${s.detailCardValue} ${
                t.liquidRunwayMonths !== null && t.liquidRunwayMonths < t.settings.cash_runway_target_months ? s.valAmber : s.valNeutral
              }`}>{fmtMonths(t.liquidRunwayMonths)}</span>
            </div>
            <div className={s.detailCard}>
              <span className={s.detailCardLabel}>
                <Tooltip text="تعداد ماه های دوام صرافی در صورت نقد شدن کل دلارهای انبار (نقدینگی ریالی + فروش کل موجودی).">{FA.cashRunwayTotal}</Tooltip>
              </span>
              <span className={`${s.detailCardValue} ${s.valPositive}`}>{fmtMonths(t.totalRunwayMonths)}</span>
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}
