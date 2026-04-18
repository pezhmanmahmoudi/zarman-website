"use server";

import { createClient } from "@supabase/supabase-js";

// اتصال مستقیم به سوپابیس با کلید ادمین
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CONFIG = {
  DISCOUNT_STEP_VOLUME: 1000,
  DISCOUNT_PERCENT_PER_STEP: 0.005,
  MAX_DISCOUNT_PERCENT: 0.50,
  FEE_THRESHOLD: 1000,
  APPLIED_FEE: 15,
};

// 🔒 تابع جدید: بررسی اعتبار توکن ارسالی از سمت مرورگر
async function getSecureUserFromToken(accessToken: string) {
  if (!accessToken) return null;
  // سرور با استفاده از کلید ادمین، اعتبار این توکن را مستقیماً از هسته سوپابیس می‌پرسد
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !user) return null;
  return user;
}

// ============================================================================
// ۱. تابع ثبت تراکنش امن
// ============================================================================
export async function processTransactionSecurely({ accessToken, rawAmount, txType }: { accessToken: string, rawAmount: number, txType: "buy_aud" | "sell_aud" }) {
  
  const user = await getSecureUserFromToken(accessToken);

  if (!user) {
    return { error: "نشست کاربری نامعتبر است. لطفا دوباره وارد شوید یا صفحه را رفرش کنید." };
  }

  const secureUserId = user.id;

  if (rawAmount <= 0) return { error: "اطلاعات نامعتبر است." };

  try {
    const { data: rateData, error: rateError } = await supabaseAdmin
      .from("rates_history")
      .select("buy_aud, sell_aud")
      .order("date", { ascending: false })
      .limit(1)
      .single();

    if (rateError || !rateData || !rateData.sell_aud || !rateData.buy_aud) {
      return { error: "دریافت نرخ جهانی با مشکل مواجه شد. لطفا بعدا تلاش کنید." };
    }

    const spread = Math.abs(rateData.sell_aud - rateData.buy_aud);

    const { data: userTxs, error: txError } = await supabaseAdmin
      .from("transactions")
      .select("amount_aud")
      .eq("user_id", secureUserId) 
      .eq("status", "approved");

    if (txError) return { error: "خطا در بررسی سوابق کاربر." };

    const approvedVolume = userTxs.reduce((sum, tx) => sum + Number(tx.amount_aud || 0), 0);

    const volumeSteps = Math.floor(approvedVolume / CONFIG.DISCOUNT_STEP_VOLUME);
    const rawDiscountPercent = volumeSteps * CONFIG.DISCOUNT_PERCENT_PER_STEP;
    const finalDiscountPercent = Math.min(rawDiscountPercent, CONFIG.MAX_DISCOUNT_PERCENT);
    
    const loyaltyBonus = spread * finalDiscountPercent;

    const baseRate = txType === "buy_aud" ? rateData.sell_aud : rateData.buy_aud;
    const tailoredRate = txType === "buy_aud" ? baseRate - loyaltyBonus : baseRate + loyaltyBonus;

    const appliedFee = (rawAmount > 0 && rawAmount < CONFIG.FEE_THRESHOLD) ? CONFIG.APPLIED_FEE : 0;
    const effectiveAud = txType === "buy_aud" ? rawAmount + appliedFee : Math.max(rawAmount - appliedFee, 0);
    const equivalentToman = Math.round(effectiveAud * tailoredRate);

    const { data: insertData, error: insertError } = await supabaseAdmin
      .from("transactions")
      .insert([{
        user_id: secureUserId, 
        type: txType,
        amount_aud: rawAmount,
        equivalent_toman: equivalentToman, 
        status: "pending"
      }])
      .select()
      .single();

    if (insertError) return { error: "خطا در ثبت تراکنش در پایگاه داده." };

    return {
      success: true,
      data: { baseRate, tailoredRate, loyaltyBonus, equivalentToman, appliedFee, rawAmount }
    };

  } catch (error: any) {
    console.error("Server Action Error:", error);
    return { error: "خطای ناشناخته در سرور رخ داد." };
  }
}

// ============================================================================
// ۲. تابع حذف امن تراکنش
// ============================================================================
export async function deleteTransactionSecurely(transactionId: string, accessToken: string) {
  try {
    const user = await getSecureUserFromToken(accessToken);
    if (!user) return { error: "نشست کاربری نامعتبر است." };

    const { data: transaction, error: fetchError } = await supabaseAdmin
      .from("transactions")
      .select("user_id, status")
      .eq("id", transactionId)
      .single();

    if (fetchError || !transaction) return { error: "تراکنش یافت نشد." };

    if (transaction.user_id !== user.id) {
      return { error: "شما مجاز به حذف این تراکنش نیستید." };
    }

    if (transaction.status !== "pending") {
      return { error: "تراکنش‌های تایید شده یا رد شده قابل حذف نیستند." };
    }

    const { error: deleteError } = await supabaseAdmin
      .from("transactions")
      .delete()
      .eq("id", transactionId);

    if (deleteError) return { error: "خطا در حذف تراکنش." };

    return { success: true };

  } catch (error) {
    console.error("Delete Error:", error);
    return { error: "خطای سیستمی رخ داد." };
  }
}