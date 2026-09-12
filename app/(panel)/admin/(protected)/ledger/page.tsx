import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, ChartNoAxesCombined, ListFilter } from "lucide-react";
import { getLedgerData, getActiveBankAccountsForAdmin } from "@/app/actions/admin.actions";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { EditableLedgerTable, type LedgerRow } from "@/components/admin/EditableLedgerTable";
import { AdminRefreshButton } from "@/components/admin/ui/AdminRefreshButton";
import LedgerToolbar from "@/components/admin/ledger/LedgerToolbar";
import LedgerDrillDown from "@/components/admin/ledger/LedgerDrillDown";
import LedgerInsights from "@/components/admin/ledger/LedgerInsights";
import { ledgerFiltersForView, ledgerViewHref, type LedgerSearchParams } from "@/lib/admin-ledger-view";
import { parseAdminPage, parseAdminPageSize } from "@/lib/admin-pagination";
import shell from "@/styles/admin/AdminShell.module.css";
import styles from "@/styles/admin/LedgerWorkspace.module.css";

export const metadata = { title: "Ledger | Zarman Admin" };
export const dynamic = "force-dynamic";

export default async function LedgerPage({ searchParams }: { searchParams: Promise<LedgerSearchParams> }) {
  const params = await searchParams;
  const insights = params.view === "insights";
  const pageSize = parseAdminPageSize(params.pageSize, 20);
  const currentPage = parseAdminPage(params.page);
  const filters = ledgerFiltersForView(params);
  const [bankAccounts, records] = await Promise.all([
    getActiveBankAccountsForAdmin(),
    insights ? Promise.resolve(null) : getLedgerData(currentPage, pageSize, filters),
  ]);
  if (records && currentPage > Math.max(1, Math.ceil(records.total / pageSize))) {
    const next = { ...params, page: String(Math.max(1, Math.ceil(records.total / pageSize))) };
    redirect(ledgerViewHref(next, "entries"));
  }
  const rows = (records?.pageLedgerRows ?? []) as LedgerRow[];
  const rowDataMap = Object.fromEntries(rows.map(row => [row.id, row]));
  const total = records?.total ?? 0;
  const filterKey = JSON.stringify(params);

  return <>
    <header className={shell.topBar}>
      <div className={styles.breadcrumb}><span>Finance</span><span aria-hidden="true">/</span><span className={shell.pageTitle}>Ledger</span></div>
      <AdminRefreshButton />
    </header>
    <div className={shell.pageContent}>
      <div className={styles.workspace}>
        <div className={styles.heading}>
          <div><h1>Ledger</h1><p>Review transactions, manage entries and follow the flow of funds.</p></div>
          <Link className={styles.headingLink} href="/admin/reports/accounts">Account statements <ArrowUpRight size={14} /></Link>
        </div>
        <nav className={styles.tabs} aria-label="Ledger views">
          <Link href={ledgerViewHref(params, "entries")} className={`${styles.tab} ${!insights ? styles.tabActive : ""}`} aria-current={!insights ? "page" : undefined}><ListFilter size={16} /> Entries</Link>
          <Link href={ledgerViewHref(params, "insights")} className={`${styles.tab} ${insights ? styles.tabActive : ""}`} aria-current={insights ? "page" : undefined} prefetch={false}><ChartNoAxesCombined size={16} /> Insights</Link>
        </nav>
        <LedgerToolbar key={filterKey} currentParams={params} bankAccounts={bankAccounts} exportFilters={filters} />
        {insights ? <Suspense key={filterKey} fallback={<div className={styles.insightLoading} role="status">Loading ledger insights…</div>}><LedgerInsights filters={filters} /></Suspense> :
          <section className={styles.tablePanel} aria-labelledby="ledger-records-title">
            <div className={styles.paginationTop}>
              <AdminPagination label="Ledger pagination above entries" currentPage={currentPage} totalCount={total} pageSize={pageSize} />
            </div>
            <LedgerDrillDown ledgerDataMap={rowDataMap}>
              <EditableLedgerTable rows={rows} bankAccounts={bankAccounts} titleSlot={
                <div className={styles.recordHeading}><h2 id="ledger-records-title">All entries</h2><span className={styles.recordCount}>{total.toLocaleString("en-AU")} {total === 1 ? "record" : "records"}</span></div>
              } />
            </LedgerDrillDown>
            <div className={styles.paginationBottom}>
              <AdminPagination label="Ledger pagination below entries" currentPage={currentPage} totalCount={total} pageSize={pageSize} />
            </div>
          </section>
        }
      </div>
    </div>
  </>;
}
