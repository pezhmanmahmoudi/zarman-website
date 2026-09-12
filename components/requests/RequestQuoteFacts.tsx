import type { QuoteSnapshot } from "@/lib/requests/types";
import { requestMoney, type RequestLocale } from "./request-labels";
import styles from "@/styles/requests/Requests.module.css";

export function RequestQuoteFacts({ quote, locale }: { quote: QuoteSnapshot; locale: RequestLocale }) {
  const fa = locale === "fa";
  const recipient = quote.recipient_snapshot;
  const recipientName = quote.institution_name || String(recipient.account_name || recipient.full_name || recipient.label || "—");
  return <dl className={styles.facts}>
    <div className={`${styles.fact} ${styles.total}`}><dt>{fa ? "مجموع پرداخت شما" : "Total you send"}</dt><dd>{requestMoney(quote.funding_total, quote.funding_currency, locale)}</dd></div>
    <div className={styles.fact}><dt>{fa ? "گیرنده دریافت می‌کند" : "Recipient receives"}</dt><dd>{requestMoney(quote.recipient_amount, quote.recipient_currency, locale)}</dd></div>
    <div className={styles.fact}><dt>{fa ? "مبلغ تبدیل با کارمزد پایه" : "Exchange subtotal including base fee"}</dt><dd>{requestMoney(quote.funding_total - quote.priority_fee_amount, quote.funding_currency, locale)}</dd></div>
    <div className={styles.fact}><dt>{fa ? "کارمزد پایه (در محاسبه لحاظ شده)" : "Base fee (included in exchange calculation)"}</dt><dd>{requestMoney(quote.base_fee_aud, "AUD", locale)}</dd></div>
    <div className={styles.fact}><dt>{fa ? "هزینه افزوده اولویت" : "Additional priority fee"}</dt><dd>{requestMoney(quote.priority_fee_amount, quote.funding_currency, locale)}{quote.funding_currency === "IRT" && quote.priority_fee_aud > 0 && <div className={styles.muted}>{requestMoney(quote.priority_fee_aud, "AUD", locale)} × {requestMoney(quote.applied_rate, "IRT", locale)}</div>}</dd></div>
    <div className={styles.fact}><dt>{fa ? "نرخ هر دلار استرالیا" : "Exchange rate per AUD"}</dt><dd>{requestMoney(quote.applied_rate, "IRT", locale)}</dd></div>
    <div className={styles.fact}><dt>{fa ? "گیرنده" : "Recipient"}</dt><dd>{recipientName}</dd></div>
    {quote.invoice_reference && <div className={styles.fact}><dt>{fa ? "شماره صورتحساب" : "Invoice reference"}</dt><dd>{quote.invoice_reference}</dd></div>}
    {recipient.bsb != null && <div className={styles.fact}><dt>BSB</dt><dd><bdi>{String(recipient.bsb)}</bdi></dd></div>}
    {(recipient.account_number || recipient.shaba_number || recipient.irt_account_number) != null && <div className={styles.fact}><dt>{fa ? "حساب مقصد" : "Destination account"}</dt><dd><bdi>{String(recipient.account_number || recipient.shaba_number || recipient.irt_account_number || "—")}</bdi></dd></div>}
    <div className={styles.fact}><dt>{fa ? "سرویس انتخاب‌شده" : "Service selected"}</dt><dd>{quote.service_tier === "priority" ? (fa ? "اولویت‌دار" : "Priority") : (fa ? "استاندارد" : "Standard")}</dd></div>
  </dl>;
}
