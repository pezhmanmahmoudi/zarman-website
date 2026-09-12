export const REQUEST_EMAIL_TEMPLATE_VERSION = "request-status-v1";

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
};

export type RequestEmailPayload = {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  tags: { name: string; value: string }[];
};

const statuses: Record<string, [string, string]> = {
  submitted: ["Request received", "درخواست ثبت شد"],
  under_review: ["Under review", "در حال بررسی"],
  action_required: ["Action required", "نیازمند اقدام شما"],
  awaiting_funds: ["Awaiting funds", "در انتظار واریز وجه"],
  ready: ["Ready for processing", "آماده پردازش"],
  processing: ["Processing", "در حال انجام"],
  completed: ["Completed", "تکمیل شد"],
  cancelled: ["Cancelled", "لغو شد"],
  rejected: ["Rejected", "رد شد"],
  expired: ["Expired", "منقضی شد"],
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

export function validNotificationEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(value);
}

export function validatedRequestSiteUrl(value: string | undefined): string {
  if (!value) throw new Error("missing_site_url");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("invalid_site_url");
  }
  return url.origin;
}

/** Only the immutable, public milestone snapshot is accepted here. Bank details,
 * profile data and internal notes are deliberately not template inputs. */
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
  const status = (statuses[snapshot.workflow_status] ?? ["Request updated", "درخواست به‌روزرسانی شد"])[index];
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
  const heading = fa ? "به‌روزرسانی درخواست زرمان" : "Your Zarman request update";
  const subject = `${isManagement ? (fa ? "مدیریت | " : "Operations | ") : ""}${reference}: ${status} | Zarman`;
  const lines = [
    `${fa ? "شماره پیگیری" : "Reference"}: ${reference}`,
    `${fa ? "وضعیت" : "Status"}: ${status}`,
    `${fa ? "زمان به وقت سیدنی" : "Updated (Sydney time)"}: ${time}`,
    `${fa ? "نوع خدمت" : "Service"}: ${service}`,
    ...(isPriority ? [`${fa ? "هزینه اضافی پذیرفته‌شده" : "Accepted additional fee"}: AUD ${fee.toFixed(2)}`] : []),
  ];
  const linkText = fa ? "مشاهده درخواست" : "View request";
  return {
    from: settings.from,
    to: [snapshot.recipient_email],
    subject,
    text: `${heading}\n\n${lines.join("\n")}\n\n${action}\n${trackingUrl}\n\nZarman Exchange`,
    html: `<!doctype html><html lang="${locale}" dir="${fa ? "rtl" : "ltr"}"><body style="margin:0;background:#f3f5f7;font-family:Arial,sans-serif;color:#162a38"><div style="max-width:560px;margin:24px auto;padding:28px;background:#fff;border-radius:12px"><p style="color:#1b6964;font-weight:bold">ZARMAN EXCHANGE</p><h1 style="font-size:22px">${escapeHtml(heading)}</h1>${lines.map((line) => `<p style="line-height:1.6">${escapeHtml(line)}</p>`).join("")}<p style="line-height:1.6">${escapeHtml(action)}</p><p><a href="${escapeHtml(trackingUrl)}" style="display:inline-block;padding:12px 20px;background:#145f59;color:#fff;border-radius:8px;text-decoration:none">${linkText}</a></p></div></body></html>`,
    tags: [{ name: "request_delivery_id", value: snapshot.id }],
  };
}
