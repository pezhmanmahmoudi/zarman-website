import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import ContentNavigation from "@/components/layout/ContentNavigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  ExternalLink,
  Globe2,
  GraduationCap,
  Landmark,
  ShieldCheck,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import styles from "@/styles/AboutEditorial.module.css";
import Button from "@/components/ui/Button/Button";
import { services } from "@/data/services";

import { SITE_URL as PRODUCTION_URL, getPageMetadata, organizationId, websiteId, serializeJsonLd } from "@/lib/seo";

const SERVICE_ICONS: Record<string, LucideIcon> = {
  "student-remittance": GraduationCap,
  "healthcare-professional-payments": Stethoscope,
  "capital-and-asset-transfer": Landmark,
  "business-payment-infrastructure": Building2,
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isEn = locale === "en";
  return getPageMetadata({
    locale,
    path: "/about",
    title: isEn ? "About Us & Company Details" : "درباره ما و اطلاعات شرکت",
    description: isEn ? "Learn about Zarman Exchange, our Australia–Iran remittance services, company details, identity verification and how to contact our team." : "با صرافی زرمان، خدمات حواله بین ایران و استرالیا، اطلاعات شرکت، فرآیند احراز هویت و راه‌های ارتباط با تیم پشتیبانی آشنا شوید.",
  });
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEn = locale === "en";
  const localeServices = services.filter((service) => service.locale === locale);
  const ServiceArrow = isEn ? ArrowRight : ArrowLeft;
  const serviceCards = localeServices.map((service, index) => {
    const Icon = SERVICE_ICONS[service.slug] ?? Building2;
    const number = (index + 1).toLocaleString(isEn ? "en-AU" : "fa-IR", {
      minimumIntegerDigits: 2,
    });

    return (
      <article key={service.slug}>
        <Link href={`/${locale}/services/${service.slug}`} className={styles.serviceItem}>
          <span className={styles.serviceTopline} aria-hidden="true">
            <span className={styles.serviceIcon}>
              <Icon size={20} strokeWidth={1.8} />
            </span>
            <span className={styles.serviceNumber}>{number}</span>
          </span>
          <h3>{service.title}</h3>
          <p>{service.description}</p>
          <span className={styles.serviceAction}>
            {isEn ? "Explore service" : "مشاهده جزئیات"}
            <ServiceArrow size={15} strokeWidth={2.4} aria-hidden="true" />
          </span>
        </Link>
      </article>
    );
  });

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
    inLanguage: isEn ? "en-AU" : "fa",
    isPartOf: { "@id": websiteId },
    description: isEn
      ? "About Zarman Exchange Pty Ltd — AUSTRAC registered remittance dealer specialising in AUD to IRT transfers."
      : "درباره شرکت زرمان اکسچنج — صرافی ثبت‌شده نزد AUSTRAC برای انتقال دلار استرالیا به تومان.",
    mainEntity: {
      "@id": organizationId,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(orgSchema) }}
      />

      <div className={styles.pageWrapper}>
        <div className={styles.backgroundGrid} aria-hidden="true" />
        <div className={styles.shell}>
          <ContentNavigation locale={locale} currentPath="/about" />

          <header className={styles.hero}>
            <div className={styles.brandLine}>
              <Image
                src="/images/logo-no-text-light.svg"
                alt=""
                width={48}
                height={48}
                priority
                className={styles.logoImage}
              />
              <div>
                <span>{isEn ? "Zarman Exchange" : "صرافی زرمان"}</span>
                <small>{isEn ? "Company profile" : "معرفی شرکت"}</small>
              </div>
            </div>

            <div className={styles.heroGrid}>
              <div>
                <span className={styles.eyebrow}>
                  {isEn ? "About Zarman" : "درباره زرمان"}
                </span>
                <h1 className={`${styles.title} ${isEn ? styles.titleEn : ""}`}>
                  {isEn ? "A clearer way to arrange cross-border payments" : "مسیر روشن‌تر برای حواله میان ایران و استرالیا"}
                </h1>
              </div>
              <p className={`${styles.introduction} ${isEn ? styles.introductionEn : ""}`}>
                {isEn
                  ? "Zarman helps customers prepare and coordinate eligible transfers between Australia and Iran, with clear information about documents, quoted costs, verification and settlement steps."
                  : "زرمان به مشتریان کمک می‌کند حواله‌های قابل پشتیبانی میان استرالیا و ایران را با آگاهی از مدارک، نرخ اعلامی، احراز هویت و مراحل تسویه هماهنگ کنند."}
              </p>
            </div>

            <div className={styles.factGrid}>
              <div className={styles.factItem}>
                <Building2 size={19} strokeWidth={1.8} aria-hidden="true" />
                <span>
                  <small>{isEn ? "Legal entity" : "نام حقوقی"}</small>
                  <strong>Zarman Exchange Pty Ltd</strong>
                </span>
              </div>
              <div className={styles.factItem}>
                <ShieldCheck size={19} strokeWidth={1.8} aria-hidden="true" />
                <span>
                  <small>{isEn ? "Registration reference" : "مرجع ثبت"}</small>
                  <strong>{isEn ? "AUSTRAC register" : "سامانه AUSTRAC"}</strong>
                </span>
              </div>
              <div className={styles.factItem}>
                <Globe2 size={19} strokeWidth={1.8} aria-hidden="true" />
                <span>
                  <small>{isEn ? "Transfer corridor" : "مسیر حواله"}</small>
                  <strong>{isEn ? "Australia and Iran" : "استرالیا و ایران"}</strong>
                </span>
              </div>
            </div>
          </header>

          <div className={styles.bodyLayout}>
            <aside className={styles.companyPanel} aria-label={isEn ? "Company details" : "اطلاعات شرکت"}>
              <span className={styles.panelLabel}>{isEn ? "Company details" : "اطلاعات شرکت"}</span>
              <dl>
                <div>
                  <dt>{isEn ? "Company" : "شرکت"}</dt>
                  <dd>Zarman Exchange Pty Ltd</dd>
                </div>
                <div>
                  <dt>ABN</dt>
                  <dd>70 692 742 957</dd>
                </div>
                <div>
                  <dt>{isEn ? "AUSTRAC registration" : "شماره ثبت AUSTRAC"}</dt>
                  <dd>100907570</dd>
                </div>
                <div>
                  <dt>{isEn ? "Country" : "کشور"}</dt>
                  <dd>{isEn ? "Australia" : "استرالیا"}</dd>
                </div>
              </dl>
              <Button
                href="https://online.apps.austrac.gov.au/rsr/"
                target="_blank"
                rel="noopener noreferrer"
                variant="secondary"
                size="md"
                rightIcon={<ExternalLink size={16} />}
                className={styles.verifyBtn}
              >
                {isEn ? "Verify registration" : "بررسی ثبت رسمی"}
              </Button>
            </aside>

            <div className={`${styles.content} ${isEn ? styles.contentEn : ""}`}>
              {isEn ? (
                <>
                <section className={styles.contentSection}>
                  <span className={styles.sectionLabel}>Our company</span>
                <h2>Who We Are</h2>
                <p>
                  <strong>Zarman Exchange Pty Ltd</strong> is an Australian-Iranian financial services company focused on coordinating remittances between Australia and Iran. We help individuals, families and businesses understand the information, documents and payment steps involved before they proceed.
                </p>
                <p>
                  Our team combines financial technology, compliance operations and customer support. Each request is considered on its own circumstances, and customers receive the relevant requirements and quote before confirming a transfer.
                </p>
                </section>

                <section className={`${styles.contentSection} ${styles.missionSection}`}>
                  <span className={styles.sectionLabel}>How we work</span>
                <h2>Our Mission</h2>
                <p>
                  Our mission is to make cross-border payments easier to understand and manage. We aim to provide clear quotes, practical guidance and responsive support from the initial enquiry through to settlement.
                </p>
                </section>

                <section className={styles.contentSection}>
                  <span className={styles.sectionLabel}>Registration and compliance</span>
                <h2>Regulatory Credentials &amp; Compliance</h2>
                <p>
                  Use the legal name, ABN and registration reference shown on this page to check Zarman in the official <strong>AUSTRAC</strong> Remittance Sector Register. Registration does not endorse an individual rate or guarantee a transfer outcome. Availability remains subject to the parties, purpose, documents and requirements that apply to each request.
                </p>
                </section>

                <section className={styles.contentSection}>
                  <span className={styles.sectionLabel}>Services by purpose</span>
                <h2>Support for Common Payment Needs</h2>
                <p>
                  Our services cover common education, professional, personal and business payment needs. Choose a service to review its intended use, typical information requirements and next steps.
                </p>
                <div className={styles.serviceList}>
                  {serviceCards}
                </div>
                <Link href="/en/services" className={styles.allServicesLink}>
                  View all transfer services
                  <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
                </Link>
                </section>

                <section className={styles.contentSection}>
                  <span className={styles.sectionLabel}>Customer verification</span>
                <h2>Identity Verification (KYC)</h2>
                <p>
                  Identity verification helps us understand who is making a transfer and why. Complete the checks requested during onboarding and provide updated or additional information when needed. Requirements can vary with the customer, recipient, source of funds, payment purpose and transaction history.
                </p>
                <p><Link href="/en/legal/dvs-notice">Read our identity verification collection notice</Link> to understand how verification information is handled.</p>
                </section>

                <section className={`${styles.contentSection} ${styles.contactSection}`}>
                  <span className={styles.sectionLabel}>Talk to our team</span>
                <h2>Contact Us</h2>
                <p>
                  Tell us the amount, transfer direction, payment purpose and any relevant deadline. After an initial review, our team can explain whether the request can be supported, what information is required and what happens next.
                </p>
                <p>
                  Before sending funds, review the final quote, applicable fees and expected settlement timing. You can also <Link href="/en/services">explore our transfer services</Link> or read our <Link href="/en/blog">rate and transfer guides</Link>.
                </p>
                <p>
                  <Link href="/en/legal/privacy-policy">Privacy policy</Link> · <Link href="/en/legal/dvs-notice">Identity verification collection notice</Link> · <Link href="/en/legal/terms">Terms and conditions</Link>
                </p>
                <div className={styles.actionWrapper}>
                  <Button href="/en/register" variant="primary" size="lg">
                    Create an account
                  </Button>
                </div>
                </section>
              </>
            ) : (
              <>
                <section className={styles.contentSection}>
                  <span className={styles.sectionLabel}>معرفی شرکت</span>
                <h2>زرمان در یک نگاه</h2>
                <p>
                  <strong>شرکت زرمان اکسچنج (Zarman Exchange Pty Ltd)</strong> یک مجموعه مالی ایرانی–استرالیایی با تمرکز بر هماهنگی حواله میان استرالیا و ایران است. ما به اشخاص، خانواده‌ها و کسب‌وکارها کمک می‌کنیم پیش از اقدام، اطلاعات موردنیاز، مدارک و مراحل پرداخت را بشناسند.
                </p>
                <p>
                  تیم زرمان تجربه فناوری مالی، عملیات انطباق و پشتیبانی مشتری را کنار هم قرار می‌دهد. هر درخواست بر اساس شرایط همان تراکنش بررسی می‌شود و پیش از تأیید، الزامات مربوط و نرخ پیشنهادی در اختیار مشتری قرار می‌گیرد.
                </p>
                </section>

                <section className={`${styles.contentSection} ${styles.missionSection}`}>
                  <span className={styles.sectionLabel}>شیوه کار ما</span>
                <h2>مأموریت ما</h2>
                <p>
                  مأموریت ما ساده‌تر و قابل‌فهم‌تر کردن پرداخت‌های برون‌مرزی است. تلاش می‌کنیم از نخستین استعلام تا تسویه، نرخ و هزینه‌ها را روشن اعلام کنیم، راهنمایی عملی ارائه دهیم و پاسخ‌گو بمانیم.
                </p>
                </section>

                <section className={styles.contentSection}>
                  <span className={styles.sectionLabel}>ثبت و انطباق</span>
                <h2>اطلاعات ثبت شرکت و الزامات حواله</h2>
                <p>
                  با نام حقوقی، شماره ABN و شناسه ثبت درج‌شده در این صفحه می‌توانید وضعیت زرمان را در سامانه رسمی ارائه‌دهندگان حواله <strong>AUSTRAC</strong> بررسی کنید. ثبت در این سامانه به معنای تأیید یک نرخ مشخص یا تضمین نتیجه حواله نیست. امکان انجام هر درخواست به طرفین، هدف پرداخت، مدارک و الزامات قابل‌اعمال بستگی دارد.
                </p>
                </section>

                <section className={styles.contentSection}>
                  <span className={styles.sectionLabel}>خدمات بر اساس نیاز</span>
                <h2>پشتیبانی از پرداخت‌های رایج</h2>
                <p>
                  خدمات زرمان نیازهای متداول تحصیلی، حرفه‌ای، شخصی و تجاری را پوشش می‌دهد. هر خدمت را انتخاب کنید تا کاربرد، اطلاعات معمول موردنیاز و مراحل بعدی آن را ببینید.
                </p>
                <div className={styles.serviceList}>
                  {serviceCards}
                </div>
                <Link href="/fa/services" className={styles.allServicesLink}>
                  مشاهده همه خدمات حواله
                  <ArrowLeft size={16} strokeWidth={2.4} aria-hidden="true" />
                </Link>
                </section>

                <section className={styles.contentSection}>
                  <span className={styles.sectionLabel}>شناخت و بررسی مشتری</span>
                <h2>احراز هویت (KYC)</h2>
                <p>
                  احراز هویت به ما کمک می‌کند هویت فرستنده و هدف پرداخت را بررسی کنیم. در مرحله ثبت‌نام، اطلاعات و مدارک درخواست‌شده را ارائه دهید. بسته به مشتری، گیرنده، منبع وجه، هدف پرداخت و سابقه تراکنش ممکن است اطلاعات تکمیلی یا به‌روز نیز لازم باشد.
                </p>
                <p>برای آشنایی با نحوه استفاده از اطلاعات، <Link href="/en/legal/dvs-notice" hrefLang="en">اطلاعیه جمع‌آوری اطلاعات احراز هویت (انگلیسی)</Link> را بخوانید.</p>
                </section>

                <section className={`${styles.contentSection} ${styles.contactSection}`}>
                  <span className={styles.sectionLabel}>گفت‌وگو با تیم زرمان</span>
                <h2>تماس با ما</h2>
                <p>
                  مبلغ، مسیر انتقال، هدف پرداخت و مهلت موردنظر را با تیم ما در میان بگذارید. پس از بررسی اولیه، امکان انجام درخواست، اطلاعات لازم و مراحل بعدی به شما اعلام می‌شود.
                </p>
                <p>
                  پیش از واریز وجه، نرخ نهایی، هزینه‌های قابل‌اعمال و زمان مورد انتظار تسویه را بررسی کنید. همچنین می‌توانید <Link href="/fa/services">خدمات حواله زرمان</Link> و <Link href="/fa/blog">راهنمای نرخ ارز و انتقال پول</Link> را ببینید.
                </p>
                <p>
                  <Link href="/en/legal/privacy-policy" hrefLang="en">حریم خصوصی (انگلیسی)</Link> · <Link href="/en/legal/dvs-notice" hrefLang="en">اطلاعیه احراز هویت (انگلیسی)</Link> · <Link href="/en/legal/terms" hrefLang="en">شرایط استفاده (انگلیسی)</Link>
                </p>
                <div className={styles.actionWrapper}>
                  <Button href="/fa/register" variant="primary" size="lg">
                    ایجاد حساب کاربری
                  </Button>
                </div>
                </section>
              </>
            )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
