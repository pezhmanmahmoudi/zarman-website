import { receiptAmount, requestReceiptRows, type RequestCompletionReceiptSnapshot } from "./receipt";
import { validNotificationEmail, validatedRequestSiteUrl } from "./notification-config";
import type { FundingBankDetails } from "./types";
export { validNotificationEmail, validatedRequestSiteUrl } from "./notification-config";

export const REQUEST_EMAIL_TEMPLATE_VERSION = "request-status-v5";

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
    payment_instructions_fa?: string | null;
    payment_details?: FundingBankDetails | null;
    funding_total?: number | string;
    funding_currency?: "AUD" | "IRT";
    australian_clearance_minutes?: number;
    iran_banking_notice?: string;
    iran_banking_notice_fa?: string;
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
  submitted: ["Request submitted · awaiting approval", "درخواست ثبت شد؛ در انتظار تأیید"],
  under_review: ["Under review", "در حال بررسی"],
  action_required: ["Action required", "نیازمند اقدام شما"],
  awaiting_funds: ["Awaiting funds", "در انتظار واریز وجه"],
  ready: ["Funds received", "وجه شما دریافت شد"],
  processing: ["Processing", "در حال انجام"],
  reconciliation: ["Checking bank settlement", "در حال بررسی تسویه بانکی"],
  completed: ["Completed", "تکمیل شد"],
  cancelled: ["Cancelled", "لغو شد"],
  rejected: ["Rejected", "رد شد"],
  expired: ["Expired", "منقضی شد"],
};

const eventLabels: Record<string, [string, string]> = {
  await_funds: ["Payment approved", "اجازه پرداخت صادر شد"],
  admin_message: ["Message from Zarman", "پیام زرمان"],
  customer_message: ["Customer reply", "پاسخ مشتری"],
  receipt_uploaded: ["Receipt submitted · checking your payment", "رسید ارسال شد؛ واریز در حال بررسی است"],
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
  const service = fa ? (isPriority ? "اولویت‌دار" : "عادی") : (isPriority ? "Priority" : "Standard");
  const occurred = new Date(snapshot.created_at);
  if (!Number.isFinite(occurred.getTime()) || !Number.isFinite(fee) || fee < 0) throw new Error("invalid_milestone_snapshot");
  const time = occurred.toLocaleString("en-AU-u-ca-gregory-nu-latn", { timeZone: "Australia/Sydney", dateStyle: "medium", timeStyle: "short" });
  const isMessage = ["admin_message", "customer_message"].includes(snapshot.event_type ?? "");
  let action = fa ? "جزئیات در صفحه درخواست." : "Details are on your request page.";
  if (snapshot.workflow_status === "action_required" || isMessage) action = fa ? "پاسخ خود را در صفحه درخواست بفرستید." : "Reply on the request page.";
  if (isManagement) action = fa ? "بررسی و پاسخ در پنل مدیریت." : "Review and respond in the admin workspace.";
  if (snapshot.event_type === "submitted") action = isManagement
    ? "Review the request and approve payment to release the bank details."
    : (fa ? "منتظر تأیید درخواست بمانید. پس از تأیید، مشخصات بانکی در صفحه درخواست نمایش داده می‌شود." : "Wait for approval. Bank details will appear on your request page once payment is approved.");
  if (snapshot.event_type === "await_funds" && !isManagement) action = fa ? "پس از واریز، رسید را در صفحه درخواست ارسال کنید." : "After making the transfer, send your receipt on the request page.";
  if (snapshot.workflow_status === "ready" && !isManagement) action = fa ? "وجه شما دریافت شد. تسویه در مقصد در حال پیگیری است." : "Your funds are received. We are arranging settlement in the destination currency.";
  const receipt = snapshot.event_type === "complete" ? snapshot.payload_snapshot?.receipt : null;
  if (snapshot.event_type === "complete" && (!receipt || receipt.request_id !== snapshot.request_id || receipt.reference_code !== snapshot.reference)) throw new Error("completion_receipt_unavailable");
  const heading = receipt ? (fa ? "رسید نهایی انتقال زرمان" : "Your Zarman transfer receipt") : status;
  const subject = `${isManagement ? (fa ? "مدیریت | " : "Operations | ") : ""}${reference}: ${status} | Zarman`;
  const lines = [
    `${fa ? "شماره پیگیری" : "Reference"}: ${reference}`,
    `${fa ? "زمان به وقت سیدنی" : "Updated (Sydney time)"}: ${time}`,
    ...(!isMessage ? [`${fa ? "نوع خدمت" : "Service"}: ${service}${isPriority ? ` · AUD ${fee.toFixed(2)} ${fa ? "هزینه اضافی" : "additional fee"}` : ""}`] : []),
  ];
  const details = snapshot.payload_snapshot;
  const instructions: string[] = [];
  if (snapshot.event_type === "await_funds") {
    const bank = details?.payment_details;
    const bankLabels: [keyof FundingBankDetails, string, string][] = [
      ["account_name", "Account name", "نام صاحب حساب"], ["bank_name", "Bank", "بانک"],
      ["bsb", "BSB", "BSB"], ["account_number", "Account number", "شماره حساب"],
      ["iban", "IBAN", "شماره شبا"], ["card_number", "Card number", "شماره کارت"],
    ];
    const bankLines = bankLabels.flatMap(([key, en, persian]) => bank?.[key]?.trim() ? [`${fa ? persian : en}: ${bank[key]}`] : []);
    const note = fa ? (details?.payment_instructions_fa || (!bankLines.length ? details?.payment_instructions : "")) : details?.payment_instructions;
    if ((!bankLines.length && !note?.trim()) || !["AUD", "IRT"].includes(details?.funding_currency ?? "") || !Number.isFinite(Number(details?.funding_total)) || Number(details?.funding_total) <= 0) {
      throw new Error("funding_instructions_unavailable");
    }
    instructions.push(
      `${fa ? "مبلغ واریز" : "Amount to transfer"}: ${receiptAmount(details!.funding_total!, details!.funding_currency!)}`,
      ...bankLines,
      ...(note?.trim() ? [note] : []),
      fa ? `کد پیگیری ${reference} را حتماً در توضیحات انتقال بانکی وارد کنید.` : `You must put your Reference Code ${reference} in your bank transfer description.`,
      fa ? "رسید بانکی را در صفحه درخواست بارگذاری کنید؛ وصول وجه جداگانه تأیید می‌شود." : "Upload your bank receipt on the request page; funds are confirmed separately.",
    );
  }
  if (["receipt_uploaded", "payment_evidence"].includes(snapshot.event_type ?? "")) {
    instructions.push(fa ? "رسید شما دریافت شد. تأیید وصول وجه توسط تیم مالی انجام می‌شود." : "We received your payment evidence. Our finance team will confirm when funds have cleared.");
  }
  if (["await_funds", "receipt_uploaded", "payment_evidence", "ready", "resume_funded_request", "start_processing"].includes(snapshot.event_type ?? "")) {
    const waitingForFunds = ["await_funds", "receipt_uploaded", "payment_evidence"].includes(snapshot.event_type ?? "") && !details?.funds_confirmed_at;
    if (waitingForFunds) instructions.push(details?.funding_currency === "AUD"
      ? (fa ? "پرداخت استرالیایی ممکن است سریع برسد. بعضی واریزهای بار اول یا بررسی‌های بانکی تا ۲۴ ساعت یا بیشتر طول می‌کشند؛ انتظار اجباری ۲۴ ساعته نداریم." : "Australian payments may arrive quickly. Some first-time transfers or bank checks take up to 24 hours, or longer; we do not impose a 24-hour wait.")
      : (fa ? "پس از بررسی وصول پرداخت تومانی، دریافت وجه تأیید می‌شود." : "We confirm the incoming Toman payment once cleared funds are verified."));
    instructions.push(
      ...(isPriority ? [fa ? "زمان اولویت فقط پس از تأیید دریافت وجه و تکمیل بررسی‌ها، در ساعات کاری شروع می‌شود." : "Priority timing starts only after funds are confirmed received and checks are complete, within business hours."] : []),
      details?.funding_currency === "AUD"
        ? (fa ? (details?.iran_banking_notice_fa || "واریز تومان تابع چرخه‌های ساتنا و پایا و تعطیلات بانکی است.") : (details?.iran_banking_notice || "Iranian payouts follow Satna/Paya cycles and bank holidays."))
        : (fa ? "زمان واریز دلار به گیرنده به بانک مقصد و روش پرداخت بستگی دارد." : "The AUD payout to the recipient depends on the receiving bank and payment method."),
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
