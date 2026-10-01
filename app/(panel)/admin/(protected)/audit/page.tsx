import { getAuditLogs } from "@/app/actions/admin.actions";
import { AuditLogTable } from "@/components/admin/AuditLogTable";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { parseAdminPage, parseAdminPageSize } from "@/lib/admin-pagination";
import shell from "@/styles/admin/AdminShell.module.css";
import styles from "@/styles/admin/AdminWorkspace.module.css";
export const metadata = { title: "Audit Log | Zarman Admin" };
export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string; pageSize?: string }> }) {
  const params = await searchParams;
  const currentPage = parseAdminPage(params.page);
  const pageSize = parseAdminPageSize(params.pageSize);
  const { data: logs, total } = await getAuditLogs(currentPage, pageSize);
  return <>
    <div className={shell.topBar}><span className={shell.pageTitle}>Audit Log</span></div>
    <div className={shell.pageContent}>
      <div className={styles.header}><div><h1>Audit Log</h1><p>Who changed a record, when, and what changed.</p></div></div>
      <section className={styles.panel} aria-label="Audit records">
        <div className={styles.toolbar}><h2 className={styles.panelTitle}>Activity</h2><span className={styles.recordCount}>{total.toLocaleString("en-AU")} records</span></div>
        <AuditLogTable logs={logs} total={total} />
        <AdminPagination currentPage={currentPage} totalCount={total} pageSize={pageSize} />
      </section>
    </div>
  </>;
}
