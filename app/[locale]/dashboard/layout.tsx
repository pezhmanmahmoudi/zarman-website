import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import MarketProviders from "@/components/providers/MarketProviders";
import { getRatesSnapshot } from "@/lib/rates";
import { getFinanceConfig } from "@/lib/finance-config";
import { Suspense } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardLoading } from "@/components/dashboard/DashboardLoading";
import { createSupabaseServerComponentClient } from "@/lib/supabase-server";
import { readApprovedSummary, type DashboardInitialAccount } from "@/lib/dashboard/approved-summary";
import type { Profile } from "./dashboard.types";
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
  const [rateSnapshot, financeConfig, initialAccount] = await Promise.all([
    getRatesSnapshot(),
    getFinanceConfig(),
    readInitialAccount(),
  ]);

  return (
    <MarketProviders initialData={rateSnapshot} initialFinanceConfig={financeConfig} withSmoothScroll={false}>
      <Suspense fallback={<DashboardLoading fullPage />}><DashboardShell initialAccount={initialAccount}>{children}</DashboardShell></Suspense>
    </MarketProviders>
  );
}

/** Server-rendered account so the dashboard arrives with data; the client hook loads it itself when this returns null. */
async function readInitialAccount(): Promise<DashboardInitialAccount | null> {
  try {
    const supabase = await createSupabaseServerComponentClient();
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;
    if (!userId) return null;
    const [profileRes, approved] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      readApprovedSummary(supabase, userId),
    ]);
    if (profileRes.error || !profileRes.data) return null;
    return { profile: profileRes.data as Profile, approved };
  } catch {
    return null;
  }
}
