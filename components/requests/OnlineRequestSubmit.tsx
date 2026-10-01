"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Clock3, RefreshCw } from "lucide-react";
import { DashboardButton, StatusBadge } from "@/components/dashboard/dashboard-ui";
import { DashboardLottieScene } from "@/components/dashboard/DashboardLottieScene";
import { createRequestQuote, getRequestPolicy, submitExchangeRequest } from "@/app/actions/request.actions";
import type { ExchangeRequest, PublicRequestSettings, QuoteInput, RequestQuote, ServiceTier } from "@/lib/requests/types";
import { getRequestJourney } from "@/lib/requests/journey";
import { RequestQuoteFacts } from "./RequestQuoteFacts";
import { RequestPaymentInstructions } from "./RequestPaymentInstructions";
import { RequestBankTiming } from "./RequestBankTiming";
import { requestDate, requestError, requestMoney } from "./request-labels";
import compact from "@/styles/requests/RequestPayment.module.css";
import type { PaymentAccountAccess } from "@/lib/payments/account-access";



type Props = { input: Omit<QuoteInput, "serviceTier">; paymentAccount?: PaymentAccountAccess; disabled: boolean; validationMessage: string | null; onBusyChange?: (busy: boolean) => void; onSubmitted?: (request: ExchangeRequest) => void };

export function OnlineRequestSubmit({ input, paymentAccount, disabled, validationMessage, onBusyChange, onSubmitted }: Props) {
  const fa = input.locale === "fa";
  const numbers = new Intl.NumberFormat(fa ? "fa-IR" : "en-AU", { maximumFractionDigits: 2 });
  const duration = (minutes: number) => {
    const hours = minutes / 60;
    return fa ? `${numbers.format(hours)} ساعت` : `${numbers.format(hours)} ${hours === 1 ? "hour" : "hours"}`;
  };
  const todayInSydney = () => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const part = (type: string) => parts.find(item => item.type === type)?.value || "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  };
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
  const bankingNotice = (fa ? shownPolicy?.iran_banking_notice_fa : shownPolicy?.iran_banking_notice)?.trim();

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
      const result = await submitExchangeRequest({ quoteId: activeQuote.id, commandKey: commandKey.current, paymentAccount });
      if (result.error) setError(result.error);
      else if (result.data) { setSaved(result.data); onSubmitted?.(result.data); }
    } catch { setError(fa ? "تأیید ثبت دریافت نشد. با همین دکمه دوباره تلاش کنید." : "Submission could not be confirmed. Retry using this button."); }
    finally { submitting.current = false; setBusy(false); }
  }

  if (saved) {
    const approved = getRequestJourney(saved).approved;
    return <section className="mx-auto flex max-w-xl flex-col items-center gap-5 text-center" dir={fa ? "rtl" : "ltr"} aria-live="polite">
      <DashboardLottieScene name="request-submitted" size={128}/>
      <StatusBadge tone={approved ? "success" : "attention"}>{approved ? (fa ? "تأیید شد" : "Approved") : (fa ? "در انتظار تأیید" : "Awaiting approval")}</StatusBadge>
      <div>
        <h2 className="m-0! text-2xl! font-semibold text-[#182027]!">{fa ? "درخواست شما ثبت شد" : "Your request is submitted"}</h2>
        {!approved && <p className="mb-0 mt-3 text-sm leading-7 text-[#626a76]">{fa ? "پس از تأیید زرمان، مشخصات حساب برای واریز در داشبورد شما نمایش داده می‌شود." : "Once Zarman approves it, the bank details for your payment will appear in your dashboard."}</p>}
      </div>
      <dl className="m-0 grid w-full grid-cols-1 gap-3 rounded-2xl border border-[#e4ddef] bg-[#f7f3fc] p-4 text-sm sm:grid-cols-3 sm:p-5">
        <div><dt className="text-xs text-[#756782]">{fa ? "کد تراکنش" : "Transaction code"}</dt><dd className="m-0 mt-1 font-semibold text-[#302346]"><bdi dir="ltr" style={{ fontFamily: "var(--font-en-stack)" }}>{saved.reference_code}</bdi></dd></div>
        <div className="border-t border-[#e4ddef] pt-3 sm:border-t-0 sm:border-s sm:pt-0"><dt className="text-xs text-[#756782]">{fa ? "مبلغ پرداخت" : "You pay"}</dt><dd className="m-0 mt-1 font-semibold text-[#302346]" data-private-value><bdi>{requestMoney(saved.quote.funding_total, saved.quote.funding_currency, input.locale)}</bdi></dd></div>
        <div className="border-t border-[#e4ddef] pt-3 sm:border-t-0 sm:border-s sm:pt-0"><dt className="text-xs text-[#756782]">{fa ? "دریافتی گیرنده" : "Recipient gets"}</dt><dd className="m-0 mt-1 font-semibold text-[#302346]" data-private-value><bdi>{requestMoney(saved.quote.recipient_amount, saved.quote.recipient_currency, input.locale)}</bdi></dd></div>
      </dl>
      <div className="w-full text-start"><RequestPaymentInstructions request={saved} locale={input.locale}/></div>
      <DashboardButton asChild className="w-full sm:w-auto sm:min-w-60"><Link href={`/${input.locale}/dashboard/requests/${saved.id}`}>{fa ? "مشاهده درخواست" : "View request"}</Link></DashboardButton>
    </section>;
  }

  return <section className={compact.reviewFlow} dir={fa ? "rtl" : "ltr"} aria-label={fa ? "سرویس و تأیید درخواست" : "Service and confirmation"}>
    {loadingPolicy && <p className="text-sm text-[#626a76]" role="status">{fa ? "در حال دریافت سرویس‌ها…" : "Loading services…"}</p>}
    {policy && !policy.enabled && <p className="rounded-2xl bg-[#fff6e4] p-4 text-sm text-[#8a5200]">{fa ? "ثبت درخواست جدید فعلاً غیرفعال است." : "New requests are currently paused."}</p>}
    {policy?.enabled && <>
      <fieldset className="m-0 grid min-w-0 grid-cols-1 gap-3 border-0 p-0 sm:grid-cols-2" disabled={busy}>
        <legend className="mb-3 text-sm font-semibold text-[#182027]">{fa ? "انتخاب نوع سرویس" : "Select Service Type"}</legend>
        <label className={`relative cursor-pointer rounded-2xl border p-4 transition-colors ${tier === "standard" ? "border-[#8970b6] bg-[#f5f1fb] shadow-[0_0_0_2px_#7667bd14]" : "border-[#e2e6ec] bg-white"}`} data-selected={tier === "standard"}>
          <div className="flex items-center justify-between gap-3"><strong className="text-sm font-semibold text-[#182027]">{fa ? "استاندارد" : "Standard"}</strong><input type="radio" name="request-service" value="standard" className="size-4 accent-[#635bff]" checked={tier === "standard"} onChange={() => { setTier("standard"); setAccepted(false); }}/></div>
          <p className="mb-0 mt-3 text-lg font-semibold text-[#182027]">{fa ? "بدون هزینه اضافه" : "No Extra Charge"}</p><p className="mb-0 mt-2 text-xs leading-5 text-[#626a76]">{fa ? `زمان تقریبی پردازش: ${duration(policy.standard_minutes)}` : `Est. Processing Time: ${duration(policy.standard_minutes)}`}</p>
        </label>
        <label className={`relative rounded-2xl border p-4 transition-colors ${!policy.priority_enabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${tier === "priority" ? "border-[#8970b6] bg-[#f5f1fb] shadow-[0_0_0_2px_#7667bd14]" : "border-[#e2e6ec] bg-white"}`} data-selected={tier === "priority"} data-disabled={!policy.priority_enabled}>
          <div className="flex items-center justify-between gap-3"><strong className="text-sm font-semibold text-[#182027]">{fa ? "فوری (اولویت‌دار)" : "Priority (Express)"}</strong><input type="radio" name="request-service" value="priority" className="size-4 accent-[#635bff]" checked={tier === "priority"} disabled={!policy.priority_enabled} onChange={() => { setTier("priority"); setAccepted(false); }}/></div>
          <p className="mb-0 mt-3 text-lg font-semibold text-[#182027]">{policy.priority_enabled ? <bdi>+ {requestMoney(policy.priority_fee_aud, "AUD", input.locale)}</bdi> : (fa ? "در حال حاضر غیرفعال" : "Currently Unavailable")}</p><p className="mb-0 mt-2 text-xs leading-5 text-[#626a76]">{fa ? `زمان تقریبی پردازش: ${duration(policy.priority_minutes)}` : `Est. Processing Time: ${duration(policy.priority_minutes)}`}</p>
        </label>
      </fieldset>
      <RequestBankTiming review locale={input.locale} fundingCurrency={input.txType === "buy_aud" ? "IRT" : "AUD"} australianClearanceMinutes={shownPolicy?.australian_clearance_minutes}/>
      {shownPolicy && <details className={compact.reviewDisclosure}>
        <summary className={compact.reviewTitle}><span className={compact.reviewTitleContent}><DashboardLottieScene name="announcement" size={40}/><span>{fa ? "ساعات کاری سرویس" : "Service Business Hours"}</span></span><ChevronDown className={compact.reviewChevron} size={18} aria-hidden="true"/></summary>
        <div className={compact.reviewBody}>
        <ul className={compact.timingList}>
          <li><strong>{fa ? "ساعات کاری (به وقت سیدنی): " : "Business Hours (Sydney Time): "}</strong><bdi dir="ltr">{String(shownPolicy.opening_hour).padStart(2, "0")}:00–{String(shownPolicy.closing_hour).padStart(2, "0")}:00</bdi></li>
          <li><strong>{fa ? "روزهای کاری: " : "Working Days: "}</strong>{shownPolicy.business_days.map(day => (fa ? ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"] : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"])[day]).join(fa ? "، " : ", ")}</li>
          <li><strong>{fa ? "تعطیلات پیش‌رو: " : "Upcoming Holidays: "}</strong>{shownPolicy.holidays.filter(day => day >= todayInSydney()).length ? <bdi dir="ltr">{shownPolicy.holidays.filter(day => day >= todayInSydney()).join(", ")}</bdi> : (fa ? "موردی ثبت نشده است" : "None listed")}</li>
          <li>{fa ? "نکته: زمان تسویهٔ بانکی جدا از زمان پردازش پلتفرم محاسبه می‌شود." : "Note: Bank settlement times are calculated independently from platform processing times."}</li>
          {bankingNotice && <li className="whitespace-pre-line break-words">{bankingNotice}</li>}
          {tier === "priority" && <li>{fa ? shownPolicy.priority_terms_fa : shownPolicy.priority_terms}</li>}
        </ul>
        </div>
      </details>}
      {!activeQuote && <DashboardButton className="w-full" type="button" onClick={review} disabled={busy || disabled}>{busy ? (fa ? "در حال محاسبه…" : "Preparing quote…") : (fa ? "مشاهده فاکتور نهایی" : "Review Final Summary")}</DashboardButton>}
      {activeQuote && <div className={compact.invoiceReview} aria-live="polite">
        <section className={compact.invoice} aria-label={fa ? "پیش‌فاکتور نهایی" : "Final quote"}>
          <header className={compact.invoiceHeader}>
            <div><h3>{fa ? "پیش‌فاکتور نهایی" : "Final quote"}</h3></div>
            <DashboardLottieScene key={activeQuote.id} name="receipt-upload" size={80}/>
          </header>
          <div className={compact.invoiceValidity} data-expired={expired || undefined}>
            <span><Clock3 size={15} aria-hidden="true"/><strong>{expired ? (fa ? "منقضی شده" : "Expired") : (fa ? `اعتبار پیش‌فاکتور: ${duration(activeQuote.snapshot.policy_snapshot.quote_minutes)}` : `Valid for ${duration(activeQuote.snapshot.policy_snapshot.quote_minutes)}`)}</strong></span>
            <span>{fa ? "معتبر تا " : "Valid until "}<time dateTime={activeQuote.expires_at}><bdi dir="ltr">{requestDate(activeQuote.expires_at, input.locale)}</bdi></time> ({fa ? "سیدنی" : "Sydney"})</span>
          </div>
          <RequestQuoteFacts quote={activeQuote.snapshot} locale={input.locale} receipt/>
        </section>
        {expired ? <p className="m-0 rounded-2xl bg-[#fff6e4] p-4 text-sm text-[#8a5200]">{fa ? "پیش‌فاکتور منقضی شد. مبلغ را دوباره محاسبه کنید." : "Quote expired. Refresh the quote to continue."}</p> : <label className={compact.invoiceAcceptance}><input className="mt-1 size-4 shrink-0 accent-[#635bff]" type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} disabled={busy}/><span>{fa ? "مبالغ، اطلاعات گیرنده و شرایط سرویس را تأیید می‌کنم." : "I accept the amounts, recipient details and service terms."}</span></label>}
        <div className={compact.invoiceActions}>{!expired && <DashboardButton type="button" onClick={submit} disabled={busy || !accepted || disabled}>{busy ? (fa ? "در حال ثبت…" : "Submitting…") : (fa ? "ثبت درخواست" : "Submit request")}</DashboardButton>}<DashboardButton tone="secondary" className={compact.invoiceRefresh} type="button" onClick={review} disabled={busy || disabled}><RefreshCw size={16} aria-hidden="true"/>{fa ? "محاسبهٔ مجدد" : "Recalculate quote"}</DashboardButton></div>
      </div>}
    </>}
    {error && <p className="rounded-2xl bg-[#fff0f2] p-4 text-sm text-[#b4344c]" role="alert">{requestError(error, input.locale)}</p>}
  </section>;
}
