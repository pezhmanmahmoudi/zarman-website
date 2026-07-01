import React from "react";
import { DollarSign, Activity, Scale } from "lucide-react";
import { fmtAUD, fmtIRT, fmtRate } from "@/lib/accounting-engine";
import { FA, inventoryBorderCls, trendBadgeCls, trendFA, pct, fmtDays } from "@/lib/treasury-utils";
import Tooltip from "@/components/ui/Tooltip/Tooltip";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import s from "@/styles/admin/Treasury.module.css";

export default function MarketInventory({ treasury: t, strategy }: { treasury: any, strategy: any }) {
  const { trendAnalysis: trend } = strategy;
  const invColor = t.audInventory < 0 ? s.valNegative : t.audInventory < t.settings.min_aud_inventory ? s.valNegative : t.audInventory > t.settings.max_aud_inventory ? s.valAmber : s.valPositive;
  const gapColor = t.inventoryGap >= 0 ? s.valPositive : s.valNegative;

  return (
    <section>
      <div className={`${cardStyles.sectionHeader} ${cardStyles.sectionHeaderMd}`}>
        <div>
          <h2 className={cardStyles.sectionTitle}>{FA.sec2}</h2>
          <p className={cardStyles.sectionDesc}>{FA.sec2Desc}</p>
        </div>
      </div>

      <div className={`${s.inventoryHeroCard} ${inventoryBorderCls(t.audInventory, t.settings.min_aud_inventory, t.settings.max_aud_inventory)}`}>
        <div className={s.inventoryHeroMain}>
          <div className={`${cardStyles.statIconCompact} ${t.audInventory < t.settings.min_aud_inventory ? cardStyles.statIconDanger : cardStyles.statIconSuccess} ${s.statIconNoShrink}`}>
            <DollarSign size={22} />
          </div>
          <div>
            <div className={s.inventoryHeroTopRow}>
              <span className={`${s.inventoryHeroValue} ${invColor}`} dir="ltr">{fmtAUD(t.audInventory)}</span>
              <span className={`${s.trendBadge} ${trendBadgeCls(trend.inventoryTrend)}`}>{trendFA(trend.inventoryTrend)}</span>
            </div>
            <div className={s.inventoryHeroLabel}>{FA.audInventory}</div>
          </div>
        </div>
        <div className={s.inventoryHeroRow}>
          <div className={s.inventoryHeroItem}>
            <span className={s.inventoryHeroItemLabel}>{FA.invTarget}</span>
            <span className={`${s.inventoryHeroItemValue} ${s.valNeutral}`} dir="ltr">{fmtAUD(t.targetInventory)}</span>
          </div>
          <div className={s.inventoryHeroItem}>
            <span className={s.inventoryHeroItemLabel}>{FA.invGap}</span>
            <span className={`${s.inventoryHeroItemValue} ${gapColor}`} dir="ltr">{t.inventoryGap >= 0 ? "+" : ""}{fmtAUD(t.inventoryGap)}</span>
          </div>
          <div className={s.inventoryHeroItem}>
            <span className={s.inventoryHeroItemLabel}>{FA.invRatio}</span>
            <span className={`${s.inventoryHeroItemValue} ${t.inventoryRatio < 0.5 ? s.valAmber : s.valNeutral}`} dir="ltr">{pct(t.inventoryRatio)}</span>
          </div>
          <div className={s.inventoryHeroItem}>
            <span className={s.inventoryHeroItemLabel}>{FA.coverageDays}</span>
            <span className={`${s.inventoryHeroItemValue} ${t.coverageDays !== null && t.coverageDays < t.settings.inventory_coverage_target_days ? s.valNegative : s.valNeutral}`} dir="ltr">
              {fmtDays(t.coverageDays)}
            </span>
          </div>
        </div>
      </div>

      <div className={`${cardStyles.statsGrid} ${s.statsGridTopSm}`}>
        <div className={cardStyles.statCardCompact}>
          <div className={`${cardStyles.statIconCompact} ${cardStyles.statIconAccent}`}><Activity size={20} /></div>
          <div className={cardStyles.statInfo}>
            <span className={`${cardStyles.statValue} ${s.valAccent}`}>{fmtRate(t.currentBuyRate)}</span>
            <span className={cardStyles.statLabel}>
              <Tooltip text="نرخ خرید فعلی دلار در بازار. این نرخ مبنای محاسبه ارزش روزِ دارایی‌های ارزی صرافی است.">{FA.currentRate}</Tooltip>
            </span>
          </div>
        </div>

        <div className={cardStyles.statCardCompact}>
          <div className={`${cardStyles.statIconCompact} ${cardStyles.statIconInfo}`}><Scale size={20} /></div>
          <div className={cardStyles.statInfo}>
            <span className={`${cardStyles.statValue} ${t.wac > 0 && t.currentBuyRate > t.wac ? s.valPositive : s.valNeutral}`}>
              {t.wac > 0 ? fmtRate(t.wac) : FA.na}
            </span>
            <span className={cardStyles.statLabel}>
              {t.wac > 0 && t.currentBuyRate > 0 ? (
                <Tooltip text={`میانگین موزون بهای تمام‌شده (WAC). این عدد نشان‌دهنده میانگین قیمتِ خریدهای انجام شده برای دلارهای موجود در انبار است. (حاشیه سود فعلی: ${fmtRate(t.currentBuyRate - t.wac)})`}>{FA.wac}</Tooltip>
              ) : (
                FA.wac
              )}
            </span>
          </div>
        </div>
      </div>

      <details className={s.detailsBlock}>
        <summary className={s.detailsSummary}>{FA.invDetailTitle}</summary>
        <div className={s.detailsContent}>
          <div className={`${s.detailsGrid} ${s.detailsGridFour}`}>
            <div className={s.detailCard}>
              <span className={s.detailCardLabel}>{FA.invCostVal}</span>
              <span className={`${s.detailCardValue} ${s.valNeutral}`}>{fmtIRT(t.inventoryCostValueIRT)}</span>
              <span className={s.detailCardHint}>{fmtAUD(t.audInventory)} × WAC ({fmtRate(t.wac)})</span>
            </div>
            <div className={s.detailCard}>
              <span className={s.detailCardLabel}>{FA.invMarketVal}</span>
              <span className={`${s.detailCardValue} ${s.valNeutral}`}>{fmtIRT(t.inventoryMarketValueIRT)}</span>
              <span className={s.detailCardHint}>{fmtAUD(t.audInventory)} × {fmtRate(t.currentBuyRate)}</span>
            </div>
            <div className={s.detailCard}>
              <span className={s.detailCardLabel}>
                <Tooltip text="اختلافِ ارزشِ روزِ دلارها نسبت به بهای تمام‌شده‌ی آن‌ها (ارزش بازار منهای قیمت خرید).">{FA.invValDiff}</Tooltip>
              </span>
              <span className={`${s.detailCardValue} ${t.inventoryMarketValueIRT - t.inventoryCostValueIRT >= 0 ? s.valPositive : s.valNegative}`}>
                {t.inventoryMarketValueIRT - t.inventoryCostValueIRT >= 0 ? "+" : ""}{fmtIRT(t.inventoryMarketValueIRT - t.inventoryCostValueIRT)}
              </span>
            </div>
            <div className={s.detailCard}>
              <span className={s.detailCardLabel}>
                <Tooltip text="درصدِ انحرافِ موجودی فعلی نسبت به تارگتِ ایده‌آلِ تعیین شده در تنظیمات استراتژی.">{FA.invGapPct}</Tooltip>
              </span>
              <span className={`${s.detailCardValue} ${t.inventoryGapPercent >= 0 ? s.valPositive : s.valNegative}`}>
                {t.inventoryGapPercent >= 0 ? "+" : ""}{t.inventoryGapPercent.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}