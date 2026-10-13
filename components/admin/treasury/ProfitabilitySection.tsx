import React from "react";
import BusinessValueCards from "./BusinessValueCards";
import { TrendingUp, Coins, Scale, BarChart2 } from "lucide-react";
import { fmtIRT } from "@/lib/accounting-engine";
import { FA, trendBadgeCls, trendFA } from "@/lib/treasury-utils";
import type { AccountingSnapshot } from "@/lib/accounting-engine";
import type { StrategyOutput } from "@/lib/strategy-engine";
import Tooltip from "@/components/ui/Tooltip/Tooltip";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import s from "@/styles/admin/Treasury.module.css";

export default function ProfitabilitySection({ accounting: a, strategy }: { accounting: AccountingSnapshot, strategy: StrategyOutput }) {
  const { trendAnalysis: trend } = strategy;
  const inventoryOnlyGainIRT = a.unrealizedPL - a.fxTranslationGainLossIRT;
  const realizedFXGainLossIRT = a.realizedFXGainLossIRT ?? 0;
  const combinedFXGainLossIRT = a.fxTranslationGainLossIRT + realizedFXGainLossIRT;
  return (
    <section>
      <div className={`${cardStyles.sectionHeader} ${cardStyles.sectionHeaderMd}`}>
        <div>
          <h2 className={cardStyles.sectionTitle}>{FA.sec4}</h2>
        </div>
      </div>

      <BusinessValueCards accounting={a} />

      <div className={`${cardStyles.statsGrid} ${s.statsGridBottomMd}`}>
        <div className={cardStyles.statCardCompact}>
          <div className={`${cardStyles.statIconCompact} ${a.operatingProfit >= 0 ? cardStyles.statIconSuccess : cardStyles.statIconDanger}`}>
            <TrendingUp size={20} />
          </div>
          <div className={cardStyles.statInfo}>
            <div className={s.statValueWithTrend}>
              <span className={`${cardStyles.statValue} ${a.operatingProfit >= 0 ? s.valPositive : s.valNegative}`}>
                {fmtIRT(a.operatingProfit)}
              </span>
              <span className={`${s.trendBadge} ${trendBadgeCls(trend.profitabilityTrend)}`}>
                {trendFA(trend.profitabilityTrend)}
              </span>
            </div>
            <span className={cardStyles.statLabel}>
              <Tooltip text="سود معاملات و کارمزدها، پس از کسر هزینه‌های پرداخت‌شده.">{FA.operatingProfit}</Tooltip>
            </span>
          </div>
        </div>

        <div className={cardStyles.statCardCompact}>
          <div className={`${cardStyles.statIconCompact} ${inventoryOnlyGainIRT >= 0 ? cardStyles.statIconSuccess : cardStyles.statIconWarning}`}>
            <Coins size={20} />
          </div>
          <div className={cardStyles.statInfo}>
            <span className={`${cardStyles.statValue} ${inventoryOnlyGainIRT >= 0 ? s.valPositive : s.valAmber}`}>
              {fmtIRT(inventoryOnlyGainIRT)}
            </span>
            <span className={cardStyles.statLabel}>
              <Tooltip text="تفاوت ارزش دلارهای موجود با قیمت خریدشان.">{FA.unrealizedPL}</Tooltip>
            </span>
          </div>
        </div>

        <div className={cardStyles.statCardCompact}>
          <div className={`${cardStyles.statIconCompact} ${combinedFXGainLossIRT < 0 ? cardStyles.statIconDanger : cardStyles.statIconSuccess}`}>
            <Scale size={20} />
          </div>
          <div className={cardStyles.statInfo}>
            <span className={`${cardStyles.statValue} ${combinedFXGainLossIRT < 0 ? s.valNegative : s.valPositive}`}>
              {fmtIRT(combinedFXGainLossIRT)}
            </span>
            <span className={cardStyles.statLabel}>
              <Tooltip text="اثر تغییر نرخ ارز بر پرداخت‌ها و بدهی‌های ارزی.">سود/زیان ارز و تسعیر</Tooltip>
            </span>
          </div>
        </div>

        <div className={`${cardStyles.statCardCompact} ${s.statCardStrongBorder}`}>
          <div className={`${cardStyles.statIconCompact} ${a.totalProfit >= 0 ? cardStyles.statIconSuccess : cardStyles.statIconDanger}`}>
            <BarChart2 size={20} />
          </div>
          <div className={cardStyles.statInfo}>
            <span className={`${cardStyles.statValue} ${a.totalProfit >= 0 ? s.valPositive : s.valNegative}`}>
              {fmtIRT(a.totalProfit)}
            </span>
            <span className={cardStyles.statLabel}>
              <Tooltip text="سود عملیاتی به‌اضافه تغییر ارزش موجودی و ارز.">{FA.totalProfit}</Tooltip>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
