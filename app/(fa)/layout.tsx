import "../globals.css";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-en",
  display: "swap",
});

const productionUrl = "https://zarman.com.au";
const siteName = "Zarman Exchange";

// 🚀 متن‌های جدید و همگام‌سازی شده با مفاهیم نسخه فارسی
const defaultTitle = "Zarman Exchange | Premium AUD/IRT Remittance Platform";
const defaultDescription =
  "Zarman Exchange is a secure and rapid platform for AUD to IRT currency transfers. We offer dynamic exchange rates tailored to your transaction activity, ensuring you consistently receive the most competitive value. Backed by instant settlement and uncompromising regulatory compliance, we guarantee a flawless remittance experience.";

const socialPreviewImage = "/images/layout_logo.png";

export const metadata: Metadata = {
  metadataBase: new URL(productionUrl),
  title: {
    default: defaultTitle,
    template: "%s | Zarman Exchange",
  },
  description: defaultDescription,
  applicationName: siteName,
  alternates: {
    canonical: "/en",
  },
  openGraph: {
    type: "website",
    url: `${productionUrl}/en`,
    siteName,
    title: defaultTitle,
    description: defaultDescription,
    locale: "en_AU",
    images: [
      {
        url: socialPreviewImage,
        width: 1200,
        height: 630,
        alt: "Zarman Exchange | Premium AUD/IRT Remittance Platform",
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
    apple: [{ url: "/images/icon-192.png" }],
  },
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
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-screen antialiased bg-[#080B12] text-white">
        <main id="main-content">{children}</main>
      </body>
    </html>
  );
}
