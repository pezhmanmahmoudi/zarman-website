import "@/app/globals.css";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-en",
  display: "swap",
});

const productionUrl = "https://zarman.com.au";
const siteName = "Zarman Exchange";

// 🚀 تایتل و دیسکریپشن جدید با تمرکز بر "نرخ‌های شخصی‌سازی شده بر اساس حجم تراکنش"
const defaultTitle = "Zarman Exchange | Premium & Tailored AUD/IRT Remittance";
const defaultDescription =
  "Experience premium AUD/IRT remittance with Zarman Exchange. We offer dynamic, tailored exchange rates based on your transaction volume, ensuring you always receive the most competitive pricing alongside fast settlement and enterprise-grade compliance.";

const socialPreviewImage = "/images/Logo-v3.png";

export const metadata: Metadata = {
  metadataBase: new URL(productionUrl),
  title: {
    default: defaultTitle,
    template: "%s | Zarman Exchange",
  },
  description: defaultDescription,
  applicationName: siteName,
  openGraph: {
    type: "website",
    siteName,
    title: defaultTitle,
    description: defaultDescription,
    locale: "en_AU",
    images: [
      {
        url: socialPreviewImage,
        width: 1200,
        height: 630,
        alt: "Zarman Exchange - Tailored AUD to IRT Remittance",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: [socialPreviewImage],
  },
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }],
    shortcut: ["/favicon.ico"],
    // 🛠️ اصلاح: استفاده از فرمت استاندارد png برای دستگاه‌های اپل
    apple: [{ url: "/images/icon-192.png" }], 
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#080B12",
};

export default function EnglishRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr" className={`${inter.variable}`}>
      <body className="min-h-screen antialiased bg-[#080B12] text-white">
        <main id="main-content">{children}</main>
      </body>
    </html>
  );
}