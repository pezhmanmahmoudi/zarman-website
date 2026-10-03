"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import shellStyles from "@/styles/admin/AdminShell.module.css";
import styles from "@/styles/admin/AdminPageState.module.css";

export default function AdminError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  // Next.js's documented error.tsx contract: always log the caught error so
  // the real cause is visible in runtime/server logs instead of being
  // silently discarded (this is what makes the next occurrence diagnosable).
  useEffect(() => {
    console.error("[admin error boundary]", error);
  }, [error]);

  const reload = () => window.location.reload();
  const openDashboard = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.location.assign("/admin/dashboard");
  };

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
            <button type="button" onClick={reload}><RefreshCw size={16} aria-hidden="true" /> Try again</button>
            <Link href="/admin/dashboard" onClick={openDashboard}><ArrowLeft size={16} aria-hidden="true" /> Dashboard</Link>
          </div>
        </section>
      </div>
    </>
  );
}

