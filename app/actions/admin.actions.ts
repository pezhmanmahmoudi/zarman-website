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

export async function updateUserIdentityKycProfile(payload: {
  userId: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  mobile_number?: string;
  dob?: string;
  address?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  document_type?: "driver_license" | "passport" | "none" | "";
  state_of_issue?: string;
  license_number?: string;
  card_number?: string;
  passport_number?: string;
  expiry_date?: string;
  kyc_status?: "pending" | "under_review" | "approved" | "rejected" | "archived";
}) {
  const admin = await requireAdmin();
  const db = makeServiceRoleClient();

  if (!payload.userId) return { error: "Missing user ID." };

  const { data: existingProfile, error: profileError } = await db
    .from("profiles")
    .select("id, email")
    .eq("id", payload.userId)
    .maybeSingle();

  if (profileError) return { error: profileError.message };
  if (!existingProfile) return { error: "Customer profile not found." };

  const trimmedEmail = payload.email?.trim().toLowerCase() || null;
  if (trimmedEmail && !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
    return { error: "Please provide a valid email." };
  }

  if (trimmedEmail && trimmedEmail !== existingProfile.email) {
    const { data: duplicateEmail } = await db
      .from("profiles")
      .select("id")
      .eq("email", trimmedEmail)
      .neq("id", payload.userId)
      .maybeSingle();

    if (duplicateEmail) return { error: "This email is already in use by another customer." };
  }

  const patch: Record<string, unknown> = {
    first_name: payload.first_name?.trim() || null,
    last_name: payload.last_name?.trim() || null,
    email: trimmedEmail,
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

  if (payload.kyc_status) {
    patch.kyc_status = payload.kyc_status;
  }

  const { error: updateError } = await db
    .from("profiles")
    .update(patch)
    .eq("id", payload.userId);

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

// ===========================================================================
// TRANSACTIONS QUEUE
export async function getPendingTransactions() {
  const db = await getAuthorizedServerClient();

  const { data, error } = await db
    .from("transactions")
    .select(
      "id, user_id, type, amount_aud, equivalent_toman, status, created_at, source_of_funds, reason_for_transfer, profiles(first_name, last_name, email)"
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
      "id, user_id, type, amount_aud, equivalent_toman, status, created_at, source_of_funds, reason_for_transfer, profiles(first_name, last_name, email)"
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
    .select(`
      status, user_id, amount_aud, equivalent_toman, type, created_at, payment_link,
      profiles(first_name, last_name, email),
      recipients(full_name, account_name)
    `)
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

  // ── Insert ledger snapshot ───────────────────────────────────────────────
  try {
    const { data: rateRow } = await db
      .from("rates_history")
      .select("buy_aud, applied_fee, fee_threshold")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const audAmt   = Number(before.amount_aud ?? 0);
    const tomanAmt = Number(before.equivalent_toman ?? 0);
    const rate     = audAmt > 0 ? tomanAmt / audAmt : 0;
    const feeThreshold = Number(rateRow?.fee_threshold ?? 1000);
    const appliedFee   = Number(rateRow?.applied_fee   ?? 30);
    const feeAud = audAmt > 0 && audAmt < feeThreshold ? appliedFee : 0;

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
      transaction_id:  String(transactionId),
      date_gregorian:  dateGregorian,
      date_jalali:     dateJalali,
      type:            before.type,
      exchange_rate:   rate,
      amount_aud:      audAmt,
      amount_toman:    tomanAmt,
      sender,
      recipient,
      fee_aud:         feeAud,
      created_by:      admin.id,
    }]);
  } catch { /* ledger insert failure must not block approval */ }

  // ── Audit log ────────────────────────────────────────────────────────────
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
  if (before.status !== "pending" && before.status !== "approved") {
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
      "id, user_id, rating, message, status, created_at, moderated_at, profiles(id, first_name, last_name, email, customer_code)"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getFeedbackHistory(page: number = 1, pageSize: number = 10) {
  const db = await getAuthorizedServerClient();
  const safePage = clampInt(page, 1, MAX_AUDIT_PAGE, 1);
  const safePageSize = clampInt(pageSize, 1, 50, 10);
  const offset = (safePage - 1) * safePageSize;

  const [countRes, dataRes] = await Promise.all([
    db
      .from("testimonials")
      .select("id", { count: "exact", head: true })
      .neq("status", "pending"),
    db
      .from("testimonials")
      .select(
        "id, user_id, rating, message, status, created_at, moderated_at, profiles(id, first_name, last_name, email, customer_code)"
      )
      .neq("status", "pending")
      .order("created_at", { ascending: false })
      .range(offset, offset + safePageSize - 1),
  ]);

  if (dataRes.error) throw new Error(dataRes.error.message);
  return { data: dataRes.data ?? [], total: countRes.count ?? 0 };
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
      "buy_aud, sell_aud, date, source, note, market_active, pause_message, discount_step_volume, discount_percent_per_step, max_discount_percent, fee_threshold, applied_fee"
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
  // updated_at is explicitly set here AND via a DB trigger, so it always reflects
  // the exact moment this save was triggered — regardless of created_at immutability.
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const { error } = await db
    .from("rates_history")
    .upsert(
      [{
        date: today,
        updated_at: now,
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
  revalidateTag("rates-snapshot-v1", "default");
  revalidateTag("system-settings", "default");

  return { success: true };
}

// ===========================================================================
// AUDIT LOGS
// ===========================================================================
export async function getAuditLogs(page = 1, pageSize = 10) {
  const db = await getAuthorizedServerClient();

  const safePage = clampInt(page, 1, MAX_AUDIT_PAGE, 1);
  const safePageSize = clampInt(pageSize, 1, MAX_AUDIT_PAGE_SIZE, 10);

  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;

  const { data, error, count } = await db
    .from("audit_logs")
    .select("id, actor_id, actor_email, action, target_type, target_id, old_value, new_value, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error(error.message);
  return { data: data ?? [], total: count ?? 0 };
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
    .select("id, first_name, last_name, email, mobile_number, kyc_status, created_at, customer_code")
    .or(`email.ilike.%${trimmed}%,first_name.ilike.%${trimmed}%,last_name.ilike.%${trimmed}%,mobile_number.ilike.%${trimmed}%`)
    .limit(20);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getUserFinancialProfile(userId: string) {
  // Verify admin session via SSR client (cookie-based auth check).
  const ssrClient = await createSupabaseServerActionClient();
  await requireAdmin(ssrClient);
  // Use service-role client for all data queries so RLS on recipients
  // (and any other user-scoped tables) does not block cross-user access.
  const db = makeServiceRoleClient();
  if (!userId) throw new Error("Missing user ID.");

  // گرفتن پروفایل، تراکنش‌ها و فیدبک‌ها به صورت همزمان (موازی)
  const ratesSnapshot = await getRatesSnapshot();
  const [profileRes, txRes, feedbackRes, recipientsRes] = await Promise.all([
    db.from("profiles").select("*").eq("id", userId).single(),
    db
      .from("transactions")
      .select(`
        id, recipient_id, type, amount_aud, equivalent_toman, status, created_at,
        applied_rate, source_of_funds, reason_for_transfer, payment_link, reference_code,
        promo_code, discount_amount, loyalty_discount,
        recipients(id, direction, label, bank_type, bank_name, account_name, full_name)
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    db
      .from("testimonials")
      .select("id, rating, message, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    db
      .from("recipients")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  if (profileRes.error) throw new Error(profileRes.error.message);

  const transactions = txRes.data ?? [];
  const testimonials = feedbackRes.data ?? [];
  const recipients = recipientsRes.data ?? [];
  const approvedTxs = transactions.filter((t) => t.status === "approved");
  const approvedVolume = approvedTxs.reduce(
    (sum, t) => sum + Number(t.amount_aud || 0),
    0
  );

  return {
    profile: profileRes.data,
    transactions,
    testimonials,
    recipients,
    approvedVolume,
    approvedCount: approvedTxs.length,
    currentRates: ratesSnapshot.currentRates,
  };
}

// ===========================================================================
// ASSISTED CUSTOMER ONBOARDING (Admin creates customer profile + recipient + tx)
// ===========================================================================
type AssistedRecipientPayload = {
  direction: "aud" | "irt";
  label: string;
  bank_name?: string;
  bsb?: string;
  account_number?: string;
  account_name?: string;
  residential_address?: string;
  recipient_email?: string;
  recipient_phone?: string;
  bank_type?: "bank_melli" | "other";
  card_number?: string;
  shaba_number?: string;
  irt_account_number?: string;
  full_name?: string;
  irt_address?: string;
  irt_phone?: string;
};

type AssistedTransactionPayload = {
  create: boolean;
  type: "buy_aud" | "sell_aud";
  amount_aud: number;
  equivalent_toman: number;
  applied_rate?: number;
  source_of_funds?: string;
  reason_for_transfer?: string;
  payment_link?: string;
};

export type AssistedOnboardingPayload = {
  first_name: string;
  last_name: string;
  middle_name?: string;
  email: string;
  mobile_number: string;
  dob?: string;
  address?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  customer_code?: string;
  kyc_status?: "pending" | "under_review" | "approved" | "rejected" | "archived";
  // Identity document fields
  document_type?: "driver_license" | "passport" | "none" | "";
  license_number?: string;
  card_number?: string;
  state_of_issue?: string;
  passport_number?: string;
  expiry_date?: string;
  recipient: AssistedRecipientPayload;
  transaction?: AssistedTransactionPayload;
};

async function generateAdminReferenceCode(db: ReturnType<typeof makeServiceRoleClient>) {
  for (let i = 0; i < 20; i += 1) {
    const candidate = `ZE${Math.floor(10000 + Math.random() * 90000)}`;
    const { data } = await db
      .from("transactions")
      .select("id")
      .eq("reference_code", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  throw new Error("Could not generate a unique reference code.");
}

async function generateCustomerCode(db: ReturnType<typeof makeServiceRoleClient>) {
  for (let i = 0; i < 30; i += 1) {
    const candidate = `CZ${Math.floor(100000 + Math.random() * 900000)}`;
    const { data } = await db
      .from("profiles")
      .select("id")
      .eq("customer_code", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  throw new Error("Could not generate a unique customer code.");
}

export async function createAssistedCustomerOnboarding(payload: AssistedOnboardingPayload) {
  const admin = await requireAdmin();
  const db = makeServiceRoleClient();

  const firstName = payload.first_name?.trim();
  const lastName = payload.last_name?.trim();
  const email = payload.email?.trim().toLowerCase();
  const mobile = payload.mobile_number?.trim();

  if (!firstName) return { error: "First name is required." };
  if (!lastName) return { error: "Last name is required." };
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return { error: "Valid email is required." };
  if (!mobile) return { error: "Mobile number is required." };

  const customerCodeInput = payload.customer_code?.trim();

  if (!payload.recipient?.direction || !["aud", "irt"].includes(payload.recipient.direction)) {
    return { error: "Recipient direction is required." };
  }
  if (!payload.recipient?.label?.trim()) {
    return { error: "Recipient label is required." };
  }

  const { data: existingProfile } = await db
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existingProfile) {
    return { error: "A customer with this email already exists." };
  }

  if (customerCodeInput) {
    const { data: existingCode } = await db
      .from("profiles")
      .select("id")
      .eq("customer_code", customerCodeInput)
      .maybeSingle();
    if (existingCode) {
      return { error: "Customer code already exists." };
    }
  }

  const customerCode = customerCodeInput || await generateCustomerCode(db);

  const tempPassword = `Zarman!${Math.random().toString(36).slice(2, 10)}${Date.now().toString().slice(-2)}`;
  const { data: authCreated, error: authError } = await db.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    app_metadata: { role: "user" },
    user_metadata: { first_name: firstName, last_name: lastName },
  });

  if (authError || !authCreated.user?.id) {
    return { error: authError?.message ?? "Failed to create auth user." };
  }

  const userId = authCreated.user.id;

  const middleName = payload.middle_name?.trim() || null;
  const docType = payload.document_type?.trim() || null;
  const isDriverLicense = docType === "driver_license";
  const isPassport = docType === "passport";

  const profilePatch = {
    id: userId,
    first_name: firstName,
    last_name: lastName,
    email,
    mobile_number: mobile,
    dob: payload.dob?.trim() || null,
    address: payload.address?.trim() || null,
    city: payload.city?.trim() || null,
    state: payload.state?.trim() || null,
    postcode: payload.postcode?.trim() || null,
    country: payload.country?.trim() || null,
    customer_code: customerCode,
    kyc_status: payload.kyc_status ?? "pending",
    // Document / identity fields
    document_type: docType,
    license_number: isDriverLicense ? (payload.license_number?.trim() || null) : null,
    card_number: isDriverLicense ? (payload.card_number?.trim() || null) : null,
    state_of_issue: isDriverLicense ? (payload.state_of_issue?.trim() || null) : null,
    passport_number: isPassport ? (payload.passport_number?.trim() || null) : null,
    expiry_date: (isDriverLicense || isPassport) ? (payload.expiry_date?.trim() || null) : null,
  };

  const { error: profileError } = await db
    .from("profiles")
    .upsert([profilePatch], { onConflict: "id" });

  if (profileError) {
    await db.auth.admin.deleteUser(userId).catch(() => {});
    return { error: profileError.message };
  }

  const r = payload.recipient;
  const recipientInsert: Record<string, unknown> = {
    user_id: userId,
    direction: r.direction,
    label: r.label.trim(),
  };

  if (r.direction === "aud") {
    recipientInsert.bank_name = r.bank_name?.trim() || null;
    recipientInsert.bsb = r.bsb?.trim() || null;
    recipientInsert.account_number = r.account_number?.trim() || null;
    recipientInsert.account_name = r.account_name?.trim() || null;
    recipientInsert.residential_address = r.residential_address?.trim() || null;
    recipientInsert.recipient_email = r.recipient_email?.trim() || null;
    recipientInsert.recipient_phone = r.recipient_phone?.trim() || null;
  } else {
    recipientInsert.bank_type = r.bank_type === "bank_melli" ? "bank_melli" : "other";
    recipientInsert.bank_name = r.bank_name?.trim() || null;
    recipientInsert.card_number = r.card_number?.trim() || null;
    recipientInsert.shaba_number = r.shaba_number?.trim() || null;
    recipientInsert.irt_account_number = r.irt_account_number?.trim() || null;
    recipientInsert.full_name = r.full_name?.trim() || null;
    recipientInsert.irt_address = r.irt_address?.trim() || null;
    recipientInsert.irt_phone = r.irt_phone?.trim() || null;
  }

  const { data: recipientRow, error: recipientError } = await db
    .from("recipients")
    .insert([recipientInsert])
    .select("id")
    .single();

  if (recipientError) {
    try {
      await db.from("profiles").delete().eq("id", userId);
    } catch {}
    await db.auth.admin.deleteUser(userId).catch(() => {});
    return { error: recipientError.message };
  }

  let createdTransactionId: string | null = null;
  if (payload.transaction?.create) {
    const amountAud = Number(payload.transaction.amount_aud);
    const toman = Number(payload.transaction.equivalent_toman);
    if (!Number.isFinite(amountAud) || amountAud <= 0) {
      return { error: "Transaction AUD amount must be a positive number." };
    }
    if (!Number.isFinite(toman) || toman <= 0) {
      return { error: "Transaction Toman amount must be a positive number." };
    }

    const referenceCode = await generateAdminReferenceCode(db);
    const txAppliedRate = Number(payload.transaction.applied_rate);
    const appliedRate = Number.isFinite(txAppliedRate) && txAppliedRate > 0
      ? txAppliedRate
      : (amountAud > 0 ? Math.round(toman / amountAud) : 0);
    const { data: txRow, error: txError } = await db
      .from("transactions")
      .insert([{
        user_id: userId,
        recipient_id: recipientRow.id,
        type: payload.transaction.type,
        amount_aud: amountAud,
        equivalent_toman: toman,
        applied_rate: appliedRate,
        status: "pending",
        source_of_funds: payload.transaction.source_of_funds?.trim() || null,
        reason_for_transfer: payload.transaction.reason_for_transfer?.trim() || null,
        payment_link: payload.transaction.payment_link?.trim() || null,
        promo_code: null,
        discount_amount: 0,
        final_amount: amountAud,
        loyalty_discount: 0,
        reference_code: referenceCode,
      }])
      .select("id")
      .single();

    if (txError) return { error: txError.message };
    createdTransactionId = txRow.id;
  }

  await writeAuditLog({
    actorId: admin.id,
    actorEmail: admin.email ?? "",
    action: "ASSISTED_CUSTOMER_CREATED",
    targetType: "profile",
    targetId: userId,
    newValue: {
      profile: {
        id: userId,
        first_name: firstName,
        last_name: lastName,
        email,
        mobile_number: mobile,
        kyc_status: payload.kyc_status ?? "pending",
        customer_code: customerCode,
      },
      recipient_id: recipientRow.id,
      transaction_id: createdTransactionId,
    },
  }).catch(() => {});

  return {
    success: true,
    userId,
    recipientId: recipientRow.id,
    transactionId: createdTransactionId,
  };
}

export async function createAssistedTransactionForUser(payload: {
  userId: string;
  recipientId: string;
  type: "buy_aud" | "sell_aud";
  amount_aud: number;
  equivalent_toman: number;
  applied_rate?: number;
  source_of_funds?: string;
  reason_for_transfer?: string;
  payment_link?: string;
}) {
  const admin = await requireAdmin();
  const db = makeServiceRoleClient();

  if (!payload.userId) return { error: "Missing user ID." };
  if (!payload.recipientId) return { error: "Recipient selection is required." };
  if (!payload.type || !["buy_aud", "sell_aud"].includes(payload.type)) {
    return { error: "Invalid transaction type." };
  }

  const amountAud = Number(payload.amount_aud);
  const toman = Number(payload.equivalent_toman);
  if (!Number.isFinite(amountAud) || amountAud <= 0) {
    return { error: "AUD amount must be a positive number." };
  }
  if (!Number.isFinite(toman) || toman <= 0) {
    return { error: "Equivalent Toman must be a positive number." };
  }

  const { data: profileRow } = await db
    .from("profiles")
    .select("id")
    .eq("id", payload.userId)
    .maybeSingle();
  if (!profileRow) return { error: "Customer profile not found." };

  const { data: recipientRow } = await db
    .from("recipients")
    .select("id, user_id")
    .eq("id", payload.recipientId)
    .maybeSingle();
  if (!recipientRow) return { error: "Selected recipient not found." };
  if (recipientRow.user_id !== payload.userId) {
    return { error: "Selected recipient does not belong to this customer." };
  }

  const referenceCode = await generateAdminReferenceCode(db);
  const appliedRate = Number.isFinite(Number(payload.applied_rate)) && Number(payload.applied_rate) > 0
    ? Number(payload.applied_rate)
    : (amountAud > 0 ? Math.round(toman / amountAud) : 0);

  const { data: txRow, error: txError } = await db
    .from("transactions")
    .insert([{
      user_id: payload.userId,
      recipient_id: payload.recipientId,
      type: payload.type,
      amount_aud: amountAud,
      equivalent_toman: toman,
      applied_rate: appliedRate,
      status: "pending",
      source_of_funds: payload.source_of_funds?.trim() || null,
      reason_for_transfer: payload.reason_for_transfer?.trim() || null,
      payment_link: payload.payment_link?.trim() || null,
      promo_code: null,
      discount_amount: 0,
      final_amount: amountAud,
      loyalty_discount: 0,
      reference_code: referenceCode,
    }])
    .select("id")
    .single();

  if (txError) return { error: txError.message };

  await writeAuditLog({
    actorId: admin.id,
    actorEmail: admin.email ?? "",
    action: "ASSISTED_TRANSACTION_CREATED",
    targetType: "transaction",
    targetId: txRow.id,
    newValue: {
      user_id: payload.userId,
      recipient_id: payload.recipientId,
      type: payload.type,
      amount_aud: amountAud,
      equivalent_toman: toman,
      status: "pending",
      reference_code: referenceCode,
    },
  }).catch(() => {});

  return { success: true, transactionId: txRow.id };
}

export async function createAssistedRecipientForUser(payload: {
  userId: string;
  direction: "aud" | "irt";
  label: string;
  bank_name?: string;
  bsb?: string;
  account_number?: string;
  account_name?: string;
  residential_address?: string;
  recipient_email?: string;
  recipient_phone?: string;
  bank_type?: "bank_melli" | "other";
  card_number?: string;
  shaba_number?: string;
  irt_account_number?: string;
  full_name?: string;
  irt_address?: string;
  irt_phone?: string;
}) {
  const admin = await requireAdmin();
  const db = makeServiceRoleClient();

  if (!payload.userId) return { error: "Missing user ID." };
  if (!payload.direction || !["aud", "irt"].includes(payload.direction)) {
    return { error: "Recipient direction is required." };
  }

  const label = payload.label?.trim();
  if (!label) return { error: "Recipient label is required." };

  const { data: profileRow } = await db
    .from("profiles")
    .select("id")
    .eq("id", payload.userId)
    .maybeSingle();
  if (!profileRow) return { error: "Customer profile not found." };

  const insert: Record<string, unknown> = {
    user_id: payload.userId,
    direction: payload.direction,
    label,
  };

  if (payload.direction === "aud") {
    insert.bank_name = payload.bank_name?.trim() || null;
    insert.bsb = payload.bsb?.trim() || null;
    insert.account_number = payload.account_number?.trim() || null;
    insert.account_name = payload.account_name?.trim() || null;
    insert.residential_address = payload.residential_address?.trim() || null;
    insert.recipient_email = payload.recipient_email?.trim() || null;
    insert.recipient_phone = payload.recipient_phone?.trim() || null;
  } else {
    insert.bank_type = payload.bank_type === "bank_melli" ? "bank_melli" : "other";
    insert.bank_name = payload.bank_name?.trim() || null;
    insert.card_number = payload.card_number?.trim() || null;
    insert.shaba_number = payload.shaba_number?.trim() || null;
    insert.irt_account_number = payload.irt_account_number?.trim() || null;
    insert.full_name = payload.full_name?.trim() || null;
    insert.irt_address = payload.irt_address?.trim() || null;
    insert.irt_phone = payload.irt_phone?.trim() || null;
  }

  const { data: recipientRow, error: recipientError } = await db
    .from("recipients")
    .insert([insert])
    .select("id")
    .single();

  if (recipientError) return { error: recipientError.message };

  await writeAuditLog({
    actorId: admin.id,
    actorEmail: admin.email ?? "",
    action: "ASSISTED_RECIPIENT_CREATED",
    targetType: "recipient",
    targetId: recipientRow.id,
    newValue: {
      user_id: payload.userId,
      direction: payload.direction,
      label,
    },
  }).catch(() => {});

  return { success: true, recipientId: recipientRow.id };
}

export async function updateAssistedRecipientForUser(payload: {
  recipientId: string;
  userId: string;
  direction: "aud" | "irt";
  label: string;
  bank_name?: string;
  bsb?: string;
  account_number?: string;
  account_name?: string;
  residential_address?: string;
  recipient_email?: string;
  recipient_phone?: string;
  bank_type?: "bank_melli" | "other";
  card_number?: string;
  shaba_number?: string;
  irt_account_number?: string;
  full_name?: string;
  irt_address?: string;
  irt_phone?: string;
}) {
  const admin = await requireAdmin();
  const db = makeServiceRoleClient();

  if (!payload.recipientId) return { error: "Missing recipient ID." };
  if (!payload.userId) return { error: "Missing user ID." };
  if (!payload.direction || !["aud", "irt"].includes(payload.direction)) {
    return { error: "Recipient direction is required." };
  }

  const label = payload.label?.trim();
  if (!label) return { error: "Recipient label is required." };

  const { data: recipientRow, error: recipientError } = await db
    .from("recipients")
    .select("id, user_id")
    .eq("id", payload.recipientId)
    .maybeSingle();

  if (recipientError) return { error: recipientError.message };
  if (!recipientRow) return { error: "Recipient not found." };
  if (recipientRow.user_id !== payload.userId) {
    return { error: "Recipient does not belong to this customer." };
  }

  const updatePatch: Record<string, unknown> = {
    direction: payload.direction,
    label,
  };

  if (payload.direction === "aud") {
    updatePatch.bank_name = payload.bank_name?.trim() || null;
    updatePatch.bsb = payload.bsb?.trim() || null;
    updatePatch.account_number = payload.account_number?.trim() || null;
    updatePatch.account_name = payload.account_name?.trim() || null;
    updatePatch.residential_address = payload.residential_address?.trim() || null;
    updatePatch.recipient_email = payload.recipient_email?.trim() || null;
    updatePatch.recipient_phone = payload.recipient_phone?.trim() || null;
    updatePatch.bank_type = null;
    updatePatch.card_number = null;
    updatePatch.shaba_number = null;
    updatePatch.irt_account_number = null;
    updatePatch.full_name = null;
    updatePatch.irt_address = null;
    updatePatch.irt_phone = null;
  } else {
    updatePatch.bank_type = payload.bank_type === "bank_melli" ? "bank_melli" : "other";
    updatePatch.bank_name = payload.bank_name?.trim() || null;
    updatePatch.card_number = payload.card_number?.trim() || null;
    updatePatch.shaba_number = payload.shaba_number?.trim() || null;
    updatePatch.irt_account_number = payload.irt_account_number?.trim() || null;
    updatePatch.full_name = payload.full_name?.trim() || null;
    updatePatch.irt_address = payload.irt_address?.trim() || null;
    updatePatch.irt_phone = payload.irt_phone?.trim() || null;
    updatePatch.bsb = null;
    updatePatch.account_number = null;
    updatePatch.account_name = null;
    updatePatch.residential_address = null;
    updatePatch.recipient_email = null;
    updatePatch.recipient_phone = null;
  }

  const { error: updateError } = await db
    .from("recipients")
    .update(updatePatch)
    .eq("id", payload.recipientId)
    .eq("user_id", payload.userId);

  if (updateError) return { error: updateError.message };

  await writeAuditLog({
    actorId: admin.id,
    actorEmail: admin.email ?? "",
    action: "ASSISTED_RECIPIENT_UPDATED",
    targetType: "recipient",
    targetId: payload.recipientId,
    newValue: updatePatch,
  }).catch(() => {});

  return { success: true };
}

// ===========================================================================
// PROMO CODE MANAGEMENT (Admin CRUD)
// ===========================================================================

export type PromoCodePayload = {
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  max_uses?: number | null;
  active?: boolean;
  expires_at?: string | null;
  description?: string | null;
};

export async function getPromoCodes() {
  const db = await getAuthorizedServerClient();
  const { data, error } = await db
    .from("promo_codes")
    .select("id, code, discount_type, discount_value, max_uses, used_count, active, expires_at, description, created_at")
    .order("created_at", { ascending: false });

  if (error) return [];
  return data ?? [];
}

export async function createPromoCode(payload: PromoCodePayload) {
  const admin = await requireAdmin();
  const db = makeServiceRoleClient();

  const code = payload.code?.trim().toUpperCase();
  if (!code) return { error: "Code is required." };
  if (!["percentage", "fixed"].includes(payload.discount_type)) {
    return { error: "Invalid discount_type." };
  }
  if (!Number.isFinite(payload.discount_value) || payload.discount_value <= 0) {
    return { error: "discount_value must be a positive number." };
  }
  if (payload.discount_type === "percentage" && payload.discount_value > 100) {
    return { error: "Percentage discount cannot exceed 100." };
  }

  const { data, error } = await db
    .from("promo_codes")
    .insert([{
      code,
      discount_type: payload.discount_type,
      discount_value: payload.discount_value,
      max_uses: payload.max_uses ?? null,
      active: payload.active ?? true,
      expires_at: payload.expires_at ?? null,
      description: payload.description?.trim() ?? null,
    }])
    .select("*")
    .single();

  if (error) return { error: error.message };

  await writeAuditLog({
    actorId: admin.id,
    actorEmail: admin.email ?? "",
    action: "PROMO_CODE_CREATED",
    targetType: "promo_code",
    targetId: data.id,
    newValue: data,
  }).catch(() => {});

  return { success: true, data };
}

export async function updatePromoCode(id: string, payload: Partial<PromoCodePayload>) {
  const admin = await requireAdmin();
  if (!id) return { error: "Missing promo code ID." };
  const db = makeServiceRoleClient();

  const update: Record<string, unknown> = {};
  if (payload.code !== undefined) update.code = payload.code.trim().toUpperCase();
  if (payload.discount_type !== undefined) update.discount_type = payload.discount_type;
  if (payload.discount_value !== undefined) update.discount_value = payload.discount_value;
  if (payload.max_uses !== undefined) update.max_uses = payload.max_uses;
  if (payload.active !== undefined) update.active = payload.active;
  if (payload.expires_at !== undefined) update.expires_at = payload.expires_at;
  if (payload.description !== undefined) update.description = payload.description?.trim() ?? null;

  const { error } = await db.from("promo_codes").update(update).eq("id", id);
  if (error) return { error: error.message };

  await writeAuditLog({
    actorId: admin.id,
    actorEmail: admin.email ?? "",
    action: "PROMO_CODE_UPDATED",
    targetType: "promo_code",
    targetId: id,
    newValue: update,
  }).catch(() => {});

  return { success: true };
}

export async function deletePromoCode(id: string) {
  const admin = await requireAdmin();
  if (!id) return { error: "Missing promo code ID." };
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

// ===========================================================================
// ADMIN TRANSACTION DETAIL (with recipient + promo data)
// ===========================================================================
export async function getPendingTransactionsWithDetails() {
  const ssrClient = await createSupabaseServerActionClient();
  await requireAdmin(ssrClient);
  const db = makeServiceRoleClient();

  const { data, error } = await db
    .from("transactions")
    .select(`
      id, user_id, type, amount_aud, equivalent_toman, status, created_at,
      source_of_funds, reason_for_transfer, receipt_sent, payment_link,
      promo_code, discount_amount, loyalty_discount, final_amount, reference_code,
      profiles(first_name, last_name, email, customer_code),
      recipients(
        id, direction, label, bank_type,
        bank_name, bsb, account_number, account_name, residential_address, recipient_email, recipient_phone,
        card_number, shaba_number, irt_account_number, full_name, irt_address, irt_phone
      )
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getTransactionHistoryWithDetails(page: number = 1, pageSize: number = 10) {
  const ssrClient = await createSupabaseServerActionClient();
  await requireAdmin(ssrClient);
  const db = makeServiceRoleClient();
  const safePage = clampInt(page, 1, MAX_AUDIT_PAGE, 1);
  const safePageSize = clampInt(pageSize, 1, 50, 10);
  const offset = (safePage - 1) * safePageSize;

  const [countRes, dataRes] = await Promise.all([
    db
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .neq("status", "pending"),
    db
      .from("transactions")
      .select(`
        id, user_id, type, amount_aud, equivalent_toman, status, created_at,
        source_of_funds, reason_for_transfer, receipt_sent, payment_link,
        promo_code, discount_amount, loyalty_discount, final_amount, reference_code,
        profiles(first_name, last_name, email, customer_code),
        recipients(
          id, direction, label, bank_type,
          bank_name, bsb, account_number, account_name, residential_address, recipient_email, recipient_phone,
          card_number, shaba_number, irt_account_number, full_name, irt_address, irt_phone
        )
      `)
      .neq("status", "pending")
      .order("created_at", { ascending: false })
      .range(offset, offset + safePageSize - 1),
  ]);

  if (dataRes.error) throw new Error(dataRes.error.message);
  return { data: dataRes.data ?? [], total: countRes.count ?? 0 };
}

// ===========================================================================
// UPDATE TRANSACTION REFERENCE CODE
// ===========================================================================
export async function updateTransactionReferenceCode(
  transactionId: string | number,
  newCode: string
) {
  const admin = await requireAdmin();
  if (!transactionId) return { error: "Missing transaction ID." };

  const trimmedCode = newCode.trim().toUpperCase();
  if (!trimmedCode) return { error: "Reference code cannot be empty." };
  if (!/^[A-Z]{2}[0-9]{5}$/.test(trimmedCode)) {
    return { error: "Invalid format. Expected 2 letters + 5 digits (e.g. ZE12345)." };
  }

  const db = makeServiceRoleClient();

  const { data: existing } = await db
    .from("transactions")
    .select("id")
    .eq("reference_code", trimmedCode)
    .neq("id", String(transactionId))
    .maybeSingle();

  if (existing) return { error: "Reference code already in use." };

  const { data: before } = await db
    .from("transactions")
    .select("reference_code")
    .eq("id", transactionId)
    .single();

  const { error } = await db
    .from("transactions")
    .update({ reference_code: trimmedCode })
    .eq("id", transactionId);

  if (error) return { error: error.message };

  try {
    await writeAuditLog({
      actorId: admin.id,
      actorEmail: admin.email ?? "",
      action: "TRANSACTION_REFERENCE_UPDATED",
      targetType: "transaction",
      targetId: String(transactionId),
      oldValue: { reference_code: before?.reference_code },
      newValue: { reference_code: trimmedCode },
    });
  } catch {}

  return { success: true };
}

// ===========================================================================
// UPDATE CUSTOMER CODE
// ===========================================================================
export async function updateCustomerCode(userId: string, newCode: string) {
  const admin = await requireAdmin();
  if (!userId) return { error: "Missing user ID." };

  const trimmedCode = newCode.trim();
  if (!trimmedCode) return { error: "Customer code cannot be empty." };

  const db = makeServiceRoleClient();

  const { data: existing } = await db
    .from("profiles")
    .select("id")
    .eq("customer_code", trimmedCode)
    .neq("id", userId)
    .maybeSingle();

  if (existing) return { error: "Customer code already in use." };

  const { data: before } = await db
    .from("profiles")
    .select("customer_code")
    .eq("id", userId)
    .single();

  const { error } = await db
    .from("profiles")
    .update({ customer_code: trimmedCode })
    .eq("id", userId);

  if (error) return { error: error.message };

  try {
    await writeAuditLog({
      actorId: admin.id,
      actorEmail: admin.email ?? "",
      action: "CUSTOMER_CODE_UPDATED",
      targetType: "profile",
      targetId: userId,
      oldValue: { customer_code: before?.customer_code },
      newValue: { customer_code: trimmedCode },
    });
  } catch {}

  return { success: true };
}

// ===========================================================================
// UPDATE TRANSACTION AMOUNT (AUD or Toman)
// ===========================================================================
export async function updateTransactionAmount(
  transactionId: string | number,
  field: "amount_aud" | "equivalent_toman",
  newValue: number
): Promise<{ success: true } | { error: string }> {
  const admin = await requireAdmin();
  if (!transactionId) return { error: "Missing transaction ID." };

  if (!Number.isFinite(newValue) || newValue <= 0) {
    return { error: "Please enter a valid positive number." };
  }

  const db = makeServiceRoleClient();

  const { data: before, error: fetchErr } = await db
    .from("transactions")
    .select(`id, amount_aud, equivalent_toman`)
    .eq("id", String(transactionId))
    .single();

  if (fetchErr || !before) return { error: "Transaction not found." };

  const { error: updateErr } = await db
    .from("transactions")
    .update({ [field]: newValue })
    .eq("id", String(transactionId));

  if (updateErr) return { error: updateErr.message };

  try {
    await writeAuditLog({
      actorId: admin.id,
      actorEmail: admin.email ?? "",
      action: "TRANSACTION_AMOUNT_UPDATED",
      targetType: "transaction",
      targetId: String(transactionId),
      oldValue: { field, value: (before as Record<string, unknown>)[field] },
      newValue: { field, value: newValue },
    });
  } catch {}

  return { success: true };
}

// ===========================================================================
// UPDATE FULL TRANSACTION ROW (CRM user timeline)
// ===========================================================================
export async function updateAssistedTransactionForUser(payload: {
  transactionId: string;
  userId: string;
  recipientId: string;
  type: "buy_aud" | "sell_aud";
  amount_aud: number;
  equivalent_toman: number;
  applied_rate?: number;
  source_of_funds?: string;
  reason_for_transfer?: string;
  payment_link?: string;
  reference_code: string;
  status: "pending" | "approved" | "rejected" | "archived" | "cancelled";
}) {
  const admin = await requireAdmin();
  const db = makeServiceRoleClient();

  if (!payload.transactionId) return { error: "Missing transaction ID." };
  if (!payload.userId) return { error: "Missing user ID." };
  if (!payload.recipientId) return { error: "Recipient is required." };
  if (!payload.type || !["buy_aud", "sell_aud"].includes(payload.type)) {
    return { error: "Invalid transaction type." };
  }

  const amountAud = Number(payload.amount_aud);
  const toman = Number(payload.equivalent_toman);
  if (!Number.isFinite(amountAud) || amountAud <= 0) {
    return { error: "AUD amount must be a positive number." };
  }
  if (!Number.isFinite(toman) || toman <= 0) {
    return { error: "Equivalent Toman must be a positive number." };
  }

  if (!payload.status || !["pending", "approved", "rejected", "archived", "cancelled"].includes(payload.status)) {
    return { error: "Invalid transaction status." };
  }

  const trimmedCode = payload.reference_code.trim().toUpperCase();
  if (!trimmedCode) return { error: "Reference code cannot be empty." };
  if (!/^[A-Z]{2}[0-9]{5}$/.test(trimmedCode)) {
    return { error: "Invalid reference code format. Expected 2 letters + 5 digits." };
  }

  const { data: txRow, error: txFetchError } = await db
    .from("transactions")
    .select("id, user_id, recipient_id, type, amount_aud, equivalent_toman, applied_rate, source_of_funds, reason_for_transfer, payment_link, reference_code, status")
    .eq("id", payload.transactionId)
    .maybeSingle();

  if (txFetchError) return { error: txFetchError.message };
  if (!txRow) return { error: "Transaction not found." };
  if (txRow.user_id !== payload.userId) {
    return { error: "Transaction does not belong to this customer." };
  }

  const { data: recipientRow, error: recipientError } = await db
    .from("recipients")
    .select("id, user_id")
    .eq("id", payload.recipientId)
    .maybeSingle();

  if (recipientError) return { error: recipientError.message };
  if (!recipientRow) return { error: "Selected recipient not found." };
  if (recipientRow.user_id !== payload.userId) {
    return { error: "Selected recipient does not belong to this customer." };
  }

  const { data: existingCodeRow } = await db
    .from("transactions")
    .select("id")
    .eq("reference_code", trimmedCode)
    .neq("id", payload.transactionId)
    .maybeSingle();

  if (existingCodeRow) return { error: "Reference code already in use." };

  const appliedRate = Number.isFinite(Number(payload.applied_rate)) && Number(payload.applied_rate) > 0
    ? Number(payload.applied_rate)
    : (amountAud > 0 ? Math.round(toman / amountAud) : 0);

  const updatePayload = {
    recipient_id: payload.recipientId,
    type: payload.type,
    amount_aud: amountAud,
    equivalent_toman: toman,
    applied_rate: appliedRate,
    source_of_funds: payload.source_of_funds?.trim() || null,
    reason_for_transfer: payload.reason_for_transfer?.trim() || null,
    payment_link: payload.payment_link?.trim() || null,
    reference_code: trimmedCode,
    status: payload.status,
  };

  const { error: updateError } = await db
    .from("transactions")
    .update(updatePayload)
    .eq("id", payload.transactionId);

  if (updateError) return { error: updateError.message };

  try {
    await writeAuditLog({
      actorId: admin.id,
      actorEmail: admin.email ?? "",
      action: "ASSISTED_TRANSACTION_UPDATED",
      targetType: "transaction",
      targetId: payload.transactionId,
      oldValue: txRow,
      newValue: updatePayload,
    });
  } catch {}

  return { success: true };
}

// ===========================================================================
// HARD DELETE TRANSACTION (CRM user timeline)
// ===========================================================================
export async function deleteAssistedTransactionForUser(payload: {
  transactionId: string;
  userId: string;
}) {
  const admin = await requireAdmin();
  const db = makeServiceRoleClient();

  if (!payload.transactionId) return { error: "Missing transaction ID." };
  if (!payload.userId) return { error: "Missing user ID." };

  const { data: txRow, error: txFetchError } = await db
    .from("transactions")
    .select("id, user_id, recipient_id, type, amount_aud, equivalent_toman, status, reference_code")
    .eq("id", payload.transactionId)
    .maybeSingle();

  if (txFetchError) return { error: txFetchError.message };
  if (!txRow) return { error: "Transaction not found." };
  if (txRow.user_id !== payload.userId) {
    return { error: "Transaction does not belong to this customer." };
  }

  const { error: deleteError } = await db
    .from("transactions")
    .delete()
    .eq("id", payload.transactionId)
    .eq("user_id", payload.userId);

  if (deleteError) return { error: deleteError.message };

  try {
    await writeAuditLog({
      actorId: admin.id,
      actorEmail: admin.email ?? "",
      action: "ASSISTED_TRANSACTION_DELETED",
      targetType: "transaction",
      targetId: payload.transactionId,
      oldValue: txRow,
    });
  } catch {}

  return { success: true };
}

// ===========================================================================
// LEDGER — all approved transactions for P&L tracking
// ===========================================================================
export async function getLedgerData(page = 1, pageSize = 20) {
  const ssrClient = await createSupabaseServerActionClient();
  await requireAdmin(ssrClient);
  const db = makeServiceRoleClient();

  const safePage = clampInt(page, 1, MAX_AUDIT_PAGE, 1);
  const safeSize = clampInt(pageSize, 1, 100, 20);
  const offset   = (safePage - 1) * safeSize;

  const [allRes, pageRes, rateRes] = await Promise.all([
    // All ledger rows — for P&L metrics
    db.from("ledger").select("type, amount_aud, amount_toman, fee_aud"),
    // Paginated rows — for the table
    db
      .from("ledger")
      .select("id, transaction_id, date_gregorian, date_jalali, type, exchange_rate, amount_aud, amount_toman, sender, recipient, fee_aud, notes, created_at")
      .order("date_gregorian", { ascending: false })
      .order("created_at",     { ascending: false })
      .range(offset, offset + safeSize - 1),
    // Current market rate
    db
      .from("rates_history")
      .select("buy_aud")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (allRes.error)  throw new Error(allRes.error.message);
  if (pageRes.error) throw new Error(pageRes.error.message);

  return {
    allLedgerRows:  allRes.data  ?? [],
    pageLedgerRows: pageRes.data ?? [],
    total:          allRes.data?.length ?? 0,
    currentBuyRate: Number(rateRes.data?.buy_aud ?? 0),
  };
}

// ===========================================================================
// LEDGER: Update any field in a ledger row
// ===========================================================================
export async function updateLedgerEntry(
  id: string,
  updates: {
    date_gregorian?: string;
    type?: "buy_aud" | "sell_aud";
    exchange_rate?: number;
    amount_aud?: number;
    amount_toman?: number;
    sender?: string;
    recipient?: string;
    fee_aud?: number;
    notes?: string;
  }
): Promise<{ success: true } | { error: string }> {
  const admin = await requireAdmin();
  if (!id) return { error: "Missing ledger entry ID." };

  const patch: Record<string, unknown> = {};

  if (updates.date_gregorian !== undefined) {
    const d = new Date(updates.date_gregorian);
    if (isNaN(d.getTime())) return { error: "Invalid date." };
    patch.date_gregorian = updates.date_gregorian;
    patch.date_jalali    = toJalaliStr(d);
  }
  if (updates.type !== undefined) {
    if (!["buy_aud", "sell_aud"].includes(updates.type)) return { error: "Invalid type." };
    patch.type = updates.type;
  }
  if (updates.exchange_rate !== undefined) {
    if (!Number.isFinite(updates.exchange_rate) || updates.exchange_rate <= 0) return { error: "Invalid exchange rate." };
    patch.exchange_rate = updates.exchange_rate;
  }
  if (updates.amount_aud !== undefined) {
    if (!Number.isFinite(updates.amount_aud) || updates.amount_aud <= 0) return { error: "Invalid AUD amount." };
    patch.amount_aud = updates.amount_aud;
  }
  if (updates.amount_toman !== undefined) {
    if (!Number.isFinite(updates.amount_toman) || updates.amount_toman <= 0) return { error: "Invalid Toman amount." };
    patch.amount_toman = updates.amount_toman;
  }
  if (updates.sender !== undefined) patch.sender = updates.sender.trim();
  if (updates.recipient !== undefined) patch.recipient = updates.recipient.trim();
  if (updates.fee_aud !== undefined) {
    if (!Number.isFinite(updates.fee_aud) || updates.fee_aud < 0) return { error: "Invalid fee." };
    patch.fee_aud = updates.fee_aud;
  }
  if (updates.notes !== undefined) patch.notes = updates.notes.trim() || null;

  if (Object.keys(patch).length === 0) return { success: true };

  const db = makeServiceRoleClient();
  const { data: before } = await db.from("ledger").select("type, amount_aud, amount_toman, exchange_rate, fee_aud").eq("id", id).single();
  const { error } = await db.from("ledger").update(patch).eq("id", id);
  if (error) return { error: error.message };

  try {
    await writeAuditLog({
      actorId:    admin.id,
      actorEmail: admin.email ?? "",
      action:     "LEDGER_ENTRY_UPDATED",
      targetType: "ledger",
      targetId:   id,
      oldValue:   before,
      newValue:   patch,
    });
  } catch {}

  return { success: true };
}

// ===========================================================================
// LEDGER: Add a manual ledger entry (no linked transaction)
// ===========================================================================
export async function addManualLedgerEntry({
  type, amountAud, amountToman, exchangeRate, sender, recipient, feeAud, dateGregorian, notes,
}: {
  type: "buy_aud" | "sell_aud";
  amountAud: number;
  amountToman: number;
  exchangeRate?: number;
  sender?: string;
  recipient?: string;
  feeAud?: number;
  dateGregorian?: string;  // "YYYY-MM-DD"
  notes?: string;
}): Promise<{ success: true } | { error: string }> {
  const admin = await requireAdmin();
  if (!["buy_aud", "sell_aud"].includes(type)) return { error: "Invalid type." };
  if (!Number.isFinite(amountAud)   || amountAud   <= 0) return { error: "Invalid AUD amount." };
  if (!Number.isFinite(amountToman) || amountToman <= 0) return { error: "Invalid Toman amount." };
  if (feeAud !== undefined && (!Number.isFinite(feeAud) || feeAud < 0)) return { error: "Invalid fee." };

  const txDate  = dateGregorian ? new Date(dateGregorian + "T00:00:00.000Z") : new Date();
  const dateGre = txDate.toISOString().slice(0, 10);
  const dateJal = toJalaliStr(txDate);
  const rate    = exchangeRate ?? (amountAud > 0 ? amountToman / amountAud : 0);

  const db = makeServiceRoleClient();
  const { error } = await db.from("ledger").insert([{
    transaction_id:  null,
    date_gregorian:  dateGre,
    date_jalali:     dateJal,
    type,
    exchange_rate:   rate,
    amount_aud:      amountAud,
    amount_toman:    amountToman,
    sender:          sender?.trim()    ?? "",
    recipient:       recipient?.trim() ?? "",
    fee_aud:         feeAud ?? 0,
    notes:           notes?.trim() || null,
    created_by:      admin.id,
  }]);

  if (error) return { error: error.message };

  try {
    await writeAuditLog({
      actorId:    admin.id,
      actorEmail: admin.email ?? "",
      action:     "MANUAL_LEDGER_ENTRY_ADDED",
      targetType: "ledger",
      targetId:   dateGre,
      newValue:   { type, amount_aud: amountAud, amount_toman: amountToman, sender, recipient, fee_aud: feeAud },
    });
  } catch {}

  return { success: true };
}

// ===========================================================================
// LEDGER: Delete a ledger entry
// ===========================================================================
export async function deleteLedgerEntry(
  id: string,
): Promise<{ success: true } | { error: string }> {
  const admin = await requireAdmin();
  if (!id) return { error: "Missing ledger entry ID." };

  const db = makeServiceRoleClient();
  const { data: before } = await db.from("ledger").select("type, amount_aud, amount_toman, date_gregorian").eq("id", id).single();
  const { error } = await db.from("ledger").delete().eq("id", id);
  if (error) return { error: error.message };

  try {
    await writeAuditLog({
      actorId:    admin.id,
      actorEmail: admin.email ?? "",
      action:     "LEDGER_ENTRY_DELETED",
      targetType: "ledger",
      targetId:   id,
      oldValue:   before,
      newValue:   null,
    });
  } catch {}

  return { success: true };
}
