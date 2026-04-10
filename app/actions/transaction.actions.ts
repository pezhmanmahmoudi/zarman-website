"use server";

import { createClient } from "@supabase/supabase-js";

// اتصال مستقیم به سوپابیس با کلید ادمین (Service Role) برای دور زدن محدودیت‌ها و دسترسی به حقیقت مطلق دیتابیس
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // 👈 حتما این کلید را در فایل .env.local خود داشته باشید
);

// ⚙️ تنظیمات فرمول‌های مالی (شما بعداً می‌توانید این اعداد را به راحتی اینجا تغییر دهید) ⚙️
const CONFIG = {
  DISCOUNT_STEP_VOLUME: 1000,        // به ازای هر چند دلار حجم مبادلات تخفیف داده شود؟ (مثلا هر 1000 دلار)
  DISCOUNT_PERCENT_PER_STEP: 0.01,   // چند درصد از اسپرد بخشیده شود؟ (0.01 یعنی 1 درصد)
  MAX_DISCOUNT_PERCENT: 0.50,        // سقف تخفیف چقدر باشد؟ (0.50 یعنی کاربر حداکثر 50 درصد از اسپرد تخفیف بگیرد تا شما همیشه سود کنید)
  FEE_THRESHOLD: 1000,               // زیر این مبلغ کارمزد می‌خورد
  APPLIED_FEE: 15,                   // مبلغ کارمزد ثابت
};

export async function processTransactionSecurely({ userId, rawAmount, txType }: { userId: string, rawAmount: number, txType: "buy_aud" | "sell_aud" }) {
  if (!userId || rawAmount <= 0) return { error: "اطلاعات نامعتبر است." };

  try {
    // ۱. دریافت آخرین نرخ قطعی و واقعی از دیتابیس (بدون دخالت کاربر)
    const { data: rateData, error: rateError } = await supabaseAdmin
      .from("rates_history")
      .select("buy_aud, sell_aud")
      .order("date", { ascending: false })
      .limit(1)
      .single();

    if (rateError || !rateData || !rateData.sell_aud || !rateData.buy_aud) {
      return { error: "دریافت نرخ جهانی با مشکل مواجه شد. لطفا بعدا تلاش کنید." };
    }

    // ۲. محاسبه اسپرد (حاشیه سود صرافی) = تفاوت قیمت خرید و فروش
    const spread = Math.abs(rateData.sell_aud - rateData.buy_aud);

    // ۳. استخراج حجم کل تراکنش‌های موفق کاربر تا این لحظه (جلوگیری از تقلب کاربر در حجم)
    const { data: userTxs, error: txError } = await supabaseAdmin
      .from("transactions")
      .select("amount_aud")
      .eq("user_id", userId)
      .eq("status", "approved");

    if (txError) return { error: "خطا در بررسی سوابق کاربر." };

    const approvedVolume = userTxs.reduce((sum, tx) => sum + Number(tx.amount_aud || 0), 0);

    // ۴. 🧠 منطق جدید محاسبه وفاداری (درصدی از اسپرد) 🧠
    const volumeSteps = Math.floor(approvedVolume / CONFIG.DISCOUNT_STEP_VOLUME);
    const rawDiscountPercent = volumeSteps * CONFIG.DISCOUNT_PERCENT_PER_STEP;
    const finalDiscountPercent = Math.min(rawDiscountPercent, CONFIG.MAX_DISCOUNT_PERCENT);
    
    const loyaltyBonus = spread * finalDiscountPercent; // مبلغ تخفیف محاسبه شد

    // ۵. محاسبه نرخ نهایی (Tailored Rate)
    const baseRate = txType === "buy_aud" ? rateData.sell_aud : rateData.buy_aud;
    // اگر مشتری دلار می‌خرد (تومان می‌دهد) باید تومان کمتری بدهد (-)
    // اگر مشتری دلار می‌فروشد (تومان می‌گیرد) باید تومان بیشتری بگیرد (+)
    const tailoredRate = txType === "buy_aud" ? baseRate - loyaltyBonus : baseRate + loyaltyBonus;

    // ۶. محاسبه کارمزد خرد و معادل تومانی نهایی
    const appliedFee = (rawAmount > 0 && rawAmount < CONFIG.FEE_THRESHOLD) ? CONFIG.APPLIED_FEE : 0;
    const effectiveAud = txType === "buy_aud" ? rawAmount + appliedFee : Math.max(rawAmount - appliedFee, 0);
    const equivalentToman = Math.round(effectiveAud * tailoredRate);

    // ۷. ثبت نهایی در دیتابیس توسط خود سرور (کلاینت دیگر اجازه Insert ندارد)
    const { data: insertData, error: insertError } = await supabaseAdmin
      .from("transactions")
      .insert([{
        user_id: userId,
        type: txType,
        amount_aud: rawAmount,
        equivalent_toman: equivalentToman, // عدد کاملاً امن و سروری
        status: "pending"
      }])
      .select()
      .single();

    if (insertError) return { error: "خطا در ثبت تراکنش در پایگاه داده." };

    // ۸. برگرداندن اعداد دقیق به کلاینت فقط برای نوشتن در پیام واتس‌اپ
    return {
      success: true,
      data: {
        baseRate,
        tailoredRate,
        loyaltyBonus,
        equivalentToman,
        appliedFee,
        rawAmount
      }
    };

  } catch (error: any) {
    console.error("Server Action Error:", error);
    return { error: "خطای ناشناخته در سرور رخ داد." };
  }
}