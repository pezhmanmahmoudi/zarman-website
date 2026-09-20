"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useLocale } from "@/context/LocaleContext";
import { dashboardCopy, dashboardTab } from "@/lib/dashboard/navigation";
import { DashboardSidebar } from "./DashboardSidebar";
import { DashboardHeader } from "./DashboardHeader";
import styles from "@/styles/dashboard/DashboardShell.module.css";

const DashboardContext = createContext<ReturnType<typeof useDashboardData> | null>(null);
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
  return <DashboardContext.Provider value={data}>
    <div className={styles.dashboardWrapper} data-theme="light" data-motion={motion ? "on" : "off"} data-private-amounts={privateAmounts} data-dashboard-shell dir={locale === "fa" ? "rtl" : "ltr"}>
      <a href="#dashboard-content" className={styles.skipLink}>{copy.skip}</a>
      <DashboardSidebar activeTab={tab} />
      <div className={styles.mainArea}>
        <DashboardHeader activeTab={tab} profile={data.profile} privateAmounts={privateAmounts} onTogglePrivacy={() => setPrivateAmounts(value => !value)} motion={motion} onToggleMotion={() => setMotion(value => !value)} />
        <div id="dashboard-content" tabIndex={-1} className={styles.content}>
          {data.error && data.sessionChecked && <div className={styles.refreshNotice} role="status"><span>{copy.refreshError}</span><button onClick={() => void data.refresh()} disabled={data.loading}>{copy.retry}</button></div>}
          {data.error && !data.sessionChecked ? <section className={styles.errorState} role="alert"><h1>{copy.loadError}</h1><button onClick={() => void data.refresh()} disabled={data.loading}><RefreshCw size={17} />{copy.retry}</button></section>
            : !data.sessionChecked ? <DashboardLoading /> : children}
        </div>
        <footer className={styles.footer}><span>Zarman Exchange</span><span><ShieldCheck size={14} aria-hidden="true" />{copy.exchange}</span></footer>
      </div>
    </div>
  </DashboardContext.Provider>;
}
