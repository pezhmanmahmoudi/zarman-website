import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

// پیکربندی فونت بین‌المللی Inter برای متون و اعداد انگلیسی
// این کار باعث می‌شود فونت مستقیماً روی سرور شما هاست شود و سرعت سایت افت نکند
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-en", // ساخت متغیر CSS به صورت اتوماتیک
  display: "swap",
});

export const metadata: Metadata = {
  title: "Zarman Exchange | صرافی زرمان",
  description: "پلتفرم نوین انتقال امن، شفاف و سریع پول بین استرالیا و ایران ( AUD ↔ IRR )",
  keywords: ["صرافی استرالیا", "حواله دلار استرالیا", "زرمان اکسچنج", "انتقال پول به استرالیا"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // تزریق متغیر فونت انگلیسی به بالاترین سطح دام (html)
    <html lang="fa" dir="rtl" className={`${inter.variable}`}>
      <body className="min-h-screen antialiased bg-[#080B12] text-white">
        {/* شناسه main-content برای کارکرد صحیح دکمه "پرش به محتوای اصلی" در هدر */}
        <main id="main-content">
          {children}
        </main>
      </body>
    </html>
  );
}