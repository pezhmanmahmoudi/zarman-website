import type { MetadataRoute } from "next";
import { blogPosts, getBlogAlternatePaths } from "@/data/blog-posts";
import { services } from "@/data/services";
import { languageAlternates, locales, localizedUrl } from "@/lib/seo";

// Only canonical, indexable URLs. A build date is not a content update.
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: MetadataRoute.Sitemap = ["", "/services", "/about", "/blog", "/register"]
    .flatMap((path) => locales.map((locale) => ({
      url: localizedUrl(locale, path),
      alternates: { languages: languageAlternates(path) },
    })));
  const servicePages: MetadataRoute.Sitemap = services.map((service) => {
    const path = `/services/${service.slug}`;
    const alternatePaths = Object.fromEntries(services.filter((entry) => entry.slug === service.slug)
      .map((entry) => [entry.locale, `/services/${entry.slug}`]));
    return { url: localizedUrl(service.locale, path), alternates: { languages: languageAlternates(path, alternatePaths) } };
  });
  const articles: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: localizedUrl(post.locale, `/blog/${post.slug}`),
    lastModified: post.updatedAt ?? post.publishedAt,
    alternates: { languages: languageAlternates(`/blog/${post.slug}`, getBlogAlternatePaths(post)) },
  }));
  // Persian legal URLs redirect to the authoritative English content.
  const legal: MetadataRoute.Sitemap = ["terms", "privacy-policy", "dvs-notice", "dvs-consent"]
    .map((slug) => ({ url: localizedUrl("en", `/legal/${slug}`) }));
  return [...pages, ...servicePages, ...articles, ...legal];
}
