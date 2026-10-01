import Link from "next/link";
import { getKycQueue, getKycHistory } from "@/app/actions/admin.actions";
import { IdentityVerificationTable } from "@/components/admin/IdentityVerificationTable";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { parseAdminPage, parseAdminPageSize } from "@/lib/admin-pagination";
import shell from "@/styles/admin/AdminShell.module.css";
import styles from "@/styles/admin/AdminWorkspace.module.css";

export const metadata = { title: "Identity Verification | Zarman Admin" };
export default async function KycQueuePage({ searchParams }: { searchParams: Promise<{ page?: string; pageSize?: string; view?: string }> }) {
  const params = await searchParams;
  const currentPage = parseAdminPage(params.page);
  const pageSize = parseAdminPageSize(params.pageSize);
  const historyView = params.view === "history" || (!!params.page && params.view !== "active");
  const [queue, { data: history, total }] = await Promise.all([getKycQueue(), getKycHistory(currentPage, pageSize)]);
  return <>
    <div className={shell.topBar}><span className={shell.pageTitle}>Identity Verification</span></div>
    <div className={shell.pageContent}>
      <div className={styles.header}><div><h1>Identity Verification</h1><p>Review customer documents and manage verification.</p></div></div>
      <nav className={styles.tabs} aria-label="Verification views">
        <Link href={`/admin/kyc?view=active&pageSize=${pageSize}`} aria-current={!historyView ? "page" : undefined}>Awaiting review<span>{queue.length}</span></Link>
        <Link href={`/admin/kyc?view=history&pageSize=${pageSize}`} aria-current={historyView ? "page" : undefined}>History<span>{total}</span></Link>
      </nav>
      <section className={styles.panel} hidden={historyView} aria-label="Awaiting verification">
        <div className={styles.toolbar}><h2 className={styles.panelTitle}>Awaiting review</h2><span className={styles.recordCount}>{queue.length} records</span></div>
        <IdentityVerificationTable users={queue} emptyMessage="No pending identity reviews." />
      </section>
      <section className={styles.panel} hidden={!historyView} aria-label="Verification history">
        <div className={styles.toolbar}><h2 className={styles.panelTitle}>Verification history</h2><span className={styles.recordCount}>{total.toLocaleString("en-AU")} records</span></div>
        <IdentityVerificationTable users={history} emptyMessage={total ? "No history on this page. Choose another page below." : "No verification history yet."} />
        <AdminPagination currentPage={currentPage} totalCount={total} pageSize={pageSize} />
      </section>
    </div>
  </>;
}
