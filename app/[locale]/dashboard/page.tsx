"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRates } from "@/context/RateContext"; 
import { useDashboardData } from "@/hooks/useDashboardData";
import { deleteTransactionSecurely, processTransactionSecurely } from "@/app/actions/transaction.actions";

import shellStyles from "@/styles/dashboard/DashboardShell.module.css";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { DashboardRequestHub } from "@/components/dashboard/DashboardRequestHub";
import { DashboardTransactionHistory } from "@/components/dashboard/DashboardTransactionHistory";
import { DashboardProfile } from "@/components/dashboard/DashboardProfile";
import { DashboardFeedback } from "@/components/dashboard/DashboardFeedback";
import { AlertTriangle, X } from "lucide-react"; 
import { useFinanceConfig } from "@/context/FinanceConfigContext";
import { calcLoyaltyDiscount } from "@/lib/pricing";


export default function ZarmanDashboard() {
  const rateContext = useRates();
  const { profile, transactions, loading, sessionChecked } = useDashboardData();
  const financeConfig = useFinanceConfig();

  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"hub" | "history" | "profile" | "feedback">("hub");

  const [amountStr, setAmountStr] = useState("۱،۰۰۰");
  const [txType, setTxType] = useState<"sell_aud" | "buy_aud">("buy_aud"); 

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("zarman-dashboard-theme");
    if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
  }, []);

  useEffect(() => { window.localStorage.setItem("zarman-dashboard-theme", theme); }, [theme]);

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
    return transactions.filter((tx: any) => tx.status === "approved");
  }, [transactions]);

  const approvedVolume = useMemo(() => {
    return approvedTransactions.reduce((sum: number, tx: any) => sum + (Number(tx.amount_aud) || 0), 0);
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
    if (!profile) return "مشتری عزیز";
    const fullName = String(profile.full_name || "").trim();
    if (fullName) return fullName;
    return `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "مشتری عزیز";
  }, [profile]);

  const handleSaveTransaction = async (rawAmount: number, currentTxType: "buy_aud" | "sell_aud") => {
    if (!profile || !profile.id || !isApproved || rawAmount <= 0) return null;
    
    const result = await processTransactionSecurely({
      rawAmount: rawAmount,
      txType: currentTxType
    });

    if (result?.error) {
      alert(`ثبت تراکنش مسدود شد!\nارور سرور: ${result.error}`);
      return null;
    }

    return (result?.data as any) || null; 
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
        alert(`حذف تراکنش ناموفق بود: ${result.error}`);
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

  if (!sessionChecked || loading) return <div className={shellStyles.dashboardWrapper} data-theme={theme}><div className={shellStyles.loadingState}>در حال برقراری اتصال با دیتابیس...</div></div>;

  return (
    <div className={shellStyles.dashboardWrapper} data-theme={theme}>
      <DashboardSidebar activeTab={activeTab} setActiveTab={setActiveTab} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} theme={theme} setTheme={setTheme} />
      
      <main className={shellStyles.mainArea}>
        <DashboardHeader firstName={profile?.first_name || "کاربر"} isApproved={isApproved} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />
        
        <DashboardStats totalVolume={approvedVolume} transactionCount={approvedTransactions.length} baseRate={baseRate} loyaltyBonus={loyaltyBonus} txType={txType} />
        
        {activeTab === "hub" && (
          <DashboardRequestHub 
            isApproved={isApproved} txType={txType} setTxType={setTxType} amountStr={amountStr} setAmountStr={setAmountStr} 
            loyaltyBonus={loyaltyBonus} tailoredRate={tailoredRate} baseRate={baseRate} profile={profile} displayFullName={displayFullName} 
            onSaveTransaction={handleSaveTransaction} 
          />
        )}
        
        {activeTab === "history" && <DashboardTransactionHistory transactions={transactions} totalVolume={approvedVolume} onDeleteTransaction={handleDeleteRequest} />}
        
        {/* 🚀 ارور تایپ‌اسکریپت از اینجا حل شد 🚀 */}
        {activeTab === "profile" && <DashboardProfile profile={profile} />}
        
        {activeTab === "feedback" && <DashboardFeedback profileId={profile?.id || ""} />}

        {deleteConfirmId && (
          <div className={shellStyles.modalOverlay}>
            <div className={shellStyles.modalContent}>
              <div className={shellStyles.modalHeader}>
                <div className={shellStyles.modalTitleGroup}>
                  <AlertTriangle className={shellStyles.warningIcon} size={24} />
                  <h3>لغو درخواست حواله</h3>
                </div>
                <button onClick={() => setDeleteConfirmId(null)} className={shellStyles.closeBtn} disabled={isDeleting}><X size={20}/></button>
              </div>
              <div className={shellStyles.modalBody}>
                <p>آیا از لغو و حذف این درخواست تراکنش اطمینان دارید؟ این عمل غیرقابل بازگشت است.</p>
              </div>
              <div className={shellStyles.modalActions}>
                <button onClick={() => setDeleteConfirmId(null)} className={shellStyles.cancelBtn} disabled={isDeleting}>انصراف</button>
                <button onClick={executeDeleteTransaction} className={shellStyles.dangerBtn} disabled={isDeleting}>
                  {isDeleting ? "در حال حذف..." : "بله، حذف شود"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}