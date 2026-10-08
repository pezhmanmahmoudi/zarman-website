"use client";

import { useCallback, useMemo } from "react";
import { getLedgerData, getActiveBankAccountsForAdmin, type AdminLedgerFilters } from "@/app/actions/admin.actions";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminRefreshButton } from "@/components/admin/ui/AdminRefreshButton";
import { AdminRefreshNotice } from "@/components/admin/ui/AdminRefreshNotice";
import { AdminRefreshScope } from "@/components/admin/ui/AdminRefreshScope";
import { useAdminSnapshot } from "@/components/admin/ui/useAdminSnapshot";
import { LedgerEntriesTable, type LedgerRow } from "./LedgerEntriesTable";
import styles from "@/styles/admin/LedgerWorkspace.module.css";
import shared from "@/styles/admin/AdminWorkspace.module.css";

type Records = Awaited<ReturnType<typeof getLedgerData>>;
type Accounts = Awaited<ReturnType<typeof getActiveBankAccountsForAdmin>>;
export function LedgerEntriesWorkspace({ initialRecords, initialAccounts, currentPage, pageSize, filters }: {
  initialRecords: Records; initialAccounts: Accounts; currentPage: number; pageSize: number; filters: AdminLedgerFilters;
}) {
  const initialData = useMemo(() => ({ records: initialRecords, accounts: initialAccounts, page: currentPage }), [initialRecords, initialAccounts, currentPage]);
  const load = useCallback(async () => {
    const [records, accounts] = await Promise.all([getLedgerData(currentPage, pageSize, filters), getActiveBankAccountsForAdmin()]);
    const page = Math.min(currentPage, Math.max(1, Math.ceil(records.total / pageSize)));
    return { records: page === currentPage ? records : await getLedgerData(page, pageSize, filters), accounts, page };
  }, [currentPage, pageSize, filters]);
  const { data, refresh, refreshing, refreshError } = useAdminSnapshot(initialData, load);
  const { records, accounts, page } = data;
  return <AdminRefreshScope refresh={refresh}>
    <AdminRefreshNotice error={refreshError} refreshing={refreshing} onRefresh={refresh} />
    <section className={shared.panel} aria-labelledby="ledger-records-title">
      <div className={styles.paginationTop}>
        <AdminPagination label="Ledger pagination above entries" currentPage={page} totalCount={records.total} pageSize={pageSize} />
      </div>
      <LedgerEntriesTable rows={records.pageLedgerRows as LedgerRow[]} bankAccounts={accounts} titleSlot={
        <div className={shared.headerActions}><h2 id="ledger-records-title" className={shared.panelTitle}>All entries</h2>
          <span className={shared.recordCount}>{records.total.toLocaleString("en-AU")} {records.total === 1 ? "record" : "records"}</span><AdminRefreshButton /></div>
      } />
      <div className={styles.paginationBottom}>
        <AdminPagination label="Ledger pagination below entries" currentPage={page} totalCount={records.total} pageSize={pageSize} />
      </div>
    </section>
  </AdminRefreshScope>;
}
