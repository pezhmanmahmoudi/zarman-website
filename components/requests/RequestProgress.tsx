import { Check } from "lucide-react";
import type { ExchangeRequest, RequestEvent, RequestLocale } from "@/lib/requests/types";
import { getRequestJourney, requestMilestones } from "@/lib/requests/journey";
import { requestDate } from "./request-labels";
import styles from "@/styles/requests/Requests.module.css";
import compact from "@/styles/requests/RequestPayment.module.css";

export function RequestProgress({ request, events = [], locale }: { request: ExchangeRequest; events?: RequestEvent[]; locale: RequestLocale }) {
  const fa = locale === "fa";
  const journey = getRequestJourney(request);
  const milestones = requestMilestones(request, events);
  return <section className={`${styles.card} ${compact.compactCard}`} aria-label={fa ? "مراحل حواله" : "Transfer progress"}>
    <div className={compact.heading}><h2>{fa ? "مراحل حواله" : "Transfer progress"}</h2></div>
    <ol className={compact.progress}>
      {milestones.map((milestone, index) => <li key={milestone.key} className={compact.progressItem} data-done={milestone.done} data-current={milestone.current} aria-current={milestone.current ? "step" : undefined}>
        <span className={compact.marker} aria-hidden="true">{milestone.done && !milestone.current ? <Check size={14} /> : index + 1}</span>
        <strong>{milestone.label[fa ? 1 : 0]}</strong>
        {milestone.at && <time dir="ltr" dateTime={milestone.at}>{requestDate(milestone.at, locale)}</time>}
        <span className={styles.srOnly}>{milestone.current ? (fa ? "مرحله فعلی" : "Current step") : milestone.done ? (fa ? "انجام شده" : "Done") : (fa ? "در انتظار" : "Pending")}</span>
      </li>)}
    </ol>
    {!journey.closed && request.ready_at && journey.stage === 3 && <p className={compact.deadline}>{fa ? "مهلت رسیدگی: " : "Handling target: "}<bdi dir="ltr">{requestDate(request.handling_due_at, locale)}</bdi> {fa ? "(سیدنی)" : "(Sydney)"}</p>}
  </section>;
}
