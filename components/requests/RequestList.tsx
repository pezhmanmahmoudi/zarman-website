"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, RefreshCw, Search } from "lucide-react";
import { listAdminRequests, listMyRequests } from "@/app/actions/request.actions";
import type { ExchangeRequest } from "@/lib/requests/types";
import { requestDate, requestLabel, requestMoney, requestError, isRequestTerminal, type RequestLocale } from "./request-labels";
import { RequestSettingsForm } from "./RequestSettingsForm";
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
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await (admin ? listAdminRequests() : listMyRequests());
      if (result.error) setError(result.error);
      else if (result.data) { setRequests(result.data); setError(""); }
    } catch { setError(fa ? "دریافت درخواست‌ها ممکن نشد. دوباره تلاش کنید." : "Could not load requests. Please try again."); }
    finally { setLoading(false); setRefreshing(false); }
  }, [admin, fa]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 30000);
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [refresh]);

  const filters = [
    { id: "active", label: fa ? "فعال" : "Active" },
    ...(admin ? [{ id: "review", label: "Review" }, { id: "funding", label: "Payments" }, { id: "ready", label: "Ready" }] : []),
    { id: "closed", label: fa ? "بسته‌شده" : "Closed" },
    { id: "all", label: fa ? "همه" : "All" },
  ];
  const matchesFilter = (request: ExchangeRequest, value: string) => value === "all"
    || (value === "active" && !isRequestTerminal(request.status))
    || (value === "closed" && isRequestTerminal(request.status))
    || (value === "review" && ["submitted", "under_review", "action_required", "reconciliation"].includes(request.status))
    || (value === "funding" && (request.status === "awaiting_funds" || request.funding_status === "refund_pending" || request.priority_fee_status === "refund_pending"))
    || (value === "ready" && request.status === "ready");
  const visible = requests.filter(request => matchesFilter(request, filter)
    && `${request.reference_code} ${request.quote.sender_snapshot.name} ${request.quote.sender_snapshot.email}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => admin ? (new Date(a.handling_due_at || "9999-01-01").getTime() - new Date(b.handling_due_at || "9999-01-01").getTime() || new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) : new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return <section className={`${embedded ? styles.embedded : styles.workspace} ${workspace.workspace} ${admin ? workspace.adminWorkspace : ""}`} dir={fa ? "rtl" : "ltr"}>
    <header className={`${styles.header} ${workspace.header}`}>
      <div>{embedded ? <h2>{fa ? "درخواست‌های من" : "My requests"}</h2> : <h1>{admin ? "Request queue" : (fa ? "درخواست‌های من" : "My requests")}</h1>}</div>
      <div className={styles.actions}>
        {!admin && !embedded && <Link className={styles.button} href={`/${locale}/dashboard`}>{fa ? "درخواست جدید" : "New request"}<ArrowRight size={16} /></Link>}
        <button type="button" className={styles.secondary} onClick={() => void refresh()} disabled={refreshing}><RefreshCw size={16} />{fa ? "به‌روزرسانی" : "Refresh"}</button>
      </div>
    </header>
    {admin && <RequestSettingsForm />}
    <div className={workspace.queueToolbar}>
      <div className={workspace.filters} role="group" aria-label={fa ? "فیلتر درخواست‌ها" : "Filter requests"}>
        {filters.map(item => <button key={item.id} type="button" className={workspace.filter} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}<span>{requests.filter(request => matchesFilter(request, item.id)).length}</span></button>)}
      </div>
      <label className={workspace.search}><Search size={16} aria-hidden="true" /><span className={styles.srOnly}>{fa ? "جستجوی درخواست" : "Search requests"}</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder={admin ? "Code or customer" : (fa ? "کد تراکنش" : "Transaction code")} /></label>
    </div>
    {error && <p className={styles.error} role="alert">{requestError(error, locale)}</p>}
    {loading ? <p className={styles.loading} role="status">{fa ? "در حال بارگذاری…" : "Loading…"}</p> : admin ? <div className={`${styles.tableWrap} ${workspace.queueTable}`} role="region" aria-label="Request queue" tabIndex={0}>
      <table className={styles.table}><thead><tr><th>Request / Customer</th><th>Transfer</th><th>Stage</th><th>Funding</th><th>Handling due</th><th><span className={styles.srOnly}>Manage</span></th></tr></thead><tbody>
        {visible.map(request => <tr key={request.id}>
          <td><Link href={`/admin/requests/${request.id}`}><bdi className={styles.reference}>{request.reference_code}</bdi></Link><span className={workspace.cellDetail}>{request.quote.sender_snapshot.name}</span><span className={workspace.cellDetail}>{request.quote.sender_snapshot.email}</span></td>
          <td><strong>{requestMoney(request.quote.funding_total, request.quote.funding_currency, locale)}</strong><span className={workspace.cellDetail}>→ {requestMoney(request.quote.recipient_amount, request.quote.recipient_currency, locale)}</span>{request.service_tier === "priority" && <span className={`${styles.badge} ${styles.priority}`}>Priority</span>}</td>
          <td><span className={`${styles.badge} ${request.status === "completed" ? styles.success : ""}`}>{requestLabel(request.status, locale)}</span>{request.action_required && <span className={workspace.cellDetail}>Customer action needed</span>}{request.status === "processing" && <span className={workspace.cellDetail}>{request.owner_id ? "Assigned" : "Unassigned"}</span>}</td>
          <td>{requestLabel(request.funding_status, locale)}{request.evidence_submitted_at && request.funding_status !== "confirmed" && <span className={workspace.attention}>Payment evidence received</span>}{request.priority_fee_status === "refund_pending" && <span className={workspace.attention}>Priority refund due</span>}</td>
          <td><span>{request.handling_due_at && !isRequestTerminal(request.status) ? requestDate(request.handling_due_at, locale) : "—"}</span><span className={workspace.cellDetail}>Submitted {requestDate(request.created_at, locale)}</span></td>
          <td><Link className={workspace.openRequest} href={`/admin/requests/${request.id}`} aria-label={`Manage ${request.reference_code}`}>Manage <ArrowRight size={14} /></Link></td>
        </tr>)}
      </tbody></table>{!visible.length && !error && <p className={styles.empty}>No requests in this view.</p>}
    </div> : <div className={styles.list}>
      {visible.map(request => <Link className={`${styles.request} ${workspace.customerRequest}`} key={request.id} href={`/${locale}/dashboard/requests/${request.id}`}>
        <div><div className={styles.actions}><bdi className={styles.reference}>{request.reference_code}</bdi>{request.service_tier === "priority" && <span className={`${styles.badge} ${styles.priority}`}>{fa ? "اولویت‌دار" : "Priority"}</span>}</div>
          <p className={workspace.transferAmount}><bdi>{requestMoney(request.quote.funding_total, request.quote.funding_currency, locale)}</bdi> <span aria-hidden="true">{fa ? "←" : "→"}</span> <bdi>{requestMoney(request.quote.recipient_amount, request.quote.recipient_currency, locale)}</bdi></p>
          <time className={styles.muted} dateTime={request.created_at}>{requestDate(request.created_at, locale)}</time>
        </div>
        <div className={workspace.customerRequestStatus}><span className={`${styles.badge} ${request.status === "completed" ? styles.success : ""}`}>{requestLabel(request.status, locale)}</span>{request.action_required && <span className={workspace.attention}>{fa ? "پیام زرمان را ببینید" : "View Zarman’s message"}</span>}<span className={workspace.openRequest}>{fa ? "مشاهده درخواست" : "View request"}<ArrowRight size={14} /></span></div>
      </Link>)}
      {!visible.length && !error && <div className={`${styles.card} ${styles.empty}`}>{fa ? "درخواستی در این بخش نیست." : "No requests in this view."}</div>}
    </div>}
  </section>;
}
