"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase"; 
import { useRates } from "@/context/RateContext"; 
import { useDashboardData } from "@/hooks/useDashboardData";

import shellStyles from "@/styles/dashboard/DashboardShell.module.css";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { DashboardRequestHub } from "@/components/dashboard/DashboardRequestHub";
import { DashboardTransactionHistory } from "@/components/dashboard/DashboardTransactionHistory";
import { DashboardProfile } from "@/components/dashboard/DashboardProfile";
import { DashboardFeedback } from "@/components/dashboard/DashboardFeedback";

export default function ZarmanDashboard() {
  const rateContext = useRates();
  const { profile, transactions, loading, sessionChecked } = useDashboardData();

  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"hub" | "history" | "profile" | "feedback">("hub");

  const [amountStr, setAmountStr] = useState("۱،۰۰۰");
  const [txType, setTxType] = useState<"sell_aud" | "buy_aud">("buy_aud"); 

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("zarman-dashboard-theme");
    if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
  }, []);

  useEffect(() => { window.localStorage.setItem("zarman-dashboard-theme", theme); }, [theme]);

  const baseRate = useMemo(() => {
    const rates = rateContext?.currentRates;
    if (!rates) return 41250; 
    return txType === "buy_aud" ? rates.sellAUD : rates.buyAUD;
  }, [rateContext, txType]);

  // 👈 فیلتر کردن تراکنش‌های موفق برای استخراج حجم و تعداد
  const approvedTransactions = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter((tx: any) => tx.status === "approved");
  }, [transactions]);

  const approvedVolume = useMemo(() => {
    return approvedTransactions.reduce((sum: number, tx: any) => sum + (Number(tx.amount_aud) || 0), 0);
  }, [approvedTransactions]);

  const loyaltyBonus = useMemo(() => {
    if (approvedVolume >= 10000) return 600;
    if (approvedVolume >= 5000) return 250;
    return 0;
  }, [approvedVolume]);

  const tailoredRate = useMemo(() => {
    return txType === "buy_aud" ? baseRate - loyaltyBonus : baseRate + loyaltyBonus; 
  }, [baseRate, txType, loyaltyBonus]);

  const isApproved = String(profile?.kyc_status || "").replace(/['"]/g, '').trim().toLowerCase() === "approved";
  
  const displayFullName = useMemo(() => {
    if (!profile) return "مشتری عزیز";
    const fullName = String(profile.full_name || "").trim();
    if (fullName) return fullName;
    return `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "مشتری عزیز";
  }, [profile]);

  const profileFields = useMemo(() => {
    if (!profile) return [];
    const fullAddress = [
      profile.address, profile.suburb, profile.city, 
      profile.state, profile.postcode || profile.post_code, profile.country
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
      { id: 'email', label: "ایمیل", value: profile.email || "—", dir: "ltr" },
      { id: 'phone', label: "شماره تماس", value: profile.mobile_number || profile.phone_number || "—", dir: "ltr" },
      { id: 'dob', label: "تاریخ تولد", value: dobEn, dir: "ltr" },
      { id: 'address', label: "محل سکونت", value: fullAddress || "—", dir: "ltr" },
      { id: 'doc', label: "مدارک بارگذاری شده", value: docTypeFa, dir: "rtl" }
    ];
  }, [profile]);

  const handleSaveTransaction = async (rawAmount: number, resultNumber: number, currentTxType: string) => {
    if (!profile || !isApproved || rawAmount <= 0) return false;
    try {
      const { data, error } = await supabase
        .from('transactions') 
        .insert([{
          user_id: profile.id,            
          type: currentTxType,            
          amount_aud: rawAmount,          
          equivalent_toman: resultNumber, 
          status: 'pending'               
        }])
        .select();

      if (error) {
        console.error("خطای سوپابیس:", error);
        alert(`ثبت تراکنش در دیتابیس مسدود شد!\nارور: ${error.message}`);
        return false; 
      }
      return true; 
    } catch (err: any) {
      console.error("خطای شبکه:", err);
      return false;
    }
  };

  // 👈 تابع جدید برای حذف تراکنش از دیتابیس
  const handleDeleteTransaction = async (txId: string | number) => {
    if (!confirm("آیا از حذف این درخواست اطمینان دارید؟")) return;
    
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', txId);
        
      if (error) {
        console.error("خطا در حذف تراکنش:", error);
        alert(`حذف تراکنش مسدود شد! لطفا RLS مربوط به Delete را چک کنید.`);
      } else {
        // برای اینکه سریعاً تغییر را ببینیم صفحه را رفرش می‌کنیم
        window.location.reload(); 
      }
    } catch (err) {
      console.error("خطا:", err);
    }
  };

  if (!sessionChecked || loading) return <div className={shellStyles.dashboardWrapper} data-theme={theme}><div className={shellStyles.loadingState}>در حال برقراری اتصال امن با دیتابیس...</div></div>;

  return (
    <div className={shellStyles.dashboardWrapper} data-theme={theme}>
      <DashboardSidebar activeTab={activeTab} setActiveTab={setActiveTab} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} theme={theme} setTheme={setTheme} />
      
      <main className={shellStyles.mainArea}>
        <DashboardHeader firstName={profile?.first_name || "کاربر"} isApproved={isApproved} setMobileMenuOpen={setMobileMenuOpen} />
        {/* 👈 تعداد تراکنش‌ها حالا فقط تعداد تراکنش‌های موفق را می‌فرستد */}
        <DashboardStats totalVolume={approvedVolume} transactionCount={approvedTransactions.length} baseRate={baseRate} loyaltyBonus={loyaltyBonus} txType={txType} />
        
        {activeTab === "hub" && (
          <DashboardRequestHub 
            isApproved={isApproved} txType={txType} setTxType={setTxType} amountStr={amountStr} setAmountStr={setAmountStr} 
            loyaltyBonus={loyaltyBonus} tailoredRate={tailoredRate} baseRate={baseRate} profile={profile} displayFullName={displayFullName} 
            onSaveTransaction={handleSaveTransaction} 
          />
        )}
        {/* 👈 تابع حذف به تاریخچه فرستاده شد */}
        {activeTab === "history" && <DashboardTransactionHistory transactions={transactions} totalVolume={approvedVolume} onDeleteTransaction={handleDeleteTransaction} />}
        {activeTab === "profile" && <DashboardProfile profileFields={profileFields} profileId={profile?.id} />}
        {activeTab === "feedback" && <DashboardFeedback profileId={profile?.id || ""} />}
      </main>
    </div>
  );
}