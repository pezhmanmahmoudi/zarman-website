/**
 * JsonLdSchema — Server Component
 * Injects combined Organization + FinancialService structured data.
 * Critical for Google AI Overviews, Knowledge Panel, and rich snippets.
 */

const PRODUCTION_URL = "https://zarman.com.au";
const SITE_CONTENT_LAST_MODIFIED = "2026-05-01";

interface JsonLdSchemaProps {
  locale: string;
}

export function JsonLdSchema({ locale }: JsonLdSchemaProps) {
  const isPersian = locale === "fa";

  const organizationSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["Organization", "FinancialService"],
        "@id": `${PRODUCTION_URL}/#organization`,
        name: "Zarman Exchange",
        alternateName: [
          "صرافی زرمان",
          "Zarmanex",
          "Zarman Exchange Pty Ltd",
          "زرمان اکسچنج",
        ],
        legalName: "Zarman Exchange Pty Ltd",
        url: PRODUCTION_URL,
        logo: {
          "@type": "ImageObject",
          "@id": `${PRODUCTION_URL}/#logo`,
          url: `${PRODUCTION_URL}/images/icon-512.png`,
          width: 512,
          height: 512,
          caption: "Zarman Exchange",
        },
        image: {
          "@id": `${PRODUCTION_URL}/#logo`,
        },
        description: isPersian
          ? "صرافی زرمان، پلتفرم آنلاین تبادل دلار استرالیا (AUD) به تومان ایران (IRT) با نرخ‌های هوشمند و شخصی‌سازی‌شده. ثبت‌شده نزد AUSTRAC در استرالیا (ABN: 70 692 742 957)."
          : "Zarman Exchange is an AUSTRAC-registered fintech remittance platform specialising in AUD to IRT (Iranian Toman) transfers with dynamic, volume-based exchange rates and enterprise-grade compliance. ABN: 70 692 742 957.",
        foundingLocation: {
          "@type": "Country",
          name: "Australia",
        },
        address: {
          "@type": "PostalAddress",
          addressCountry: "AU",
        },
        areaServed: [
          {
            "@type": "Country",
            name: "Australia",
            sameAs: "https://www.wikidata.org/wiki/Q408",
          },
          {
            "@type": "Country",
            name: "Iran",
            sameAs: "https://www.wikidata.org/wiki/Q794",
          },
        ],
        serviceType: "International Money Transfer and Currency Exchange",
        knowsAbout: [
          "AUD to IRT remittance",
          "AUD to Toman exchange",
          "Money transfer Australia to Iran",
          "حواله دلار استرالیا به ایران",
          "تبادل ارز AUD به تومان",
              "صرافی زرمان",
            "صرافی آنلاین استرالیا",
            "حواله به ایران از استرالیا",
            "انتقال پول از استرالیا به ایران",
            "ارسال پول به ایران",
            "نرخ دلار استرالیا به تومان",
            "نرخ ارز AUD به IRT",
            "بهترین صرافی استرالیا",
            "حواله دلار استرالیا",
            "صرافی معتبر استرالیا",
            "ارسال حواله به ایران",
            "تبادل ارز دلار استرالیا",
            "نرخ تبادل دلار استرالیا به تومان امروز",
            "صرافی ثبت شده استرالیا",
            "خدمات حواله ایرانی در استرالیا",
            "ارز AUD به تومان",
            "پلتفرم تبادل ارز استرالیا و ایران",
        ],
        currenciesAccepted: "AUD, IRT",
        identifier: [
          {
            "@type": "PropertyValue",
            name: "ABN",
            value: "70 692 742 957",
          },
          {
            "@type": "PropertyValue",
            name: "AUSTRAC Registration",
            value: "Registered Remittance Dealer — Australian Transaction Reports and Analysis Centre",
          },
        ],
        hasCredential: {
          "@type": "EducationalOccupationalCredential",
          credentialCategory: "Regulatory License",
          name: "AUSTRAC Remittance Dealer Registration",
          recognizedBy: {
            "@type": "Organization",
            name: "Australian Transaction Reports and Analysis Centre (AUSTRAC)",
            url: "https://www.austrac.gov.au",
          },
        },
        sameAs: [
          "https://www.linkedin.com/company/zarman-exchange",
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${PRODUCTION_URL}/#website`,
        url: PRODUCTION_URL,
        name: "Zarman Exchange | صرافی زرمان",
        description: isPersian
          ? "پلتفرم تبادل ارز دلار استرالیا و تومان ایران"
          : "AUD to IRT remittance platform — Australia to Iran",
        inLanguage: ["en-AU", "fa-IR"],
        publisher: {
          "@id": `${PRODUCTION_URL}/#organization`,
        },
        potentialAction: {
          "@type": "RegisterAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${PRODUCTION_URL}/fa/register`,
            description: "ثبت‌نام برای دریافت نرخ شخصی‌سازی‌شده | Register for a personalised rate",
          },
        },
      },
      {
        "@type": "WebPage",
        "@id": `${PRODUCTION_URL}/${locale}/#webpage`,
        url: `${PRODUCTION_URL}/${locale}`,
        name: isPersian
          ? "صرافی زرمان | ارسال حواله از استرالیا به ایران"
          : "Zarman Exchange | AUD to IRT Remittance",
        description: isPersian
          ? "بهترین نرخ تبادل دلار استرالیا به تومان. ثبت‌شده در AUSTRAC. انتقال امن و سریع پول از استرالیا به ایران."
          : "Best AUD to IRT exchange rate. AUSTRAC registered. Secure and fast money transfer from Australia to Iran.",
        datePublished: "2024-01-01",
        dateModified: new Date().toISOString().split("T")[0],
        inLanguage: locale === "fa" ? "fa-IR" : "en-AU",
        isPartOf: {
          "@id": `${PRODUCTION_URL}/#website`,
        },
        about: {
          "@id": `${PRODUCTION_URL}/#organization`,
        },
        primaryImageOfPage: {
          "@type": "ImageObject",
          url: `${PRODUCTION_URL}/images/layout-logo.png`,
          width: 1200,
          height: 630,
        },
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: isPersian ? "خانه | صرافی زرمان" : "Home | Zarman Exchange",
              item: `${PRODUCTION_URL}/${locale}`,
            },
          ],
        },
        dateModified: SITE_CONTENT_LAST_MODIFIED,
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
    />
  );
}
