import { getRequestJourney, requestStageLabel } from "@/lib/requests/journey";
import type { ExchangeRequest, RequestLocale } from "@/lib/requests/types";

/** Animation represents the recorded stage; it never advances a financial state. */
export function journeyPresentation(request: ExchangeRequest, locale: RequestLocale) {
  const journey = getRequestJourney(request), fa = locale === "fa";
  const principalRefundPending = request.funding_status === "refund_pending";
  const priorityRefundPending = request.priority_fee_status === "refund_pending";
  const refundPending = principalRefundPending || priorityRefundPending;
  const text = (en: string, faText: string) => fa ? faText : en;
  const labels = [
    ["A great start.", "شروع یک انتقال مطمئن.", "Your request is with our team. Bank details appear after approval.", "درخواست شما در حال بررسی است. پس از تأیید، مشخصات بانکی نمایش داده می‌شود."],
    ["You’re ready to pay.", "آماده واریز وجه هستید.", "Transfer the exact amount, then send your bank receipt.", "مبلغ مشخص‌شده را واریز کنید و سپس رسید بانکی را بفرستید."],
    ["Your receipt is with us.", "رسید شما به دست ما رسید.", "We’re checking for cleared funds. No action needed.", "در حال بررسی وصول وجه هستیم. نیازی به اقدام شما نیست."],
    ["Your funds are confirmed.", "دریافت وجه شما تأیید شد.", "Funds received. Under admin review for the remaining checks.", "وجه دریافت شد. بررسی‌های نهایی در حال انجام است."],
    ["Delivered. All done.", "انتقال انجام شد.", "Destination settlement is confirmed. Your final receipt is ready.", "تسویه در مقصد تأیید شد. رسید نهایی شما آماده است."],
  ];
  const row = labels[journey.stage];
  let heading = row[fa ? 1 : 0], description = row[fa ? 3 : 2];
  let mood: "active" | "attention" | "waiting" | "complete" | "failed" | "quiet" = request.status === "completed" ? "complete" : "waiting";
  let href: string | null = journey.canPay && !journey.receiptSubmitted ? "#request-payment-details" : null;
  let action: string | null = href ? text("View payment details", "مشاهده مشخصات واریز") : null;
  let nextActor: "customer" | "zarman" | "complete" | "closed" = request.status === "completed" ? "complete" : "zarman";
  if (journey.canPay && !journey.receiptSubmitted) {
    nextActor = "customer";
    mood = "attention";
  }
  if (journey.stage === 1 && !journey.canPay && !journey.closed) {
    heading = text("We’re reviewing your request.", "در حال بررسی درخواست شما هستیم.");
    description = text("Our team is completing a check before payment. No action needed.", "تیم زرمان در حال بررسی پیش از پرداخت است. نیازی به اقدام شما نیست.");
  }
  if (journey.fundsReceived && (journey.readyForSettlement || request.status === "processing")) description = text("Funds received. Destination settlement is the next step.", "وجه دریافت شد. مرحله بعد، تسویه با گیرنده است.");
  if (request.status === "reconciliation") description = text("Funds received. We’re checking the destination bank settlement.", "وجه دریافت شد. در حال بررسی تسویه بانک مقصد هستیم.");
  if (journey.customerActionRequired) {
    heading = text("Your response is needed.", "پاسخ شما لازم است.");
    description = text("Our team has a question. Reply below to keep things moving.", "تیم ما پرسشی دارد. برای ادامه، پیام زیر را پاسخ دهید.");
    href = "#request-conversation"; action = text("Reply to the team", "پاسخ به تیم زرمان"); mood = "attention"; nextActor = "customer";
  }
  if (request.status === "completed") { href = `/api/requests/${request.id}/receipt`; action = text("Download receipt", "دریافت رسید"); nextActor = "complete"; }
  if (journey.closed || ["refund_pending", "refunded"].includes(request.funding_status) || (priorityRefundPending && !journey.customerActionRequired)) {
    heading = requestStageLabel(request, locale); mood = ["rejected", "expired"].includes(request.status) ? "failed" : "quiet"; href = null; action = null;
    nextActor = refundPending ? "zarman" : "closed";
    description = priorityRefundPending ? text("Our team is arranging your priority service fee refund.", "تیم زرمان در حال پیگیری بازپرداخت هزینه سرویس اولویت‌دار شماست.")
      : principalRefundPending ? text("Our team is arranging the return of your funds.", "تیم زرمان در حال پیگیری بازپرداخت وجه شماست.")
      : request.funding_status === "refunded" ? text("Your funds have been returned.", "وجه شما بازپرداخت شد.") : text("This request is closed. Please do not send a new payment.", "این درخواست بسته شده است. وجه جدید واریز نکنید.");
  }
  const actorLabel = nextActor === "customer" ? text("Your turn", "نوبت شما")
    : nextActor === "zarman" ? text("With Zarman", "نزد زرمان")
      : nextActor === "complete" ? text("Complete", "تکمیل شده") : text("Closed", "بسته شده");
  const actorHint = nextActor === "customer" ? text("Action needed from you", "اقدام شما لازم است")
    : nextActor === "zarman" ? text("Our team is handling the next step", "مرحله بعد با تیم زرمان است")
      : nextActor === "complete" ? text("No further action", "اقدام دیگری لازم نیست") : text("No further action", "اقدام دیگری لازم نیست");
  return { ...journey, heading, description, mood, href, action, nextActor, actorLabel, actorHint, status: requestStageLabel(request, locale) };
}
