import { Check } from "lucide-react";
import type { ExchangeRequest, RequestLocale } from "@/lib/requests/types";
import { requestDate, requestLabel } from "./request-labels";
import styles from "@/styles/requests/Requests.module.css";

export function RequestProgress({ request, locale }: { request: ExchangeRequest; locale: RequestLocale }) {
  const fa = locale === "fa";
  const closed = ["cancelled", "rejected", "expired"].includes(request.status);
  const stage = request.status === "completed" ? 3
    : ["processing", "reconciliation"].includes(request.status) ? 2
    : request.payment_instructions || request.status === "ready" ? 1 : 0;
  const funded = request.funding_status === "confirmed";
  const steps = fa ? ["ثبت درخواست", "انتظار دریافت وجه", "در حال انجام", "تکمیل شده"] : ["Submitted", "Awaiting Funds", "Processing", "Completed"];

  return <section className={styles.card} aria-label={fa ? "پیشرفت حواله" : "Transfer progress"}>
    <h2>{fa ? "مراحل درخواست شما" : "Your transfer progress"}</h2>
    <ol className={styles.progressSteps}>
      {steps.map((label, index) => {
        const done = index < stage || (index === 1 && funded) || request.status === "completed";
        const current = !closed && index === stage;
        return <li key={index} className={styles.progressStep} data-done={done} data-current={current} aria-current={current ? "step" : undefined}>
          <span className={styles.progressMarker} aria-hidden="true">{done ? <Check size={17} /> : index + 1}</span>
          <span>{label}</span>
          <span className={styles.srOnly}>{done ? (fa ? "، انجام شده" : ", done") : current ? (fa ? "، مرحله فعلی" : ", current step") : (fa ? "، در انتظار" : ", pending")}</span>
        </li>;
      })}
    </ol>
    {closed ? <p className={styles.warning}>{requestLabel(request.status, locale)}. {fa ? "این درخواست بسته شده است؛ وجه جدید واریز نکنید." : "This request is closed. Do not send a new payment."}</p>
      : request.status === "ready" ? <p className={styles.notice}>{fa ? "وجه توسط تیم مالی تأیید شده و درخواست در صف رسیدگی است. هدف زمانی سرویس اکنون آغاز شده است." : "Cleared funds confirmed by finance. Your request is queued for processing and the service time target has now started."}</p>
      : request.status === "completed" ? <p className={styles.notice}>{fa ? "تسویه حواله تأیید شده است. رسید نهایی در این صفحه و ایمیل شما در دسترس است." : "Transfer settlement has been confirmed. Your final receipt is available on this page and is queued for email delivery."}</p>
      : <p className={styles.muted}>{fa ? "وضعیت فعلی: " : "Current status: "}{requestLabel(request.status, locale)}</p>}
    {request.funds_confirmed_at && <p className={styles.muted}>{fa ? "تأیید وجه: " : "Cleared funds confirmed: "}{requestDate(request.funds_confirmed_at, locale)} ({fa ? "وقت سیدنی" : "Sydney time"})</p>}
    {request.ready_at && <p className={styles.muted}>{fa ? "شروع هدف زمانی رسیدگی: " : "Handling time target starts: "}{requestDate(request.ready_at, locale)} ({fa ? "وقت سیدنی" : "Sydney time"})</p>}
  </section>;
}
