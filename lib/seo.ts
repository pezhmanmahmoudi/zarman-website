import type { Metadata } from "next";

// Production serves www; canonical URLs must resolve without a hostname redirect.
export const SITE_URL = "https://www.zarman.com.au";
export const locales = ["fa", "en"] as const;
export type SiteLocale = (typeof locales)[number];
export const organizationId = `${SITE_URL}/#organization`;
export const websiteId = `${SITE_URL}/#website`;
export const SOCIAL_IMAGE = `${SITE_URL}/images/layout-logo.png`;

export function localizedUrl(locale: string, path = "") {
  return `${SITE_URL}/${locale}${path === "/" ? "" : path}`;
}

export function languageAlternates(
  path = "",
  alternatePaths: Partial<Record<SiteLocale, string>> = { fa: path, en: path },
): Record<string, string> {
  const languages: Record<string, string> = {};
  if (alternatePaths.fa !== undefined) languages.fa = localizedUrl("fa", alternatePaths.fa);
  if (alternatePaths.en !== undefined) {
    languages.en = localizedUrl("en", alternatePaths.en);
    languages["en-AU"] = languages.en;
  }
  const fallback = languages.fa ?? languages.en;
  if (fallback) languages["x-default"] = fallback;
  return languages;
}

interface PageMetadataOptions {
  locale: string;
  path: string;
  title: string;
  description: string;
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
  alternatePaths?: Partial<Record<SiteLocale, string>>;
}

export function getPageMetadata({
  locale, path, title, description, type = "website", publishedTime, modifiedTime, alternatePaths,
}: PageMetadataOptions): Metadata {
  const isEn = locale === "en";
  const brand = isEn ? "Zarman Exchange" : "صرافی زرمان";
  const fullTitle = /Zarman|زرمان/i.test(title) ? title : `${title} | ${brand}`;
  const url = localizedUrl(locale, path);
  const languages = languageAlternates(path, alternatePaths);
  const image = { url: SOCIAL_IMAGE, width: 1200, height: 630, alt: "Zarman Exchange | صرافی زرمان", type: "image/png" };
  return {
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: url, languages },
    openGraph: {
      type, url, siteName: brand, title: fullTitle, description,
      locale: isEn ? "en_AU" : "fa_IR",
      ...(languages.fa && languages.en ? { alternateLocale: [isEn ? "fa_IR" : "en_AU"] } : {}),
      images: [image],
      ...(type === "article" ? { publishedTime, modifiedTime, authors: [localizedUrl(locale, "/about")] } : {}),
    },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [{ url: image.url, alt: image.alt }] },
  };
}

/** Keep embedded data inert even when future editorial content contains HTML. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
