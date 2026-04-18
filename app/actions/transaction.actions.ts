"use server";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { FINANCE_CONFIG } from "@/lib/pricing";


// اتصال مستقیم به سوپابیس با کلید ادمین (Service Role) برای دور زدن محدودیت‌ها و دسترسی به حقیقت مطلق دیتابیس
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // 👈 حتما این کلید را در فایل .env.local خود داشته باشید
);


export async function processTransactionSecurely({ userId, rawAmount, txType }: { userId: string, rawAmount: number, txType: "buy_aud" | "sell_aud" }) {
  void userId; // برای حفظ سازگاری قرارداد ورودی فعلی فرانت نگه داشته شده ولی مبنای احراز هویت نیست
  if (rawAmount <= 0) return { error: "اطلاعات نامعتبر است." };

  try {
    // هویت کاربر باید فقط از سشن امن سرور استخراج شود (و نه ورودی کلاینت)
    const cookieStore = await cookies();
    const supabaseServer = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { data: authData, error: authError } = await supabaseServer.auth.getUser();
    const authenticatedUserId = authData?.user?.id;
    if (authError || !authenticatedUserId) {
      return { error: "دسترسی غیرمجاز. لطفا دوباره وارد شوید." };
    }

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
      .eq("user_id", authenticatedUserId)
      .eq("status", "approved");

    if (txError) return { error: "خطا در بررسی سوابق کاربر." };

    const approvedVolume = userTxs.reduce((sum, tx) => sum + Number(tx.amount_aud || 0), 0);

    // ۴. 🧠 منطق جدید محاسبه وفاداری (درصدی از اسپرد) 🧠
    const volumeSteps = Math.floor(approvedVolume / FINANCE_CONFIG.DISCOUNT_STEP_VOLUME);
    const rawDiscountPercent = volumeSteps * FINANCE_CONFIG.DISCOUNT_PERCENT_PER_STEP;
    const finalDiscountPercent = Math.min(rawDiscountPercent, FINANCE_CONFIG.MAX_DISCOUNT_PERCENT);
    
    const loyaltyBonus = spread * finalDiscountPercent; // مبلغ تخفیف محاسبه شد

    // ۵. محاسبه نرخ نهایی (Tailored Rate)
    const baseRate = txType === "buy_aud" ? rateData.sell_aud : rateData.buy_aud;
    // اگر مشتری دلار می‌خرد (تومان می‌دهد) باید تومان کمتری بدهد (-)
    // اگر مشتری دلار می‌فروشد (تومان می‌گیرد) باید تومان بیشتری بگیرد (+)
    const tailoredRate = txType === "buy_aud" ? baseRate - loyaltyBonus : baseRate + loyaltyBonus;

    // ۶. محاسبه کارمزد خرد و معادل تومانی نهایی
    const appliedFee = (rawAmount > 0 && rawAmount < FINANCE_CONFIG.FEE_THRESHOLD) ? FINANCE_CONFIG.APPLIED_FEE : 0;
    const effectiveAud = txType === "buy_aud" ? rawAmount + appliedFee : Math.max(rawAmount - appliedFee, 0);
    const equivalentToman = Math.round(effectiveAud * tailoredRate);

    // ۷. ثبت نهایی در دیتابیس توسط خود سرور (کلاینت دیگر اجازه Insert ندارد)
    const { error: insertError } = await supabaseAdmin
      .from("transactions")
      .insert([{
        user_id: authenticatedUserId,
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

  } catch (error: unknown) {
    console.error("Server Action Error:", error);
    return { error: "خطای ناشناخته در سرور رخ داد." };
  }
}