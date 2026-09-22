"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { RefreshCw, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useLocale } from "@/context/LocaleContext";
import { dashboardCopy, dashboardTab, dashboardHref } from "@/lib/dashboard/navigation";
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
        <footer className="mx-auto w-full max-w-[1256px] px-5 pb-28 pt-3 sm:px-8 min-[900px]:pb-7 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/80 bg-linear-to-br from-white/65 to-[#eaf6f5]/60 px-5 py-5 shadow-[0_8px_32px_-24px_#88749f40,inset_0_1px_0_#fff] backdrop-blur-lg sm:px-6">
            <div className="min-w-0"><p className="m-0 text-sm font-medium text-[#56436e]">{locale === "fa" ? "در هر قدم، کنار شما." : "Here for every step."}</p><p className="mb-0 mt-1.5 text-xs text-[#84748f]">{locale === "fa" ? "صرافی زرمان" : "Zarman Exchange"}<span className="mx-2 text-[#b5a6c3]" aria-hidden="true">·</span>{copy.exchange}</p></div>
            <Link href={dashboardHref(locale,"feedback")} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/90 bg-white/65 px-4 text-xs font-medium text-[#655083] no-underline transition-colors hover:bg-white"><MessageCircle size={16} aria-hidden="true"/>{locale === "fa" ? "گفتگو با زرمان" : "Talk to Zarman"}</Link>
          </div>
        </footer>
      </div>
    </div>
  </DashboardMotionProvider></DashboardContext.Provider>;
}
