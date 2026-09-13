import { Check } from "lucide-react";
import type { ExchangeRequest, RequestLocale } from "@/lib/requests/types";
import { requestDate, requestLabel } from "./request-labels";
import styles from "@/styles/requests/Requests.module.css";
import compact from "@/styles/requests/RequestPayment.module.css";

export function RequestProgress({ request, locale }: { request: ExchangeRequest; locale: RequestLocale }) {
  const fa = locale === "fa";
  const closed = ["cancelled", "rejected", "expired"].includes(request.status);
  const stage = request.status === "completed" ? 3
    : ["processing", "reconciliation"].includes(request.status) ? 2
    : ["awaiting_funds", "ready"].includes(request.status) || request.funding_status === "confirmed" ? 1 : 0;
  const funded = request.funding_status === "confirmed";
  const steps = fa ? ["ثبت شد", "دریافت وجه", "در حال انجام", "تکمیل شد"] : ["Submitted", "Awaiting funds", "Processing", "Completed"];

  return <section className={`${styles.card} ${compact.compactCard}`} aria-label={fa ? "مراحل حواله" : "Transfer progress"}>
    <div className={compact.heading}><h2>{fa ? "مراحل حواله" : "Progress"}</h2><span className={styles.badge}>{requestLabel(request.status, locale)}</span></div>
    <ol className={styles.progressSteps}>
      {steps.map((label, index) => {
        const done = index < stage || (index === 1 && funded) || request.status === "completed";
        const current = !closed && index === stage;
        return <li key={index} className={styles.progressStep} data-done={done} data-current={current} aria-current={current ? "step" : undefined}>
          <span className={styles.progressMarker} aria-hidden="true">{done ? <Check size={17} /> : new Intl.NumberFormat(fa ? "fa-IR" : "en-AU").format(index + 1)}</span>
          <span>{label}</span>
          <span className={styles.srOnly}>{done ? (fa ? "، انجام شده" : ", done") : current ? (fa ? "، مرحله فعلی" : ", current step") : (fa ? "، در انتظار" : ", pending")}</span>
        </li>;
      })}
    </ol>
    {closed && <p className={styles.warning}>{fa ? "درخواست بسته شده؛ وجه جدید واریز نکنید." : "Request closed. Do not send further payment."}</p>}
    {request.status === "ready" && <p className={compact.hint}>{fa ? "وجه تأیید شد؛ در صف رسیدگی." : "Funds confirmed. Queued for processing."}</p>}
    {request.status === "completed" && <p className={compact.hint}>{fa ? "رسید نهایی آماده دریافت است." : "Your final receipt is ready."}</p>}
    {(request.funds_confirmed_at || request.ready_at) && <div className={compact.meta}>
      {request.funds_confirmed_at && <span>{fa ? "تأیید وجه: " : "Funds confirmed: "}{requestDate(request.funds_confirmed_at, locale)}</span>}
      {request.ready_at && request.status !== "completed" && <span>{fa ? "شروع زمان رسیدگی: " : "Handling clock started: "}{requestDate(request.ready_at, locale)}</span>}
    </div>}
  </section>;
}
