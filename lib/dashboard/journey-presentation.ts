import { getRequestJourney, requestStageLabel } from "@/lib/requests/journey";
import type { ExchangeRequest, RequestLocale } from "@/lib/requests/types";

/** Animation represents the recorded stage; it never advances a financial state. */
export function journeyPresentation(request: ExchangeRequest, locale: RequestLocale) {
  const journey = getRequestJourney(request), fa = locale === "fa";
  const principalRefundPending = request.funding_status === "refund_pending";
  const priorityRefundPending = request.priority_fee_status === "refund_pending";
  const refundPending = principalRefundPending || priorityRefundPending;
  const text = (en: string, faText: string) => fa ? faText : en;
  const labels: [string, string, string, string][] = [
    [
      "Request Submitted (Under Review)",
      "درخواست شما ثبت شد (در حال بررسی)",
      "Our team is reviewing your request. Once approved, the bank account details for your deposit will be displayed here.",
      "کارشناسان ما در حال بررسی درخواست شما هستند. به محض تأیید، اطلاعات حساب بانکی جهت واریز وجه در همین صفحه نمایش داده خواهد شد.",
    ],
    [
      "Request Approved; Please Transfer Funds",
      "درخواست تأیید شد؛ لطفاً وجه را واریز کنید",
      "Transfer the specified amount to the designated account and upload your bank receipt.",
      "مبلغ تعیین‌شده را به حساب مشخص‌شده انتقال داده و رسید آن را بارگذاری کنید.",
    ],
    [
      "Bank Receipt Received",
      "رسید بانکی شما دریافت شد",
      "Our team is reviewing your receipt and verifying the funds.",
      "کارشناسان ما در حال بررسی رسید و تأیید وصول وجه هستند.",
    ],
    [
      "Funds Verified",
      "وصول وجه تأیید شد",
      "Your payment has been successfully verified. We are now processing the final steps of your transfer.",
      "دریافت وجه با موفقیت تأیید شد. کارشناسان ما در حال انجام مراحل نهایی انتقال هستند.",
    ],
    [
      "Transfer Completed",
      "تراکنش تکمیل شد",
      "The transfer has been successfully completed. Your final summary and receipt are now available.",
      "انتقال وجه با موفقیت به پایان رسید. خلاصه تراکنش و رسید نهایی شما آماده است.",
    ],
  ];
  const row = labels[journey.stage];
  let heading = row[fa ? 1 : 0], description = row[fa ? 3 : 2];
  let mood: "active" | "attention" | "waiting" | "complete" | "failed" | "quiet" = request.status === "completed" ? "complete" : "waiting";
  let href: string | null = journey.canPay && !journey.receiptSubmitted ? "#request-payment-details" : null;
  let action: string | null = href ? text("View account details", "مشاهده اطلاعات حساب") : null;
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
    description = priorityRefundPending ? text("Our team is arranging your express processing fee refund.", "تیم زرمان در حال پیگیری بازپرداخت هزینه پردازش اکسپرس شماست.")
      : principalRefundPending ? text("Our team is arranging the return of your funds.", "تیم زرمان در حال پیگیری بازپرداخت وجه شماست.")
      : request.funding_status === "refunded" ? text("Your funds have been returned.", "وجه شما بازپرداخت شد.") : text("This request is closed. Please do not send a new payment.", "این درخواست بسته شده است. وجه جدید واریز نکنید.");
  }
  const actorLabel = nextActor === "customer" ? text("Action Required", "نیازمند اقدام شما")
    : nextActor === "zarman" ? (journey.stage === 0 && !journey.closed && !refundPending ? text("Under Review by Zarman", "در حال بررسی توسط زرمان") : text("Under review by Zarman", "در حال بررسی توسط زرمان"))
      : nextActor === "complete" ? text("Complete", "تکمیل شده") : text("Closed", "بسته شده");
  const actorHint = nextActor === "customer" ? text("Action needed from you", "اقدام شما لازم است")
    : nextActor === "zarman" ? text("Our team is handling the next step", "مرحله بعد با تیم زرمان است")
      : nextActor === "complete" ? text("No further action", "اقدام دیگری لازم نیست") : text("No further action", "اقدام دیگری لازم نیست");
  return { ...journey, heading, description, mood, href, action, nextActor, actorLabel, actorHint, status: requestStageLabel(request, locale) };
}
