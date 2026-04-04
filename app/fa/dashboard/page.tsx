"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRates } from "@/context/RateContext";
import { useDashboardData } from "@/hooks/useDashboardData";
import { normalizeLabel, valueToDisplay, extractBaseRateFromContext } from "./dashboard.utils";

import shellStyles from "@/styles/dashboard/DashboardShell.module.css";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { DashboardRequestHub } from "@/components/dashboard/DashboardRequestHub";
import { DashboardTransactionHistory } from "@/components/dashboard/DashboardTransactionHistory";
import { DashboardProfile } from "@/components/dashboard/DashboardProfile";
import { DashboardFeedback } from "@/components/dashboard/DashboardFeedback";

export default function ZarmanDashboard() {
  const rateContext = useRates() as any;
  const { profile, transactions, totalVolume, loading, sessionChecked } = useDashboardData();

  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"hub" | "history" | "profile" | "feedback">("hub");

  // استیت‌های محاسبه‌گر
  const [amountStr, setAmountStr] = useState("۱،۰۰۰");
  const [txType, setTxType] = useState<"sell_aud" | "buy_aud">("sell_aud");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("zarman-dashboard-theme");
    if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
  }, []);

  useEffect(() => { window.localStorage.setItem("zarman-dashboard-theme", theme); }, [theme]);

  // منطق نرخ زرمان
  const baseRate = useMemo(() => extractBaseRateFromContext(rateContext), [rateContext]);
  const loyaltyBonus = useMemo(() => {
    if (totalVolume >= 10000) return 600;
    if (totalVolume >= 5000) return 250;
    return 0;
  }, [totalVolume]);

  const isApproved = profile?.kyc_status === "approved";
  const displayFullName = useMemo(() => {
    if (!profile) return "مشتری عزیز";
    const fullName = String(profile.full_name || "").trim();
    if (fullName) return fullName;
    return `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "مشتری عزیز";
  }, [profile]);

  const profileFields = useMemo(() => {
    if (!profile) return [];

    // ۱. ترکیب تمام بخش‌های آدرس در یک فیلد یکپارچه
    const fullAddress = [
      profile.address,
      profile.suburb,
      profile.city,
      profile.state,
      profile.postcode || profile.post_code,
      profile.country
    ].filter(Boolean).join(" - ");

    // ۲. ترجمه نوع مدرک بارگذاری شده
    let docTypeFa = "آپلود نشده";
    const dt = String(profile.document_type || "").toLowerCase();
    if (dt === 'passport') docTypeFa = 'پاسپورت';
    else if (dt === 'driver_license' || dt.includes('license')) docTypeFa = 'گواهینامه رانندگی (لایسنس)';
    else if (dt === 'national_id') docTypeFa = 'کارت ملی';
    else if (dt && dt !== "undefined") docTypeFa = dt;

    // ۳. تبدیل تاریخ تولد به فرمت استاندارد انگلیسی (میلادی)
    let dobEn = "—";
    const dobRaw = profile.dob || profile.date_of_birth || profile.birth_date;
    if (dobRaw) {
      const d = new Date(String(dobRaw));
      if (!isNaN(d.getTime())) {
        dobEn = d.toLocaleDateString("en-US"); // خروجی به صورت MM/DD/YYYY میلادی
      }
    }

    // ساختن فقط ۷ فیلد درخواستی شما با مشخص کردن دقیق جهت متن (dir)
    return [
      { id: 'fname', label: "نام", value: profile.first_name || "—", dir: "ltr" },
      { id: 'lname', label: "نام خانوادگی", value: profile.last_name || "—", dir: "ltr" },
      { id: 'email', label: "ایمیل", value: profile.email || "—", dir: "ltr" },
      { id: 'phone', label: "شماره تماس", value: profile.mobile_number || profile.phone_number || "—", dir: "ltr" },
      { id: 'dob', label: "تاریخ تولد", value: dobEn, dir: "ltr" },
      { id: 'address', label: "محل سکونت", value: fullAddress || "—", dir: "ltr" },
      { id: 'doc', label: "مدارک بارگذاری شده", value: docTypeFa, dir: "rtl" } // فقط این مورد راست‌چین است
    ];
  }, [profile]);

  const handleWhatsAppSubmit = (rawAmount: number, appliedFee: number, tailoredRate: number, resultNumber: number, txType: string) => {
    if (!profile || !isApproved || rawAmount <= 0) return;
    const actionLabel = txType === "sell_aud" ? "فروش AUD" : "خرید AUD";
    const message = `*درخواست حواله اختصاصی زرمان*\n\n👤 مشتری: ${displayFullName}\n🆔 شناسه کاربر: ${profile.id}\n🔄 نوع درخواست: ${actionLabel}\n💵 مقدار: ${rawAmount} AUD\n📉 نرخ پایه بازار: ${Math.round(baseRate)} تومان\n🎁 تخفیف وفاداری: ${loyaltyBonus} تومان\n📌 نرخ اختصاصی نهایی: ${Math.round(tailoredRate)} تومان\n⚠️ کارمزد: ${appliedFee} AUD\n💰 معادل نهایی: ${Math.round(resultNumber)} تومان`;
    window.open(`https://wa.me/61497851631?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  if (!sessionChecked || loading) return <div className={shellStyles.dashboardWrapper} data-theme={theme}><div className={shellStyles.loadingState}>در حال برقراری اتصال امن با دیتابیس...</div></div>;

  return (
    <div className={shellStyles.dashboardWrapper} data-theme={theme}>
      <DashboardSidebar activeTab={activeTab} setActiveTab={setActiveTab} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} theme={theme} setTheme={setTheme} />
      
      <main className={shellStyles.mainArea}>
        <DashboardHeader displayFullName={displayFullName} isApproved={isApproved} setMobileMenuOpen={setMobileMenuOpen} />
        <DashboardStats totalVolume={totalVolume} transactionCount={transactions.length} baseRate={baseRate} loyaltyBonus={loyaltyBonus} />
        
        {activeTab === "hub" && <DashboardRequestHub isApproved={isApproved} txType={txType} setTxType={setTxType} amountStr={amountStr} setAmountStr={setAmountStr} loyaltyBonus={loyaltyBonus} tailoredRate={txType === "sell_aud" ? baseRate + loyaltyBonus : baseRate - loyaltyBonus} handleWhatsAppSubmit={handleWhatsAppSubmit} baseRate={baseRate} />}
        {activeTab === "history" && <DashboardTransactionHistory transactions={transactions} />}
        {activeTab === "profile" && <DashboardProfile profileFields={profileFields} profileId={profile?.id} />}
        {activeTab === "feedback" && <DashboardFeedback profileId={profile?.id || ""} />}
      </main>
    </div>
  );
}