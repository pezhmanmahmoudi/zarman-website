"use client";
import Link from "next/link";
import { Eye, EyeOff, Languages, Pause, Play, ShieldCheck, UserRound } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useLocale } from "@/context/LocaleContext";
import { dashboardCopy, dashboardHref, type DashboardTab } from "@/lib/dashboard/navigation";
import type { Profile } from "@/app/[locale]/dashboard/dashboard.types";
import styles from "@/styles/dashboard/DashboardHeader.module.css";

export function DashboardHeader({ activeTab, profile, privateAmounts, onTogglePrivacy, motion = true, onToggleMotion }: {
  activeTab: DashboardTab; profile: Profile | null; privateAmounts: boolean; onTogglePrivacy: () => void;
  motion?: boolean; onToggleMotion?: () => void;
}) {
  const locale = useLocale(), copy = dashboardCopy[locale], pathname = usePathname(), query = useSearchParams();
  const targetLocale = locale === "fa" ? "en" : "fa";
  const switchPath = pathname.replace(/^\/(en|fa)(?=\/|$)/, `/${targetLocale}`) + (query.toString() ? `?${query}` : "");
  return <header className={styles.header}>
    <div className={styles.breadcrumb}><span className={styles.desktopBrand}>Zarman</span><span className={styles.separator}>/</span><strong>{copy[activeTab]}</strong></div>
    <div className={styles.controls}>
      {onToggleMotion && <button type="button" className={styles.iconButton} onClick={onToggleMotion} aria-label={locale === "fa" ? (motion ? "توقف انیمیشن‌ها" : "پخش انیمیشن‌ها") : (motion ? "Pause animations" : "Play animations")} title={locale === "fa" ? "انیمیشن‌ها" : "Animations"}>{motion ? <Pause size={15}/> : <Play size={15}/>}</button>}
      {profile?.kyc_status === "approved" && <span className={styles.verified}><ShieldCheck size={14} />{copy.verified}</span>}
      {(activeTab === "overview" || activeTab === "history") && !pathname.includes("/requests/") && <button className={styles.iconButton} onClick={onTogglePrivacy} aria-label={privateAmounts ? copy.show : copy.privacy} aria-pressed={privateAmounts} title={privateAmounts ? copy.show : copy.privacy}>{privateAmounts ? <EyeOff size={18} /> : <Eye size={18} />}</button>}
      <Link className={styles.language} href={switchPath} aria-label={targetLocale === "fa" ? "فارسی" : "English"}><Languages size={16} /><span>{targetLocale === "fa" ? "فا" : "EN"}</span></Link>
      <Link className={styles.avatar} href={dashboardHref(locale, "profile")} aria-label={copy.profile}>{profile?.first_name?.trim().slice(0, 1).toLocaleUpperCase() || <UserRound size={18} />}</Link>
    </div>
  </header>;
}
