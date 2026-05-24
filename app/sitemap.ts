import type { MetadataRoute } from "next";
import { blogPosts } from "@/data/blog-posts";
import { services } from "@/data/services";

const productionUrl = "https://zarman.com.au";

// ── Pinned content-change dates ──────────────────────────────────────────────
// Home pages serve live rate data so "daily" + current date is legitimate.
// All other static pages use a pinned date — bump LAST_CONTENT_UPDATE manually
// when you make a meaningful content change. This prevents Google from treating
// every build as a content change (a known spam signal for stable pages).
const LAST_CONTENT_UPDATE = new Date("2026-05-01");
const LAST_REGISTRATION_UPDATE = new Date("2025-10-01");

export default function sitemap(): MetadataRoute.Sitemap {
  // ── High-priority landing pages (both locales) ──────────────────────────
  // Home pages contain a live rate widget — daily lastModified is honest here.
  const landingRoutes: MetadataRoute.Sitemap = [
    {
      url: `${productionUrl}/fa`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${productionUrl}/en`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  // ── Service landing pages (high commercial intent) ────────────────────────
  const serviceRoutes: MetadataRoute.Sitemap = services.map((s) => ({
    url: `${productionUrl}/${s.locale}/services/${s.slug}`,
    lastModified: LAST_CONTENT_UPDATE,
    changeFrequency: "monthly" as const,
    priority: 0.85,
  }));

  const serviceIndexRoutes: MetadataRoute.Sitemap = [
    { url: `${productionUrl}/en/services`, lastModified: LAST_CONTENT_UPDATE, changeFrequency: "monthly" as const, priority: 0.8 },
    { url: `${productionUrl}/fa/services`, lastModified: LAST_CONTENT_UPDATE, changeFrequency: "monthly" as const, priority: 0.8 },
  ];

  // ── Conversion pages (register only — login/auth are noindex) ────────────
  const conversionRoutes: MetadataRoute.Sitemap = [
    {
      url: `${productionUrl}/fa/register`,
      lastModified: LAST_REGISTRATION_UPDATE,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${productionUrl}/en/register`,
      lastModified: LAST_REGISTRATION_UPDATE,
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];

  // ── About / Compliance page (E-E-A-T trust signal) ──────────────────────
  const aboutRoutes: MetadataRoute.Sitemap = [
    {
      url: `${productionUrl}/en/about`,
      lastModified: LAST_CONTENT_UPDATE,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },
    {
      url: `${productionUrl}/fa/about`,
      lastModified: LAST_CONTENT_UPDATE,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },
  ];

  // ── Legal / compliance pages (trust signals for AUSTRAC context) ─────────
  const legalSlugs = [
    "terms",
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

  // ── Blog listing pages ────────────────────────────────────────────────────
  // lastModified = the most recent article's publishedAt date, so it's honest.
  const latestBlogDate = blogPosts.reduce<Date>((latest, post) => {
    const d = new Date(post.publishedAt);
    return d > latest ? d : latest;
  }, new Date("2020-01-01"));

  const blogListingRoutes: MetadataRoute.Sitemap = [
    {
      url: `${productionUrl}/en/blog`,
      lastModified: latestBlogDate,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    },
    {
      url: `${productionUrl}/fa/blog`,
      lastModified: latestBlogDate,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    },
  ];

  // ── Blog articles — derived from data source, never hardcoded ────────────
  const blogArticleRoutes: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${productionUrl}/${post.locale}/blog/${post.slug}`,
    lastModified: new Date(post.publishedAt),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [
    ...landingRoutes,
    ...serviceIndexRoutes,
    ...serviceRoutes,
    ...conversionRoutes,
    ...aboutRoutes,
    ...blogListingRoutes,
    ...blogArticleRoutes,
    ...legalRoutes,
  ];
}
