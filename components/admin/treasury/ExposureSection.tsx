import React from "react";
import { Percent, Scale } from "lucide-react";
import { FA, exposureCardCls, pct, trendBadgeCls, trendFA } from "@/lib/treasury-utils";
import Tooltip from "@/components/ui/Tooltip/Tooltip";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import s from "@/styles/admin/Treasury.module.css";


export default function ExposureSection({ treasury: t, strategy }: { treasury: any, strategy: any }) {
  const { trendAnalysis: trend } = strategy;

  return (
    <section>
      <div className={`${cardStyles.sectionHeader} ${cardStyles.sectionHeaderMd}`}>
        <div>
          <h2 className={cardStyles.sectionTitle}>{FA.secExposure}</h2>
          <p className={cardStyles.sectionDesc}>{FA.secExposureDesc}</p>
        </div>
      </div>

      <div className={cardStyles.statsGrid}>
        <div className={`${cardStyles.statCardCompact} ${exposureCardCls(t.exposureMarketBasis, t.settings.target_exposure_ratio, t.settings.max_aud_exposure)}`}>
          <div className={`${cardStyles.statIconCompact} ${
            t.exposureMarketBasis > t.settings.max_aud_exposure ? cardStyles.statIconDanger
            : t.exposureMarketBasis > t.settings.max_aud_exposure * 0.85 ? cardStyles.statIconWarning
            : cardStyles.statIconSuccess
          }`}>
            <Percent size={20} />
          </div>
          <div className={cardStyles.statInfo}>
            <div className={s.statValueWithTrend}>
              <span className={`${cardStyles.statValue} ${
                t.exposureMarketBasis > t.settings.max_aud_exposure ? s.valNegative
                : t.exposureMarketBasis > t.settings.max_aud_exposure * 0.85 ? s.valAmber
                : s.valPositive
              }`}>{pct(t.exposureMarketBasis)}</span>
              <span className={`${s.trendBadge} ${trendBadgeCls(trend.exposureTrend)}`}>
                {trendFA(trend.exposureTrend)}
              </span>
            </div>
            <span className={cardStyles.statLabel}>
              <Tooltip text={`ریسک مواجهه ارزی: چه درصدی از کل دارایی‌های صرافی به شکل دلار نگهداری می‌شود (محاسبه بر اساس ارزش روز). هرچه این درصد بالاتر باشد، ریسک نوسانات ارزی بیشتر است.`}>
                {FA.exposureMarket}
              </Tooltip>
            </span>
          </div>
        </div>

        <div className={`${cardStyles.statCardCompact} ${exposureCardCls(t.exposureCostBasis, t.settings.target_exposure_ratio, t.settings.max_aud_exposure)}`}>
          <div className={`${cardStyles.statIconCompact} ${
            t.exposureCostBasis > t.settings.max_aud_exposure ? cardStyles.statIconDanger
            : cardStyles.statIconInfo
          }`}>
            <Scale size={20} />
          </div>
          <div className={cardStyles.statInfo}>
            <span className={`${cardStyles.statValue} ${
              t.exposureCostBasis > t.settings.max_aud_exposure ? s.valNegative
              : t.exposureCostBasis > t.settings.max_aud_exposure * 0.85 ? s.valAmber
              : s.valNeutral
            }`}>{pct(t.exposureCostBasis)}</span>
            <span className={cardStyles.statLabel}>
              <Tooltip text="ریسک مواجهه ارزی بر اساس بهای تمام‌شده: چه درصدی از کل سرمایه اولیه، تبدیل به دلار شده است.">{FA.exposureCost}</Tooltip>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}