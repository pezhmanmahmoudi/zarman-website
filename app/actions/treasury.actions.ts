"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/app/actions/admin.actions";
import {
  calcAccountingSnapshot,
  type LedgerRowInput,
  type ExpenseRowInput,
  type OwnerLoanRowInput,
  type AccountMeta,
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

// ── Private helpers ────────────────────────────────────────────────────────

function makeServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
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
  await db.from("audit_logs").insert([
    {
      actor_id: args.actorId,
      actor_email: args.actorEmail,
      action: args.action,
      target_type: args.targetType || null,
      target_id: args.targetId || null,
      old_value: args.oldValue ? JSON.stringify(args.oldValue) : null,
      new_value: args.newValue ? JSON.stringify(args.newValue) : null,
    },
  ]);
}

const DEFAULT_SETTINGS = {
  min_aud_inventory: 5000,
  target_aud_inventory: 15000,
  max_aud_inventory: 40000,
  min_irt_liquidity: 200000000,
  max_aud_exposure: 0.7,
  target_exposure_ratio: 0.4,
  inventory_coverage_target_days: 14,
  cash_runway_target_months: 3,
  recommendation_sensitivity: "medium" as const,
};

type TreasurySettingsRow = {
  min_aud_inventory: number;
  target_aud_inventory: number;
  max_aud_inventory: number;
  min_irt_liquidity: number;
  max_aud_exposure: number;
  target_exposure_ratio: number;
  inventory_coverage_target_days: number;
  cash_runway_target_months: number;
  recommendation_sensitivity: "low" | "medium" | "high";
  kadoos_balance_irt: number;
  pezhman_balance_irt: number;
  updated_at: string | null;
};

export type TreasuryPageData = {
  accounting: any;
  treasury: any;
  strategy: any;
  ownerLoans: any[];
  expenses: any[];
  bankAccounts: any[];
  settings: TreasurySettingsRow;
};

// ── Server Actions ─────────────────────────────────────────────────────────

/**
 * دریافت پویای کل اطلاعات خزانه‌داری صرافی زرمان بر مبنای دفتر کل دوطرفه (Multi-Pocket)
 */
export async function getTreasuryFullData(): Promise<TreasuryPageData> {
  const db = makeServiceRoleClient();

  // واکشی همزمان تمام داده‌های مالی زنده
  const [ledgerRes, expenseRes, loanRes, settingsRes, rateRes, accountsRes] = await Promise.all([
    db
      .from("ledger")
      .select("*")
      .order("date_gregorian", { ascending: true })
      .order("created_at", { ascending: true }),

    db.from("expenses").select("*").order("date", { ascending: false }),
    db.from("owner_loans").select("*").order("date", { ascending: false }),
    db.from("treasury_settings").select("*").eq("id", 1).maybeSingle(),
    db.from("rates_history").select("buy_aud").order("date", { ascending: false }).limit(1).maybeSingle(),
    db.from("bank_accounts").select("*").eq("is_active", true),
  ]);

  // ۱. مپ کردن ساختار کشوها برای پردازش در موتور حسابداری
  const accountsMeta: AccountMeta[] = (accountsRes.data ?? []).map((a: any) => ({
    id: String(a.id),
    name: String(a.account_name),
    currency: a.currency as "AUD" | "IRT",
    type: a.account_type as "bank" | "virtual" | "transit",
  }));

  // ۲. آماده‌سازی سطرهای لجر با فیلدهای مبدأ و مقصد
  const ledgerRows: LedgerRowInput[] = (ledgerRes.data ?? []).map((r: any) => ({
    id: String(r.id),
    type: r.type as string,
    entry_type: r.entry_type as string | null,
    amount_aud: Number(r.amount_aud ?? 0),
    amount_toman: Number(r.amount_toman ?? 0),
    exchange_rate: Number(r.exchange_rate ?? 0),
    fee_aud: Number(r.fee_aud ?? 0),
    date_gregorian: r.date_gregorian as string,
    payer_account_id: r.payer_account_id as string | null,
    receiver_account_id: r.receiver_account_id as string | null,
    created_at: r.created_at as string,
  }));

  const expenseInputs: ExpenseRowInput[] = (expenseRes.data ?? []).map((r: any) => ({
    id: String(r.id),
    currency: r.currency as "AUD" | "IRT",
    amount: Number(r.amount),
    exchange_rate: r.exchange_rate != null ? Number(r.exchange_rate) : null,
    status: r.status as "paid" | "pending",
    date: r.date as string,
    category: r.category as string,
    payer_account_id: r.payer_account_id as string | null,
  }));

  const loanInputs: OwnerLoanRowInput[] = (loanRes.data ?? []).map((r: any) => ({
    id: String(r.id),
    currency: r.currency as "AUD" | "IRT",
    amount: Number(r.amount),
    exchange_rate: r.exchange_rate != null ? Number(r.exchange_rate) : null,
    loan_type: r.loan_type as "injection" | "repayment",
    account_id: r.account_id as string | null,
    date: r.date as string,
  }));

  const raw = settingsRes.data;
  const settings: TreasurySettingsRow = {
    min_aud_inventory: Number(raw?.min_aud_inventory ?? DEFAULT_SETTINGS.min_aud_inventory),
    target_aud_inventory: Number(raw?.target_aud_inventory ?? DEFAULT_SETTINGS.target_aud_inventory),
    max_aud_inventory: Number(raw?.max_aud_inventory ?? DEFAULT_SETTINGS.max_aud_inventory),
    min_irt_liquidity: Number(raw?.min_irt_liquidity ?? DEFAULT_SETTINGS.min_irt_liquidity),
    max_aud_exposure: Number(raw?.max_aud_exposure ?? DEFAULT_SETTINGS.max_aud_exposure),
    target_exposure_ratio: Number(raw?.target_exposure_ratio ?? DEFAULT_SETTINGS.target_exposure_ratio),
    inventory_coverage_target_days: Number(raw?.inventory_coverage_target_days ?? DEFAULT_SETTINGS.inventory_coverage_target_days),
    cash_runway_target_months: Number(raw?.cash_runway_target_months ?? DEFAULT_SETTINGS.cash_runway_target_months),
    recommendation_sensitivity: (raw?.recommendation_sensitivity as "low" | "medium" | "high") ?? DEFAULT_SETTINGS.recommendation_sensitivity,
    kadoos_balance_irt: Number(raw?.kadoos_balance_irt ?? 0),
    pezhman_balance_irt: Number(raw?.pezhman_balance_irt ?? 0),
    updated_at: (raw?.updated_at as string | null) ?? null,
  };

  const currentBuyRate = Number(rateRes.data?.buy_aud ?? 0);

  // ۳. محاسبه ترازنامه‌ها و سودها در موتور پیشرفته V2
  const accounting = calcAccountingSnapshot(
    ledgerRows,
    expenseInputs,
    loanInputs,
    accountsMeta,
    currentBuyRate
  );

  // ۴. محاسبه نقدینگی داینامیک کل ایران بر مبنای برآیند کشوها (حذف کامل هاردکد کادوس/پژمان)
  let totalIranLiquidityIRT = 0;
  Object.values(accounting.drawerBalances).forEach((drawer: any) => {
    if (drawer.currency === "IRT" && drawer.type === "bank") {
      totalIranLiquidityIRT += drawer.balance;
    }
  });

  const balancesInput: AccountBalancesInput = {
    kadoosBalanceIRT: totalIranLiquidityIRT,
    pezhmanBalanceIRT: 0,
  };

  const treasury = calcTreasurySnapshot(
    accounting,
    ledgerRows,
    balancesInput,
    settings
  );

  const strategy = generateStrategyOutput(treasury, accounting);

  return {
    accounting,
    treasury,
    strategy,
    ownerLoans: loanRes.data ?? [],
    expenses: expenseRes.data ?? [],
    bankAccounts: accountsRes.data ?? [],
    settings,
  };
}

/**
 * به‌روزرسانی تنظیمات حد آستانه صرافی
 */
export async function updateTreasurySettings(
  payload: TreasurySettingsInput
): Promise<{ success: true } | { error: string }> {
  const admin = await requireAdmin();

  const db = makeServiceRoleClient();
  const { error } = await db.from("treasury_settings").upsert({
    id: 1,
    min_aud_inventory: payload.min_aud_inventory,
    target_aud_inventory: payload.target_aud_inventory,
    max_aud_inventory: payload.max_aud_inventory,
    min_irt_liquidity: payload.min_irt_liquidity,
    max_aud_exposure: payload.max_aud_exposure,
    target_exposure_ratio: payload.target_exposure_ratio,
    inventory_coverage_target_days: payload.inventory_coverage_target_days,
    cash_runway_target_months: payload.cash_runway_target_months,
    recommendation_sensitivity: payload.recommendation_sensitivity,
    updated_at: new Date().toISOString(),
  });

  if (error) return { error: error.message };

  await writeAuditLog({
    actorId: admin.id,
    actorEmail: admin.email ?? "",
    action: "TREASURY_SETTINGS_UPDATED",
    targetType: "treasury_settings",
    targetId: "1",
    newValue: payload,
  }).catch(() => {});

  revalidatePath("/admin/treasury");
  return { success: true };
}

/**
 * ثبت وام جدید یا بازپرداخت به تفکیک کشو
 */
export async function addOwnerLoan(payload: {
  date: string;
  currency: "AUD" | "IRT";
  amount: number;
  exchange_rate?: number | null;
  account_id: string;
  loan_type: "injection" | "repayment";
  repayment_status: "open" | "partially_repaid" | "repaid";
  notes?: string;
}): Promise<{ success: true } | { error: string }> {
  const admin = await requireAdmin();

  if (!payload.account_id) return { error: "انتخاب کشوی حساب الزامی است." };
  if (payload.amount <= 0) return { error: "مبلغ باید بزرگتر از صفر باشد." };

  const db = makeServiceRoleClient();
  const { error } = await db.from("owner_loans").insert([
    {
      date: payload.date,
      currency: payload.currency,
      amount: payload.amount,
      exchange_rate: payload.currency === "AUD" ? payload.exchange_rate : null,
      account_id: payload.account_id,
      loan_type: payload.loan_type,
      repayment_status: payload.repayment_status,
      notes: payload.notes?.trim() || null,
      created_by: admin.id,
    },
  ]);

  if (error) return { error: error.message };

  await writeAuditLog({
    actorId: admin.id,
    actorEmail: admin.email ?? "",
    action: "OWNER_LOAN_ADDED",
    targetType: "owner_loans",
    newValue: payload,
  }).catch(() => {});

  revalidatePath("/admin/treasury");
  return { success: true };
}

/**
 * ثبت هزینه جدید صرافی متصل به کشوی پرداخت‌کننده
 */
export async function addExpense(payload: {
  date: string;
  title: string;
  category: string;
  currency: "AUD" | "IRT";
  amount: number;
  exchange_rate?: number | null;
  payer_account_id: string;
  status: "paid" | "pending";
  notes?: string;
}): Promise<{ success: true } | { error: string }> {
  const admin = await requireAdmin();

  if (!payload.title.trim()) return { error: "عنوان هزینه الزامی است." };
  if (!payload.payer_account_id) return { error: "انتخاب کشوی پرداخت‌کننده الزامی است." };
  if (payload.amount <= 0) return { error: "مبلغ هزینه باید بیشتر از صفر باشد." };

  const db = makeServiceRoleClient();
  const { error } = await db.from("expenses").insert([
    {
      date: payload.date,
      title: payload.title.trim(),
      category: payload.category,
      currency: payload.currency,
      amount: payload.amount,
      exchange_rate: payload.currency === "AUD" ? payload.exchange_rate : null,
      payer_account_id: payload.payer_account_id,
      status: payload.status,
      notes: payload.notes?.trim() || null,
      created_by: admin.id,
    },
  ]);

  if (error) return { error: error.message };

  await writeAuditLog({
    actorId: admin.id,
    actorEmail: admin.email ?? "",
    action: "EXPENSE_ADDED",
    targetType: "expenses",
    newValue: payload,
  }).catch(() => {});

  revalidatePath("/admin/treasury");
  return { success: true };
}

/**
 * حذف هزینه
 */
export async function deleteExpense(id: string): Promise<{ success: true } | { error: string }> {
  const admin = await requireAdmin();
  if (!id) return { error: "شناسه الزامی است." };

  const db = makeServiceRoleClient();
  const { data: before } = await db.from("expenses").select("title, amount, currency").eq("id", id).single();
  const { error } = await db.from("expenses").delete().eq("id", id);
  if (error) return { error: error.message };

  await writeAuditLog({
    actorId: admin.id,
    actorEmail: admin.email ?? "",
    action: "EXPENSE_DELETED",
    targetType: "expenses",
    targetId: id,
    oldValue: before,
  }).catch(() => {});

  revalidatePath("/admin/treasury");
  return { success: true };
}

/**
 * حذف وام مالک
 */
export async function deleteOwnerLoan(id: string): Promise<{ success: true } | { error: string }> {
  const admin = await requireAdmin();
  if (!id) return { error: "شناسه الزامی است." };

  const db = makeServiceRoleClient();
  const { data: before } = await db.from("owner_loans").select("amount, currency, loan_type").eq("id", id).single();
  const { error } = await db.from("owner_loans").delete().eq("id", id);
  if (error) return { error: error.message };

  await writeAuditLog({
    actorId: admin.id,
    actorEmail: admin.email ?? "",
    action: "OWNER_LOAN_DELETED",
    targetType: "owner_loans",
    targetId: id,
    oldValue: before,
  }).catch(() => {});

  revalidatePath("/admin/treasury");
  return { success: true };
}

/**
 * تعریف و ایجاد یک کشو (حساب بانکی یا مجازی) جدید در سیستم زرمان
 */
export async function addBankAccount(payload: {
  account_name: string;
  currency: "IRT" | "AUD";
  account_type: "bank" | "virtual" | "transit";
  country: "Iran" | "Australia";
}): Promise<{ success: true } | { error: string }> {
  const admin = await requireAdmin();

  if (!payload.account_name.trim()) return { error: "نام حساب الزامی است." };

  const db = makeServiceRoleClient();
  const { error } = await db.from("bank_accounts").insert([
    {
      account_name: payload.account_name.trim(),
      currency:     payload.currency,
      account_type: payload.account_type,
      country:      payload.country,
      is_active:    true,
    },
  ]);

  if (error) return { error: error.message };

  // ثبت در لاگ سیستم
  await writeAuditLog({
    actorId: admin.id,
    actorEmail: admin.email ?? "",
    action: "BANK_ACCOUNT_CREATED",
    targetType: "bank_accounts",
    newValue: payload,
  }).catch(() => {});

  revalidatePath("/admin/treasury");
  return { success: true };
}