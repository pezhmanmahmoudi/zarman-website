import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { services } from "@/data/services";

const PRODUCTION_URL = "https://zarman.com.au";

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
        en: `${PRODUCTION_URL}/en/services/${slug}`,
        fa: `${PRODUCTION_URL}/fa/services/${slug}`,
        "x-default": `${PRODUCTION_URL}/fa/services/${slug}`,
      },
    },
    openGraph: {
      title: service.metaTitle,
      description: service.metaDescription,
      url: `${PRODUCTION_URL}/${locale}/services/${slug}`,
      type: "website",
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

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.title,
    description: service.description,
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
      <main>
        <div
          style={{
            maxWidth: "var(--container-max-width)",
            margin: "0 auto",
            padding: "clamp(80px, 10vh, 120px) var(--container-padding) var(--space-24)",
          }}
        >
          {/* Back link */}
          <nav aria-label={isEn ? "Breadcrumb" : "مسیر صفحه"} style={{ marginBottom: "var(--space-8)" }}>
            <Link
              href={`/${locale}/services`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-2)",
                color: "var(--color-text-secondary)",
                fontSize: "var(--text-body-sm)",
                textDecoration: "none",
              }}
            >
              <BackIcon size={14} />
              {isEn ? "All Services" : "همه خدمات"}
            </Link>
          </nav>

          <article dir={isEn ? "ltr" : "rtl"} style={{ textAlign: isEn ? "left" : "right" }}>
            <header style={{ marginBottom: "var(--space-12)" }}>
              <h1
                style={{
                  fontSize: "var(--text-display-lg)",
                  lineHeight: "var(--leading-tight)",
                  fontWeight: "var(--font-weight-bold)",
                  color: "var(--color-text-primary)",
                  margin: "0 0 var(--space-4)",
                }}
              >
                {service.h1}
              </h1>
              <p
                style={{
                  fontSize: "var(--text-body-lg)",
                  color: "var(--color-text-secondary)",
                  maxWidth: "680px",
                  margin: 0,
                }}
              >
                {service.description}
              </p>
            </header>

            {/* Body content — hardcoded HTML from data file, never user input */}
            <div
              className="prose-zarman"
              dangerouslySetInnerHTML={{ __html: service.bodyHtml }}
            />

            {/* CTA */}
            <footer style={{ marginTop: "var(--space-16)", paddingTop: "var(--space-8)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <Link
                href={`/${locale}/register`}
                style={{
                  display: "inline-block",
                  padding: "var(--space-3) var(--space-8)",
                  backgroundColor: "var(--color-accent-primary)",
                  color: "#fff",
                  borderRadius: "8px",
                  fontWeight: "var(--font-weight-bold)",
                  fontSize: "var(--text-body-md)",
                  textDecoration: "none",
                }}
              >
                {isEn ? "Get Started" : "شروع ثبت‌نام"}
              </Link>
            </footer>
          </article>
        </div>
      </main>
    </>
  );
}
