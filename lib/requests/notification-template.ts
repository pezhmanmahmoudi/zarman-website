import { receiptAmount, validateRequestReceipt, type RequestCompletionReceiptSnapshot } from "./receipt";
import { validNotificationEmail, validatedRequestSiteUrl } from "./notification-config";
import type { FundingBankDetails } from "./types";
export { validNotificationEmail, validatedRequestSiteUrl } from "./notification-config";

export const REQUEST_EMAIL_TEMPLATE_VERSION = "request-customer-en-v8";

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
    sender_name?: string | null;
    recipient_name?: string | null;
    recipient_amount?: number | string;
    recipient_currency?: "AUD" | "IRT";
    public_message?: string | null;
    customer_action_required?: string | null;
    payment_instructions?: string | null;
    payment_details?: FundingBankDetails | null;
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

const statuses: Record<string, string> = {
  submitted: "Request submitted · awaiting approval",
  under_review: "Under review",
  action_required: "Under admin review",
  awaiting_funds: "Awaiting funds",
  ready: "Funds received",
  processing: "Processing",
  reconciliation: "Checking bank settlement",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Rejected",
  expired: "Expired",
};

const eventLabels: Record<string, string> = {
  await_funds: "Payment approved",
  admin_message: "Message from Zarman",
  customer_message: "Customer reply",
  receipt_uploaded: "Receipt submitted · checking your payment",
  payment_evidence: "Payment evidence received",
  handling_overdue: "Handling target overdue",
  funding_clearance_review: "Bank clearance review required",
  bank_clearance_overdue: "Bank clearance review required",
  refund_pending: "Refund being arranged",
  refund_returned: "Refund completed",
  funds_recorded: "Payment reconciliation update",
  request_info: "Your reply is needed",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

type SummaryRow = { label: string; value: string; ltr?: boolean; prominent?: boolean };

function publicName(value: unknown): string | null {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 500) || null : null;
}

function formattedAmount(amount: number | string | undefined, currency: string | undefined): string | null {
  if (amount === undefined || String(amount).trim() === "" || !Number.isFinite(Number(amount)) || Number(amount) <= 0 || !["AUD", "IRT"].includes(currency ?? "")) return null;
  return receiptAmount(amount, currency as "AUD" | "IRT");
}

/** Fluid tables and inline styles keep the content readable without web fonts,
 * images, JavaScript, or client-specific layout support. Rounded corners are
 * progressive enhancement; all facts and actions survive their absence. */
function emailHtml(input: {
  heading: string; greeting: string; intro: string; rows: SummaryRow[];
  instructions: string[]; action: string; trackingUrl: string; reference: string;
}): string {
  const { heading, greeting, intro, rows, instructions, action, trackingUrl, reference } = input;
  const paragraph = (value: string) => `<p style="margin:0 0 20px;font-size:16px;line-height:1.7;white-space:pre-wrap;word-wrap:break-word">${escapeHtml(value)}</p>`;
  const support = "If you don't recognise this transfer or have a question, contact the Zarman team through the messages on your request page. Include your transaction code so we can identify your transfer.";
  return `<!doctype html>
<html lang="en" dir="ltr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background-color:#ffffff;color:#202124;font-family:Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${escapeHtml(`${heading} · Transaction code: ${reference}`)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="width:100%;border-collapse:collapse"><tr><td align="center" style="padding:40px 20px">
<!--[if mso]><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" dir="ltr" style="width:100%;max-width:600px;table-layout:fixed;border-collapse:collapse"><tr><td align="left" style="text-align:left;direction:ltr">
<p style="margin:0 0 36px;font-size:25px;line-height:1.25;font-weight:700;letter-spacing:1px;color:#145f59"><span dir="ltr">ZARMAN</span><br><span dir="ltr" style="font-size:10px;letter-spacing:3px">EXCHANGE</span></p>
<h1 style="margin:0 0 30px;font-size:30px;line-height:1.35;font-weight:700;letter-spacing:-0.3px">${escapeHtml(heading)}</h1>
${paragraph(greeting)}${paragraph(intro)}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f4f5f6" style="width:100%;table-layout:fixed;background-color:#f4f5f6;border-radius:18px;border-collapse:separate"><tr><td style="padding:22px 20px 2px;text-align:left;direction:ltr">
${rows.map(({ label, value, ltr, prominent }) => `<p style="margin:0 0 20px;font-size:16px;line-height:1.5;word-wrap:break-word${prominent ? ";padding-top:16px;border-top:1px solid #dfe4e3" : ""}"><span style="color:${prominent ? "#145f59;font-weight:700" : "#6b6d71"}">${escapeHtml(label)}</span><br><${prominent ? "strong" : "span"}${ltr ? ' dir="ltr"' : ""} style="${ltr ? "display:inline-block;direction:ltr;unicode-bidi:embed;" : ""}${prominent ? "font-size:24px;font-weight:700;letter-spacing:1px;color:#145f59" : "font-weight:400"}">${escapeHtml(value)}</${prominent ? "strong" : "span"}></p>`).join("\n")}
</td></tr></table>
<div style="height:28px;line-height:28px;font-size:1px" aria-hidden="true">&nbsp;</div>
${instructions.map(paragraph).join("\n")}${paragraph(action)}
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;margin:4px 0 30px"><tr><td align="center" bgcolor="#145f59" style="border-radius:24px;background-color:#145f59"><a href="${escapeHtml(trackingUrl)}" style="display:inline-block;border:1px solid #145f59;border-radius:24px;padding:13px 24px;font-size:15px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;mso-padding-alt:0"><!--[if mso]><i style="mso-font-width:150%;mso-text-raise:16pt" hidden>&emsp;</i><![endif]--><span style="mso-text-raise:8pt">View request</span><!--[if mso]><i style="mso-font-width:150%" hidden>&emsp;&#8203;</i><![endif]--></a></td></tr></table>
${paragraph(support)}
<p style="margin:28px 0 0;font-size:16px;line-height:1.7">— Team Zarman</p>
<p style="margin:30px 0 0;padding-top:18px;border-top:1px solid #eceeef;font-size:12px;line-height:1.7;color:#6b6d71">This email is an update about your Zarman request.</p>
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}

/** Only the immutable, public milestone snapshot is accepted here. Company
 * funding instructions are snapshotted, and private evidence is never included. */
export function renderRequestNotification(
  snapshot: RequestEmailSnapshot,
  settings: { from: string; siteUrl: string },
): RequestEmailPayload {
  // Retain the legacy audience in the input type so old outbox rows can be
  // inspected safely, but never render a management email.
  if (snapshot.audience !== "customer") throw new Error("management_email_disabled");
  if (!validNotificationEmail(snapshot.recipient_email)) throw new Error("recipient_unavailable");
  if (!/^[0-9a-f-]{36}$/i.test(snapshot.request_id) || !/^[0-9a-f-]{36}$/i.test(snapshot.id)) {
    throw new Error("invalid_request_reference");
  }
  const siteUrl = validatedRequestSiteUrl(settings.siteUrl);
  // Customer emails use one English template, independent of the site's UI locale.
  const reference = snapshot.reference.replace(/[\r\n\u0000-\u001f]/g, "").slice(0, 80);
  const details = snapshot.payload_snapshot;
  const terminal = ["completed", "cancelled", "rejected", "expired"].includes(snapshot.workflow_status);
  const customerQuestion = !terminal ? details?.customer_action_required?.trim()
    || (snapshot.event_type === "request_info" ? details?.public_message?.trim() : null) : null;
  const fundsReceived = Boolean(details?.funds_confirmed_at) && !terminal;
  const heldFunds = fundsReceived && ["under_review", "action_required"].includes(snapshot.workflow_status);
  const status = (snapshot.event_type === "funds_recorded" && heldFunds
    ? "Funds received · under admin review"
    : eventLabels[snapshot.event_type ?? ""] ?? statuses[snapshot.workflow_status] ?? "Request updated");
  const trackingUrl = `${siteUrl}/en/dashboard/requests/${snapshot.request_id}`;
  const isPriority = snapshot.requested_tier === "priority";
  const fee = Number(snapshot.priority_fee_aud);
  const service = isPriority ? "Priority" : "Standard";
  const occurred = new Date(snapshot.created_at);
  if (!Number.isFinite(occurred.getTime()) || !Number.isFinite(fee) || fee < 0) throw new Error("invalid_milestone_snapshot");
  const time = occurred.toLocaleString("en-AU-u-ca-gregory-nu-latn", { timeZone: "Australia/Sydney", dateStyle: "medium", timeStyle: "short" });
  const isMessage = ["admin_message", "customer_message"].includes(snapshot.event_type ?? "");
  let action = "Details are on your request page.";
  if (isMessage) action = "You can reply on the request page if needed.";
  if (heldFunds) action = "Your funds are received and under admin review. No action is needed from you.";
  if (snapshot.event_type === "submitted") action = "Wait for approval. Bank details will appear on your request page once payment is approved.";
  if (snapshot.event_type === "await_funds") action = "After making the transfer, send your receipt on the request page.";
  if (snapshot.workflow_status === "ready") action = "Your funds are received. We are arranging settlement in the destination currency. No action is needed from you.";
  if (customerQuestion) action = "Reply on the request page.";
  const receipt = snapshot.event_type === "complete" ? snapshot.payload_snapshot?.receipt : null;
  if (snapshot.event_type === "complete" && (!receipt || receipt.request_id !== snapshot.request_id || receipt.reference_code !== snapshot.reference)) throw new Error("completion_receipt_unavailable");
  if (receipt) validateRequestReceipt(receipt);
  const heading = receipt ? "Your transfer was successful" : status;
  const senderName = publicName(receipt?.sender_name ?? details?.sender_name);
  const recipientName = publicName(receipt?.recipient_name ?? details?.recipient_name);
  const recipientAmount = formattedAmount(receipt?.recipient_amount ?? details?.recipient_amount, receipt?.recipient_currency ?? details?.recipient_currency);
  const fundingAmount = formattedAmount(details?.funding_total, details?.funding_currency);
  const greeting = senderName ? `Hi ${senderName},` : "Hello,";
  const intro = receipt
    ? `You sent ${recipientAmount} to ${recipientName}. You can find the details below:`
    : (isMessage ? "You have a new message from the Zarman team about your request."
      : "Your Zarman request has been updated. You can find the details below:");
  const subject = `Transaction ${reference}: ${heading} | Zarman`;
  const rows: SummaryRow[] = [
    ...(recipientName && !isMessage ? [{ label: "To", value: recipientName }] : []),
    ...(recipientAmount && !isMessage ? [{ label: receipt ? "Sent" : "Recipient amount", value: recipientAmount, ltr: true }] : []),
    ...(snapshot.event_type === "await_funds" && fundingAmount ? [{ label: "Amount to transfer", value: fundingAmount, ltr: true }] : []),
    ...(!receipt && !isMessage ? [{ label: "Service", value: `${service}${isPriority ? ` · AUD ${fee.toFixed(2)} additional fee` : ""}` }] : []),
    { label: receipt ? "On (Sydney time)" : "Updated (Sydney time)", value: receipt ? new Date(receipt.completed_at).toLocaleString("en-AU-u-ca-gregory-nu-latn", { timeZone: "Australia/Sydney", dateStyle: "medium", timeStyle: "short" }) : time, ltr: true },
    { label: "Transaction code", value: reference, ltr: true, prominent: true },
  ];
  const instructions: string[] = [];
  if (snapshot.event_type === "await_funds") {
    const bank = details?.payment_details;
    const bankLabels: [keyof FundingBankDetails, string][] = [
      ["account_name", "Account name"], ["bank_name", "Bank"],
      ["bsb", "BSB"], ["account_number", "Account number"],
      ["iban", "IBAN"], ["card_number", "Card number"],
    ];
    const bankLines = bankLabels.flatMap(([key, label]) => bank?.[key]?.trim() ? [`${label}: ${bank[key]}`] : []);
    const note = details?.payment_instructions;
    if ((!bankLines.length && !note?.trim()) || !["AUD", "IRT"].includes(details?.funding_currency ?? "") || !Number.isFinite(Number(details?.funding_total)) || Number(details?.funding_total) <= 0) {
      throw new Error("funding_instructions_unavailable");
    }
    instructions.push(
      ...(details!.funding_currency === "AUD" ? ["Do not transfer money to our account from Commonwealth Bank (CommBank). Transfers from this bank to our account are currently restricted. Please pay from a bank account in your own name at another bank."] : []),
      ...bankLines,
      ...(note?.trim() ? [note] : []),
      ...(details!.funding_currency === "AUD" ? [`You must put your transaction code ${reference} in your bank transfer description.`] : []),
      "Upload your bank receipt on the request page; funds are confirmed separately.",
    );
  }
  if (["receipt_uploaded", "payment_evidence"].includes(snapshot.event_type ?? "")) {
    instructions.push("We received your payment evidence. Our finance team will confirm when funds have cleared.");
  }
  if (["await_funds", "receipt_uploaded", "payment_evidence", "ready", "resume_funded_request", "start_processing"].includes(snapshot.event_type ?? "")) {
    const waitingForFunds = ["await_funds", "receipt_uploaded", "payment_evidence"].includes(snapshot.event_type ?? "") && !details?.funds_confirmed_at;
    if (waitingForFunds) instructions.push(details?.funding_currency === "AUD"
      ? "Australian payments may arrive quickly. Some first-time transfers or bank checks take up to 24 hours, or longer; we do not impose a 24-hour wait."
      : "We confirm the incoming Toman payment once cleared funds are verified.");
    instructions.push(
      ...(isPriority ? ["Priority timing starts only after funds are confirmed received and checks are complete, within business hours."] : []),
      details?.funding_currency === "AUD"
        ? (details?.iran_banking_notice || "Iranian payouts follow Satna/Paya cycles and bank holidays.")
        : "The AUD payout to the recipient depends on the receiving bank and payment method.",
    );
  }
  if (details?.public_message) instructions.push(details.public_message);
  if (customerQuestion && customerQuestion !== details?.public_message) instructions.push(customerQuestion);
  if (receipt) {
    action = "Your final PDF receipt is attached and is also available from the request page.";
  }
  const support = "If you don't recognise this transfer or have a question, contact the Zarman team through the messages on your request page. Include your transaction code so we can identify your transfer.";
  return {
    from: settings.from,
    to: [snapshot.recipient_email],
    subject,
    text: ["Zarman Exchange", heading, greeting, intro, rows.map(({ label, value }) => `${label}: ${value}`).join("\n"), ...instructions, action, `View request: ${trackingUrl}`, support, "— Team Zarman"].join("\n\n"),
    html: emailHtml({ heading, greeting, intro, rows, instructions, action, trackingUrl, reference }),
    tags: [{ name: "request_delivery_id", value: snapshot.id }],
  };
}
