export const TREASURY_VIEWS = {
  overview: { group: "overview", label: "Summary", title: "Treasury overview", description: "Your balances, priorities, and everyday treasury tasks in one place." },
  alerts: { group: "overview", label: "Alerts", title: "Alerts & data quality", description: "Review treasury risks and accounting warnings before taking action." },
  accounts: { group: "accounts", label: "Liquidity", title: "Liquidity", description: "Monitor available cash, owner liabilities, and expense coverage." },
  reconciliation: { group: "accounts", label: "Balances", title: "Account balances", description: "Compare bank, customer, and transit balances with the central inventory." },
  "bank-accounts": { group: "accounts", label: "Manage accounts", title: "Manage accounts", description: "Create and maintain the accounts used by treasury operations." },
  expenses: { group: "expenses", label: "All expenses", title: "Expenses", description: "Record operating costs and review existing expense entries." },
  recurring: { group: "expenses", label: "Recurring", title: "Recurring expenses", description: "Manage scheduled costs and post payments when they become due." },
  "bank-fees": { group: "expenses", label: "Bank fees", title: "Bank transfer fees", description: "Review monthly transfer fees and record the actual charges." },
  capital: { group: "capital", label: "Owner capital", title: "Capital & owner loans", description: "Track owner funding, repayments, and the net value of the business." },
  strategy: { group: "insights", label: "Strategy", title: "Treasury strategy", description: "Review the health score, recommendations, and pricing guidance." },
  inventory: { group: "insights", label: "Inventory", title: "Market & inventory", description: "Understand AUD holdings, target levels, and inventory forecasts." },
  exposure: { group: "insights", label: "Exposure", title: "Currency exposure", description: "Review your currency allocation against the configured risk thresholds." },
  profitability: { group: "insights", label: "Profitability", title: "Profitability", description: "Separate operating results, inventory gains, and currency translation." },
  settings: { group: "settings", label: "Settings", title: "Treasury settings", description: "Set the targets and thresholds used by treasury monitoring." },
} as const;

export type TreasuryView = keyof typeof TREASURY_VIEWS;

export const TREASURY_GROUPS = [
  { id: "overview", label: "Overview", view: "overview" },
  { id: "accounts", label: "Accounts", view: "accounts" },
  { id: "expenses", label: "Expenses", view: "expenses" },
  { id: "capital", label: "Capital", view: "capital" },
  { id: "insights", label: "Insights", view: "strategy" },
  { id: "settings", label: "Settings", view: "settings" },
] as const;

export function resolveTreasuryView(value: string | string[] | undefined): TreasuryView {
  return typeof value === "string" && Object.hasOwn(TREASURY_VIEWS, value)
    ? value as TreasuryView
    : "overview";
}

export function treasuryViewHref(view: TreasuryView): string {
  return `/admin/treasury?view=${view}`;
}
