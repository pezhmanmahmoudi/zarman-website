"use server";

import { createClient } from "@supabase/supabase-js";
import { getFinanceConfig } from "@/lib/finance-config";
import { calcLoyaltyDiscount, calcAppliedFee, applyPromoCode } from "@/lib/pricing";
import type { PromoCodeData } from "@/lib/pricing";
import { createSupabaseServerActionClient } from "@/lib/supabase-server";
import type { Recipient } from "@/app/[locale]/dashboard/dashboard.types";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Generate a unique ZE + 5-digit reference code, retrying on the rare collision. */
async function generateReferenceCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = "ZE" + Math.floor(Math.random() * 100000).toString().padStart(5, "0");
    const { data } = await supabaseAdmin
      .from("transactions")
      .select("id")
      .eq("reference_code", code)
      .maybeSingle();
    if (!data) return code;
  }
  // Extremely unlikely fallback: use last 5 digits of current timestamp
  return "ZE" + Date.now().toString().slice(-5);
}

async function getAuthenticatedUserId() {
  const supabaseServer = await createSupabaseServerActionClient();

  const { data, error } = await supabaseServer.auth.getUser();
  if (error || !data.user) {
    throw new Error("Unauthorized request");
  }

  return data.user.id;
}

export async function processTransactionSecurely({
  rawAmount,
  txType,
  sourceOfFunds,
  reasonForTransfer,
  recipientId,
  promoCode,
}: {
  rawAmount: number;
  txType: "buy_aud" | "sell_aud";
  sourceOfFunds: string;
  reasonForTransfer: string;
  recipientId?: string | null;
  promoCode?: string | null;
}) {
  if (rawAmount <= 0) return { error: "اطلاعات نامعتبر است." };
  if (!sourceOfFunds) return { error: "لطفاً منبع وجه را انتخاب کنید." };
  if (!reasonForTransfer) return { error: "لطفاً دلیل انتقال را انتخاب کنید." };

  try {
    const authenticatedUserId = await getAuthenticatedUserId();

    // ۱. دریافت آخرین نرخ
    const { data: rateData, error: rateError } = await supabaseAdmin
      .from("rates_history")
      .select("buy_aud, sell_aud")
      .order("date", { ascending: false })
      .limit(1)
      .single();

    if (rateError || !rateData) {
      return { error: "دریافت نرخ جهانی با مشکل مواجه شد." };
    }

    const spread = Math.abs(rateData.sell_aud - rateData.buy_aud);

    // ۲. بررسی سوابق و دریافت تنظیمات مالی (موازی)
    const [userTxsResult, financeConfig] = await Promise.all([
      supabaseAdmin
        .from("transactions")
        .select("amount_aud")
        .eq("user_id", authenticatedUserId)
        .eq("status", "approved"),
      getFinanceConfig(),
    ]);
    if (userTxsResult.error) {
      return { error: "دریافت سوابق تراکنش با مشکل مواجه شد." };
    }

    const approvedVolume =
      userTxsResult.data?.reduce((sum, tx) => sum + Number(tx.amount_aud || 0), 0) || 0;

    // ۳. محاسبات وفاداری
    const loyaltyBonus = calcLoyaltyDiscount(approvedVolume, spread, financeConfig);
    const baseRate = txType === "buy_aud" ? rateData.sell_aud : rateData.buy_aud;
    const tailoredRate = txType === "buy_aud" ? baseRate - loyaltyBonus : baseRate + loyaltyBonus;
    const appliedFee = calcAppliedFee(rawAmount, financeConfig);

    // ۴. اعتبارسنجی کد تخفیف — قبل از محاسبهٔ معادل تومان
    // percentage: نرخ بهتر به کاربر داده می‌شود — buy_aud → sell_rate کاهش | sell_aud → buy_rate افزایش
    // fixed:   مبلغ AUD کاهش می‌یابد، نرخ ثابت می‌ماند
    let discount_amount = 0;
    let final_amount = rawAmount;
    let resolvedPromoCode: string | null = null;
    let promoAdjustedRate = tailoredRate;

    if (promoCode && promoCode.trim()) {
      const trimmedCode = promoCode.trim().toUpperCase();
      const { data: promoRow, error: promoError } = await supabaseAdmin
        .from("promo_codes")
        .select("code, discount_type, discount_value, max_uses, used_count, active, expires_at")
        .eq("code", trimmedCode)
        .single();

      if (promoError || !promoRow) {
        return { error: "کد تخفیف معتبر نیست." };
      }

      const promoResult = applyPromoCode(rawAmount, tailoredRate, txType, promoRow as PromoCodeData);
      if (!promoResult.valid) {
        return { error: promoResult.error };
      }

      promoAdjustedRate = promoResult.effectiveRate;
      discount_amount = promoResult.discount_amount;
      final_amount = promoResult.final_amount;
      resolvedPromoCode = trimmedCode;

      // افزایش شمارنده استفاده از کد
      await supabaseAdmin
        .from("promo_codes")
        .update({ used_count: promoRow.used_count + 1 })
        .eq("code", trimmedCode);
    }

    // For percentage promos: final_amount = rawAmount (AUD unchanged, rate improved).
    // For fixed promos: final_amount < rawAmount (AUD reduced, rate unchanged).
    const effectiveAud = txType === "buy_aud"
      ? final_amount + appliedFee
      : Math.max(final_amount - appliedFee, 0);
    const equivalentToman = Math.round(effectiveAud * promoAdjustedRate);
    const loyalty_discount_toman = loyaltyBonus > 0 ? Math.round(effectiveAud * loyaltyBonus) : 0;

    // ۵. اعتبارسنجی گیرنده (اگر انتخاب شده بود)
    // __edu_exam__ یک گیرنده مجازی است و نیاز به جستجو در دیتابیس ندارد
    const resolvedRecipientId = (recipientId === "__edu_exam__") ? null : recipientId;
    if (resolvedRecipientId) {
      const { data: recipientRow, error: recipientError } = await supabaseAdmin
        .from("recipients")
        .select("id, user_id")
        .eq("id", resolvedRecipientId)
        .single();

      if (recipientError || !recipientRow) {
        return { error: "گیرنده انتخاب‌شده معتبر نیست." };
      }
      if (recipientRow.user_id !== authenticatedUserId) {
        return { error: "دسترسی به این گیرنده مجاز نیست." };
      }
    }

    // ۶. ثبت در دیتابیس
    const referenceCode = await generateReferenceCode();

    const { error: insertError } = await supabaseAdmin
      .from("transactions")
      .insert([{
        user_id: authenticatedUserId,
        type: txType,
        amount_aud: rawAmount,
        equivalent_toman: equivalentToman,
        status: "pending",
        source_of_funds: sourceOfFunds,
        reason_for_transfer: reasonForTransfer,
        recipient_id: resolvedRecipientId ?? null,
        promo_code: resolvedPromoCode,
        discount_amount,
        final_amount,
        loyalty_discount: loyalty_discount_toman,
        reference_code: referenceCode,
      }]);

    if (insertError) return { error: "خطا در ثبت تراکنش." };

    // Accumulate loyalty savings in the user's profile total
    if (loyalty_discount_toman > 0) {
      const { data: profileRow } = await supabaseAdmin
        .from("profiles")
        .select("loyalty_discount_toman")
        .eq("id", authenticatedUserId)
        .single();
      const currentTotal = Number(profileRow?.loyalty_discount_toman ?? 0);
      await supabaseAdmin
        .from("profiles")
        .update({ loyalty_discount_toman: currentTotal + loyalty_discount_toman })
        .eq("id", authenticatedUserId);
    }

    return {
      success: true,
      data: {
        baseRate,
        tailoredRate,
        promoAdjustedRate,
        loyaltyBonus,
        equivalentToman,
        appliedFee,
        rawAmount,
        discount_amount,
        final_amount,
        promo_code: resolvedPromoCode,
        loyalty_discount: loyalty_discount_toman,
      }
    };

  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized request") {
      return { error: "Unauthorized request" };
    }
    console.error("Server Error:", error);
    return { error: "خطای سیستمی رخ داد." };
  }
}

export async function deleteTransactionSecurely(transactionId: number | string) {
  if (!transactionId) return { error: "شناسه نامعتبر." };

  try {
    const authenticatedUserId = await getAuthenticatedUserId();
    const { error } = await supabaseAdmin
      .from("transactions")
      .delete()
      .eq("id", transactionId)
      .eq("user_id", authenticatedUserId);
    if (error) return { error: "عملیات حذف ناموفق بود." };

    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized request") {
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
  } catch (err) {
    return { error: "خطای سیستمی رخ داد." };
  }
}

