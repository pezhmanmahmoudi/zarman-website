"use client";

import { RefreshCw } from "lucide-react";
import { reloadAdminPage } from "@/lib/admin-refresh";
import styles from "@/styles/admin/AdminDashboard.module.css";

export function AdminRefreshButton() {
  return <button type="button" className={styles.refreshButton} onClick={() => reloadAdminPage()}>
    <RefreshCw size={14} />
    <span>Refresh</span>
  </button>;
}
