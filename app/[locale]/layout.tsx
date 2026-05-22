import { Inter } from "next/font/google";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import { JsonLdSchema } from "@/components/JsonLdSchema";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-en",
  display: "swap",
});

const productionUrl = "https://zarman.com.au";
const socialPreviewImage = `${productionUrl}/images/layout-logo.png`;
// Set NEXT_PUBLIC_GSC_VERIFICATION_TOKEN in .env.local with your Google Search Console token.
// Never hardcode the token directly in source — keep it in the environment.
const gscToken = process.env.NEXT_PUBLIC_GSC_VERIFICATION_TOKEN ?? "";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#080B12",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isEn = locale === "en";

  const siteName = isEn
    ? "Zarman Exchange"
    : "صرافی زرمان | راه حل هوشمند برای تبادل ارز";

  const defaultTitle = isEn
    ? "Zarman Exchange | Premium & Tailored AUD/IRT Remittance"
    : siteName;

  const defaultDescription = isEn
    ? "Experience premium AUD/IRT remittance with Zarman Exchange. We offer dynamic, tailored exchange rates based on your transaction volume, ensuring you always receive the most competitive pricing alongside fast settlement and enterprise-grade compliance."
    : "استارتاپ نوین برای تبادل دلار استرالیا (AUD) و تومان (IRT) با نرخ‌های هوشمند و شخصی سازی‌ شده، تسویه فوری و پایبندی کامل به استانداردهای قانونی در استرالیا.";

  const titleTemplate = isEn ? "%s | Zarman Exchange" : "%s | صرافی زرمان";
  const openGraphLocale = isEn ? "en_AU" : "fa_IR";
  const altText = isEn
    ? "Zarman Exchange - Tailored AUD to IRT Remittance"
    : "صرافی زرمان | پلتفرم تبادل ارز استرالیا و ایران";

  const keywordsEn = [
    "Zarman Exchange",
    "Zarman Money Exchange",
    "Australia Iran money transfer",
    "AUD to IRT exchange rate",
    "AUD to Toman exchange",
    "send money Australia to Iran",
    "AUSTRAC registered remittance Australia",
    "Iranian remittance service Australia",
    "secure money transfer Australia Iran",
    "best exchange rate Australia Iran",
    "AUD IRT exchange rate today",
    "online currency exchange Australia",
    "remittance fintech Australia",
  ];

  const keywordsFa = [
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
  ];

  const keywords = isEn
    ? keywordsEn
    : [...keywordsFa, ...keywordsEn];

  return {
    metadataBase: new URL(productionUrl),
    title: {
      default: defaultTitle,
      template: titleTemplate,
    },
    description: defaultDescription,
    applicationName: siteName,
    keywords,
    authors: [{ name: "Zarman Exchange Pty Ltd", url: productionUrl }],
    creator: "Zarman Exchange Pty Ltd",
    publisher: "Zarman Exchange Pty Ltd",
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-snippet": -1,
        "max-image-preview": "large",
        "max-video-preview": -1,
      },
    },
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/images/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/images/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      shortcut: ["/favicon.ico"],
      apple: [
        { url: "/images/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      ],
    },
    manifest: "/manifest.webmanifest",
    openGraph: {
      type: "website",
      url: `${productionUrl}/${locale}`,
      siteName,
      title: defaultTitle,
      description: defaultDescription,
      locale: openGraphLocale,
      alternateLocale: isEn ? "fa_IR" : "en_AU",
      images: [
        {
          url: socialPreviewImage,
          width: 1200,
          height: 630,
          alt: altText,
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@zarmanexchange",
      creator: "@zarmanexchange",
      title: defaultTitle,
      description: defaultDescription,
      images: [{ url: socialPreviewImage, alt: altText }],
    },
    category: "finance",
    ...(gscToken ? { verification: { google: gscToken } } : {}),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (locale !== "en" && locale !== "fa") {
    notFound();
  }

  const dir = locale === "fa" ? "rtl" : "ltr";
  const fontClass = locale === "en" ? inter.variable : "";

  return (
    <html lang={locale} dir={dir} data-scroll-behavior="smooth">
      <body className={`${fontClass} min-h-screen antialiased bg-[#080B12] text-white`}>
        <JsonLdSchema locale={locale} />
        <main id="main-content">{children}</main>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}