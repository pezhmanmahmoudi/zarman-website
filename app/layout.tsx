import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { RateProvider } from "@/context/RateContext";
import { SpeedInsights } from "@vercel/speed-insights/next";

// پیکربندی فونت بین‌المللی Inter برای متون و اعداد انگلیسی
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-en",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Zarman Exchange Money | صرافی زرمان",
  description: "پلتفرم نوین انتقال امن، شفاف و سریع پول بین استرالیا و ایران ( AUD ↔ IRR )",
  keywords: ["صرافی استرالیا", "حواله دلار استرالیا", "زرمان اکسچنج", "انتقال پول به استرالیا"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" className={`${inter.variable}`}>
      <body className="min-h-screen antialiased bg-[#080B12] text-white">
        {/* تزریق پرووایدر برای مدیریت سراسری نرخ‌های ارز */}
        <RateProvider>
          <main id="main-content">
            {children}
          </main>
        </RateProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}