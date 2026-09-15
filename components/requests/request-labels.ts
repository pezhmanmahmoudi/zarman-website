export type RequestLocale = "en" | "fa";

const statuses: Record<string, [string, string]> = {
  submitted: ["Awaiting approval", "در انتظار تأیید"],
  under_review: ["Under review", "در حال بررسی"],
  action_required: ["Action required", "نیازمند اقدام شما"],
  awaiting_funds: ["Awaiting payment", "در انتظار واریز"],
  ready: ["Ready for processing", "آماده پردازش"],
  processing: ["Processing", "در حال انجام"],
  reconciliation: ["Bank settlement under review", "در حال تطبیق تسویه بانکی"],
  completed: ["Completed", "تکمیل شده"],
  cancelled: ["Cancelled", "لغو شده"],
  rejected: ["Rejected", "رد شده"],
  expired: ["Expired", "منقضی شده"],
  unpaid: ["Not confirmed", "تأیید نشده"],
  pending: ["Pending", "در انتظار"],
  partial: ["Part payment received", "بخشی از وجه دریافت شده"],
  cleared: ["Funds confirmed", "وجه تأیید شده"],
  confirmed: ["Confirmed", "تأیید شده"],
  evidence_received: ["Payment evidence received", "اطلاعات واریز دریافت شده"],
  receipt_uploaded: ["Bank receipt uploaded", "رسید بانکی آپلود شد"],
  not_applicable: ["Not applicable", "نیاز نیست"],
  paid: ["Paid", "پرداخت شده"],
  not_required: ["Not applicable", "نیاز نیست"],
  quoted: ["Quoted; not yet collected", "در پیش‌فاکتور؛ هنوز دریافت نشده"],
  collected: ["Collected", "دریافت شده"],
  refund_pending: ["Refund pending", "در انتظار بازپرداخت"],
  refunded: ["Refund returned", "بازپرداخت انجام شده"],
  earned: ["Service delivered", "خدمت ارائه شده"],
  open: ["Open", "باز"],
  responded: ["Response submitted", "پاسخ ثبت شده"],
  resolved: ["Resolved", "حل شده"],
  closed: ["Closed", "بسته شده"],
  await_funds: ["Request approved", "درخواست تأیید شد"],
  review: ["In review", "در حال بررسی"],
  request_info: ["Information requested", "اطلاعات بیشتر لازم است"],
  respond: ["Customer reply", "پاسخ شما"],
  admin_message: ["Team message", "پیام زرمان"],
  customer_message: ["Customer message", "پیام شما"],
  funds_recorded: ["Payment reviewed", "واریز بررسی شد"],
  start_processing: ["Processing started", "پردازش آغاز شد"],
  complete: ["Completed", "تکمیل شد"],
  cancel: ["Cancelled", "لغو شد"],
  reject: ["Rejected", "رد شد"],
  resume_funded_request: ["Request resumed", "درخواست از سر گرفته شد"],
  record_uncertain_payout: ["Settlement review", "بررسی تسویه"],
  refund_returned: ["Refund completed", "بازپرداخت شد"],
  skipped: ["Email not sent", "ایمیل ارسال نشد"],
  provider_accepted: ["Email sent", "ایمیل ارسال شد"],
  delivered: ["Delivered", "تحویل شد"],
  leased: ["Sending", "در حال ارسال"],
  failed: ["Not delivered", "تحویل نشد"],
  suppressed: ["Email blocked", "ایمیل مسدود شد"],
  reconciliation_required: ["Check delivery", "نیازمند بررسی ارسال"],
};

export function requestLabel(status: string, locale: RequestLocale) {
  return statuses[status]?.[locale === "fa" ? 1 : 0] ?? (locale === "fa" ? "به‌روزرسانی" : status.replaceAll("_", " "));
}

/** Server errors are language-neutral; customer-facing feedback follows the page locale. */
export function requestError(error: string, locale: RequestLocale): string {
  if (locale !== "fa") return error;
  if (/[\u0600-\u06ff]/.test(error)) return error;
  const translations: Array<[RegExp, string]> = [
    [/wait for (?:staff )?payment approval|payment.*not.*approved|PAYMENT_APPROVAL/i, "ابتدا منتظر تأیید پرداخت از سوی مدیر بمانید."],
    [/changed|stale|refresh.*before|VERSION|QUOTE_CHANGED/i, "اطلاعات این درخواست تغییر کرده است. صفحه را تازه کنید و دوباره تلاش کنید."],
    [/sign in|authenticate|session|log.?in/i, "برای ادامه وارد حساب خود شوید."],
    [/verify.*email|email.*verif/i, "ابتدا نشانی ایمیل خود را تأیید کنید."],
    [/Identity|verification must|KYC/i, "ابتدا احراز هویت خود را تکمیل کنید."],
    [/priority.*unavailable|PRIORITY_CAPACITY|capacity.*full/i, "ظرفیت سرویس اولویت‌دار تکمیل است. سرویس استاندارد را انتخاب کنید."],
    [/paused|REQUESTS_DISABLED|submissions.*not available|temporarily unavailable|market.*closed/i, "ثبت درخواست فعلاً متوقف است. بعداً دوباره تلاش کنید."],
    [/already.*recorded|duplicate|IDEMPOTENCY/i, "این عملیات قبلاً ثبت شده است. صفحه را تازه کنید."],
    [/not found|unavailable for your account|permission|not allowed/i, "این درخواست در دسترس شما نیست."],
    [/up to 4 MB|file.*large/i, "حجم رسید باید حداکثر ۴ مگابایت باشد."],
    [/PDF|JPEG|PNG|receipt.*format|file.*type|unsupported/i, "رسید را با فرمت PDF، JPG یا PNG بارگذاری کنید."],
    [/ten receipts|receipt.*limit/i, "حداکثر ۱۰ رسید مجاز است. از بخش پیام‌ها با ما تماس بگیرید."],
    [/receipts can only|receipt.*awaiting review/i, "بارگذاری رسید در این مرحله امکان‌پذیر نیست."],
    [/2,?000|message.*long|message.*empty|enter the reason|write a message/i, "پیامی بین ۱ تا ۲۰۰۰ نویسه بنویسید."],
    [/wait a minute|too many|rate.?limit/i, "کمی صبر کنید و دوباره تلاش کنید."],
    [/recipient|institution|invoice|payment link/i, "اطلاعات گیرنده و مقصد پرداخت را بررسی کنید."],
    [/promotion|promo code/i, "کد تخفیف معتبر نیست یا دیگر قابل استفاده نیست."],
    [/quote.*expir|quote.*valid|quote.*unavailable/i, "پیش‌فاکتور جدید بگیرید و مبلغ را تأیید کنید."],
    [/amount|funding|currency|funds|source of funds/i, "مبلغ، ارز و اطلاعات پرداخت را بررسی کنید."],
    [/email.*managed|email update/i, "تنظیمات ارسال ایمیل توسط مدیر تعیین می‌شود."],
    [/could not|connection|network|try again|unavailable/i, "ارتباط برقرار نشد. دوباره تلاش کنید."],
  ];
  return translations.find(([pattern]) => pattern.test(error))?.[1] ?? "انجام این کار ممکن نشد. صفحه را تازه کنید و دوباره تلاش کنید.";
}

export function requestMoney(amount: number | string | null | undefined, currency: string, locale: RequestLocale) {
  return `${new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-AU", { maximumFractionDigits: currency.toUpperCase() === "AUD" ? 2 : 0 }).format(Number(amount || 0))} ${currency === "IRT" || currency.toLowerCase() === "toman" ? (locale === "fa" ? "تومان" : "Toman") : currency.toUpperCase()}`;
}

export function requestDate(value: string | null | undefined, _locale?: RequestLocale) {
  void _locale;
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-AU-u-ca-gregory-nu-latn", { dateStyle: "medium", timeStyle: "short", timeZone: "Australia/Sydney" }).format(date);
}

export const isRequestTerminal = (status: string) => ["completed", "cancelled", "rejected", "expired"].includes(status);
