"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Landmark } from "lucide-react";
import type { ExchangeRequest, RequestLocale } from "@/lib/requests/types";
import { isRequestTerminal, requestDate, requestMoney } from "./request-labels";
import { RequestBankTiming } from "./RequestBankTiming";
import styles from "@/styles/requests/Requests.module.css";
import compact from "@/styles/requests/RequestPayment.module.css";

export function RequestPaymentInstructions({ request, locale }: { request: ExchangeRequest; locale: RequestLocale }) {
  const fa = locale === "fa";
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState(false);
  const bank = request.payment_details;
  const instructions = fa ? request.payment_instructions_fa || request.payment_instructions : request.payment_instructions;
  const closed = isRequestTerminal(request.status);
  const funded = request.funding_status === "confirmed";
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
    return <button type="button" className={compact.copy} onClick={() => void copy(key, value)} aria-label={fa ? `کپی ${label}` : `Copy ${label}`}>
      {copied === key ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
      {copied === key ? (fa ? "کپی شد" : "Copied") : (fa ? "کپی" : "Copy")}
    </button>;
  }

  return <section className={`${styles.card} ${compact.compactCard}`} dir={fa ? "rtl" : "ltr"}>
    <div className={compact.heading}><h2><Landmark size={19} aria-hidden="true" />{fa ? "اطلاعات واریز" : "Payment details"}</h2>{funded && <span className={`${styles.badge} ${styles.success}`}>{fa ? "وجه تأیید شد" : "Funds confirmed"}</span>}</div>
    {closed && <p className={styles.warning}>{fa ? "درخواست بسته شده؛ وجه جدید واریز نکنید." : "Request closed. Do not send further payment."}</p>}
    <dl><div className={compact.amount}><dt>{fa ? "مبلغ واریز" : "Transfer amount"}</dt><dd>{requestMoney(request.quote.funding_total, request.quote.funding_currency, locale)}</dd></div></dl>
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
    {!closed && !funded && <p className={compact.hint}>{fa ? "کد تراکنش را در شرح انتقال بانکی وارد کنید." : "Use this transaction code as your bank transfer reference."}</p>}
    {instructions && (fields.length ? <details className={compact.details}>
      <summary>{fa ? "راهنمای واریز" : "Payment instructions"}</summary>
      <p className={compact.bankNote} dir="auto">{instructions}</p>
    </details> : <div className={compact.details}>
      <p className={compact.bankNote} dir="auto">{instructions}</p>
      {copyButton("instructions", fa ? "مشخصات حساب" : "bank details", instructions)}
    </div>)}
    {!closed && !funded && <p className={compact.deadline}>{request.evidence_submitted_at && request.clearance_due_at
      ? <>{fa ? "بررسی وصول وجه پس از: " : "Bank review after: "}{requestDate(request.clearance_due_at, locale)}</>
      : <>{fa ? "مهلت انتقال وجه: " : "Send payment by: "}{requestDate(request.funding_due_at, locale)}</>} ({fa ? "سیدنی" : "Sydney"})</p>}
    {copyError && <p className={styles.warning} role="alert">{fa ? "کپی خودکار انجام نشد. متن را انتخاب و کپی کنید." : "Copy unavailable. Select and copy the text."}</p>}
    <span className={styles.srOnly} role="status">{copied ? (fa ? "کپی شد" : "Copied") : ""}</span>
    {!closed && <RequestBankTiming request={request} locale={locale} />}
  </section>;
}
