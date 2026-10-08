"use client";
import { useRef, useState } from "react";
import { acceptMyRequestPricing } from "@/app/actions/request.actions";
import type { ExchangeRequest, RequestLocale } from "@/lib/requests/types";
import { RequestQuoteFacts } from "./RequestQuoteFacts";
import { requestError } from "./request-labels";
import { DashboardButton } from "@/components/dashboard/dashboard-ui";
import styles from "@/styles/requests/RequestPricing.module.css";

export function RequestPricingAcceptance({ request, locale, onAccepted, onRefresh }: { request: ExchangeRequest; locale: RequestLocale; onAccepted: (request: ExchangeRequest) => void; onRefresh?: () => Promise<void> }) {
  const fa = locale === "fa";
  const [accepted, setAccepted] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const pending = useRef(false), attempt = useRef<{ version: number; key: string } | null>(null);
  async function accept() {
    if (!accepted || pending.current) return;
    if (!attempt.current) attempt.current = { version: request.version, key: crypto.randomUUID() };
    pending.current = true; setBusy(true); setError("");
    try {
      const result = await acceptMyRequestPricing({ requestId: request.id, expectedVersion: attempt.current.version, commandKey: attempt.current.key });
      if (result.error) {
        setError(requestError(result.error, locale));
        if (result.error === "This request has changed. Refresh the page before continuing." || result.error === "REQUEST_CONFLICT") {
          attempt.current = null; await onRefresh?.();
        }
      }
      else if (result.data) onAccepted(result.data);
    } catch { setError(fa ? "تأیید دریافت نشد. وضعیت درخواست را به‌روزرسانی کنید." : "Acceptance was not confirmed. Refresh the request."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <section className={styles.acceptance} dir={fa ? "rtl" : "ltr"} aria-label={fa ? "تأیید مبالغ اصلاح‌شده" : "Accept revised amounts"}>
    <h2>{fa ? "مبالغ درخواست اصلاح شده‌اند" : "Your transfer amounts have been revised"}</h2>
    <p>{request.customer_action_required}</p>
    <RequestQuoteFacts quote={request.quote} locale={locale}/>
    <p>{fa ? "قبل از واریز، مبالغ جدید را بررسی و تأیید کنید. مشخصات پرداخت پس از تأیید تیم زرمان نمایش داده می‌شود." : "Review the revised amounts before paying. Payment instructions will follow staff approval."}</p>
    <label><input type="checkbox" checked={accepted} disabled={busy} onChange={event => setAccepted(event.target.checked)}/>{" "}{fa ? "مبالغ اصلاح‌شده را تأیید می‌کنم." : "I accept these revised amounts."}</label>
    <div className={styles.actions}><DashboardButton onClick={accept} disabled={!accepted || busy}>{busy ? (fa ? "در حال ثبت…" : "Saving…") : (fa ? "تأیید مبالغ جدید" : "Accept revised amounts")}</DashboardButton></div>
    {error && <p className={styles.error} role="alert">{error}</p>}
  </section>;
}
