import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import MarketProviders from "@/components/providers/MarketProviders";
import { getRatesSnapshot } from "@/lib/rates";
import { getFinanceConfig } from "@/lib/finance-config";
import { Suspense } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardLoading } from "@/components/dashboard/DashboardLoading";
import styles from "@/styles/dashboard/DashboardShell.module.css";

export const viewport: Viewport = { themeColor: "#f7f7fb", colorScheme: "light" };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === "fa" ? "پنل کاربری" : "Your dashboard",
    description: locale === "fa" ? "مدیریت و پیگیری انتقال‌های شما" : "Manage and track your transfers.",
    robots: { index: false, follow: false },
  };
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <div className={styles.dashboardSurface} data-dashboard-surface><Suspense fallback={<DashboardLoading fullPage />}><DashboardBootstrap>{children}</DashboardBootstrap></Suspense></div>;
}

async function DashboardBootstrap({ children }: { children: ReactNode }) {
  const [rateSnapshot, financeConfig] = await Promise.all([
    getRatesSnapshot(),
    getFinanceConfig(),
  ]);

  return (
    <MarketProviders initialData={rateSnapshot} initialFinanceConfig={financeConfig} withSmoothScroll={false}>
      <Suspense fallback={<DashboardLoading fullPage />}><DashboardShell>{children}</DashboardShell></Suspense>
    </MarketProviders>
  );
}
