import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
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

const PRODUCTION_URL = "https://zarman.com.au";
const SOCIAL_IMAGE = `${PRODUCTION_URL}/images/layout-logo.png`;

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
  if (!service) return {};

  return {
    title: service.metaTitle,
    description: service.metaDescription,
    alternates: {
      canonical: `${PRODUCTION_URL}/${locale}/services/${slug}`,
      languages: {
        "en-AU": `${PRODUCTION_URL}/en/services/${slug}`,
        "fa-IR": `${PRODUCTION_URL}/fa/services/${slug}`,
        "x-default": `${PRODUCTION_URL}/fa/services/${slug}`,
      },
    },
    robots: { index: true, follow: true },
    openGraph: {
      title: service.metaTitle,
      description: service.metaDescription,
      url: `${PRODUCTION_URL}/${locale}/services/${slug}`,
      type: "website",
      images: [{ url: SOCIAL_IMAGE, width: 1200, height: 630 }],
    },
  };
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
  const BackIcon = isEn ? ArrowLeft : ArrowRight;
  const ArrowIcon = isEn ? ArrowRight : ArrowLeft;

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.title,
    description: service.description,
    dateModified: new Date().toISOString().split("T")[0],
    provider: {
      "@type": "FinancialService",
      "@id": `${PRODUCTION_URL}/#organization`,
      name: "Zarman Exchange",
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <main className={styles.section}>
        <div className={styles.bgGrid} aria-hidden="true" />
        <div className={styles.bgGlow} aria-hidden="true" />

        <div className={styles.articleContainer}>
          <nav className={styles.articleNav} aria-label={isEn ? "Breadcrumb" : "مسیر صفحه"}>
            <Link href={`/${locale}/services`} className={styles.articleBackLink}>
              <BackIcon size={14} />
              {isEn ? "All Services" : "همه خدمات"}
            </Link>
          </nav>

          <article dir={isEn ? "ltr" : "rtl"}>
            <header className={styles.articleHero}>
              <div className={styles.articleIconWrap} aria-hidden="true">
                {SERVICE_ICONS[slug]}
              </div>
              <h1 className={styles.articleTitle}>{service.h1}</h1>
              <p className={styles.articleSubtitle}>{service.description}</p>
            </header>

            <div className={styles.articleCard}>
              {/* bodyHtml is authored content from a trusted data file — not user input */}
              <div
                className={styles.prose}
                dangerouslySetInnerHTML={{ __html: service.bodyHtml }}
              />
              <footer className={styles.articleCta}>
                <Link href={`/${locale}/register`} className={styles.articleCtaButton}>
                  {isEn ? "Get Started" : "شروع ثبت‌نام"}
                  <ArrowIcon size={16} />
                </Link>
              </footer>
            </div>
          </article>
        </div>
      </main>
    </>
  );
}
