import React from "react";
import {
  BookOpen, TrendingUp, TrendingDown,
  Wallet, BarChart2, Coins, Activity, Scale, DollarSign, CreditCard,
} from "lucide-react";
import { getLedgerData } from "@/app/actions/admin.actions";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { EditableLedgerTable, type LedgerRow } from "@/components/admin/EditableLedgerTable";
import shellStyles from "@/styles/admin/AdminShell.module.css";
import cardStyles from "@/styles/admin/AdminCards.module.css";

export const metadata = { title: "Ledger | Zarman Admin" };

const PAGE_SIZE = 20;

// ── Persian strings as unicode escapes ────────────────────────────────────
const FA = {
  cardRateTitle:    "\u0646\u0631\u062e \u0641\u0639\u0644\u06cc",
  cardRateDesc:     "\u0646\u0631\u062e \u062e\u0631\u06cc\u062f \u0628\u0627\u0632\u0627\u0631 \u0627\u0645\u0631\u0648\u0632",
  cardAudBalTitle:  "\u0645\u0648\u062c\u0648\u062f\u06cc \u062f\u0644\u0627\u0631",
  cardAudBalDesc:   "\u062f\u0644\u0627\u0631 \u0646\u06af\u0647\u200c\u062f\u0627\u0631\u06cc\u200c\u0634\u062f\u0647 \u062a\u0648\u0633\u0637 \u0635\u0631\u0627\u0641\u06cc",
  cardAvgBuyTitle:  "\u0645\u06cc\u0627\u0646\u06af\u06cc\u0646 \u062e\u0631\u06cc\u062f \u062f\u0644\u0627\u0631",
  cardAvgBuyDesc:   "\u0645\u06cc\u0627\u0646\u06af\u06cc\u0646 \u0648\u0632\u0646\u06cc \u0647\u0632\u06cc\u0646\u0647 \u0647\u0631 \u062f\u0644\u0627\u0631",
  cardFeesTitle:    "\u06a9\u0627\u0631\u0645\u0632\u062f",
  cardFeesDesc:     "\u0645\u062c\u0645\u0648\u0639 \u06a9\u0627\u0631\u0645\u0632\u062f \u062f\u0631\u06cc\u0627\u0641\u062a\u06cc",
  cardTrdTitle:     "\u0633\u0648\u062f \u062d\u0627\u0635\u0644 \u062e\u0631\u06cc\u062f \u0648 \u0641\u0631\u0648\u0634",
  cardTrdDesc:      "\u0633\u0648\u062f \u0628\u0633\u062a\u0647\u200c\u0634\u062f\u0647 \u0627\u0632 \u0633\u06cc\u06a9\u0644 \u0645\u0639\u0627\u0645\u0644\u0627\u062a",
  cardBookTitle:    "\u0633\u0648\u062f \u06cc\u0627 \u0632\u06cc\u0627\u0646 \u062f\u0641\u062a\u0631\u06cc",
  cardBookDesc:     "\u0633\u0648\u062f \u0646\u0642\u062f\u0646\u0634\u062f\u0647 \u0645\u0648\u062c\u0648\u062f\u06cc \u0646\u0633\u0628\u062a \u0628\u0647 \u0646\u0631\u062e \u0641\u0639\u0644\u06cc",
  cardNetTomTitle:  "\u0633\u0648\u062f \u062e\u0627\u0644\u0635 \u0635\u0631\u0627\u0641\u06cc",
  cardNetTomDesc:   "\u0633\u0648\u062f \u06a9\u0644\u06cc \u0628\u0647 \u062a\u0648\u0645\u0627\u0646",
  cardNetAudTitle:  "\u0633\u0648\u062f \u062e\u0627\u0644\u0635 \u0628\u0647 \u062f\u0644\u0627\u0631",
  cardNetAudDesc:   "\u0633\u0648\u062f \u06a9\u0644\u06cc \u0628\u0647 \u0627\u0631\u0632\u0634 \u062f\u0644\u0627\u0631\u06cc",
  cardKadoosTitle:  "\u067e\u0631\u062f\u0627\u062e\u062a \u0634\u062f\u0647 \u06a9\u0627\u062f\u0648\u0633",
  cardKadoosDesc:   "\u0645\u062c\u0645\u0648\u0639 \u067e\u0631\u062f\u0627\u062e\u062a\u06cc \u06a9\u0627\u062f\u0648\u0633 \u0628\u0631\u0627\u06cc \u062e\u0631\u06cc\u062f\u0647\u0627",
  cardZarmanTitle:  "\u067e\u0631\u062f\u0627\u062e\u062a \u0634\u062f\u0647 \u0632\u0631\u0645\u0627\u0646",
  cardZarmanDesc:   "\u0645\u062c\u0645\u0648\u0639 \u067e\u0631\u062f\u0627\u062e\u062a\u06cc \u0632\u0631\u0645\u0627\u0646 \u0628\u0631\u0627\u06cc \u0641\u0631\u0648\u0634\u200c\u0647\u0627",
  pageDesc:         "\u062f\u0641\u062a\u0631 \u0645\u0639\u0627\u0645\u0644\u0627\u062a \u2014 \u0633\u0648\u062f \u0648 \u0632\u06cc\u0627\u0646 \u0628\u0631 \u0627\u0633\u0627\u0633 \u062a\u0645\u0627\u0645 \u062a\u0631\u0627\u06a9\u0646\u0634\u200c\u0647\u0627\u06cc \u062a\u0623\u06cc\u06cc\u062f \u0634\u062f\u0647",
  tableTitle:       "\u0633\u0648\u0627\u0628\u0642 \u062f\u0641\u062a\u0631",
  noRows:           "\u0647\u06cc\u0686 \u0633\u0637\u0631\u06cc \u062f\u0631 \u062f\u0641\u062a\u0631 \u062b\u0628\u062a \u0646\u0634\u062f\u0647 \u0627\u0633\u062a.",
  totalSuffix:      "\u0633\u0637\u0631",
};

// ── P&L metrics (from ledger table directly — no joins needed) ────────────
// buy_aud = کادوس pays Toman, Zarman receives AUD
// sell_aud = Zarman pays AUD, كادوس receives Toman
function calcMetrics(
  rows: { type: string; amount_aud: number | string; amount_toman: number | string; fee_aud: number | string }[],
  currentBuyRate: number,
) {
  const buyRows  = rows.filter(r => r.type === "buy_aud");
  const sellRows = rows.filter(r => r.type === "sell_aud");

  const sumBuyAud    = buyRows.reduce((s, r)  => s + Number(r.amount_aud),   0);
  const sumSellAud   = sellRows.reduce((s, r) => s + Number(r.amount_aud),   0);
  const sumBuyToman  = buyRows.reduce((s, r)  => s + Number(r.amount_toman), 0);
  const sumSellToman = sellRows.reduce((s, r) => s + Number(r.amount_toman), 0);

  // Fee in Toman — each row stores fee in AUD; convert using that row's implied rate
  const totalFeesToman = rows.reduce((s, r) => {
    const aud = Number(r.amount_aud), tom = Number(r.amount_toman), fee = Number(r.fee_aud);
    const rowRate = aud > 0 ? tom / aud : 0;
    return s + fee * rowRate;
  }, 0);

  const audBalance     = sumBuyAud - sumSellAud;
  const averageBuyRate = sumBuyAud > 0 ? sumBuyToman / sumBuyAud : 0;
  const tradingProfit  = sumSellToman - sumSellAud * averageBuyRate;
  const bookPL         = (currentBuyRate - averageBuyRate) * audBalance;
  const netToman       = tradingProfit + totalFeesToman + bookPL;
  const netAud         = currentBuyRate > 0 ? netToman / currentBuyRate : 0;

  return {
    audBalance, averageBuyRate, tradingProfit, totalFeesToman, bookPL, netToman, netAud,
    kadoosToman: sumBuyToman, kadoosAud: sumBuyAud,
    zarmanToman: sumSellToman, zarmanAud: sumSellAud,
  };
}

function fmtIRT(v: number)  { return Math.round(v).toLocaleString("en-AU"); }
function fmtAUD(v: number)  { return v.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtRate(v: number) { return Math.round(v).toLocaleString("en-AU"); }
function valColor(v: number) { return v > 0 ? "#059669" : v < 0 ? "#ef4444" : "var(--text-main)"; }
function iconBg(v: number, def = "rgba(100,116,139,0.1)") {
  return v > 0 ? "rgba(5,150,105,0.1)" : v < 0 ? "rgba(239,68,68,0.1)" : def;
}

// ── MetricCard ─────────────────────────────────────────────────────────────
function MetricCard({ icon, titleFa, descFa, value, sub, valueColor = "var(--text-main)", bg = "rgba(100,116,139,0.1)" }: {
  icon: React.ReactNode; titleFa: string; descFa: string;
  value: string; sub?: string; valueColor?: string; bg?: string;
}) {
  return (
    <div className={cardStyles.statCardCompact}>
      <div className={cardStyles.statIconCompact} style={{ background: bg, color: valueColor }}>{icon}</div>
      <div className={cardStyles.statInfo}>
        <div style={{ fontFamily: "var(--font-fa-content)", direction: "rtl", textAlign: "right" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-main)", display: "block" }}>{titleFa}</span>
          <span style={{ fontSize: "0.67rem", color: "var(--text-soft)", display: "block", marginTop: 1 }}>{descFa}</span>
        </div>
        <span style={{ fontSize: "1.05rem", fontWeight: 700, color: valueColor, letterSpacing: "-0.01em", display: "block", marginTop: 5 }}>{value}</span>
        {sub && <span style={{ fontSize: "0.72rem", color: "var(--text-dim)", display: "block", marginTop: 1 }}>{sub}</span>}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default async function LedgerPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const { allLedgerRows, pageLedgerRows, total, currentBuyRate } =
    await getLedgerData(currentPage, PAGE_SIZE);

  const m = calcMetrics(allLedgerRows, currentBuyRate);

  return (
    <>
      <div className={shellStyles.topBar}>
        <span className={shellStyles.pageTitle}>Ledger</span>
        <span style={{ fontSize: "0.78rem", color: "var(--text-soft)", fontWeight: 500, fontFamily: "var(--font-fa-content)" }}>
          {total} {FA.totalSuffix}
        </span>
      </div>

      <div className={shellStyles.pageContent}>
        <div className={`${cardStyles.sectionHeader} ${cardStyles.sectionHeaderLg}`}>
          <div>
            <h1 className={`${cardStyles.sectionTitle} ${cardStyles.sectionTitleWithIcon}`}>
              <span className={cardStyles.sectionTitleIconAccent}><BookOpen size={24} strokeWidth={2.5} /></span>
              Ledger
            </h1>
            <p className={cardStyles.sectionDesc} style={{ fontFamily: "var(--font-fa-content)", direction: "rtl", textAlign: "right" }}>
              {FA.pageDesc}
            </p>
          </div>
        </div>

        {/* Row 1 */}
        <div className={cardStyles.statsGrid} style={{ marginBottom: "1rem" }}>
          <MetricCard icon={<TrendingUp size={20} />}
            titleFa={FA.cardRateTitle} descFa={FA.cardRateDesc}
            value={currentBuyRate > 0 ? fmtRate(currentBuyRate) : "\u2014"}
            valueColor="var(--accent)" bg="rgba(37,99,235,0.1)" />
          <MetricCard icon={<Wallet size={20} />}
            titleFa={FA.cardAudBalTitle} descFa={FA.cardAudBalDesc}
            value={fmtAUD(m.audBalance)} valueColor={valColor(m.audBalance)} bg={iconBg(m.audBalance)} />
          <MetricCard icon={<BarChart2 size={20} />}
            titleFa={FA.cardAvgBuyTitle} descFa={FA.cardAvgBuyDesc}
            value={m.averageBuyRate > 0 ? fmtRate(m.averageBuyRate) : "\u2014"} />
          <MetricCard icon={<Coins size={20} />}
            titleFa={FA.cardFeesTitle} descFa={FA.cardFeesDesc}
            value={`${fmtIRT(m.totalFeesToman)} IRT`}
            valueColor="#059669" bg="rgba(5,150,105,0.1)" />
        </div>

        {/* Row 2 */}
        <div className={cardStyles.statsGrid} style={{ marginBottom: "1rem" }}>
          <MetricCard icon={<Activity size={20} />}
            titleFa={FA.cardTrdTitle} descFa={FA.cardTrdDesc}
            value={`${fmtIRT(m.tradingProfit)} IRT`}
            valueColor={valColor(m.tradingProfit)} bg={iconBg(m.tradingProfit)} />
          <MetricCard icon={<Scale size={20} />}
            titleFa={FA.cardBookTitle} descFa={FA.cardBookDesc}
            value={`${fmtIRT(m.bookPL)} IRT`}
            valueColor={valColor(m.bookPL)} bg={iconBg(m.bookPL)} />
          <MetricCard icon={m.netToman >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            titleFa={FA.cardNetTomTitle} descFa={FA.cardNetTomDesc}
            value={`${fmtIRT(m.netToman)} IRT`}
            valueColor={valColor(m.netToman)} bg={iconBg(m.netToman)} />
          <MetricCard icon={<DollarSign size={20} />}
            titleFa={FA.cardNetAudTitle} descFa={FA.cardNetAudDesc}
            value={`${fmtAUD(m.netAud)} AUD`}
            valueColor={valColor(m.netAud)} bg={iconBg(m.netAud)} />
        </div>

        {/* Row 3 */}
        <div className={cardStyles.statsGrid} style={{ marginBottom: "2rem" }}>
          <MetricCard icon={<CreditCard size={20} />}
            titleFa={FA.cardKadoosTitle} descFa={FA.cardKadoosDesc}
            value={`${fmtIRT(m.kadoosToman)} IRT`} sub={`${fmtAUD(m.kadoosAud)} AUD`}
            valueColor="var(--accent)" bg="rgba(37,99,235,0.1)" />
          <MetricCard icon={<CreditCard size={20} />}
            titleFa={FA.cardZarmanTitle} descFa={FA.cardZarmanDesc}
            value={`${fmtIRT(m.zarmanToman)} IRT`} sub={`${fmtAUD(m.zarmanAud)} AUD`}
            valueColor="#7c3aed" bg="rgba(124,58,237,0.1)" />
        </div>

        {/* Ledger table */}
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
              <EditableLedgerTable rows={pageLedgerRows as LedgerRow[]} />
              <AdminPagination currentPage={currentPage} totalCount={total} pageSize={PAGE_SIZE} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
