import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import ContentNavigation from "@/components/layout/ContentNavigation";
import {
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  Stethoscope,
  Landmark,
  Building2,
} from "lucide-react";
import { services } from "@/data/services";
import styles from "@/styles/Services.module.css";
import { SITE_URL as PRODUCTION_URL, getPageMetadata, organizationId, serializeJsonLd } from "@/lib/seo";

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  "student-remittance": <GraduationCap size={26} strokeWidth={2} />,
  "healthcare-professional-payments": <Stethoscope size={26} strokeWidth={2} />,
  "capital-and-asset-transfer": <Landmark size={26} strokeWidth={2} />,
  "business-payment-infrastructure": <Building2 size={26} strokeWidth={2} />,
};

export async function generateStaticParams() {
  return services.map((s) => ({ locale: s.locale, slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const service = services.find((s) => s.slug === slug && s.locale === locale);
  if (!service) notFound();

  return getPageMetadata({
    locale,
    path: `/services/${slug}`,
    title: service.metaTitle,
    description: service.metaDescription,
    alternatePaths: Object.fromEntries(services.filter((entry) => entry.slug === slug).map((entry) => [entry.locale, `/services/${entry.slug}`])),
  });
}

export default async function ServicePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const service = services.find((s) => s.slug === slug && s.locale === locale);
  if (!service) notFound();

  const isEn = locale === "en";
  const ArrowIcon = isEn ? ArrowRight : ArrowLeft;
  const localeServices = services.filter((entry) => entry.locale === locale);

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.title,
    description: service.description,
    provider: {
      "@id": organizationId,
    },
    areaServed: [
      { "@type": "Country", name: "Australia" },
      { "@type": "Country", name: "Iran" },
    ],
    url: `${PRODUCTION_URL}/${locale}/services/${slug}`,
  };

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
      {
        "@type": "ListItem",
        position: 3,
        name: service.title,
        item: `${PRODUCTION_URL}/${locale}/services/${slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(serviceSchema) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbSchema) }}
      />
      <section className={styles.section} aria-labelledby="service-heading">
        <div className={styles.bgGrid} aria-hidden="true" />
        <div className={styles.bgGlow} aria-hidden="true" />

        <div className={styles.articleContainer}>
          <ContentNavigation locale={locale} currentPath={`/services/${slug}`} />

          <article dir={isEn ? "ltr" : "rtl"}>
            <header className={styles.articleHero}>
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
                  <small>{isEn ? "Specialised transfer service" : "خدمت تخصصی حواله"}</small>
                </div>
              </div>

              <div className={styles.articleHeroGrid}>
                <div>
                  <span className={styles.eyebrow}>
                    <span className={styles.articleIconWrap} aria-hidden="true">
                      {SERVICE_ICONS[slug]}
                    </span>
                    {service.title}
                  </span>
                  <h1 id="service-heading" className={styles.articleTitle}>{service.h1}</h1>
                </div>
                <p className={styles.articleSubtitle}>{service.description}</p>
              </div>
            </header>

            <div className={styles.articleBodyLayout}>
              <aside className={styles.serviceRail} aria-label={isEn ? "Transfer services" : "خدمات حواله"}>
                <span className={styles.railLabel}>{isEn ? "Transfer services" : "خدمات حواله"}</span>
                <nav className={styles.railLinks}>
                  {localeServices.map((entry) => (
                    <Link
                      key={entry.slug}
                      href={`/${locale}/services/${entry.slug}`}
                      aria-current={entry.slug === slug ? "page" : undefined}
                    >
                      {entry.title}
                    </Link>
                  ))}
                </nav>
                <Link href={`/${locale}/about`} className={styles.railAboutLink}>
                  {isEn ? "About Zarman" : "درباره زرمان"}
                  <ArrowIcon size={15} strokeWidth={2.4} aria-hidden="true" />
                </Link>
              </aside>

              <div className={styles.articleCard}>
                {/* bodyHtml is authored content from a trusted data file — not user input */}
                <div
                  className={styles.prose}
                  dangerouslySetInnerHTML={{ __html: service.bodyHtml }}
                />
                <section className={`${styles.prose} ${styles.preflight}`}>
                  <span className={styles.preflightLabel}>{isEn ? "Before you transfer" : "پیش از انتقال"}</span>
                  <h2>{isEn ? "Before you arrange a payment" : "پیش از ثبت درخواست پرداخت"}</h2>
                  <p>{isEn
                    ? "Contact our team to confirm that your payment can be supported. Availability depends on the purpose, recipient, required documents, banking arrangements and applicable restrictions. Confirm the quoted rate, fees and expected settlement time before sending funds."
                    : "با تیم زرمان تماس بگیرید تا امکان انجام پرداخت بررسی شود. ارائه خدمت به هدف پرداخت، گیرنده، مدارک، شرایط بانکی و محدودیت‌های قابل‌اعمال بستگی دارد. پیش از واریز وجه، نرخ، هزینه‌ها و زمان مورد انتظار تسویه را تأیید کنید."}</p>
                  <p><Link href={`/${locale}/about`}>{isEn ? "About Zarman and identity verification" : "درباره زرمان و احراز هویت"}</Link></p>
                </section>
                <footer className={styles.articleCta}>
                  <div>
                    <span>{isEn ? "Next step" : "گام بعدی"}</span>
                    <p>{isEn ? "Create your account to discuss this service with our team." : "برای بررسی این خدمت با تیم زرمان، حساب کاربری خود را ایجاد کنید."}</p>
                  </div>
                  <Link href={`/${locale}/register`} className={styles.articleCtaButton}>
                    {isEn ? "Get started" : "شروع ثبت‌نام"}
                    <ArrowIcon size={16} />
                  </Link>
                </footer>
              </div>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
