import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { RateProvider } from "@/context/RateContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-en",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://zarman.com.au"),
  title: {
    default: "Zarman Exchange | Safe Money Transfer Australia to Iran",
    template: "%s | Zarman Exchange",
  },
  description:
    "Secure, transparent, and fast money transfer platform between Australia and Iran. AUD to IRR exchange with competitive rates.",
  keywords: [
    "money transfer Australia",
    "remittance to Iran",
    "currency exchange AUD IRR",
    "zarman exchange",
    "send money Australia Iran",
  ],
  authors: [{ name: "Zarman Exchange Pty Ltd" }],
  creator: "Zarman Exchange",
  publisher: "Zarman Exchange",
  formatDetection: {
    email: false,
    telephone: false,
    address: false,
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/favicon.ico",
  },
  openGraph: {
    type: "website",
    locale: "fa_IR",
    alternateLocale: ["en_US"],
    url: "https://zarman.com.au",
    siteName: "Zarman Exchange",
    title: "Zarman Exchange | Safe Money Transfer Australia to Iran",
    description:
      "Secure, transparent, and fast money transfer platform between Australia and Iran. AUD ↔ IRR exchange.",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "Zarman Exchange - Money Transfer Platform",
        type: "image/png",
      },
       {
        url: "/images/og-image-square.png",
        width: 800,
        height: 800,
        alt: "Zarman Exchange Logo",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Zarman Exchange | Safe Money Transfer",
    description:
      "Fast, secure money transfer from Australia to Iran with competitive rates.",
    creator: "@zarmanexchange",
    images: ["/images/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
    },
  },
  verification: {
    google: "YOUR_GOOGLE_VERIFICATION_CODE",
    yandex: "YOUR_YANDEX_VERIFICATION_CODE",
  },
  alternates: {
    canonical: "/",
    languages: {
      fa: "/",
      en: "/en/",
      "x-default": "/",
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" className={`${inter.variable}`}>
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
          crossOrigin="anonymous"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <RateProvider>
          <main id="main-content">{children}</main>
        </RateProvider>
      </body>
    </html>
  );
}
