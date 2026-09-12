import { Inter } from "next/font/google";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import { JsonLdSchema } from "@/components/JsonLdSchema";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import { LocaleProvider } from "@/context/LocaleContext";
import { SITE_URL, SOCIAL_IMAGE } from "@/lib/seo";

const inter = Inter({ subsets: ["latin"], variable: "--font-en", display: "swap" });

export const viewport: Viewport = {
  width: "device-width", initialScale: 1, themeColor: "#080B12",
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (locale !== "fa" && locale !== "en") notFound();
  const isEn = locale === "en";
  const brand = isEn ? "Zarman Exchange" : "صرافی زرمان";
  const description = isEn
    ? "Zarman Exchange offers money transfer services between Australia and Iran, AUD to toman quotes and support in Persian and English."
    : "خدمات صرافی زرمان برای حواله بین ایران و استرالیا، مشاهده نرخ دلار استرالیا به تومان و پشتیبانی به زبان فارسی و انگلیسی.";
  const google = process.env.NEXT_PUBLIC_GSC_VERIFICATION_TOKEN;
  const bing = process.env.NEXT_PUBLIC_BING_VERIFICATION_TOKEN;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: brand, template: `%s | ${brand}` },
    description,
    applicationName: brand,
    authors: [{ name: "Zarman Exchange Pty Ltd", url: `${SITE_URL}/${locale}/about` }],
    creator: "Zarman Exchange Pty Ltd", publisher: "Zarman Exchange Pty Ltd",
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large", "max-video-preview": -1 } },
    icons: {
      icon: [{ url: "/favicon.ico", sizes: "any" }, { url: "/images/icon-192.png", sizes: "192x192", type: "image/png" }, { url: "/images/icon-512.png", sizes: "512x512", type: "image/png" }],
      shortcut: ["/favicon.ico"], apple: [{ url: "/images/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    manifest: "/manifest.webmanifest",
    // Child pages supply their own URL, canonical and translation set.
    openGraph: { type: "website", siteName: brand, title: brand, description, locale: isEn ? "en_AU" : "fa_IR", images: [{ url: SOCIAL_IMAGE, width: 1200, height: 630, alt: "Zarman Exchange | صرافی زرمان" }] },
    twitter: { card: "summary_large_image", title: brand, description, images: [SOCIAL_IMAGE] },
    category: "finance",
    verification: { ...(google ? { google } : {}), ...(bing ? { other: { "msvalidate.01": bing } } : {}) },
  };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== "en" && locale !== "fa") notFound();
  return (
    <html lang={locale} dir={locale === "fa" ? "rtl" : "ltr"} data-scroll-behavior="smooth">
      <body className={`${inter.variable} min-h-screen antialiased bg-[#080B12] text-white`}>
        <LocaleProvider locale={locale}>
          <JsonLdSchema locale={locale} />
          <main id="main-content">{children}</main>
          <SpeedInsights />
          <Analytics />
        </LocaleProvider>
      </body>
    </html>
  );
}
