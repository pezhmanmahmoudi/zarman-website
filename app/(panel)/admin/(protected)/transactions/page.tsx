import React from "react";
import { parseAdminPage, parseAdminPageSize } from "@/lib/admin-pagination";
import { getAdminTransactionWorkspace } from "@/app/actions/admin.actions";
import {
  TransactionsManager,
  type BankAccountOption,
  type TransactionRow,
} from "@/components/admin/transactions/TransactionsManager";

export const metadata = { title: "Transactions | Zarman Admin" };

type HistoryStatusFilter = "all" | "approved" | "rejected" | "archived";
type HistoryDirectionFilter = "all" | "incoming" | "outgoing";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    view?: string;
    q?: string;
    pageSize?: string;
    status?: string;
    direction?: string;
    start?: string;
    end?: string;
  }>;
}) {
  const params = await searchParams;
  const view = params.view === "history" || (params.view !== "active" && (params.status || params.page || params.direction || params.start || params.end || params.q)) ? "history" : "active";
  const search = params.q?.slice(0, 64) ?? "";
  const currentPage = parseAdminPage(params.page);
  const pageSize = parseAdminPageSize(params.pageSize);
  const normalizedStatus = (params.status ?? "all").toLowerCase();
  const historyStatus: HistoryStatusFilter =
    normalizedStatus === "approved" ||
    normalizedStatus === "rejected" ||
    normalizedStatus === "archived"
      ? (normalizedStatus as HistoryStatusFilter)
      : "all";
  const historyDirection: HistoryDirectionFilter =
    params.direction === "incoming" || params.direction === "outgoing" ? params.direction : "all";
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const startDate = params.start && datePattern.test(params.start) ? params.start : "";
  const endDate = params.end && datePattern.test(params.end) ? params.end : "";

  const { pending, history, total, statusCounts, bankAccounts } = await getAdminTransactionWorkspace(
    view, currentPage, pageSize, {
      status: historyStatus,
      direction: historyDirection,
      startDate,
      endDate,
      search,
    },
  );

  const statusTabs: Array<{ key: HistoryStatusFilter; label: string; count: number }> = [
    { key: "all", label: "All", count: statusCounts.all },
    { key: "approved", label: "Completed / approved", count: statusCounts.approved },
    { key: "rejected", label: "Rejected", count: statusCounts.rejected },
    { key: "archived", label: "Archived", count: statusCounts.archived },
  ];

  return (
    <TransactionsManager
      key={`${view}-${currentPage}-${pageSize}-${historyStatus}-${historyDirection}-${startDate}-${endDate}-${search}`}
      view={view}
      search={search}
      pending={pending as TransactionRow[]}
      history={history as TransactionRow[]}
      total={total}
      currentPage={currentPage}
      pageSize={pageSize}
      historyStatus={historyStatus}
      historyDirection={historyDirection}
      startDate={startDate}
      endDate={endDate}
      statusTabs={statusTabs}
      bankAccounts={(bankAccounts || []) as BankAccountOption[]}
    />
  );
}
