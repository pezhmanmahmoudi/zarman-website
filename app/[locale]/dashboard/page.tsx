"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useSearchParams } from "next/navigation";
import { useRates } from "@/context/RateContext";
import { useFinanceConfig } from "@/context/FinanceConfigContext";
import { calcLoyaltyDiscount } from "@/lib/pricing";
import { dashboardTab } from "@/lib/dashboard/navigation";
import { useDashboard, DashboardLoading } from "@/components/dashboard/DashboardShell";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";

const panelLoading = () => <DashboardLoading />;
const DashboardRequestHub = dynamic(() => import("@/components/dashboard/DashboardRequestHub").then(m => m.DashboardRequestHub), { loading: panelLoading });
const DashboardHistoryPanel = dynamic(() => import("@/components/dashboard/DashboardHistoryPanel").then(m => m.DashboardHistoryPanel), { loading: panelLoading });
const DashboardProfile = dynamic(() => import("@/components/dashboard/DashboardProfile").then(m => m.DashboardProfile), { loading: panelLoading });
const DashboardRecipients = dynamic(() => import("@/components/dashboard/DashboardRecipients").then(m => m.DashboardRecipients), { loading: panelLoading });
const DashboardFeedback = dynamic(() => import("@/components/dashboard/DashboardFeedback").then(m => m.DashboardFeedback), { loading: panelLoading });

export default function ZarmanDashboard() {
  const { profile, approvedVolume: volume, approvedCount, motionEnabled } = useDashboard();
  const query = useSearchParams(), pathname = usePathname(), tab = dashboardTab(pathname,query);
  const { currentRates } = useRates(), finance = useFinanceConfig();
  const [amountStr,setAmountStr] = useState("1,000"), [txType,setTxType] = useState<"buy_aud"|"sell_aud">("buy_aud");
  const amount = query.get("requestAmountAud"), direction = query.get("requestDirection");
  const queryKey = `${amount ?? ""}|${direction ?? ""}`;
  const [appliedQuery, setAppliedQuery] = useState<string | null>(null);
  if (appliedQuery !== queryKey) {
    setAppliedQuery(queryKey);
    if (amount && /^\d+(?:\.\d{1,2})?$/.test(amount) && Number(amount)>0 && Number(amount)<=10_000_000) setAmountStr(Number(amount).toLocaleString("en-AU",{maximumFractionDigits:2}));
    if (direction === "buy_aud" || direction === "sell_aud") setTxType(direction);
  }
  const spread = currentRates.buyAUD && currentRates.sellAUD ? Math.abs(currentRates.sellAUD-currentRates.buyAUD) : 0;
  const loyalty = calcLoyaltyDiscount(volume,spread,finance);
  const baseRate = txType === "buy_aud" ? currentRates.sellAUD : currentRates.buyAUD;
  const tailoredRate = baseRate ? txType === "buy_aud" ? baseRate-loyalty : baseRate+loyalty : null;
  const approved = profile?.kyc_status === "approved";
  if (tab === "overview") return <DashboardOverview volume={volume} completedCount={approvedCount} baseBuyRate={currentRates.buyAUD} baseSellRate={currentRates.sellAUD} customerBuyRate={currentRates.sellAUD ? currentRates.sellAUD - loyalty : null} customerSellRate={currentRates.buyAUD ? currentRates.buyAUD + loyalty : null} loyaltyBonus={loyalty}/>;
  if (tab === "recipients") return <DashboardRecipients key={profile?.id}/>;
  if (tab === "history") return <DashboardHistoryPanel/>;
  if (tab === "transfer") return <DashboardRequestHub isApproved={approved} txType={txType} setTxType={setTxType} amountStr={amountStr} setAmountStr={setAmountStr} loyaltyBonus={loyalty} tailoredRate={tailoredRate} baseRate={baseRate} profile={profile} initialRecipientId={query.get("recipient")} motionEnabled={motionEnabled}/>;
  return <div className="space-y-7">
    {tab === "profile" ? <DashboardProfile key={`${profile?.id}:${profile?.updated_at}:${profile?.kyc_status}`} profile={profile} motionEnabled={motionEnabled}/> : <DashboardFeedback profileId={profile?.id||""} motionEnabled={motionEnabled}/>}
  </div>;
}
