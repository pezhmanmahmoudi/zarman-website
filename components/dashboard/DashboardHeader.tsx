"use client";

import React from "react";
import { ShieldCheck, Clock } from "lucide-react";
import styles from "@/styles/dashboard/DashboardHeader.module.css";
import shellStyles from "@/styles/dashboard/DashboardShell.module.css";
import { useT } from "@/hooks/useT";

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
  const t = useT();

  return (
    <>
      <div className={shellStyles.mobileTopbar}>
        <button
          type="button"
          className={`${shellStyles.mobileMenuBtn} ${
            mobileMenuOpen ? shellStyles.mobileMenuBtnActive : ""
          }`}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? t.header.closeMenu : t.header.openMenu}
          aria-expanded={mobileMenuOpen}
          aria-controls="dashboard-mobile-sidebar"
        >
          <span></span>
          <span></span>
        </button>
      </div>

      <header className={styles.headerCard}>
        <div className={styles.headerContent}>
          <span className={styles.headerEyebrow}>{t.dashboard.title}</span>

          <h1 className={styles.headerTitle} dir="ltr">
            Hi <span className={styles.textAccent}>{firstName}</span>!
          </h1>

          <p className={styles.headerDescription}>
            {t.dashboard.welcome}
            <br />
            {t.dashboard.welcomeDetail}
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
              {isApproved ? t.dashboard.kycApproved : t.dashboard.kycPending}
            </strong>
          </div>
        </div>
      </header>
    </>
  );
}