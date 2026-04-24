import type { MetadataRoute } from "next";

const productionUrl = "https://zarman.com.au";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // صفحات اصلی با اولویت بالا
  const mainRoutes = [
    { url: "/fa", priority: 1, changeFrequency: "daily" as const }, // آدرس اصلی فارسی
    { url: "/fa/register", priority: 0.9, changeFrequency: "weekly" as const },
    { url: "/fa/login", priority: 0.8, changeFrequency: "weekly" as const },
  ];

  // صفحات قانونی با اولویت پایین‌تر
  const legalRoutes = [
    "/en/legal/terms",
    "/en/legal/privacy-policy",
    "/en/legal/dvs-notice",
    "/en/legal/dvs-consent",
  ].map(path => ({
    url: path,
    priority: 0.5,
    changeFrequency: "monthly" as const,
  }));

  return [...mainRoutes, ...legalRoutes].map((route) => ({
    url: `${productionUrl}${route.url}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}