import type { ReactNode } from "react";
import type { Metadata } from "next";
import MarketProviders from "@/components/providers/MarketProviders";
import { getRatesSnapshot } from "@/lib/rates";
import { getFinanceConfig } from "@/lib/finance-config";
import { Suspense } from "react";
import { DashboardShell, DashboardLoading } from "@/components/dashboard/DashboardShell";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === "fa" ? "پنل کاربری" : "Your dashboard",
    description: locale === "fa" ? "مدیریت و پیگیری انتقال‌های شما" : "Manage and track your transfers.",
    robots: { index: false, follow: false },
  };
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const [rateSnapshot, financeConfig] = await Promise.all([
    getRatesSnapshot(),
    getFinanceConfig(),
  ]);

  return (
    <MarketProviders initialData={rateSnapshot} initialFinanceConfig={financeConfig} withSmoothScroll={false}>
      <Suspense fallback={<DashboardLoading />}><DashboardShell>{children}</DashboardShell></Suspense>
    </MarketProviders>
  );
}
