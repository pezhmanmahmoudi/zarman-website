"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/app/actions/admin.actions";
import {
  calcAccountingSnapshot,
  type LedgerRowInput,
  type ExpenseRowInput,
  type OwnerLoanRowInput,
} from "@/lib/accounting-engine";
import {
  calcTreasurySnapshot,
  type TreasurySettingsInput,
  type AccountBalancesInput,
} from "@/lib/treasury-engine";
import {
  generateStrategyOutput,
  type StrategyOutput,
} from "@/lib/strategy-engine";
import type { AccountingSnapshot } from "@/lib/accounting-engine";
import type { TreasurySnapshot } from "@/lib/treasury-engine";

// ── Private helpers ────────────────────────────────────────────────────────

function makeServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function writeAuditLog(args: {
  actorId: string;
  actorEmail: string;
  action: string;
  targetType?: string;
  targetId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
}) {
  const db = makeServiceRoleClient();
  await db.from("audit_logs").insert([{
    actor_id:    args.actorId,
    actor_email: args.actorEmail,
    action:      args.action,
    target_type: args.targetType ?? null,
    target_id:   args.targetId ? String(args.targetId) : null,
    old_value:   args.oldValue ?? null,
    new_value:   args.newValue ?? null,
  }]);
}

// ── Default settings (used when treasury_settings table is empty) ──────────

const DEFAULT_SETTINGS: TreasurySettingsInput = {
  min_aud_inventory:              5_000,
  target_aud_inventory:          30_000,
  max_aud_inventory:            150_000,
  min_irt_liquidity:         4_000_000_000,
  max_aud_exposure:               0.80,
  target_exposure_ratio:          0.50,
  inventory_coverage_target_days: 14,
  cash_runway_target_months:       3,
  recommendation_sensitivity:    "medium",
};

// ── Public raw types (for display in UI tables) ────────────────────────────

export type OwnerLoanRow = {
  id: string;
  date: string;
  currency: "AUD" | "IRT";
  amount: number;
  exchange_rate: number | null;
  account: string;
  loan_type: "injection" | "repayment";
  repayment_status: "open" | "partially_repaid" | "repaid";
  notes: string | null;
  created_at: string;
};

export type ExpenseRow = {
  id: string;
  date: string;
  title: string;
  category: string;
  currency: "AUD" | "IRT";
  amount: number;
  exchange_rate: number | null;
  payer_account: string;
  status: "paid" | "pending";
  notes: string | null;
  created_at: string;
};

export type TreasurySettingsRow = TreasurySettingsInput & {
  kadoos_balance_irt: number;
  pezhman_balance_irt: number;
  updated_at: string | null;
};

export type TreasuryPageData = {
  accounting: AccountingSnapshot;
  treasury: TreasurySnapshot;
  strategy: StrategyOutput;
  ownerLoans: OwnerLoanRow[];
  expenses: ExpenseRow[];
  settings: TreasurySettingsRow;
};

// ── Main data fetcher ──────────────────────────────────────────────────────

/**
 * getTreasuryFullData
 *
 * Fetches all treasury-related data, runs all three engines, and
 * returns a fully-computed TreasuryPageData object.
 *
 * Used exclusively by the /admin/treasury Server Component.
 * Never call from client components.
 */
export async function getTreasuryFullData(): Promise<TreasuryPageData> {
  const db = makeServiceRoleClient();

  // Parallel fetch: ledger rows, expenses, owner loans, settings, rate
  const [ledgerRes, expenseRes, loanRes, settingsRes, rateRes] = await Promise.all([
    db
      .from("ledger")
      .select(
        "id, type, entry_type, amount_aud, amount_toman, exchange_rate, fee_aud, date_gregorian, payer_account, receiver_account, created_at",
      )
      .order("date_gregorian", { ascending: true })
      .order("created_at",     { ascending: true }),

    db
      .from("expenses")
      .select("id, date, title, category, currency, amount, exchange_rate, payer_account, status, notes, created_at")
      .order("date", { ascending: false }),

    db
      .from("owner_loans")
      .select("id, date, currency, amount, exchange_rate, account, loan_type, repayment_status, notes, created_at")
      .order("date", { ascending: false }),

    db
      .from("treasury_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle(),

    db
      .from("rates_history")
      .select("buy_aud")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // ── Normalize ledger rows ────────────────────────────────────────────────
  const ledgerRows: LedgerRowInput[] = (ledgerRes.data ?? []).map(r => ({
    id:               String(r.id),
    type:             r.type as string,
    entry_type:       r.entry_type as string | null,
    amount_aud:       Number(r.amount_aud ?? 0),
    amount_toman:     Number(r.amount_toman ?? 0),
    exchange_rate:    Number(r.exchange_rate ?? 0),
    fee_aud:          Number(r.fee_aud ?? 0),
    date_gregorian:   r.date_gregorian as string,
    payer_account:    r.payer_account as string | null,
    receiver_account: r.receiver_account as string | null,
  }));

  // ── Normalize expense rows ───────────────────────────────────────────────
  const expensesRaw: ExpenseRow[] = (expenseRes.data ?? []).map(r => ({
    id:            String(r.id),
    date:          r.date as string,
    title:         r.title as string,
    category:      r.category as string,
    currency:      r.currency as "AUD" | "IRT",
    amount:        Number(r.amount),
    exchange_rate: r.exchange_rate != null ? Number(r.exchange_rate) : null,
    payer_account: r.payer_account as string,
    status:        r.status as "paid" | "pending",
    notes:         r.notes as string | null,
    created_at:    r.created_at as string,
  }));

  const expenseInputs: ExpenseRowInput[] = expensesRaw.map(r => ({
    id:            r.id,
    currency:      r.currency,
    amount:        r.amount,
    exchange_rate: r.exchange_rate,
    status:        r.status,
    date:          r.date,
    category:      r.category,
    payer_account: r.payer_account,
  }));

  // ── Normalize owner loan rows ────────────────────────────────────────────
  const loansRaw: OwnerLoanRow[] = (loanRes.data ?? []).map(r => ({
    id:               String(r.id),
    date:             r.date as string,
    currency:         r.currency as "AUD" | "IRT",
    amount:           Number(r.amount),
    exchange_rate:    r.exchange_rate != null ? Number(r.exchange_rate) : null,
    account:          r.account as string,
    loan_type:        r.loan_type as "injection" | "repayment",
    repayment_status: r.repayment_status as "open" | "partially_repaid" | "repaid",
    notes:            r.notes as string | null,
    created_at:       r.created_at as string,
  }));

  const loanInputs: OwnerLoanRowInput[] = loansRaw.map(r => ({
    id:            r.id,
    currency:      r.currency,
    amount:        r.amount,
    exchange_rate: r.exchange_rate,
    loan_type:     r.loan_type,
    account:       r.account,
    date:          r.date,
  }));

  // ── Settings ─────────────────────────────────────────────────────────────
  const raw = settingsRes.data;
  const settings: TreasurySettingsRow = {
    min_aud_inventory:              Number(raw?.min_aud_inventory              ?? DEFAULT_SETTINGS.min_aud_inventory),
    target_aud_inventory:           Number(raw?.target_aud_inventory           ?? DEFAULT_SETTINGS.target_aud_inventory),
    max_aud_inventory:              Number(raw?.max_aud_inventory              ?? DEFAULT_SETTINGS.max_aud_inventory),
    min_irt_liquidity:              Number(raw?.min_irt_liquidity              ?? DEFAULT_SETTINGS.min_irt_liquidity),
    max_aud_exposure:               Number(raw?.max_aud_exposure               ?? DEFAULT_SETTINGS.max_aud_exposure),
    target_exposure_ratio:          Number(raw?.target_exposure_ratio          ?? DEFAULT_SETTINGS.target_exposure_ratio),
    inventory_coverage_target_days: Number(raw?.inventory_coverage_target_days ?? DEFAULT_SETTINGS.inventory_coverage_target_days),
    cash_runway_target_months:      Number(raw?.cash_runway_target_months      ?? DEFAULT_SETTINGS.cash_runway_target_months),
    recommendation_sensitivity:     (raw?.recommendation_sensitivity as "low" | "medium" | "high") ?? DEFAULT_SETTINGS.recommendation_sensitivity,
    kadoos_balance_irt:             Number(raw?.kadoos_balance_irt  ?? 0),
    pezhman_balance_irt:            Number(raw?.pezhman_balance_irt ?? 0),
    updated_at:                     raw?.updated_at as string | null ?? null,
  };

  const currentBuyRate = Number(rateRes.data?.buy_aud ?? 0);

  const balances: AccountBalancesInput = {
    kadoosBalanceIRT:  settings.kadoos_balance_irt,
    pezhmanBalanceIRT: settings.pezhman_balance_irt,
  };

  const iranLiquidityIRT = balances.kadoosBalanceIRT + balances.pezhmanBalanceIRT;

  // ── Run engines ───────────────────────────────────────────────────────────
  const accounting = calcAccountingSnapshot(
    ledgerRows,
    expenseInputs,
    loanInputs,
    currentBuyRate,
    iranLiquidityIRT,
  );

  const treasury = calcTreasurySnapshot(
    accounting,
    ledgerRows,
    balances,
    settings,
  );

  const strategy = generateStrategyOutput(treasury, accounting);

  return {
    accounting,
    treasury,
    strategy,
    ownerLoans: loansRaw,
    expenses:   expensesRaw,
    settings,
  };
}

// ── Account balance update ─────────────────────────────────────────────────

export async function updateAccountBalances(
  kadoosBalanceIRT: number,
  pezhmanBalanceIRT: number,
): Promise<{ success: true } | { error: string }> {
  const admin = await requireAdmin();

  if (!Number.isFinite(kadoosBalanceIRT)  || kadoosBalanceIRT  < 0) return { error: "مبلغ کادوس نامعتبر است." };
  if (!Number.isFinite(pezhmanBalanceIRT) || pezhmanBalanceIRT < 0) return { error: "مبلغ پژمان نامعتبر است." };

  const db = makeServiceRoleClient();
  const { error } = await db
    .from("treasury_settings")
    .upsert([{ id: 1, kadoos_balance_irt: Math.round(kadoosBalanceIRT), pezhman_balance_irt: Math.round(pezhmanBalanceIRT) }], { onConflict: "id" });

  if (error) return { error: error.message };

  await writeAuditLog({
    actorId:    admin.id,
    actorEmail: admin.email ?? "",
    action:     "TREASURY_BALANCES_UPDATED",
    targetType: "treasury_settings",
    newValue:   { kadoos_balance_irt: Math.round(kadoosBalanceIRT), pezhman_balance_irt: Math.round(pezhmanBalanceIRT) },
  }).catch(() => {});

  revalidatePath("/admin/treasury");
  return { success: true };
}

// ── Treasury settings update ───────────────────────────────────────────────

export async function updateTreasurySettings(
  s: Omit<TreasurySettingsInput, "recommendation_sensitivity"> & { recommendation_sensitivity: string },
): Promise<{ success: true } | { error: string }> {
  const admin = await requireAdmin();

  const db = makeServiceRoleClient();
  const { error } = await db
    .from("treasury_settings")
    .upsert([{
      id: 1,
      min_aud_inventory:              Number(s.min_aud_inventory),
      target_aud_inventory:           Number(s.target_aud_inventory),
      max_aud_inventory:              Number(s.max_aud_inventory),
      min_irt_liquidity:              Number(s.min_irt_liquidity),
      max_aud_exposure:               Number(s.max_aud_exposure),
      inventory_coverage_target_days: Number(s.inventory_coverage_target_days),
      cash_runway_target_months:      Number(s.cash_runway_target_months),
      recommendation_sensitivity:     s.recommendation_sensitivity,
      updated_by:                     admin.id,
    }], { onConflict: "id" });

  if (error) return { error: error.message };

  await writeAuditLog({
    actorId:    admin.id,
    actorEmail: admin.email ?? "",
    action:     "TREASURY_SETTINGS_UPDATED",
    targetType: "treasury_settings",
    newValue:   s,
  }).catch(() => {});

  revalidatePath("/admin/treasury");
  return { success: true };
}

// ── Owner loans ────────────────────────────────────────────────────────────

export async function addOwnerLoan(payload: {
  date: string;
  currency: "AUD" | "IRT";
  amount: number;
  /** Historical IRT/AUD rate at time of loan. Required for AUD loans. */
  exchange_rate?: number | null;
  account: "zarman" | "kadoos" | "pezhman";
  loan_type: "injection" | "repayment";
  repayment_status: "open" | "partially_repaid" | "repaid";
  notes?: string;
}): Promise<{ success: true } | { error: string }> {
  const admin = await requireAdmin();

  if (!payload.date)                                   return { error: "تاریخ الزامی است." };
  if (!Number.isFinite(payload.amount) || payload.amount <= 0) return { error: "مبلغ نامعتبر است." };
  if (!["AUD", "IRT"].includes(payload.currency))      return { error: "ارز نامعتبر است." };
  if (!["zarman", "kadoos", "pezhman"].includes(payload.account)) return { error: "حساب نامعتبر است." };
  if (!["injection", "repayment"].includes(payload.loan_type))   return { error: "نوع وام نامعتبر است." };
  if (payload.currency === "AUD" && !payload.exchange_rate) return { error: "برای وام AUD نرخ تاریخی الزامی است." };

  const db = makeServiceRoleClient();
  const { error } = await db.from("owner_loans").insert([{
    date:             payload.date,
    currency:         payload.currency,
    amount:           payload.amount,
    exchange_rate:    payload.currency === "AUD" ? payload.exchange_rate : null,
    account:          payload.account,
    loan_type:        payload.loan_type,
    repayment_status: payload.repayment_status,
    notes:            payload.notes?.trim() || null,
    created_by:       admin.id,
  }]);

  if (error) return { error: error.message };

  await writeAuditLog({
    actorId:    admin.id,
    actorEmail: admin.email ?? "",
    action:     "OWNER_LOAN_ADDED",
    targetType: "owner_loans",
    newValue:   payload,
  }).catch(() => {});

  revalidatePath("/admin/treasury");
  return { success: true };
}

export async function deleteOwnerLoan(id: string): Promise<{ success: true } | { error: string }> {
  const admin = await requireAdmin();
  if (!id) return { error: "شناسه الزامی است." };

  const db = makeServiceRoleClient();
  const { data: before } = await db.from("owner_loans").select("amount, currency, loan_type").eq("id", id).single();
  const { error } = await db.from("owner_loans").delete().eq("id", id);
  if (error) return { error: error.message };

  await writeAuditLog({
    actorId:    admin.id,
    actorEmail: admin.email ?? "",
    action:     "OWNER_LOAN_DELETED",
    targetType: "owner_loans",
    targetId:   id,
    oldValue:   before,
  }).catch(() => {});

  revalidatePath("/admin/treasury");
  return { success: true };
}

// ── Expenses ───────────────────────────────────────────────────────────────

export async function addExpense(payload: {
  date: string;
  title: string;
  category: string;
  currency: "AUD" | "IRT";
  amount: number;
  /** Historical IRT/AUD rate at time expense was incurred. Required for AUD expenses. */
  exchange_rate?: number | null;
  payer_account: "zarman" | "kadoos" | "pezhman";
  status: "paid" | "pending";
  notes?: string;
}): Promise<{ success: true } | { error: string }> {
  const admin = await requireAdmin();

  if (!payload.date)                                   return { error: "تاریخ الزامی است." };
  if (!payload.title?.trim())                          return { error: "عنوان الزامی است." };
  if (!Number.isFinite(payload.amount) || payload.amount <= 0) return { error: "مبلغ نامعتبر است." };
  if (!["AUD", "IRT"].includes(payload.currency))      return { error: "ارز نامعتبر است." };
  if (payload.currency === "AUD" && !payload.exchange_rate) return { error: "برای هزینه AUD نرخ تاریخی الزامی است." };

  const VALID_CATEGORIES = ["rent", "marketing", "bank_fees", "software", "salary", "tax", "office", "miscellaneous"];
  if (!VALID_CATEGORIES.includes(payload.category))    return { error: "دسته‌بندی نامعتبر است." };

  const db = makeServiceRoleClient();
  const { error } = await db.from("expenses").insert([{
    date:          payload.date,
    title:         payload.title.trim(),
    category:      payload.category,
    currency:      payload.currency,
    amount:        payload.amount,
    exchange_rate: payload.currency === "AUD" ? payload.exchange_rate : null,
    payer_account: payload.payer_account,
    status:        payload.status,
    notes:         payload.notes?.trim() || null,
    created_by:    admin.id,
  }]);

  if (error) return { error: error.message };

  await writeAuditLog({
    actorId:    admin.id,
    actorEmail: admin.email ?? "",
    action:     "EXPENSE_ADDED",
    targetType: "expenses",
    newValue:   payload,
  }).catch(() => {});

  revalidatePath("/admin/treasury");
  return { success: true };
}

export async function deleteExpense(id: string): Promise<{ success: true } | { error: string }> {
  const admin = await requireAdmin();
  if (!id) return { error: "شناسه الزامی است." };

  const db = makeServiceRoleClient();
  const { data: before } = await db.from("expenses").select("title, amount, currency, category").eq("id", id).single();
  const { error } = await db.from("expenses").delete().eq("id", id);
  if (error) return { error: error.message };

  await writeAuditLog({
    actorId:    admin.id,
    actorEmail: admin.email ?? "",
    action:     "EXPENSE_DELETED",
    targetType: "expenses",
    targetId:   id,
    oldValue:   before,
  }).catch(() => {});

  revalidatePath("/admin/treasury");
  return { success: true };
}
