import { createClient } from "@supabase/supabase-js";
import { getTreasuryFullData } from "@/app/actions/treasury.actions";
import type { AdminLedgerFilters } from "@/app/actions/admin.actions";
import LedgerBusinessSnapshot from "./LedgerBusinessSnapshot";
import LedgerCharts from "./LazyLedgerCharts";
import BusinessValueCards from "@/components/admin/treasury/BusinessValueCards";
import { readAllFinancialRows } from "@/lib/financial-reads";
import { calcFeeIncomeToman, calcPrincipalToman } from "@/lib/pricing";
import styles from "@/styles/admin/LedgerWorkspace.module.css";

const fmtAUD = (value: number) => value.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type InventoryFact = {
  id: string;
  ledger_id: string | null;
  day: string;
  seq: number;
  quantity: number;
  trading: boolean;
  inventory_before: number;
  inventory: number;
  realized_profit: number;
};

/** Only rendered by the Insights view; record browsing does not load this data. */
export default async function LedgerInsights({ filters }: { filters: AdminLedgerFilters }) {
  const { accounting, treasury } = await getTreasuryFullData();
  const { start: startDate, end: endDate, type: filterType, search: filterSearch, account: filterAccount } = filters;
  // Read the same chronological inventory facts used by enterprise reports.
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const [historyResult, factsResult] = await Promise.all([
    readAllFinancialRows((from, to) => db
    .from("ledger")
    .select("id, type, entry_type, amount_aud, amount_toman, exchange_rate, fee_aud, date_gregorian, sender, recipient, created_at, payer_account_id, receiver_account_id")
    .order("date_gregorian", { ascending: true })
    .order("created_at", { ascending: true }).order("id").range(from, to)),
    readAllFinancialRows<InventoryFact>(async (from, to) => {
      const { data, error } = await db.rpc("get_accounting_inventory_facts")
        .select("id:event_id,ledger_id,day,seq,quantity,trading,inventory_before,inventory,realized_profit")
        .order("seq").range(from, to);
      return { data: Array.isArray(data) ? data : null, error };
    }),
  ]);

  if (historyResult.error || factsResult.error) throw new Error("Ledger insights could not be loaded.");
  const allHistory = historyResult.data ?? [];
  const facts = factsResult.data ?? [];
  const stockFacts = new Map(facts.filter(f => f.trading && f.ledger_id).map(f => [String(f.ledger_id), f]));
  const selectedLedgerIds = new Set<string>();

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
  const factsInPeriod = facts.filter(f => (!startDate || f.day >= startDate) && (!endDate || f.day <= endDate));
  const closingFact = facts.filter(f => !endDate || f.day <= endDate).at(-1);
  const periodClosingInventory = Number(closingFact?.inventory ?? 0);
  const openingInventory = Number(factsInPeriod[0]?.inventory_before ?? periodClosingInventory);

  const chartGroup: Record<string, { date: string, volume: number }> = {};

  allHistory.forEach(row => {
    const aud = Number(row.amount_aud || 0);
    const irt = Number(row.amount_toman || 0);
    const feeAud = Number(row.fee_aud || 0);
    const stock = stockFacts.get(String(row.id));
    const type = stock ? Number(stock.quantity) > 0 ? "buy_aud" : "sell_aud" : row.type;
    const et = row.entry_type || "trade";
    const dateStr = row.date_gregorian;
    const isTrade = et === "trade";
    const isValidTrade = isTrade && Boolean(stock) && aud > 0 && irt > 0;
    const isTransfer = et === "transfer";
    const dateInPeriod = (!startDate || dateStr >= startDate) && (!endDate || dateStr <= endDate);

    // B. Period Aggregations
    const typeMatch = !filterType ||
      (filterType === "transfer" ? isTransfer : filterType === et || (isTrade && type === filterType));
    const accountMatch = !filterAccount || row.payer_account_id === filterAccount || row.receiver_account_id === filterAccount;
    const normalizedSearch = filterSearch?.toLocaleLowerCase();
    const searchMatch = !normalizedSearch ||
      (row.sender || "").toLocaleLowerCase().includes(normalizedSearch) ||
      (row.recipient || "").toLocaleLowerCase().includes(normalizedSearch);

    if (dateInPeriod && typeMatch && searchMatch && accountMatch) {
      selectedLedgerIds.add(String(row.id));
      const explicitRate = Number(row.exchange_rate ?? 0);
      const rowRate = explicitRate > 0 ? explicitRate : aud > 0 ? irt / aud : 0;
      const principal = isValidTrade ? calcPrincipalToman(irt, rowRate, feeAud, type as "buy_aud" | "sell_aud") : 0;
      if (isValidTrade) {
        count += 1;
        periodFeesAud += feeAud;
        periodFeesIrt += calcFeeIncomeToman(feeAud, rowRate);
      }

      if (isValidTrade && type === "buy_aud") {
        periodBuyAud += aud;
        periodBuyIrt += principal;
      } else if (isValidTrade && type === "sell_aud") {
        periodSellAud += aud;
        periodSellIrt += principal;
      } else if (isTransfer) {
        periodTransferAud += aud;
      }

      if (isValidTrade || isTransfer) {
        if (!chartGroup[dateStr]) chartGroup[dateStr] = { date: dateStr, volume: 0 };
        chartGroup[dateStr].volume += aud;
      }
    }
  });
  const hasRecordFilter = Boolean(filterType || filterSearch || filterAccount);
  periodTradingProfit = factsInPeriod.filter(f => !hasRecordFilter || selectedLedgerIds.has(String(f.ledger_id)))
    .reduce((sum, f) => sum + Number(f.realized_profit), 0);

  // Calculate isolated and accurate averages
  const periodAvgBuy = periodBuyAud > 0 ? periodBuyIrt / periodBuyAud : 0;
  const periodAvgSell = periodSellAud > 0 ? periodSellIrt / periodSellAud : 0;
  const totalPeriodAud = periodBuyAud + periodSellAud;
  const otherInventoryMovement = periodClosingInventory - openingInventory - periodBuyAud + periodSellAud;

  const chartDataArray = Object.values(chartGroup).sort((a, b) => a.date.localeCompare(b.date));
  const pieDistribution = [
    { name: "خرید", value: periodBuyAud },
    { name: "فروش", value: periodSellAud },
    { name: "انتقال", value: periodTransferAud },
  ].filter(item => item.value > 0);


  return <div className={styles.insights}>
    <BusinessValueCards accounting={accounting} />
    <p className={styles.insightNote}>سود دوره طبق فیلترهاست؛ مانده‌ها برای کل صرافی‌اند.</p>
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
          otherInventoryMovement={otherInventoryMovement}
        />

        <LedgerCharts dailyData={chartDataArray} typeDistribution={pieDistribution} />


    <div className={styles.periodTotals}>
      <div><span>Trading volume · selected period</span><strong>{fmtAUD(totalPeriodAud)} AUD</strong></div>
      <div><span>Fees · selected period</span><strong>{fmtAUD(periodFeesAud)} AUD</strong></div>
      <div><span>Trades · selected period</span><strong>{count.toLocaleString("en-AU")}</strong></div>
    </div>
  </div>;
}
