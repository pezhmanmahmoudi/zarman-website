"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import styles from "@/styles/admin/AdminDashboard.module.css";

export function AdminRefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button type="button" className={styles.refreshButton} disabled={pending} aria-busy={pending} onClick={() => startTransition(() => router.refresh())}>
    <RefreshCw size={14} className={pending ? styles.spinning : undefined} />
    <span aria-live="polite">{pending ? "Refreshing…" : "Refresh"}</span>
  </button>;
}
