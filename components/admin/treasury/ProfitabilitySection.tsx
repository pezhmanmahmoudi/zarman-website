import React from "react";
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

  return (
    <section>
      <div className={`${cardStyles.sectionHeader} ${cardStyles.sectionHeaderMd}`}>
        <div>
          <h2 className={cardStyles.sectionTitle}>{FA.sec4}</h2>
          <p className={cardStyles.sectionDesc}>{FA.sec4Desc}</p>
        </div>
      </div>

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
              <Tooltip text="سود خالصِ محقق‌شده از معاملات و کارمزدها منهای تمامی هزینه‌های پرداختی (تراز واقعی جریان نقد عملیاتی).">{FA.operatingProfit}</Tooltip>
            </span>
          </div>
        </div>

        <div className={cardStyles.statCardCompact}>
          <div className={`${cardStyles.statIconCompact} ${a.unrealizedPL >= 0 ? cardStyles.statIconSuccess : cardStyles.statIconWarning}`}>
            <Coins size={20} />
          </div>
          <div className={cardStyles.statInfo}>
            <span className={`${cardStyles.statValue} ${a.unrealizedPL >= 0 ? s.valPositive : s.valAmber}`}>
              {fmtIRT(a.unrealizedPL)}
            </span>
            <span className={cardStyles.statLabel}>
              <Tooltip text="سود یا زیانِ دفتریِ حاصل از نوسان نرخ ارز روی دلارهای انبار. (این سود تا زمانی که دلارها فروخته نشوند، محقق نمی‌شود).">{FA.unrealizedPL}</Tooltip>
            </span>
          </div>
        </div>

        <div className={cardStyles.statCardCompact}>
          <div className={`${cardStyles.statIconCompact} ${a.fxTranslationGainLossIRT < 0 ? cardStyles.statIconDanger : cardStyles.statIconSuccess}`}>
            <Scale size={20} />
          </div>
          <div className={cardStyles.statInfo}>
            <span className={`${cardStyles.statValue} ${a.fxTranslationGainLossIRT < 0 ? s.valNegative : s.valPositive}`}>
              {fmtIRT(a.fxTranslationGainLossIRT)}
            </span>
            <span className={cardStyles.statLabel}>
              <Tooltip text="سود یا زیان ناشی از نوسان نرخ ارز بر روی حساب‌های تعهدی مشتریان (حساب‌های مجازی) و وجوهِ در راه (FX Translation).">سود/زیان تسعیر ارز</Tooltip>
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
              <Tooltip text="سود خالصِ جامع و نهایی سیستم (مجموع سود عملیاتی، سود دفتری انبار و سود تسعیر ارز بدهی‌ها).">{FA.totalProfit}</Tooltip>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}