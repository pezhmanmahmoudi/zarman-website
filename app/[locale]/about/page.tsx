import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import styles from "@/styles/About.module.css";
import Button from "@/components/ui/Button/Button";

const PRODUCTION_URL = "https://zarman.com.au";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isEn = locale === "en";

  return {
    title: isEn
      ? "Zarman Exchange | Personalized Change Rates"
      : "صرافی زرمان | زرمان اکسچنج | نرخ شخصی سازی شده حواله دلار استرالیا",
    description: isEn
      ? "Zarman Exchange is an AUSTRAC-registered remittance dealer (ABN 70 692 742 957) specialising in AUD to IRT transfers. Learn about our compliance framework, mission, and team."
      : "صرافی زرمان یک استارتاپ مالی ایرانی–استرالیایی ثبت‌شده نزد AUSTRAC (ABN: 70 692 742 957) است. درباره چارچوب انطباق قانونی، مأموریت و تیم ما بیشتر بدانید.",
    alternates: {
      canonical: `${PRODUCTION_URL}/${locale}/about`,
      languages: {
        "en-AU": `${PRODUCTION_URL}/en/about`,
        "fa-IR": `${PRODUCTION_URL}/fa/about`,
        "x-default": `${PRODUCTION_URL}/fa/about`,
      },
    },
    openGraph: {
      title: isEn
        ? "Zarman Exchange | Personalized Change Rates"
        : "صرافی زرمان | زرمان اکسچنج | نرخ شخصی سازی شده حواله دلار استرالیا",
      description: isEn
        ? "AUSTRAC-registered AUD to IRT remittance. ABN 70 692 742 957. Enterprise-grade compliance and transparent pricing."
        : "صرافی مجاز ثبت‌شده نزد AUSTRAC برای حواله دلار استرالیا. ABN: 70 692 742 957.",
      url: `${PRODUCTION_URL}/${locale}/about`,
      type: "website",
    },
  };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEn = locale === "en";
  const BackIcon = isEn ? ArrowLeft : ArrowRight;

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: isEn ? "Home" : "خانه",
        item: `${PRODUCTION_URL}/${locale}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: isEn ? "About" : "درباره ما",
        item: `${PRODUCTION_URL}/${locale}/about`,
      },
    ],
  };

  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "@id": `${PRODUCTION_URL}/${locale}/about`,
    name: isEn ? "About Zarman Exchange" : "درباره صرافی زرمان",
    url: `${PRODUCTION_URL}/${locale}/about`,
    description: isEn
      ? "About Zarman Exchange Pty Ltd — AUSTRAC registered remittance dealer specialising in AUD to IRT transfers."
      : "درباره شرکت زرمان اکسچنج — صرافی ثبت‌شده نزد AUSTRAC برای انتقال دلار استرالیا به تومان.",
    mainEntity: {
      "@id": `${PRODUCTION_URL}/#organization`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
      />

      <div className={styles.pageWrapper}>
        <div className={styles.container}>
          <div className={styles.topNav}>
            <Link href={`/${locale}`} className={styles.backHome} aria-label={isEn ? "Back to home" : "بازگشت به خانه"}>
              <BackIcon size={18} strokeWidth={2.5} />
            </Link>
          </div>

          <div className={styles.logoContainer}>
            <Image
              src="/images/logo-no-text-light.svg"
              alt="Zarman Exchange"
              width={80}
              height={80}
              priority
              className={styles.logoImage}
            />
          </div>

          <header className={styles.header}>
            <h1 className={`${styles.title} ${isEn ? styles.titleEn : ''}`}>
              {isEn ? "About Zarman Exchange" : "درباره صرافی زرمان"}
            </h1>
            <p className={`${styles.subtitle} ${isEn ? styles.subtitleEn : ''}`}>
              {isEn
                ? "AUSTRAC Registered Remittance Dealer · ABN 70 692 742 957"
                : "صرافی ثبت‌شده نزد AUSTRAC · شماره ABN: 70 692 742 957"}
            </p>
          </header>

          <div className={`${styles.content} ${isEn ? styles.contentEn : ''}`}>
            {isEn ? (
              <>
                <h2>Who We Are</h2>
                <p>
                  <strong>Zarman Exchange Pty Ltd</strong> is an Iranian-Australian fintech startup focused on providing fast, transparent, and compliant international remittance services between Australia and Iran. We understand the challenges of cross-border money transfers in this corridor and have built a platform that makes the process straightforward, honest, and secure.
                </p>
                <p>
                  Our team brings together expertise in financial technology, compliance, and customer service to deliver an experience that puts our clients first. Every transaction is handled with care, backed by enterprise-grade infrastructure and full regulatory compliance.
                </p>

                <h2>Our Mission</h2>
                <p>
                  To be the most trusted bridge for financial transfers between Australia and Iran — offering competitive, volume-based personalised rates, instant settlement, and complete transparency at every step.
                </p>

                <h2>Regulatory Credentials &amp; Compliance</h2>
                <p>
                  Zarman Exchange operates under the strict oversight of the Australian Transaction Reports and Analysis Centre (<strong>AUSTRAC</strong>), Australia's financial intelligence agency and AML/CTF regulator. We are fully compliant with the <em>Anti-Money Laundering and Counter-Terrorism Financing Act 2006</em> (AML/CTF Act).
                </p>

                <div className={styles.credentialCard}>
                  <div className={styles.credentialRow}>
                    <span className={styles.credentialLabel}>Company</span>
                    <span className={styles.credentialValue}>Zarman Exchange Pty Ltd</span>
                  </div>
                  <div className={styles.credentialRow}>
                    <span className={styles.credentialLabel}>ABN</span>
                    <span className={styles.credentialValue}>70 692 742 957</span>
                  </div>
                  <div className={styles.credentialRow}>
                    <span className={styles.credentialLabel}>AUSTRAC Reg.</span>
                    <span className={styles.credentialValue}>100907570 — Registered Remittance Dealer</span>
                  </div>
                  <div className={styles.credentialRow}>
                    <span className={styles.credentialLabel}>Country</span>
                    <span className={styles.credentialValue}>Australia</span>
                  </div>
                  <div className={styles.verifyBtnWrapper}>
                    <Button
                      href="https://online.apps.austrac.gov.au/rsr/"
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="primary"
                      size="md"
                      rightIcon={<ExternalLink size={16} />}
                      className={styles.verifyBtn}
                    >
                      Verify on AUSTRAC Register
                    </Button>
                  </div>
                </div>

                <h2>What We Offer</h2>
                <h3>AUD to IRT Remittance</h3>
                <p>
                  We specialise in transferring Australian Dollars (AUD) to Iranian Toman (IRT) with dynamic, volume-based exchange rates. The more you transact, the better your rate — our Loyalty Rate system rewards regular clients with progressively improved pricing.
                </p>
                <h3>Personalised Exchange Rates</h3>
                <p>
                  Unlike fixed-rate services, our pricing is tailored to each client's transaction volume and history. Your personalised rate is always shown before you confirm — no hidden fees, no surprises.
                </p>
                <h3>Fast Settlement</h3>
                <p>
                  Once your identity is verified and payment is received, transfers are processed at the highest possible speed. An official transaction receipt is sent to your email upon completion.
                </p>

                <h2>Identity Verification (KYC)</h2>
                <p>
                  As required by AUSTRAC regulations, all clients must complete a Know Your Customer (KYC) identity verification before conducting transactions. This process is simple: submit a valid government-issued ID and we will confirm your identity promptly. This protects both you and the integrity of the financial system.
                </p>

                <h2>Contact Us</h2>
                <p>
                  For enquiries, reach us via WhatsApp or register online to speak with our team directly.
                </p>
                <div className={styles.actionWrapper}>
                  <Button href="/en/register" variant="primary" size="lg">
                    Register for a personalised rate
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h2>ما کی هستیم</h2>
                <p>
                  <strong>شرکت زرمان اکسچنج (Zarman Exchange Pty Ltd)</strong> یک استارتاپ مالی ایرانی–استرالیایی است که با هدف ارائه خدمات سریع، شفاف و قانون‌مند برای نقل‌وانتقالات مالی بین‌المللی میان استرالیا و ایران شکل گرفته است. ما چالش‌های این مسیر را از نزدیک می‌شناسیم و پلتفرمی ساخته‌ایم که این فرآیند را ساده، شفاف و ایمن می‌کند.
                </p>
                <p>
                  تیم ما ترکیبی از متخصصان فناوری مالی، انطباق قانونی و خدمات مشتری است که هدف مشترکی دارند: قرار دادن مشتری در اولویت. هر تراکنش با دقت و پشتیبانی کامل قانونی انجام می‌شود.
                </p>

                <h2>مأموریت ما</h2>
                <p>
                  باشیم معتمدترین پل مالی میان استرالیا و ایران — با نرخ‌های رقابتی و شخصی‌سازی‌شده بر اساس حجم تراکنش، تسویه فوری و شفافیت کامل در هر مرحله.
                </p>

                <h2>مجوزها و انطباق قانونی</h2>
                <p>
                  زرمان اکسچنج تحت نظارت دقیق سازمان اطلاعات مالی استرالیا (<strong>AUSTRAC</strong>) فعالیت می‌کند و با قانون مبارزه با پول‌شویی و تأمین مالی تروریسم ۲۰۰۶ (AML/CTF Act) کاملاً منطبق است.
                </p>

                <div className={styles.credentialCard}>
                  <div className={styles.credentialRow}>
                    <span className={styles.credentialLabel}>شرکت</span>
                    <span className={styles.credentialValue}>Zarman Exchange Pty Ltd</span>
                  </div>
                  <div className={styles.credentialRow}>
                    <span className={styles.credentialLabel}>ABN</span>
                    <span className={styles.credentialValue}>70 692 742 957</span>
                  </div>
                  <div className={styles.credentialRow}>
                    <span className={styles.credentialLabel}>مجوز AUSTRAC</span>
                    <span className={styles.credentialValue}>100907570 — Registered Remittance Dealer</span>
                  </div>
                  <div className={styles.credentialRow}>
                    <span className={styles.credentialLabel}>کشور</span>
                    <span className={styles.credentialValue}>استرالیا</span>
                  </div>
                  <div className={styles.verifyBtnWrapper}>
                    <Button
                      href="https://online.apps.austrac.gov.au/rsr/"
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="primary"
                      size="md"
                      rightIcon={<ExternalLink size={16} />}
                      className={styles.verifyBtn}
                    >
                      تأیید در سامانه رسمی AUSTRAC
                    </Button>
                  </div>
                </div>

                <h2>خدمات ما</h2>
                <h3>حواله دلار استرالیا به تومان</h3>
                <p>
                  تخصص ما انتقال دلار استرالیا (AUD) به تومان ایران (IRT) با نرخ‌های پویا و حجم‌محور است. هرچه بیشتر تراکنش کنید، نرخ بهتری دریافت می‌کنید — سیستم نرخ وفاداری ما به مشتریان ثابت پاداش می‌دهد.
                </p>
                <h3>نرخ شخصی‌سازی‌شده</h3>
                <p>
                  برخلاف سرویس‌های نرخ ثابت، قیمت‌گذاری ما بر اساس حجم و سابقه تراکنش هر مشتری تنظیم می‌شود. نرخ اختصاصی شما همیشه قبل از تأیید سفارش نمایش داده می‌شود — بدون هزینه پنهان، بدون سورپرایز.
                </p>
                <h3>تسویه سریع</h3>
                <p>
                  پس از تأیید هویت و دریافت وجه، انتقال با بالاترین سرعت ممکن انجام می‌شود. رسید رسمی تراکنش به ایمیل شما ارسال می‌گردد.
                </p>

                <h2>احراز هویت (KYC)</h2>
                <p>
                  بر اساس الزامات AUSTRAC، تمام مشتریان قبل از انجام تراکنش باید فرآیند احراز هویت (KYC) را تکمیل کنند. این فرآیند ساده است: یک مدرک شناسایی معتبر صادرشده توسط دولت ارائه دهید تا هویت شما سریعاً تأیید شود. این اقدام هم از شما و هم از سلامت سیستم مالی محافظت می‌کند.
                </p>

                <h2>تماس با ما</h2>
                <p>
                  برای استعلام از طریق واتساپ با ما در تماس باشید یا آنلاین ثبت‌نام کنید تا مستقیماً با تیم ما صحبت کنید.
                </p>
                <div className={styles.actionWrapper}>
                  <Button href="/fa/register" variant="primary" size="lg">
                    ثبت‌نام برای دریافت نرخ شخصی
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}