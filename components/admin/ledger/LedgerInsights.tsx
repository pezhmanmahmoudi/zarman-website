import { createClient } from "@supabase/supabase-js";
import { getTreasuryFullData } from "@/app/actions/treasury.actions";
import type { AdminLedgerFilters } from "@/app/actions/admin.actions";
import LedgerBusinessSnapshot from "./LedgerBusinessSnapshot";
import LedgerCharts from "./LazyLedgerCharts";
import styles from "@/styles/admin/LedgerWorkspace.module.css";

const fmtAUD = (value: number) => value.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Only rendered by the Insights view; record browsing does not load this data. */
export default async function LedgerInsights({ filters }: { filters: AdminLedgerFilters }) {
  const { accounting, treasury } = await getTreasuryFullData();
  const { start: startDate, end: endDate, type: filterType, search: filterSearch, account: filterAccount } = filters;
  // 2. Fetch Full History for Exact WAC Calculation
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: allHistory, error: historyError } = await db
    .from("ledger")
    .select("id, type, entry_type, amount_aud, amount_toman, fee_aud, date_gregorian, sender, recipient, created_at, payer_account_id, receiver_account_id")
    .order("date_gregorian", { ascending: true })
    .order("created_at", { ascending: true });

  if (historyError) throw new Error("Ledger insights could not be loaded.");

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


  return <div className={styles.insights}>
    <p className={styles.insightNote}>Period metrics follow your filters. Business balances reflect the current treasury.</p>
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

        <LedgerCharts dailyData={chartDataArray} typeDistribution={pieDistribution} />


    <div className={styles.periodTotals}>
      <div><span>Trading volume · selected period</span><strong>{fmtAUD(totalPeriodAud)} AUD</strong></div>
      <div><span>Fees · selected period</span><strong>{fmtAUD(periodFeesAud)} AUD</strong></div>
      <div><span>Trades · selected period</span><strong>{count.toLocaleString("en-AU")}</strong></div>
    </div>
  </div>;
}
