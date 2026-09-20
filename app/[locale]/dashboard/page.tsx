"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { ArrowUpRight, LogOut, MessageSquare, ShieldCheck } from "lucide-react";
import { useRates } from "@/context/RateContext";
import { useFinanceConfig } from "@/context/FinanceConfigContext";
import { useLocale } from "@/context/LocaleContext";
import { calcLoyaltyDiscount } from "@/lib/pricing";
import { supabase } from "@/lib/supabase";
import { dashboardTab, dashboardCopy, dashboardHref } from "@/lib/dashboard/navigation";
import { useDashboard, DashboardLoading } from "@/components/dashboard/DashboardShell";
import { DashboardOverview, DashboardRateCard } from "@/components/dashboard/DashboardOverview";
import styles from "@/styles/dashboard/DashboardHome.module.css";

const DashboardRequestHub = dynamic(() => import("@/components/dashboard/DashboardRequestHub").then(m => m.DashboardRequestHub), { loading: DashboardLoading });
const DashboardHistoryPanel = dynamic(() => import("@/components/dashboard/DashboardHistoryPanel").then(m => m.DashboardHistoryPanel), { loading: DashboardLoading });
const DashboardProfile = dynamic(() => import("@/components/dashboard/DashboardProfile").then(m => m.DashboardProfile), { loading: DashboardLoading });
const DashboardRecipients = dynamic(() => import("@/components/dashboard/DashboardRecipients").then(m => m.DashboardRecipients), { loading: DashboardLoading });
const DashboardFeedback = dynamic(() => import("@/components/dashboard/DashboardFeedback").then(m => m.DashboardFeedback), { loading: DashboardLoading });

export default function ZarmanDashboard() {
  const { profile, transactions } = useDashboard(), locale = useLocale(), copy = dashboardCopy[locale], router = useRouter();
  const query = useSearchParams(), pathname = usePathname(), tab = dashboardTab(pathname,query);
  const { currentRates } = useRates(), finance = useFinanceConfig();
  const [amountStr,setAmountStr] = useState("1,000"), [txType,setTxType] = useState<"buy_aud"|"sell_aud">("buy_aud");
  const [signingOut,setSigningOut] = useState(false), [signOutError,setSignOutError] = useState(false);
  const amount = query.get("requestAmountAud"), direction = query.get("requestDirection");
  useEffect(() => {
    if (amount && /^\d+(?:\.\d{1,2})?$/.test(amount) && Number(amount)>0 && Number(amount)<=10_000_000) setAmountStr(Number(amount).toLocaleString("en-AU",{maximumFractionDigits:2}));
    if (direction === "buy_aud" || direction === "sell_aud") setTxType(direction);
  }, [amount,direction]);
  const completed = useMemo(() => transactions.filter(tx => tx.status === "approved"),[transactions]);
  const volume = useMemo(() => completed.reduce((sum,tx) => sum + (Number(tx.amount_aud)||0),0),[completed]);
  const spread = currentRates.buyAUD && currentRates.sellAUD ? Math.abs(currentRates.sellAUD-currentRates.buyAUD) : 0;
  const loyalty = calcLoyaltyDiscount(volume,spread,finance);
  const baseRate = txType === "buy_aud" ? currentRates.sellAUD : currentRates.buyAUD;
  const tailoredRate = baseRate ? txType === "buy_aud" ? baseRate-loyalty : baseRate+loyalty : null;
  const approved = profile?.kyc_status === "approved";
  async function signOut() {
    if (signingOut) return;
    setSigningOut(true); setSignOutError(false);
    try {const result = await supabase.auth.signOut({scope:"local"}); if(result.error) throw result.error; router.replace(`/${locale}/login`); router.refresh();}
    catch {setSignOutError(true); setSigningOut(false);}
  }
  if (tab === "overview") return <DashboardOverview volume={volume} completedCount={completed.length} tailoredRate={tailoredRate} baseRate={baseRate} loyaltyBonus={loyalty} txType={txType}/>;
  if (tab === "recipients") return <DashboardRecipients key={profile?.id}/>;
  if (tab === "history") return <DashboardHistoryPanel/>;
  if (tab === "transfer") return <div className={styles.page}>
    <div className={styles.pageHeading}><div><h1>{copy.newTransfer}</h1><p className={styles.subtitle}>{copy.transferHint}</p></div><Link className={styles.textLink} href={dashboardHref(locale,"history")}>{copy.history}<ArrowUpRight size={15}/></Link></div>
    <div className={styles.transferLayout}><DashboardRequestHub isApproved={approved} txType={txType} setTxType={setTxType} amountStr={amountStr} setAmountStr={setAmountStr} loyaltyBonus={loyalty} tailoredRate={tailoredRate} baseRate={baseRate} profile={profile} initialRecipientId={query.get("recipient")}/>
      <aside className={styles.transferAside}><DashboardRateCard tailoredRate={tailoredRate} baseRate={baseRate} loyaltyBonus={loyalty} txType={txType} loyaltySavings={Number(profile?.loyalty_discount_toman||0)}/><div className={styles.helpCard}><ShieldCheck size={24}/><h2>{locale === "fa" ? "هر مرحله، با اطلاع شما." : "Clarity at every step."}</h2><p>{locale === "fa" ? "مشخصات بانکی پس از تأیید درخواست نمایش داده می‌شود. رسید را همان‌جا ارسال و وضعیت انتقال را دنبال کنید." : "Bank details appear after approval. Upload your receipt and follow the transfer in your dashboard."}</p><Link className={styles.textLink} href={dashboardHref(locale,"history")}>{copy.messages}<ArrowUpRight size={14}/></Link></div></aside>
    </div>
  </div>;
  return <div className={styles.page}><div className={styles.pageHeading}><div><h1>{copy[tab]}</h1><p className={styles.subtitle}>{tab === "profile" ? copy.profileHint : locale === "fa" ? "تجربه شما برای ما مهم است." : "Help shape your Zarman experience."}</p></div></div>
    {tab === "profile" ? <><div className={styles.mobileAccountActions}><Link className={styles.secondary} href={dashboardHref(locale,"feedback")}><MessageSquare size={16}/>{copy.feedback}</Link><button className={styles.secondary} onClick={() => void signOut()} disabled={signingOut}><LogOut size={16}/>{copy.signOut}</button>{signOutError && <p role="alert">{copy.retry}</p>}</div><DashboardProfile key={`${profile?.id}:${profile?.updated_at}:${profile?.kyc_status}`} profile={profile}/></> : <DashboardFeedback profileId={profile?.id||""}/>}
  </div>;
}
