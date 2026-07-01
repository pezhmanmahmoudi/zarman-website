import React from "react";
import { ArrowDownCircle, ArrowUpCircle, Minus, AlertTriangle, ArrowRight, Calendar, Info } from "lucide-react";
import { fmtAUD } from "@/lib/accounting-engine";
import { 
  FA, recCardCls, recBadgeCls, riskCls, riskFA, trendBadgeCls, trendFA, pct, 
  scoreCircleCls, scoreNumCls, catBadgeCls, catFA, scoreBarColor, fmtDays 
} from "@/lib/treasury-utils";
import Tooltip from "@/components/ui/Tooltip/Tooltip";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import s from "@/styles/admin/Treasury.module.css";

export default function StrategyCenter({ strategy, treasury }: { strategy: any, treasury: any }) {
  const { recommendation: rec, healthScore: hs, rateAdjustmentSuggestion: rateAdj, trendAnalysis: trend } = strategy;
  const t = treasury;

  const breakdownItems = [
    { label: FA.scoreInventory,     score: hs.breakdown.inventory,     weight: "30%" },
    { label: FA.scoreLiquidity,     score: hs.breakdown.liquidity,     weight: "25%" },
    { label: FA.scoreExposure,      score: hs.breakdown.exposure,      weight: "20%" },
    { label: FA.scoreProfitability, score: hs.breakdown.profitability, weight: "15%" },
    { label: FA.scoreForecast,      score: hs.breakdown.forecast,      weight: "10%" },
  ];

  return (
    <section>
      <div className={`${cardStyles.sectionHeader} ${cardStyles.sectionHeaderMd}`}>
        <div>
          <h2 className={cardStyles.sectionTitle}>{FA.sec1}</h2>
          <p className={cardStyles.sectionDesc}>{FA.sec1Desc}</p>
        </div>
      </div>

      <div className={s.strategyPanel}>
        {/* Recommendation Card */}
        <div className={`${s.recommendationCard} ${recCardCls(rec.action)}`}>
          <div className={s.recBadgeRow}>
            <span className={`${s.recActionBadge} ${recBadgeCls(rec.action)}`}>
              {rec.action === "BUY_AUD"  ? <ArrowDownCircle size={13} /> :
               rec.action === "SELL_AUD" ? <ArrowUpCircle   size={13} /> :
               rec.action === "HOLD"     ? <Minus            size={13} /> :
                                           <AlertTriangle    size={13} />}
              &nbsp;{FA[rec.action as keyof typeof FA]}
            </span>
            <span className={`${s.riskBadge} ${riskCls(rec.riskLevel)}`}>{riskFA(rec.riskLevel)}</span>
            <span className={`${s.trendBadge} ${trendBadgeCls(trend.healthScoreTrend)}`}>{trendFA(trend.healthScoreTrend)}</span>
          </div>

          <div className={s.recTitle}>{rec.titleFA}</div>
          <div className={s.recBody}>{rec.reasoningFA}</div>

          {rec.inactionRiskFA && (
            <div className={s.recBlock}>
              <div className={s.recBlockLabel}>{FA.inactionLabel}</div>
              <div className={s.recBlockText}>{rec.inactionRiskFA}</div>
            </div>
          )}
          {rec.suggestedActionFA && (
            <div className={s.recBlock}>
              <div className={s.recBlockLabel}>{FA.actionLabel}</div>
              <div className={s.recBlockText}>{rec.suggestedActionFA}</div>
            </div>
          )}

          {rec.drivingMetrics.length > 0 && (
            <div className={s.recDrivingWrap}>
              <div className={`${s.recBlockLabel} ${s.recBlockLabelTight}`}>{FA.drivingLabel}</div>
              <div className={s.drivingMetrics}>
                {rec.drivingMetrics.slice(0, 3).map((m: string) => <span key={m} className={s.drivingChip}>{m}</span>)}
              </div>
            </div>
          )}

          <div className={`${s.confidenceBar} ${s.confidenceBarSpaced}`}>
            <div className={s.confidenceTrack}>
              <div className={s.confidenceFill} style={{ width: pct(rec.confidence) }} />
            </div>
            <span className={s.confidenceValue}>{FA.confLabel}: {pct(rec.confidence, 0)}</span>
          </div>
        </div>

        {/* Health Score Card */}
        <div className={s.healthCard}>
          <div className={s.healthScoreRow}>
            <div className={`${s.healthScoreCircle} ${scoreCircleCls(hs.category)}`}>
              <span className={`${s.healthScoreNum} ${scoreNumCls(hs.category)}`}>{Math.round(hs.score)}</span>
              <span className={s.healthScoreLabel}>{FA.healthLabel}</span>
            </div>
            <div className={s.healthScoreInfo}>
              <div className={s.healthBadgeRow}>
                <span className={`${s.healthCategoryBadge} ${catBadgeCls(hs.category)}`}>{catFA(hs.category)}</span>
                <span className={`${s.trendBadge} ${trendBadgeCls(hs.trend)}`}>{trendFA(hs.trend)}</span>
              </div>
              <div className={`${s.healthExplanation} ${s.healthExplanationSpaced}`}>{hs.explanationFA}</div>
            </div>
          </div>

          <div>
            <div className={s.healthBreakdownTitle}>{FA.breakdownLabel}</div>
            <div className={s.healthBreakdown}>
              {breakdownItems.map(item => (
                <div key={item.label} className={s.breakdownRow}>
                  <span className={s.breakdownLabel}>{item.label}</span>
                  <div className={s.breakdownTrack}>
                    <div className={s.breakdownFill} style={{ width: `${item.score}%`, background: scoreBarColor(item.score) }} />
                  </div>
                  <span className={s.breakdownScore} style={{ color: scoreBarColor(item.score) }}>{Math.round(item.score)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Rate Adjustment Card */}
      <div className={s.rateAdjCard}>
        <div className={s.rateAdjHeader}>
          <ArrowRight size={16} className={s.rateAdjIcon} />
          <span className={s.rateAdjTitle}>{FA.rateAdjTitle}</span>
        </div>
        <div className={s.rateAdjGrid}>
          <div className={s.rateAdjItem}>
            <span className={s.rateAdjLabel}>{FA.rateAdjBuyLabel}</span>
            <span className={`${s.rateAdjDelta} ${rateAdj.buyRateDelta > 0 ? s.rateAdjDeltaPos : rateAdj.buyRateDelta < 0 ? s.rateAdjDeltaNeg : s.rateAdjDeltaNeutral}`}>
              {rateAdj.buyRateDelta === 0 ? FA.rateAdjNoChange : `${rateAdj.buyRateDelta > 0 ? "+" : ""}${rateAdj.buyRateDelta.toLocaleString()} ${FA.rateAdjToman}`}
            </span>
          </div>
          <div className={s.rateAdjItem}>
            <span className={s.rateAdjLabel}>{FA.rateAdjSellLabel}</span>
            <span className={`${s.rateAdjDelta} ${rateAdj.sellRateDelta > 0 ? s.rateAdjDeltaPos : rateAdj.sellRateDelta < 0 ? s.rateAdjDeltaNeg : s.rateAdjDeltaNeutral}`}>
              {rateAdj.sellRateDelta === 0 ? FA.rateAdjNoChange : `${rateAdj.sellRateDelta > 0 ? "+" : ""}${rateAdj.sellRateDelta.toLocaleString()} ${FA.rateAdjToman}`}
            </span>
          </div>
        </div>
        {rateAdj.explanationFA && <div className={s.rateAdjExplanation}>{rateAdj.explanationFA}</div>}
        <div className={s.rateAdjDisclaimer}>{FA.rateAdjDisclaimer}</div>
      </div>

      {/* Forecast Card */}
      <div className={s.forecastCard}>
        <div className={s.forecastHeader}>
          <Calendar size={16} className={s.forecastIcon} />
          <span className={s.forecastTitle}>{FA.forecastTitle}</span>
          <span className={s.forecastDesc}>— {FA.forecastDesc}</span>
        </div>
        {t.forecast.available ? (
          <>
            <div className={s.forecastLabel}>{t.forecast.forecastLabel}</div>
            <div className={s.velocityRow}>
              <div className={s.velocityItem}>
                <span className={s.velocityValue}>{fmtAUD(t.forecast.velocity7d)}/day</span>
                <span className={s.velocityLabel}>
                  <Tooltip text="میانگین سرعت فروش و خروج دلار از انبار در ۷ روز گذشته." iconSize={11}>{FA.v7Label}</Tooltip>
                </span>
              </div>
              <div className={s.velocityItem}>
                <span className={s.velocityValue}>{fmtAUD(t.forecast.velocity30d)}/day</span>
                <span className={s.velocityLabel}>
                  <Tooltip text="میانگین سرعت فروش و خروج دلار از انبار در ۳۰ روز گذشته." iconSize={11}>{FA.v30Label}</Tooltip>
                </span>
              </div>
              <div className={s.velocityItem}>
                <span className={`${s.velocityValue} ${s.valPositive}`}>{fmtAUD(t.forecast.buyVelocity30d)}/day</span>
                <span className={s.velocityLabel}>
                  <Tooltip text="میانگین سرعت تامین و ورود دلار به انبار در ۳۰ روز گذشته." iconSize={11}>{FA.vBuyLabel}</Tooltip>
                </span>
              </div>
              <div className={s.velocityItem}>
                <span className={`${s.velocityValue} ${t.forecast.netVelocity >= 0 ? s.valPositive : s.valNegative}`}>
                  {t.forecast.netVelocity >= 0 ? "+" : ""}{fmtAUD(t.forecast.netVelocity)}/day
                </span>
                <span className={s.velocityLabel}>
                  <Tooltip text="سرعت خالص تغییرات انبار (ورودی منهای خروجی). عدد منفی به معنای در حال تخلیه بودن انبار است." iconSize={11}>{FA.vNetLabel}</Tooltip>
                </span>
              </div>
              <div className={s.velocityItem}>
                <span className={`${s.velocityValue} ${t.coverageDays !== null && t.coverageDays < t.settings.inventory_coverage_target_days ? s.valNegative : s.valPositive}`}>
                  {fmtDays(t.coverageDays)}
                </span>
                <span className={s.velocityLabel}>
                  <Tooltip text="تعداد روزهایی که با سرعت فروشِ فعلی، موجودیِ فعلی دلار دوام می‌آورد." iconSize={11}>{FA.covLabel}</Tooltip>
                </span>
              </div>
              {t.forecast.depletionDate && (
                <div className={s.velocityItem}>
                  <span className={`${s.velocityValue} ${s.valNegative}`}>{t.forecast.depletionDate}</span>
                  <span className={s.velocityLabel}>
                    <Tooltip text="تخمینِ تاریخِ صفر شدنِ کاملِ انبار دلار (محاسبه شده بر اساس سرعت فروش خالص)." iconSize={11}>{FA.depletionLabel}</Tooltip>
                  </span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className={s.forecastUnavailable}>{FA.forecastNA}</div>
        )}
      </div>
    </section>
  );
}