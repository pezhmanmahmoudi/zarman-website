import "@/app/globals.css";
import type { Metadata, Viewport } from "next";

const productionUrl = "https://zarman.com.au";
const siteName = "صرافی زرمان | راه حل هوشمند برای تبادل ارز";

// 🚀 دیسکریپشن واحد و استاندارد زرمان
const defaultDescription = "استارتاپ نوین برای تبادل دلار استرالیا (AUD) و تومان (IRT) با نرخ‌های هوشمند و شخصی سازی‌ شده، تسویه فوری و پایبندی کامل به استانداردهای قانونی در استرالیا.";

export const metadata: Metadata = {
  metadataBase: new URL(productionUrl),
  title: {
    default: "صرافی زرمان | ورود برای قیمت گذاری هوشمند و شخصی سازی شده",
    template: "%s | صرافی زرمان",
  },
  description: defaultDescription,
  applicationName: siteName,
  openGraph: {
    type: "website",
    siteName,
    title: "صرافی زرمان | راه حل هوشمند برای تبادل ارز",
    description: defaultDescription,
    locale: "fa_IR",
    images: [{
      url: "/images/layout-logo.png",
      width: 1200,
      height: 630,
      alt: "صرافی زرمان | پلتفرم تبادل ارز استرالیا و ایران",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "صرافی زرمان",
    description: defaultDescription,
    images: ["/images/layout-logo.png"],
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

export default function PersianRootLayout({ children }: { children: React.ReactNode }) {
  return (
    /* 🛡️ در اینجا ویژگی‌های زبان و جهت متن را به صورت اختصاصی تعریف می‌کنیم */
    <div lang="fa" dir="rtl">
      <div className="min-h-screen antialiased bg-[#080B12] text-white">
        <main id="main-content">{children}</main>
      </div>
    </div>
  );
}