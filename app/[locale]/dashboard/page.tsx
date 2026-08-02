"use client";

import React, { useMemo, useState } from "react";
import { useRates } from "@/context/RateContext"; 
import { useDashboardData } from "@/hooks/useDashboardData";
import { deleteTransactionSecurely, processTransactionSecurely } from "@/app/actions/transaction.actions";

import shellStyles from "@/styles/dashboard/DashboardShell.module.css";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { DashboardRequestHub } from "@/components/dashboard/DashboardRequestHub";
import dynamic from "next/dynamic";
import type { Transaction } from "@/app/[locale]/dashboard/dashboard.types";

// Lazy-load inactive tab components — not needed on initial render
const DashboardTransactionHistory = dynamic(
  () => import("@/components/dashboard/DashboardTransactionHistory").then(m => ({ default: m.DashboardTransactionHistory })),
  { ssr: false, loading: () => <div className={shellStyles.loadingState}>در حال بارگذاری...</div> }
);
const DashboardProfile = dynamic(
  () => import("@/components/dashboard/DashboardProfile").then(m => ({ default: m.DashboardProfile })),
  { ssr: false, loading: () => <div className={shellStyles.loadingState}>در حال بارگذاری...</div> }
);
const DashboardFeedback = dynamic(
  () => import("@/components/dashboard/DashboardFeedback").then(m => ({ default: m.DashboardFeedback })),
  { ssr: false, loading: () => <div className={shellStyles.loadingState}>در حال بارگذاری...</div> }
);
import { AlertTriangle, LayoutDashboard, Minimize2, Rows3, X } from "lucide-react";
import { useFinanceConfig } from "@/context/FinanceConfigContext";
import { calcLoyaltyDiscount } from "@/lib/pricing";
import { useT } from "@/hooks/useT";
import { useLocale } from "@/context/LocaleContext";

const DASHBOARD_THEME = "light" as const;

export default function ZarmanDashboard() {
  const rateContext = useRates();
  const { profile, transactions, loading, sessionChecked } = useDashboardData();
  const financeConfig = useFinanceConfig();
  const t = useT();
  const locale = useLocale();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"hub" | "history" | "profile" | "feedback">("hub");
  const [showOverviewCards, setShowOverviewCards] = useState(true);

  const [amountStr, setAmountStr] = useState(() => (locale === "fa" ? "۱،۰۰۰" : "1,000"));
  const [txType, setTxType] = useState<"sell_aud" | "buy_aud">("buy_aud"); 

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const activePanelRef = React.useRef<HTMLDivElement | null>(null);

  const baseRate = useMemo(() => {
    const rates = rateContext?.currentRates;
    if (!rates?.sellAUD || !rates?.buyAUD) return null; 
    return txType === "buy_aud" ? rates.sellAUD : rates.buyAUD;
  }, [rateContext, txType]);

  const spread = useMemo(() => {
    const rates = rateContext?.currentRates;
    if (!rates?.sellAUD || !rates?.buyAUD) return 0;
    return Math.abs(rates.sellAUD - rates.buyAUD);
  }, [rateContext]);

  const approvedTransactions = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter((tx: Transaction) => tx.status === "approved");
  }, [transactions]);

  const approvedVolume = useMemo(() => {
    return approvedTransactions.reduce((sum: number, tx: Transaction) => sum + (Number(tx.amount_aud) || 0), 0);
  }, [approvedTransactions]);

  const loyaltyBonus = useMemo(() => {
    return calcLoyaltyDiscount(approvedVolume, spread, financeConfig);
  }, [approvedVolume, spread, financeConfig]);

  const tailoredRate = useMemo(() => {
    if (baseRate === null) return null;
    return txType === "buy_aud" ? baseRate - loyaltyBonus : baseRate + loyaltyBonus; 
  }, [baseRate, txType, loyaltyBonus]);

  const isApproved = String(profile?.kyc_status || "").replace(/['"]/g, '').trim().toLowerCase() === "approved";
  
  const displayFullName = useMemo(() => {
    if (!profile) return locale === "fa" ? "مشتری عزیز" : "Dear Customer";
    const fullName = String(profile.full_name || "").trim();
    if (fullName) return fullName;
    return `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || (locale === "fa" ? "مشتری عزیز" : "Dear Customer");
  }, [profile, locale]);

  const activePanelLabel = useMemo(() => {
    switch (activeTab) {
      case "hub": return t.dashboard.tabs.hub;
      case "profile": return t.dashboard.tabs.profile;
      case "history": return t.dashboard.tabs.history;
      case "feedback": return t.dashboard.tabs.feedback;
      default: return "";
    }
  }, [activeTab, t]);

  const toggleOverviewCards = () => {
    setShowOverviewCards((current) => {
      const next = !current;
      if (!next) {
        requestAnimationFrame(() => {
          activePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
      return next;
    });
  };

  const handleSaveTransaction = async (rawAmount: number, currentTxType: "buy_aud" | "sell_aud", sourceOfFunds: string, reasonForTransfer: string, recipientId?: string | null, promoCode?: string | null, paymentLink?: string | null, agreedEquivalentToman?: number | null) => {
    if (!profile || !profile.id || !isApproved || rawAmount <= 0) return null;
    
    const result = await processTransactionSecurely({
      rawAmount: rawAmount,
      txType: currentTxType,
      sourceOfFunds,
      reasonForTransfer,
      recipientId,
      promoCode,
      paymentLink,
      agreedEquivalentToman,
    });

    if (result?.error) {
      alert(`${locale === "fa" ? "ثبت تراکنش مسدود شد!\nارور سرور: " : "Transaction blocked!\nServer error: "}${result.error}`);
      return null;
    }

    return (result?.data as {
      baseRate: number;
      tailoredRate: number;
      loyaltyBonus: number;
      equivalentToman: number;
      appliedFee: number;
      rawAmount: number;
      discount_amount?: number;
      final_amount?: number;
      promo_code?: string | null;
    }) || null;
  };

  const handleDeleteRequest = (txId: string | number) => {
    setDeleteConfirmId(txId);
  };

  const executeDeleteTransaction = async () => {
    if (deleteConfirmId === null) return;
    
    setIsDeleting(true);
    try {
      const result = await deleteTransactionSecurely(deleteConfirmId!);
      if (result?.error) {
        alert(`${locale === "fa" ? "حذف تراکنش ناموفق بود: " : "Failed to delete: "}${result.error}`);
      } else {
        window.location.reload(); 
      }
    } catch (err) {
      console.error("خطا در حذف:", err);
    } finally {
      setIsDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  if (!sessionChecked || loading) return <div className={shellStyles.dashboardWrapper} data-theme={DASHBOARD_THEME}><div className={shellStyles.loadingState}>{t.dashboard.connecting}</div></div>;

  return (
    <div className={shellStyles.dashboardWrapper} data-theme={DASHBOARD_THEME}>
      <DashboardSidebar activeTab={activeTab} setActiveTab={setActiveTab} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />
      
      <main className={shellStyles.mainArea}>
        <DashboardHeader firstName={profile?.first_name || (locale === "fa" ? "کاربر" : "User")} isApproved={isApproved} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />

        <section className={shellStyles.overviewCardsWrap} aria-label={t.dashboard.accountSummary}>
          <div className={shellStyles.overviewCardsHeader}>
            <div className={shellStyles.overviewCardsTitle}>
              <LayoutDashboard size={18} />
              <span>{t.dashboard.accountSummary}</span>
            </div>
            <button type="button" className={shellStyles.focusToggleButton} onClick={toggleOverviewCards}>
              {showOverviewCards ? <Minimize2 size={16} /> : <Rows3 size={16} />}
              <span>{showOverviewCards ? t.dashboard.focusMode : t.dashboard.normalMode}</span>
            </button>
          </div>
          {showOverviewCards && (
            <DashboardStats totalVolume={approvedVolume} transactionCount={approvedTransactions.length} baseRate={baseRate} loyaltyBonus={loyaltyBonus} loyaltySavings={profile?.loyalty_discount_toman ?? 0} tailoredRate={tailoredRate} txType={txType} />
          )}
        </section>

        <div ref={activePanelRef} className={shellStyles.activeWorkspace}>
          {activeTab === "hub" && (
            <DashboardRequestHub
              isApproved={isApproved} txType={txType} setTxType={setTxType} amountStr={amountStr} setAmountStr={setAmountStr}
              loyaltyBonus={loyaltyBonus} tailoredRate={tailoredRate} baseRate={baseRate} profile={profile} displayFullName={displayFullName}
              onSaveTransaction={handleSaveTransaction}
            />
          )}

          {activeTab === "history" && <DashboardTransactionHistory transactions={transactions} onDeleteTransaction={handleDeleteRequest} />}

          {activeTab === "profile" && (
            <DashboardProfile
              key={`${profile?.id ?? "anon"}:${profile?.updated_at ?? ""}:${profile?.kyc_status ?? ""}:${profile?.document_type ?? ""}`}
              profile={profile}
            />
          )}

          {activeTab === "feedback" && <DashboardFeedback profileId={profile?.id || ""} />}
        </div>

        {deleteConfirmId && (
          <div className={shellStyles.modalOverlay}>
            <div className={shellStyles.modalContent}>
              <div className={shellStyles.modalHeader}>
                <div className={shellStyles.modalTitleGroup}>
                  <AlertTriangle className={shellStyles.warningIcon} size={24} />
                  <h3>{t.dashboard.deleteConfirmTitle}</h3>
                </div>
                <button onClick={() => setDeleteConfirmId(null)} className={shellStyles.closeBtn} disabled={isDeleting}><X size={20}/></button>
              </div>
              <div className={shellStyles.modalBody}>
                <p>{t.dashboard.deleteConfirmText}</p>
              </div>
              <div className={shellStyles.modalActions}>
                <button onClick={() => setDeleteConfirmId(null)} className={shellStyles.cancelBtn} disabled={isDeleting}>{t.dashboard.deleteCancel}</button>
                <button onClick={executeDeleteTransaction} className={shellStyles.dangerBtn} disabled={isDeleting}>
                  {isDeleting ? t.dashboard.deleting : t.dashboard.deleteConfirm}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}