"use client";

import { useCallback } from "react";
import { useAdminSnapshot } from "@/components/admin/ui/useAdminSnapshot";
import { AdminRefreshScope } from "@/components/admin/ui/AdminRefreshScope";
import { AdminRefreshNotice } from "@/components/admin/ui/AdminRefreshNotice";
import { AdminRefreshButton } from "@/components/admin/ui/AdminRefreshButton";
import Link from "next/link";
import { getKycQueue, getKycHistory } from "@/app/actions/admin.actions";
import { IdentityVerificationTable, type IdentityRecord } from "@/components/admin/IdentityVerificationTable";
import { AdminPagination } from "@/components/admin/AdminPagination";
import shell from "@/styles/admin/AdminShell.module.css";
import styles from "@/styles/admin/AdminWorkspace.module.css";

type KycSnapshot = { queue: IdentityRecord[]; history: IdentityRecord[]; total: number };
export function KycWorkspace({ initialData, currentPage, pageSize, historyView }: {
  initialData: KycSnapshot; currentPage: number; pageSize: number; historyView: boolean;
}) {
  const load = useCallback(async () => {
    const [queue, history] = await Promise.all([getKycQueue(), getKycHistory(currentPage, pageSize)]);
    return { queue, history: history.data, total: history.total };
  }, [currentPage, pageSize]);
  const { data, refresh, update, refreshing, refreshError } = useAdminSnapshot<KycSnapshot>(initialData, load);
  const { queue, history, total } = data;
  const commitStatus = (user: IdentityRecord, status: "approved" | "rejected" | "archived") => {
    update(previous => {
      const wasPending = previous.queue.some(row => row.id === user.id);
      const changed = { ...user, kyc_status: status };
      const nextHistory = previous.history.map(row => row.id === user.id ? changed : row);
      if (wasPending && currentPage === 1 && !nextHistory.some(row => row.id === user.id)) {
        nextHistory.push(changed);
        nextHistory.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      }
      return { queue: previous.queue.filter(row => row.id !== user.id),
        history: nextHistory.slice(0, pageSize), total: previous.total + (wasPending ? 1 : 0) };
    });
  };
  return <AdminRefreshScope refresh={refresh}>
    <div className={shell.topBar}><span className={shell.pageTitle}>Identity Verification</span></div>
    <div className={shell.pageContent}>
      <div className={styles.header}><div><h1>Identity Verification</h1><p>Review customer documents and manage verification.</p></div><AdminRefreshButton /></div>
      <AdminRefreshNotice error={refreshError} refreshing={refreshing} onRefresh={refresh} />
      <nav className={styles.tabs} aria-label="Verification views">
        <Link href={`/admin/kyc?view=active&pageSize=${pageSize}`} aria-current={!historyView ? "page" : undefined}>Awaiting review<span>{queue.length}</span></Link>
        <Link href={`/admin/kyc?view=history&pageSize=${pageSize}`} aria-current={historyView ? "page" : undefined}>History<span>{total}</span></Link>
      </nav>
      <section className={styles.panel} hidden={historyView} aria-label="Awaiting verification">
        <div className={styles.toolbar}><h2 className={styles.panelTitle}>Awaiting review</h2><span className={styles.recordCount}>{queue.length} records</span></div>
        <IdentityVerificationTable onStatusChange={commitStatus} users={queue} emptyMessage="No pending identity reviews." />
      </section>
      <section className={styles.panel} hidden={!historyView} aria-label="Verification history">
        <div className={styles.toolbar}><h2 className={styles.panelTitle}>Verification history</h2><span className={styles.recordCount}>{total.toLocaleString("en-AU")} records</span></div>
        <IdentityVerificationTable onStatusChange={commitStatus} users={history} emptyMessage={total ? "No history on this page. Choose another page below." : "No verification history yet."} />
        <AdminPagination currentPage={currentPage} totalCount={total} pageSize={pageSize} />
      </section>
    </div>
  </AdminRefreshScope>;
}
