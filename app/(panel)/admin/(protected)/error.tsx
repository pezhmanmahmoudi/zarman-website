"use client";

import Link from "next/link";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import shellStyles from "@/styles/admin/AdminShell.module.css";
import styles from "@/styles/admin/AdminPageState.module.css";

export default function AdminError({ reset }: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <div className={shellStyles.topBar}>
        <span className={shellStyles.pageTitle}>Admin workspace</span>
      </div>
      <div className={shellStyles.pageContent}>
        <section className={styles.errorCard} role="alert" aria-labelledby="admin-error-title">
          <span className={styles.errorIcon}><AlertTriangle size={25} aria-hidden="true" /></span>
          <h1 id="admin-error-title">This page couldn’t load</h1>
          <p>We couldn’t retrieve the latest information. Try again, or return to the dashboard to continue.</p>
          <div className={styles.errorActions}>
            <button type="button" onClick={reset}><RefreshCw size={16} aria-hidden="true" /> Try again</button>
            <Link href="/admin/dashboard"><ArrowLeft size={16} aria-hidden="true" /> Dashboard</Link>
          </div>
        </section>
      </div>
    </>
  );
}
