import type { Metadata } from "next";
import Link from "next/link";
import { services } from "@/data/services";
import { ArrowLeft, ArrowRight } from "lucide-react";

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
      ? "Our Services | AUD/IRT Remittance Solutions | Zarman Exchange"
      : "خدمات ما | راه‌حل‌های حواله AUD/IRT | صرافی زرمان",
    description: isEn
      ? "Explore Zarman Exchange's full range of AUD/IRT remittance services — student payments, healthcare registration fees, large capital transfers, and business payment infrastructure."
      : "خدمات کامل صرافی زرمان را کاوش کنید — پرداخت‌های دانشجویی، هزینه‌های رجیستری پزشکی، انتقال سرمایه و زیرساخت پرداخت‌های تجاری.",
    alternates: {
      canonical: `${PRODUCTION_URL}/${locale}/services`,
      languages: {
        "en-AU": `${PRODUCTION_URL}/en/services`,
        "fa-IR": `${PRODUCTION_URL}/fa/services`,
        "x-default": `${PRODUCTION_URL}/fa/services`,
      },
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

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <main>
        <header style={{ padding: "clamp(80px, 10vh, 120px) var(--container-padding) var(--space-12)", textAlign: isEn ? "left" : "right", maxWidth: "var(--container-max-width)", margin: "0 auto" }}>
          <p style={{ color: "var(--color-accent-secondary)", fontWeight: "var(--font-weight-bold)", marginBottom: "var(--space-3)" }}>
            {isEn ? "What We Offer" : "خدمات ما"}
          </p>
          <h1 style={{ fontSize: "var(--text-display-lg)", lineHeight: "var(--leading-tight)", fontWeight: "var(--font-weight-bold)", color: "var(--color-text-primary)", margin: "0 0 var(--space-4)" }}>
            {isEn
              ? "AUD/IRT Remittance Services"
              : "خدمات حواله AUD/IRT"}
          </h1>
          <p style={{ fontSize: "var(--text-body-lg)", color: "var(--color-text-secondary)", maxWidth: "600px" }}>
            {isEn
              ? "From student tuition to enterprise settlements — every cross-border payment between Australia and Iran, handled with precision and compliance."
              : "از شهریه دانشجویی تا تسویه‌های سازمانی — هر پرداخت فرامرزی بین استرالیا و ایران با دقت و انطباق کامل قانونی انجام می‌شود."}
          </p>
        </header>

        <section
          aria-label={isEn ? "Service listings" : "فهرست خدمات"}
          style={{ maxWidth: "var(--container-max-width)", margin: "0 auto", padding: "0 var(--container-padding) var(--space-24)", display: "grid", gap: "var(--space-4)", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}
        >
          {localeServices.map((service) => (
            <article
              key={service.slug}
              style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "var(--space-8)", backgroundColor: "rgba(255,255,255,0.02)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
            >
              <h2 style={{ fontSize: "var(--text-card-title)", fontWeight: "var(--font-weight-bold)", color: "var(--color-text-primary)", margin: 0 }}>
                {service.title}
              </h2>
              <p style={{ fontSize: "var(--text-body-md)", color: "var(--color-text-secondary)", margin: 0, flexGrow: 1 }}>
                {service.description}
              </p>
              <Link
                href={`/${locale}/services/${service.slug}`}
                style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", color: "var(--color-accent-secondary)", fontSize: "var(--text-body-sm)", fontWeight: "var(--font-weight-medium)", textDecoration: "none", marginTop: "var(--space-2)" }}
              >
                {isEn ? "Learn more" : "بیشتر بدانید"}
                <ArrowIcon size={14} />
              </Link>
            </article>
          ))}
        </section>
      </main>
    </>
  );
}
