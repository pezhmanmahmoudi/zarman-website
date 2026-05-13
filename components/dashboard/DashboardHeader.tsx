"use client";

import React from "react";
import { ShieldCheck, Clock } from "lucide-react";
import styles from "@/styles/dashboard/DashboardHeader.module.css";
import shellStyles from "@/styles/dashboard/DashboardShell.module.css";

type DashboardHeaderProps = {
  firstName: string;
  isApproved: boolean;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
};

export function DashboardHeader({
  firstName,
  isApproved,
  mobileMenuOpen,
  setMobileMenuOpen,
}: DashboardHeaderProps) {
  return (
    <>
      <div className={shellStyles.mobileTopbar}>
        <button
          type="button"
          className={`${shellStyles.mobileMenuBtn} ${
            mobileMenuOpen ? shellStyles.mobileMenuBtnActive : ""
          }`}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "بستن منو" : "باز کردن منو"}
          aria-expanded={mobileMenuOpen}
          aria-controls="dashboard-mobile-sidebar"
        >
          <span></span>
          <span></span>
        </button>
      </div>

      <header className={styles.headerCard}>
        <div className={styles.headerContent}>
          <span className={styles.headerEyebrow}>پنل مدیریت تراکنش کاربر</span>

          {/* 🚀 رنگ‌بندی حرفه‌ای: "Hi" رنگ اصلی و نام کاربر رنگ Accent می‌گیرد */}
          <h1 className={styles.headerTitle} dir="ltr">
            Hi <span className={styles.textAccent}>{firstName}</span>!
          </h1>

          <p className={styles.headerDescription}>
            به پنل مدیریت تراکنش خوش آمدید.
            <br />
            از اینجا می‌توانید ثبت نام خود را برای احراز هویت تکمیل کنید،  درخواست تراکنش دهید، نرخ اختصاصی خود را
            ببینید و حواله‌های خود را مدیریت کنید.
          </p>
        </div>

        <div className={styles.headerStatus}>
          <div
            className={`${styles.kycBadge} ${
              isApproved ? styles.kyc_success : styles.kyc_warning
            }`}
          >
            {isApproved ? <ShieldCheck size={20} /> : <Clock size={20} />}
            <strong>
              {isApproved ? "هویت تایید شده" : "در انتظار تایید هویت"}
            </strong>
          </div>
        </div>
      </header>
    </>
  );
}