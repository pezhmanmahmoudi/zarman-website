"use server";

import { createClient } from "@supabase/supabase-js";
import { applyPromoCode } from "@/lib/pricing";
import type { PromoCodeData } from "@/lib/pricing";
import { createSupabaseServerActionClient } from "@/lib/supabase-server";
import type { Recipient, Transaction } from "@/app/[locale]/dashboard/dashboard.types";
import { normalizeRecipientInput } from "@/lib/dashboard/recipient-input";
import { cleanSearchTerm, DASHBOARD_PAGE_SIZE, ilikeAny, requestedPage } from "@/lib/dashboard/paging";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAuthenticatedUserId() {
  const supabaseServer = await createSupabaseServerActionClient();

  const { data, error } = await supabaseServer.auth.getUser();
  if (error || !data.user) {
    throw new Error("Unauthorized request");
  }

  return data.user.id;
}

/** Retained for stale browser bundles. New requests must explicitly accept a
 * server-issued quote; the former WhatsApp action cannot bypass that workflow. */
export async function processTransactionSecurely(input?: unknown) {
  void input;
  return { error: "Please refresh the dashboard and review a new online quote before submitting." };
}

export async function deleteTransactionSecurely(transactionId: number | string) {
  if (!transactionId) return { error: "شناسه نامعتبر." };

  try {
    const authenticatedUserId = await getAuthenticatedUserId();
    const { error } = await supabaseAdmin
      .from("transactions")
      .delete()
      .eq("id", transactionId)
      .eq("user_id", authenticatedUserId)
      .eq("status", "pending")
      .is("approved_at", null);
    if (error) return { error: "عملیات حذف ناموفق بود." };

    return { success: true };
  } catch (caughtError) {
    if (caughtError instanceof Error && caughtError.message === "Unauthorized request") {
      return { error: "Unauthorized request" };
    }
    return { error: "خطای سرور در هنگام حذف." };
  }
}

// ---------------------------------------------------------------------------
// Paginated user transaction history (10 per page)
// ---------------------------------------------------------------------------
const TX_PAGE_SIZE = 10;

export async function getUserTransactionsPaginated(page: number = 1) {
  try {
    const authenticatedUserId = await getAuthenticatedUserId();
    const safePage = Math.max(1, Math.trunc(page));
    const from = (safePage - 1) * TX_PAGE_SIZE;
    const to = from + TX_PAGE_SIZE - 1;

    const { data, error, count } = await supabaseAdmin
      .from("transactions")
      .select(
        "id, type, amount_aud, equivalent_toman, status, created_at, promo_code, discount_amount, final_amount, recipients(id, label, full_name, account_name)",
        { count: "exact" }
      )
      .eq("user_id", authenticatedUserId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) return { error: "دریافت تراکنش‌ها با مشکل مواجه شد." };

    return {
      success: true,
      data: data ?? [],
      totalCount: count ?? 0,
      page: safePage,
      pageSize: TX_PAGE_SIZE,
      totalPages: Math.ceil((count ?? 0) / TX_PAGE_SIZE),
    };
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized request") {
      return { error: "Unauthorized request" };
    }
    return { error: "خطای سیستمی رخ داد." };
  }
}

/** Records from before the request workflow, i.e. transactions no exchange request points to. */
export async function getLegacyTransactions() {
  try {
    const authenticatedUserId = await getAuthenticatedUserId();
    const [linked, rows] = await Promise.all([
      supabaseAdmin.from("exchange_requests").select("transaction_id").eq("user_id", authenticatedUserId).not("transaction_id", "is", null),
      supabaseAdmin.from("transactions")
        .select("id,user_id,type,amount_aud,equivalent_toman,status,created_at,recipient_id,promo_code,discount_amount,loyalty_discount,final_amount,reference_code,recipients(id,label,full_name,account_name)")
        .eq("user_id", authenticatedUserId).order("created_at", { ascending: false }),
    ]);
    if (linked.error || rows.error) return { error: "دریافت تراکنش‌ها با مشکل مواجه شد." };
    const ids = new Set((linked.data ?? []).map(row => String(row.transaction_id)));
    return { success: true, data: (rows.data ?? []).filter(row => !ids.has(String(row.id))) as unknown as Transaction[] };
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized request") {
      return { error: "Unauthorized request" };
    }
    return { error: "خطای سیستمی رخ داد." };
  }
}

// ---------------------------------------------------------------------------
// Recipient CRUD — all server-side validated against the authenticated user
// ---------------------------------------------------------------------------

export async function getRecipients() {
  try {
    const authenticatedUserId = await getAuthenticatedUserId();
    const { data, error } = await supabaseAdmin
      .from("recipients")
      .select("*")
      .eq("user_id", authenticatedUserId)
      .is("archived_at", null)
      .order("created_at", { ascending: false });

    if (error) return { error: "دریافت لیست گیرندگان با مشکل مواجه شد." };
    return { success: true, data: (data ?? []) as Recipient[] };
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized request") {
      return { error: "Unauthorized request" };
    }
    return { error: "خطای سیستمی رخ داد." };
  }
}

const RECIPIENT_SEARCH_COLUMNS = ["label", "account_name", "full_name", "bank_name", "bank_city", "account_number", "shaba_number", "irt_account_number"];

/** One page of the Recipients directory plus per-country counts for the filter pills. */
export async function getRecipientPage(input: { direction?: string; search?: string; page?: number }) {
  try {
    const authenticatedUserId = await getAuthenticatedUserId();
    const direction = input?.direction === "aud" || input?.direction === "irt" ? input.direction : null;
    const term = cleanSearchTerm(input?.search);
    const countOf = (value: "aud" | "irt") => supabaseAdmin.from("recipients").select("id", { count: "exact", head: true })
      .eq("user_id", authenticatedUserId).is("archived_at", null).eq("direction", value);
    const pageOf = (page: number) => {
      let query = supabaseAdmin.from("recipients").select("*", { count: "exact" }).eq("user_id", authenticatedUserId).is("archived_at", null);
      if (direction) query = query.eq("direction", direction);
      if (term) query = query.or(ilikeAny(RECIPIENT_SEARCH_COLUMNS, term));
      const from = (page - 1) * DASHBOARD_PAGE_SIZE;
      return query.order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, from + DASHBOARD_PAGE_SIZE - 1);
    };
    let page = requestedPage(input?.page);
    const [first, aud, irt] = await Promise.all([pageOf(page), countOf("aud"), countOf("irt")]);
    let rows = first;
    const lastPage = Math.max(1, Math.ceil((rows.count ?? 0) / DASHBOARD_PAGE_SIZE));
    if (!rows.error && page > lastPage) { page = lastPage; rows = await pageOf(page); }
    if (rows.error || aud.error || irt.error) return { error: "دریافت لیست گیرندگان با مشکل مواجه شد." };
    const counts = { aud: aud.count ?? 0, irt: irt.count ?? 0 };
    return { success: true, data: (rows.data ?? []) as Recipient[], total: rows.count ?? 0, page, counts: { all: counts.aud + counts.irt, ...counts } };
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized request") {
      return { error: "Unauthorized request" };
    }
    return { error: "خطای سیستمی رخ داد." };
  }
}

/** Small overview preview; the full directory is fetched only on its own page. */
export async function getRecentRecipients() {
  try {
    const authenticatedUserId = await getAuthenticatedUserId();
    const { data, error } = await supabaseAdmin
      .from("recipients")
      .select("id,user_id,direction,label,account_name,full_name,bank_name,bank_city,created_at")
      .eq("user_id", authenticatedUserId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(2);
    if (error) return { error: "دریافت گیرندگان ممکن نشد." };
    return { success: true, data: (data ?? []) as Pick<Recipient, "id" | "user_id" | "direction" | "label" | "account_name" | "full_name" | "bank_name" | "bank_city" | "created_at">[] };
  } catch {
    return { error: "دریافت گیرندگان ممکن نشد." };
  }
}

export async function createRecipient(payload: Omit<Recipient, "id" | "user_id" | "created_at">) {
  try {
    const authenticatedUserId = await getAuthenticatedUserId();

    const normalized = normalizeRecipientInput(payload);
    if (normalized.error) return { error: normalized.error, fieldErrors: normalized.fieldErrors };

    const { data, error } = await supabaseAdmin
      .from("recipients")
      .insert([{ ...normalized.data, user_id: authenticatedUserId }])
      .select("*")
      .single();

    if (error) return { error: "ذخیره گیرنده با مشکل مواجه شد." };
    return { success: true, data: data as Recipient };
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized request") {
      return { error: "Unauthorized request" };
    }
    return { error: "خطای سیستمی رخ داد." };
  }
}

/** Saves edits as a new row and archives the old one, so earlier transactions keep the details they were sent with. */
export async function updateRecipient(recipientId: string, payload: Omit<Recipient, "id" | "user_id" | "created_at">) {
  if (!recipientId) return { error: "شناسه نامعتبر." };
  try {
    const authenticatedUserId = await getAuthenticatedUserId();

    const normalized = normalizeRecipientInput(payload);
    if (normalized.error || !normalized.data) return { error: normalized.error, fieldErrors: normalized.fieldErrors };
    const input = normalized.data;

    const { data: current, error: lookupError } = await supabaseAdmin
      .from("recipients")
      .select("id,direction,created_at")
      .eq("id", recipientId)
      .eq("user_id", authenticatedUserId)
      .is("archived_at", null)
      .maybeSingle();
    // The account country is fixed after creation.
    if (lookupError || !current || current.direction !== input.direction) return { error: "ویرایش گیرنده با مشکل مواجه شد." };

    const { data: replacement, error: insertError } = await supabaseAdmin
      .from("recipients")
      .insert([{ ...input, user_id: authenticatedUserId, created_at: current.created_at }])
      .select("*")
      .single();
    if (insertError || !replacement) return { error: "ویرایش گیرنده با مشکل مواجه شد." };

    const { data: archived, error: archiveError } = await supabaseAdmin
      .from("recipients")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", recipientId)
      .eq("user_id", authenticatedUserId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();
    if (archiveError || !archived) {
      // The new row has never been used, so removing it leaves no trace.
      await supabaseAdmin.from("recipients").delete().eq("id", replacement.id).eq("user_id", authenticatedUserId);
      return { error: "ویرایش گیرنده با مشکل مواجه شد." };
    }
    return { success: true, data: replacement as Recipient };
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized request") {
      return { error: "Unauthorized request" };
    }
    return { error: "خطای سیستمی رخ داد." };
  }
}

/** Archives rather than deletes, so transactions that used this recipient are untouched. */
export async function deleteRecipient(recipientId: string) {
  if (!recipientId) return { error: "شناسه نامعتبر." };
  try {
    const authenticatedUserId = await getAuthenticatedUserId();
    const { data, error } = await supabaseAdmin
      .from("recipients")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", recipientId)
      .eq("user_id", authenticatedUserId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (error || !data) return { error: "حذف گیرنده با مشکل مواجه شد." };
    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized request") {
      return { error: "Unauthorized request" };
    }
    return { error: "خطای سیستمی رخ داد." };
  }
}

// ---------------------------------------------------------------------------
// Validate a promo code for display in the form (no DB side-effect)
// ---------------------------------------------------------------------------
export async function validatePromoCode(
  code: string,
  amountAud: number,
  currentRate: number,
  direction: "buy_aud" | "sell_aud",
) {
  if (!code?.trim() || amountAud <= 0 || currentRate <= 0) {
    return { error: "اطلاعات نامعتبر است." };
  }
  try {
    const { data, error } = await supabaseAdmin
      .from("promo_codes")
      .select("code, discount_type, discount_value, max_uses, used_count, active, expires_at")
      .eq("code", code.trim().toUpperCase())
      .single();

    if (error || !data) return { error: "کد تخفیف یافت نشد." };

    const result = applyPromoCode(amountAud, currentRate, direction, data as PromoCodeData);
    if (!result.valid) return { error: result.error };

    return {
      success: true,
      discount_amount: result.discount_amount,   // IRT benefit (Toman)
      final_amount: result.final_amount,          // AUD unchanged
      effective_rate: result.effectiveRate,
      discount_type: data.discount_type,
      discount_value: data.discount_value,
    };
  } catch {
    return { error: "خطای سیستمی رخ داد." };
  }
}

