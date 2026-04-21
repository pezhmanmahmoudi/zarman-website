import "../globals.css";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-en",
  display: "swap",
});

const productionUrl = "https://zarman.com.au";
const siteName = "صرافی زرمان";

// 🚀 متن‌های جدید و همگام‌سازی شده با مفاهیم نسخه فارسی
const defaultTitle = "صرافی زرمان | استارتاپ مالی خرید و فروش دلار استرالیا";
const defaultDescription =
  "صرافی زرمان، پلتفرمی امن و سریع برای تبادل دلار استرالیا (AUD) و تومان (IRT) است. در زرمان، نرخهای تبادل بهصورت پویا و بر اساس میزان فعالیت شما محاسبه میشوند تا همواره بهصرفهترین پیشنهاد را دریافت کنید. تسویه فوری و پایبندیِ بیقیدوشرط به استانداردهای قانونی، تضمینِ ما برای خلق تجربهای مطمئن و بینقص در جابجایی ارز است.";

const socialPreviewImage = "/images/layout_logo.png";

export const metadata: Metadata = {
  metadataBase: new URL(productionUrl),
  title: {
    default: defaultTitle,
    template: "%s | صرافی زرمان",
  },
  description: defaultDescription,
  applicationName: siteName,
  openGraph: {
    type: "website",
    siteName,
    title: defaultTitle,
    description: defaultDescription,
    locale: "fa_IR",
    images: [
      {
        url: socialPreviewImage,
        width: 1200,
        height: 630,
        alt: "صرافی زرمان | استارتاپ مالی خرید و فروش دلار استرالیا",
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
    <html lang="fa" dir="rtl" className={`${inter.variable}`}>
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
