"use server";

import { createClient } from "@supabase/supabase-js";
import { applyPromoCode } from "@/lib/pricing";
import type { PromoCodeData } from "@/lib/pricing";
import { createSupabaseServerActionClient } from "@/lib/supabase-server";
import type { Recipient } from "@/app/[locale]/dashboard/dashboard.types";

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

export async function createRecipient(payload: Omit<Recipient, "id" | "user_id" | "created_at">) {
  try {
    const authenticatedUserId = await getAuthenticatedUserId();

    // Basic validation
    if (!payload.direction || !["aud", "irt"].includes(payload.direction)) {
      return { error: "جهت انتقال نامعتبر است." };
    }
    if (!payload.label?.trim()) {
      return { error: "برچسب گیرنده الزامی است." };
    }

    const { data, error } = await supabaseAdmin
      .from("recipients")
      .insert([{ ...payload, user_id: authenticatedUserId }])
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

export async function deleteRecipient(recipientId: string) {
  if (!recipientId) return { error: "شناسه نامعتبر." };
  try {
    const authenticatedUserId = await getAuthenticatedUserId();
    const { error } = await supabaseAdmin
      .from("recipients")
      .delete()
      .eq("id", recipientId)
      .eq("user_id", authenticatedUserId);

    if (error) return { error: "حذف گیرنده با مشکل مواجه شد." };
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

