import type { Metadata } from "next";

import { getPageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isEn = locale === "en";
  return getPageMetadata({
    locale,
    path: "/register",
    title: isEn ? "Create Your Account" : "ایجاد حساب کاربری",
    description: isEn ? "Create your Zarman account to request a personalised Australian dollar to toman exchange rate, complete identity verification and track transfer requests." : "برای درخواست نرخ شخصی‌سازی‌شده دلار استرالیا به تومان، تکمیل احراز هویت و پیگیری درخواست‌های حواله در زرمان حساب کاربری ایجاد کنید.",
  });
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
