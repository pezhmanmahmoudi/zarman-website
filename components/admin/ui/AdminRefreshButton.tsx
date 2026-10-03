"use client";

import { RefreshCw } from "lucide-react";
import { useAdminRefresh } from "./useAdminRefresh";
import styles from "@/styles/admin/AdminDashboard.module.css";

export function AdminRefreshButton() {
  const refreshAdmin = useAdminRefresh();
  return <button type="button" className={styles.refreshButton} onClick={refreshAdmin}>
    <RefreshCw size={14} />
    <span>Refresh</span>
  </button>;
}
