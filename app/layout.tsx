import "./globals.css";
import type { Metadata, Viewport } from "next";

const productionUrl = "https://zarman.com.au";
const socialPreviewImage = "/images/layout-logo.png";

export const metadata: Metadata = {
  metadataBase: new URL(productionUrl),
  applicationName: "Zarman Exchange",
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
    siteName: "Zarman Exchange",
    images: [
      {
        url: socialPreviewImage,
        width: 1200,
        height: 630,
        alt: "Zarman Exchange",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [socialPreviewImage],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#080B12",
};

export default function GlobalRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body className="min-h-screen antialiased bg-[#080B12] text-white">{children}</body>
    </html>
  );
}