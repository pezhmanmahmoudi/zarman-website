"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/app/actions/admin.actions";
import { resolveReportPeriod } from "@/lib/reporting/date-range";
import { buildReportDashboard } from "@/lib/reporting/report-engine";
import type {
  EnterpriseReportData,
  ReportAccountSummary,
  ReportCustomerSummary,
  ReportDailyRow,
} from "@/lib/reporting/types";

const REPORT_COLUMNS = [
  "period_start", "revenue", "expenses", "fee_income", "trading_profit", "other_income",
  "cash_in", "cash_out", "aud_inventory", "opening_aud_inventory", "aud_purchased", "aud_sold",
  "irt_liquidity", "wac", "average_rate", "average_buy_rate", "average_sell_rate", "highest_rate",
  "lowest_rate", "transaction_count", "buy_count", "sell_count", "buy_volume", "sell_volume",
  "average_fee", "largest_transaction", "smallest_transaction", "new_customers", "returning_customers",
  "owner_injection", "owner_loan_repayment", "refunds", "transfers_in", "transfers_out",
  "expense_breakdown", "updated_at",
].join(",");

function makeServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDailyRow(raw: Record<string, unknown>): ReportDailyRow {
  const numericKeys = [
    "revenue", "expenses", "fee_income", "trading_profit", "other_income", "cash_in", "cash_out",
    "aud_inventory", "opening_aud_inventory", "aud_purchased", "aud_sold", "irt_liquidity", "wac",
    "average_rate", "average_buy_rate", "average_sell_rate", "highest_rate", "lowest_rate",
    "transaction_count", "buy_count", "sell_count", "buy_volume", "sell_volume", "average_fee",
    "largest_transaction", "smallest_transaction", "new_customers", "returning_customers",
    "owner_injection", "owner_loan_repayment", "refunds", "transfers_in", "transfers_out",
  ] as const;
  const normalized: Record<string, unknown> = { ...raw };
  for (const key of numericKeys) normalized[key] = numberValue(raw[key]);
  normalized.expense_breakdown = raw.expense_breakdown && typeof raw.expense_breakdown === "object"
    ? raw.expense_breakdown
    : {};
  return normalized as ReportDailyRow;
}

async function loadAccountSummaries(
  db: ReturnType<typeof makeServiceRoleClient>,
  start: string,
  end: string,
): Promise<ReportAccountSummary[]> {
  const [accountsResult, movementsResult] = await Promise.all([
    db.from("bank_accounts").select("id, account_name, currency").eq("is_active", true).order("account_name"),
    db.from("report_account_daily").select("account_id, period_start, opening_balance, deposits, withdrawals, transfers_in, transfers_out, closing_balance, net_movement")
      .gte("period_start", start).lte("period_start", end).order("period_start"),
  ]);
  if (accountsResult.error) throw new Error(accountsResult.error.message);
  if (movementsResult.error) throw new Error(movementsResult.error.message);

  return (accountsResult.data ?? []).map((account) => {
    const rows = (movementsResult.data ?? []).filter((row) => row.account_id === account.id);
    const first = rows[0];
    const last = rows.at(-1);
    return {
      id: String(account.id),
      name: String(account.account_name),
      currency: account.currency === "AUD" ? "AUD" : "IRT",
      openingBalance: numberValue(first?.opening_balance),
      deposits: rows.reduce((total, row) => total + numberValue(row.deposits), 0),
      withdrawals: rows.reduce((total, row) => total + numberValue(row.withdrawals), 0),
      transfers: rows.reduce((total, row) => total + numberValue(row.transfers_in) - numberValue(row.transfers_out), 0),
      closingBalance: numberValue(last?.closing_balance),
      netMovement: rows.reduce((total, row) => total + numberValue(row.net_movement), 0),
    };
  });
}

async function loadTopCustomers(
  db: ReturnType<typeof makeServiceRoleClient>,
  start: string,
  end: string,
): Promise<ReportCustomerSummary[]> {
  const { data, error } = await db.rpc("get_top_report_customers", {
    range_start: start,
    range_end: end,
    result_limit: 10,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const volume = numberValue(row.aud_volume);
    const count = numberValue(row.transaction_count);
    return {
      id: String(row.customer_id),
      name: String(row.customer_name || "Unknown customer"),
      customerCode: row.customer_code ? String(row.customer_code) : null,
      transactionCount: count,
      audVolume: volume,
      averageTransaction: count > 0 ? volume / count : 0,
    };
  });
}

export async function getEnterpriseReportData(input: {
  preset?: string;
  start?: string;
  end?: string;
}): Promise<EnterpriseReportData> {
  await requireAdmin();
  const period = resolveReportPeriod(input.preset, input.start, input.end);
  const db = makeServiceRoleClient();
  const currentQuery = db.from("reports_daily").select(REPORT_COLUMNS)
    .gte("period_start", period.start).lte("period_start", period.end).order("period_start");
  const previousQuery = db.from("reports_daily").select(REPORT_COLUMNS)
    .gte("period_start", period.previousStart).lte("period_start", period.previousEnd).order("period_start");

  const [currentResult, previousResult, accounts, topCustomers, refreshResult] = await Promise.all([
    currentQuery,
    previousQuery,
    loadAccountSummaries(db, period.start, period.end),
    loadTopCustomers(db, period.start, period.end),
    db.from("report_refresh_state").select("is_stale, stale_since, last_completed_at, last_error").eq("id", true).maybeSingle(),
  ]);
  if (currentResult.error) throw new Error(currentResult.error.message);
  if (previousResult.error) throw new Error(previousResult.error.message);
  if (refreshResult.error) throw new Error(refreshResult.error.message);

  const dashboard = buildReportDashboard(
    period,
    (currentResult.data ?? []).map((row) => normalizeDailyRow(row as unknown as Record<string, unknown>)),
    (previousResult.data ?? []).map((row) => normalizeDailyRow(row as unknown as Record<string, unknown>)),
  );
  const refresh = refreshResult.data;
  return {
    dashboard,
    accounts,
    topCustomers,
    refresh: {
      isStale: Boolean(refresh?.is_stale),
      staleSince: refresh?.stale_since ?? null,
      lastCompletedAt: refresh?.last_completed_at ?? null,
      lastError: refresh?.last_error ?? null,
    },
  };
}

export async function refreshEnterpriseReports(): Promise<{ success: true } | { error: string }> {
  const admin = await requireAdmin();
  const db = makeServiceRoleClient();
  const { error } = await db.rpc("refresh_enterprise_reports");
  if (error) return { error: error.message };
  await db.from("audit_logs").insert({
    actor_id: admin.id,
    actor_email: admin.email ?? "",
    action: "ENTERPRISE_REPORTS_REFRESHED",
    target_type: "reporting",
    new_value: { completed_at: new Date().toISOString() },
  });
  revalidatePath("/admin/reports");
  return { success: true };
}

export async function getReportAccountStatement(input: {
  accountId?: string;
  start?: string;
  end?: string;
  page?: number;
}) {
  await requireAdmin();
  const db = makeServiceRoleClient();
  const period = resolveReportPeriod("custom", input.start, input.end);
  const page = Math.min(Math.max(Math.trunc(input.page ?? 1), 1), 10_000);
  const { data: accounts, error: accountError } = await db
    .from("bank_accounts")
    .select("id, account_name, currency")
    .eq("is_active", true)
    .order("account_name");
  if (accountError) throw new Error(accountError.message);
  const accountId = input.accountId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.accountId)
    ? input.accountId
    : accounts?.[0]?.id;
  if (!accountId) return { period, accounts: [], selectedAccount: null, rows: [], total: 0, page };

  const { data, error } = await db.rpc("get_report_account_statement", {
    selected_account: accountId,
    range_start: period.start,
    range_end: period.end,
    page_number: page,
    page_size: 50,
  });
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ledgerId: String(row.ledger_id),
    transactionId: row.transaction_id ? String(row.transaction_id) : null,
    date: String(row.entry_date),
    description: String(row.description),
    debit: numberValue(row.debit),
    credit: numberValue(row.credit),
    balance: numberValue(row.running_balance),
  }));
  return {
    period,
    accounts: (accounts ?? []).map((account) => ({ id: String(account.id), name: String(account.account_name), currency: String(account.currency) })),
    selectedAccount: accountId,
    rows,
    total: numberValue((data as Array<Record<string, unknown>> | null)?.[0]?.total_count),
    page,
  };
}