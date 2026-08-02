import React from "react";
import {
  getPendingTransactionsWithDetails,
  getTransactionHistoryWithDetails,
  getTransactionHistoryStatusCounts,
} from "@/app/actions/admin.actions";
import { createClient } from "@supabase/supabase-js";
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
    pageSize?: string;
    status?: string;
    direction?: string;
    start?: string;
    end?: string;
  }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const requestedPageSize = parseInt(params.pageSize ?? "10", 10);
  const pageSize = [10, 25, 50].includes(requestedPageSize) ? requestedPageSize : 10;
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

  // تعریف کلاینت دیتابیس برای خواندن حساب‌های بانکی
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // اجرای موازی و سریع ۳ کوئری دیتابیس
  const [pending, { data: history, total }, statusCounts, { data: bankAccounts }] = await Promise.all([
    getPendingTransactionsWithDetails(),
    getTransactionHistoryWithDetails(currentPage, pageSize, {
      status: historyStatus,
      direction: historyDirection,
      startDate,
      endDate,
    }),
    getTransactionHistoryStatusCounts(),
    db.from("bank_accounts").select("*").eq("is_active", true)
  ]);

  const statusTabs: Array<{ key: HistoryStatusFilter; label: string; count: number }> = [
    { key: "all", label: "All", count: statusCounts.all },
    { key: "approved", label: "Approved", count: statusCounts.approved },
    { key: "rejected", label: "Rejected", count: statusCounts.rejected },
    { key: "archived", label: "Archived", count: statusCounts.archived },
  ];

  return (
    <TransactionsManager
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