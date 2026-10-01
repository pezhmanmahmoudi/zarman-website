"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import shellStyles from "@/styles/admin/AdminShell.module.css";
import styles from "@/styles/admin/AdminPageState.module.css";

// Every admin Server Action (approve/reject/edit/etc.) is followed by an
// automatic Next.js router refresh of the current route — separate from,
// and before, this app's own explicit post-save reload. If that automatic
// refresh hits a transient hiccup (e.g. an in-flight auth cookie rotation),
// it throws here right as the mutation succeeds. Auto-reloading immediately
// instead of showing a dead-end error card turns that into an near-instant,
// self-healing refresh. A short session-scoped guard stops this from
// looping forever if the failure is actually persistent.
const AUTO_RELOAD_STORAGE_KEY = "admin-error-auto-reload-at";
const AUTO_RELOAD_WINDOW_MS = 5_000;

export default function AdminError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  // Next.js's documented error.tsx contract: always log the caught error so
  // the real cause is visible in runtime/server logs instead of being
  // silently discarded (this is what makes the next occurrence diagnosable).
  useEffect(() => {
    console.error("[admin error boundary]", error);
  }, [error]);

  // Computed once, synchronously, during the initial render — not inside the
  // effect below — so this component never calls setState from an effect.
  const [recentAutoReload] = useState(() => {
    try {
      const lastAttempt = Number(sessionStorage.getItem(AUTO_RELOAD_STORAGE_KEY) ?? 0);
      return Date.now() - lastAttempt < AUTO_RELOAD_WINDOW_MS;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (recentAutoReload) return;
    try {
      sessionStorage.setItem(AUTO_RELOAD_STORAGE_KEY, String(Date.now()));
    } catch {
      // sessionStorage unavailable (e.g. private browsing) — still reload once.
    }
    window.location.reload();
  }, [recentAutoReload]);

  const reload = () => window.location.reload();
  const openDashboard = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.location.assign("/admin/dashboard");
  };

  if (!recentAutoReload) {
    return (
      <>
        <div className={shellStyles.topBar}>
          <span className={shellStyles.pageTitle}>Admin workspace</span>
        </div>
        <div className={shellStyles.pageContent}>
          <section className={styles.errorCard} role="status" aria-live="polite" aria-labelledby="admin-refresh-title">
            <span className={styles.errorIcon}><RefreshCw size={25} aria-hidden="true" /></span>
            <h1 id="admin-refresh-title">Refreshing…</h1>
            <p>Applying your latest change.</p>
          </section>
        </div>
      </>
    );
  }

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

