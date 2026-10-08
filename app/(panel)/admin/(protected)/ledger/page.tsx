import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, ChartNoAxesCombined, ListFilter } from "lucide-react";
import { getLedgerData, getActiveBankAccountsForAdmin } from "@/app/actions/admin.actions";
import { LedgerEntriesWorkspace } from "@/components/admin/ledger/LedgerEntriesWorkspace";
import { AdminRefreshButton } from "@/components/admin/ui/AdminRefreshButton";
import LedgerToolbar from "@/components/admin/ledger/LedgerToolbar";
import LedgerInsights from "@/components/admin/ledger/LedgerInsights";
import { ledgerFiltersForView, ledgerViewHref, type LedgerSearchParams } from "@/lib/admin-ledger-view";
import { parseAdminPage, parseAdminPageSize } from "@/lib/admin-pagination";
import shell from "@/styles/admin/AdminShell.module.css";
import styles from "@/styles/admin/LedgerWorkspace.module.css";
import shared from "@/styles/admin/AdminWorkspace.module.css";

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
  const filterKey = JSON.stringify(params);

  return <>
    <header className={shell.topBar}>
      <div className={styles.breadcrumb}><span>Finance</span><span aria-hidden="true">/</span><span className={shell.pageTitle}>Ledger</span></div>
      <AdminRefreshButton />
    </header>
    <div className={shell.pageContent}>
      <div className={styles.workspace}>
        <div className={shared.header}>
          <div><h1>Ledger</h1><p>Review transactions, manage entries and follow the flow of funds.</p></div>
          <Link className={shared.action} href="/admin/reports/accounts">Account statements <ArrowUpRight size={14} /></Link>
        </div>
        <nav className={shared.tabs} aria-label="Ledger views">
          <Link href={ledgerViewHref(params, "entries")} aria-current={!insights ? "page" : undefined}><ListFilter size={16} /> Entries</Link>
          <Link href={ledgerViewHref(params, "insights")} aria-current={insights ? "page" : undefined} prefetch={false}><ChartNoAxesCombined size={16} /> Insights</Link>
        </nav>
        <LedgerToolbar key={filterKey} currentParams={params} bankAccounts={bankAccounts} exportFilters={filters} />
        {insights ? <Suspense key={filterKey} fallback={<div className={styles.insightLoading} role="status">Loading ledger insights…</div>}><LedgerInsights filters={filters} /></Suspense> :
          records && <LedgerEntriesWorkspace key={filterKey} initialRecords={records} initialAccounts={bankAccounts}
            currentPage={currentPage} pageSize={pageSize} filters={filters} />
        }
      </div>
    </div>
  </>;
}
