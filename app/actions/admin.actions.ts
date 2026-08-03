"use server";

import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerActionClient } from "@/lib/supabase-server";
import { revalidateTag } from "next/cache";
import { getRatesSnapshot } from "@/lib/rates";
import { calcExecutionRateFromSettlement } from "@/lib/pricing";

const AUDIT_LOG_RETRY_COUNT = 2;
const DEFAULT_HISTORY_LIMIT = 50;
const MAX_HISTORY_LIMIT = 200;
const DEFAULT_AUDIT_PAGE_SIZE = 50;
const MAX_AUDIT_PAGE_SIZE = 100;
const MAX_AUDIT_PAGE = 10_000;
const MAX_SEARCH_QUERY_LENGTH = 64;
const PRIVILEGED_ROLES = new Set(["admin", "supabase_admin", "service_role"]);
const COMPLIANCE_NOTE_MAX_LENGTH = 2_000;
const COMPLIANCE_REASON_MAX_LENGTH = 500;

const DVS_METHODS = new Set([
  "vendor_rapidid",
  "manual_document_review",
  "manual_video_call",
  "manual_in_person",
]);

const AML_METHODS = new Set([
  "vendor_namescan",
  "manual_austrac_watchlist",
  "manual_internal_review",
]);

type AdminAuthErrorCode = "AUTH_UNAUTHORIZED" | "AUTH_FORBIDDEN";

class AdminAuthError extends Error {
  code: AdminAuthErrorCode;
  status: 401 | 403;

  constructor(code: AdminAuthErrorCode, message: string) {
    super(message);
    this.name = "AdminAuthError";
    this.code = code;
    this.status = code === "AUTH_UNAUTHORIZED" ? 401 : 403;
  }
}

function throwAdminAuthError(code: AdminAuthErrorCode, message: string): never {
  throw new AdminAuthError(code, message);
}

// ---------------------------------------------------------------------------
// Service-role client — bypasses RLS for privileged writes.
// NEVER expose this client or its key to the browser.
// ---------------------------------------------------------------------------
function makeServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

function clampInt(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  const normalized = Math.trunc(value);
  return Math.min(max, Math.max(min, normalized));
}

// ---------------------------------------------------------------------------
// Auto-generate unique ZE reference codes for admin-created transactions
// ---------------------------------------------------------------------------
async function generateAdminReferenceCode(db: ReturnType<typeof makeServiceRoleClient>): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = "ZE" + Math.floor(Math.random() * 100000).toString().padStart(5, "0");
    const { data } = await db
      .from("transactions")
      .select("id")
      .eq("reference_code", code)
      .maybeSingle();
    if (!data) return code;
  }
  return "ZE" + Date.now().toString().slice(-5);
}

// ---------------------------------------------------------------------------
// Auto-generate unique ZM customer codes
// ---------------------------------------------------------------------------
async function generateCustomerCode(db: ReturnType<typeof makeServiceRoleClient>): Promise<string> {
  for (let i = 0; i < 15; i++) {
    const code = "ZM" + Math.floor(Math.random() * 100000).toString().padStart(5, "0");
    const { data } = await db
      .from("profiles")
      .select("id")
      .eq("customer_code", code)
      .maybeSingle();
    if (!data) return code;
  }
  return "ZM" + Date.now().toString().slice(-5);
}

function toDbTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Date-only payloads from the date picker use a stable default time.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T12:00:00.000Z`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

// ---------------------------------------------------------------------------
// Jalali (Shamsi) date helper — returns "YYYY/MM/DD" with zero-padded parts
// ---------------------------------------------------------------------------
function toJalaliStr(date: Date): string {
  const gy = date.getUTCFullYear(), gm = date.getUTCMonth() + 1, gd = date.getUTCDate();
  const gy1 = gy - 1600, gm1 = gm - 1, gd1 = gd - 1;
  let g_d_no = 365 * gy1 + Math.floor((gy1 + 3) / 4) - Math.floor((gy1 + 99) / 100) + Math.floor((gy1 + 399) / 400);
  const mDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (gy % 4 === 0 && (gy % 100 !== 0 || gy % 400 === 0)) mDays[1] = 29;
  for (let i = 0; i < gm1; i++) g_d_no += mDays[i];
  g_d_no += gd1;
  let j_d_no = g_d_no - 79;
  const j_np = Math.floor(j_d_no / 12053); j_d_no %= 12053;
  let jy = 979 + 33 * j_np + 4 * Math.floor(j_d_no / 1461); j_d_no %= 1461;
  if (j_d_no >= 366) { jy += Math.floor((j_d_no - 1) / 365); j_d_no = (j_d_no - 1) % 365; }
  const jm2 = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];
  let jm = 0;
  for (jm = 0; jm < 11 && j_d_no >= jm2[jm]; jm++) j_d_no -= jm2[jm];
  return `${jy}/${String(jm + 1).padStart(2, "0")}/${String(j_d_no + 1).padStart(2, "0")}`;
}

function resolveTradeExecutionRate(
  tradeType: "buy_aud" | "sell_aud",
  amountAud: number,
  equivalentToman: number,
  feeAud: number,
  appliedRate?: number | null,
) {
  if (Number.isFinite(appliedRate) && Number(appliedRate) > 0) {
    return Number(appliedRate);
  }
  return calcExecutionRateFromSettlement(amountAud, equivalentToman, feeAud, tradeType);
}

function sanitizeSearchQuery(query: string) {
  return query
    .trim()
    .slice(0, MAX_SEARCH_QUERY_LENGTH)
    .replace(/[%_,()]/g, " ")
    .replace(/\s+/g, " ");
}

function trimToNullable(value: unknown, maxLength = 255): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function isPrivilegedRole(role: unknown): role is string {
  return typeof role === "string" && PRIVILEGED_ROLES.has(role);
}

// ---------------------------------------------------------------------------
// requireAdmin — validates every sensitive admin action.
// ---------------------------------------------------------------------------
export async function requireAdmin(
  supabaseServer?: Awaited<ReturnType<typeof createSupabaseServerActionClient>>
) {
  const db = supabaseServer ?? (await createSupabaseServerActionClient());
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) {
    throwAdminAuthError("AUTH_UNAUTHORIZED", "Unauthorized: no active admin session.");
  }

  const role = data.user.app_metadata?.role;
  if (!isPrivilegedRole(role)) {
    throwAdminAuthError("AUTH_FORBIDDEN", "Forbidden: admin role required.");
  }

  const { error: capabilityError } = await db
    .from("audit_logs")
    .select("id", { head: true, count: "exact" })
    .limit(1);

  if (capabilityError) {
    throwAdminAuthError(
      "AUTH_FORBIDDEN",
      `Forbidden: admin capability check failed (${capabilityError.message}).`
    );
  }

  return data.user;
}

async function getAuthorizedServerClient() {
  const db = await createSupabaseServerActionClient();
  await requireAdmin(db);
  return db;
}

// ---------------------------------------------------------------------------
// Internal: write a structured audit log entry using the service role client
// ---------------------------------------------------------------------------
async function writeAuditLog({
  actorId,
  actorEmail,
  action,
  targetType,
  targetId,
  oldValue,
  newValue,
}: {
  actorId: string;
  actorEmail: string;
  action: string;
  targetType?: string;
  targetId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
}) {
  const db = makeServiceRoleClient();

  let lastError: string | null = null;
  for (let attempt = 1; attempt <= AUDIT_LOG_RETRY_COUNT; attempt += 1) {
    const { error } = await db.from("audit_logs").insert([
      {
        actor_id: actorId,
        actor_email: actorEmail,
        action,
        target_type: targetType ?? null,
        target_id: targetId ? String(targetId) : null,
        old_value: oldValue ?? null,
        new_value: newValue ?? null,
      },
    ]);

    if (!error) return;
    lastError = error.message;
  }

  throw new Error(
    `Audit log write failed after ${AUDIT_LOG_RETRY_COUNT} attempts: ${lastError ?? "unknown error"}`
  );
}

// ===========================================================================
// ADMIN STATS (dashboard overview)
// ===========================================================================
export async function getAdminStats() {
  const db = await getAuthorizedServerClient();

  const [pendingKyc, pendingTx, pendingFeedback, totalUsers, totalTx] =
    await Promise.all([
      db
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .in("kyc_status", ["pending", "under_review"]),
      db
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      db
        .from("testimonials")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      db
        .from("profiles")
        .select("id", { count: "exact", head: true }),
      db
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved"),
    ]);

  return {
    pendingKycCount: pendingKyc.count ?? 0,
    pendingTxCount: pendingTx.count ?? 0,
    pendingFeedbackCount: pendingFeedback.count ?? 0,
    totalUsersCount: totalUsers.count ?? 0,
    approvedTxCount: totalTx.count ?? 0,
  };
}

// ===========================================================================
// KYC QUEUE
// ===========================================================================
export async function getKycQueue() {
  const db = await getAuthorizedServerClient();

  const { data, error } = await db
    .from("profiles")
    .select("*")
    .in("kyc_status", ["pending", "under_review"])
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getKycHistory(page: number = 1, pageSize: number = 10) {
  const db = await getAuthorizedServerClient();
  const safePage = clampInt(page, 1, MAX_AUDIT_PAGE, 1);
  const safePageSize = clampInt(pageSize, 1, 50, 10);
  const offset = (safePage - 1) * safePageSize;

  const [countRes, dataRes] = await Promise.all([
    db
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .neq("kyc_status", "pending")
      .neq("kyc_status", "under_review"),
    db
      .from("profiles")
      .select("id, first_name, last_name, email, kyc_status, document_type, created_at, customer_code")
      .neq("kyc_status", "pending")
      .neq("kyc_status", "under_review")
      .order("created_at", { ascending: false })
      .range(offset, offset + safePageSize - 1),
  ]);

  if (dataRes.error) throw new Error(dataRes.error.message);
  return { data: dataRes.data ?? [], total: countRes.count ?? 0 };
}

export async function approveKyc(userId: string) {
  const admin = await requireAdmin();
  if (!userId) return { error: "Missing user ID." };

  const db = makeServiceRoleClient();

  const { data: before } = await db.from("profiles").select("kyc_status").eq("id", userId).single();
  const { error } = await db.from("profiles").update({ kyc_status: "approved", kyc_verified_at: new Date().toISOString() }).eq("id", userId);

  if (error) return { error: error.message };

  try {
    await writeAuditLog({
      actorId: admin.id,
      actorEmail: admin.email ?? "",
      action: "KYC_APPROVED",
      targetType: "profile",
      targetId: userId,
      oldValue: { kyc_status: before?.kyc_status ?? "unknown" },
      newValue: { kyc_status: "approved" },
    });
  } catch (auditError) {
    // Audit error log...
  }
  return { success: true };
}

export async function rejectKyc(userId: string) {
  const admin = await requireAdmin();
  if (!userId) return { error: "Missing user ID." };

  const db = makeServiceRoleClient();
  const { data: before } = await db.from("profiles").select("kyc_status").eq("id", userId).single();
  const { error } = await db.from("profiles").update({ kyc_status: "rejected" }).eq("id", userId);
  if (error) return { error: error.message };

  try {
    await writeAuditLog({
      actorId: admin.id,
      actorEmail: admin.email ?? "",
      action: "KYC_REJECTED",
      targetType: "profile",
      targetId: userId,
      oldValue: { kyc_status: before?.kyc_status ?? "unknown" },
      newValue: { kyc_status: "rejected" },
    });
  } catch (auditError) {}
  return { success: true };
}

export async function archiveKyc(userId: string) {
  const admin = await requireAdmin();
  if (!userId) return { error: "Missing user ID." };

  const db = makeServiceRoleClient();
  const { data: before } = await db.from("profiles").select("kyc_status").eq("id", userId).single();
  const { error } = await db.from("profiles").update({ kyc_status: "archived" }).eq("id", userId);
  if (error) return { error: error.message };

  try {
    await writeAuditLog({
      actorId: admin.id,
      actorEmail: admin.email ?? "",
      action: "KYC_ARCHIVED",
      targetType: "profile",
      targetId: userId,
      oldValue: { kyc_status: before?.kyc_status ?? "unknown" },
      newValue: { kyc_status: "archived" },
    });
  } catch (auditError) {}
  return { success: true };
}

export async function updateUserIdentityKycProfile(payload: any) {
  // Same as before...
  const admin = await requireAdmin();
  const db = makeServiceRoleClient();

  if (!payload.userId) return { error: "Missing user ID." };

  const { data: existingProfile, error: profileError } = await db.from("profiles").select("id, email").eq("id", payload.userId).maybeSingle();
  if (profileError) return { error: profileError.message };
  if (!existingProfile) return { error: "Customer profile not found." };

  const patch: Record<string, unknown> = {
    first_name: payload.first_name?.trim() || null,
    last_name: payload.last_name?.trim() || null,
    email: payload.email?.trim() || null,
    mobile_number: payload.mobile_number?.trim() || null,
    dob: payload.dob?.trim() || null,
    address: payload.address?.trim() || null,
    city: payload.city?.trim() || null,
    state: payload.state?.trim() || null,
    postcode: payload.postcode?.trim() || null,
    country: payload.country?.trim() || null,
    document_type: payload.document_type?.trim() || null,
    state_of_issue: payload.state_of_issue?.trim() || null,
    license_number: payload.license_number?.trim() || null,
    card_number: payload.card_number?.trim() || null,
    passport_number: payload.passport_number?.trim() || null,
    expiry_date: payload.expiry_date?.trim() || null,
  };
  if (payload.kyc_status) patch.kyc_status = payload.kyc_status;

  const { error: updateError } = await db.from("profiles").update(patch).eq("id", payload.userId);
  if (updateError) return { error: updateError.message };

  await writeAuditLog({
    actorId: admin.id,
    actorEmail: admin.email ?? "",
    action: "PROFILE_IDENTITY_KYC_UPDATED",
    targetType: "profile",
    targetId: payload.userId,
    newValue: patch,
  }).catch(() => {});

  return { success: true };
}

export async function recordCustomerComplianceCheck(payload: {
  userId: string;
  checkType: "dvs" | "aml";
  method: string;
  outcome?: string | null;
  amlFlag?: "none" | "clear" | "review_required" | "failed" | null;
}) {
  const admin = await requireAdmin();
  if (!payload.userId) return { error: "Missing user ID." };

  const db = makeServiceRoleClient();
  const now = new Date().toISOString();

  if (payload.checkType === "dvs") {
    if (!DVS_METHODS.has(payload.method)) return { error: "Invalid DVS method." };

    const patch: Record<string, unknown> = {
      compliance_dvs_status: "completed",
      compliance_dvs_method: payload.method,
      compliance_dvs_checked_at: now,
      compliance_dvs_outcome: trimToNullable(payload.outcome, 120) ?? "COMPLETED",
    };

    const { error } = await db.from("profiles").update(patch).eq("id", payload.userId);
    if (error) return { error: error.message };

    await writeAuditLog({
      actorId: admin.id,
      actorEmail: admin.email ?? "",
      action: "ADMIN_DVS_CHECK_RECORDED",
      targetType: "profile",
      targetId: payload.userId,
      newValue: patch,
    }).catch(() => {});

    return { success: true };
  }

  if (!AML_METHODS.has(payload.method)) return { error: "Invalid AML method." };

  const amlFlag = payload.amlFlag ?? "none";
  if (!["none", "clear", "review_required", "failed"].includes(amlFlag)) {
    return { error: "Invalid AML flag." };
  }

  const patch: Record<string, unknown> = {
    compliance_aml_status: "completed",
    compliance_aml_method: payload.method,
    compliance_aml_checked_at: now,
    compliance_aml_outcome: trimToNullable(payload.outcome, 120) ?? "COMPLETED",
    compliance_aml_flag: amlFlag,
  };

  const { error } = await db.from("profiles").update(patch).eq("id", payload.userId);
  if (error) return { error: error.message };

  await writeAuditLog({
    actorId: admin.id,
    actorEmail: admin.email ?? "",
    action: "ADMIN_AML_CHECK_RECORDED",
    targetType: "profile",
    targetId: payload.userId,
    newValue: patch,
  }).catch(() => {});

  return { success: true };
}

export async function saveCustomerComplianceReview(payload: {
  userId: string;
  flagged: boolean;
  flagReason?: string | null;
  note?: string | null;
}) {
  const admin = await requireAdmin();
  if (!payload.userId) return { error: "Missing user ID." };

  const db = makeServiceRoleClient();
  const patch: Record<string, unknown> = {
    compliance_customer_flagged: payload.flagged,
    compliance_customer_flagged_at: payload.flagged ? new Date().toISOString() : null,
    compliance_customer_flag_reason: payload.flagged
      ? trimToNullable(payload.flagReason, COMPLIANCE_REASON_MAX_LENGTH)
      : null,
    compliance_admin_note: trimToNullable(payload.note, COMPLIANCE_NOTE_MAX_LENGTH),
  };

  const { error } = await db.from("profiles").update(patch).eq("id", payload.userId);
  if (error) return { error: error.message };

  await writeAuditLog({
    actorId: admin.id,
    actorEmail: admin.email ?? "",
    action: "ADMIN_COMPLIANCE_REVIEW_UPDATED",
    targetType: "profile",
    targetId: payload.userId,
    newValue: patch,
  }).catch(() => {});

  return { success: true };
}

// ===========================================================================
// TRANSACTIONS QUEUE
// ===========================================================================
export async function getPendingTransactions() {
  const db = await getAuthorizedServerClient();

  const { data, error } = await db
    .from("transactions")
    .select(
      "id, user_id, type, amount_aud, equivalent_toman, status, created_at, source_of_funds, reason_for_transfer, profiles(first_name, last_name, email)"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getTransactionHistory(limitCount: number = DEFAULT_HISTORY_LIMIT) {
  const db = await getAuthorizedServerClient();
  const safeLimit = clampInt(limitCount, 1, MAX_HISTORY_LIMIT, DEFAULT_HISTORY_LIMIT);

  const { data, error } = await db
    .from("transactions")
    .select(
      "id, user_id, type, amount_aud, equivalent_toman, status, created_at, source_of_funds, reason_for_transfer, profiles(first_name, last_name, email)"
    )
    .neq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * APPROVE TRANSACTION (MULTI-POCKET EDITION)
 * ---------------------------------------------------------
 * Now receives payerAccountId and receiverAccountId from the UI Modal
 * and logs the exact cash flow into the Ledger Drawer balances.
 */
export async function approveTransaction(
  transactionId: string | number,
  payerAccountId?: string,
  receiverAccountId?: string
) {
  const admin = await requireAdmin();
  if (!transactionId) return { error: "Missing transaction ID." };

  const db = makeServiceRoleClient();

  const { data: before } = await db
    .from("transactions")
    .select(`
      status, user_id, amount_aud, equivalent_toman, applied_rate, type, created_at, payment_link,
      profiles(first_name, last_name, email),
      recipients(full_name, account_name)
    `)
    .eq("id", transactionId)
    .single();

  if (!before) return { error: "Transaction not found." };
  if (before.status !== "pending") {
    return { error: `Transaction is already '${before.status}'.` };
  }

  if (!payerAccountId || !receiverAccountId) {
    return { error: "برای ثبت صحیح در دفتر کل، انتخاب هر دو کشوی مبدأ و مقصد الزامی است." };
  }

  if (payerAccountId === receiverAccountId) {
    return { error: "کشوی مبدأ و مقصد نمی‌توانند یکسان باشند." };
  }

  const { data: selectedAccounts, error: selectedAccountsError } = await db
    .from("bank_accounts")
    .select("id, currency")
    .in("id", [payerAccountId, receiverAccountId]);

  if (selectedAccountsError) return { error: selectedAccountsError.message };

  const payerAccount = (selectedAccounts ?? []).find((a: any) => a.id === payerAccountId);
  const receiverAccount = (selectedAccounts ?? []).find((a: any) => a.id === receiverAccountId);

  if (!payerAccount || !receiverAccount) {
    return { error: "یکی از کشوهای انتخابی یافت نشد." };
  }

  const txType = String(before.type ?? "");
  if (txType === "buy_aud") {
    if (payerAccount.currency !== "AUD" || receiverAccount.currency !== "IRT") {
      return { error: "برای buy_aud کشوی مبدأ باید AUD و کشوی مقصد باید IRT باشد." };
    }
  } else if (txType === "sell_aud") {
    if (payerAccount.currency !== "IRT" || receiverAccount.currency !== "AUD") {
      return { error: "برای sell_aud کشوی مبدأ باید IRT و کشوی مقصد باید AUD باشد." };
    }
  }

  const { error } = await db
    .from("transactions")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", transactionId);

  if (error) return { error: error.message };

  // ── Insert ledger snapshot with Sub-Ledger Drawers ───────────────
  try {
    const { data: rateRow } = await db
      .from("rates_history")
      .select("buy_aud, applied_fee, fee_threshold")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const audAmt   = Number(before.amount_aud ?? 0);
    const tomanAmt = Number(before.equivalent_toman ?? 0);
    const feeThreshold = Number(rateRow?.fee_threshold ?? 1000);
    const appliedFee   = Number(rateRow?.applied_fee   ?? 30);
    const feeAud = audAmt > 0 && audAmt < feeThreshold ? appliedFee : 0;
    const rate = resolveTradeExecutionRate(
      before.type as "buy_aud" | "sell_aud",
      audAmt,
      tomanAmt,
      feeAud,
      Number((before as { applied_rate?: number | null }).applied_rate ?? 0),
    );

    const txDate = before.created_at ? new Date(before.created_at) : new Date();
    const dateGregorian = txDate.toISOString().slice(0, 10);
    const dateJalali    = toJalaliStr(txDate);

    const profileArr = Array.isArray(before.profiles) ? before.profiles : [before.profiles];
    const recipArr   = Array.isArray(before.recipients) ? before.recipients : [before.recipients];
    const p = profileArr[0] as Record<string, unknown> | null;
    const r = recipArr[0]   as Record<string, unknown> | null;
    const sender    = p ? (`${p.first_name ?? ""} ${p.last_name ?? ""}`).trim() || String(p.email ?? "") : "";
    const recipient = r ? (String(r.full_name ?? r.account_name ?? "")).trim() : ((before as any).payment_link ? "Payment Link" : "");

    await db.from("ledger").insert([{
      transaction_id:      String(transactionId),
      date_gregorian:      dateGregorian,
      date_jalali:         dateJalali,
      type:                before.type,
      entry_type:          "trade",  // explicitly mark as trade for accounting engine
      exchange_rate:       rate,
      amount_aud:          audAmt,
      amount_toman:        tomanAmt,
      sender,
      recipient,
      fee_aud:             feeAud,
      payer_account_id:    payerAccountId || null,
      receiver_account_id: receiverAccountId || null,
      created_by:          admin.id,
    }]);
  } catch (e) { 
    // console.error("Ledger insert failed:", e); 
  }

  // ── Audit log ────────────────────────────────────────────────────────────
  try {
    await writeAuditLog({
      actorId: admin.id,
      actorEmail: admin.email ?? "",
      action: "TRANSACTION_APPROVED",
      targetType: "transaction",
      targetId: String(transactionId),
      oldValue: { status: "pending" },
      newValue: { 
        status: "approved", 
        user_id: before.user_id, 
        amount_aud: before.amount_aud, 
        type: before.type,
        payer_account_id: payerAccountId,
        receiver_account_id: receiverAccountId
      },
    });
  } catch (auditError) {}

  return { success: true };
}

export async function rejectTransaction(transactionId: string | number) {
  const admin = await requireAdmin();
  if (!transactionId) return { error: "Missing transaction ID." };

  const db = makeServiceRoleClient();
  const { data: before } = await db.from("transactions").select("status, user_id, amount_aud, type").eq("id", transactionId).single();
  if (!before) return { error: "Transaction not found." };
  if (before.status !== "pending" && before.status !== "approved") {
    return { error: `Transaction is already '${before.status}'.` };
  }
  const { error } = await db.from("transactions").update({ status: "rejected" }).eq("id", transactionId);
  if (error) return { error: error.message };

  try {
    await writeAuditLog({
      actorId: admin.id,
      actorEmail: admin.email ?? "",
      action: "TRANSACTION_REJECTED",
      targetType: "transaction",
      targetId: String(transactionId),
      oldValue: { status: "pending" },
      newValue: { status: "rejected", user_id: before.user_id, amount_aud: before.amount_aud, type: before.type },
    });
  } catch (auditError) {}
  return { success: true };
}

export async function archiveTransaction(transactionId: string | number) {
  const admin = await requireAdmin();
  if (!transactionId) return { error: "Missing transaction ID." };

  const db = makeServiceRoleClient();
  const { data: before } = await db.from("transactions").select("status, user_id, amount_aud, type").eq("id", transactionId).single();
  if (!before) return { error: "Transaction not found." };
  if (before.status !== "pending") return { error: `Transaction is already '${before.status}'.` };
  
  const { error } = await db.from("transactions").update({ status: "archived" }).eq("id", transactionId);
  if (error) return { error: error.message };

  return { success: true };
}

// ===========================================================================
// FEEDBACK / TESTIMONIALS MODERATION
// ===========================================================================
export async function getFeedbackQueue() {
  const db = await getAuthorizedServerClient();
  const { data, error } = await db
    .from("testimonials")
    .select("id, user_id, message, rating, status, created_at, profiles(first_name, last_name, email, customer_code)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getFeedbackHistory(page = 1, pageSize = 10) {
  const db = await getAuthorizedServerClient();
  const safePage = clampInt(page, 1, MAX_AUDIT_PAGE, 1);
  const safePageSize = clampInt(pageSize, 1, 50, 10);
  const offset = (safePage - 1) * safePageSize;

  const [countRes, dataRes] = await Promise.all([
    db.from("testimonials").select("id", { count: "exact", head: true }).neq("status", "pending"),
    db
      .from("testimonials")
      .select("id, user_id, message, rating, status, created_at, profiles(first_name, last_name, email, customer_code)")
      .neq("status", "pending")
      .order("created_at", { ascending: false })
      .range(offset, offset + safePageSize - 1),
  ]);
  if (dataRes.error) throw new Error(dataRes.error.message);
  return { data: dataRes.data ?? [], total: countRes.count ?? 0 };
}

export async function moderateFeedback(feedbackId: string | number, newStatus: "approved" | "rejected") {
  const admin = await requireAdmin();
  if (!feedbackId) return { error: "Missing feedback ID." };
  if (!["approved", "rejected"].includes(newStatus)) return { error: "Invalid status." };

  const db = makeServiceRoleClient();
  const { error } = await db.from("testimonials").update({ status: newStatus }).eq("id", feedbackId);
  if (error) return { error: error.message };

  try {
    await writeAuditLog({
      actorId: admin.id,
      actorEmail: admin.email ?? "",
      action: `FEEDBACK_${newStatus.toUpperCase()}`,
      targetType: "testimonial",
      targetId: String(feedbackId),
      newValue: { status: newStatus },
    });
  } catch {}

  return { success: true };
}

// ===========================================================================
// SYSTEM SETTINGS
// ===========================================================================
export async function getSystemSettings() {
  const db = await getAuthorizedServerClient();
  const { data, error } = await db.from("rates_history").select("*").order("date", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateSystemSettings(payload: any) {
  const admin = await requireAdmin();
  const db = makeServiceRoleClient();

  const patch: Record<string, unknown> = {};
  
  // 1. نرخ‌های روزانه
  if (payload.buy_aud !== undefined) patch.buy_aud = Number(payload.buy_aud);
  if (payload.sell_aud !== undefined) patch.sell_aud = Number(payload.sell_aud);
  
  // 2. تنظیمات کارمزدها
  if (payload.applied_fee !== undefined) patch.applied_fee = Number(payload.applied_fee);
  if (payload.fee_threshold !== undefined) patch.fee_threshold = Number(payload.fee_threshold);
  // فیلد base_fee_aud چون در دیتابیس نبود حذف شد
  
  // 3. وضعیت بازار و پیام‌ها
  if (payload.market_active !== undefined) patch.market_active = Boolean(payload.market_active);
  if (payload.pause_message !== undefined) patch.pause_message = payload.pause_message;
  
  // 🌟 اصلاح اصلی: در دیتابیس اسم این ستون فقط note است
  if (payload.rate_note !== undefined) patch.note = payload.rate_note;
  
  // 4. منطق تخفیف وفاداری
  if (payload.discount_step_volume !== undefined) patch.discount_step_volume = Number(payload.discount_step_volume);
  if (payload.discount_percent_per_step !== undefined) patch.discount_percent_per_step = Number(payload.discount_percent_per_step);
  if (payload.max_discount_percent !== undefined) patch.max_discount_percent = Number(payload.max_discount_percent);

  if (Object.keys(patch).length === 0) return { success: true };

  // ثبت تاریخ امروز برای رکورد جدید
  patch.date = new Date().toISOString().slice(0, 10);

  const { error } = await db
    .from("rates_history")
    .upsert(patch, { onConflict: "date" });
  if (error) return { error: error.message };

  // ثبت در لاگ حسابرسی (Audit Log)
  await writeAuditLog({
    actorId: admin.id,
    actorEmail: admin.email ?? "",
    action: "SYSTEM_SETTINGS_UPDATED",
    targetType: "rates_history",
    newValue: patch,
  }).catch(() => {});

  return { success: true };
}

// ===========================================================================
// AUDIT LOGS
// ===========================================================================
export async function getAuditLogs(page = 1, pageSize = 10) {
  await getAuthorizedServerClient();
  const db = makeServiceRoleClient();
  const safePage = clampInt(page, 1, MAX_AUDIT_PAGE, 1);
  const safePageSize = clampInt(pageSize, 1, MAX_AUDIT_PAGE_SIZE, 10);
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;
  const { data, count } = await db.from("audit_logs").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);

  const logs = data ?? [];
  const actorIds = Array.from(
    new Set(
      logs
        .map((log) => (typeof log.actor_id === "string" ? log.actor_id : ""))
        .filter(Boolean)
    )
  );

  const actorRoleEntries = await Promise.all(
    actorIds.map(async (actorId) => {
      const { data: actorData, error } = await db.auth.admin.getUserById(actorId);
      if (error || !actorData.user) return [actorId, null] as const;
      const role = actorData.user.app_metadata?.role;
      return [actorId, isPrivilegedRole(role) ? String(role) : null] as const;
    })
  );

  const actorRoles = new Map(actorRoleEntries);
  const enrichedLogs = logs.map((log) => {
    const actorRole = typeof log.actor_id === "string" ? actorRoles.get(log.actor_id) ?? null : null;
    return {
      ...log,
      actor_role: actorRole,
      actor_is_admin: actorRole !== null,
    };
  });

  return { data: enrichedLogs, total: count ?? 0 };
}

// ===========================================================================
// USER SEARCH (for User Financial Profile tab)
// ===========================================================================
export async function searchUsers(query: string) {
  const db = await getAuthorizedServerClient();
  const sanitized = sanitizeSearchQuery(query);
  if (!sanitized) return [];

  const { data, error } = await db
    .from("profiles")
    .select("id, first_name, last_name, email, mobile_number, customer_code, kyc_status, created_at")
    .or(
      `first_name.ilike.%${sanitized}%,last_name.ilike.%${sanitized}%,email.ilike.%${sanitized}%,mobile_number.ilike.%${sanitized}%,customer_code.ilike.%${sanitized}%`
    )
    .limit(20);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getUserFinancialProfile(userId: string) {
  await requireAdmin(); // auth + role check only
  if (!userId) return null as any;

  // Use service-role client so RLS on recipients/transactions doesn't block cross-user reads
  const db = makeServiceRoleClient();

  const [profileRes, transactionsRes, recipientsRes, testimonialsRes] = await Promise.all([
    db.from("profiles").select("*").eq("id", userId).maybeSingle(),
    db
      .from("transactions")
      .select("*, recipient_id, recipients(id, label, full_name, account_name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    db.from("recipients").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    db.from("testimonials").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
  ]);

  const profile = profileRes.data ?? null;
  const transactions = transactionsRes.data ?? [];
  const ownedRecipients = recipientsRes.data ?? [];

  // Also collect any transaction-linked recipients not owned by the user
  const linkedRecipientIds = Array.from(
    new Set(
      transactions
        .map((tx: any) => tx?.recipient_id)
        .filter((id: unknown) => id !== null && id !== undefined && String(id).trim().length > 0)
        .map((id: unknown) => String(id))
    )
  ) as string[];

  let linkedRecipients: any[] = [];
  if (linkedRecipientIds.length > 0) {
    const { data } = await db
      .from("recipients")
      .select("*")
      .in("id", linkedRecipientIds);
    linkedRecipients = data ?? [];
  }

  const recipientsById = new Map<string, any>();
  for (const r of [...ownedRecipients, ...linkedRecipients]) {
    if (r?.id) recipientsById.set(String(r.id), r);
  }
  const recipients = Array.from(recipientsById.values());
  const testimonials = testimonialsRes.data ?? [];

  const approvedTx = transactions.filter((t: any) => t.status === "approved");
  const approvedVolume = approvedTx.reduce((sum: number, t: any) => sum + Number(t.amount_aud ?? 0), 0);
  const approvedCount = approvedTx.length;

  const rateRes = await db.from("rates_history").select("buy_aud, sell_aud").order("date", { ascending: false }).limit(1).maybeSingle();
  const currentRates = {
    buyAUD: rateRes.data?.buy_aud ?? null,
    sellAUD: rateRes.data?.sell_aud ?? null,
  };

  return { profile, transactions, recipients, testimonials, approvedVolume, approvedCount, currentRates };
}

export async function createAssistedCustomerOnboarding(payload: any) {
  const admin = await requireAdmin();
  if (!payload.email?.trim()) return { error: "Email is required." };

  const db = makeServiceRoleClient();

  // ── 1. Create auth user ────────────────────────────────────────────────
  const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-4).toUpperCase();
  const { data: authData, error: authError } = await db.auth.admin.createUser({
    email: payload.email.trim(),
    password: tempPassword,
    email_confirm: true,
  });
  if (authError) return { error: authError.message };
  if (!authData.user) return { error: "Failed to create auth user." };

  const userId = authData.user.id;

  // ── 2. Build complete profile patch ────────────────────────────────────
  const customerCode = payload.customer_code?.trim() || await generateCustomerCode(db);

  const patch: Record<string, unknown> = {
    email:           payload.email.trim(),
    first_name:      payload.first_name?.trim()      || null,
    last_name:       payload.last_name?.trim()        || null,
    mobile_number:   payload.mobile_number?.trim()   || null,
    dob:             payload.dob?.trim()              || null,
    address:         payload.address?.trim()          || null,
    city:            payload.city?.trim()             || null,
    state:           payload.state?.trim()            || null,
    postcode:        payload.postcode?.trim()         || null,
    country:         payload.country?.trim()          || "Australia",
    kyc_status:      payload.kyc_status               || "pending",
    document_type:   payload.document_type?.trim()   || null,
    customer_code:   customerCode,
    // Identity document fields
    license_number:  payload.license_number?.trim()  || null,
    card_number:     payload.card_number?.trim()      || null,
    state_of_issue:  payload.state_of_issue?.trim()  || null,
    passport_number: payload.passport_number?.trim() || null,
    expiry_date:     payload.expiry_date?.trim()      || null,
  };
  if (payload.kyc_status === "approved") {
    patch.kyc_verified_at = new Date().toISOString();
  }

  const { error: profileError } = await db.from("profiles").update(patch).eq("id", userId);
  if (profileError) return { error: profileError.message };

  // ── 3. Create recipient account if provided ────────────────────────────
  let recipientId: string | null = null;
  if (payload.recipient) {
    const r = payload.recipient;
    const { data: recipientData, error: recipientError } = await db
      .from("recipients")
      .insert([{
        user_id:              userId,
        direction:            r.direction            || "aud",
        label:                r.label?.trim()        || null,
        full_name:            r.full_name?.trim()    || null,
        account_name:         r.account_name?.trim() || null,
        bank_name:            r.bank_name?.trim()    || null,
        bsb:                  r.bsb?.trim()          || null,
        account_number:       r.account_number?.trim()       || null,
        residential_address:  r.residential_address?.trim()  || null,
        residential_city:     r.residential_city?.trim()     || null,
        residential_state:    r.residential_state?.trim()    || null,
        residential_postcode: r.residential_postcode?.trim() || null,
        residential_country:  r.residential_country?.trim()  || null,
        recipient_email:      r.recipient_email?.trim()      || null,
        recipient_phone:      r.recipient_phone?.trim()      || null,
        bank_type:            r.bank_type?.trim()   || "other",
        card_number:          r.card_number?.trim() || null,
        shaba_number:         r.shaba_number?.trim()         || null,
        irt_account_number:   r.irt_account_number?.trim()   || null,
        irt_address:          r.irt_address?.trim()          || null,
        irt_city:             r.irt_city?.trim()             || null,
        irt_state:            r.irt_state?.trim()            || null,
        irt_postcode:         r.irt_postcode?.trim()         || null,
        irt_country:          r.irt_country?.trim()          || null,
        irt_phone:            r.irt_phone?.trim()            || null,
      }])
      .select("id")
      .single();
    if (recipientError) return { error: `Recipient creation failed: ${recipientError.message}` };
    recipientId = recipientData?.id ?? null;
  }

  // ── 4. Create initial transaction if requested ─────────────────────────
  let transactionId: string | number | null = null;
  if (payload.transaction?.create && (Number(payload.transaction.amount_aud) > 0 || Number(payload.transaction.equivalent_toman) > 0)) {
    const tx = payload.transaction;
    const referenceCode = await generateAdminReferenceCode(db);
    const txStatus = tx.status || "pending";

    const txInsert: Record<string, unknown> = {
      user_id:              userId,
      type:                 tx.type || "buy_aud",
      amount_aud:           Number(tx.amount_aud) || 0,
      equivalent_toman:     Number(tx.equivalent_toman) || 0,
      applied_rate:         tx.applied_rate ? Number(tx.applied_rate) : null,
      status:               txStatus,
      source_of_funds:      tx.source_of_funds?.trim()      || null,
      reason_for_transfer:  tx.reason_for_transfer?.trim()  || null,
      payment_link:         tx.payment_link?.trim()         || null,
      recipient_id:         recipientId,
      reference_code:       referenceCode,
    };
    if (tx.created_at) {
      const ts = toDbTimestamp(tx.created_at);
      if (ts) txInsert.created_at = ts;
    }

    const { data: txData, error: txError } = await db
      .from("transactions")
      .insert([txInsert])
      .select("id")
      .single();
    if (txError) return { error: `Transaction creation failed: ${txError.message}` };
    transactionId = txData?.id ?? null;

    // ── If status is approved immediately, insert into ledger ──────────
    if (txStatus === "approved" && transactionId) {
      try {
        const rateRes = await db
          .from("rates_history")
          .select("buy_aud, applied_fee, fee_threshold")
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle();

        const audAmt   = Number(tx.amount_aud ?? 0);
        const tomanAmt = Number(tx.equivalent_toman ?? 0);
        const feeThreshold = Number(rateRes.data?.fee_threshold ?? 1000);
        const appliedFee   = Number(rateRes.data?.applied_fee   ?? 30);
        const feeAud = audAmt > 0 && audAmt < feeThreshold ? appliedFee : 0;
        const rate = resolveTradeExecutionRate(
          String(tx.type || "buy_aud") as "buy_aud" | "sell_aud",
          audAmt,
          tomanAmt,
          feeAud,
          Number(tx.applied_rate ?? 0),
        );
        const txDate = new Date();
        const dateGregorian = txDate.toISOString().slice(0, 10);
        const dateJalali    = toJalaliStr(txDate);
        const senderName = `${payload.first_name?.trim() ?? ""} ${payload.last_name?.trim() ?? ""}`.trim() || payload.email.trim();

        await db.from("ledger").insert([{
          transaction_id:  String(transactionId),
          date_gregorian:  dateGregorian,
          date_jalali:     dateJalali,
          type:            tx.type || "buy_aud",
          entry_type:      "trade",
          exchange_rate:   rate,
          amount_aud:      audAmt,
          amount_toman:    tomanAmt,
          sender:          senderName,
          recipient:       "",
          fee_aud:         feeAud,
          payer_account_id:    null,
          receiver_account_id: null,
          created_by:          admin.id,
        }]);
      } catch (_e) { /* ledger insert failure is non-fatal */ }
    }
  }

  await writeAuditLog({
    actorId: admin.id,
    actorEmail: admin.email ?? "",
    action: "ASSISTED_CUSTOMER_CREATED",
    targetType: "profile",
    targetId: userId,
    newValue: { email: payload.email, customer_code: customerCode, recipientId, transactionId },
  }).catch(() => {});

  return { success: true, userId, recipientId, transactionId };
}

export async function createAssistedTransactionForUser(payload: any) {
  const admin = await requireAdmin();
  if (!payload.userId) return { error: "Missing user ID." };
  if (!payload.type || !["buy_aud", "sell_aud"].includes(payload.type)) return { error: "Invalid type." };

  const recipientId = payload.recipient_id || payload.recipientId || null;
  const txStatus = payload.status || "pending";

  const db = makeServiceRoleClient();

  // Always generate a unique reference code for admin-created transactions
  const referenceCode = await generateAdminReferenceCode(db);

  const insertRow: Record<string, unknown> = {
    user_id:             payload.userId,
    type:                payload.type,
    amount_aud:          Number(payload.amount_aud) || 0,
    equivalent_toman:    Number(payload.equivalent_toman) || 0,
    applied_rate:        payload.applied_rate ? Number(payload.applied_rate) : null,
    status:              txStatus,
    source_of_funds:     payload.source_of_funds?.trim()     || null,
    reason_for_transfer: payload.reason_for_transfer?.trim() || null,
    recipient_id:        recipientId,
    payment_link:        payload.payment_link?.trim()        || null,
    reference_code:      referenceCode,
  };

  if (payload.created_at) {
    const createdAt = toDbTimestamp(payload.created_at);
    if (createdAt) insertRow.created_at = createdAt;
  }

  const { data, error } = await db
    .from("transactions")
    .insert([insertRow])
    .select("id")
    .single();

  if (error) return { error: error.message };

  const transactionId = data?.id;

  // ── If created directly as approved, insert a ledger entry ─────────────
  if (txStatus === "approved" && transactionId) {
    try {
      const rateRes = await db
        .from("rates_history")
        .select("buy_aud, applied_fee, fee_threshold")
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();

      const audAmt   = Number(payload.amount_aud ?? 0);
      const tomanAmt = Number(payload.equivalent_toman ?? 0);
      const feeThreshold = Number(rateRes.data?.fee_threshold ?? 1000);
      const appliedFee   = Number(rateRes.data?.applied_fee   ?? 30);
      const feeAud = audAmt > 0 && audAmt < feeThreshold ? appliedFee : 0;
      const rate = resolveTradeExecutionRate(
        String(payload.type || "buy_aud") as "buy_aud" | "sell_aud",
        audAmt,
        tomanAmt,
        feeAud,
        Number(payload.applied_rate ?? 0),
      );

      const txDate = insertRow.created_at ? new Date(insertRow.created_at as string) : new Date();
      const dateGregorian = txDate.toISOString().slice(0, 10);
      const dateJalali    = toJalaliStr(txDate);

      // Fetch sender name from profile
      const { data: profileRow } = await db
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("id", payload.userId)
        .maybeSingle();
      const senderName = profileRow
        ? (`${profileRow.first_name ?? ""} ${profileRow.last_name ?? ""}`).trim() || String(profileRow.email ?? "")
        : "";

      await db.from("ledger").insert([{
        transaction_id:      String(transactionId),
        date_gregorian:      dateGregorian,
        date_jalali:         dateJalali,
        type:                payload.type,
        entry_type:          "trade",
        exchange_rate:       rate,
        amount_aud:          audAmt,
        amount_toman:        tomanAmt,
        sender:              senderName,
        recipient:           "",
        fee_aud:             feeAud,
        payer_account_id:    null,
        receiver_account_id: null,
        created_by:          admin.id,
      }]);
    } catch (_e) { /* ledger insert failure is non-fatal */ }
  }

  await writeAuditLog({
    actorId: admin.id,
    actorEmail: admin.email ?? "",
    action: "ASSISTED_TRANSACTION_CREATED",
    targetType: "transaction",
    targetId: transactionId ? String(transactionId) : null,
    newValue: { userId: payload.userId, type: payload.type, reference_code: referenceCode, status: txStatus },
  }).catch(() => {});

  return { success: true, transactionId };
}

export async function createAssistedRecipientForUser(payload: any) {
  const admin = await requireAdmin();
  if (!payload.userId) return { error: "Missing user ID." };

  const db = makeServiceRoleClient();
  const insertPayload = {
    user_id: payload.userId,
    direction: payload.direction || "aud",
    label: payload.label?.trim() || null,
    full_name: payload.full_name?.trim() || null,
    account_name: payload.account_name?.trim() || null,
    bank_name: payload.bank_name?.trim() || null,
    bsb: payload.bsb?.trim() || null,
    account_number: payload.account_number?.trim() || null,
    residential_address: payload.residential_address?.trim() || null,
    residential_city: payload.residential_city?.trim() || null,
    residential_state: payload.residential_state?.trim() || null,
    residential_postcode: payload.residential_postcode?.trim() || null,
    residential_country: payload.residential_country?.trim() || null,
    recipient_email: payload.recipient_email?.trim() || null,
    recipient_phone: payload.recipient_phone?.trim() || null,
    bank_type: payload.bank_type?.trim() || null,
    card_number: payload.card_number?.trim() || null,
    shaba_number: payload.shaba_number?.trim() || null,
    irt_account_number: payload.irt_account_number?.trim() || null,
    irt_address: payload.irt_address?.trim() || null,
    irt_city: payload.irt_city?.trim() || null,
    irt_state: payload.irt_state?.trim() || null,
    irt_postcode: payload.irt_postcode?.trim() || null,
    irt_country: payload.irt_country?.trim() || null,
    irt_phone: payload.irt_phone?.trim() || null,
  };

  const { data, error } = await db
    .from("recipients")
    .insert([insertPayload])
    .select("id")
    .single();

  if (error) return { error: error.message };

  await writeAuditLog({
    actorId: admin.id,
    actorEmail: admin.email ?? "",
    action: "ASSISTED_RECIPIENT_CREATED",
    targetType: "recipient",
    targetId: data?.id ? String(data.id) : null,
    newValue: { userId: payload.userId, direction: insertPayload.direction, label: insertPayload.label },
  }).catch(() => {});

  return { success: true, recipientId: data?.id };
}

export async function updateAssistedRecipientForUser(payload: any) {
  const admin = await requireAdmin();
  const recipientId = payload.id || payload.recipientId;
  if (!recipientId) return { error: "Missing recipient ID." };

  const db = makeServiceRoleClient();
  const { data: before } = await db.from("recipients").select("*").eq("id", recipientId).maybeSingle();

  const patch: Record<string, unknown> = {};
  if (payload.direction !== undefined) patch.direction = payload.direction;
  if (payload.label !== undefined) patch.label = payload.label?.trim() || null;
  if (payload.full_name !== undefined) patch.full_name = payload.full_name?.trim() || null;
  if (payload.account_name !== undefined) patch.account_name = payload.account_name?.trim() || null;
  if (payload.bank_name !== undefined) patch.bank_name = payload.bank_name?.trim() || null;
  if (payload.bsb !== undefined) patch.bsb = payload.bsb?.trim() || null;
  if (payload.account_number !== undefined) patch.account_number = payload.account_number?.trim() || null;
  if (payload.residential_address !== undefined) patch.residential_address = payload.residential_address?.trim() || null;
  if (payload.residential_city !== undefined) patch.residential_city = payload.residential_city?.trim() || null;
  if (payload.residential_state !== undefined) patch.residential_state = payload.residential_state?.trim() || null;
  if (payload.residential_postcode !== undefined) patch.residential_postcode = payload.residential_postcode?.trim() || null;
  if (payload.residential_country !== undefined) patch.residential_country = payload.residential_country?.trim() || null;
  if (payload.recipient_email !== undefined) patch.recipient_email = payload.recipient_email?.trim() || null;
  if (payload.recipient_phone !== undefined) patch.recipient_phone = payload.recipient_phone?.trim() || null;
  if (payload.bank_type !== undefined) patch.bank_type = payload.bank_type?.trim() || null;
  if (payload.card_number !== undefined) patch.card_number = payload.card_number?.trim() || null;
  if (payload.shaba_number !== undefined) patch.shaba_number = payload.shaba_number?.trim() || null;
  if (payload.irt_account_number !== undefined) patch.irt_account_number = payload.irt_account_number?.trim() || null;
  if (payload.irt_address !== undefined) patch.irt_address = payload.irt_address?.trim() || null;
  if (payload.irt_city !== undefined) patch.irt_city = payload.irt_city?.trim() || null;
  if (payload.irt_state !== undefined) patch.irt_state = payload.irt_state?.trim() || null;
  if (payload.irt_postcode !== undefined) patch.irt_postcode = payload.irt_postcode?.trim() || null;
  if (payload.irt_country !== undefined) patch.irt_country = payload.irt_country?.trim() || null;
  if (payload.irt_phone !== undefined) patch.irt_phone = payload.irt_phone?.trim() || null;

  if (Object.keys(patch).length === 0) return { success: true };

  const { error } = await db.from("recipients").update(patch).eq("id", recipientId);
  if (error) return { error: error.message };

  await writeAuditLog({
    actorId: admin.id,
    actorEmail: admin.email ?? "",
    action: "ASSISTED_RECIPIENT_UPDATED",
    targetType: "recipient",
    targetId: String(recipientId),
    oldValue: before ?? null,
    newValue: patch,
  }).catch(() => {});

  return { success: true };
}

export async function updateTransactionReferenceCode(transactionId: string | number, newCode: string) {
  await requireAdmin();
  if (!transactionId) return { error: "Missing transaction ID." };

  const db = makeServiceRoleClient();
  const { error } = await db
    .from("transactions")
    .update({ reference_code: newCode.trim() || null })
    .eq("id", transactionId);
  if (error) return { error: error.message };
  return { success: true };
}

export async function updateCustomerCode(userId: string, newCode: string) {
  const admin = await requireAdmin();
  if (!userId) return { error: "Missing user ID." };

  const db = makeServiceRoleClient();
  const { error } = await db
    .from("profiles")
    .update({ customer_code: newCode.trim() || null })
    .eq("id", userId);
  if (error) return { error: error.message };

  await writeAuditLog({
    actorId: admin.id,
    actorEmail: admin.email ?? "",
    action: "CUSTOMER_CODE_UPDATED",
    targetType: "profile",
    targetId: userId,
    newValue: { customer_code: newCode.trim() },
  }).catch(() => {});

  return { success: true };
}

export async function updateTransactionAmount(transactionId: string | number, field: string, newValue: number) {
  await requireAdmin();
  if (!transactionId) return { error: "Missing transaction ID." };
  const allowedFields = ["amount_aud", "equivalent_toman"];
  if (!allowedFields.includes(field)) return { error: "Invalid field." };
  if (!Number.isFinite(newValue) || newValue < 0) return { error: "Invalid value." };

  const db = makeServiceRoleClient();
  const { error } = await db
    .from("transactions")
    .update({ [field]: newValue })
    .eq("id", transactionId);
  if (error) return { error: error.message };
  return { success: true };
}

export async function updateAssistedTransactionForUser(payload: any) {
  const admin = await requireAdmin();
  const transactionId = payload.id || payload.transactionId;
  if (!transactionId) return { error: "Missing transaction ID." };

  const db = makeServiceRoleClient();

  // Fetch current state before update to detect status change to approved
  const { data: before } = await db
    .from("transactions")
    .select("status, type, amount_aud, equivalent_toman, applied_rate, created_at, user_id")
    .eq("id", transactionId)
    .maybeSingle();

  const patch: Record<string, unknown> = {};
  if (payload.type !== undefined && ["buy_aud", "sell_aud"].includes(payload.type)) {
    patch.type = payload.type;
  }
  if (payload.amount_aud !== undefined) patch.amount_aud = Number(payload.amount_aud);
  if (payload.equivalent_toman !== undefined) patch.equivalent_toman = Number(payload.equivalent_toman);
  if (payload.status !== undefined) patch.status = payload.status;
  if (payload.reference_code !== undefined) patch.reference_code = payload.reference_code?.trim() || null;
  if (payload.source_of_funds !== undefined) patch.source_of_funds = payload.source_of_funds?.trim() || null;
  if (payload.reason_for_transfer !== undefined) patch.reason_for_transfer = payload.reason_for_transfer?.trim() || null;
  if (payload.payment_link !== undefined) patch.payment_link = payload.payment_link?.trim() || null;
  if (payload.recipient_id !== undefined || payload.recipientId !== undefined) {
    patch.recipient_id = (payload.recipient_id ?? payload.recipientId) || null;
  }
  if (payload.created_at !== undefined) {
    const createdAt = toDbTimestamp(payload.created_at);
    if (createdAt) patch.created_at = createdAt;
  }

  if (Object.keys(patch).length === 0) return { success: true };

  const { error } = await db.from("transactions").update(patch).eq("id", transactionId);
  if (error) return { error: error.message };

  // ── If status is being changed to approved and wasn't before, stamp approved_at + insert ledger ──
  const wasNotApproved = before?.status !== "approved";
  const isNowApproved  = payload.status === "approved";

  if (wasNotApproved && isNowApproved) {
    await db.from("transactions").update({ approved_at: new Date().toISOString() }).eq("id", transactionId);
  }

  if (wasNotApproved && isNowApproved) {
    try {
      // Guard: don't double-insert if a ledger row already references this tx
      const { data: existingLedger } = await db
        .from("ledger")
        .select("id")
        .eq("transaction_id", String(transactionId))
        .maybeSingle();

      if (!existingLedger) {
        const rateRes = await db
          .from("rates_history")
          .select("buy_aud, applied_fee, fee_threshold")
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle();

        const audAmt   = Number(patch.amount_aud   ?? before?.amount_aud   ?? 0);
        const tomanAmt = Number(patch.equivalent_toman ?? before?.equivalent_toman ?? 0);
        const txType   = String(patch.type   ?? before?.type   ?? "buy_aud");
        const userId   = String(before?.user_id ?? "");
        const feeThreshold = Number(rateRes.data?.fee_threshold ?? 1000);
        const appliedFee   = Number(rateRes.data?.applied_fee   ?? 30);
        const feeAud = audAmt > 0 && audAmt < feeThreshold ? appliedFee : 0;
        const rate = resolveTradeExecutionRate(
          txType as "buy_aud" | "sell_aud",
          audAmt,
          tomanAmt,
          feeAud,
          Number(patch.applied_rate ?? before?.applied_rate ?? 0),
        );

        const rawDate   = patch.created_at ?? before?.created_at;
        const txDate    = rawDate ? new Date(rawDate as string) : new Date();
        const dateGreg  = txDate.toISOString().slice(0, 10);
        const dateJalali = toJalaliStr(txDate);

        const { data: profileRow } = await db
          .from("profiles")
          .select("first_name, last_name, email")
          .eq("id", userId)
          .maybeSingle();
        const senderName = profileRow
          ? (`${profileRow.first_name ?? ""} ${profileRow.last_name ?? ""}`).trim() || String(profileRow.email ?? "")
          : "";

        await db.from("ledger").insert([{
          transaction_id:      String(transactionId),
          date_gregorian:      dateGreg,
          date_jalali:         dateJalali,
          type:                txType,
          entry_type:          "trade",
          exchange_rate:       rate,
          amount_aud:          audAmt,
          amount_toman:        tomanAmt,
          sender:              senderName,
          recipient:           "",
          fee_aud:             feeAud,
          payer_account_id:    null,
          receiver_account_id: null,
          created_by:          admin.id,
        }]);
      }
    } catch (_e) { /* non-fatal */ }
  }

  return { success: true };
}

export async function deleteAssistedTransactionForUser(payload: any) {
  const admin = await requireAdmin();
  const transactionId = payload.id || payload.transactionId;
  if (!transactionId) return { error: "Missing transaction ID." };

  const db = makeServiceRoleClient();
  const { data: before } = await db.from("transactions").select("user_id, type, amount_aud").eq("id", transactionId).maybeSingle();

  const { error } = await db.from("transactions").delete().eq("id", transactionId);
  if (error) return { error: error.message };

  await writeAuditLog({
    actorId: admin.id,
    actorEmail: admin.email ?? "",
    action: "ASSISTED_TRANSACTION_DELETED",
    targetType: "transaction",
    targetId: String(transactionId),
    oldValue: before,
  }).catch(() => {});

  return { success: true };
}

export async function getPromoCodes() {
  const db = await getAuthorizedServerClient();
  const { data, error } = await db.from("promo_codes").select("*").order("created_at", { ascending: false });
  if (error) {
    // Table may not exist yet — return empty gracefully
    console.warn("getPromoCodes:", error.message);
    return [];
  }
  return data ?? [];
}

export async function createPromoCode(payload: any) {
  const admin = await requireAdmin();
  if (!payload.code?.trim()) return { error: "Code is required." };

  const db = makeServiceRoleClient();
  const { error } = await db.from("promo_codes").insert([{
    code: payload.code.trim().toUpperCase(),
    discount_pct: Number(payload.discount_pct) || 0,
    max_uses: payload.max_uses ? Number(payload.max_uses) : null,
    expires_at: payload.expires_at || null,
    active: payload.active ?? true,
  }]);
  if (error) return { error: error.message };
  return { success: true };
}

export async function updatePromoCode(id: string, payload: any) {
  await requireAdmin();
  if (!id) return { error: "Missing ID." };

  const db = makeServiceRoleClient();
  const patch: Record<string, unknown> = {};
  if (payload.discount_pct !== undefined) patch.discount_pct = Number(payload.discount_pct);
  if (payload.max_uses !== undefined) patch.max_uses = payload.max_uses ? Number(payload.max_uses) : null;
  if (payload.expires_at !== undefined) patch.expires_at = payload.expires_at || null;
  if (payload.active !== undefined) patch.active = Boolean(payload.active);

  const { error } = await db.from("promo_codes").update(patch).eq("id", id);
  if (error) return { error: error.message };
  return { success: true };
}

export async function deletePromoCode(id: string) {
  const admin = await requireAdmin();
  if (!id) return { error: "Missing ID." };

  const db = makeServiceRoleClient();
  const { error } = await db.from("promo_codes").delete().eq("id", id);
  if (error) return { error: error.message };

  await writeAuditLog({
    actorId: admin.id,
    actorEmail: admin.email ?? "",
    action: "PROMO_CODE_DELETED",
    targetType: "promo_code",
    targetId: id,
  }).catch(() => {});

  return { success: true };
}

export async function getPendingTransactionsWithDetails() {
  await requireAdmin(); // auth + role check only
  const db = makeServiceRoleClient(); // service role bypasses RLS on recipients
  const { data, error } = await db
    .from("transactions")
    .select(`
      id, user_id, recipient_id, type, amount_aud, equivalent_toman, status, created_at,
      reference_code, payment_link, reason_for_transfer, receipt_sent,
      profiles(first_name, last_name, email, customer_code),
      recipients(label, full_name, account_name, bank_name, bsb, account_number,
                 card_number, shaba_number, bank_type, direction)
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const missingRecipientIds = Array.from(
    new Set(
      rows
        .filter((tx: any) => !tx.recipients && tx.recipient_id)
        .map((tx: any) => String(tx.recipient_id))
    )
  );

  if (missingRecipientIds.length === 0) return rows;

  const { data: fallbackRecipients } = await db
    .from("recipients")
    .select("id, label, full_name, account_name, bank_name, bsb, account_number, card_number, shaba_number, bank_type, direction")
    .in("id", missingRecipientIds);

  const recipientById = new Map((fallbackRecipients ?? []).map((r: any) => [String(r.id), r]));
  return rows.map((tx: any) => {
    if (tx.recipients || !tx.recipient_id) return tx;
    return { ...tx, recipients: recipientById.get(String(tx.recipient_id)) ?? null };
  });
}

export async function getActiveBankAccountsForAdmin() {
  await requireAdmin();
  const db = makeServiceRoleClient();

  const { data, error } = await db
    .from("bank_accounts")
    .select("id, account_name, currency, is_active")
    .eq("is_active", true)
    .order("account_name", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

type TransactionHistoryFilters = {
  status?: "all" | "approved" | "rejected" | "archived";
  startDate?: string;
  endDate?: string;
  direction?: "all" | "incoming" | "outgoing";
};

export async function getTransactionHistoryWithDetails(
  page = 1,
  pageSize = 10,
  filters: TransactionHistoryFilters = {},
) {
  await requireAdmin(); // auth + role check only
  const db = makeServiceRoleClient(); // service role bypasses RLS on recipients
  const safePage = clampInt(page, 1, MAX_AUDIT_PAGE, 1);
  const safePageSize = clampInt(pageSize, 1, 50, 10);
  const offset = (safePage - 1) * safePageSize;

  const specificStatus = filters.status && filters.status !== "all" ? filters.status : null;

  const countBaseQuery = db.from("transactions").select("id", { count: "exact", head: true });
  const dataBaseQuery = db
    .from("transactions")
    .select(`
      id, user_id, recipient_id, type, amount_aud, equivalent_toman, status, created_at,
      reference_code, payment_link, reason_for_transfer, receipt_sent,
      profiles(first_name, last_name, email, customer_code),
      recipients(label, full_name, account_name, bank_name, bsb, account_number,
                 card_number, shaba_number, bank_type, direction)
    `);

  let countQuery = specificStatus
    ? countBaseQuery.eq("status", specificStatus)
    : countBaseQuery.neq("status", "pending");

  let dataQuery = specificStatus
    ? dataBaseQuery.eq("status", specificStatus)
    : dataBaseQuery.neq("status", "pending");

  if (filters.startDate) {
    countQuery = countQuery.gte("created_at", `${filters.startDate}T00:00:00.000Z`);
    dataQuery = dataQuery.gte("created_at", `${filters.startDate}T00:00:00.000Z`);
  }
  if (filters.endDate) {
    countQuery = countQuery.lte("created_at", `${filters.endDate}T23:59:59.999Z`);
    dataQuery = dataQuery.lte("created_at", `${filters.endDate}T23:59:59.999Z`);
  }
  if (filters.direction === "incoming" || filters.direction === "outgoing") {
    // buy_aud = Zarman buys AUD from customer → AUD exits Australia → AUSTRAC outgoing
    // sell_aud = Zarman sells AUD to customer → AUD enters Australia → AUSTRAC incoming
    const transactionType = filters.direction === "outgoing" ? "buy_aud" : "sell_aud";
    countQuery = countQuery.eq("type", transactionType);
    dataQuery = dataQuery.eq("type", transactionType);
  }

  const [countRes, dataRes] = await Promise.all([
    countQuery,
    dataQuery.order("created_at", { ascending: false }).range(offset, offset + safePageSize - 1),
  ]);
  if (dataRes.error) throw new Error(dataRes.error.message);

  const rows = dataRes.data ?? [];
  const missingRecipientIds = Array.from(
    new Set(
      rows
        .filter((tx: any) => !tx.recipients && tx.recipient_id)
        .map((tx: any) => String(tx.recipient_id))
    )
  );

  if (missingRecipientIds.length === 0) {
    return { data: rows, total: countRes.count ?? 0 };
  }

  const { data: fallbackRecipients } = await db
    .from("recipients")
    .select("id, label, full_name, account_name, bank_name, bsb, account_number, card_number, shaba_number, bank_type, direction")
    .in("id", missingRecipientIds);

  const recipientById = new Map((fallbackRecipients ?? []).map((r: any) => [String(r.id), r]));
  const enrichedRows = rows.map((tx: any) => {
    if (tx.recipients || !tx.recipient_id) return tx;
    return { ...tx, recipients: recipientById.get(String(tx.recipient_id)) ?? null };
  });

  return { data: enrichedRows, total: countRes.count ?? 0 };
}

export async function bulkDeleteTransactions(transactionIds: string[]) {
  const admin = await requireAdmin();
  const uniqueIds = Array.from(new Set(transactionIds));
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (uniqueIds.length === 0) return { error: "Select at least one transaction." };
  if (uniqueIds.length > 100) return { error: "A maximum of 100 transactions can be deleted at once." };
  if (uniqueIds.some((id) => !uuidPattern.test(id))) return { error: "One or more transaction IDs are invalid." };

  const db = makeServiceRoleClient();
  const { data: transactions, error: fetchError } = await db
    .from("transactions")
    .select("id, user_id, type, status, amount_aud, reference_code, created_at")
    .in("id", uniqueIds);

  if (fetchError) return { error: fetchError.message };
  if ((transactions ?? []).length !== uniqueIds.length) return { error: "One or more transactions no longer exist." };

  const invalid = (transactions ?? []).filter((transaction) => !["rejected", "archived"].includes(transaction.status ?? ""));
  if (invalid.length > 0) return { error: "Only rejected or archived transactions can be deleted." };

  const { error: deleteError } = await db.from("transactions").delete().in("id", uniqueIds);
  if (deleteError) return { error: deleteError.message };

  await writeAuditLog({
    actorId: admin.id,
    actorEmail: admin.email ?? "",
    action: "TRANSACTIONS_BULK_DELETED",
    targetType: "transaction_batch",
    targetId: null,
    oldValue: transactions,
    newValue: { deletedCount: uniqueIds.length, transactionIds: uniqueIds },
  }).catch(() => {});

  return { success: true, deletedCount: uniqueIds.length };
}

export async function getTransactionHistoryStatusCounts() {
  await requireAdmin();
  const db = makeServiceRoleClient();

  const [approvedRes, rejectedRes, archivedRes] = await Promise.all([
    db.from("transactions").select("id", { count: "exact", head: true }).eq("status", "approved"),
    db.from("transactions").select("id", { count: "exact", head: true }).eq("status", "rejected"),
    db.from("transactions").select("id", { count: "exact", head: true }).eq("status", "archived"),
  ]);

  const approved = approvedRes.count ?? 0;
  const rejected = rejectedRes.count ?? 0;
  const archived = archivedRes.count ?? 0;

  return {
    all: approved + rejected + archived,
    approved,
    rejected,
    archived,
  };
}

// ===========================================================================
// LEDGER — all approved transactions for P&L tracking (MULTI-POCKET EDITION)
// ===========================================================================
export async function getLedgerData(
  page = 1,
  pageSize = 20,
  filters: { start?: string; end?: string; type?: string; search?: string; account?: string } = {},
) {
  const ssrClient = await createSupabaseServerActionClient();
  await requireAdmin(ssrClient);
  const db = makeServiceRoleClient();

  const safePage = clampInt(page, 1, MAX_AUDIT_PAGE, 1);
  const safeSize = clampInt(pageSize, 1, 100, 20);
  const offset   = (safePage - 1) * safeSize;

  let countQuery = db.from("ledger").select("id", { count: "exact", head: true });
  let pageQuery = db
    .from("ledger")
      .select(`
        id, transaction_id, date_gregorian, date_jalali, type, entry_type, 
        exchange_rate, amount_aud, amount_toman, sender, recipient, fee_aud, 
        notes, created_at, payer_account_id, receiver_account_id
      `);

  let exportQuery = db
    .from("ledger")
      .select(`
        id, transaction_id, date_gregorian, date_jalali, type, entry_type, 
        exchange_rate, amount_aud, amount_toman, sender, recipient, fee_aud, 
        notes, created_at, payer_account_id, receiver_account_id
      `);

  const validDate = /^\d{4}-\d{2}-\d{2}$/;
  if (filters.start && validDate.test(filters.start)) {
    countQuery = countQuery.gte("date_gregorian", filters.start);
    pageQuery = pageQuery.gte("date_gregorian", filters.start);
    exportQuery = exportQuery.gte("date_gregorian", filters.start);
  }
  if (filters.end && validDate.test(filters.end)) {
    countQuery = countQuery.lte("date_gregorian", filters.end);
    pageQuery = pageQuery.lte("date_gregorian", filters.end);
    exportQuery = exportQuery.lte("date_gregorian", filters.end);
  }
  if (filters.type === "transfer") {
    countQuery = countQuery.eq("entry_type", "transfer");
    pageQuery = pageQuery.eq("entry_type", "transfer");
    exportQuery = exportQuery.eq("entry_type", "transfer");
  } else if (filters.type === "buy_aud" || filters.type === "sell_aud") {
    countQuery = countQuery.eq("type", filters.type).or("entry_type.eq.trade,entry_type.is.null");
    pageQuery = pageQuery.eq("type", filters.type).or("entry_type.eq.trade,entry_type.is.null");
    exportQuery = exportQuery.eq("type", filters.type).or("entry_type.eq.trade,entry_type.is.null");
  } else if (["expense", "owner_loan", "adjustment"].includes(filters.type ?? "")) {
    countQuery = countQuery.eq("entry_type", filters.type!);
    pageQuery = pageQuery.eq("entry_type", filters.type!);
    exportQuery = exportQuery.eq("entry_type", filters.type!);
  }

  if (filters.account) {
    const accountExpr = `payer_account_id.eq.${filters.account},receiver_account_id.eq.${filters.account}`;
    countQuery = countQuery.or(accountExpr);
    pageQuery = pageQuery.or(accountExpr);
    exportQuery = exportQuery.or(accountExpr);
  }

  const search = sanitizeSearchQuery(filters.search ?? "");
  if (search) {
    const expression = `sender.ilike.%${search}%,recipient.ilike.%${search}%`;
    countQuery = countQuery.or(expression);
    pageQuery = pageQuery.or(expression);
    exportQuery = exportQuery.or(expression);
  }

  const [countRes, pageRes, exportRes, rateRes] = await Promise.all([
    countQuery,
    pageQuery
      .order("date_gregorian", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + safeSize - 1),
    exportQuery
      .order("date_gregorian", { ascending: false })
      .order("created_at", { ascending: false }),
    // Current market rate
    db
      .from("rates_history")
      .select("buy_aud")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (countRes.error) throw new Error(countRes.error.message);
  if (pageRes.error) throw new Error(pageRes.error.message);
  if (exportRes.error) throw new Error(exportRes.error.message);

  return {
    allLedgerRows:  exportRes.data ?? [],
    pageLedgerRows: pageRes.data ?? [],
    total:          countRes.count ?? 0,
    currentBuyRate: Number(rateRes.data?.buy_aud ?? 0),
  };
}

// ===========================================================================
// LEDGER: Update any field in a ledger row
// ===========================================================================
// ===========================================================================
// LEDGER: Update any field in a ledger row
// ===========================================================================
export async function updateLedgerEntry(
  id: string,
  updates: {
    date_gregorian?: string;
    type?: "buy_aud" | "sell_aud" | "transfer"; // 🌟 پشتیبانی از نوع انتقال
    entry_type?: string;
    exchange_rate?: number;
    amount_aud?: number;
    amount_toman?: number;
    sender?: string;
    recipient?: string;
    fee_aud?: number;
    payer_account_id?: string | null;
    receiver_account_id?: string | null;
    notes?: string;
  }
): Promise<{ success: true } | { error: string }> {
  const admin = await requireAdmin();
  if (!id) return { error: "Missing ledger entry ID." };

  const allowedEntryTypes = new Set(["trade", "transfer", "expense", "owner_loan", "adjustment"]);
  if (updates.entry_type !== undefined && !allowedEntryTypes.has(updates.entry_type)) {
    return { error: "Invalid ledger entry type." };
  }

  const db = makeServiceRoleClient();
  const { data: before, error: beforeError } = await db
    .from("ledger")
    .select("date_gregorian, type, entry_type, exchange_rate, amount_aud, amount_toman, sender, recipient, fee_aud, payer_account_id, receiver_account_id, notes")
    .eq("id", id)
    .maybeSingle();
  if (beforeError) return { error: beforeError.message };
  if (!before) return { error: "Ledger entry not found." };

  const patch: Record<string, unknown> = {};

  if (updates.date_gregorian !== undefined) {
    const d = new Date(updates.date_gregorian);
    if (isNaN(d.getTime())) return { error: "Invalid date." };
    patch.date_gregorian = updates.date_gregorian;
    patch.date_jalali    = toJalaliStr(d);
  }
  
  if (updates.type !== undefined) {
    if (!["buy_aud", "sell_aud", "transfer"].includes(updates.type)) return { error: "Invalid type." };
    // برای جلوگیری از خطای دیتابیس، نوع ترانسفر را به صورت ساختاری تطبیق می‌دهیم
    patch.type = updates.type === "transfer" ? "buy_aud" : updates.type;
    patch.entry_type = updates.type === "transfer" ? "transfer" : "trade";
  }
  
  if (updates.entry_type !== undefined) patch.entry_type = updates.entry_type;
  if (updates.exchange_rate !== undefined) patch.exchange_rate = updates.exchange_rate;
  if (updates.amount_aud !== undefined) patch.amount_aud = updates.amount_aud;
  if (updates.amount_toman !== undefined) patch.amount_toman = updates.amount_toman;
  
  if (updates.sender !== undefined) patch.sender = updates.sender.trim();
  if (updates.recipient !== undefined) patch.recipient = updates.recipient.trim();
  if (updates.fee_aud !== undefined) patch.fee_aud = updates.fee_aud;
  
  if (updates.payer_account_id !== undefined) patch.payer_account_id = updates.payer_account_id;
  if (updates.receiver_account_id !== undefined) patch.receiver_account_id = updates.receiver_account_id;
  if (updates.notes !== undefined) patch.notes = updates.notes.trim() || null;

  if (Object.keys(patch).length === 0) return { success: true };

  const merged = { ...before, ...patch };
  const entryType = String(merged.entry_type ?? "trade");
  const amountAud = Number(merged.amount_aud ?? 0);
  const amountToman = Number(merged.amount_toman ?? 0);
  const feeAud = Number(merged.fee_aud ?? 0);
  if (!Number.isFinite(amountAud) || amountAud < 0 || !Number.isFinite(amountToman) || amountToman < 0) {
    return { error: "Ledger amounts must be valid non-negative numbers." };
  }
  if (!Number.isFinite(feeAud) || feeAud < 0) return { error: "Invalid fee amount." };
  if (entryType === "trade" && (amountAud <= 0 || amountToman <= 0)) {
    return { error: "Trades require both AUD and IRT amounts." };
  }
  if (entryType === "transfer") {
    const payerId = merged.payer_account_id ? String(merged.payer_account_id) : null;
    const receiverId = merged.receiver_account_id ? String(merged.receiver_account_id) : null;
    if (!payerId || !receiverId || payerId === receiverId) {
      return { error: "Transfers require two distinct accounts." };
    }
    const { data: accounts, error: accountError } = await db
      .from("bank_accounts")
      .select("id, currency")
      .in("id", [payerId, receiverId]);
    if (accountError) return { error: accountError.message };
    if ((accounts ?? []).length !== 2 || accounts?.[0]?.currency !== accounts?.[1]?.currency) {
      return { error: "Transfers require accounts with the same currency." };
    }
  }

  const { error } = await db.from("ledger").update(patch).eq("id", id);
  if (error) return { error: error.message };

  await writeAuditLog({
    actorId: admin.id,
    actorEmail: admin.email ?? "",
    action: "LEDGER_ENTRY_UPDATED",
    targetType: "ledger",
    targetId: id,
    oldValue: before,
    newValue: merged,
  });

  return { success: true };
}

// ===========================================================================
// LEDGER: Add a manual ledger entry
// ===========================================================================
export async function addManualLedgerEntry({
  type, amountAud, amountToman, exchangeRate, sender, recipient, feeAud, dateGregorian, notes, 
  payer_account_id, receiver_account_id, entry_type
}: {
  type: "buy_aud" | "sell_aud" | "transfer"; // 🌟 پشتیبانی از نوع انتقال
  amountAud: number;
  amountToman: number;
  exchangeRate?: number;
  sender?: string;
  recipient?: string;
  feeAud?: number;
  dateGregorian?: string;
  notes?: string;
  payer_account_id?: string | null;
  receiver_account_id?: string | null;
  entry_type?: "trade" | "expense" | "owner_loan" | "adjustment" | "transfer";
}): Promise<{ success: true } | { error: string }> {
  const admin = await requireAdmin();
  
  if (!["buy_aud", "sell_aud", "transfer"].includes(type)) return { error: "Invalid type." };
  
  // 🌟 کلید حل مشکل: تبدیل <= 0 به < 0 تا اجازه دهد مبالغ صفر برای انتقال ثبت شوند
  if (!Number.isFinite(amountAud)   || amountAud   < 0) return { error: "Invalid AUD amount." };
  if (!Number.isFinite(amountToman) || amountToman < 0) return { error: "Invalid Toman amount." };
  if (amountAud === 0 && amountToman === 0) return { error: "حداقل یکی از مبالغ باید بیشتر از صفر باشد." };
  if (type !== "transfer" && (amountAud <= 0 || amountToman <= 0)) {
    return { error: "Trades require both AUD and IRT amounts." };
  }

  const txDate  = dateGregorian ? new Date(dateGregorian + "T00:00:00.000Z") : new Date();
  const dateGre = txDate.toISOString().slice(0, 10);
  const dateJal = toJalaliStr(txDate);
  const rate    = exchangeRate ?? (amountAud > 0 ? amountToman / amountAud : 0);

  const dbType = type === "transfer" ? "buy_aud" : type;

  const db = makeServiceRoleClient();
  if (type === "transfer") {
    if (!payer_account_id || !receiver_account_id || payer_account_id === receiver_account_id) {
      return { error: "Transfers require two distinct accounts." };
    }
    const { data: accounts, error: accountError } = await db
      .from("bank_accounts")
      .select("id, currency")
      .in("id", [payer_account_id, receiver_account_id]);
    if (accountError) return { error: accountError.message };
    if ((accounts ?? []).length !== 2 || accounts?.[0]?.currency !== accounts?.[1]?.currency) {
      return { error: "Transfers require accounts with the same currency." };
    }
  }

  const insertRow = {
    transaction_id:      null,
    date_gregorian:      dateGre,
    date_jalali:         dateJal,
    type:                dbType,
    entry_type:          entry_type || (type === "transfer" ? "transfer" : "trade"),
    exchange_rate:       rate,
    amount_aud:          amountAud,
    amount_toman:        amountToman,
    sender:              sender?.trim()    ?? "",
    recipient:           recipient?.trim() ?? "",
    fee_aud:             feeAud ?? 0,
    payer_account_id:    payer_account_id || null,
    receiver_account_id: receiver_account_id || null,
    notes:               notes?.trim() || null,
    created_by:          admin.id,
  };
  const { data: inserted, error } = await db.from("ledger").insert([insertRow]).select("id").single();

  if (error) return { error: error.message };
  await writeAuditLog({
    actorId: admin.id,
    actorEmail: admin.email ?? "",
    action: "LEDGER_ENTRY_ADDED",
    targetType: "ledger",
    targetId: inserted?.id ? String(inserted.id) : null,
    newValue: insertRow,
  });
  return { success: true };
}


export async function deleteLedgerEntry(id: string): Promise<{ success: true } | { error: string }> {
  const admin = await requireAdmin();
  if (!id) return { error: "Missing ledger entry ID." };

  const db = makeServiceRoleClient();
  const { data: before, error: beforeError } = await db.from("ledger").select("*").eq("id", id).maybeSingle();
  if (beforeError) return { error: beforeError.message };
  if (!before) return { error: "Ledger entry not found." };
  const { error } = await db.from("ledger").delete().eq("id", id);
  if (error) return { error: error.message };

  await writeAuditLog({
    actorId: admin.id,
    actorEmail: admin.email ?? "",
    action: "LEDGER_ENTRY_DELETED",
    targetType: "ledger",
    targetId: id,
    oldValue: before,
  });

  return { success: true };
}
