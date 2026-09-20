"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Copy, Landmark } from "lucide-react";
import type { ExchangeRequest, RequestLocale } from "@/lib/requests/types";
import { getRequestJourney } from "@/lib/requests/journey";
import { requestDate, requestMoney } from "./request-labels";
import { RequestBankTiming } from "./RequestBankTiming";
import styles from "@/styles/requests/Requests.module.css";
import compact from "@/styles/requests/RequestPayment.module.css";

export function RequestPaymentInstructions({ request, locale }: { request: ExchangeRequest; locale: RequestLocale }) {
  const fa = locale === "fa";
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState(false);
  const bank = request.payment_details;
  const instructions = fa ? request.payment_instructions_fa || request.payment_instructions : request.payment_instructions;
  const journey = getRequestJourney(request);
  const fields = [
    { key: "account_name", label: fa ? "نام صاحب حساب" : "Account name", value: bank?.account_name },
    { key: "bank_name", label: fa ? "بانک" : "Bank", value: bank?.bank_name },
    { key: "bsb", label: fa ? "کد شعبه (BSB)" : "BSB", value: bank?.bsb },
    { key: "account_number", label: fa ? "شماره حساب" : "Account number", value: bank?.account_number },
    { key: "iban", label: fa ? "شماره شبا / IBAN" : "IBAN", value: bank?.iban },
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
    {journey.closed && <p className={styles.warning}>{fa ? "درخواست بسته شده؛ وجه جدید واریز نکنید." : "Request closed. Do not send further payment."}</p>}
    <dl className={compact.amountList}><div className={compact.amount}><dt>{fa ? "مبلغ واریز" : "Transfer amount"}</dt><dd>{requestMoney(request.quote.funding_total, request.quote.funding_currency, locale)}</dd></div></dl>
    {!fields.length && !instructions && <p className={styles.warning}>{fa ? "تا نمایش مشخصات حساب در این صفحه، واریز نکنید." : "Wait for bank details here before sending payment."}</p>}
    <dl className={compact.bankGrid}>
      {fields.map(field => <div className={compact.bankField} key={field.key}>
        <dt>{field.label}</dt><dd><bdi dir={["account_name", "bank_name"].includes(field.key) ? "auto" : "ltr"}>{field.value}</bdi>{copyButton(field.key, field.label, field.value)}</dd>
      </div>)}
      <div className={`${compact.bankField} ${compact.reference} ${compact.full}`}>
        <dt>{fa ? "کد تراکنش / شرح واریز" : "Transaction code / transfer reference"}</dt>
        <dd><bdi dir="ltr">{request.reference_code}</bdi>{copyButton("reference", fa ? "کد تراکنش" : "transaction code", request.reference_code)}</dd>
      </div>
    </dl>
    {journey.canPay && <p className={compact.hint}>{fa ? "کد تراکنش را دقیقاً در قسمت شرح یا توضیحات انتقال بانکی وارد کنید." : "Enter this transaction code in your bank transfer description or reference."}</p>}
    {instructions && (fields.length ? <details className={compact.details}>
      <summary>{fa ? "راهنمای واریز" : "Payment instructions"}</summary>
      <p className={compact.bankNote} dir="auto">{instructions}</p>
    </details> : <div className={compact.details}>
      <p className={compact.bankNote} dir="auto">{instructions}</p>
      {copyButton("instructions", fa ? "مشخصات حساب" : "bank details", instructions)}
    </div>)}
    {journey.canPay && !journey.receiptSubmitted && request.funding_due_at && <p className={compact.deadline}>{fa ? "مهلت واریز: " : "Pay by: "}<bdi dir="ltr">{requestDate(request.funding_due_at, locale)}</bdi> ({fa ? "سیدنی" : "Sydney"})</p>}
    {copyError && <p className={styles.warning} role="alert">{fa ? "کپی خودکار انجام نشد. متن را انتخاب و کپی کنید." : "Copy unavailable. Select and copy the text."}</p>}
    <span className={styles.srOnly} role="status">{copied ? (fa ? "کپی شد" : "Copied") : ""}</span>
    {journey.canPay && <RequestBankTiming request={request} locale={locale} />}
  </>;
  if (archived) return <details className={`${styles.card} ${compact.archive}`} dir={fa ? "rtl" : "ltr"}>
    <summary>{fa ? "مشخصات حساب واریز" : "Payment details"}<ChevronDown size={16} aria-hidden="true" /></summary>
    <div className={compact.archiveBody}>{content}</div>
  </details>;
  return <section id="request-payment-details" className={`${styles.card} ${compact.compactCard}`} dir={fa ? "rtl" : "ltr"}>
    <div className={compact.heading}><h2><Landmark size={18} aria-hidden="true" />{fa ? "واریز وجه" : "Make your payment"}</h2></div>
    {content}
  </section>;
}
