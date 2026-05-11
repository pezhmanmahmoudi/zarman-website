import type { MetadataRoute } from "next";

const productionUrl = "https://zarman.com.au";

// Use a fixed recent date for stable caching; bump this on each major deploy.
// Google treats frequently-changing lastmod on static pages as a trust signal —
// but only if the content actually changed. We therefore assign realistic dates.
const NOW = new Date();
const WEEKLY_REFRESH = new Date(NOW);
WEEKLY_REFRESH.setDate(NOW.getDate() - (NOW.getDay() === 0 ? 0 : NOW.getDay()));
WEEKLY_REFRESH.setHours(0, 0, 0, 0);

export default function sitemap(): MetadataRoute.Sitemap {
  // ── High-priority landing pages (both locales) ──────────────────────────
  const landingRoutes: MetadataRoute.Sitemap = [
    // Persian home — primary market, highest signal
    {
      url: `${productionUrl}/fa`,
      lastModified: NOW,
      changeFrequency: "daily",
      priority: 1.0,
    },
    // English home
    {
      url: `${productionUrl}/en`,
      lastModified: NOW,
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  // ── Conversion pages ─────────────────────────────────────────────────────
  const conversionRoutes: MetadataRoute.Sitemap = [
    {
      url: `${productionUrl}/fa/register`,
      lastModified: WEEKLY_REFRESH,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${productionUrl}/en/register`,
      lastModified: WEEKLY_REFRESH,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${productionUrl}/fa/login`,
      lastModified: WEEKLY_REFRESH,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${productionUrl}/en/login`,
      lastModified: WEEKLY_REFRESH,
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ];

  // ── Legal / compliance pages (trust signals for AUSTRAC context) ─────────
  const legalSlugs = [
    "terms",
    "privacy-policy",
    "dvs-notice",
    "dvs-consent",
  ];

  const legalRoutes: MetadataRoute.Sitemap = legalSlugs.flatMap((slug) => [
    {
      url: `${productionUrl}/en/legal/${slug}`,
      lastModified: new Date("2025-01-01"),
      changeFrequency: "monthly" as const,
      priority: 0.4,
    },
    {
      url: `${productionUrl}/fa/legal/${slug}`,
      lastModified: new Date("2025-01-01"),
      changeFrequency: "monthly" as const,
      priority: 0.4,
    },
  ]);

  return [...landingRoutes, ...conversionRoutes, ...legalRoutes];
}
