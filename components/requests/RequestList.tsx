"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, RefreshCw } from "lucide-react";
import { listAdminRequests, listMyRequests } from "@/app/actions/request.actions";
import type { ExchangeRequest } from "@/lib/requests/types";
import { requestDate, requestLabel, requestMoney, isRequestTerminal, type RequestLocale } from "./request-labels";
import { RequestSettingsForm } from "./RequestSettingsForm";
import styles from "@/styles/requests/Requests.module.css";

export function RequestList({ admin = false, locale = "en", embedded = false }: { admin?: boolean; locale?: RequestLocale; embedded?: boolean }) {
  const fa = locale === "fa";
  const [requests, setRequests] = useState<ExchangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("active");
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

  const visible = requests.filter(request => filter === "all" || (filter === "active" ? !isRequestTerminal(request.status) : isRequestTerminal(request.status)))
    .sort((a, b) => admin ? (new Date(a.handling_due_at || "9999-01-01").getTime() - new Date(b.handling_due_at || "9999-01-01").getTime() || new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) : new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return <section className={embedded ? styles.embedded : styles.workspace} dir={fa ? "rtl" : "ltr"}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>Zarman / {admin ? "Operations" : (fa ? "حواله‌ها" : "Transfers")}</span>
        {embedded ? <h2>{fa ? "درخواست‌های آنلاین" : "Online requests"}</h2> : <h1>{admin ? "Request queue" : (fa ? "درخواست‌های من" : "My requests")}</h1>}
        <p className={styles.muted}>{admin ? "Earliest handling deadline first, then submission age. Only ready requests can start processing." : (fa ? "پیگیری وضعیت، ارسال اطلاعات تکمیلی و مشاهده مبلغ واریز، همه در همین سایت." : "Track progress, respond to information requests and view payment instructions in one place.")}</p>
      </div>
      <div className={styles.actions}>
        {!admin && !embedded && <Link className={styles.button} href={`/${locale}/dashboard`}>{fa ? "درخواست جدید" : "New request"}<ArrowRight size={16} /></Link>}
        <button type="button" className={styles.secondary} onClick={() => void refresh()} disabled={refreshing}><RefreshCw size={16} />{fa ? "به‌روزرسانی" : "Refresh"}</button>
      </div>
    </header>
    <div className={styles.actions} style={{ marginBottom: 18 }}>
      <label className={styles.field}>{fa ? "نمایش" : "Show"}<select value={filter} onChange={e => setFilter(e.target.value)}><option value="active">{fa ? "درخواست‌های فعال" : "Active requests"}</option><option value="all">{fa ? "همه درخواست‌ها" : "All requests"}</option><option value="closed">{fa ? "درخواست‌های بسته‌شده" : "Closed requests"}</option></select></label>
      <span className={styles.muted}>{visible.length} {fa ? "درخواست" : "requests"}</span>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {loading ? <p className={styles.loading} role="status">{fa ? "در حال بارگذاری درخواست‌ها…" : "Loading requests…"}</p> : <div className={styles.list}>
      {visible.map(request => <Link className={styles.request} key={request.id} href={admin ? `/admin/requests/${request.id}` : `/${locale}/dashboard/requests/${request.id}`}>
        <div>
          <div className={styles.actions}><bdi className={styles.reference}>{request.reference_code}</bdi><span className={`${styles.badge} ${request.service_tier === "priority" ? styles.priority : ""}`}>{request.service_tier === "priority" ? (fa ? "اولویت‌دار" : "Priority") : (fa ? "استاندارد" : "Standard")}</span></div>
          {admin && <p className={styles.muted}>{request.quote.sender_snapshot.name} · {request.quote.sender_snapshot.email}</p>}
          <p className={styles.muted}>{requestMoney(request.quote.funding_total, request.quote.funding_currency, locale)} → {requestMoney(request.quote.recipient_amount, request.quote.recipient_currency, locale)}</p>
          <p className={styles.muted}>{requestDate(request.created_at, locale)}</p>
        </div>
        <div>
          <span className={`${styles.badge} ${request.status === "completed" ? styles.success : ""}`}>{requestLabel(request.status, locale)}</span>
          {request.handling_due_at && <p className={styles.muted}>{fa ? "مهلت شروع رسیدگی: " : "Handling due: "}{requestDate(request.handling_due_at, locale)}</p>}
          {admin && <p className={styles.muted}>{requestLabel(request.funding_status, locale)} · {request.owner_id ? "Assigned" : "Unassigned"}</p>}
          {request.action_required && <p className={styles.muted}>{fa ? "برای مشاهده اقدام بعدی باز کنید" : "Open to view the required action"}</p>}
          {request.priority_fee_status === "refund_pending" && <p className={styles.muted}>{fa ? "بازپرداخت هزینه اولویت در انتظار انجام" : "Priority fee refund pending"}</p>}
        </div>
      </Link>)}
      {!visible.length && !error && <div className={`${styles.card} ${styles.empty}`}>{fa ? "درخواستی در این بخش وجود ندارد." : "No requests in this view."}</div>}
    </div>}
    {admin && <RequestSettingsForm />}
  </section>;
}
