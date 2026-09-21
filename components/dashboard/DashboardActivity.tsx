"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, ArrowRight, Check, ArrowLeftRight, RefreshCw, Search } from "lucide-react";
import { useLocale } from "@/context/LocaleContext";
import { dashboardCopy, dashboardHref } from "@/lib/dashboard/navigation";
import { filterDashboardRequests, requestNeedsAttention, type ActivityFilter } from "@/lib/dashboard/activity";
import { journeyPresentation } from "@/lib/dashboard/journey-presentation";
import { getRequestJourney } from "@/lib/requests/journey";
import { requestDate, requestMoney } from "@/components/requests/request-labels";
import type { ExchangeRequest } from "@/lib/requests/types";
import styles from "@/styles/dashboard/DashboardHome.module.css";

export function DashboardActivity({ requests, loading, refreshing, error, onRefresh, compact = false }: {
  requests: ExchangeRequest[]; loading: boolean; refreshing: boolean; error: boolean; onRefresh: () => void; compact?: boolean;
}) {
  const locale = useLocale(), copy = dashboardCopy[locale];
  const [filter, setFilter] = useState<ActivityFilter>("all"), [search, setSearch] = useState(""), [limit, setLimit] = useState(20);
  const filtered = filterDashboardRequests(requests, filter, search);
  const visible = filtered.slice(0, compact ? 4 : limit);
  return <section className={styles.card} aria-label={compact ? copy.recent : copy.history}>
    <header className={styles.cardHeader}><div><h2>{compact ? copy.recent : copy.history}</h2><p>{copy.recentHint}</p></div>
      {compact ? <Link className={styles.textLink} href={dashboardHref(locale,"history")}>{copy.allActivity}<ArrowRight size={14}/></Link>
        : <button className={styles.secondary} onClick={onRefresh} disabled={refreshing} aria-label={copy.refresh}><RefreshCw size={15}/></button>}
    </header>
    {!compact && <div className={styles.toolbar}>
      <div className={styles.filters} role="group" aria-label={locale === "fa" ? "فیلتر فعالیت‌ها" : "Filter activity"}>
        {([["all",copy.all],["active",copy.inProgress],["attention",copy.attention],["completed",copy.completed]] as const).map(([key,label]) =>
          <button type="button" key={key} aria-pressed={filter === key} onClick={() => { setFilter(key); setLimit(20); }}>{label}</button>)}
      </div>
      <label className={styles.search}><Search size={16} aria-hidden="true"/><input aria-label={copy.search} placeholder={copy.search} value={search} onChange={event => {setSearch(event.target.value); setLimit(20);}} /></label>
    </div>}
    {error && <div className={styles.empty} role="alert"><p>{locale === "fa" ? "دریافت وضعیت انتقال‌ها ممکن نشد." : "We couldn’t refresh your transfers."}</p><button className={styles.secondary} onClick={onRefresh} disabled={refreshing}>{copy.retry}</button></div>}
    {loading ? <div className={styles.empty} role="status">{copy.loading}</div> : <>
      {visible.map(request => {
        const journey = getRequestJourney(request), recipient = request.quote.recipient_snapshot;
        const presentation = journeyPresentation(request, locale);
        const name = request.quote.institution_name || String(recipient.label || recipient.full_name || recipient.account_name || (locale === "fa" ? "انتقال وجه" : "Money transfer"));
        const completed = request.status === "completed", attention = requestNeedsAttention(request);
        const Icon = completed ? Check : request.quote.funding_currency === "AUD" ? ArrowUpRight : ArrowDownLeft;
        return <Link key={request.id} className={styles.activityRow} href={`/${locale}/dashboard/requests/${request.id}`}>
          <span className={styles.activityIcon} data-complete={completed}><Icon size={18} aria-hidden="true"/></span>
          <div><div className={styles.activityName}>{name}{request.service_tier === "priority" && <span className={styles.priority}>{locale === "fa" ? "اولویت‌دار" : "Priority"}</span>}</div>
            <div className={styles.activityMeta}><bdi>{request.reference_code}</bdi><span>·</span><time dir="ltr" dateTime={request.created_at}>{requestDate(request.created_at, locale).split(",")[0]}</time></div>
            {!journey.closed && !completed && <div className={styles.progressRail} aria-hidden="true">{[0,1,2,3,4].map(step => <i key={step} data-done={journey.stage >= step}/>)}</div>}
          </div>
          <div className={styles.activityAmount}><bdi data-private-value>{requestMoney(request.quote.funding_total,request.quote.funding_currency,locale)}</bdi>
            <span className={styles.status} data-tone={completed ? "complete" : attention ? "attention" : "neutral"}>{presentation.status}</span>
            <span className={styles.nextActor} data-actor={presentation.nextActor}>{locale === "fa" ? "مرحله بعد" : "Next"} · {presentation.actorLabel}</span>
          </div>
        </Link>;
      })}
      {!visible.length && !error && <div className={styles.empty}><ArrowLeftRight size={28}/><h2>{requests.length ? copy.emptySearch : copy.noTransfers}</h2><p>{requests.length ? copy.emptySearchHint : copy.noTransfersHint}</p>
        {!requests.length && <Link className={styles.primary} href={dashboardHref(locale,"transfer")}>{copy.newTransfer}<ArrowUpRight size={16}/></Link>}
      </div>}
      {!compact && visible.length > 0 && <div className={styles.more}>{filtered.length > visible.length ? <button className={styles.secondary} onClick={() => setLimit(value => value + 20)}>{copy.more}</button> : <span className={styles.count}>{visible.length} {locale === "fa" ? "انتقال" : "transfers"}</span>}</div>}
    </>}
  </section>;
}
