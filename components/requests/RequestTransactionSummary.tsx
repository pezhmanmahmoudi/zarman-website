import { ChevronDown, ReceiptText, UserRound } from "lucide-react";
import type { ExchangeRequest, RequestLocale } from "@/lib/requests/types";
import { DashboardLottieScene } from "@/components/dashboard/DashboardLottieScene";
import { QuoteAmount } from "./RequestQuoteFacts";
import { quoteExchangeRates } from "@/lib/requests/rates";
import { RequestExchangeRates } from "./RequestExchangeRates";
import styles from "@/styles/requests/RequestCustomerDetail.module.css";
import invoice from "@/styles/requests/RequestPayment.module.css";

/** Read the accepted quote, never recalculate it using current rates. */
export function RequestTransactionSummary({ request, locale }: { request: ExchangeRequest; locale: RequestLocale }) {
  const fa = locale === "fa", quote = request.quote, recipient = quote.recipient_snapshot;
  const name = quote.institution_name || String(recipient.account_name || recipient.full_name || recipient.label || "—");
  const account = recipient.account_number || recipient.shaba_number || recipient.irt_account_number;
  const money = (amount: number, currency: string) => <QuoteAmount amount={amount} currency={currency} locale={locale}/>;
  return <section id="request-transfer-details" className={`${invoice.invoice} ${styles.summary}`} dir={fa ? "rtl" : "ltr"} aria-labelledby="transaction-summary-title">
    <header className={styles.summaryHeading}><h2 id="transaction-summary-title">{fa ? "خلاصه تراکنش" : "Transfer Summary"}</h2><DashboardLottieScene name="receipt-upload" size={64}/></header>
    <div className={styles.total}><span>{fa ? "مجموع پرداخت" : "Total to pay"}</span><strong className={invoice.invoiceTotal} data-private-value>{money(quote.funding_total, quote.funding_currency)}</strong></div>
    <details className={styles.accordion} open>
      <summary><span><ReceiptText size={18} aria-hidden="true"/>{fa ? "جزئیات رسید" : "Receipt details"}</span><ChevronDown size={17} aria-hidden="true"/></summary>
      <div className={styles.accordionBody}><dl className={styles.facts}>
        <div><dt>{fa ? "دریافتی گیرنده" : "Recipient receives"}</dt><dd data-private-value>{money(quote.recipient_amount, quote.recipient_currency)}</dd></div>
        <div><dt>{fa ? "نوع سرویس" : "Service type"}</dt><dd>{quote.service_tier === "priority" ? (fa ? "فوری (اولویت‌دار)" : "Priority (Express)") : (fa ? "استاندارد" : "Standard")}</dd></div>
        <RequestExchangeRates rates={quoteExchangeRates(quote)} locale={locale}/>
        <div><dt>{fa ? "کارمزد پایه (لحاظ‌شده)" : "Base fee (included)"}</dt><dd>{money(quote.base_fee_aud, "AUD")}</dd></div>
        {quote.priority_fee_amount > 0 && <div><dt>{fa ? "هزینه پردازش اکسپرس (لحاظ‌شده)" : "Express processing fee (included)"}</dt><dd>{money(quote.priority_fee_amount, quote.funding_currency)}</dd></div>}
        <div><dt>{fa ? "تخفیف وفاداری" : "Loyalty savings"}</dt><dd>{money(Number(quote.loyalty_discount || 0), "IRT")}</dd></div>
        {quote.promo_code && <div><dt>{fa ? "تخفیف با کد" : "Promo code savings"} <bdi dir="ltr">{quote.promo_code}</bdi></dt><dd>{money(Number(quote.discount_amount || 0), "IRT")}</dd></div>}
      </dl></div>
    </details>
    <details className={styles.accordion}>
      <summary><span><UserRound size={18} aria-hidden="true"/>{fa ? "اطلاعات گیرنده" : "Recipient details"}</span><ChevronDown size={17} aria-hidden="true"/></summary>
      <div className={styles.accordionBody}><dl className={styles.facts}>
        <div><dt>{fa ? "نام" : "Name"}</dt><dd data-private-value><bdi dir="auto">{name}</bdi></dd></div>
        {Boolean(recipient.bank_name) && <div><dt>{fa ? "بانک" : "Bank"}</dt><dd><bdi dir="auto">{String(recipient.bank_name)}</bdi></dd></div>}
        {Boolean(recipient.bank_city) && <div><dt>{fa ? "شهر شعبه" : "Branch city"}</dt><dd><bdi dir="auto">{String(recipient.bank_city)}</bdi></dd></div>}
        {Boolean(recipient.bsb) && <div><dt><bdi lang="en" dir="ltr">BSB</bdi></dt><dd data-private-value><bdi lang="en" dir="ltr" data-number-locale="en">{String(recipient.bsb)}</bdi></dd></div>}
        {Boolean(account) && <div><dt><bdi lang="en" dir="ltr">Account number</bdi></dt><dd data-private-value><bdi lang="en" dir="ltr" data-number-locale="en">{String(account)}</bdi></dd></div>}
      </dl>{quote.payment_link && <a className={styles.paymentLink} href={quote.payment_link} target="_blank" rel="noopener noreferrer">{fa ? "لینک پرداخت" : "Payment link"}</a>}</div>
    </details>
  </section>;
}
