"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import styles from "@/styles/admin/AdminPageState.module.css";

export function AdminRefreshNotice({ error, refreshing, onRefresh }: {
  error: boolean; refreshing: boolean; onRefresh: () => Promise<void>;
}) {
  if (!error && !refreshing) return null;
  if (!error) return <p className={styles.refreshStatus} role="status"><RefreshCw size={15} className={styles.spinner} aria-hidden="true" />Updating information…</p>;
  return <div className={styles.refreshNotice} role="alert">
    <AlertTriangle size={20} aria-hidden="true" />
    <div><strong>Latest information is temporarily unavailable</strong>
      <p>Showing the last loaded information. Refresh checks the latest state without repeating your action.</p></div>
    <button type="button" onClick={() => void onRefresh()} disabled={refreshing}>
      <RefreshCw size={15} className={refreshing ? styles.spinner : undefined} aria-hidden="true" />
      {refreshing ? "Refreshing…" : "Try refresh"}
    </button>
  </div>;
}
