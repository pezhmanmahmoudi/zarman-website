import type { Metadata } from "next";
import Link from "next/link";
import { services } from "@/data/services";
import {
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  Stethoscope,
  Landmark,
  Building2,
} from "lucide-react";
import styles from "@/styles/Services.module.css";

const PRODUCTION_URL = "https://zarman.com.au";
const SOCIAL_IMAGE = `${PRODUCTION_URL}/images/layout-logo.png`;

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  "student-remittance": <GraduationCap size={22} strokeWidth={2} />,
  "healthcare-professional-payments": <Stethoscope size={22} strokeWidth={2} />,
  "capital-and-asset-transfer": <Landmark size={22} strokeWidth={2} />,
  "business-payment-infrastructure": <Building2 size={22} strokeWidth={2} />,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isEn = locale === "en";

  const title = isEn
    ? "Our Services | AUD/IRT Remittance Solutions | Zarman Exchange"
    : "خدمات ما | راه‌حل‌های حواله AUD/IRT | صرافی زرمان";
  const description = isEn
    ? "Explore Zarman Exchange's full range of AUD/IRT remittance services — student payments, healthcare registration fees, large capital transfers, and business payment infrastructure."
    : "خدمات کامل صرافی زرمان را کاوش کنید — پرداخت‌های دانشجویی، هزینه‌های رجیستری پزشکی، انتقال سرمایه و زیرساخت پرداخت‌های تجاری.";

  return {
    title,
    description,
    alternates: {
      canonical: `${PRODUCTION_URL}/${locale}/services`,
      languages: {
        "en-AU": `${PRODUCTION_URL}/en/services`,
        "fa-IR": `${PRODUCTION_URL}/fa/services`,
        "x-default": `${PRODUCTION_URL}/fa/services`,
      },
    },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: `${PRODUCTION_URL}/${locale}/services`,
      type: "website",
      images: [{ url: SOCIAL_IMAGE, width: 1200, height: 630 }],
    },
  };
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />

      <main className={styles.section}>
        <div className={styles.bgGrid} aria-hidden="true" />
        <div className={styles.bgGlow} aria-hidden="true" />

        <div className={styles.container}>
          <nav className={styles.topNav} aria-label={isEn ? "Back to home" : "بازگشت"}>
            <Link href={`/${locale}`} className={styles.backHome}>
              <BackIcon size={16} strokeWidth={2.5} />
              {isEn ? "Back to home" : "بازگشت به خانه"}
            </Link>
          </nav>

          <header className={styles.header}>
            <span className={styles.eyebrow}>
              {isEn ? "What We Offer" : "خدمات ما"}
            </span>
            <h1 className={styles.title}>
              {isEn ? "AUD/IRT Remittance Services" : "خدمات حواله AUD/IRT"}
            </h1>
            <p className={styles.subtitle}>
              {isEn
                ? "From student tuition to enterprise settlements — every cross-border payment between Australia and Iran, handled with precision and full AUSTRAC compliance."
                : "از شهریه دانشجویی تا تسویه‌های سازمانی — هر پرداخت فرامرزی بین استرالیا و ایران با دقت و انطباق کامل قانونی انجام می‌شود."}
            </p>
          </header>

          <section
            aria-label={isEn ? "Service listings" : "فهرست خدمات"}
            className={styles.grid}
          >
            {localeServices.map((service) => (
              <article key={service.slug}>
                <Link
                  href={`/${locale}/services/${service.slug}`}
                  className={styles.card}
                >
                  <div className={styles.cardIcon} aria-hidden="true">
                    {SERVICE_ICONS[service.slug]}
                  </div>
                  <h2 className={styles.cardTitle}>{service.title}</h2>
                  <p className={styles.cardDescription}>{service.description}</p>
                  <span className={styles.cardLink}>
                    {isEn ? "Learn more" : "بیشتر بدانید"}
                    <ArrowIcon size={14} />
                  </span>
                </Link>
              </article>
            ))}
          </section>

          <div className={styles.ctaBanner}>
            <p className={styles.ctaBannerTitle}>
              {isEn
                ? "Ready to get a personalised rate?"
                : "آماده دریافت نرخ شخصی سازی شده هستید؟"}
            </p>
            <p className={styles.ctaBannerSubtitle}>
              {isEn
                ? "Register in minutes. Zero fees. Enterprise-grade AUSTRAC compliance."
                : "ثبت‌نام در چند دقیقه. بدون کارمزد. انطباق قانونی سطح سازمانی."}
            </p>
            <Link href={`/${locale}/register`} className={styles.ctaButton}>
              {isEn ? "Get Started" : "شروع ثبت‌نام"}
              <ArrowIcon size={16} />
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
