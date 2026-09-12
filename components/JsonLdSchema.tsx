import { SITE_URL, organizationId, websiteId, serializeJsonLd } from "@/lib/seo";

/** Site-wide entities only. Each public page defines its own WebPage node. */
export function JsonLdSchema({ locale }: { locale: string }) {
  const isPersian = locale === "fa";
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: "Zarman Exchange",
        alternateName: ["صرافی زرمان", "زرمان اکسچنج"],
        legalName: "ZARMAN EXCHANGE PTY LTD",
        url: SITE_URL,
        logo: {
          "@type": "ImageObject",
          "@id": `${SITE_URL}/#logo`,
          url: `${SITE_URL}/images/icon-512.png`,
          width: 512,
          height: 512,
          caption: "Zarman Exchange | صرافی زرمان",
        },
        description: isPersian
          ? "صرافی زرمان، ارائه‌دهنده خدمات حواله بین استرالیا و ایران و تبدیل دلار استرالیا به تومان با نرخ‌های شخصی‌سازی‌شده."
          : "Zarman Exchange provides remittance services between Australia and Iran and AUD to Iranian toman currency exchange with personalised rates.",
        identifier: {
          "@type": "PropertyValue",
          propertyID: "Australian Business Number (ABN)",
          value: "70692742957",
          url: "https://abr.business.gov.au/ABN/View?id=70692742957",
        },
        email: "info@zarman.com.au",
        telephone: "+61497851631",
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          telephone: "+61497851631",
          email: "info@zarman.com.au",
          availableLanguage: ["Persian", "English"],
        },
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        url: SITE_URL,
        name: "Zarman Exchange",
        alternateName: "صرافی زرمان",
        inLanguage: ["fa", "en-AU"],
        publisher: { "@id": organizationId },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
    />
  );
}
