"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { DashboardButton, StatusBadge } from "@/components/dashboard/dashboard-ui";
import { createRequestQuote, getRequestPolicy, submitExchangeRequest } from "@/app/actions/request.actions";
import type { ExchangeRequest, PublicRequestSettings, QuoteInput, RequestQuote, ServiceTier } from "@/lib/requests/types";
import { getRequestJourney } from "@/lib/requests/journey";
import { RequestQuoteFacts } from "./RequestQuoteFacts";
import { RequestPaymentInstructions } from "./RequestPaymentInstructions";
import { RequestBankTiming } from "./RequestBankTiming";
import { requestDate, requestError, requestMoney } from "./request-labels";



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

  if (saved) return <section className="space-y-6" dir={fa ? "rtl" : "ltr"} aria-live="polite">
    <div className="space-y-4 text-center"><span className="mx-auto grid size-16 place-items-center rounded-full bg-[#ecf9f2] text-[#177549]"><CheckCircle2 size={30} strokeWidth={1.7} aria-hidden="true"/></span><h2 className="m-0! text-2xl! font-semibold text-[#182027]!">{fa ? "درخواست ثبت شد" : "Request submitted"}</h2><p className="m-0 text-sm text-[#626a76]">{fa ? "کد تراکنش" : "Transaction code"}</p><p className="m-0 text-xl font-semibold tracking-tight text-[#182027]"><bdi dir="ltr">{saved.reference_code}</bdi></p></div>
    {!getRequestJourney(saved).approved && <p className="mx-auto max-w-md text-center text-sm leading-6 text-[#626a76]">{fa ? "درخواست شما در انتظار تأیید مدیر است. پس از تأیید، مشخصات حساب برای واریز نمایش داده می‌شود." : "Your request is awaiting approval. Bank details will appear once we approve it."}</p>}
    <RequestPaymentInstructions request={saved} locale={input.locale}/>
    <DashboardButton asChild className="w-full"><Link href={`/${input.locale}/dashboard/requests/${saved.id}`}>{fa ? "مشاهده درخواست" : "View request"}</Link></DashboardButton>
  </section>;

  return <section className="space-y-5" dir={fa ? "rtl" : "ltr"} aria-label={fa ? "سرویس و تأیید درخواست" : "Service and confirmation"}>
    {loadingPolicy && <p className="text-sm text-[#626a76]" role="status">{fa ? "در حال دریافت سرویس‌ها…" : "Loading services…"}</p>}
    {policy && !policy.enabled && <p className="rounded-2xl bg-[#fff6e4] p-4 text-sm text-[#8a5200]">{fa ? "ثبت درخواست جدید فعلاً غیرفعال است." : "New requests are currently paused."}</p>}
    {policy?.enabled && <>
      <fieldset className="m-0 grid min-w-0 grid-cols-1 gap-3 border-0 p-0 sm:grid-cols-2" disabled={busy}>
        <legend className="mb-3 text-sm font-semibold text-[#182027]">{fa ? "انتخاب سرویس" : "Choose your service"}</legend>
        <label className={`relative cursor-pointer rounded-2xl border p-4 transition-colors ${tier === "standard" ? "border-[#635bff] bg-[#f7f6ff]" : "border-[#e2e6ec] bg-white"}`} data-selected={tier === "standard"}>
          <div className="flex items-center justify-between gap-3"><strong className="text-sm font-semibold text-[#182027]">{fa ? "استاندارد" : "Standard"}</strong><input type="radio" name="request-service" value="standard" className="size-4 accent-[#635bff]" checked={tier === "standard"} onChange={() => { setTier("standard"); setAccepted(false); }}/></div>
          <p className="mb-0 mt-3 text-lg font-semibold text-[#182027]">{fa ? "بدون هزینه اضافه" : "No extra fee"}</p><p className="mb-0 mt-2 text-xs leading-5 text-[#626a76]">{fa ? `هدف رسیدگی: ${numbers.format(policy.standard_minutes)} دقیقه کاری` : `Handling target: ${numbers.format(policy.standard_minutes)} business minutes`}</p>
        </label>
        <label className={`relative rounded-2xl border p-4 transition-colors ${!policy.priority_enabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${tier === "priority" ? "border-[#635bff] bg-[#f7f6ff]" : "border-[#e2e6ec] bg-white"}`} data-selected={tier === "priority"} data-disabled={!policy.priority_enabled}>
          <div className="flex items-center justify-between gap-3"><strong className="text-sm font-semibold text-[#182027]">{fa ? "اولویت‌دار" : "Priority"}</strong><input type="radio" name="request-service" value="priority" className="size-4 accent-[#635bff]" checked={tier === "priority"} disabled={!policy.priority_enabled} onChange={() => { setTier("priority"); setAccepted(false); }}/></div>
          <p className="mb-0 mt-3 text-lg font-semibold text-[#182027]">{policy.priority_enabled ? <bdi>+ {requestMoney(policy.priority_fee_aud, "AUD", input.locale)}</bdi> : (fa ? "فعلاً غیرفعال" : "Unavailable")}</p><p className="mb-0 mt-2 text-xs leading-5 text-[#626a76]">{fa ? `هدف رسیدگی: ${numbers.format(policy.priority_minutes)} دقیقه کاری` : `Handling target: ${numbers.format(policy.priority_minutes)} business minutes`}</p>
        </label>
      </fieldset>
      <RequestBankTiming locale={input.locale} fundingCurrency={input.txType === "buy_aud" ? "IRT" : "AUD"} iranBankingNotice={shownPolicy?.iran_banking_notice} iranBankingNoticeFa={shownPolicy?.iran_banking_notice_fa}/>
      {shownPolicy && <details className="rounded-2xl border border-[#e9ecf0] px-4 py-3 text-xs leading-6 text-[#626a76]">
        <summary className="cursor-pointer py-1 font-medium text-[#182027]">{fa ? "ساعات و شرایط سرویس" : "Service hours & terms"}</summary>
        <p>{fa ? "ساعات کاری سیدنی: " : "Sydney hours: "}<bdi dir="ltr">{String(shownPolicy.opening_hour).padStart(2, "0")}:00–{String(shownPolicy.closing_hour).padStart(2, "0")}:00</bdi></p>
        <p>{shownPolicy.business_days.map(day => (fa ? ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"] : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"])[day]).join(fa ? "، " : ", ")}{shownPolicy.holidays.length > 0 && <>{fa ? "؛ تعطیلات: " : "; holidays: "}<bdi dir="ltr">{shownPolicy.holidays.join(", ")}</bdi></>}</p>
        <p>{fa ? "زمان رسیدگی پس از تأیید وجه و بررسی‌ها محاسبه می‌شود. زمان تسویه بانکی جداست." : "Handling begins after funds and checks are confirmed. Bank settlement time is separate."}</p>
        {tier === "priority" && <><p>{fa ? shownPolicy.priority_terms_fa : shownPolicy.priority_terms}</p><p>{fa ? "ظرفیت سرویس اولویت‌دار هنگام تأیید درخواست بررسی می‌شود." : "Priority availability is confirmed when we approve your request."}</p></>}
      </details>}
      {!activeQuote && <DashboardButton className="w-full" type="button" onClick={review} disabled={busy || disabled}>{busy ? (fa ? "در حال محاسبه…" : "Preparing quote…") : (fa ? "بررسی مبلغ نهایی" : "Review total")}</DashboardButton>}
      {activeQuote && <div className="space-y-5 border-t border-[#e9ecf0] pt-5" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="m-0! text-lg! font-semibold text-[#182027]!">{fa ? "پیش‌فاکتور نهایی" : "Final quote"}</h3><StatusBadge>{fa ? "معتبر تا " : "Valid until "}<bdi dir="ltr">{requestDate(activeQuote.expires_at, input.locale)}</bdi> ({fa ? "سیدنی" : "Sydney"})</StatusBadge></div>
        <RequestQuoteFacts quote={activeQuote.snapshot} locale={input.locale}/>
        {expired ? <p className="rounded-2xl bg-[#fff6e4] p-4 text-sm text-[#8a5200]">{fa ? "پیش‌فاکتور منقضی شد. مبلغ را دوباره محاسبه کنید." : "Quote expired. Refresh the quote to continue."}</p> : <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-[#626a76]"><input className="mt-1 size-4 shrink-0 accent-[#635bff]" type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} disabled={busy}/><span>{fa ? "مبالغ، اطلاعات گیرنده و شرایط سرویس را تأیید می‌کنم." : "I accept the amounts, recipient details and service terms."}</span></label>}
        <div className="flex flex-col gap-2 sm:flex-row">{!expired && <DashboardButton className="flex-1" type="button" onClick={submit} disabled={busy || !accepted || disabled}>{busy ? (fa ? "در حال ثبت…" : "Submitting…") : (fa ? "ثبت درخواست" : "Submit request")}</DashboardButton>}<DashboardButton tone="quiet" type="button" onClick={review} disabled={busy || disabled}>{fa ? "محاسبه مجدد" : "Refresh quote"}</DashboardButton></div>
      </div>}
    </>}
    {error && <p className="rounded-2xl bg-[#fff0f2] p-4 text-sm text-[#b4344c]" role="alert">{requestError(error, input.locale)}</p>}
  </section>;
}
