import { TrendingUp, BarChart2, Wallet } from "lucide-react";
import { fmtAUD, type AccountingSnapshot } from "@/lib/accounting-engine";
import { FA } from "@/lib/treasury-utils";
import Tooltip from "@/components/ui/Tooltip/Tooltip";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import s from "@/styles/admin/Treasury.module.css";

export type BusinessValueSnapshot = Pick<AccountingSnapshot,
  "currentBuyRate" | "netAssetsAUD" | "netProfitAUD" | "retainedProfitAUD" | "incomeBeforeExpensesAUD" | "totalExpensesAUD">;

export default function BusinessValueCards({ accounting: a }: { accounting: BusinessValueSnapshot }) {
  const hasConversionRate = Number.isFinite(a.currentBuyRate) && a.currentBuyRate > 0;
  const netAssetsAUD = hasConversionRate && a.netAssetsAUD != null && Number.isFinite(a.netAssetsAUD) ? a.netAssetsAUD : null;
  const netProfitAUD = hasConversionRate && a.netProfitAUD != null && Number.isFinite(a.netProfitAUD) ? a.netProfitAUD : null;
  const retainedProfitAUD = hasConversionRate && a.retainedProfitAUD != null && Number.isFinite(a.retainedProfitAUD) ? a.retainedProfitAUD : null;
  const incomeBeforeExpensesAUD = hasConversionRate && a.incomeBeforeExpensesAUD != null && Number.isFinite(a.incomeBeforeExpensesAUD) ? a.incomeBeforeExpensesAUD : null;
  const totalExpensesAUD = hasConversionRate && a.totalExpensesAUD != null && Number.isFinite(a.totalExpensesAUD) ? a.totalExpensesAUD : null;

  return <div dir="rtl" lang="fa">
    <div className={`${cardStyles.statsGrid} ${s.statsGridBottomMd}`}>
        <div className={cardStyles.statCardCompact}>
          <div className={`${cardStyles.statIconCompact} ${incomeBeforeExpensesAUD === null ? cardStyles.statIconWarning : incomeBeforeExpensesAUD >= 0 ? cardStyles.statIconSuccess : cardStyles.statIconDanger}`}>
            <TrendingUp size={20} />
          </div>
          <div className={cardStyles.statInfo}>
            <span dir="ltr" className={`${cardStyles.statValue} ${incomeBeforeExpensesAUD === null ? s.valNeutral : incomeBeforeExpensesAUD >= 0 ? s.valPositive : s.valNegative}`}>
              {incomeBeforeExpensesAUD === null ? "—" : `${fmtAUD(incomeBeforeExpensesAUD)} AUD`}
            </span>
            <span className={cardStyles.statLabel}>
              <Tooltip text={FA.hintIncomeBeforeExpensesAUD}>{FA.incomeBeforeExpensesAUD}</Tooltip>
            </span>
            <span className={cardStyles.statLabel}>
              {FA.totalExpensesAUD}: <span dir="ltr">{totalExpensesAUD === null ? "—" : `${fmtAUD(totalExpensesAUD)} AUD`}</span>
            </span>
          </div>
        </div>
        <div className={cardStyles.statCardCompact}>
          <div className={`${cardStyles.statIconCompact} ${netAssetsAUD === null ? cardStyles.statIconWarning : netAssetsAUD >= 0 ? cardStyles.statIconSuccess : cardStyles.statIconDanger}`}>
            <Wallet size={20} />
          </div>
          <div className={cardStyles.statInfo}>
            <span dir="ltr" className={`${cardStyles.statValue} ${netAssetsAUD === null ? s.valNeutral : netAssetsAUD >= 0 ? s.valPositive : s.valNegative}`}>
              {netAssetsAUD === null ? "—" : `${fmtAUD(netAssetsAUD)} AUD`}
            </span>
            <span className={cardStyles.statLabel}>
              <Tooltip text={FA.hintNetAssetsAUD}>{FA.netAssetsAUD}</Tooltip>
            </span>
          </div>
        </div>
        <div className={`${cardStyles.statCardCompact} ${s.statCardStrongBorder}`}>
          <div className={`${cardStyles.statIconCompact} ${netProfitAUD === null ? cardStyles.statIconWarning : netProfitAUD >= 0 ? cardStyles.statIconSuccess : cardStyles.statIconDanger}`}>
            <BarChart2 size={20} />
          </div>
          <div className={cardStyles.statInfo}>
            <span dir="ltr" className={`${cardStyles.statValue} ${netProfitAUD === null ? s.valNeutral : netProfitAUD >= 0 ? s.valPositive : s.valNegative}`}>
              {netProfitAUD === null ? "—" : `${fmtAUD(netProfitAUD)} AUD`}
            </span>
            <span className={cardStyles.statLabel}>
              <Tooltip text={FA.hintNetProfitAUD}>{FA.netProfitAUD}</Tooltip>
            </span>
            <span className={cardStyles.statLabel}>
              {FA.retainedProfitAUD}: <span dir="ltr">{retainedProfitAUD === null ? "—" : `${fmtAUD(retainedProfitAUD)} AUD`}</span>
            </span>
          </div>
        </div>
      </div>
  </div>;
}
