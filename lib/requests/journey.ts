import type { ExchangeRequest, RequestEvent, RequestLocale } from "./types";

export type RequestJourneyStage = "approval" | "payment" | "receipt_review" | "funds_received" | "completed";

/** Customer milestones are facts, not the reversible internal review status. */
export function getRequestJourney(request: ExchangeRequest) {
  const closed = ["cancelled", "rejected", "expired"].includes(request.status);
  const approved = Boolean(request.payment_approved_at);
  const receiptSubmitted = Boolean(request.evidence_submitted_at);
  const fundsReceived = Boolean(request.funds_confirmed_at) || request.funding_status === "confirmed";
  const stage: 0 | 1 | 2 | 3 | 4 = request.status === "completed" ? 4 : fundsReceived ? 3 : approved && receiptSubmitted ? 2 : approved ? 1 : 0;
  const stageKey: RequestJourneyStage = (["approval", "payment", "receipt_review", "funds_received", "completed"] as const)[stage];
  const refundable = ["refund_pending", "refunded"].includes(request.funding_status) || ["refund_pending", "refunded"].includes(request.priority_fee_status);
  const unpaid = ["unpaid", "partial"].includes(request.funding_status);
  const customerActionMessage = !closed && request.status !== "completed" && !["refund_pending", "refunded"].includes(request.funding_status)
    ? request.customer_action_required?.trim() || null : null;
  const customerActionRequired = Boolean(customerActionMessage);
  return {
    approved, receiptSubmitted, fundsReceived, closed, stage, stageKey,
    customerActionRequired, customerActionMessage,
    readyForSettlement: request.status === "ready" && request.funding_status === "confirmed" && !customerActionRequired,
    canPay: approved && !closed && !refundable && !fundsReceived && unpaid && request.status === "awaiting_funds",
    canUpload: approved && !closed && !refundable && !fundsReceived && unpaid && ["submitted", "awaiting_funds", "under_review", "action_required"].includes(request.status),
  };
}

export function requestStageLabel(request: ExchangeRequest, locale: RequestLocale): string {
  const index = locale === "fa" ? 1 : 0;
  const exceptions: Record<string, [string, string]> = {
    cancelled: ["Cancelled", "لغو شده"], rejected: ["Not approved", "تأیید نشده"], expired: ["Payment window closed", "مهلت پرداخت پایان یافته"],
    reconciliation: ["Checking destination settlement", "در حال بررسی تسویه مقصد"],
  };
  if (exceptions[request.status]) return exceptions[request.status][index];
  if (request.funding_status === "refund_pending") return ["Refund in progress", "بازپرداخت در حال انجام"][index];
  if (request.funding_status === "refunded") return ["Funds returned", "وجه بازپرداخت شد"][index];
  const journey = getRequestJourney(request);
  if (journey.customerActionRequired) return ["Reply needed", "نیاز به پاسخ شما"][index];
  if (["under_review", "action_required"].includes(request.status) && journey.fundsReceived) return ["Funds received · under admin review", "وجه دریافت شد · در حال بررسی توسط مدیر"][index];
  if (request.status === "action_required" || (request.status === "under_review" && !request.evidence_submitted_at && !journey.fundsReceived)) return ["Admin review in progress", "در حال بررسی توسط مدیر"][index];
  const labels: Record<RequestJourneyStage, [string, string]> = {
    approval: ["Awaiting approval", "در انتظار تأیید درخواست"],
    payment: ["Ready for your payment", "آماده پرداخت شما"],
    receipt_review: ["Checking your payment", "در حال بررسی واریز شما"],
    funds_received: ["Funds received", "وجه شما دریافت شد"],
    completed: ["Transfer completed", "انتقال تکمیل شد"],
  };
  return labels[journey.stageKey][index];
}

export type RequestMilestone = {
  key: string; label: [string, string]; at: string | null; done: boolean; current: boolean;
};

export function requestMilestones(request: ExchangeRequest, events: RequestEvent[] = []): RequestMilestone[] {
  const journey = getRequestJourney(request);
  const earliest = (types: string[]) => events.filter(event => types.includes(event.event_type))
    .sort((a, b) => a.sequence - b.sequence)[0]?.created_at || null;
  const completedAt = earliest(["complete", "reconcile_complete"]);
  const approvalLabel: [string, string] = journey.stage === 0
    ? ["Awaiting Zarman approval", "در انتظار تأیید زرمان"]
    : ["Request submitted", "درخواست ثبت شد"];
  const receiptLabel: [string, string] = journey.stage === 2
    ? ["Payment under review", "واریز در حال بررسی"]
    : ["Receipt sent for review", "رسید برای بررسی ارسال شد"];
  const settlementLabel: [string, string] = journey.stage === 3 && request.status === "processing"
    ? ["Settlement in progress", "تسویه در حال انجام"]
    : journey.stage === 3 && request.status === "reconciliation"
      ? ["Confirming destination settlement", "در حال تأیید تسویه مقصد"]
      : ["Funds received", "وجه دریافت شد"];
  const rows: Array<[string, [string, string], string | null, boolean]> = [
    ["submitted", approvalLabel, request.created_at, true],
    ["approved", ["Approved for payment", "اجازه پرداخت صادر شد"], request.payment_approved_at || null, journey.approved],
    ["receipt", receiptLabel, earliest(["receipt_uploaded", "payment_evidence"]) || request.evidence_submitted_at, journey.receiptSubmitted],
    ["received", settlementLabel, request.funds_confirmed_at || earliest(["ready", "resume_funded_request"]), journey.fundsReceived],
    ["completed", ["Transfer completed", "انتقال تکمیل شد"], completedAt, request.status === "completed"],
  ];
  return rows.map(([key, label, at, done], index) => ({ key, label, at: at || null, done, current: !journey.closed && index === journey.stage }));
}

export function requestActivityLabel(eventType: string, locale: RequestLocale): string {
  const labels: Record<string, [string, string]> = {
    submitted: ["Customer submitted the request", "مشتری درخواست را ثبت کرد"],
    await_funds: ["Payment approved · bank details released", "پرداخت تأیید و مشخصات بانکی نمایش داده شد"],
    receipt_uploaded: ["Customer sent a payment receipt", "مشتری رسید واریز را ارسال کرد"],
    payment_evidence: ["Customer sent a payment update", "مشتری اطلاعات واریز را ارسال کرد"],
    ready: ["Funds received and verified", "وصول وجه بررسی و تأیید شد"],
    confirm_funds: ["Funds received and verified", "وصول وجه بررسی و تأیید شد"],
    funds_recorded: ["Incoming payment recorded", "واریز ورودی ثبت شد"],
    resume_funded_request: ["Checks cleared · funds released for settlement", "بررسی‌ها تکمیل و وجه آماده تسویه شد"],
    start_processing: ["Destination settlement started", "تسویه در مقصد آغاز شد"],
    complete: ["Destination settlement confirmed · transfer completed", "تسویه مقصد تأیید و انتقال تکمیل شد"],
    reconcile_complete: ["Destination settlement confirmed · transfer completed", "تسویه مقصد تأیید و انتقال تکمیل شد"],
    request_info: ["Admin requested a customer reply", "مدیر درخواست پاسخ مشتری کرد"],
    respond: ["Customer replied", "مشتری پاسخ داد"],
    customer_message: ["Customer sent a message", "مشتری پیام فرستاد"],
    admin_message: ["Admin sent a message", "مدیر پیام فرستاد"],
    review: ["Admin reviewed the request", "مدیر درخواست را بررسی کرد"],
    record_uncertain_payout: ["Destination settlement needs checking", "تسویه مقصد نیاز به بررسی دارد"],
    cancel: ["Customer cancelled the request", "مشتری درخواست را لغو کرد"],
    reject: ["Admin declined the request", "مدیر درخواست را رد کرد"],
    expired: ["Payment window closed", "مهلت پرداخت پایان یافت"],
    refund_pending: ["Refund required", "بازپرداخت لازم است"],
    refund_returned: ["Refund confirmed", "بازپرداخت تأیید شد"],
    funding_clearance_review: ["Bank clearance needs checking", "وصول وجه نیاز به بررسی دارد"],
    handling_overdue: ["Handling target needs attention", "زمان رسیدگی نیاز به پیگیری دارد"],
  };
  return (labels[eventType] || ["Request updated", "درخواست به‌روزرسانی شد"])[locale === "fa" ? 1 : 0];
}

export function requestEmailStatus(status: string, lastError?: string | null, locale: RequestLocale = "en"): string {
  const labels: Record<string, [string, string]> = {
    pending: ["Queued", "در صف ارسال"], leased: ["Sending", "در حال ارسال"], provider_accepted: ["Sent", "ارسال شد"], delivered: ["Delivered", "تحویل شد"],
    skipped: ["Email not requested", "ارسال ایمیل انتخاب نشد"], failed: ["Delivery failed", "تحویل ناموفق"],
    suppressed: ["Recipient could not receive email", "گیرنده امکان دریافت ایمیل ندارد"],
    reconciliation_required: ["Delivery needs checking", "تحویل نیاز به بررسی دارد"],
  };
  const key = status === "skipped" && lastError === "admin_email_opt_out" ? "skipped" : status;
  return (labels[key] || ["Delivery pending", "در انتظار تحویل"])[locale === "fa" ? 1 : 0];
}
