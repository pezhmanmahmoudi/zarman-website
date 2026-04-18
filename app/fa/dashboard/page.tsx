"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase"; 
import { useRates } from "@/context/RateContext"; 
import { useDashboardData } from "@/hooks/useDashboardData";
// 👈 توابع سروری امن
import { processTransactionSecurely, deleteTransactionSecurely } from "@/app/actions/transaction.actions"; 

import shellStyles from "@/styles/dashboard/DashboardShell.module.css";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { DashboardRequestHub } from "@/components/dashboard/DashboardRequestHub";
import { DashboardTransactionHistory } from "@/components/dashboard/DashboardTransactionHistory";
import { DashboardProfile } from "@/components/dashboard/DashboardProfile";
import { DashboardFeedback } from "@/components/dashboard/DashboardFeedback";
import { AlertTriangle, X } from "lucide-react"; 
import { getLoyaltyBonusByVolume } from "@/lib/pricing"; // این را بالای فایل اضافه کن
import { ProfileField, Transaction } from "./dashboard.types";

export default function ZarmanDashboard() {
  const rateContext = useRates();
  const { profile, transactions, loading, sessionChecked } = useDashboardData();

  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"hub" | "history" | "profile" | "feedback">("hub");

  const [amountStr, setAmountStr] = useState("۱،۰۰۰");
  const [txType, setTxType] = useState<"sell_aud" | "buy_aud">("buy_aud"); 

  // 👈 استیت‌های مربوط به Modal قدیمی شما
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
    return transactions.filter((tx: Transaction) => tx.status === "approved");
  }, [transactions]);

  const approvedVolume = useMemo(() => {
    return approvedTransactions.reduce((sum: number, tx: Transaction) => sum + (Number(tx.amount_aud) || 0), 0);
  }, [approvedTransactions]);

  // و متغیر را اینطور تغییر بده:
  const loyaltyBonus = useMemo(() => {
    if (spread === 0 || approvedVolume === 0) return 0;
    return getLoyaltyBonusByVolume(spread, approvedVolume);
  }, [approvedVolume, spread]);

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

  const profileFields = useMemo<ProfileField[]>(() => {
    if (!profile) return [];
    
    const fullAddress = [
      profile.address, 
      profile.suburb, 
      profile.city, 
      profile.state, 
      profile.postal_code,
      profile.country
    ].filter(Boolean).join(" - ");

    let docTypeFa = "آپلود نشده";
    const dt = String(profile.document_type || "").toLowerCase();
    if (dt === 'passport') docTypeFa = 'پاسپورت';
    else if (dt === 'driver_license' || dt.includes('license')) docTypeFa = 'گواهینامه رانندگی (لایسنس)';
    else if (dt === 'national_id') docTypeFa = 'کارت ملی';
    else if (dt && dt !== "undefined") docTypeFa = dt;

    let dobEn = "—";
    const dobRaw = profile.dob || profile.date_of_birth || profile.birth_date;
    if (dobRaw) {
      const d = new Date(String(dobRaw));
      if (!isNaN(d.getTime())) dobEn = d.toLocaleDateString("en-US");
    }

    return [
      { id: 'fname', label: "نام", value: profile.first_name || "—", dir: "ltr" },
      { id: 'lname', label: "نام خانوادگی", value: profile.last_name || "—", dir: "ltr" },
      { id: 'phone', label: "شماره تماس", value: profile.mobile_number || profile.phone_number || "—", dir: "ltr" },
      { id: 'email', label: "ایمیل", value: profile.email || "—", dir: "ltr" },
      { id: 'dob', label: "تاریخ تولد", value: dobEn, dir: "ltr" },
      { id: 'address', label: "محل سکونت", value: fullAddress || "—", dir: "ltr" },
      { id: 'doc', label: "مدارک بارگذاری شده", value: docTypeFa, dir: "rtl" }
    ];
  }, [profile]);

  // 🔒 ثبت امن با توکن
  const handleSaveTransaction = async (rawAmount: number, currentTxType: "buy_aud" | "sell_aud") => {
    if (!profile || !profile.id || !isApproved || rawAmount <= 0) return null;
    
    // دریافت توکن زنده از مرورگر
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    if (!token) {
      alert("خطا: توکن امنیتی یافت نشد. لطفا یکبار از حساب خارج و دوباره وارد شوید.");
      return null;
    }

    const result = await processTransactionSecurely({
      accessToken: token, // 👈 ارسال توکن به جای userId
      rawAmount: rawAmount,
      txType: currentTxType
    });

    if (result?.error) {
      alert(`ثبت تراکنش مسدود شد!\nارور سرور: ${result.error}`);
      return null;
    }

     return (result?.data as unknown) || null;  
  };

  const handleDeleteRequest = (txId: string | number) => {
    setDeleteConfirmId(txId);
  };

  // 🔒 حذف امن با توکن
  const executeDeleteTransaction = async () => {
    if (!deleteConfirmId) return;
    setIsDeleting(true);
    try {
      // دریافت توکن زنده از مرورگر
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        alert("نشست شما منقضی شده است. لطفا دوباره وارد شوید.");
        setIsDeleting(false);
        return;
      }

      // 👈 ارسال آیدی تراکنش به همراه توکن
      const result = await deleteTransactionSecurely(String(deleteConfirmId), token);
      
      if (result?.error) {
        alert(`لغو تراکنش مسدود شد!\n${result.error}`);
      } else {
        window.location.reload(); 
      }
    } catch (err) {
      console.error("خطا در ارتباط با سرور:", err);
      alert("ارتباط با سرور برقرار نشد.");
    } finally {
      setIsDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  if (!sessionChecked || loading) return <div className={shellStyles.dashboardWrapper} data-theme={theme}><div className={shellStyles.loadingState}>در حال برقراری اتصال امن با دیتابیس...</div></div>;

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
        {activeTab === "profile" && <DashboardProfile profileFields={profileFields} profileId={profile?.id} />}
        {activeTab === "feedback" && <DashboardFeedback profileId={profile?.id || ""} />}

        {/* 👈 Modal ظاهر قدیمی شما */}
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
                  {isDeleting ? "در حال پردازش..." : "بله، حذف شود"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}