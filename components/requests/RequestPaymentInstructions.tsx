"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import type { ExchangeRequest, RequestLocale } from "@/lib/requests/types";
import { getRequestJourney } from "@/lib/requests/journey";
import { DashboardCard, StatusBadge } from "@/components/dashboard/dashboard-ui";
import { DashboardLottieScene } from "@/components/dashboard/DashboardLottieScene";
import { requestMoney } from "./request-labels";
import { RequestBankTiming } from "./RequestBankTiming";
import styles from "@/styles/requests/Requests.module.css";
import compact from "@/styles/requests/RequestPayment.module.css";

export function RequestPaymentInstructions({ request, locale }: { request: ExchangeRequest; locale: RequestLocale }) {
  const fa = locale === "fa";
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState(false);
  const bank = request.payment_details;
  const instructions = fa ? request.payment_instructions_fa || request.payment_instructions : request.payment_instructions;
  const isAustralianFunding = request.quote.funding_currency === "AUD";
  const journey = getRequestJourney(request);
  const fields = [
    { key: "account_name", label: fa ? "نام صاحب حساب" : "Account name", value: bank?.account_name },
    { key: "bank_name", label: fa ? "بانک" : "Bank", value: bank?.bank_name },
    { key: "bsb", label: fa ? "کد شعبه (BSB)" : "BSB", value: bank?.bsb },
    { key: "account_number", label: fa ? "شماره حساب" : "Account number", value: bank?.account_number },
    { key: "iban", label: fa ? "شماره شبا" : "SHABA/IBAN", value: bank?.iban },
    { key: "card_number", label: fa ? "شماره کارت" : "Card number", value: bank?.card_number },
  ].filter((field): field is { key: string; label: string; value: string } => Boolean(field.value?.trim()));

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(""), 2500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy(key: string, value: string) {
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
    } catch {
      setCopied("");
      setCopyError(true);
    }
  }

  function copyButton(key: string, label: string, value: string) {
    return <button type="button" className={compact.copy} data-copied={copied === key} onClick={() => void copy(key, value)} aria-label={fa ? `کپی ${label}` : `Copy ${label}`}>
      {copied === key ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
      {copied === key ? (fa ? "کپی شد" : "Copied") : (fa ? "کپی" : "Copy")}
    </button>;
  }

  if (!journey.approved) return null;
  const archived = journey.receiptSubmitted || journey.fundsReceived || journey.closed || !journey.canPay;
  const content = <>
    {journey.closed && <div className="mb-4 flex items-center gap-3"><DashboardLottieScene name="warning" size={42}/><p className={`${styles.warning} m-0! flex-1`}>{fa ? "درخواست بسته شده؛ وجه جدید واریز نکنید." : "Request closed. Do not send further payment."}</p></div>}
    <div className="flex items-center justify-between gap-3"><dl className={`${compact.amountList} min-w-0 flex-1`}><div className={compact.amount}><dt>{fa ? "مبلغی که باید واریز کنید" : "Amount you need to transfer"}</dt><dd>{requestMoney(request.quote.funding_total, request.quote.funding_currency, locale)}</dd></div></dl>{journey.canPay && !journey.receiptSubmitted && <DashboardLottieScene name="mobile-payment" size={78}/>}</div>
    {!fields.length && !instructions && <div className="mb-4 flex items-center gap-3"><DashboardLottieScene name="warning" size={42}/><p className={`${styles.warning} m-0! flex-1`}>{fa ? "تا نمایش مشخصات حساب در این صفحه، واریز نکنید." : "Wait for bank details here before sending payment."}</p></div>}
    <dl className={compact.bankGrid}>
      {fields.map(field => <div className={`${compact.bankField} ${["account_number", "iban", "card_number"].includes(field.key) ? compact.full : ""}`} key={field.key}>
        <dt>{field.label}</dt><dd><bdi className={["bsb", "account_number", "iban", "card_number"].includes(field.key) ? compact.bankNumber : undefined} dir={["account_name", "bank_name"].includes(field.key) ? "auto" : "ltr"}>{field.value}</bdi>{(isAustralianFunding ? ["account_name", "bsb", "account_number"].includes(field.key) : !["account_name", "bank_name"].includes(field.key)) && copyButton(field.key, field.label, field.value)}</dd>
      </div>)}
      <div className={`${compact.bankField} ${compact.reference} ${compact.full}`}>
        <dt>{isAustralianFunding ? (fa ? "کد تراکنش / شرح واریز" : "Transaction code / transfer reference") : (fa ? "کد تراکنش" : "Transaction code")}</dt>
        <dd><bdi className={compact.bankNumber} dir="ltr">{request.reference_code}</bdi>{isAustralianFunding && copyButton("reference", fa ? "کد تراکنش" : "transaction code", request.reference_code)}</dd>
      </div>
    </dl>
    {journey.canPay && isAustralianFunding && <div className={`${compact.hint} flex items-center gap-3`}><DashboardLottieScene name="alert" size={40}/><p className="m-0 flex-1">{fa ? <>توجه: حتماً کد تراکنش را در هر دو بخش <bdi dir="ltr">Description</bdi> و <bdi dir="ltr">Reference</bdi> انتقال بانکی وارد کنید. ثبت این کد در توضیحات فیش برای شناسایی و پردازش واریز شما ضروری است.</> : <>Important: You must enter the transaction code in both the <strong>Description</strong> and <strong>Reference</strong> fields of your bank transfer. This code is required to identify and process your deposit.</>}</p></div>}
    {journey.canPay && !journey.receiptSubmitted && <p className={compact.receiptPrompt}>{fa ? "پس از واریز، لطفاً رسید بانکی را در بخش زیر ارسال بفرمایید." : "After transferring the funds, please upload your bank receipt below."}</p>}
    <div className={compact.reviewFlow}>
      {instructions && <details className={compact.reviewDisclosure}>
        <summary className={compact.reviewTitle}><span className={compact.reviewTitleContent}><DashboardLottieScene name="announcement" size={40}/>{fa ? "راهنمای واریز" : "Deposit guidelines"}</span><ChevronDown className={compact.reviewChevron} size={18} aria-hidden="true"/></summary>
        <div className={compact.reviewBody}><p className={compact.bankNote} dir="auto">{instructions}</p>{!fields.length && copyButton("instructions", fa ? "مشخصات حساب" : "bank details", instructions)}</div>
      </details>}
      {copyError && <div className="flex items-center gap-3" role="alert"><DashboardLottieScene name="warning" size={38}/><p className={`${styles.warning} m-0! flex-1`}>{fa ? "کپی خودکار انجام نشد. متن را انتخاب و کپی کنید." : "Copy unavailable. Select and copy the text."}</p></div>}
      {journey.canPay && <RequestBankTiming request={request} locale={locale} review australianClearanceMinutes={request.quote.policy_snapshot.australian_clearance_minutes} />}
    </div>
    <span className={styles.srOnly} role="status">{copied ? (fa ? "کپی شد" : "Copied") : ""}</span>
  </>;
  if (archived) return <details className={`${styles.card} ${compact.archive}`} dir={fa ? "rtl" : "ltr"}>
    <summary>{fa ? "مشخصات حساب واریز" : "Payment details"}<ChevronDown size={16} aria-hidden="true" /></summary>
    <div className={compact.archiveBody}>{content}</div>
  </details>;
  return <DashboardCard id="request-payment-details" className={compact.compactCard} dir={fa ? "rtl" : "ltr"} role="region" aria-labelledby="request-payment-title">
    <div className={compact.heading}><div><StatusBadge tone="attention">{fa ? "نیازمند اقدام شما" : "Action Required"}</StatusBadge><h2 id="request-payment-title">{fa ? "واریز وجه" : "Make your payment"}</h2></div></div>
    {content}
  </DashboardCard>;
}
