"use client";

import { useState } from "react";
import { Copy, Landmark } from "lucide-react";
import type { ExchangeRequest, RequestLocale } from "@/lib/requests/types";
import { isRequestTerminal, requestDate, requestMoney } from "./request-labels";
import { RequestBankTiming } from "./RequestBankTiming";
import styles from "@/styles/requests/Requests.module.css";

export function RequestPaymentInstructions({ request, locale }: { request: ExchangeRequest; locale: RequestLocale }) {
  const fa = locale === "fa";
  const [copyStatus, setCopyStatus] = useState("");
  async function copyReference() {
    try {
      await navigator.clipboard.writeText(request.reference_code);
      setCopyStatus(fa ? "کد پیگیری کپی شد." : "Reference copied.");
    } catch { setCopyStatus(fa ? "کپی انجام نشد؛ کد نمایش‌داده‌شده را انتخاب و کپی کنید." : "Could not copy automatically. Select and copy the reference shown below."); }
  }
  return <section className={`${styles.card} ${styles.paymentCard}`}>
    <h2><Landmark size={20} aria-hidden="true" /> {fa ? "مشخصات حساب و راهنمای واریز" : "Bank details and payment instructions"}</h2>
    {isRequestTerminal(request.status) && <p className={styles.warning}>{fa ? "این درخواست بسته شده است؛ برای آن وجه جدید واریز نکنید." : "This request is closed. Do not send a new payment for it."}</p>}
    {request.payment_instructions ? <p className={styles.bankDetails}>{request.payment_instructions}</p>
      : <p className={styles.warning}>{fa ? "تیم مالی در حال آماده‌سازی مشخصات حساب این درخواست است. تا نمایش دستورالعمل در این صفحه، واریز نکنید." : "Finance is preparing the bank details for this request. Wait for instructions on this page before sending payment."}</p>}
    <dl className={styles.facts}>
      <div className={`${styles.fact} ${styles.total}`}><dt>{fa ? "مجموع مبلغ واریز" : "Total bank transfer amount"}</dt><dd>{requestMoney(request.quote.funding_total, request.quote.funding_currency, locale)}</dd></div>
      <div className={styles.fact}><dt>{fa ? "کد پیگیری / شرح واریز" : "Reference Code / transfer description"}</dt><dd><bdi className={styles.reference}>{request.reference_code}</bdi></dd></div>
      <div className={styles.fact}><dt>{fa ? "انتقال بانکی را تا این زمان انجام دهید" : "Initiate your bank transfer by"}</dt><dd>{requestDate(request.funding_due_at, locale)}</dd></div>
      {request.clearance_due_at && <div className={styles.fact}><dt>{fa ? "پایان بازه بررسی وصول وجه" : "Bank clearance review after"}</dt><dd>{requestDate(request.clearance_due_at, locale)}</dd></div>}
    </dl>
    <p className={styles.notice}><strong>{fa ? "کد پیگیری را حتماً در قسمت شرح یا توضیحات انتقال بانکی وارد کنید: " : "Put your Reference Code in the description or reference field of your bank transfer: "}<bdi>{request.reference_code}</bdi></strong></p>
    <button type="button" className={styles.secondary} onClick={() => void copyReference()}><Copy size={16} />{fa ? "کپی کد پیگیری" : "Copy Reference Code"}</button>
    {copyStatus && <p className={styles.muted} role="status">{copyStatus}</p>}
    <RequestBankTiming request={request} locale={locale} />
  </section>;
}
