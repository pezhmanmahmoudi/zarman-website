"use client";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, House, ArrowLeftRight, History, UserRound, MessageSquare, LogOut } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/context/LocaleContext";
import { dashboardCopy, dashboardHref, type DashboardTab } from "@/lib/dashboard/navigation";
import styles from "@/styles/dashboard/DashboardSidebar.module.css";

export function DashboardSidebar({ activeTab }: { activeTab: DashboardTab }) {
  const locale = useLocale(), copy = dashboardCopy[locale], router = useRouter();
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const items = [{ tab: "overview", Icon: House }, { tab: "transfer", Icon: ArrowLeftRight }, { tab: "history", Icon: History }, { tab: "profile", Icon: UserRound }] as const;
  async function signOut() {
    if (busy) return;
    setBusy(true); setError(false);
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
      router.replace(`/${locale}/login`); router.refresh();
    } catch { setError(true); setBusy(false); }
  }
  return <>
    <aside className={styles.sidebar}>
      <Link href={dashboardHref(locale, "overview")} className={styles.brand} aria-label="Zarman"><Image src="/images/logo-no-text-light.svg" width={40} height={40} alt="" /><span>ZARMAN<small>EXCHANGE</small></span></Link>
      <p className={styles.navLabel}>{locale === "fa" ? "فضای شخصی شما" : "YOUR WORKSPACE"}</p>
      <nav className={styles.nav} aria-label={locale === "fa" ? "داشبورد" : "Dashboard"}>
        {items.map(({ tab, Icon }) => <Link key={tab} href={dashboardHref(locale, tab)} className={styles.navItem} aria-current={activeTab === tab ? "page" : undefined}><Icon size={20} aria-hidden="true" /><span>{copy[tab]}</span><span className={styles.activeDot} /></Link>)}
      </nav>
      <div className={styles.sidebarBottom}>
        <div className={styles.brandNote}><span className={styles.orbit} aria-hidden="true" /><p>{copy.workspace}</p><span>{copy.exchange}</span></div>
        <Link className={styles.secondary} href={dashboardHref(locale, "feedback")} aria-current={activeTab === "feedback" ? "page" : undefined}><MessageSquare size={17} />{copy.feedback}<ArrowUpRight size={15} /></Link>
        <button className={styles.secondary} onClick={() => void signOut()} disabled={busy}><LogOut size={17} />{copy.signOut}</button>
        {error && <p role="alert" className={styles.error}>{locale === "fa" ? "خروج ناموفق بود. دوباره تلاش کنید." : "Sign out failed. Please retry."}</p>}
      </div>
    </aside>
    <nav className={styles.mobileNav} aria-label={locale === "fa" ? "ناوبری اصلی" : "Main navigation"}>
      {items.map(({ tab, Icon }) => <Link key={tab} href={dashboardHref(locale, tab)} aria-current={activeTab === tab ? "page" : undefined}><Icon size={21} aria-hidden="true" /><span>{copy[tab]}</span></Link>)}
    </nav>
  </>;
}
