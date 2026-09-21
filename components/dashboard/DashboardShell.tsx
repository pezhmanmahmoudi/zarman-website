"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useLocale } from "@/context/LocaleContext";
import { dashboardCopy, dashboardTab } from "@/lib/dashboard/navigation";
import { DashboardSidebar } from "./DashboardSidebar";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardMotionProvider } from "./DashboardMotion";
import styles from "@/styles/dashboard/DashboardShell.module.css";

const DashboardContext = createContext<(ReturnType<typeof useDashboardData> & { motionEnabled: boolean }) | null>(null);
export function useDashboard() {
  const value = useContext(DashboardContext);
  if (!value) throw new Error("Dashboard provider is required");
  return value;
}
export function DashboardLoading() {
  const copy = dashboardCopy[useLocale()];
  return <div className={styles.loadingState} role="status" aria-label={copy.loading}>
    <div className={styles.skeletonHeading} /><div className={styles.skeletonGrid}><div /><div /></div><div className={styles.skeletonList} />
    <span className={styles.srOnly}>{copy.loading}</span>
  </div>;
}
export function DashboardShell({ children }: { children: ReactNode }) {
  const data = useDashboardData(), locale = useLocale(), pathname = usePathname(), query = useSearchParams();
  const tab = dashboardTab(pathname, query), copy = dashboardCopy[locale];
  const [privateAmounts, setPrivateAmounts] = useState(false);
  const [motion, setMotion] = useState(true);
  return <DashboardContext.Provider value={{ ...data, motionEnabled: motion }}><DashboardMotionProvider enabled={motion}>
    <div className={styles.dashboardWrapper} data-theme="light" data-motion={motion ? "on" : "off"} data-private-amounts={privateAmounts} data-dashboard-shell dir={locale === "fa" ? "rtl" : "ltr"}>
      <a href="#dashboard-content" className={styles.skipLink}>{copy.skip}</a>
      <DashboardSidebar activeTab={tab} motionEnabled={motion} />
      <div className="flex min-h-dvh min-w-0 flex-col min-[900px]:ms-[220px] xl:ms-[248px]">
        <DashboardHeader activeTab={tab} profile={data.profile} privateAmounts={privateAmounts} onTogglePrivacy={() => setPrivateAmounts(value => !value)} motion={motion} onToggleMotion={() => setMotion(value => !value)} />
        <div id="dashboard-content" tabIndex={-1} className="mx-auto w-full max-w-[1256px] min-w-0 flex-1 px-5 py-7 outline-none sm:px-8 sm:py-9 lg:px-10">
          {data.error && data.sessionChecked && <div className={styles.refreshNotice} role="status"><span>{copy.refreshError}</span><button onClick={() => void data.refresh()} disabled={data.loading}>{copy.retry}</button></div>}
          {data.error && !data.sessionChecked ? <section className={styles.errorState} role="alert"><h1>{copy.loadError}</h1><button onClick={() => void data.refresh()} disabled={data.loading}><RefreshCw size={17} />{copy.retry}</button></section>
            : !data.sessionChecked ? <DashboardLoading /> : children}
        </div>
        <footer className="mx-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#e9ecf0] py-6 pb-28 text-xs text-[#7d8490] sm:mx-8 min-[900px]:pb-6 lg:mx-10"><span>Zarman Exchange</span><span>{copy.exchange}</span></footer>
      </div>
    </div>
  </DashboardMotionProvider></DashboardContext.Provider>;
}
