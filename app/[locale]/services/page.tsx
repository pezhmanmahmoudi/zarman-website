import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import ContentNavigation from "@/components/layout/ContentNavigation";
import { services } from "@/data/services";
import {
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  Stethoscope,
  Landmark,
  Building2,
  Globe2,
  ShieldCheck,
} from "lucide-react";
import styles from "@/styles/Services.module.css";

import { SITE_URL as PRODUCTION_URL, getPageMetadata, serializeJsonLd } from "@/lib/seo";

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  "student-remittance": <GraduationCap size={22} strokeWidth={2} />,
  "healthcare-professional-payments": <Stethoscope size={22} strokeWidth={2} />,
  "capital-and-asset-transfer": <Landmark size={22} strokeWidth={2} />,
  "business-payment-infrastructure": <Building2 size={22} strokeWidth={2} />,
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isEn = locale === "en";
  return getPageMetadata({
    locale,
    path: "/services",
    title: isEn ? "Australia–Iran Money Transfer Services" : "خدمات حواله بین ایران و استرالیا",
    description: isEn ? "Explore student payments, healthcare registration fees, personal capital transfers and business payments between Australia and Iran with Zarman Exchange." : "خدمات حواله زرمان بین ایران و استرالیا: پرداخت شهریه دانشجویی، هزینه آزمون و رجیستری کادر درمان، انتقال سرمایه و پرداخت‌های تجاری.",
  });
}

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEn = locale === "en";
  const localeServices = services.filter((s) => s.locale === locale);
  const ArrowIcon = isEn ? ArrowRight : ArrowLeft;

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
        name: isEn ? "Services" : "خدمات",
        item: `${PRODUCTION_URL}/${locale}/services`,
      },
    ],
  };

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: isEn ? "Zarman Exchange Services" : "خدمات صرافی زرمان",
    description: isEn
      ? "AUD to IRT remittance services for the Australian-Iranian community"
      : "خدمات حواله دلار استرالیا به تومان برای ایرانیان مقیم استرالیا",
    url: `${PRODUCTION_URL}/${locale}/services`,
    numberOfItems: localeServices.length,
    itemListElement: localeServices.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: s.title,
      description: s.description,
      url: `${PRODUCTION_URL}/${locale}/services/${s.slug}`,
    })),
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
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(itemListSchema) }}
      />

      <section className={styles.section} aria-labelledby="services-heading">
        <div className={styles.bgGrid} aria-hidden="true" />
        <div className={styles.bgGlow} aria-hidden="true" />

        <div className={styles.container}>
          <ContentNavigation locale={locale} currentPath="/services" />

          <header className={styles.header}>
            <div className={styles.brandLine}>
              <Image
                src="/images/logo-no-text-light.svg"
                alt=""
                width={48}
                height={48}
                className={styles.logoImage}
              />
              <div>
                <span>{isEn ? "Zarman Exchange" : "صرافی زرمان"}</span>
                <small>{isEn ? "Transfer services" : "خدمات حواله"}</small>
              </div>
            </div>

            <div className={styles.headerGrid}>
              <div>
                <span className={styles.eyebrow}>
                  {isEn ? "What we offer" : "خدمات ما"}
                </span>
                <h1 id="services-heading" className={styles.title}>
                  {isEn ? "Money transfers shaped around real needs" : "خدمات حواله متناسب با نیازهای واقعی"}
                </h1>
              </div>
              <p className={styles.subtitle}>
                {isEn
                  ? "Explore payments for study, professional registration, personal capital and business needs. Each request is reviewed for availability, documents and timing."
                  : "از شهریه دانشجویی تا هزینه رجیستری، انتقال سرمایه و پرداخت‌های تجاری؛ امکان انجام، مدارک و زمان هر درخواست به‌صورت جداگانه بررسی می‌شود."}
              </p>
            </div>

            <div className={styles.factGrid}>
              <div className={styles.factItem}>
                <Building2 size={19} strokeWidth={1.8} aria-hidden="true" />
                <span>
                  <small>{isEn ? "Service range" : "دامنه خدمات"}</small>
                  <strong>{isEn ? "4 specialised services" : "۴ خدمت تخصصی"}</strong>
                </span>
              </div>
              <div className={styles.factItem}>
                <Globe2 size={19} strokeWidth={1.8} aria-hidden="true" />
                <span>
                  <small>{isEn ? "Transfer corridor" : "مسیر حواله"}</small>
                  <strong>{isEn ? "Australia and Iran" : "استرالیا و ایران"}</strong>
                </span>
              </div>
              <div className={styles.factItem}>
                <ShieldCheck size={19} strokeWidth={1.8} aria-hidden="true" />
                <span>
                  <small>{isEn ? "Request review" : "بررسی درخواست"}</small>
                  <strong>{isEn ? "Documents and availability" : "مدارک و امکان انجام"}</strong>
                </span>
              </div>
            </div>
          </header>

          <section
            aria-label={isEn ? "Service listings" : "فهرست خدمات"}
            className={styles.grid}
          >
            {localeServices.map((service, index) => (
              <article key={service.slug}>
                <Link
                  href={`/${locale}/services/${service.slug}`}
                  className={styles.card}
                >
                  <div className={styles.cardTopline} aria-hidden="true">
                    <span className={styles.cardIcon}>
                      {SERVICE_ICONS[service.slug]}
                    </span>
                    <span className={styles.cardNumber}>
                      {(index + 1).toLocaleString(isEn ? "en-AU" : "fa-IR", { minimumIntegerDigits: 2 })}
                    </span>
                  </div>
                  <h2 className={styles.cardTitle}>{service.title}</h2>
                  <p className={styles.cardDescription}>{service.description}</p>
                  <span className={styles.cardLink}>
                    {isEn ? "Explore service" : "مشاهده جزئیات"}
                    <ArrowIcon size={14} />
                  </span>
                </Link>
              </article>
            ))}
          </section>

          <aside className={styles.ctaBanner} aria-label={isEn ? "Start a transfer" : "شروع حواله"}>
            <div>
              <span className={styles.ctaEyebrow}>{isEn ? "Next step" : "گام بعدی"}</span>
              <p className={styles.ctaBannerTitle}>
                {isEn
                  ? "Discuss your transfer with our team"
                  : "درخواست حواله خود را با تیم زرمان بررسی کنید"}
              </p>
              <p className={styles.ctaBannerSubtitle}>
                {isEn
                  ? "Create an account, complete verification and review your quote before confirming."
                  : "حساب کاربری بسازید، احراز هویت را تکمیل کنید و پیش از تأیید، نرخ و هزینه‌های اعلام‌شده را بررسی کنید."}
              </p>
            </div>
            <div className={styles.ctaActions}>
              <Link href={`/${locale}/about`} className={styles.ctaSecondary}>
                {isEn ? "About Zarman" : "درباره زرمان"}
              </Link>
              <Link href={`/${locale}/register`} className={styles.ctaButton}>
                {isEn ? "Get started" : "شروع ثبت‌نام"}
                <ArrowIcon size={16} />
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
