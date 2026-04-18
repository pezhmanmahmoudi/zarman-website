export function toFaDigits(input: string) {
  return input.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

export function faToEnDigits(input: string) {
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  return input.replace(/[۰-۹]/g, (d) => String(fa.indexOf(d)));
}

export function getRawNumber(value: string) {
  const normalized = faToEnDigits(value)
    .replace(/،/g, "")
    .replace(/,/g, "")
    .replace(/[^\d.]/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

export function formatNumberFa(num: number, isToman = false) {
  if (!num) return "۰";
  const options: Intl.NumberFormatOptions = isToman
    ? { maximumFractionDigits: 0 }
    : { maximumFractionDigits: 2 };
  return toFaDigits(Number(num).toLocaleString("en-US", options)).replace(/,/g, "،");
}

export function formatAUD(num: number) {
  return `$${formatNumberFa(num)}`;
}

export function formatToman(num: number) {
  return `${formatNumberFa(num, true)} تومان`;
}

export function formatDateValue(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("fa-IR");
}

type RateRow = {
  currency_code?: string;
  pair?: string;
  sell_aud?: number | string | null;
};

type RateContextShape = {
  rates?: RateRow[];
};

export function extractBaseRateFromContext(rateContext: RateContextShape | null | undefined): number | null {
  // ۱. بررسی می‌کنیم آیا اصلاً دیتایی از سوپابیس آمده است یا خیر
  if (!rateContext || !rateContext.rates || rateContext.rates.length === 0) {
    console.error("خطای بحرانی: نرخ‌ها از سرور دریافت نشدند! ثبت تراکنش باید مسدود شود.");
    return null; // 👈 تغییر امنیتی: برگشت null به جای عدد هاردکد شده
  }

  // ۲. پیدا کردن ردیف نرخ حواله استرالیا از دیتابیس
    const audRate = rateContext.rates.find((r) => r.currency_code === "AUD" || r.pair === "AUD/IRR");
  
  if (audRate && audRate.sell_aud) {
    return Number(audRate.sell_aud); 
  }

  // در صورت پیدا نشدن دیتای دقیق
  return null; // 👈 تغییر امنیتی
}

export function normalizeLabel(key: string) {
  const map: Record<string, string> = {
    id: "شناسه کاربر", first_name: "نام", last_name: "نام خانوادگی",
    full_name: "نام کامل", email: "ایمیل", mobile_number: "شماره موبایل",
    phone_number: "شماره تلفن", telephone: "تلفن", date_of_birth: "تاریخ تولد",
    dob: "تاریخ تولد", birth_date: "تاریخ تولد", address: "آدرس",
    address_line1: "آدرس ۱", address_line2: "آدرس ۲", suburb: "حومه / Suburb",
    city: "شهر", state: "ایالت", postcode: "کدپستی", post_code: "کدپستی",
    country: "کشور", national_id: "شناسه / کدملی", passport_number: "شماره پاسپورت",
    kyc_status: "وضعیت احراز هویت", created_at: "تاریخ ایجاد", updated_at: "آخرین بروزرسانی",
  };
  if (map[key]) return map[key];
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function valueToDisplay(key: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (["date_of_birth", "dob", "birth_date", "created_at", "updated_at"].includes(key)) {
    return formatDateValue(String(value));
  }
  if (key === "kyc_status") {
    switch (String(value)) {
      case "approved": return "تایید شده";
      case "pending": return "در انتظار تایید";
      case "under_review": return "در حال بررسی";
      case "rejected": return "رد شده";
      default: return String(value);
    }
  }
  if (typeof value === "boolean") return value ? "بله" : "خیر";
  return String(value);
}