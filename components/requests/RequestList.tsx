"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, RefreshCw, Search } from "lucide-react";
import { listAdminRequests, listMyRequests } from "@/app/actions/request.actions";
import type { ExchangeRequest } from "@/lib/requests/types";
import { requestDate, requestMoney, requestError, isRequestTerminal, type RequestLocale } from "./request-labels";
import { getRequestJourney, requestStageLabel } from "@/lib/requests/journey";
import { journeyPresentation } from "@/lib/dashboard/journey-presentation";
import { DASHBOARD_AUTO_REFRESH_MS, dashboardRefreshDue } from "@/lib/dashboard/refresh-policy";
import styles from "@/styles/requests/Requests.module.css";
import workspace from "@/styles/requests/RequestWorkspace.module.css";

export function RequestList({ admin = false, locale = "en", embedded = false }: { admin?: boolean; locale?: RequestLocale; embedded?: boolean }) {
  const fa = locale === "fa";
  const [requests, setRequests] = useState<ExchangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("active");
  const [search, setSearch] = useState("");
  const lastRefresh = useRef(0), refreshPending = useRef(false);
  const refresh = useCallback(async () => {
    if (refreshPending.current) return;
    refreshPending.current = true; lastRefresh.current = Date.now();
    setRefreshing(true);
    try {
      const result = await (admin ? listAdminRequests() : listMyRequests());
      if (result.error) setError(result.error);
      else if (result.data) { setRequests(result.data); setError(""); }
    } catch { setError(fa ? "دریافت درخواست‌ها ممکن نشد. دوباره تلاش کنید." : "Could not load requests. Please try again."); }
    finally { refreshPending.current = false; setLoading(false); setRefreshing(false); }
  }, [admin, fa]);

  useEffect(() => {
    void refresh();
    if (admin) return;
    const onFocus = () => { if (document.visibilityState === "visible" && dashboardRefreshDue(lastRefresh.current)) void refresh(); };
    const timer = window.setInterval(onFocus, DASHBOARD_AUTO_REFRESH_MS);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, [admin, refresh]);

  const filters = [
    { id: "active", label: fa ? "فعال" : "Active" },
    ...(admin ? [
      { id: "review", label: fa ? "بررسی" : "Review" },
      { id: "funding", label: fa ? "بررسی واریزی" : "Check payment" },
      { id: "ready", label: fa ? "آماده تکمیل" : "To complete" },
    ] : []),
    { id: "closed", label: fa ? "بسته‌شده" : "Closed" },
    { id: "all", label: fa ? "همه" : "All" },
  ];
  const isReviewPending = (request: ExchangeRequest) => {
    if (isRequestTerminal(request.status)) return false;
    const journey = getRequestJourney(request);
    if (!journey.approved) return true;
    return journey.fundsReceived && (journey.customerActionRequired || ["under_review", "action_required"].includes(request.status));
  };
  const isFundingPending = (request: ExchangeRequest) => {
    const journey = getRequestJourney(request);
    return journey.receiptSubmitted && !journey.fundsReceived && !isRequestTerminal(request.status);
  };
  const isReadyForCompletion = (request: ExchangeRequest) => {
    const journey = getRequestJourney(request);
    return journey.readyForSettlement || ["processing", "reconciliation"].includes(request.status);
  };
  const matchesFilter = (request: ExchangeRequest, value: string) => value === "all"
    || (value === "active" && !isRequestTerminal(request.status))
    || (value === "closed" && isRequestTerminal(request.status))
    || (value === "review" && isReviewPending(request))
    || (value === "funding" && isFundingPending(request))
    || (value === "ready" && isReadyForCompletion(request));
  const nextAction = (request: ExchangeRequest) => {
    const journey = getRequestJourney(request);
    if (request.funding_status === "refund_pending" || request.priority_fee_status === "refund_pending") return "Confirm refund";
    if (isRequestTerminal(request.status)) return "—";
    if (journey.customerActionRequired) return "Waiting for reply";
    if (journey.fundsReceived) return journey.readyForSettlement || ["processing", "reconciliation"].includes(request.status) ? "Reconcile & complete" : "Review funds";
    if (request.action_required) return "Admin review";
    if (!journey.approved) return "Approve request";
    if (journey.receiptSubmitted) return "Verify bank payment";
    if (["submitted", "under_review"].includes(request.status)) return "Resume payment";
    return "Waiting for receipt";
  };
  const visible = requests.filter(request => matchesFilter(request, filter)
    && `${request.reference_code} ${request.quote.sender_snapshot.name} ${request.quote.sender_snapshot.email}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => admin ? (new Date(a.handling_due_at || "9999-01-01").getTime() - new Date(b.handling_due_at || "9999-01-01").getTime() || new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) : new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return <section className={`${embedded ? styles.embedded : styles.workspace} ${workspace.workspace} ${admin ? workspace.adminWorkspace : ""}`} dir={fa ? "rtl" : "ltr"}>
    <header className={`${styles.header} ${workspace.header}`}>
      <div>{embedded ? <h2>{fa ? "درخواست‌های من" : "My requests"}</h2> : <h1>{admin ? "Request queue" : (fa ? "درخواست‌های من" : "My requests")}</h1>}</div>
      <div className={styles.actions}>
        {!admin && !embedded && <Link className={`${styles.button} ${workspace.customerPrimary}`} href={`/${locale}/dashboard`}>{fa ? "درخواست جدید" : "New request"}</Link>}
        <button type="button" className={`${styles.secondary} ${!admin ? workspace.customerSecondary : ""}`} onClick={() => void refresh()} disabled={refreshing}>{admin && <RefreshCw size={16} />}{refreshing ? (fa ? "در حال به‌روزرسانی…" : "Refreshing…") : (fa ? "به‌روزرسانی" : "Refresh")}</button>
      </div>
    </header>
    <div className={workspace.queueToolbar}>
      <div className={workspace.filters} role="group" aria-label={fa ? "فیلتر درخواست‌ها" : "Filter requests"}>
        {filters.map(item => { const count = requests.filter(request => matchesFilter(request, item.id)).length; return <button key={item.id} type="button" className={workspace.filter} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}<span aria-label={`${item.label}: ${count} ${fa ? "درخواست" : "requests"}`}>{count}</span></button>; })}
      </div>
      <label className={workspace.search}><Search size={16} aria-hidden="true" /><span className={styles.srOnly}>{fa ? "جستجوی درخواست" : "Search requests"}</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder={admin ? "Code or customer" : (fa ? "کد تراکنش" : "Transaction code")} /></label>
    </div>
    {error && <p className={styles.error} role="alert">{requestError(error, locale)} <button type="button" className={styles.secondary} onClick={() => void refresh()} disabled={refreshing}>{fa ? "تلاش دوباره" : "Retry"}</button></p>}
    {loading ? <p className={styles.loading} role="status">{fa ? "در حال بارگذاری…" : "Loading…"}</p> : admin ? <div className={`${styles.tableWrap} ${workspace.queueTable}`} role="region" aria-label="Request queue" tabIndex={0}>
      <table className={styles.table}><thead><tr><th>Request</th><th>Transfer</th><th>Progress</th><th>Next step</th><th>Due</th><th><span className={styles.srOnly}>Open request</span></th></tr></thead><tbody>
        {visible.map(request => <tr key={request.id}>
          <td><Link href={`/admin/transactions/requests/${request.id}`}><bdi className={styles.reference}>{request.reference_code}</bdi></Link><span className={workspace.cellDetail}>{request.quote.sender_snapshot.name}</span></td>
          <td><strong>{requestMoney(request.quote.funding_total, request.quote.funding_currency, locale)}</strong><span className={workspace.cellDetail}>→ {requestMoney(request.quote.recipient_amount, request.quote.recipient_currency, locale)}</span>{request.service_tier === "priority" && <span className={`${styles.badge} ${styles.priority}`}>Priority</span>}</td>
          <td><span className={`${styles.badge} ${request.status === "completed" ? styles.success : ""}`}>{requestStageLabel(request, locale)}</span>{request.funding_status === "partial" && <span className={workspace.cellDetail}>{requestMoney(request.funding_received, request.quote.funding_currency, locale)} received</span>}</td>
          <td>{nextAction(request)}</td>
          <td><span dir="ltr">{request.handling_due_at && !isRequestTerminal(request.status) ? requestDate(request.handling_due_at, locale) : "—"}</span></td>
          <td><Link className={workspace.openRequest} href={`/admin/transactions/requests/${request.id}`} aria-label={`Open ${request.reference_code}`}>Open <ArrowRight size={14} /></Link></td>
        </tr>)}
      </tbody></table>{!visible.length && !error && <p className={styles.empty}>No requests in this view.</p>}
    </div> : <div className={styles.list}>
      {visible.map(request => {
        const presentation = journeyPresentation(request, locale);
        return <Link className={`${styles.request} ${workspace.customerRequest}`} key={request.id} href={`/${locale}/dashboard/requests/${request.id}`}>
          <div><div className={styles.actions}><bdi className={styles.reference}>{request.reference_code}</bdi>{request.service_tier === "priority" && <span className={`${styles.badge} ${styles.priority}`}>{fa ? "اولویت‌دار" : "Priority"}</span>}</div>
            <p className={workspace.transferAmount}><span><small>{fa ? "پرداخت شما" : "You send"}</small><bdi>{requestMoney(request.quote.funding_total, request.quote.funding_currency, locale)}</bdi></span><span><small>{fa ? "دریافتی گیرنده" : "Recipient gets"}</small><bdi>{requestMoney(request.quote.recipient_amount, request.quote.recipient_currency, locale)}</bdi></span></p>
            <time dir="ltr" className={styles.muted} dateTime={request.created_at}>{requestDate(request.created_at, locale)}</time>
          </div>
          <div className={workspace.customerRequestStatus}><span className={`${styles.badge} ${request.status === "completed" ? styles.success : ""}`}>{presentation.status}</span><span className={workspace.nextActor} data-actor={presentation.nextActor}>{fa ? "اقدام بعدی" : "Next actor"} · {presentation.actorLabel}</span>{getRequestJourney(request).customerActionRequired && <span className={workspace.attention}>{fa ? "پیام زرمان را ببینید" : "View Zarman’s message"}</span>}<span className={workspace.openRequest}>{fa ? "مشاهده درخواست" : "View request"}</span></div>
        </Link>;
      })}
      {!visible.length && !error && <div className={`${styles.card} ${styles.empty}`}>{fa ? "درخواستی در این بخش نیست." : "No requests in this view."}</div>}
    </div>}
  </section>;
}
