export type RequestLocale = "en" | "fa";

const statuses: Record<string, [string, string]> = {
  submitted: ["Submitted", "ثبت شده"],
  under_review: ["Under review", "در حال بررسی"],
  action_required: ["Action required", "نیازمند اقدام شما"],
  awaiting_funds: ["Awaiting payment", "در انتظار واریز"],
  ready: ["Ready for processing", "آماده پردازش"],
  processing: ["Processing", "در حال انجام"],
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
};

export function requestLabel(status: string, locale: RequestLocale) {
  return statuses[status]?.[locale === "fa" ? 1 : 0] ?? status.replaceAll("_", " ");
}

export function requestMoney(amount: number | string | null | undefined, currency: string, locale: RequestLocale) {
  return `${new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-AU", { maximumFractionDigits: currency.toUpperCase() === "AUD" ? 2 : 0 }).format(Number(amount || 0))} ${currency === "IRT" || currency.toLowerCase() === "toman" ? (locale === "fa" ? "تومان" : "Toman") : currency.toUpperCase()}`;
}

export function requestDate(value: string | null | undefined, locale: RequestLocale) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Australia/Sydney" }).format(date);
}

export const isRequestTerminal = (status: string) => ["completed", "cancelled", "rejected", "expired"].includes(status);
