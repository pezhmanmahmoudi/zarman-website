import type { QuoteSnapshot } from "@/lib/requests/types";
import { requestMoney, type RequestLocale } from "./request-labels";
import styles from "@/styles/requests/Requests.module.css";
import compact from "@/styles/requests/RequestPayment.module.css";

export function RequestQuoteFacts({ quote, locale }: { quote: QuoteSnapshot; locale: RequestLocale }) {
  const fa = locale === "fa";
  const recipient = quote.recipient_snapshot;
  const recipientName = quote.institution_name || String(recipient.account_name || recipient.full_name || recipient.label || "—");
  return <>
    <dl className={`${styles.facts} ${compact.quoteFacts}`}>
      <div className={`${styles.fact} ${styles.total}`}><dt>{fa ? "مجموع پرداخت" : "Total to pay"}</dt><dd>{requestMoney(quote.funding_total, quote.funding_currency, locale)}</dd></div>
      <div className={styles.fact}><dt>{fa ? "دریافتی گیرنده" : "Recipient receives"}</dt><dd>{requestMoney(quote.recipient_amount, quote.recipient_currency, locale)}</dd></div>
      <div className={styles.fact}><dt>{fa ? "گیرنده" : "Recipient"}</dt><dd>{recipientName}</dd></div>
      <div className={styles.fact}><dt>{fa ? "سرویس" : "Service"}</dt><dd>{quote.service_tier === "priority" ? (fa ? "اولویت‌دار" : "Priority") : (fa ? "استاندارد" : "Standard")}</dd></div>
      {quote.priority_fee_amount > 0 && <div className={styles.fact}><dt>{fa ? "هزینه اولویت (در مجموع)" : "Priority fee (included)"}</dt><dd>{requestMoney(quote.priority_fee_amount, quote.funding_currency, locale)}</dd></div>}
    </dl>
    <details className={`${compact.details} ${compact.quoteDetails}`}>
      <summary>{fa ? "نرخ، کارمزد و حساب گیرنده" : "Rate, fees & recipient account"}</summary>
      <dl className={`${styles.facts} ${compact.quoteFacts}`}>
        <div className={styles.fact}><dt>{fa ? "نرخ هر دلار استرالیا" : "Rate per AUD"}</dt><dd>{requestMoney(quote.applied_rate, "IRT", locale)}</dd></div>
        <div className={styles.fact}><dt>{fa ? "مبلغ تبدیل با کارمزد پایه" : "Exchange subtotal with base fee"}</dt><dd>{requestMoney(quote.funding_total - quote.priority_fee_amount, quote.funding_currency, locale)}</dd></div>
        <div className={styles.fact}><dt>{fa ? "کارمزد پایه (لحاظ شده)" : "Base fee (included)"}</dt><dd>{requestMoney(quote.base_fee_aud, "AUD", locale)}</dd></div>
        {quote.funding_currency === "IRT" && quote.priority_fee_aud > 0 && <div className={styles.fact}><dt>{fa ? "محاسبه هزینه اولویت" : "Priority fee conversion"}</dt><dd>{requestMoney(quote.priority_fee_aud, "AUD", locale)} × {requestMoney(quote.applied_rate, "IRT", locale)}</dd></div>}
        {quote.invoice_reference && <div className={styles.fact}><dt>{fa ? "شماره صورتحساب" : "Invoice reference"}</dt><dd>{quote.invoice_reference}</dd></div>}
        {recipient.bsb != null && <div className={styles.fact}><dt>{fa ? "کد شعبه (BSB) گیرنده" : "Recipient BSB"}</dt><dd><bdi>{String(recipient.bsb)}</bdi></dd></div>}
        {Boolean(recipient.bank_city) && <div className={styles.fact}><dt>{fa ? "شهر شعبه بانک" : "Bank branch city"}</dt><dd>{String(recipient.bank_city)}</dd></div>}
        {(recipient.account_number || recipient.shaba_number || recipient.irt_account_number) != null && <div className={styles.fact}><dt>{fa ? "حساب گیرنده" : "Recipient account"}</dt><dd><bdi>{String(recipient.account_number || recipient.shaba_number || recipient.irt_account_number || "—")}</bdi></dd></div>}
      </dl>
    </details>
  </>;
}
