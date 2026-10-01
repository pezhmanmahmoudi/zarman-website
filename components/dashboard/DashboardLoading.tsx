"use client";

import { useLocale } from "@/context/LocaleContext";
import { dashboardCopy } from "@/lib/dashboard/navigation";
import { DashboardLottieScene } from "./DashboardLottieScene";
import styles from "@/styles/dashboard/DashboardShell.module.css";

/** Same light surface before providers, during authentication and inside lazy panels. */
export function DashboardLoading({ fullPage = false }: { fullPage?: boolean }) {
  const copy = dashboardCopy[useLocale()];
  return <div className={`${styles.loadingState}${fullPage ? ` ${styles.loadingPage}` : ""}`} role="status" aria-label={copy.loading} aria-busy="true" data-dashboard-loading={fullPage ? "page" : "panel"}>
    <DashboardLottieScene name="dashboard-loading" size={112} />
    <span className={styles.srOnly}>{copy.loading}</span>
  </div>;
}
