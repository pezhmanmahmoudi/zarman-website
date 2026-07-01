import React from "react";
import {
  BookOpen, TrendingUp, TrendingDown,
  Wallet, BarChart2, Coins, Activity, Scale, DollarSign, Briefcase, Landmark
} from "lucide-react";
import { getLedgerData } from "@/app/actions/admin.actions";
import { getTreasuryFullData } from "@/app/actions/treasury.actions";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { EditableLedgerTable, type LedgerRow } from "@/components/admin/EditableLedgerTable";
import shellStyles from "@/styles/admin/AdminShell.module.css";
import cardStyles from "@/styles/admin/AdminCards.module.css";

export const metadata = { title: "Ledger | Zarman Admin" };

const PAGE_SIZE = 20;

// ── Persian strings ────────────────────────────────────────────────────────
const FA = {
  cardRateTitle:    "نرخ مرجع سیستم",
  cardRateDesc:     "آخرین نرخ خرید ثبت شده",
  cardAudBalTitle:  "کل انبار دلار (AUD)",
  cardAudBalDesc:   "مجموع ذخیره ارزی صرافی",
  cardIrtBalTitle:  "کل نقدینگی ایران (IRT)",
  cardIrtBalDesc:   "مجموع موجودی تمام بانک‌های ریالی",
  cardWacTitle:     "میانگین خرید (WAC)",
  cardWacDesc:      "ارزش دفتریِ تأمینِ هر دلار",
  cardFeesTitle:    "درآمد کارمزدها",
  cardFeesDesc:     "کارمزد خالص معاملات",
  cardTrdTitle:     "سود معاملات",
  cardTrdDesc:      "سود محقق‌شده از چرخه خرید و فروش",
  cardFxTitle:      "سود/زیان تسعیر",
  cardFxDesc:       "ناشی از نوسان نرخ روی تعهدات",
  cardNetTomTitle:  "سود عملیاتی خالص",
  cardNetTomDesc:   "معاملات + کارمزد - هزینه‌ها",
  cardNetBVTitle:   "ارزش صافی کسب‌وکار",
  cardNetBVDesc:    "کل دارایی‌ها منهای تعهدات و وام مالک",
  pageDesc:         "دفتر کل یکپارچه — ثبت و ردیابی جریان‌های نقدی (مسیر داخلی + هویت مشتری)",
  tableTitle:       "سوابق دفتر کل",
  noRows:           "هیچ سطری در دفتر ثبت نشده است.",
  totalSuffix:      "سطر",
};

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtIRT(v: number)  { return Math.round(v).toLocaleString("en-AU"); }
function fmtAUD(v: number)  { return v.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtRate(v: number) { return Math.round(v).toLocaleString("en-AU"); }
function valColor(v: number) { return v > 0 ? "#059669" : v < 0 ? "#ef4444" : "var(--text-main)"; }
function iconBg(v: number, def = "rgba(100,116,139,0.1)") {
  return v > 0 ? "rgba(5,150,105,0.1)" : v < 0 ? "rgba(239,68,68,0.1)" : def;
}

// ── MetricCard ─────────────────────────────────────────────────────────────
function MetricCard({ icon, titleFa, descFa, value, valueColor = "var(--text-main)", bg = "rgba(100,116,139,0.1)", compact = false }: {
  icon: React.ReactNode; titleFa: string; descFa: string;
  value: string; valueColor?: string; bg?: string; compact?: boolean;
}) {
  return (
    <div className={cardStyles.statCardCompact} style={{ padding: compact ? '1rem' : '1.25rem 1.5rem' }}>
      <div className={cardStyles.statIconCompact} style={{ background: bg, color: valueColor, width: compact ? 40 : 48, height: compact ? 40 : 48 }}>{icon}</div>
      <div className={cardStyles.statInfo}>
        <div style={{ fontFamily: "var(--font-fa-content)", direction: "rtl", textAlign: "right" }}>
          <span style={{ fontSize: compact ? "0.8rem" : "0.85rem", fontWeight: 700, color: "var(--text-main)", display: "block" }}>{titleFa}</span>
          {!compact && <span style={{ fontSize: "0.67rem", color: "var(--text-soft)", display: "block", marginTop: 1 }}>{descFa}</span>}
        </div>
        <span style={{ fontSize: compact ? "1rem" : "1.1rem", fontWeight: 700, color: valueColor, letterSpacing: "-0.01em", display: "block", marginTop: 4, direction: "ltr" }}>{value}</span>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default async function LedgerPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  // فراخوانی داده‌های لجر برای جدول
  const { pageLedgerRows, total } = await getLedgerData(currentPage, PAGE_SIZE);
  
  // فراخوانی موتور خزانه‌داری
  const { accounting, bankAccounts } = await getTreasuryFullData();
  const a = accounting;

  return (
    <>
      <div className={shellStyles.topBar}>
        <span className={shellStyles.pageTitle}>Master Ledger</span>
        <span style={{ fontSize: "0.78rem", color: "var(--text-soft)", fontWeight: 500, fontFamily: "var(--font-fa-content)" }}>
          {total} {FA.totalSuffix}
        </span>
      </div>

      <div className={shellStyles.pageContent}>
        <div className={`${cardStyles.sectionHeader} ${cardStyles.sectionHeaderLg}`}>
          <div>
            <h1 className={`${cardStyles.sectionTitle} ${cardStyles.sectionTitleWithIcon}`}>
              <span className={cardStyles.sectionTitleIconAccent}><BookOpen size={24} strokeWidth={2.5} /></span>
              دفتر کل حسابداری
            </h1>
            <p className={cardStyles.sectionDesc} style={{ fontFamily: "var(--font-fa-content)", direction: "rtl", textAlign: "right" }}>
              {FA.pageDesc}
            </p>
          </div>
        </div>

        {/* ── Row 1: Macro Liquidity & Inventory ── */}
        <div className={cardStyles.statsGrid} style={{ marginBottom: "1rem" }}>
          <MetricCard icon={<Wallet size={20} />}
            titleFa={FA.cardAudBalTitle} descFa={FA.cardAudBalDesc}
            value={`${fmtAUD(a.audInventory)} AUD`} valueColor={valColor(a.audInventory)} bg={iconBg(a.audInventory)} />
            
          <MetricCard icon={<Landmark size={20} />}
            titleFa={FA.cardIrtBalTitle} descFa={FA.cardIrtBalDesc}
            value={`${fmtIRT(a.totalIranLiquidityIRT)} IRT`} valueColor={valColor(a.totalIranLiquidityIRT)} bg={iconBg(a.totalIranLiquidityIRT)} />
            
          <MetricCard icon={<Activity size={20} />}
            titleFa={FA.cardRateTitle} descFa={FA.cardRateDesc}
            value={a.currentBuyRate > 0 ? fmtRate(a.currentBuyRate) : "\u2014"}
            valueColor="var(--accent)" bg="rgba(67,56,202,0.1)" />
            
          <MetricCard icon={<BarChart2 size={20} />}
            titleFa={FA.cardWacTitle} descFa={FA.cardWacDesc}
            value={a.wac > 0 ? `${fmtRate(a.wac)} IRT` : "\u2014"} />
        </div>

        {/* ── Row 2: Profitability & P&L ── */}
        <div className={cardStyles.statsGrid} style={{ marginBottom: "2rem", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          <MetricCard compact icon={<TrendingUp size={18} />}
            titleFa={FA.cardTrdTitle} descFa={FA.cardTrdDesc}
            value={`${fmtIRT(a.realizedTradingProfit)} IRT`}
            valueColor={valColor(a.realizedTradingProfit)} bg={iconBg(a.realizedTradingProfit)} />
            
          <MetricCard compact icon={<Coins size={18} />}
            titleFa={FA.cardFeesTitle} descFa={FA.cardFeesDesc}
            value={`${fmtIRT(a.feeIncomeIRT)} IRT`}
            valueColor="#059669" bg="rgba(5,150,105,0.1)" />

          <MetricCard compact icon={<Scale size={18} />}
            titleFa={FA.cardFxTitle} descFa={FA.cardFxDesc}
            value={`${fmtIRT(a.fxTranslationGainLossIRT)} IRT`}
            valueColor={valColor(a.fxTranslationGainLossIRT)} bg={iconBg(a.fxTranslationGainLossIRT)} />
            
          <MetricCard compact icon={a.operatingProfit >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            titleFa={FA.cardNetTomTitle} descFa={FA.cardNetTomDesc}
            value={`${fmtIRT(a.operatingProfit)} IRT`}
            valueColor={valColor(a.operatingProfit)} bg={iconBg(a.operatingProfit)} />
            
          <MetricCard compact icon={<Briefcase size={18} />}
            titleFa={FA.cardNetBVTitle} descFa={FA.cardNetBVDesc}
            value={`${fmtIRT(a.netBusinessValueIRT)} IRT`}
            valueColor={valColor(a.netBusinessValueIRT)} bg={iconBg(a.netBusinessValueIRT)} />
        </div>

        {/* ── Ledger Table ── */}
        <div className={cardStyles.panel}>
          <div className={cardStyles.panelHeader} style={{ direction: "rtl", justifyContent: "flex-start" }}>
            <h2 className={cardStyles.panelTitle}>
              <BookOpen size={18} color="var(--text-dim)" />
              <span style={{ fontFamily: "var(--font-fa-content)" }}>{FA.tableTitle}</span>
              <span style={{ color: "var(--text-dim)", fontWeight: 400, fontSize: "0.85rem" }}>
                &nbsp;({total} total)
              </span>
            </h2>
          </div>

          {total === 0 ? (
            <div className={`${cardStyles.emptyState} ${cardStyles.emptyStateLoose}`}>
              <div className={cardStyles.emptyStateIcon}><BookOpen size={24} /></div>
              <div className={cardStyles.emptyStateText} style={{ fontFamily: "var(--font-fa-content)" }}>
                {FA.noRows}
              </div>
            </div>
          ) : (
            <>
              {/* ارسال کشوها به جدول برای فرم ویرایش */}
              <EditableLedgerTable rows={pageLedgerRows as LedgerRow[]} bankAccounts={bankAccounts || []} />
              <AdminPagination currentPage={currentPage} totalCount={total} pageSize={PAGE_SIZE} />
            </>
          )}
        </div>
      </div>
    </>
  );
}