import { receiptAmount, requestReceiptRows, type RequestCompletionReceiptSnapshot } from "./receipt";
import { validNotificationEmail, validatedRequestSiteUrl } from "./notification-config";
export { validNotificationEmail, validatedRequestSiteUrl } from "./notification-config";

export const REQUEST_EMAIL_TEMPLATE_VERSION = "request-status-v2";

export type RequestEmailSnapshot = {
  id: string;
  request_id: string;
  audience: "customer" | "management";
  recipient_email: string | null;
  locale: string;
  reference: string;
  workflow_status: string;
  event_type?: string;
  requested_tier: string;
  priority_fee_aud: number | string;
  created_at: string;
  payload_snapshot?: {
    public_message?: string | null;
    payment_instructions?: string | null;
    funding_total?: number | string;
    funding_currency?: "AUD" | "IRT";
    australian_clearance_minutes?: number;
    iran_banking_notice?: string;
    handling_due_at?: string | null;
    funds_confirmed_at?: string | null;
    receipt?: RequestCompletionReceiptSnapshot | null;
  };
};

export type RequestEmailPayload = {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  tags: { name: string; value: string }[];
  attachments?: { filename: string; content: string; contentType: "application/pdf" }[];
};

const statuses: Record<string, [string, string]> = {
  submitted: ["Request received", "درخواست ثبت شد"],
  under_review: ["Under review", "در حال بررسی"],
  action_required: ["Action required", "نیازمند اقدام شما"],
  awaiting_funds: ["Awaiting funds", "در انتظار واریز وجه"],
  ready: ["Ready for processing", "آماده پردازش"],
  processing: ["Processing", "در حال انجام"],
  reconciliation: ["Checking bank settlement", "در حال بررسی تسویه بانکی"],
  completed: ["Completed", "تکمیل شد"],
  cancelled: ["Cancelled", "لغو شد"],
  rejected: ["Rejected", "رد شد"],
  expired: ["Expired", "منقضی شد"],
};

const eventLabels: Record<string, [string, string]> = {
  receipt_uploaded: ["Payment receipt received", "رسید پرداخت دریافت شد"],
  payment_evidence: ["Payment evidence received", "مدرک پرداخت دریافت شد"],
  handling_overdue: ["Handling target overdue", "زمان هدف رسیدگی گذشته است"],
  funding_clearance_review: ["Bank clearance review required", "نیاز به بررسی تسویه بانکی"],
  bank_clearance_overdue: ["Bank clearance review required", "نیاز به بررسی تسویه بانکی"],
  refund_pending: ["Refund being arranged", "در حال انجام مراحل بازپرداخت"],
  refund_returned: ["Refund completed", "بازپرداخت انجام شد"],
  funds_recorded: ["Payment reconciliation update", "به‌روزرسانی بررسی پرداخت"],
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

/** Only the immutable, public milestone snapshot is accepted here. Company
 * funding instructions are snapshotted, and private evidence is never included. */
export function renderRequestNotification(
  snapshot: RequestEmailSnapshot,
  settings: { from: string; siteUrl: string },
): RequestEmailPayload {
  if (!validNotificationEmail(snapshot.recipient_email)) throw new Error("recipient_unavailable");
  if (!/^[0-9a-f-]{36}$/i.test(snapshot.request_id) || !/^[0-9a-f-]{36}$/i.test(snapshot.id)) {
    throw new Error("invalid_request_reference");
  }
  const siteUrl = validatedRequestSiteUrl(settings.siteUrl);
  const fa = snapshot.locale === "fa";
  const locale = fa ? "fa" : "en";
  const index = fa ? 1 : 0;
  const reference = snapshot.reference.replace(/[\r\n\u0000-\u001f]/g, "").slice(0, 80);
  const status = (eventLabels[snapshot.event_type ?? ""] ?? statuses[snapshot.workflow_status] ?? ["Request updated", "درخواست به‌روزرسانی شد"])[index];
  const isManagement = snapshot.audience === "management";
  const trackingUrl = isManagement
    ? `${siteUrl}/admin/requests/${snapshot.request_id}`
    : `${siteUrl}/${locale}/dashboard/requests/${snapshot.request_id}`;
  const isPriority = snapshot.requested_tier === "priority";
  const fee = Number(snapshot.priority_fee_aud);
  const service = fa ? (isPriority ? "اولویت‌دار (درخواست‌شده)" : "عادی") : (isPriority ? "Priority (requested)" : "Standard");
  const occurred = new Date(snapshot.created_at);
  if (!Number.isFinite(occurred.getTime()) || !Number.isFinite(fee) || fee < 0) throw new Error("invalid_milestone_snapshot");
  const time = occurred.toLocaleString(fa ? "fa-IR" : "en-AU", { timeZone: "Australia/Sydney", dateStyle: "medium", timeStyle: "short" });
  let action = fa ? "برای مشاهده وضعیت فعلی و مراحل بعد، وارد حساب خود شوید." : "Sign in to view the current status and next steps.";
  if (snapshot.workflow_status === "action_required") action = fa ? "وارد حساب خود شوید و موارد درخواست‌شده را تکمیل کنید." : "Sign in and complete the requested information or action.";
  if (snapshot.workflow_status === "awaiting_funds") action = fa ? "مبلغ و دستورالعمل واریز را در حساب خود بررسی کنید." : "Review the funding amount and payment instructions in your account.";
  if (isManagement) action = fa ? "درخواست و اقدامات باز را در صف مدیریت بررسی کنید." : "Review the request and open tasks in the management queue.";
  const receipt = snapshot.event_type === "complete" ? snapshot.payload_snapshot?.receipt : null;
  if (snapshot.event_type === "complete" && (!receipt || receipt.request_id !== snapshot.request_id || receipt.reference_code !== snapshot.reference)) throw new Error("completion_receipt_unavailable");
  const heading = receipt ? (fa ? "رسید نهایی انتقال زرمان" : "Your Zarman transfer receipt") : (fa ? "به‌روزرسانی درخواست زرمان" : "Your Zarman request update");
  const subject = `${isManagement ? (fa ? "مدیریت | " : "Operations | ") : ""}${reference}: ${status} | Zarman`;
  const lines = [
    `${fa ? "شماره پیگیری" : "Reference"}: ${reference}`,
    `${fa ? "وضعیت" : "Status"}: ${status}`,
    `${fa ? "زمان به وقت سیدنی" : "Updated (Sydney time)"}: ${time}`,
    `${fa ? "نوع خدمت" : "Service"}: ${service}`,
    ...(isPriority ? [`${fa ? "هزینه اضافی پذیرفته‌شده" : "Accepted additional fee"}: AUD ${fee.toFixed(2)}`] : []),
  ];
  const details = snapshot.payload_snapshot;
  const instructions: string[] = [];
  if (["submitted", "await_funds"].includes(snapshot.event_type ?? "")) {
    if (!details?.payment_instructions?.trim() || !["AUD", "IRT"].includes(details.funding_currency ?? "") || !Number.isFinite(Number(details.funding_total)) || Number(details.funding_total) <= 0) {
      throw new Error("funding_instructions_unavailable");
    }
    instructions.push(
      `${fa ? "مبلغ واریز" : "Amount to transfer"}: ${receiptAmount(details.funding_total!, details.funding_currency!)}`,
      details.payment_instructions,
      fa ? `کد پیگیری ${reference} را حتماً در توضیحات انتقال بانکی وارد کنید.` : `You must put your Reference Code ${reference} in your bank transfer description.`,
      fa ? "رسید انتقال بانکی را در صفحه درخواست بارگذاری کنید. بارگذاری رسید به معنی تأیید دریافت وجه نیست." : "Upload your bank transfer receipt on the request page. Uploading evidence does not confirm that funds have cleared.",
    );
  }
  if (["receipt_uploaded", "payment_evidence"].includes(snapshot.event_type ?? "")) {
    instructions.push(fa ? "رسید شما دریافت شد. تأیید وصول وجه توسط تیم مالی انجام می‌شود." : "We received your payment evidence. Our finance team will confirm when funds have cleared.");
  }
  if (["submitted", "await_funds", "receipt_uploaded", "payment_evidence", "ready", "resume_funded_request", "start_processing"].includes(snapshot.event_type ?? "")) {
    const hours = Math.max(24, Number(details?.australian_clearance_minutes ?? 1440) / 60);
    instructions.push(
      fa ? `تسویه بانک استرالیا ممکن است تا ${hours} ساعت و در صورت تأخیر بانکی بیشتر طول بکشد.` : `Australian bank clearance can take up to ${hours} hours, and longer if the bank delays payment.`,
      fa ? "زمان هدف اولویت فقط پس از تأیید دریافت وجه و تکمیل بررسی‌های لازم، در ساعات کاری محاسبه می‌شود." : "The Priority handling target starts only after funds are confirmed received and required checks are complete, during operating hours.",
      details?.iran_banking_notice || (fa ? "پرداخت ریالی تابع چرخه‌های بانکی ساتنا و پایا، تعطیلات و زمان پردازش بانک است." : "Iranian payouts depend on Satna/Paya banking cycles, holidays and bank processing times."),
    );
  }
  if (details?.public_message) instructions.push(details.public_message);
  if (receipt) {
    // The receipt is the same immutable settlement snapshot for both audiences.
    lines.push(...requestReceiptRows(receipt).map(([label, value]) => `${label}: ${value}`));
    action = fa ? "رسید نهایی PDF پیوست شده است. نسخه آن در صفحه درخواست نیز موجود است." : "Your final PDF receipt is attached and is also available from the request page.";
  }
  const linkText = fa ? "مشاهده درخواست" : "View request";
  return {
    from: settings.from,
    to: [snapshot.recipient_email],
    subject,
    text: `${heading}\n\n${lines.join("\n")}\n\n${instructions.join("\n\n")}\n\n${action}\n${trackingUrl}\n\nZarman Exchange`,
    html: `<!doctype html><html lang="${locale}" dir="${fa ? "rtl" : "ltr"}"><body style="margin:0;background:#f3f5f7;font-family:Arial,sans-serif;color:#162a38"><div style="max-width:560px;margin:24px auto;padding:28px;background:#fff;border-radius:12px"><p style="color:#1b6964;font-weight:bold">ZARMAN EXCHANGE</p><h1 style="font-size:22px">${escapeHtml(heading)}</h1>${lines.map((line) => `<p style="line-height:1.6">${escapeHtml(line)}</p>`).join("")}${instructions.map((line) => `<p style="line-height:1.6;white-space:pre-wrap">${escapeHtml(line)}</p>`).join("")}<p style="line-height:1.6">${escapeHtml(action)}</p><p><a href="${escapeHtml(trackingUrl)}" style="display:inline-block;padding:12px 20px;background:#145f59;color:#fff;border-radius:8px;text-decoration:none">${linkText}</a></p></div></body></html>`,
    tags: [{ name: "request_delivery_id", value: snapshot.id }],
  };
}
