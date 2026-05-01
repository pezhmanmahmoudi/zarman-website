import type { ReactNode } from "react";
import type { Metadata } from "next"; // 👈 اضافه شدن ابزار سئو
import MarketProviders from "@/components/providers/MarketProviders";
import { getRatesSnapshot } from "@/lib/rates";

// 🚀 سئوی اختصاصی و امنیتی داشبورد
export const metadata: Metadata = {
  title: "پنل کاربری", // در تب مرورگر می‌شود: پنل کاربری | صرافی زرمان
  description: "مدیریت تراکنش‌ها و درخواست حواله‌های ارزی با قیمت اختصاصی",
  robots: {
    index: false,  // 🛡️ بسیار مهم: جلوگیری قطعی از ایندکس شدن پنل خصوصی کاربران در گوگل
    follow: false, // جلوگیری از دنبال کردن لینک‌های داخل داشبورد توسط خزنده‌ها
  },
};

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const rateSnapshot = await getRatesSnapshot();

  return (
    <MarketProviders initialData={rateSnapshot} withSmoothScroll={false}>
      {children}
    </MarketProviders>
  );
}