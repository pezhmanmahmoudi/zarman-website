import type { QuoteSnapshot } from "@/lib/requests/types";
import { ChevronDown } from "lucide-react";
import type { RequestLocale } from "./request-labels";
import { requestRate } from "./request-labels";
import styles from "@/styles/requests/Requests.module.css";
import compact from "@/styles/requests/RequestPayment.module.css";

export function QuoteAmount({ amount, currency, locale }: { amount: number; currency: string; locale: RequestLocale }) {
  const fa = locale === "fa";
  const number = new Intl.NumberFormat(fa ? "fa-IR" : "en-AU", { maximumFractionDigits: currency === "AUD" ? 2 : 0 }).format(amount || 0);
  const unit = currency === "AUD" ? (fa ? "دلار استرالیا" : "AUD") : currency === "IRT" ? (fa ? "تومان" : amount === 1 ? "Toman" : "Tomans") : currency;
  return <span className={compact.invoiceAmount} lang={locale} dir={fa ? "rtl" : "ltr"}><bdi className={compact.invoiceNumber} data-number-locale={locale} dir="ltr">{number}</bdi>{" "}<bdi className={compact.invoiceCurrency} dir={fa ? "rtl" : "ltr"}>{unit}</bdi></span>;
}

export function RequestQuoteFacts({ quote, locale, receipt = false }: { quote: QuoteSnapshot; locale: RequestLocale; receipt?: boolean }) {
  const fa = locale === "fa";
  const recipient = quote.recipient_snapshot;
  const recipientName = quote.institution_name || String(recipient.account_name || recipient.full_name || recipient.label || "—");
  const row = receipt ? compact.invoiceRow : styles.fact;
  const loyalty = Number(quote.loyalty_discount || 0);
  const promo = Number(quote.discount_amount || 0);
  return <>
    <dl className={receipt ? compact.invoiceMeta : `${styles.facts} ${compact.quoteFacts}`}>
      <div className={receipt ? undefined : row}><dt>{fa ? "گیرنده" : "Recipient"}</dt><dd><bdi dir="auto">{recipientName}</bdi></dd></div>
      <div className={receipt ? undefined : row}><dt>{fa ? "نوع سرویس" : "Service type"}</dt><dd>{quote.service_tier === "priority" ? (fa ? "فوری (اولویت‌دار)" : "Priority (Express)") : (fa ? "استاندارد" : "Standard")}</dd></div>
    </dl>
    <dl className={receipt ? compact.invoiceFacts : `${styles.facts} ${compact.quoteFacts}`}>
      <div className={row}><dt>{fa ? "دریافتی گیرنده" : "Recipient receives"}</dt><dd><QuoteAmount amount={quote.recipient_amount} currency={quote.recipient_currency} locale={locale}/></dd></div>
      {receipt && <div className={row}><dt>{fa ? "کارمزد انتقال (لحاظ‌شده)" : "Transfer fee (included)"}</dt><dd><QuoteAmount amount={quote.base_fee_aud} currency="AUD" locale={locale}/></dd></div>}
      {quote.priority_fee_amount > 0 && <div className={row}><dt>{fa ? "هزینه پردازش اکسپرس (لحاظ‌شده)" : "Express processing fee (included)"}</dt><dd><QuoteAmount amount={quote.priority_fee_amount} currency={quote.funding_currency} locale={locale}/></dd></div>}
      <div className={row} data-benefit={loyalty > 0 || undefined}><dt>{quote.admin_adjusted ? (fa ? "تخفیف وفاداری پیش‌فاکتور اولیه" : "Original quote loyalty savings") : (fa ? "تخفیف وفاداری این انتقال" : "Loyalty savings on this transfer")}{loyalty > 0 && !quote.admin_adjusted && <span className={compact.invoiceSubLabel}>{fa ? "لحاظ‌شده در نرخ تبدیل" : "Included in your exchange rate"}</span>}</dt><dd><QuoteAmount amount={loyalty} currency="IRT" locale={locale}/></dd></div>
      {quote.promo_code && <div className={row} data-benefit={promo > 0 || undefined}><dt>{quote.admin_adjusted ? (fa ? "کد تخفیف پیش‌فاکتور اولیه" : "Original quote promo savings") : (fa ? "تخفیف با کد" : "Promo code savings")} <bdi dir="ltr" className={compact.invoicePromoCode}>{quote.promo_code}</bdi>{promo > 0 && !quote.admin_adjusted && <span className={compact.invoiceSubLabel}>{fa ? "لحاظ‌شده در نرخ تبدیل" : "Included in your exchange rate"}</span>}</dt><dd><QuoteAmount amount={promo} currency="IRT" locale={locale}/></dd></div>}
      <div className={receipt ? `${row} ${compact.invoiceTotal}` : `${row} ${styles.total}`}><dt>{fa ? "مجموع پرداخت" : "Total to pay"}</dt><dd><QuoteAmount amount={quote.funding_total} currency={quote.funding_currency} locale={locale}/></dd></div>
    </dl>
    <details className={`${compact.details} ${compact.quoteDetails}${receipt ? ` ${compact.invoiceDetails}` : ""}`}>
      <summary>{fa ? "نرخ، کارمزد و حساب گیرنده" : "Rate, fees & recipient account"}{receipt && <ChevronDown size={16} aria-hidden="true"/>}</summary>
      <dl className={`${styles.facts} ${compact.quoteFacts}`}>
        {quote.locked_amount_currency && <div className={styles.fact}><dt>{fa ? "مبلغ ثابت انتخاب‌شده" : "Your fixed amount"}</dt><dd><QuoteAmount amount={quote.locked_amount_value ?? 0} currency={quote.locked_amount_currency} locale={locale}/></dd></div>}
        <div className={styles.fact}><dt>{fa ? "نرخ هر دلار استرالیا" : "Rate per AUD"}</dt><dd><bdi>{requestRate(quote.applied_rate, locale)}</bdi></dd></div>
        {!!quote.rounding_adjustment_toman && <div className={styles.fact}><dt>{fa ? "تعدیل گردکردن به سنت" : "Currency rounding adjustment"}</dt><dd><QuoteAmount amount={quote.rounding_adjustment_toman} currency="IRT" locale={locale}/></dd></div>}
        <div className={styles.fact}><dt>{fa ? "مبلغ انتقال با کارمزد پایه" : "Transfer subtotal (base fee included)"}</dt><dd><QuoteAmount amount={quote.funding_total - quote.priority_fee_amount} currency={quote.funding_currency} locale={locale}/></dd></div>
        <div className={styles.fact}><dt>{fa ? "کارمزد پایه (لحاظ‌شده)" : "Base fee (included)"}</dt><dd><QuoteAmount amount={quote.base_fee_aud} currency="AUD" locale={locale}/></dd></div>
        {quote.funding_currency === "IRT" && quote.priority_fee_aud > 0 && <div className={styles.fact}><dt>{fa ? "محاسبهٔ هزینه پردازش اکسپرس" : "Express processing fee conversion"}</dt><dd><QuoteAmount amount={quote.priority_fee_aud} currency="AUD" locale={locale}/> × <QuoteAmount amount={quote.applied_rate} currency="IRT" locale={locale}/></dd></div>}
        {quote.invoice_reference && <div className={styles.fact}><dt>{fa ? "شماره صورتحساب" : "Invoice reference"}</dt><dd>{quote.invoice_reference}</dd></div>}
        {recipient.bsb != null && <div className={styles.fact}><dt><bdi lang="en" dir="ltr">BSB</bdi></dt><dd><bdi lang="en" dir="ltr" data-number-locale="en">{String(recipient.bsb)}</bdi></dd></div>}
        <div className={styles.fact}><dt>{fa ? "نام گیرنده" : "Recipient name"}</dt><dd><bdi dir="auto" data-private-value>{recipientName}</bdi></dd></div>
        {Boolean(recipient.bank_name) && <div className={styles.fact}><dt>{fa ? "نام بانک" : "Bank name"}</dt><dd><bdi dir="auto">{String(recipient.bank_name)}</bdi></dd></div>}
      </dl>
    </details>
  </>;
}
