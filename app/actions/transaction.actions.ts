"use server";

import { createClient } from "@supabase/supabase-js";
import { getFinanceConfig } from "@/lib/finance-config";
import { calcLoyaltyDiscount, calcAppliedFee } from "@/lib/pricing";
import { createSupabaseServerActionClient } from "@/lib/supabase-server";

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

export async function processTransactionSecurely({ rawAmount, txType }: { rawAmount: number, txType: "buy_aud" | "sell_aud" }) {
  if (rawAmount <= 0) return { error: "اطلاعات نامعتبر است." };

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

    // ۳. محاسبات وفاداری (با تنظیمات دینامیک از دیتابیس)
    const loyaltyBonus = calcLoyaltyDiscount(approvedVolume, spread, financeConfig);

    const baseRate = txType === "buy_aud" ? rateData.sell_aud : rateData.buy_aud;
    const tailoredRate = txType === "buy_aud" ? baseRate - loyaltyBonus : baseRate + loyaltyBonus;

    const appliedFee = calcAppliedFee(rawAmount, financeConfig);
    const effectiveAud = txType === "buy_aud" ? rawAmount + appliedFee : Math.max(rawAmount - appliedFee, 0);
    const equivalentToman = Math.round(effectiveAud * tailoredRate);

    // ۴. ثبت در دیتابیس
    const { error: insertError } = await supabaseAdmin
      .from("transactions")
      .insert([{
        user_id: authenticatedUserId,
        type: txType,
        amount_aud: rawAmount,
        equivalent_toman: equivalentToman,
        status: "pending"
      }]);

    if (insertError) return { error: "خطا در ثبت تراکنش." };

    return {
      success: true,
      data: { baseRate, tailoredRate, loyaltyBonus, equivalentToman, appliedFee, rawAmount }
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
