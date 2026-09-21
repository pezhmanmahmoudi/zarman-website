import Link from "next/link";
import { ArrowUpRight, Check, Clock3, ShieldCheck } from "lucide-react";
import type { ExchangeRequest, RequestEvent, RequestLocale } from "@/lib/requests/types";
import { requestMilestones } from "@/lib/requests/journey";
import { journeyPresentation } from "@/lib/dashboard/journey-presentation";
import { TransferJourneyVisual } from "@/components/dashboard/TransferJourneyVisual";
import { requestDate, requestMoney } from "./request-labels";
import styles from "@/styles/dashboard/TransferJourney.module.css";

export function RequestProgress({ request, events = [], locale, spotlight = false }: {
  request: ExchangeRequest; events?: RequestEvent[]; locale: RequestLocale; spotlight?: boolean;
}) {
  const fa = locale === "fa", journey = journeyPresentation(request,locale), milestones = requestMilestones(request,events);
  const href = spotlight ? `/${locale}/dashboard/requests/${request.id}${journey.href?.startsWith("#") ? journey.href : ""}` : journey.href;
  const action = spotlight ? (journey.href?.startsWith("#") ? journey.action : fa ? "پیگیری انتقال" : "Follow your transfer") : journey.action;
  return <section className={styles.journey} data-mood={journey.mood} data-spotlight={spotlight} aria-label={fa ? "مراحل حواله" : "Transfer progress"}>
    <div className={styles.hero}>
      <div className={styles.story}>
        <div className={styles.eyebrow}><span className={styles.liveDot}/>{spotlight ? <bdi>{request.reference_code}</bdi> : (fa ? "مسیر انتقال شما" : "YOUR TRANSFER JOURNEY")}<span className={styles.stageCount}>{fa ? `مرحله ${journey.stage+1} از 5` : `STEP ${journey.stage+1} OF 5`}</span></div>
        <div className={styles.actorRow} data-next-actor={journey.nextActor}>
          <span className={styles.actorBadge}><span>{fa ? "مرحله بعد" : "NEXT"}</span><strong>{journey.actorLabel}</strong></span>
          <small>{journey.actorHint}</small>
        </div>
        <div key={`${request.id}:${journey.stage}:${journey.mood}`} className={styles.storyText}><h2>{journey.heading}</h2><p>{journey.description}</p></div>
        <div className={styles.heroActions}>
          {href && action ? <Link className={styles.primaryAction} href={href} {...(!spotlight && request.status === "completed" ? {target:"_blank",rel:"noopener noreferrer"} : {})}>{action}<ArrowUpRight size={17}/></Link>
            : !journey.closed && <span className={styles.noAction}><ShieldCheck size={17}/>{fa ? "نیازی به اقدام شما نیست" : "No action needed"}</span>}
          <span className={styles.status}>{journey.status}</span>
        </div>
      </div>
      <TransferJourneyVisual stage={journey.stage} from={request.quote.funding_currency} to={request.quote.recipient_currency} quiet={journey.mood === "quiet"}/>
    </div>
    <div className={styles.transferStrip}><span>{fa ? "مجموع پرداخت" : "You send"}<bdi data-private-value>{requestMoney(request.quote.funding_total,request.quote.funding_currency,locale)}</bdi></span><span className={styles.stripArrow} aria-hidden="true">→</span><span>{fa ? "دریافتی گیرنده" : "Recipient gets"}<bdi data-private-value>{requestMoney(request.quote.recipient_amount,request.quote.recipient_currency,locale)}</bdi></span><span className={styles.rateFact}>{fa ? "نرخ ثبت‌شده" : "Locked rate"}<bdi data-private-value dir="ltr">1 AUD = {requestMoney(request.quote.applied_rate,"IRT",locale)}</bdi></span></div>
    <ol className={styles.rail} aria-label={fa ? "مراحل حواله" : "Transfer progress"}>
      {milestones.map((milestone,index)=><li key={milestone.key} className={styles.step} data-done={milestone.done} data-current={milestone.current} aria-current={milestone.current ? "step" : undefined}>
        <span className={styles.node} aria-hidden="true">{milestone.done && !milestone.current ? <Check size={17}/> : index+1}</span>
        <div><strong>{milestone.label[fa ? 1 : 0]}</strong>{milestone.at ? <time dir="ltr" dateTime={milestone.at}>{requestDate(milestone.at,locale)}</time> : <small>{milestone.current ? journey.actorLabel : (fa ? "در انتظار" : "Up next")}</small>}</div>
      </li>)}
    </ol>
    {!journey.closed && request.ready_at && journey.stage === 3 && <p className={styles.deadline}><Clock3 size={14}/>{fa ? "مهلت رسیدگی: " : "Handling target: "}<bdi dir="ltr">{requestDate(request.handling_due_at,locale)}</bdi> {fa ? "(سیدنی)" : "(Sydney)"}</p>}
  </section>;
}
