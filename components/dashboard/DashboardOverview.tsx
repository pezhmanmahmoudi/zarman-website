"use client";
import Link from "next/link";
import { ArrowUpRight, ArrowLeftRight, Globe2, ShieldCheck, CircleCheck, Clock3, CircleDot, MessageSquare, Plus, BadgeCheck } from "lucide-react";
import { useLocale } from "@/context/LocaleContext";
import { dashboardCopy, dashboardHref } from "@/lib/dashboard/navigation";
import { filterDashboardRequests } from "@/lib/dashboard/activity";
import { DashboardActivity } from "./DashboardActivity";
import { useDashboard } from "./DashboardShell";
import { useDashboardRequests } from "@/hooks/useDashboardRequests";
import styles from "@/styles/dashboard/DashboardHome.module.css";

export function DashboardRateCard({ tailoredRate, loyaltySavings }: { tailoredRate: number | null; loyaltySavings: number }) {
  const locale = useLocale(), copy = dashboardCopy[locale];
  return <section className={`${styles.card} ${styles.rateCard}`}><div className={styles.rateHeading}><ArrowLeftRight size={16}/>{copy.rate}</div>
    <div className={styles.rateValue}><span data-private-value dir="ltr">{tailoredRate ? tailoredRate.toLocaleString("en-AU",{maximumFractionDigits:0}) : "—"}</span> <small>{locale === "fa" ? "تومان / 1 AUD" : "Toman / 1 AUD"}</small></div>
    <p>{copy.rateHint}</p><div className={styles.rateFooter}><span>{copy.saved}</span><strong data-private-value>{loyaltySavings.toLocaleString("en-AU",{maximumFractionDigits:0})} {locale === "fa" ? "تومان" : "Toman"}</strong></div>
  </section>;
}

export function DashboardOverview({ volume, completedCount, tailoredRate }: { volume: number; completedCount: number; tailoredRate: number | null }) {
  const locale = useLocale(), copy = dashboardCopy[locale], { profile } = useDashboard(), feed = useDashboardRequests();
  const approved = profile?.kyc_status === "approved";
  const metrics = [
    { Icon: CircleCheck, label:copy.count, value: completedCount },
    { Icon: Clock3, label:copy.inProgress, value:filterDashboardRequests(feed.requests,"active","").length },
    { Icon: CircleDot, label:copy.attention, value:filterDashboardRequests(feed.requests,"attention","").length },
  ];
  return <div className={styles.page}>
    <div className={styles.pageHeading}><div><p className={styles.eyebrow}>{copy.hello}{profile?.first_name ? `, ${profile.first_name}` : ""}</p><h1>{copy.workspace}</h1><p className={styles.subtitle}>{copy.overviewHint}</p></div><Link href={dashboardHref(locale,"transfer")} className={styles.primary} aria-label={copy.newTransfer}><Plus size={17}/>{copy.newTransfer}</Link></div>
    {!approved && <div className={styles.verification}><ShieldCheck size={22}/><p>{profile?.kyc_status === "pending" ? copy.pending : profile?.kyc_status === "rejected" ? copy.correction : copy.verification}</p><Link href={dashboardHref(locale,"profile")}>{copy.profile}<ArrowUpRight size={14}/></Link></div>}
    <div className={styles.heroGrid}>
      <section className={styles.hero} aria-label={copy.volume}><div className={styles.heroTop}><span>{copy.account}</span><Globe2 size={21}/></div><div><p className={styles.heroLabel}>{copy.volume}</p><div className={styles.heroValue}><strong data-private-value dir="ltr">{volume.toLocaleString("en-AU",{minimumFractionDigits:2,maximumFractionDigits:2})}</strong><span>AUD</span></div></div>
        <div className={styles.heroBottom}><div><p>{copy.volumeHint}</p><strong>{completedCount} {copy.count}</strong></div><Link href={dashboardHref(locale,"history")} className={styles.textLink}>{copy.history}<ArrowUpRight size={14}/></Link></div>
      </section>
      <section className={styles.routeCard}><div className={styles.routeTrack} aria-hidden="true"><span className={styles.currencyCoin}>AUD</span><span className={styles.routeLine}><ArrowLeftRight/></span><span className={styles.currencyCoin}>IRT</span></div><div><h2>{copy.newTransfer}</h2><p>{locale === "fa" ? "دو مقصد. یک تجربه ساده." : "Two destinations. One simple experience."}</p></div><div className={styles.routeButtons}><Link href={`/${locale}/dashboard?tab=transfer&requestDirection=sell_aud`}>{copy.sendToIran}<ArrowUpRight size={13}/></Link><Link href={`/${locale}/dashboard?tab=transfer&requestDirection=buy_aud`}>{copy.sendToAustralia}<ArrowUpRight size={13}/></Link></div></section>
    </div>
    <div className={styles.metrics}>{metrics.map(({Icon,label,value},index) => <div className={styles.metric} key={label}><div className={styles.metricIcon}><Icon size={19}/></div><div><span>{label}</span><strong>{index > 0 && (feed.loading || feed.error) ? "—" : value.toLocaleString("en-AU")}</strong></div></div>)}</div>
    <div className={styles.lowerGrid}><DashboardActivity {...feed} onRefresh={() => void feed.refresh()} compact/><div className={styles.sideStack}><DashboardRateCard tailoredRate={tailoredRate} loyaltySavings={Number(profile?.loyalty_discount_toman || 0)}/><section className={styles.helpCard}><MessageSquare size={23}/><h2>{copy.support}</h2><p>{copy.supportHint}</p><Link className={styles.textLink} href={dashboardHref(locale,"history")}>{copy.messages}<ArrowUpRight size={14}/></Link></section>
      {approved && <div className={styles.rateFooter}><span><BadgeCheck size={13}/> {copy.verified}</span><Link href={dashboardHref(locale,"profile")}>{copy.profile}</Link></div>}
    </div></div>
  </div>;
}
