"use server";

import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerActionClient } from "@/lib/supabase-server";
import { revalidateTag } from "next/cache";
import { getRatesSnapshot } from "@/lib/rates";

const AUDIT_LOG_RETRY_COUNT = 2;
const DEFAULT_HISTORY_LIMIT = 50;
const MAX_HISTORY_LIMIT = 200;
const DEFAULT_AUDIT_PAGE_SIZE = 50;
const MAX_AUDIT_PAGE_SIZE = 100;
const MAX_AUDIT_PAGE = 10_000;
const MAX_SEARCH_QUERY_LENGTH = 64;
const PRIVILEGED_ROLES = new Set(["admin", "supabase_admin", "service_role"]);

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

function sanitizeSearchQuery(query: string) {
  return query
    .trim()
    .slice(0, MAX_SEARCH_QUERY_LENGTH)
    .replace(/[%_,()]/g, " ")
    .replace(/\s+/g, " ");
}

function isPrivilegedRole(role: unknown): role is string {
  return typeof role === "string" && PRIVILEGED_ROLES.has(role);
}

// ---------------------------------------------------------------------------
// requireAdmin — validates every sensitive admin action.
// Returns the admin user or throws. Always call this first in every action.
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

  // Defense-in-depth: prove this session can access an admin-only RLS resource.
  // If JWT role and DB policy drift, fail closed.
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
// so it bypasses RLS (audit_logs INSERT policy denies non-service writes).
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

// پارامتر limitCount با مقدار پیش‌فرض 50 اضافه شد
export async function getKycHistory(limitCount: number = DEFAULT_HISTORY_LIMIT) {
  const db = await getAuthorizedServerClient();
  const safeLimit = clampInt(limitCount, 1, MAX_HISTORY_LIMIT, DEFAULT_HISTORY_LIMIT);

  const { data, error } = await db
    .from("profiles")
    .select("id, first_name, last_name, email, kyc_status, document_type, created_at")
    // در اینجا هر وضعیتی به جز در حال انتظارها را می‌گیریم
    .neq("kyc_status", "pending")
    .neq("kyc_status", "under_review")
    .order("created_at", { ascending: false })
    .limit(safeLimit); // اعمال محدودیت روی دیتابیس

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function approveKyc(userId: string) {
  const admin = await requireAdmin();
  if (!userId) return { error: "Missing user ID." };

  const db = makeServiceRoleClient();

  // Fetch current status for audit trail
  const { data: before } = await db
    .from("profiles")
    .select("kyc_status")
    .eq("id", userId)
    .single();

  const { error } = await db
    .from("profiles")
    .update({ kyc_status: "approved", kyc_verified_at: new Date().toISOString() })
    .eq("id", userId);

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
    return {
      error:
        auditError instanceof Error
          ? `KYC approved but audit logging failed: ${auditError.message}`
          : "KYC approved but audit logging failed.",
    };
  }

  return { success: true };
}

export async function rejectKyc(userId: string) {
  const admin = await requireAdmin();
  if (!userId) return { error: "Missing user ID." };

  const db = makeServiceRoleClient();

  const { data: before } = await db
    .from("profiles")
    .select("kyc_status")
    .eq("id", userId)
    .single();

  const { error } = await db
    .from("profiles")
    .update({ kyc_status: "rejected" })
    .eq("id", userId);

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
  } catch (auditError) {
    return {
      error:
        auditError instanceof Error
          ? `KYC rejected but audit logging failed: ${auditError.message}`
          : "KYC rejected but audit logging failed.",
    };
  }

  return { success: true };
}

export async function archiveKyc(userId: string) {
  const admin = await requireAdmin();
  if (!userId) return { error: "Missing user ID." };

  const db = makeServiceRoleClient();

  const { data: before } = await db
    .from("profiles")
    .select("kyc_status")
    .eq("id", userId)
    .single();

  const { error } = await db
    .from("profiles")
    .update({ kyc_status: "archived" })
    .eq("id", userId);

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
  } catch (auditError) {
    return {
      error:
        auditError instanceof Error
          ? `KYC archived but audit logging failed: ${auditError.message}`
          : "KYC archived but audit logging failed.",
    };
  }

  return { success: true };
}

// ===========================================================================
// TRANSACTIONS QUEUE
export async function getPendingTransactions() {
  const db = await getAuthorizedServerClient();

  const { data, error } = await db
    .from("transactions")
    .select(
      "id, user_id, type, amount_aud, equivalent_toman, status, created_at, profiles(first_name, last_name, email)"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true }); // قدیمی‌ترین‌ها اول بررسی شوند

  if (error) throw new Error(error.message);
  return data ?? [];
}

// این تابع جدید برای تاریخچه تراکنش‌ها با محدودیت ۵۰ تایی ساخته شد
export async function getTransactionHistory(limitCount: number = DEFAULT_HISTORY_LIMIT) {
  const db = await getAuthorizedServerClient();
  const safeLimit = clampInt(limitCount, 1, MAX_HISTORY_LIMIT, DEFAULT_HISTORY_LIMIT);

  const { data, error } = await db
    .from("transactions")
    .select(
      "id, user_id, type, amount_aud, equivalent_toman, status, created_at, profiles(first_name, last_name, email)"
    )
    .neq("status", "pending") // تراکنش‌های pending را از تاریخچه فیلتر می‌کنیم
    .order("created_at", { ascending: false }) // جدیدترین‌ها بالا باشند
    .limit(safeLimit); // اعمال محدودیت روی دیتابیس

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function approveTransaction(transactionId: string | number) {
  const admin = await requireAdmin();
  if (!transactionId) return { error: "Missing transaction ID." };

  const db = makeServiceRoleClient();

  const { data: before } = await db
    .from("transactions")
    .select("status, user_id, amount_aud, type")
    .eq("id", transactionId)
    .single();

  if (!before) return { error: "Transaction not found." };
  if (before.status !== "pending") {
    return { error: `Transaction is already '${before.status}'.` };
  }

  const { error } = await db
    .from("transactions")
    .update({ status: "approved" })
    .eq("id", transactionId);

  if (error) return { error: error.message };

  try {
    await writeAuditLog({
      actorId: admin.id,
      actorEmail: admin.email ?? "",
      action: "TRANSACTION_APPROVED",
      targetType: "transaction",
      targetId: String(transactionId),
      oldValue: { status: "pending" },
      newValue: { status: "approved", user_id: before.user_id, amount_aud: before.amount_aud, type: before.type },
    });
  } catch (auditError) {
    return {
      error:
        auditError instanceof Error
          ? `Transaction approved but audit logging failed: ${auditError.message}`
          : "Transaction approved but audit logging failed.",
    };
  }

  return { success: true };
}

export async function rejectTransaction(transactionId: string | number) {
  const admin = await requireAdmin();
  if (!transactionId) return { error: "Missing transaction ID." };

  const db = makeServiceRoleClient();

  const { data: before } = await db
    .from("transactions")
    .select("status, user_id, amount_aud, type")
    .eq("id", transactionId)
    .single();

  if (!before) return { error: "Transaction not found." };
  if (before.status !== "pending") {
    return { error: `Transaction is already '${before.status}'.` };
  }

  const { error } = await db
    .from("transactions")
    .update({ status: "rejected" })
    .eq("id", transactionId);

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
  } catch (auditError) {
    return {
      error:
        auditError instanceof Error
          ? `Transaction rejected but audit logging failed: ${auditError.message}`
          : "Transaction rejected but audit logging failed.",
    };
  }

  return { success: true };
}

export async function archiveTransaction(transactionId: string | number) {
  const admin = await requireAdmin();
  if (!transactionId) return { error: "Missing transaction ID." };

  const db = makeServiceRoleClient();

  const { data: before } = await db
    .from("transactions")
    .select("status, user_id, amount_aud, type")
    .eq("id", transactionId)
    .single();

  if (!before) return { error: "Transaction not found." };
  if (before.status !== "pending") {
    return { error: `Transaction is already '${before.status}'.` };
  }

  const { error } = await db
    .from("transactions")
    .update({ status: "archived" })
    .eq("id", transactionId);

  if (error) return { error: error.message };

  try {
    await writeAuditLog({
      actorId: admin.id,
      actorEmail: admin.email ?? "",
      action: "TRANSACTION_ARCHIVED",
      targetType: "transaction",
      targetId: String(transactionId),
      oldValue: { status: "pending" },
      newValue: { status: "archived", user_id: before.user_id, amount_aud: before.amount_aud, type: before.type },
    });
  } catch (auditError) {
    return {
      error:
        auditError instanceof Error
          ? `Transaction archived but audit logging failed: ${auditError.message}`
          : "Transaction archived but audit logging failed.",
    };
  }

  return { success: true };
}

// ===========================================================================
// FEEDBACK / TESTIMONIALS MODERATION
// ===========================================================================
export async function getFeedbackQueue() {
  const db = await getAuthorizedServerClient();

  const { data, error } = await db
    .from("testimonials")
    .select(
      "id, user_id, rating, message, status, created_at, moderated_at, profiles(first_name, last_name, email)"
    )
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function moderateFeedback(
  feedbackId: string | number,
  newStatus: "approved" | "rejected"
) {
  const admin = await requireAdmin();
  if (!feedbackId) return { error: "Missing feedback ID." };
  if (newStatus !== "approved" && newStatus !== "rejected") {
    return { error: "Invalid status." };
  }

  const db = makeServiceRoleClient();

  const { data: before } = await db
    .from("testimonials")
    .select("status")
    .eq("id", feedbackId)
    .single();

  const { error } = await db
    .from("testimonials")
    .update({
      status: newStatus,
      moderated_at: new Date().toISOString(),
      moderated_by: admin.id,
    })
    .eq("id", feedbackId);

  if (error) return { error: error.message };

  try {
    await writeAuditLog({
      actorId: admin.id,
      actorEmail: admin.email ?? "",
      action: newStatus === "approved" ? "FEEDBACK_APPROVED" : "FEEDBACK_REJECTED",
      targetType: "testimonial",
      targetId: String(feedbackId),
      oldValue: { status: before?.status ?? "unknown" },
      newValue: { status: newStatus },
    });
  } catch (auditError) {
    return {
      error:
        auditError instanceof Error
          ? `Feedback moderated but audit logging failed: ${auditError.message}`
          : "Feedback moderated but audit logging failed.",
    };
  }

  return { success: true };
}

// ===========================================================================
// SYSTEM SETTINGS
// ===========================================================================
export async function getSystemSettings() {
  const db = await getAuthorizedServerClient();

  const { data, error } = await db
    .from("rates_history")
    .select(
      "buy_aud, sell_aud, date, source, note, market_active, pause_message, " +
      "discount_step_volume, discount_percent_per_step, max_discount_percent, fee_threshold, applied_fee",
    )
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return {
    market_active: data?.market_active ?? true,
    pause_message: data?.pause_message ?? null,
    buy_rate: data?.buy_aud ?? null,
    sell_rate: data?.sell_aud ?? null,
    rate_source: data?.source ?? null,
    rate_note: data?.note ?? null,
    rate_date: data?.date ?? null,
    // Financial configuration (with safe fallbacks matching FINANCE_CONFIG_DEFAULTS)
    discount_step_volume: data?.discount_step_volume ?? 1000,
    discount_percent_per_step: data?.discount_percent_per_step ?? 0.005,
    max_discount_percent: data?.max_discount_percent ?? 0.25,
    fee_threshold: data?.fee_threshold ?? 1000,
    applied_fee: data?.applied_fee ?? 30,
  };
}

export async function updateSystemSettings({
  buyRate,
  sellRate,
  marketActive,
  pauseMessage,
  note,
  financeConfig,
}: {
  buyRate: number | null;
  sellRate: number | null;
  marketActive: boolean;
  pauseMessage: string;
  note?: string;
  financeConfig?: {
    discount_step_volume: number;
    discount_percent_per_step: number;
    max_discount_percent: number;
    fee_threshold: number;
    applied_fee: number;
  };
}) {
  const admin = await requireAdmin();
  const db = makeServiceRoleClient();

  // Upsert into rates_history — single source of truth for both rates and market status.
  // Upsert by date so re-running the same day updates the existing row.
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await db
    .from("rates_history")
    .upsert(
      [{
        date: today,
        buy_aud: buyRate,
        sell_aud: sellRate,
        source: "admin",
        updated_by: admin.id,
        note: note?.trim() || null,
        market_active: marketActive,
        pause_message: pauseMessage.trim() || null,
        // Financial configuration columns
        ...(financeConfig && {
          discount_step_volume: financeConfig.discount_step_volume,
          discount_percent_per_step: financeConfig.discount_percent_per_step,
          max_discount_percent: financeConfig.max_discount_percent,
          fee_threshold: financeConfig.fee_threshold,
          applied_fee: financeConfig.applied_fee,
        }),
      }],
      { onConflict: "date" }
    );

  if (error) return { error: error.message };

  try {
    await writeAuditLog({
      actorId: admin.id,
      actorEmail: admin.email ?? "",
      action: "SYSTEM_SETTINGS_UPDATED",
      targetType: "system_settings",
      targetId: "1",
      oldValue: null,
      newValue: {
        buy_rate: buyRate,
        sell_rate: sellRate,
        market_active: marketActive,
        pause_message: pauseMessage || null,
        ...(financeConfig && { finance_config: financeConfig }),
      },
    });
  } catch (auditError) {
    return {
      error:
        auditError instanceof Error
          ? `Settings updated but audit logging failed: ${auditError.message}`
          : "Settings updated but audit logging failed.",
    };
  }

  // Bust both caches: rates snapshot (hero/chart) and finance config (fee/discount logic).
  revalidateTag("rates-snapshot-v1");
  revalidateTag("system-settings");

  return { success: true };
}

// ===========================================================================
// AUDIT LOGS
// ===========================================================================
export async function getAuditLogs(page = 0, pageSize = 50) {
  const db = await getAuthorizedServerClient();

  const safePage = clampInt(page, 0, MAX_AUDIT_PAGE, 0);
  const safePageSize = clampInt(pageSize, 1, MAX_AUDIT_PAGE_SIZE, DEFAULT_AUDIT_PAGE_SIZE);

  const from = safePage * safePageSize;
  const to = from + safePageSize - 1;

  const { data, error } = await db
    .from("audit_logs")
    .select("id, actor_id, actor_email, action, target_type, target_id, old_value, new_value, created_at")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error(error.message);
  return data ?? [];
}

// ===========================================================================
// USER SEARCH (for User Financial Profile tab)
// ===========================================================================
export async function searchUsers(query: string) {
  const db = await getAuthorizedServerClient();

  const trimmed = sanitizeSearchQuery(query);
  if (!trimmed) return [];

  const { data, error } = await db
    .from("profiles")
    .select("id, first_name, last_name, email, mobile_number, kyc_status, created_at")
    .or(`email.ilike.%${trimmed}%,first_name.ilike.%${trimmed}%,last_name.ilike.%${trimmed}%,mobile_number.ilike.%${trimmed}%`)
    .limit(20);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getUserFinancialProfile(userId: string) {
  const db = await getAuthorizedServerClient();
  if (!userId) throw new Error("Missing user ID.");

  // گرفتن پروفایل، تراکنش‌ها و فیدبک‌ها به صورت همزمان (موازی)
  const ratesSnapshot = await getRatesSnapshot();
  const [profileRes, txRes, feedbackRes] = await Promise.all([
    db.from("profiles").select("*").eq("id", userId).single(),
    db
      .from("transactions")
      .select("id, type, amount_aud, equivalent_toman, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    db
      .from("testimonials")
      .select("id, rating, message, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  if (profileRes.error) throw new Error(profileRes.error.message);

  const transactions = txRes.data ?? [];
  const testimonials = feedbackRes.data ?? []; // اضافه شدن فیدبک‌ها
  const approvedTxs = transactions.filter((t) => t.status === "approved");
  const approvedVolume = approvedTxs.reduce(
    (sum, t) => sum + Number(t.amount_aud || 0),
    0
  );

  return {
    profile: profileRes.data,
    transactions,
    testimonials, // پاس دادن فیدبک‌ها به فرانت‌اند
    approvedVolume,
    approvedCount: approvedTxs.length,
    currentRates: ratesSnapshot.currentRates,
  };
}



