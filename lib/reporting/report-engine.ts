import type { ReportDashboard, ReportDailyRow, ReportKpi, ReportPeriod } from "./types";

const sum = (rows: ReportDailyRow[], key: keyof ReportDailyRow): number =>
  rows.reduce((total, row) => total + (typeof row[key] === "number" ? row[key] : 0), 0);

function weightedAverage(rows: ReportDailyRow[], valueKey: keyof ReportDailyRow): number {
  const volume = sum(rows, "buy_volume") + sum(rows, "sell_volume");
  if (volume <= 0) return 0;
  return rows.reduce((total, row) => {
    const rowVolume = row.buy_volume + row.sell_volume;
    return total + Number(row[valueKey] || 0) * rowVolume;
  }, 0) / volume;
}

function changePercent(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function mergeBreakdowns(rows: ReportDailyRow[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const row of rows) {
    for (const [category, amount] of Object.entries(row.expense_breakdown ?? {})) {
      result[category] = (result[category] ?? 0) + Number(amount || 0);
    }
  }
  return result;
}

function latest(rows: ReportDailyRow[], key: keyof ReportDailyRow): number {
  return rows.length === 0 ? 0 : Number(rows[rows.length - 1][key] || 0);
}

export function buildReportDashboard(
  period: ReportPeriod,
  currentRows: ReportDailyRow[],
  previousRows: ReportDailyRow[],
): ReportDashboard {
  const current = [...currentRows].sort((a, b) => a.period_start.localeCompare(b.period_start));
  const previous = [...previousRows].sort((a, b) => a.period_start.localeCompare(b.period_start));
  const expenses = sum(current, "expenses");
  const revenue = sum(current, "revenue");
  const tradingProfit = sum(current, "trading_profit");
  const feeIncome = sum(current, "fee_income");
  const otherIncome = sum(current, "other_income");
  const totalIncome = tradingProfit + feeIncome + otherIncome;
  const netProfit = totalIncome - expenses;
  const transactionCount = sum(current, "transaction_count");
  const totalVolume = sum(current, "buy_volume") + sum(current, "sell_volume");
  const openingInventory = current[0]?.opening_aud_inventory ?? 0;
  const closingInventory = latest(current, "aud_inventory");
  const days = Math.max(current.length, 1);
  const averageInventory = (openingInventory + closingInventory) / 2;

  const metric = (
    key: string,
    label: string,
    value: number,
    previousValue: number,
    format: ReportKpi["format"],
    positiveIsGood = true,
    ledgerType?: string,
  ): ReportKpi => ({
    key,
    label,
    value,
    previousValue,
    changePercent: changePercent(value, previousValue),
    format,
    positiveIsGood,
    drilldownHref: `/admin/ledger?start=${period.start}&end=${period.end}${ledgerType ? `&type=${ledgerType}` : ""}`,
  });

  const previousProfit = sum(previous, "trading_profit") + sum(previous, "fee_income") +
    sum(previous, "other_income") - sum(previous, "expenses");
  const cashIn = sum(current, "cash_in");
  const cashOut = sum(current, "cash_out");
  const previousCount = sum(previous, "transaction_count");
  const newCustomers = sum(current, "new_customers");
  const returningCustomers = sum(current, "returning_customers");

  return {
    period,
    freshness: current.at(-1)?.updated_at ?? null,
    kpis: [
      metric("revenue", "Revenue", revenue, sum(previous, "revenue"), "irt"),
      metric("trading-profit", "Trading Profit", tradingProfit, sum(previous, "trading_profit"), "irt"),
      metric("fee-income", "Fee Income", feeIncome, sum(previous, "fee_income"), "irt"),
      metric("expenses", "Expenses", expenses, sum(previous, "expenses"), "irt", false),
      metric("net-profit", "Net Profit", netProfit, previousProfit, "irt"),
      metric("cash-flow", "Cash Flow", cashIn - cashOut, sum(previous, "cash_in") - sum(previous, "cash_out"), "irt"),
      metric("aud-inventory", "AUD Inventory", closingInventory, latest(previous, "aud_inventory"), "aud"),
      metric("irt-liquidity", "IRT Liquidity", latest(current, "irt_liquidity"), latest(previous, "irt_liquidity"), "irt"),
      metric("wac", "Current WAC", latest(current, "wac"), latest(previous, "wac"), "rate", false),
      metric("average-rate", "Average Exchange Rate", weightedAverage(current, "average_rate"), weightedAverage(previous, "average_rate"), "rate"),
      metric("transactions", "Transactions", transactionCount, previousCount, "number"),
      metric("average-size", "Average Transaction", transactionCount ? totalVolume / transactionCount : 0, previousCount ? (sum(previous, "buy_volume") + sum(previous, "sell_volume")) / previousCount : 0, "aud"),
      metric("largest", "Largest Transaction", Math.max(0, ...current.map((row) => row.largest_transaction)), Math.max(0, ...previous.map((row) => row.largest_transaction)), "aud"),
      metric("new-customers", "New Customers", newCustomers, sum(previous, "new_customers"), "number"),
      metric("returning-customers", "Returning Customers", returningCustomers, sum(previous, "returning_customers"), "number"),
      metric("inventory-change", "Inventory Change", closingInventory - openingInventory, latest(previous, "aud_inventory") - (previous[0]?.opening_aud_inventory ?? 0), "aud"),
    ],
    profitAndLoss: {
      revenue,
      tradingProfit,
      feeIncome,
      otherIncome,
      totalIncome,
      expenseBreakdown: mergeBreakdowns(current),
      totalExpenses: expenses,
      operatingProfit: netProfit,
      fxGainLoss: 0,
      netProfit,
    },
    cashFlow: {
      customerPaymentsIn: Math.max(0, cashIn - sum(current, "owner_injection") - sum(current, "refunds") - sum(current, "transfers_in")),
      ownerInjection: sum(current, "owner_injection"),
      refunds: sum(current, "refunds"),
      transfersIn: sum(current, "transfers_in"),
      customerPaymentsOut: Math.max(0, cashOut - expenses - sum(current, "owner_loan_repayment") - sum(current, "transfers_out")),
      expenses,
      ownerLoanRepayment: sum(current, "owner_loan_repayment"),
      transfersOut: sum(current, "transfers_out"),
      moneyIn: cashIn,
      moneyOut: cashOut,
      netCashFlow: cashIn - cashOut,
    },
    inventory: {
      opening: openingInventory,
      purchased: sum(current, "aud_purchased"),
      sold: sum(current, "aud_sold"),
      closing: closingInventory,
      growth: openingInventory ? ((closingInventory - openingInventory) / Math.abs(openingInventory)) * 100 : 0,
      turnover: averageInventory > 0 ? sum(current, "aud_sold") / averageInventory : 0,
      daysOfInventory: sum(current, "aud_sold") > 0 ? closingInventory / (sum(current, "aud_sold") / days) : null,
      averageCost: latest(current, "wac"),
    },
    transactions: {
      count: transactionCount,
      buyCount: sum(current, "buy_count"),
      sellCount: sum(current, "sell_count"),
      averageSize: transactionCount ? totalVolume / transactionCount : 0,
      largest: Math.max(0, ...current.map((row) => row.largest_transaction)),
      smallest: current.filter((row) => row.smallest_transaction > 0).reduce((value, row) => Math.min(value, row.smallest_transaction), Number.POSITIVE_INFINITY) || 0,
      averageFee: transactionCount ? sum(current, "average_fee") / days : 0,
    },
    rates: {
      averageBuy: weightedAverage(current, "average_buy_rate"),
      averageSell: weightedAverage(current, "average_sell_rate"),
      spread: weightedAverage(current, "average_sell_rate") - weightedAverage(current, "average_buy_rate"),
      highest: Math.max(0, ...current.map((row) => row.highest_rate)),
      lowest: current.filter((row) => row.lowest_rate > 0).reduce((value, row) => Math.min(value, row.lowest_rate), Number.POSITIVE_INFINITY) || 0,
    },
    customers: {
      newCustomers,
      returningCustomers,
      retention: newCustomers + returningCustomers > 0 ? (returningCustomers / (newCustomers + returningCustomers)) * 100 : 0,
    },
    series: current.map((row) => ({
      date: row.period_start,
      revenue: row.revenue,
      expenses: row.expenses,
      tradingProfit: row.trading_profit,
      feeIncome: row.fee_income,
      netProfit: row.trading_profit + row.fee_income + row.other_income - row.expenses,
      transactionCount: row.transaction_count,
      averageRate: row.average_rate,
      audBought: row.aud_purchased,
      audSold: row.aud_sold,
      cashFlow: row.cash_in - row.cash_out,
      wac: row.wac,
    })),
  };
}