import React, { Suspense } from "react";
import { createClient } from "@supabase/supabase-js";
import { getLedgerData } from "@/app/actions/admin.actions";
import { getTreasuryFullData } from "@/app/actions/treasury.actions";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { EditableLedgerTable, type LedgerRow } from "@/components/admin/EditableLedgerTable";

// Components
import LedgerToolbar from "@/components/admin/ledger/LedgerToolbar";
import LedgerCharts from "@/components/admin/ledger/LedgerCharts";
import LedgerDrillDown from "@/components/admin/ledger/LedgerDrillDown";
import LedgerBusinessSnapshot from "@/components/admin/ledger/LedgerBusinessSnapshot";

import shellStyles from "@/styles/admin/AdminShell.module.css";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import { BookOpen } from "lucide-react";

export const metadata = { title: "Enterprise Ledger | Zarman Admin" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const fmtIRT = (v: number) => Math.round(v).toLocaleString("en-AU");
const fmtAUD = (v: number) => v.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function LedgerPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const filterType = params.type;
  const filterSearch = params.search;
  const filterAccount = params.account;

  // Date Filtering Configuration
  const now = new Date();
  let startDate = params.start;
  let endDate = params.end;

  if (params.range === "this-month") {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    startDate = `${y}-${m}-01`;
    endDate = `${y}-${m}-${lastDay}`;
  } else if (params.range === "today") {
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - (offset * 60 * 1000));
    startDate = local.toISOString().split("T")[0];
    endDate = startDate;
  } else if (params.range === "last-month") {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const y = prev.getFullYear();
    const m = String(prev.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, prev.getMonth() + 1, 0).getDate();
    startDate = `${y}-${m}-01`;
    endDate = `${y}-${m}-${lastDay}`;
  } else if (params.range === "this-year") {
    const y = now.getFullYear();
    startDate = `${y}-01-01`;
    endDate = `${y}-12-31`;
  } else if (params.range === "custom" && params.start && params.end) {
    startDate = params.start;
    endDate = params.end;
  }

  // 1. Fetch Standard Baseline
  const { pageLedgerRows, total, allLedgerRows } = await getLedgerData(currentPage, PAGE_SIZE, {
    start: startDate,
    end: endDate,
    type: filterType,
    search: filterSearch,
    account: filterAccount,
  });
  const { accounting, treasury, bankAccounts } = await getTreasuryFullData();

  // 2. Fetch Full History for Exact WAC Calculation
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: allHistory } = await db
    .from("ledger")
    .select("id, type, entry_type, amount_aud, amount_toman, fee_aud, date_gregorian, sender, recipient, created_at, payer_account_id, receiver_account_id")
    .order("date_gregorian", { ascending: true })
    .order("created_at", { ascending: true });

  // 3. Mini-Engine: Calculate Exact WAC & Segregated Averages
  let rollingWac = 0;
  let rollingInventoryAUD = 0;

  let count = 0;
  let periodFeesAud = 0;
  let periodFeesIrt = 0;
  let periodTradingProfit = 0;

  // Separation of volumes to prevent diluted averages
  let periodBuyAud = 0;
  let periodBuyIrt = 0;
  let periodSellAud = 0;
  let periodSellIrt = 0;
  let periodTransferAud = 0;
  let periodOpeningInventory: number | null = null;
  let periodClosingInventory = 0;

  const chartGroup: Record<string, { date: string, volume: number }> = {};

  (allHistory || []).forEach(row => {
    const aud = Number(row.amount_aud || 0);
    const irt = Number(row.amount_toman || 0);
    const feeAud = Number(row.fee_aud || 0);
    const type = row.type;
    const et = row.entry_type || "trade";
    const dateStr = row.date_gregorian;
    const isTrade = et === "trade";
    const isValidTrade = isTrade && aud > 0 && irt > 0;
    const isTransfer = et === "transfer";
    const dateInPeriod = (!startDate || dateStr >= startDate) && (!endDate || dateStr <= endDate);

    if ((!startDate || dateStr >= startDate) && periodOpeningInventory === null) {
      periodOpeningInventory = rollingInventoryAUD;
    }

    let rowRealizedProfit = 0;

    // A. Update Perpetual WAC
    if (isValidTrade) {
      if (type === "buy_aud" && aud > 0) {
        const buyRate = irt / aud;
        rollingWac = rollingInventoryAUD > 0
          ? (rollingInventoryAUD * rollingWac + aud * buyRate) / (rollingInventoryAUD + aud)
          : buyRate;
        rollingInventoryAUD += aud;
      } else if (type === "sell_aud" && aud > 0) {
        rowRealizedProfit = irt - (aud * rollingWac);
        rollingInventoryAUD -= aud;
      }
    }
    if (!endDate || dateStr <= endDate) periodClosingInventory = rollingInventoryAUD;

    // B. Period Aggregations
    const typeMatch = !filterType ||
      (filterType === "transfer" ? isTransfer : filterType === et || (isTrade && type === filterType));
    const accountMatch = !filterAccount || row.payer_account_id === filterAccount || row.receiver_account_id === filterAccount;
    const normalizedSearch = filterSearch?.toLocaleLowerCase();
    const searchMatch = !normalizedSearch ||
      (row.sender || "").toLocaleLowerCase().includes(normalizedSearch) ||
      (row.recipient || "").toLocaleLowerCase().includes(normalizedSearch);

    if (dateInPeriod && typeMatch && searchMatch && accountMatch) {
      if (isValidTrade) {
        count += 1;
        periodFeesAud += feeAud;
        periodTradingProfit += rowRealizedProfit;
        const rowRate = aud > 0 ? irt / aud : rollingWac;
        periodFeesIrt += feeAud * rowRate;
      }

      if (isValidTrade && type === "buy_aud") {
        periodBuyAud += aud;
        periodBuyIrt += irt;
      } else if (isValidTrade && type === "sell_aud") {
        periodSellAud += aud;
        periodSellIrt += irt;
      } else if (isTransfer) {
        periodTransferAud += aud;
      }

      if (isValidTrade || isTransfer) {
        if (!chartGroup[dateStr]) chartGroup[dateStr] = { date: dateStr, volume: 0 };
        chartGroup[dateStr].volume += aud;
      }
    }
  });

  // Calculate isolated and accurate averages
  const periodAvgBuy = periodBuyAud > 0 ? periodBuyIrt / periodBuyAud : 0;
  const periodAvgSell = periodSellAud > 0 ? periodSellIrt / periodSellAud : 0;
  const totalPeriodAud = periodBuyAud + periodSellAud;
  const openingInventory = periodOpeningInventory ?? periodClosingInventory;

  const chartDataArray = Object.values(chartGroup).sort((a, b) => a.date.localeCompare(b.date));
  const pieDistribution = [
    { name: "خرید", value: periodBuyAud },
    { name: "فروش", value: periodSellAud },
    { name: "انتقال", value: periodTransferAud },
  ].filter(item => item.value > 0);

  // O(1) Lookup Map for Drill Down Drawer
  const rowDataMap = (pageLedgerRows as LedgerRow[]).reduce<Record<string, LedgerRow>>((acc, row) => {
    acc[row.id] = row;
    return acc;
  }, {});

  return (
    <>
      <div className={shellStyles.topBar}>
        <span className={shellStyles.pageTitle} style={{ fontFamily: "var(--font-fa-content)" }}>دفتر کل مالی</span>
      </div>

      <div className={shellStyles.pageContent}>

        {/* Filters */}
        <LedgerToolbar currentParams={params} bankAccounts={bankAccounts || []} exportRows={allLedgerRows as LedgerRow[]} />

        <LedgerBusinessSnapshot
          operatingProfit={accounting.operatingProfit}
          periodTradingProfit={periodTradingProfit}
          periodFeeIncome={periodFeesIrt}
          audInventory={accounting.audInventory}
          irtLiquidity={treasury.totalIranLiquidityIRT}
          netBusinessValue={accounting.netBusinessValueIRT}
          tradeCount={count}
          tradeVolume={totalPeriodAud}
          averageBuyRate={periodAvgBuy}
          averageSellRate={periodAvgSell}
          wac={accounting.wac}
          openingInventory={openingInventory}
          audPurchased={periodBuyAud}
          audSold={periodSellAud}
          closingInventory={periodClosingInventory}
        />

        <Suspense fallback={<div className={cardStyles.panel} style={{ height: 300 }} />}>
          <LedgerCharts dailyData={chartDataArray} typeDistribution={pieDistribution} />
        </Suspense>

        {/* Grid and Table wrapped in DrillDown Event Delegator */}
        <div className={cardStyles.panel} style={{ display: "flex", flexDirection: "column", height: "800px" }}>

          <div className={cardStyles.panelHeader} style={{ flexShrink: 0, zIndex: 10 }}>
            <h2 className={cardStyles.panelTitle}>
              <BookOpen size={18} color="var(--text-dim)" />
              <span style={{ fontFamily: "var(--font-fa-content)" }}>سوابق دفتر کل (Bilateral Flow)</span>
              <span style={{ color: "var(--text-dim)", fontWeight: 400, fontSize: "0.85rem" }}>
                &nbsp;({total} total records)
              </span>
            </h2>
          </div>

          <LedgerDrillDown ledgerDataMap={rowDataMap}>
            <div style={{ flex: 1, overflowY: "auto", overflowX: "auto", minHeight: 0 }}>
              <EditableLedgerTable rows={pageLedgerRows as LedgerRow[]} bankAccounts={bankAccounts || []} />
            </div>
          </LedgerDrillDown>

          {/* Aggregated Footer */}
          <div style={{
            flexShrink: 0, padding: "1rem 1.5rem", background: "var(--bg-soft)",
            borderTop: "1px solid var(--border-soft)", display: "flex",
            justifyContent: "space-between", alignItems: "center",
            fontWeight: 600, fontSize: "0.875rem", direction: "ltr"
          }}>
            <span>Total AUD: {fmtAUD(totalPeriodAud)}</span>
            <span>Avg Buy: {fmtIRT(periodAvgBuy)} | Avg Sell: {fmtIRT(periodAvgSell)}</span>
            <span>Total Fees: {fmtAUD(periodFeesAud)}</span>
          </div>

          <div style={{ flexShrink: 0, padding: "0.5rem" }}>
            <AdminPagination currentPage={currentPage} totalCount={total} pageSize={PAGE_SIZE} />
          </div>

        </div>
      </div>
    </>
  );
}
