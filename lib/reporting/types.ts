export type ReportPreset = "this-month" | "last-month" | "quarter" | "year" | "custom";

export type ReportPeriod = {
  preset: ReportPreset;
  start: string;
  end: string;
  previousStart: string;
  previousEnd: string;
  label: string;
};

export type ReportDailyRow = {
  period_start: string;
  revenue: number;
  expenses: number;
  fee_income: number;
  trading_profit: number;
  other_income: number;
  cash_in: number;
  cash_out: number;
  aud_inventory: number;
  opening_aud_inventory: number;
  aud_purchased: number;
  aud_sold: number;
  irt_liquidity: number;
  wac: number;
  average_rate: number;
  average_buy_rate: number;
  average_sell_rate: number;
  highest_rate: number;
  lowest_rate: number;
  transaction_count: number;
  buy_count: number;
  sell_count: number;
  buy_volume: number;
  sell_volume: number;
  average_fee: number;
  largest_transaction: number;
  smallest_transaction: number;
  new_customers: number;
  returning_customers: number;
  owner_injection: number;
  owner_loan_repayment: number;
  refunds: number;
  transfers_in: number;
  transfers_out: number;
  expense_breakdown: Record<string, number> | null;
  updated_at: string;
};

export type ReportKpi = {
  key: string;
  label: string;
  value: number;
  previousValue: number;
  changePercent: number | null;
  format: "irt" | "aud" | "rate" | "number" | "percent";
  positiveIsGood: boolean;
  drilldownHref: string;
};

export type ReportDashboard = {
  period: ReportPeriod;
  freshness: string | null;
  kpis: ReportKpi[];
  profitAndLoss: {
    revenue: number;
    tradingProfit: number;
    feeIncome: number;
    otherIncome: number;
    totalIncome: number;
    expenseBreakdown: Record<string, number>;
    totalExpenses: number;
    operatingProfit: number;
    fxGainLoss: number;
    netProfit: number;
  };
  cashFlow: {
    customerPaymentsIn: number;
    ownerInjection: number;
    refunds: number;
    transfersIn: number;
    customerPaymentsOut: number;
    expenses: number;
    ownerLoanRepayment: number;
    transfersOut: number;
    moneyIn: number;
    moneyOut: number;
    netCashFlow: number;
  };
  inventory: {
    opening: number;
    purchased: number;
    sold: number;
    closing: number;
    growth: number;
    turnover: number;
    daysOfInventory: number | null;
    averageCost: number;
  };
  transactions: {
    count: number;
    buyCount: number;
    sellCount: number;
    averageSize: number;
    largest: number;
    smallest: number;
    averageFee: number;
  };
  rates: {
    averageBuy: number;
    averageSell: number;
    spread: number;
    highest: number;
    lowest: number;
  };
  customers: { newCustomers: number; returningCustomers: number; retention: number };
  series: Array<{
    date: string;
    revenue: number;
    expenses: number;
    tradingProfit: number;
    feeIncome: number;
    netProfit: number;
    transactionCount: number;
    averageRate: number;
    audBought: number;
    audSold: number;
    cashFlow: number;
    wac: number;
  }>;
};

export type ReportAccountSummary = {
  id: string;
  name: string;
  currency: "AUD" | "IRT";
  openingBalance: number;
  deposits: number;
  withdrawals: number;
  transfers: number;
  closingBalance: number;
  netMovement: number;
};

export type ReportCustomerSummary = {
  id: string;
  name: string;
  customerCode: string | null;
  transactionCount: number;
  audVolume: number;
  averageTransaction: number;
};

export type EnterpriseReportData = {
  dashboard: ReportDashboard;
  accounts: ReportAccountSummary[];
  topCustomers: ReportCustomerSummary[];
  refresh: {
    isStale: boolean;
    staleSince: string | null;
    lastCompletedAt: string | null;
    lastError: string | null;
  };
};