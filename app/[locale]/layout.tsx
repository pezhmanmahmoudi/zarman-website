import { Inter } from "next/font/google";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "../globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-en",
  display: "swap",
});

const productionUrl = "https://zarman.com.au";
const socialPreviewImage = "/images/layout-logo.png";

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
    : "ورود برای قیمت گذاری هوشمند و شخصی سازی شده | صرافی زرمان";

  const defaultDescription = isEn
    ? "Experience premium AUD/IRT remittance with Zarman Exchange. We offer dynamic, tailored exchange rates based on your transaction volume, ensuring you always receive the most competitive pricing alongside fast settlement and enterprise-grade compliance."
    : "استارتاپ نوین برای تبادل دلار استرالیا (AUD) و تومان (IRT) با نرخ‌های هوشمند و شخصی سازی‌ شده، تسویه فوری و پایبندی کامل به استانداردهای قانونی در استرالیا.";

  const titleTemplate = isEn ? "%s | Zarman Exchange" : "%s | صرافی زرمان";
  const openGraphLocale = isEn ? "en_AU" : "fa_IR";
  const altText = isEn
    ? "Zarman Exchange - Tailored AUD to IRT Remittance"
    : "صرافی زرمان | پلتفرم تبادل ارز استرالیا و ایران";

  return {
    metadataBase: new URL(productionUrl),
    title: {
      default: defaultTitle,
      template: titleTemplate,
    },
    description: defaultDescription,
    applicationName: siteName,
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/images/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/images/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      shortcut: ["/favicon.ico"],
      apple: [{ url: "/images/icon-192.png" }],
    },
    manifest: "/manifest.webmanifest",
    openGraph: {
      type: "website",
      siteName,
      title: defaultTitle,
      description: defaultDescription,
      locale: openGraphLocale,
      images: [
        {
          url: socialPreviewImage,
          width: 1200,
          height: 630,
          alt: altText,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: defaultTitle,
      description: defaultDescription,
      images: [socialPreviewImage],
    },
    alternates: {
      languages: {
        fa: "/fa",
        en: "/en",
      },
    },
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
    <html lang={locale} dir={dir}>
      <body className={`${fontClass} min-h-screen antialiased bg-[#080B12] text-white`}>
        <main id="main-content">{children}</main>
      </body>
    </html>
  );
}