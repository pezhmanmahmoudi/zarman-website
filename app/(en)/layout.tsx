import "../globals.css";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { RateProvider } from "@/context/RateContext";
import SmoothScrollProvider from "@/components/providers/SmoothScrollProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-en",
  display: "swap",
});

const productionUrl = "https://zarman.com.au";
const siteName = "Zarman Exchange";
const defaultTitle = "Zarman Exchange | Premium AUD/IRT Remittance Platform";
const defaultDescription =
  "Zarman Exchange is a premium AUD/IRT remittance service that helps Australians send funds to Iran with transparent rates, fast settlement, and enterprise-grade compliance confidence.";
const socialPreviewImage = "/images/Logo-v3.png";

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
        alt: "Zarman Exchange premium AUD/IRT remittance platform",
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
    apple: [{ url: "/favicon.ico" }],
  },
  manifest: "/site.webmanifest",
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
        <SmoothScrollProvider>
          <RateProvider>
            <main id="main-content">{children}</main>
          </RateProvider>
        </SmoothScrollProvider>
      </body>
    </html>
  );
}