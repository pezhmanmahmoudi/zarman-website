import Link from "next/link";
import { Clock3 } from "lucide-react";
import type { ExchangeRequest, RequestEvent, RequestLocale } from "@/lib/requests/types";
import { requestMilestones } from "@/lib/requests/journey";
import { journeyPresentation } from "@/lib/dashboard/journey-presentation";
import { requestMotionIcon } from "@/lib/dashboard/request-motion-icon";
import { DashboardMotionIcon } from "@/components/dashboard/DashboardMotionIcon";
import { DashboardButton, DashboardCard, DashboardReveal, StatusBadge } from "@/components/dashboard/dashboard-ui";
import { requestDate, requestMoney } from "./request-labels";
import { RequestJourneyStepper } from "./RequestJourneyStepper";
import styles from "@/styles/requests/RequestProgress.module.css";

export function RequestProgress({ request, events = [], locale, spotlight = false }: {
  request: ExchangeRequest; events?: RequestEvent[]; locale: RequestLocale; spotlight?: boolean;
}) {
  const fa = locale === "fa", journey = journeyPresentation(request,locale), milestones = requestMilestones(request,events);
  const href = spotlight ? `/${locale}/dashboard/requests/${request.id}${journey.href?.startsWith("#") ? journey.href : ""}` : journey.href;
  const action = spotlight ? (journey.href?.startsWith("#") ? journey.action : fa ? "پیگیری انتقال" : "Follow your transfer") : journey.action;
  const statusTone = journey.mood === "attention" ? "attention" : journey.mood === "complete" ? "success" : journey.mood === "failed" ? "danger" : "neutral";
  const actorTone = journey.nextActor === "customer" ? "attention" : journey.nextActor === "complete" ? "success" : journey.nextActor === "closed" ? "neutral" : "brand";
  return <section className={styles.journey}><DashboardReveal><DashboardCard className={styles.progress} data-mood={journey.mood} data-spotlight={spotlight} data-stage={journey.stage} dir={fa ? "rtl" : "ltr"} role="region" aria-label={fa ? "مراحل حواله" : "Transfer progress"}>
    <div className={styles.topline}><div className={styles.reference}><span>{fa ? "کد تراکنش" : "Transaction code"}</span><bdi dir="ltr">{request.reference_code}</bdi></div><StatusBadge tone={statusTone}>{journey.status}</StatusBadge></div>
    <div className={styles.statusGrid}>
      <div className={styles.story}><div className="mb-4 flex items-center gap-3"><DashboardMotionIcon name={requestMotionIcon(journey)} size={56} /><p className={`${styles.stage} mb-0!`}>{fa ? `مرحله ${journey.stage+1} از 5` : `Step ${journey.stage+1} of 5`}</p></div><h2>{journey.heading}</h2><p className={styles.description}>{journey.description}</p></div>
      <div className={styles.owner} data-next-actor={journey.nextActor}><span>{fa ? "اقدام بعدی" : "Next action"}</span><StatusBadge tone={actorTone}>{journey.actorLabel}</StatusBadge><small>{journey.actorHint}</small></div>
    </div>
    <dl className={styles.amounts}>
      <div><dt>{fa ? "مجموع پرداخت" : "You send"}</dt><dd data-private-value><bdi>{requestMoney(request.quote.funding_total,request.quote.funding_currency,locale)}</bdi></dd></div>
      <div><dt>{fa ? "دریافتی گیرنده" : "Recipient gets"}</dt><dd data-private-value><bdi>{requestMoney(request.quote.recipient_amount,request.quote.recipient_currency,locale)}</bdi></dd></div>
      <div><dt>{fa ? "نرخ ثبت‌شده" : "Locked rate"}</dt><dd data-private-value><bdi dir="ltr">1 AUD = {requestMoney(request.quote.applied_rate,"IRT",locale)}</bdi></dd></div>
    </dl>
    <div className={styles.actionRow}>{href && action ? <DashboardButton asChild tone="primary"><Link href={href} {...(!spotlight && request.status === "completed" ? {target:"_blank",rel:"noopener noreferrer"} : {})}>{action}</Link></DashboardButton> : !journey.closed && <p className={styles.noAction}>{fa ? "نیازی به اقدام شما نیست" : "No action needed"}</p>}</div>
    <RequestJourneyStepper milestones={milestones} stage={journey.stage} locale={locale} actorLabel={journey.actorLabel}/>
    {!journey.closed && request.ready_at && journey.stage === 3 && <p className={styles.deadline}><Clock3 size={15} aria-hidden="true"/>{fa ? "مهلت رسیدگی: " : "Handling target: "}<bdi dir="ltr">{requestDate(request.handling_due_at,locale)}</bdi> {fa ? "(سیدنی)" : "(Sydney)"}</p>}
  </DashboardCard></DashboardReveal></section>;
}
