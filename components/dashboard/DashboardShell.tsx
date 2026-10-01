"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { RefreshCw, BotMessageSquare } from "lucide-react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useLocale } from "@/context/LocaleContext";
import { dashboardCopy, dashboardTab } from "@/lib/dashboard/navigation";
import { DashboardSidebar } from "./DashboardSidebar";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardMotionProvider } from "./DashboardMotion";
import { DashboardLoading } from "./DashboardLoading";
import { DashboardMessageChime } from "./DashboardMessageChime";
export { DashboardLoading } from "./DashboardLoading";
import styles from "@/styles/dashboard/DashboardShell.module.css";

const DashboardContext = createContext<(ReturnType<typeof useDashboardData> & { motionEnabled: boolean }) | null>(null);
const SOUND_KEY = "zarman:dashboard:message-sound";
export function useDashboard() {
  const value = useContext(DashboardContext);
  if (!value) throw new Error("Dashboard provider is required");
  return value;
}
export function DashboardShell({ children }: { children: ReactNode }) {
  const data = useDashboardData(), locale = useLocale(), pathname = usePathname(), query = useSearchParams();
  const tab = dashboardTab(pathname, query), copy = dashboardCopy[locale];
  const [privateAmounts, setPrivateAmounts] = useState(false);
  const [motion, setMotion] = useState(true);
  const [sound, setSound] = useState(true);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the saved choice only exists in the browser
  useEffect(() => { setSound(window.localStorage.getItem(SOUND_KEY) !== "off"); }, []);
  function toggleSound() {
    setSound(value => { window.localStorage.setItem(SOUND_KEY, value ? "off" : "on"); return !value; });
  }
  if (!data.sessionChecked && !data.error) return <DashboardMotionProvider enabled={motion}><DashboardLoading fullPage /></DashboardMotionProvider>;
  return <DashboardContext.Provider value={{ ...data, motionEnabled: motion }}><DashboardMotionProvider enabled={motion}>
    <div className={styles.dashboardWrapper} data-theme="light" data-motion={motion ? "on" : "off"} data-private-amounts={privateAmounts} data-dashboard-shell dir={locale === "fa" ? "rtl" : "ltr"}>
      <a href="#dashboard-content" className={styles.skipLink}>{copy.skip}</a>
      <DashboardSidebar activeTab={tab} motionEnabled={motion} />
      <div className="flex min-h-dvh min-w-0 flex-col min-[900px]:ms-[220px] xl:ms-[248px]">
        <DashboardHeader activeTab={tab} profile={data.profile} privateAmounts={privateAmounts} onTogglePrivacy={() => setPrivateAmounts(value => !value)} motion={motion} onToggleMotion={() => setMotion(value => !value)} sound={sound} onToggleSound={toggleSound} />
        {data.sessionChecked && data.profile && <DashboardMessageChime locale={locale} sound={sound} />}
        <div id="dashboard-content" tabIndex={-1} className="mx-auto w-full max-w-[1256px] min-w-0 flex-1 px-5 py-7 outline-none sm:px-8 sm:py-9 lg:px-10">
          {data.error && data.sessionChecked && <div className={styles.refreshNotice} role="status"><span>{copy.refreshError}</span><button onClick={() => void data.refresh()} disabled={data.loading}>{copy.retry}</button></div>}
          {data.error && !data.sessionChecked ? <section className={styles.errorState} role="alert"><h1>{copy.loadError}</h1><button onClick={() => void data.refresh()} disabled={data.loading}><RefreshCw size={17} />{copy.retry}</button></section>
            : !data.sessionChecked ? <DashboardLoading /> : children}
        </div>
        <footer className="mx-auto w-full max-w-[1256px] px-5 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] pt-3 sm:px-8 min-[900px]:pb-7 lg:px-10">
          <div className="flex min-w-0 flex-col items-stretch gap-4 rounded-3xl border border-white/80 bg-linear-to-br from-white/65 to-[#eaf6f5]/60 p-5 shadow-[0_8px_32px_-24px_#88749f40,inset_0_1px_0_#fff] backdrop-blur-lg sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-6">
            <div className="min-w-0 sm:flex-1 sm:basis-60"><p className="m-0 text-pretty text-sm font-semibold leading-7 text-[#56436e]">{locale === "fa" ? "زرمان؛ راهکاری هوشمند برای تبادل ارز" : "Zarman; The smart way to exchange currency"}</p><p className="mb-0 mt-1.5 text-xs leading-5 text-[#84748f]">{copy.exchange}</p></div>
            <button type="button" disabled aria-disabled="true" className="inline-flex min-h-12 w-full min-w-0 cursor-default items-center justify-center gap-2 rounded-2xl border border-[#d6cee5] bg-white/85 px-4 py-3 text-start text-xs font-semibold leading-5 text-[#655083] sm:w-auto"><BotMessageSquare size={18} className="shrink-0" aria-hidden="true"/><span>{locale === "fa" ? "دستیار هوشمند زرمان (به‌زودی)" : "Zarman Assistant (Coming soon)"}</span></button>
          </div>
        </footer>
      </div>
    </div>
  </DashboardMotionProvider></DashboardContext.Provider>;
}
