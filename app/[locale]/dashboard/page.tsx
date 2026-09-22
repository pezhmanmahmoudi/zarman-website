"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { LogOut, MessageSquare } from "lucide-react";
import { useRates } from "@/context/RateContext";
import { useFinanceConfig } from "@/context/FinanceConfigContext";
import { useLocale } from "@/context/LocaleContext";
import { calcLoyaltyDiscount } from "@/lib/pricing";
import { supabase } from "@/lib/supabase";
import { dashboardTab, dashboardCopy, dashboardHref } from "@/lib/dashboard/navigation";
import { useDashboard, DashboardLoading } from "@/components/dashboard/DashboardShell";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { DashboardButton } from "@/components/dashboard/dashboard-ui";

const DashboardRequestHub = dynamic(() => import("@/components/dashboard/DashboardRequestHub").then(m => m.DashboardRequestHub), { loading: DashboardLoading });
const DashboardHistoryPanel = dynamic(() => import("@/components/dashboard/DashboardHistoryPanel").then(m => m.DashboardHistoryPanel), { loading: DashboardLoading });
const DashboardProfile = dynamic(() => import("@/components/dashboard/DashboardProfile").then(m => m.DashboardProfile), { loading: DashboardLoading });
const DashboardRecipients = dynamic(() => import("@/components/dashboard/DashboardRecipients").then(m => m.DashboardRecipients), { loading: DashboardLoading });
const DashboardFeedback = dynamic(() => import("@/components/dashboard/DashboardFeedback").then(m => m.DashboardFeedback), { loading: DashboardLoading });

export default function ZarmanDashboard() {
  const { profile, transactions, motionEnabled } = useDashboard(), locale = useLocale(), copy = dashboardCopy[locale], router = useRouter();
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
  if (tab === "transfer") return <DashboardRequestHub isApproved={approved} txType={txType} setTxType={setTxType} amountStr={amountStr} setAmountStr={setAmountStr} loyaltyBonus={loyalty} tailoredRate={tailoredRate} baseRate={baseRate} profile={profile} initialRecipientId={query.get("recipient")} motionEnabled={motionEnabled}/>;
  return <div className="space-y-7">
    {tab === "profile" ? <><DashboardProfile key={`${profile?.id}:${profile?.updated_at}:${profile?.kyc_status}`} profile={profile} motionEnabled={motionEnabled}/>
      <div className="flex flex-wrap items-center gap-2 border-t border-[#e9ecf0] pt-5 min-[900px]:hidden"><DashboardButton tone="quiet" asChild><Link href={dashboardHref(locale,"feedback")}><MessageSquare size={16}/>{copy.feedback}</Link></DashboardButton><DashboardButton tone="quiet" onClick={() => void signOut()} disabled={signingOut}><LogOut size={16}/>{copy.signOut}</DashboardButton>{signOutError && <p role="alert">{copy.retry}</p>}</div>
    </> : <DashboardFeedback profileId={profile?.id||""} motionEnabled={motionEnabled}/>}
  </div>;
}
