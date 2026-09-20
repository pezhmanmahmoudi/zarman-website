"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { createRequestQuote, getRequestPolicy, submitExchangeRequest } from "@/app/actions/request.actions";
import type { ExchangeRequest, PublicRequestSettings, QuoteInput, RequestQuote, ServiceTier } from "@/lib/requests/types";
import { getRequestJourney } from "@/lib/requests/journey";
import { RequestQuoteFacts } from "./RequestQuoteFacts";
import { RequestPaymentInstructions } from "./RequestPaymentInstructions";
import { RequestBankTiming } from "./RequestBankTiming";
import { requestDate, requestError, requestMoney } from "./request-labels";
import styles from "@/styles/requests/Requests.module.css";
import compact from "@/styles/requests/RequestPayment.module.css";

type Props = { input: Omit<QuoteInput, "serviceTier">; disabled: boolean; validationMessage: string | null; onBusyChange?: (busy: boolean) => void; onSubmitted?: (request: ExchangeRequest) => void };

export function OnlineRequestSubmit({ input, disabled, validationMessage, onBusyChange, onSubmitted }: Props) {
  const fa = input.locale === "fa";
  const numbers = new Intl.NumberFormat(fa ? "fa-IR" : "en-AU");
  const [policy, setPolicy] = useState<PublicRequestSettings | null>(null);
  const [loadingPolicy, setLoadingPolicy] = useState(true);
  const [tier, setTier] = useState<ServiceTier>("standard");
  const [quote, setQuote] = useState<RequestQuote | null>(null);
  const [quotedInput, setQuotedInput] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<ExchangeRequest | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const commandKey = useRef("");
  const submitting = useRef(false);
  const currentInput = JSON.stringify({ ...input, serviceTier: tier });
  const activeQuote = quote && quotedInput === currentInput ? quote : null;
  const expired = activeQuote ? new Date(activeQuote.expires_at).getTime() <= now : false;
  const shownPolicy = activeQuote?.snapshot.policy_snapshot || policy;

  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);

  useEffect(() => {
    let alive = true;
    getRequestPolicy().then(result => {
      if (!alive) return;
      if (result.error) setError(result.error);
      else if (result.data) setPolicy(result.data);
    }).catch(() => { if (alive) setError(fa ? "گزینه‌های سرویس دریافت نشد. صفحه را دوباره بارگذاری کنید." : "Service options unavailable. Please reload."); })
      .finally(() => { if (alive) setLoadingPolicy(false); });
    return () => { alive = false; };
  }, [fa]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function review() {
    if (submitting.current) return;
    if (validationMessage) { setError(validationMessage); return; }
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await createRequestQuote({ ...input, serviceTier: tier });
      if (result.error) setError(result.error);
      else if (result.data) {
        setQuote(result.data);
        setQuotedInput(currentInput);
        setAccepted(false);
        commandKey.current = crypto.randomUUID();
        setNow(Date.now());
      }
    } catch { setError(fa ? "دریافت پیش‌فاکتور انجام نشد. دوباره تلاش کنید." : "Could not load your quote. Please try again."); }
    finally { submitting.current = false; setBusy(false); }
  }

  async function submit() {
    if (submitting.current || !activeQuote || !accepted || expired) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await submitExchangeRequest({ quoteId: activeQuote.id, commandKey: commandKey.current });
      if (result.error) setError(result.error);
      else if (result.data) { setSaved(result.data); onSubmitted?.(result.data); }
    } catch { setError(fa ? "تأیید ثبت دریافت نشد. با همین دکمه دوباره تلاش کنید." : "Submission could not be confirmed. Retry using this button."); }
    finally { submitting.current = false; setBusy(false); }
  }

  if (saved) return <section className={`${styles.embedded} ${compact.confirmation}`} dir={fa ? "rtl" : "ltr"} aria-live="polite">
    <div className={compact.confirmationHeader}><CheckCircle2 size={26} aria-hidden="true" /><h2>{fa ? "درخواست ثبت شد" : "Request submitted"}</h2></div>
    <p>{fa ? "کد تراکنش" : "Transaction code"}<bdi dir="ltr" className={compact.confirmationReference}>{saved.reference_code}</bdi></p>
    {!getRequestJourney(saved).approved && <p>{fa ? "درخواست شما در انتظار تأیید مدیر است. پس از تأیید، مشخصات حساب برای واریز نمایش داده می‌شود." : "Your request is awaiting approval. Bank details will appear once we approve it."}</p>}
    <RequestPaymentInstructions request={saved} locale={input.locale} />
    <Link className={styles.button} href={`/${input.locale}/dashboard/requests/${saved.id}`}>{fa ? "مشاهده درخواست" : "View request"}<ArrowRight size={17} className={fa ? compact.rtlArrow : undefined} aria-hidden="true" /></Link>
  </section>;

  return <section className={styles.embedded} dir={fa ? "rtl" : "ltr"} aria-label={fa ? "سرویس و تأیید درخواست" : "Service and confirmation"}>
    {loadingPolicy && <p className={styles.muted} role="status">{fa ? "در حال دریافت سرویس‌ها…" : "Loading services…"}</p>}
    {policy && !policy.enabled && <p className={styles.warning}>{fa ? "ثبت درخواست جدید فعلاً غیرفعال است." : "New requests are currently paused."}</p>}
    {policy?.enabled && <>
      <fieldset className={styles.services} disabled={busy}>
        <legend>{fa ? "سرویس" : "Service"}</legend>
        <label className={styles.service} data-selected={tier === "standard"}>
          <input type="radio" name="request-service" value="standard" checked={tier === "standard"} onChange={() => { setTier("standard"); setAccepted(false); }} />
          <strong>{fa ? "استاندارد" : "Standard"}</strong>
          <p>{fa ? "بدون هزینه اضافه" : "No extra fee"}</p>
          <p className={compact.serviceTime}>{fa ? `هدف رسیدگی: ${numbers.format(policy.standard_minutes)} دقیقه کاری` : `Handling target: ${numbers.format(policy.standard_minutes)} business minutes`}</p>
        </label>
        <label className={styles.service} data-selected={tier === "priority"} data-disabled={!policy.priority_enabled}>
          <input type="radio" name="request-service" value="priority" checked={tier === "priority"} disabled={!policy.priority_enabled} onChange={() => { setTier("priority"); setAccepted(false); }} />
          <strong>{fa ? "اولویت‌دار" : "Priority"}</strong>
          <p>{policy.priority_enabled ? <bdi>+ {requestMoney(policy.priority_fee_aud, "AUD", input.locale)}</bdi> : (fa ? "فعلاً غیرفعال" : "Unavailable")}</p>
          <p className={compact.serviceTime}>{fa ? `هدف رسیدگی: ${numbers.format(policy.priority_minutes)} دقیقه کاری` : `Handling target: ${numbers.format(policy.priority_minutes)} business minutes`}</p>
        </label>
      </fieldset>
      <RequestBankTiming locale={input.locale} fundingCurrency={input.txType === "buy_aud" ? "IRT" : "AUD"} iranBankingNotice={shownPolicy?.iran_banking_notice} iranBankingNoticeFa={shownPolicy?.iran_banking_notice_fa} />
      {shownPolicy && <details className={`${compact.details} ${compact.serviceDetails}`}>
        <summary>{fa ? "ساعات و شرایط سرویس" : "Service hours & terms"}</summary>
        <p>{fa ? "ساعات کاری سیدنی: " : "Sydney hours: "}<bdi dir="ltr">{String(shownPolicy.opening_hour).padStart(2, "0")}:00–{String(shownPolicy.closing_hour).padStart(2, "0")}:00</bdi></p>
        <p>{shownPolicy.business_days.map(day => (fa ? ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"] : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"])[day]).join(fa ? "، " : ", ")}{shownPolicy.holidays.length > 0 && <>{fa ? "؛ تعطیلات: " : "; holidays: "}<bdi dir="ltr">{shownPolicy.holidays.join(", ")}</bdi></>}</p>
        <p>{fa ? "زمان رسیدگی پس از تأیید وجه و بررسی‌ها محاسبه می‌شود. زمان تسویه بانکی جداست." : "Handling begins after funds and checks are confirmed. Bank settlement time is separate."}</p>
        {tier === "priority" && <><p>{fa ? shownPolicy.priority_terms_fa : shownPolicy.priority_terms}</p><p>{fa ? "ظرفیت سرویس اولویت‌دار هنگام تأیید درخواست بررسی می‌شود." : "Priority availability is confirmed when we approve your request."}</p></>}
      </details>}
      {!activeQuote && <button className={styles.button} type="button" onClick={review} disabled={busy || disabled}>{busy ? (fa ? "در حال محاسبه…" : "Preparing quote…") : (fa ? "بررسی مبلغ نهایی" : "Review total")}<ArrowRight size={17} className={fa ? compact.rtlArrow : undefined} aria-hidden="true" /></button>}
      {activeQuote && <div className={`${styles.card} ${compact.compactCard}`} aria-live="polite">
        <h3>{fa ? "پیش‌فاکتور نهایی" : "Final quote"}</h3>
        <RequestQuoteFacts quote={activeQuote.snapshot} locale={input.locale} />
        <p className={compact.deadline}>{fa ? "معتبر تا " : "Valid until "}<bdi dir="ltr">{requestDate(activeQuote.expires_at, input.locale)}</bdi> ({fa ? "سیدنی" : "Sydney"})</p>
        {expired ? <p className={styles.warning}>{fa ? "پیش‌فاکتور منقضی شد. مبلغ را دوباره محاسبه کنید." : "Quote expired. Refresh the quote to continue."}</p> : <label className={styles.checkbox}>
          <input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} disabled={busy} />
          <span>{fa ? "مبالغ، اطلاعات گیرنده و شرایط سرویس را تأیید می‌کنم." : "I accept the amounts, recipient details and service terms."}</span>
        </label>}
        <div className={styles.actions}>
          {!expired && <button className={styles.button} type="button" onClick={submit} disabled={busy || !accepted || disabled}>{busy ? (fa ? "در حال ثبت…" : "Submitting…") : (fa ? "ثبت درخواست" : "Submit request")}</button>}
          <button className={styles.secondary} type="button" onClick={review} disabled={busy || disabled}>{fa ? "محاسبه مجدد" : "Refresh quote"}</button>
        </div>
      </div>}
    </>}
    {error && <p className={styles.error} role="alert">{requestError(error, input.locale)}</p>}
    <p><Link className={styles.secondary} href={`/${input.locale}/dashboard/requests`}>{fa ? "درخواست‌های من" : "My requests"}</Link></p>
  </section>;
}
