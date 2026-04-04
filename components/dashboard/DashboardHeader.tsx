import React from "react";
import { ShieldCheck, Clock, Menu } from "lucide-react";
import styles from "@/styles/dashboard/DashboardHeader.module.css";
import shellStyles from "@/styles/dashboard/DashboardShell.module.css";

export function DashboardHeader({ displayFullName, isApproved, setMobileMenuOpen }: any) {
  return (
    <>
      <div className={shellStyles.mobileTopbar}>
        <button className={shellStyles.mobileMenuBtn} onClick={() => setMobileMenuOpen(true)}><Menu size={22} /></button>
        <div className={shellStyles.mobileBrand}><strong>ZARMAN</strong><span>Dashboard</span></div>
      </div>
      <header className={styles.headerCard}>
        <div className={styles.headerContent}>
          <span className={styles.headerEyebrow}>پنل مدیریت صرافی زارمن</span>
          <h1 className={styles.headerTitle}>سلام، {displayFullName}!</h1>
          <p className={styles.headerDescription}>به محیط امن زارمن اکسچنج خوش آمدید. از اینجا می‌توانید حواله‌های خود را مدیریت کنید، نرخ اختصاصی خود را ببینید و وضعیت احراز هویت خود را پیگیری کنید.</p>
        </div>
        <div className={styles.headerStatus}>
          <div className={`${styles.kycBadge} ${isApproved ? styles.kyc_success : styles.kyc_warning}`}>
            {isApproved ? <ShieldCheck size={20} /> : <Clock size={20} />}
            <strong>{isApproved ? "هویت تایید شده" : "در انتظار تایید هویت"}</strong>
          </div>
        </div>
      </header>
    </>
  );
}