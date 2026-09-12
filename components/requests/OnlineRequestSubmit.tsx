"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3 } from "lucide-react";
import { createRequestQuote, getRequestPolicy, submitExchangeRequest } from "@/app/actions/request.actions";
import type { ExchangeRequest, PublicRequestSettings, QuoteInput, RequestQuote, ServiceTier } from "@/lib/requests/types";
import { RequestQuoteFacts } from "./RequestQuoteFacts";
import { requestDate, requestMoney } from "./request-labels";
import styles from "@/styles/requests/Requests.module.css";

type Props = { input: Omit<QuoteInput, "serviceTier">; disabled: boolean; validationMessage: string | null };

export function OnlineRequestSubmit({ input, disabled, validationMessage }: Props) {
  const fa = input.locale === "fa";
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

  useEffect(() => {
    let alive = true;
    getRequestPolicy().then(result => {
      if (!alive) return;
      if (result.error) setError(result.error);
      else if (result.data) setPolicy(result.data);
    }).catch(() => { if (alive) setError(fa ? "دریافت اطلاعات سرویس ممکن نشد. صفحه را دوباره بارگذاری کنید." : "Service options could not be loaded. Please reload this page."); })
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
    } catch { setError(fa ? "دریافت پیش‌فاکتور انجام نشد. اطلاعات شما حفظ شده؛ دوباره تلاش کنید." : "Could not retrieve your quote. Your details are preserved; please try again."); }
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
      else if (result.data) setSaved(result.data);
    } catch { setError(fa ? "تأیید ثبت درخواست دریافت نشد. با همین دکمه دوباره تلاش کنید؛ درخواست تکراری ایجاد نمی‌شود." : "We could not confirm submission. Retry with this button; the same submission key prevents duplicates."); }
    finally { submitting.current = false; setBusy(false); }
  }

  if (saved) return <section className={`${styles.embedded} ${styles.card}`} dir={fa ? "rtl" : "ltr"} aria-live="polite">
    <CheckCircle2 size={30} color="#126d64" />
    <h2>{fa ? "درخواست شما ثبت شد" : "Your request has been submitted"}</h2>
    <p>{fa ? "کد پیگیری" : "Your reference"}: <bdi className={styles.reference}>{saved.reference_code}</bdi></p>
    <p className={styles.muted}>{fa ? "پیشرفت و اقدامات بعدی را در صفحه پیگیری ببینید. به‌روزرسانی وضعیت برای شما و تیم مدیریت در سیستم ثبت می‌شود." : "Follow progress and next actions on your tracking page. Status updates are recorded for you and the management team."}</p>
    <Link className={styles.button} href={`/${input.locale}/dashboard/requests/${saved.id}`}>{fa ? "پیگیری درخواست" : "Track request"}<ArrowRight size={17} /></Link>
  </section>;

  return <section className={styles.embedded} dir={fa ? "rtl" : "ltr"} aria-label={fa ? "انتخاب سرویس و تأیید درخواست" : "Service and request confirmation"}>
    {loadingPolicy && <p className={styles.muted} role="status">{fa ? "در حال دریافت گزینه‌های سرویس…" : "Loading service options…"}</p>}
    {policy && !policy.enabled && <p className={styles.warning}>{fa ? "ثبت آنلاین درخواست هنوز فعال نشده است. سوابق موجود شما در صفحه پیگیری در دسترس است." : "Online request submissions are not available yet. Existing requests remain accessible on the tracking page."}</p>}
    {policy?.enabled && <>
      <fieldset className={styles.services} disabled={busy}>
        <legend>{fa ? "سطح خدمات" : "Choose your service"}</legend>
        <label className={styles.service} data-selected={tier === "standard"}>
          <input type="radio" name="request-service" value="standard" checked={tier === "standard"} onChange={() => { setTier("standard"); setAccepted(false); }} />
          <strong>{fa ? "استاندارد" : "Standard"}</strong>
          <p>{fa ? "بدون هزینه افزوده" : "No additional service fee"}</p>
          <p>{fa ? `هدف شروع رسیدگی: ${policy.standard_minutes} دقیقه کاری پس از تأیید الزامات و وجه.` : `Handling target: ${policy.standard_minutes} business minutes after checks and cleared funds.`}</p>
        </label>
        <label className={styles.service} data-selected={tier === "priority"} data-disabled={!policy.priority_enabled}>
          <input type="radio" name="request-service" value="priority" checked={tier === "priority"} disabled={!policy.priority_enabled} onChange={() => { setTier("priority"); setAccepted(false); }} />
          <strong>{fa ? "اولویت‌دار" : "Priority"}</strong>
          <p>{policy.priority_enabled ? `+ ${requestMoney(policy.priority_fee_aud, "AUD", input.locale)}` : (fa ? "فعلاً در دسترس نیست" : "Currently unavailable")}</p>
          <p>{fa ? `هدف شروع رسیدگی: ${policy.priority_minutes} دقیقه کاری پس از تأیید الزامات، وجه و هزینه سرویس. ظرفیت هنگام ثبت بررسی می‌شود.` : `Handling target: ${policy.priority_minutes} business minutes after checks, cleared funds and fee. Capacity is checked at submission.`}</p>
        </label>
      </fieldset>
      <p className={styles.muted}><Clock3 size={14} aria-hidden="true" /> {fa ? `ساعات کاری: ${policy.opening_hour}:00 تا ${policy.closing_hour}:00 به وقت سیدنی؛ روزهای کاری و تعطیلات طبق شرایط سرویس. زمان تسویه بانکی جداگانه است.` : `Operating hours: ${policy.opening_hour}:00–${policy.closing_hour}:00 Australia/Sydney, on the published business days excluding holidays. Bank settlement time is separate.`}</p>
      <p className={styles.muted}>{fa ? "روزهای کاری: " : "Business days: "}{policy.business_days.map(day => (fa ? ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"] : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"])[day]).join(fa ? "، " : ", ")}{policy.holidays.length > 0 && <>{fa ? " · تعطیلات: " : " · Holidays: "}{policy.holidays.join(", ")}</>}</p>
      {tier === "priority" && <p className={styles.notice}>{fa ? policy.priority_terms_fa : policy.priority_terms}</p>}
      {!activeQuote && <button className={styles.button} type="button" onClick={review} disabled={busy || disabled}>{busy ? (fa ? "در حال محاسبه…" : "Preparing quote…") : (fa ? "دریافت و بررسی پیش‌فاکتور" : "Review final quote")}<ArrowRight size={17} /></button>}
      {activeQuote && <div className={styles.card} aria-live="polite">
        <h3>{fa ? "پیش‌فاکتور نهایی را بررسی کنید" : "Review your final quote"}</h3>
        <RequestQuoteFacts quote={activeQuote.snapshot} locale={input.locale} />
        <p className={styles.muted}>{fa ? "معتبر تا " : "Valid until "}{requestDate(activeQuote.expires_at, input.locale)} ({fa ? "وقت سیدنی" : "Sydney time"})</p>
        {expired ? <p className={styles.warning}>{fa ? "اعتبار پیش‌فاکتور تمام شده است. پیش‌فاکتور جدید را دریافت و تأیید کنید." : "This quote has expired. Request and accept a new quote to continue."}</p> : <label className={styles.checkbox}>
          <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} disabled={busy} />
          <span>{fa ? "مبالغ، ارزها، اطلاعات گیرنده و شرایط سرویس را بررسی و تأیید می‌کنم. ثبت درخواست به معنی تأیید واریز یا تکمیل حواله نیست." : "I accept the amounts, currencies, recipient details and service terms shown. Submission does not confirm payment or completion of the transfer."}</span>
        </label>}
        <div className={styles.actions}>
          {!expired && <button className={styles.button} type="button" onClick={submit} disabled={busy || !accepted || disabled}>{busy ? (fa ? "در حال ثبت…" : "Submitting…") : (fa ? "تأیید و ثبت درخواست" : "Accept and submit request")}</button>}
          <button className={styles.secondary} type="button" onClick={review} disabled={busy || disabled}>{fa ? "دریافت پیش‌فاکتور جدید" : "Get a fresh quote"}</button>
        </div>
      </div>}
    </>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    <p><Link className={styles.secondary} href={`/${input.locale}/dashboard/requests`}>{fa ? "مشاهده و پیگیری درخواست‌های من" : "View and track my requests"}</Link></p>
  </section>;
}
