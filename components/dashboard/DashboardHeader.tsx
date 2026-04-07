import React from "react";
import { ShieldCheck, Clock, Menu } from "lucide-react";
import styles from "@/styles/dashboard/DashboardHeader.module.css";
import shellStyles from "@/styles/dashboard/DashboardShell.module.css";

export function DashboardHeader({ firstName, isApproved, setMobileMenuOpen }: any) {
  return (
    <>
      <div className={shellStyles.mobileTopbar}>
        <button className={shellStyles.mobileMenuBtn} onClick={() => setMobileMenuOpen(true)}>
          <Menu size={22} />
        </button>
        {/* 👈 نوشته‌های Zarman Dashboard از نوار بالایی حذف شدند */}
      </div>
      
      <header className={styles.headerCard}>
        <div className={styles.headerContent}>
          <span className={styles.headerEyebrow}>پنل مدیریت تراکنش کاربر</span>
          
          <h1 className={styles.headerTitle} dir="ltr" style={{ textAlign: "right", fontFamily: "inherit", color: "#bf00ff" }}>
            Hi {firstName}!
          </h1>
          
          <p className={styles.headerDescription}>
            به پنل مدیریت تراکنش خوش آمدید.
            <br />
            از اینجا می‌توانید حواله‌های خود را مدیریت کنید، نرخ اختصاصی خود را ببینید و وضعیت احراز هویت خود را پیگیری کنید.
          </p>
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