"use client";
import Link from "next/link";
import { ArrowUpRight, ArrowLeftRight, ShieldCheck, CircleCheck, Clock3, CircleDot, Plus, Crown, Gift, UsersRound } from "lucide-react";
import { useLocale } from "@/context/LocaleContext";
import { useFinanceConfig } from "@/context/FinanceConfigContext";
import { calcLoyaltyDiscountPct } from "@/lib/pricing";
import { dashboardCopy, dashboardHref } from "@/lib/dashboard/navigation";
import { filterDashboardRequests, requestNeedsAttention } from "@/lib/dashboard/activity";
import { DashboardActivity } from "./DashboardActivity";
import { useDashboard } from "./DashboardShell";
import { useDashboardRequests } from "@/hooks/useDashboardRequests";
import { RequestProgress } from "@/components/requests/RequestProgress";
import { TransferJourneyVisual } from "./TransferJourneyVisual";
import styles from "@/styles/dashboard/DashboardHome.module.css";

export function DashboardRateCard({ tailoredRate, loyaltySavings, baseRate, loyaltyBonus = 0, txType = "buy_aud" }: {
  tailoredRate: number | null; loyaltySavings: number; baseRate?: number | null; loyaltyBonus?: number; txType?: "buy_aud" | "sell_aud";
}) {
  const locale = useLocale(), fa = locale === "fa", copy = dashboardCopy[locale];
  const number = (n: number) => n.toLocaleString("en-AU",{maximumFractionDigits:0});
  return <section className={`${styles.card} ${styles.rateCard}`}>
    <div className={styles.rateHeading}><ArrowLeftRight size={17}/>{copy.rate}<span className={styles.rateDirection} dir="ltr">{txType === "buy_aud" ? "IRT → AUD" : "AUD → IRT"}</span></div>
    <div className={styles.rateValue}><span data-private-value dir="ltr">{tailoredRate ? number(tailoredRate) : "—"}</span> <small>{fa ? "تومان / 1 AUD" : "Toman / 1 AUD"}</small></div>
    <p>{copy.rateHint}</p>
    <dl className={styles.rateFacts}>
      {baseRate != null && <div><dt>{fa ? "نرخ پایه" : "Base rate"}</dt><dd data-private-value>{number(baseRate)}</dd></div>}
      <div><dt>{fa ? "مزیت وفاداری در هر دلار" : "Loyalty benefit per AUD"}</dt><dd data-private-value>{number(loyaltyBonus)} {fa ? "تومان" : "Toman"}</dd></div>
      <div><dt>{copy.saved}</dt><dd data-private-value>{number(loyaltySavings)} {fa ? "تومان" : "Toman"}</dd></div>
    </dl>
  </section>;
}

function LoyaltyCard({ volume, savings }: {volume:number; savings:number}) {
  const locale = useLocale(), fa = locale === "fa", config = useFinanceConfig();
  const pct = calcLoyaltyDiscountPct(volume,config);
  const maxed = pct >= config.max_discount_percent;
  const step = config.discount_step_volume > 0 ? config.discount_step_volume : 1000;
  const remaining = Math.max(0, (Math.floor(volume / step)+1)*step-volume);
  const progress = maxed ? 100 : Math.min(100,Math.max(0,(volume % step) / step*100));
  return <section className={styles.loyaltyCard}>
    <div className={styles.loyaltyTitle}><span className={styles.loyaltyIcon}><Crown size={22}/></span><div><span>{fa ? "وفاداری زرمان" : "ZARMAN LOYALTY"}</span><h2>{fa ? "هر انتقال، یک قدم جلوتر." : "Every transfer takes you further."}</h2></div></div>
    <div className={styles.loyaltyBenefit}><strong dir="ltr">{(pct*100).toLocaleString("en-AU",{maximumFractionDigits:2})}<small>%</small></strong><p>{fa ? "تخفیف از فاصله نرخ خرید و فروش" : "discount on the exchange-rate spread"}</p></div>
    <div className={styles.loyaltyProgress} role="progressbar" aria-label={fa ? "پیشرفت مزیت وفاداری بعدی" : "Progress to your next loyalty benefit"} aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${progress}%`}}/></div>
    <p className={styles.loyaltyHint}>{maxed ? (fa ? "بالاترین مزیت وفاداری فعلی را دارید." : "You’ve unlocked the maximum current loyalty benefit.") : <><bdi>{remaining.toLocaleString("en-AU",{maximumFractionDigits:2})} AUD</bdi> {fa ? "انتقال تکمیل‌شده تا مزیت بعدی." : "in completed transfers to your next benefit."}</>}</p>
    <div className={styles.loyaltyFooter}><Gift size={16}/><span>{fa ? "صرفه‌جویی تا امروز" : "Saved so far"}</span><strong data-private-value>{savings.toLocaleString("en-AU",{maximumFractionDigits:0})} {fa ? "تومان" : "Toman"}</strong></div>
  </section>;
}

export function DashboardOverview({ volume, completedCount, tailoredRate, baseRate, loyaltyBonus = 0, txType = "buy_aud" }: {
  volume: number; completedCount: number; tailoredRate: number | null; baseRate?: number | null; loyaltyBonus?:number; txType?: "buy_aud"|"sell_aud";
}) {
  const locale = useLocale(), fa = locale === "fa", copy = dashboardCopy[locale], {profile} = useDashboard(), feed = useDashboardRequests();
  const approved = profile?.kyc_status === "approved";
  const active = filterDashboardRequests(feed.requests,"active","");
  const focus = active.find(requestNeedsAttention) || active[0] || feed.requests.find(request=>request.status === "completed");
  const savings = Number(profile?.loyalty_discount_toman || 0);
  const metrics = [
    {Icon:CircleCheck,label:copy.count,value:completedCount},
    {Icon:Clock3,label:copy.inProgress,value:active.length},
    {Icon:CircleDot,label:copy.attention,value:active.filter(requestNeedsAttention).length},
  ];
  return <div className={styles.page}>
    <div className={styles.pageHeading}><div><p className={styles.eyebrow}>{copy.hello}{profile?.first_name ? `, ${profile.first_name}` : ""}</p><h1>{fa ? "از اینجا، به آنجا." : "From here. To there."}</h1><p className={styles.subtitle}>{fa ? "انتقال‌های شما، با یک مسیر روشن." : "Your transfers, with a clear path forward."}</p></div><Link href={dashboardHref(locale,"transfer")} className={styles.primary} aria-label={copy.newTransfer}><Plus size={18}/>{copy.newTransfer}</Link></div>
    {!approved && <div className={styles.verification}><ShieldCheck size={22}/><p>{profile?.kyc_status === "pending" ? copy.pending : profile?.kyc_status === "rejected" ? copy.correction : copy.verification}</p><Link href={dashboardHref(locale,"profile")}>{copy.profile}<ArrowUpRight size={14}/></Link></div>}
    <div className={styles.spotlightGrid}>
      <div className={styles.spotlightMain}>{focus ? <RequestProgress request={focus} locale={locale} spotlight/> : <section className={styles.welcomeJourney}>
        <div><span className={styles.eyebrow}>{fa ? "استرالیا ↔ ایران" : "AUSTRALIA ↔ IRAN"}</span><h2>{fa ? "فاصله کمتر.\nاحساس نزدیک‌تر." : "Less distance.\nMore connection."}</h2><p>{feed.loading ? copy.loading : fa ? "از اولین درخواست تا آخرین تأیید، کنار شما هستیم." : "From your first request to the final confirmation, follow every step."}</p><Link className={styles.primary} href={dashboardHref(locale,"transfer")}>{copy.newTransfer}<ArrowUpRight size={17}/></Link></div><TransferJourneyVisual/>
      </section>}</div>
      <section className={styles.destinationCard}><span className={styles.destinationIcon}><ArrowLeftRight size={24}/></span><div><p className={styles.eyebrow}>{fa ? "یک انتقال جدید" : "MAKE YOUR NEXT MOVE"}</p><h2>{fa ? "مقصد بعدی شما؟" : "Where to next?"}</h2><p>{fa ? "مسیر را انتخاب کنید. نرخ را قبل از ثبت ببینید." : "Choose a destination. See your quote before you commit."}</p></div><div className={styles.destinationLinks}><Link href={`/${locale}/dashboard?tab=transfer&requestDirection=sell_aud`}><span className={styles.countryDisc}>IR</span><span><strong>{fa ? "ارسال به ایران" : "Send to Iran"}</strong><small>AUD → IRT</small></span><ArrowUpRight size={19}/></Link><Link href={`/${locale}/dashboard?tab=transfer&requestDirection=buy_aud`}><span className={styles.countryDisc}>AU</span><span><strong>{fa ? "ارسال به استرالیا" : "Send to Australia"}</strong><small>IRT → AUD</small></span><ArrowUpRight size={19}/></Link></div><Link className={styles.recipientShortcut} href={dashboardHref(locale,"recipients")}><UsersRound size={16}/>{fa ? "گیرنده جدید یا حساب شخصی شما" : "New recipient or your own account"}<ArrowUpRight size={14}/></Link></section>
    </div>
    <div className={styles.summaryStrip}><div className={styles.volumeMetric}><span>{copy.volume}</span><strong data-private-value><bdi>{volume.toLocaleString("en-AU",{maximumFractionDigits:2})}</bdi> <small>AUD</small></strong></div>{metrics.map(({Icon,label,value},index)=><Link href={dashboardHref(locale,"history")} className={styles.summaryMetric} key={label}><Icon size={19}/><div><span>{label}</span><strong>{index > 0 && (feed.loading || feed.error) ? "—" : value.toLocaleString("en-AU")}</strong></div></Link>)}</div>
    <div className={styles.lowerGrid}><div className={styles.overviewActivity}><DashboardActivity {...feed} onRefresh={()=>void feed.refresh()} compact/><LoyaltyCard volume={volume} savings={savings}/></div><div className={styles.sideStack}><DashboardRateCard tailoredRate={tailoredRate} baseRate={baseRate} loyaltyBonus={loyaltyBonus} loyaltySavings={savings} txType={txType}/><section className={styles.helpCard}><ShieldCheck size={23}/><h2>{fa ? "همراه شما در هر مرحله." : "A team behind every transfer."}</h2><p>{copy.supportHint}</p><Link className={styles.textLink} href={dashboardHref(locale,"history")}>{copy.messages}<ArrowUpRight size={14}/></Link></section></div></div>
  </div>;
}
