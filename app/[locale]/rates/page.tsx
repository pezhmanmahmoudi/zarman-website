import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import ContentNavigation from "@/components/layout/ContentNavigation";
import MarketProviders from "@/components/providers/MarketProviders";
import RateSection from "@/components/sections/RateSection/RateSection";
import articleStyles from "@/styles/BlogArticle.module.css";
import styles from "@/styles/RatesPage.module.css";
import { getRatesSnapshot } from "@/lib/rates";
import { getFinanceConfig } from "@/lib/finance-config";
import { calculateQuoteMoney } from "@/lib/requests/quote-money";
import { formatLocalizedNumber } from "@/lib/numbers";
import type { FinanceConfig } from "@/lib/pricing";
import { SITE_URL, getPageMetadata, organizationId, serializeJsonLd } from "@/lib/seo";

export const revalidate = 300;

export function generateStaticParams() {
  return [{ locale: "fa" }, { locale: "en" }];
}

const AUD_AMOUNTS = [100, 200, 500, 1000, 2000, 5000, 10000];
const TOMAN_AMOUNTS = [10_000_000, 50_000_000, 100_000_000, 200_000_000, 500_000_000];

function pageCopy(locale: string) {
  return locale === "en"
    ? {
        title: "AUD to Toman Today: Australian Dollar Rate",
        description: "Today's Australian dollar to Iranian toman rate for transfers in both directions, with ready-made amounts, a calculator and the rate history chart.",
      }
    : {
        title: "قیمت دلار استرالیا به تومان امروز",
        description: "نرخ امروز دلار استرالیا به تومان برای حواله از استرالیا به ایران و از ایران به استرالیا، با جدول مبلغ‌های آماده، ماشین‌حساب و نمودار تغییرات نرخ.",
      };
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (locale !== "fa" && locale !== "en") notFound();
  return getPageMetadata({ locale, path: "/rates", ...pageCopy(locale) });
}

function audToToman(amount: number, rate: number, config: FinanceConfig) {
  try {
    const quote = calculateQuoteMoney({ amount, currency: "AUD", rate, txType: "sell_aud", config });
    return { toman: quote.recipientAmount, feeAud: quote.baseFeeAud };
  } catch {
    return null;
  }
}

function tomanToAud(amount: number, rate: number, config: FinanceConfig) {
  try {
    const quote = calculateQuoteMoney({ amount, currency: "IRT", rate, txType: "buy_aud", config });
    return { aud: quote.recipientAmount, feeAud: quote.baseFeeAud };
  } catch {
    return null;
  }
}

export default async function RatesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== "fa" && locale !== "en") notFound();
  const isEn = locale === "en";
  const ActionIcon = isEn ? ArrowRight : ArrowLeft;
  const copy = pageCopy(locale);
  const [snapshot, financeConfig] = await Promise.all([getRatesSnapshot(), getFinanceConfig()]);
  const { buyAUD, sellAUD, lastUpdated } = snapshot.currentRates;

  const num = (value: number, digits = 0) => formatLocalizedNumber(value, locale, { maximumFractionDigits: digits });
  const updatedText = lastUpdated
    ? new Date(lastUpdated).toLocaleString(isEn ? "en-AU" : "fa-IR", {
        timeZone: "Australia/Sydney",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;
  const threshold = num(financeConfig.fee_threshold, 2);
  const fee = num(financeConfig.applied_fee, 2);

  const faqs = isEn
    ? [
        {
          q: "How many toman is one Australian dollar today?",
          a: buyAUD
            ? `For a transfer from Australia to Iran, 1 Australian dollar is ${num(buyAUD)} toman at the latest published rate. For a transfer from Iran to Australia, 1 Australian dollar costs ${sellAUD ? num(sellAUD) : "—"} toman.`
            : "The rate is temporarily unavailable. Please contact support for a quote.",
        },
        {
          q: "Why are there two different rates?",
          a: "One rate applies when you send Australian dollars to Iran and the other when you pay toman to receive Australian dollars. The difference between them covers currency exchange and settlement on both sides.",
        },
        {
          q: "How long is a rate valid?",
          a: "Published rates can change during the day. Once you submit a request, its rate and request stay valid for two hours. You see the final rate and amount before you confirm.",
        },
        {
          q: "Is there a transfer fee?",
          a: `Transfers of AUD ${threshold} or more have no transfer fee. Smaller transfers have a flat fee of AUD ${fee}, which the calculator and tables on this page already include.`,
        },
      ]
    : [
        {
          q: "هر دلار استرالیا امروز چند تومان است؟",
          a: buyAUD
            ? `برای حواله از استرالیا به ایران، طبق آخرین نرخ منتشرشده هر دلار استرالیا ${num(buyAUD)} تومان است. برای حواله از ایران به استرالیا، هر دلار استرالیا ${sellAUD ? num(sellAUD) : "—"} تومان محاسبه می‌شود.`
            : "نرخ موقتاً در دسترس نیست. برای دریافت نرخ با پشتیبانی تماس بگیرید.",
        },
        {
          q: "چرا دو نرخ متفاوت وجود دارد؟",
          a: "یک نرخ برای وقتی است که دلار استرالیا را به ایران می‌فرستید و دیگری برای وقتی که تومان می‌دهید و دلار استرالیا دریافت می‌کنید. فاصلهٔ این دو نرخ هزینهٔ تبدیل ارز و تسویه در دو طرف را پوشش می‌دهد.",
        },
        {
          q: "نرخ چقدر اعتبار دارد؟",
          a: "نرخ منتشرشده ممکن است در طول روز تغییر کند. بعد از ثبت درخواست، نرخ و درخواست شما ۲ ساعت اعتبار دارند و نرخ و مبلغ نهایی را قبل از تأیید می‌بینید.",
        },
        {
          q: "کارمزد حواله چقدر است؟",
          a: `برای حواله‌های ${threshold} دلار استرالیا و بیشتر هزینهٔ پرداخت صفر است. برای مبلغ‌های کمتر ${fee} دلار گرفته می‌شود که در ماشین‌حساب و جدول‌های این صفحه حساب شده است.`,
        },
      ];

  const pageUrl = `${SITE_URL}/${locale}/rates`;
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#webpage`,
        url: pageUrl,
        name: copy.title,
        description: copy.description,
        inLanguage: isEn ? "en-AU" : "fa",
        about: { "@id": organizationId },
        publisher: { "@id": organizationId },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: isEn ? "Home" : "خانه", item: `${SITE_URL}/${locale}` },
          { "@type": "ListItem", position: 2, name: copy.title, item: pageUrl },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${pageUrl}#faq`,
        inLanguage: isEn ? "en-AU" : "fa",
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.q,
          acceptedAnswer: { "@type": "Answer", text: faq.a },
        })),
      },
    ],
  };

  return (
    <MarketProviders initialData={snapshot} initialFinanceConfig={financeConfig} withSmoothScroll={false}>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
      />
      <div className={articleStyles.pageWrapper}>
        <div className={articleStyles.backgroundGrid} aria-hidden="true" />
        <div className={articleStyles.shell}>
          <ContentNavigation locale={locale} currentPath="/rates" />

          <header className={styles.header}>
            <span className={articleStyles.categoryBadge}>{isEn ? "Live rate" : "نرخ لحظه‌ای"}</span>
            <h1 className={articleStyles.articleTitle}>{copy.title}</h1>
            <p className={articleStyles.articleSummary}>
              {isEn
                ? "The latest Australian dollar to Iranian toman rates published by Zarman for transfers in both directions. Rates are in toman, not rial."
                : "آخرین نرخ دلار استرالیا به تومان در صرافی زرمان، برای حواله در هر دو جهت. همهٔ مبلغ‌ها به تومان است، نه ریال."}
            </p>
            {updatedText && (
              <p className={styles.updated}>
                {isEn ? "Last updated: " : "آخرین به‌روزرسانی: "}
                <time dateTime={lastUpdated ?? undefined}>{updatedText}</time>
                {isEn ? " (Sydney time)" : " (به وقت سیدنی)"}
              </p>
            )}
          </header>

          <section className={styles.rateCards} aria-label={isEn ? "Today's rates" : "نرخ‌های امروز"}>
            <div className={styles.rateCard}>
              <span className={styles.direction}>{isEn ? "Australia → Iran" : "حواله استرالیا ← ایران"}</span>
              <strong className={styles.rateValue}>{buyAUD ? num(buyAUD) : "—"}</strong>
              <span className={styles.rateUnit}>
                {isEn ? "toman received for 1 AUD you send" : "تومان دریافتی به ازای هر ۱ دلار استرالیا"}
              </span>
            </div>
            <div className={styles.rateCard}>
              <span className={styles.direction}>{isEn ? "Iran → Australia" : "حواله ایران ← استرالیا"}</span>
              <strong className={styles.rateValue}>{sellAUD ? num(sellAUD) : "—"}</strong>
              <span className={styles.rateUnit}>
                {isEn ? "toman you pay for 1 AUD received" : "تومان پرداختی به ازای هر ۱ دلار استرالیا"}
              </span>
            </div>
          </section>

          {buyAUD && (
            <section className={styles.tableSection} aria-labelledby="aud-to-toman-table">
              <h2 id="aud-to-toman-table">
                {isEn ? "How many toman is 100, 500 or 1,000 Australian dollars?" : "۱۰۰، ۵۰۰ یا ۱٬۰۰۰ دلار استرالیا چند تومان است؟"}
              </h2>
              <p>
                {isEn
                  ? "Amount the recipient in Iran receives when you send from Australia, after any transfer fee."
                  : "مبلغی که گیرنده در ایران دریافت می‌کند وقتی از استرالیا حواله می‌فرستید، بعد از کسر کارمزد احتمالی."}
              </p>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{isEn ? "You send (AUD)" : "ارسالی (دلار)"}</th>
                      <th>{isEn ? "Recipient gets (toman)" : "دریافتی (تومان)"}</th>
                      <th>{isEn ? "Fee (AUD)" : "کارمزد"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {AUD_AMOUNTS.map((amount) => {
                      const row = audToToman(amount, buyAUD, financeConfig);
                      return (
                        <tr key={amount}>
                          <td>{num(amount)}</td>
                          <td>{row ? num(row.toman) : "—"}</td>
                          <td>{row ? num(row.feeAud, 2) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {sellAUD && (
            <section className={styles.tableSection} aria-labelledby="toman-to-aud-table">
              <h2 id="toman-to-aud-table">
                {isEn ? "Toman to Australian dollar" : "تبدیل تومان به دلار استرالیا"}
              </h2>
              <p>
                {isEn
                  ? "Australian dollars received in Australia when you pay toman in Iran, after any transfer fee."
                  : "دلار استرالیایی که در استرالیا دریافت می‌کنید وقتی در ایران تومان واریز می‌کنید، بعد از کسر کارمزد احتمالی."}
              </p>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{isEn ? "You pay (toman)" : "پرداختی (تومان)"}</th>
                      <th>{isEn ? "You receive (AUD)" : "دریافتی (دلار)"}</th>
                      <th>{isEn ? "Fee (AUD)" : "کارمزد"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TOMAN_AMOUNTS.map((amount) => {
                      const row = tomanToAud(amount, sellAUD, financeConfig);
                      return (
                        <tr key={amount}>
                          <td>{num(amount)}</td>
                          <td>{row ? num(row.aud, 2) : "—"}</td>
                          <td>{row ? num(row.feeAud, 2) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className={styles.note}>
                {isEn ? (
                  <>Paying a large amount in toman? See <Link href="/en/blog/send-money-iran-to-australia">sending money from Iran to Australia</Link> for Iranian bank transfer limits.</>
                ) : (
                  <>برای سقف انتقال پل و پایا، <Link href="/fa/blog/enteghal-pool-az-iran-be-australia">انتقال پول از ایران به استرالیا</Link> را بخوانید.</>
                )}
              </p>
            </section>
          )}
        </div>

        <RateSection />

        <div className={articleStyles.shell}>
          <section className={styles.faq} aria-labelledby="rates-faq">
            <h2 id="rates-faq">{isEn ? "Common questions about the AUD rate" : "سؤال‌های رایج دربارهٔ نرخ دلار استرالیا"}</h2>
            {faqs.map((faq) => (
              <details key={faq.q} className={styles.faqItem}>
                <summary>{faq.q}</summary>
                <p>{faq.a}</p>
              </details>
            ))}
            <p className={styles.note}>
              {isEn ? (
                <>Want to know what moves the rate? Read our <Link href="/en/blog/aud-to-irt-exchange-rate-guide">AUD to toman rate guide</Link>.</>
              ) : (
                <>برای اینکه بدانید نرخ چطور تعیین می‌شود، <Link href="/fa/blog/rahnamaye-nerkh-aud-irt">راهنمای نرخ دلار استرالیا به تومان</Link> را بخوانید.</>
              )}
            </p>
          </section>

          <div className={articleStyles.ctaBox}>
            <div className={articleStyles.ctaCopy}>
              <span>{isEn ? "Your next step" : "گام بعدی شما"}</span>
              <p>
                {isEn
                  ? "Create an account to see your personalised rate before you send."
                  : "برای دیدن نرخ شخصی‌سازی‌شدهٔ خودتان قبل از ارسال، حساب کاربری بسازید."}
              </p>
            </div>
            <Link href={`/${locale}/register`} className={articleStyles.ctaButton}>
              {isEn ? "Request your rate" : "درخواست نرخ شخصی"}
              <ActionIcon size={18} strokeWidth={2.5} />
            </Link>
          </div>
        </div>
      </div>
    </MarketProviders>
  );
}
