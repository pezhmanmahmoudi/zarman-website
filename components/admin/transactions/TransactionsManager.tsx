"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Archive, CalendarDays, Download, RefreshCw, Search, Settings, Trash2, X } from "lucide-react";
import { bulkDeleteTransactions, getPendingTransactionsWithDetails, getTransactionHistoryWithDetails, getTransactionHistoryStatusCounts, getActiveBankAccountsForAdmin } from "@/app/actions/admin.actions";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";
import CustomDatePicker from "@/components/ui/DatePicker/CustomDatePicker";
import { reloadAdminPage } from "@/lib/admin-refresh";
import type { ExchangeRequest } from "@/lib/requests/types";
import { TransactionQueue } from "./TransactionQueue";
import { TransactionTable } from "./TransactionTable";
import workspace from "@/styles/admin/AdminWorkspace.module.css";
import shellStyles from "@/styles/admin/AdminShell.module.css";

type HistoryStatusFilter = "all" | "approved" | "rejected" | "archived";
type HistoryDirectionFilter = "all" | "incoming" | "outgoing";
type SelectionAction = "export" | "delete";

export type TransactionRow = {
  id: string;
  user_id: string;
  recipient_id?: string | null;
  type: "buy_aud" | "sell_aud" | string;
  amount_aud: number | string;
  equivalent_toman: number | string;
  status: string | null;
  created_at: string;
  reference_code?: string | null;
  payment_link?: string | null;
  reason_for_transfer?: string | null;
  receipt_sent?: boolean | null;
  request?: ExchangeRequest | ExchangeRequest[] | null;
  profiles?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    customer_code?: string | null;
  } | null;
  recipients?: {
    direction?: string | null;
    label?: string | null;
    full_name?: string | null;
    account_name?: string | null;
    bank_name?: string | null;
    bsb?: string | null;
    account_number?: string | null;
    card_number?: string | null;
    shaba_number?: string | null;
    bank_type?: string | null;
  } | null;
};

export type BankAccountOption = {
  id: string;
  account_name?: string | null;
  currency?: string | null;
};

interface TransactionsManagerProps {
  view: "active" | "history";
  search: string;
  pending: TransactionRow[];
  history: TransactionRow[];
  total: number;
  currentPage: number;
  pageSize: number;
  historyStatus: HistoryStatusFilter;
  historyDirection: HistoryDirectionFilter;
  startDate: string;
  endDate: string;
  statusTabs: Array<{ key: HistoryStatusFilter; label: string; count: number }>;
  bankAccounts: BankAccountOption[];
}

function parseFileName(contentDisposition: string | null): string {
  if (!contentDisposition) return "AML.Report.AustracIFTI.xlsx";
  const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1]);

  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (plainMatch?.[1]) return plainMatch[1];
  return "AML.Report.AustracIFTI.xlsx";
}

function getIftiReportKind(type: string | null | undefined): "outgoing" | "incoming" | null {
  if (type === "buy_aud") return "outgoing";
  if (type === "sell_aud") return "incoming";
  return null;
}

export function TransactionsManager({
  view,
  search,
  pending: initialPending,
  history: initialHistory,
  total: initialTotal,
  currentPage,
  pageSize,
  historyStatus,
  historyDirection,
  startDate,
  endDate,
  statusTabs: initialStatusTabs,
  bankAccounts: initialBankAccounts,
}: TransactionsManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [data, setData] = useState({ pending: initialPending, history: initialHistory, total: initialTotal, statusTabs: initialStatusTabs, bankAccounts: initialBankAccounts });
  const { pending, history, total, statusTabs, bankAccounts } = data;
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const reading = useRef(false);
  const mounted = useRef(true);
  const refresh = useCallback(async () => {
    if (reading.current) return;
    reading.current = true;
    setRefreshing(true);
    try {
      const [pendingRows, historyPage, counts, accounts] = await Promise.all([
        getPendingTransactionsWithDetails(),
        getTransactionHistoryWithDetails(currentPage, pageSize, { status: historyStatus, direction: historyDirection, startDate, endDate, search }),
        getTransactionHistoryStatusCounts(), getActiveBankAccountsForAdmin(),
      ]);
      if (mounted.current) {
        setData(previous => ({ pending: pendingRows as TransactionRow[], history: historyPage.data as TransactionRow[], total: historyPage.total,
          statusTabs: previous.statusTabs.map(tab => ({ ...tab, count: counts[tab.key] })), bankAccounts: accounts }));
        setRefreshError("");
      }
    } catch {
      if (mounted.current) setRefreshError("Could not refresh transactions. Showing the last loaded records. Please try Refresh again.");
    } finally {
      reading.current = false;
      if (mounted.current) setRefreshing(false);
    }
  }, [currentPage, pageSize, historyStatus, historyDirection, startDate, endDate, search]);
  useEffect(() => {
    mounted.current = true;
    const onFocus = () => { if (document.visibilityState === "visible") void refresh(); };
    const timer = window.setInterval(onFocus, 30000);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    // Preserve old bookmarks to service settings after the queue is redirected.
    if (window.location.hash.startsWith("#request-")) router.replace(`/admin/settings${window.location.hash}`);
    return () => { mounted.current = false; window.clearInterval(timer); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, [refresh, router]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // A background refresh must never turn an export selection into a deletion.
  const selectedSnapshots = useRef(new Map<string, { status: string | null; type: string }>());
  const [searchText, setSearchText] = useState(search);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [filterStart, setFilterStart] = useState(startDate);
  const [filterEnd, setFilterEnd] = useState(endDate);
  const [datesOpen, setDatesOpen] = useState(false);
  const [dateError, setDateError] = useState("");
  const [exportMessage, setExportMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const selectedRows = history.filter(row => {
    const snapshot = selectedSnapshots.current.get(String(row.id));
    return selectedIds.has(String(row.id)) && snapshot?.status === row.status && snapshot?.type === row.type;
  });
  const currentSelectedIds = new Set(selectedRows.map(row => String(row.id)));
  const selectedCount = selectedRows.length;
  const selectionAction: SelectionAction | null = selectedRows.length === 0
    ? null
    : (selectedRows[0].status ?? "").toLowerCase() === "approved"
      ? "export"
      : "delete";
  const selectedExportType = selectionAction === "export" && selectedRows.length > 0 ? selectedRows[0].type : null;
  const selectedKinds = selectionAction === "export"
    ? new Set(selectedRows.map((row) => getIftiReportKind(row.type)))
    : new Set<"outgoing" | "incoming" | null>();
  const hasMixedExportKinds = selectionAction === "export" && selectedKinds.size > 1;
  const reportKind = selectionAction === "export" && !hasMixedExportKinds
    ? getIftiReportKind(selectedExportType)
    : null;
  const defaultSelectionAction: SelectionAction =
    historyStatus === "rejected" || historyStatus === "archived" ? "delete" : "export";

  const updateFilters = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    params.set("page", "1");
    params.set("view", "history");
    setSelectedIds(new Set());
    router.push(`${pathname}?${params.toString()}`);
  };

  const statusHref = (status: HistoryStatusFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    if (status === "all") params.delete("status");
    else params.set("status", status);
    params.set("page", "1");
    params.set("view", "history");
    return `${pathname}?${params.toString()}`;
  };

  const viewHref = (nextView: "active" | "history") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", nextView);
    return `${pathname}?${params.toString()}`;
  };

  const toggleRow = (id: string, checked: boolean) => {
    const row = history.find(item => String(item.id) === id);
    if (checked && row) selectedSnapshots.current.set(id, { status: row.status, type: row.type });
    else selectedSnapshots.current.delete(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAll = (ids: string[], checked: boolean) => {
    for (const id of ids) {
      const row = history.find(item => String(item.id) === id);
      if (checked && row) selectedSnapshots.current.set(id, { status: row.status, type: row.type });
      else selectedSnapshots.current.delete(id);
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        ids.forEach((id) => next.add(id));
      } else {
        ids.forEach((id) => next.delete(id));
      }
      return next;
    });
  };

  const clearSelection = () => {
    selectedSnapshots.current.clear();
    setSelectedIds(new Set());
    setExportMessage(null);
  };

  const downloadBulkReport = async () => {
    if (selectedCount === 0 || selectionAction !== "export") {
      setExportMessage({ type: "error", text: "Select at least one approved transaction first." });
      return;
    }

    if (hasMixedExportKinds || !reportKind) {
      setExportMessage({ type: "error", text: "Select approved rows from one transfer type only (Buy AUD or Sell AUD)." });
      return;
    }

    try {
      setIsExporting(true);
      setExportMessage(null);

      const endpoint = reportKind === "incoming"
        ? "/api/admin/reports/ifti-dra-incoming"
        : "/api/admin/reports/ifti-dra-outgoing";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionIds: selectedRows.map(row => String(row.id)) }),
      });

      if (!response.ok) {
        let message = "Failed to generate IFTI report.";
        try {
          const json = (await response.json()) as { message?: string };
          if (json.message) message = json.message;
        } catch {
          // Use fallback message when response body is not JSON.
        }
        setExportMessage({ type: "error", text: message });
        return;
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition");
      const fileName = parseFileName(disposition);

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);

      const label = reportKind === "incoming" ? "incoming" : "outgoing";
      setExportMessage({ type: "success", text: `IFTI ${label} report generated for ${selectedCount} transaction(s).` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected export error.";
      setExportMessage({ type: "error", text: message });
    } finally {
      setIsExporting(false);
    }
  };

  const deleteSelected = async () => {
    if (selectedCount === 0 || selectionAction !== "delete") return;
    if (!window.confirm(`Permanently delete ${selectedCount} selected transaction(s)? This cannot be undone.`)) return;

    try {
      setIsDeleting(true);
      setExportMessage(null);
      const result = await bulkDeleteTransactions(selectedRows.map(row => String(row.id)));
      if ("error" in result && result.error) {
        setExportMessage({ type: "error", text: result.error });
        return;
      }
      const deletedCount = "deletedCount" in result ? result.deletedCount : selectedCount;
      clearSelection();
      setExportMessage({ type: "success", text: `${deletedCount} transaction(s) deleted.` });
      reloadAdminPage(600);
    } catch (error) {
      setExportMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to delete transactions." });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className={shellStyles.topBar}>
        <span className={shellStyles.pageTitle}>Transactions</span>
      </div>

      <div className={shellStyles.pageContent}>
        <div className={workspace.header}>
          <div>
            <h1>Transactions</h1>
            <p>Requests, payments and completed transfers in one workspace.</p>
          </div>
          <div className={workspace.headerActions}>
            <Link className={workspace.action} href="/admin/settings#request-service"><Settings size={15} aria-hidden="true" />Transfer settings</Link>
            <button type="button" className={workspace.action} onClick={refresh} disabled={refreshing}><RefreshCw size={15} aria-hidden="true" />{refreshing ? "Refreshing…" : "Refresh"}</button>
          </div>
        </div>

        {refreshError && <p className={workspace.error} role="alert">{refreshError}</p>}
        <nav className={workspace.tabs} aria-label="Transaction views">
          <Link href={viewHref("active")} aria-current={view === "active" ? "page" : undefined}>Active<span>{pending.length}</span></Link>
          <Link href={viewHref("history")} aria-current={view === "history" ? "page" : undefined}>History & reports<span>{statusTabs.find(tab => tab.key === "all")?.count ?? total}</span></Link>
        </nav>
        <div hidden={view !== "active"}><TransactionQueue rows={pending} bankAccounts={bankAccounts} /></div>

        <div hidden={view !== "history"} className={workspace.panel}>
          {/* Tab bar */}
          <div className={workspace.toolbar}>
            <nav className={workspace.filters} aria-label="Transaction status filter">
              {statusTabs.map((tab) => {
                const isActive = historyStatus === tab.key;
                return (
                  <Link
                    key={tab.key}
                    href={statusHref(tab.key)}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {tab.label}
                    <span>
                      {tab.count.toLocaleString()}
                    </span>
                  </Link>
                );
              })}
            </nav>
            <span className={workspace.recordCount}>{total.toLocaleString("en-AU")} records</span>
          </div>

          {/* Filter bar */}
          <div className={workspace.historyControls} aria-label="Transaction history filters">
            <form className={workspace.searchForm} role="search" onSubmit={event => { event.preventDefault(); updateFilters({ q: searchText.trim() || null }); }}>
              <label className={workspace.search}><Search size={16} aria-hidden="true" /><span className={workspace.srOnly}>Search transaction history</span>
                <input type="search" value={searchText} maxLength={64} placeholder="Search customer or reference" onChange={event => setSearchText(event.target.value)} />
              </label>
              <button type="submit" className={workspace.action}>Search</button>
            </form>
            <div className={workspace.select} role="group" aria-label="Transfer direction">
              <SelectBox
                labeledOptions={[
                  { label: "All directions", value: "all" },
                  { label: "Australia to Iran", value: "outgoing" },
                  { label: "Iran to Australia", value: "incoming" },
                ]}
                value={historyDirection}
                placeholder="Transfer direction"
                onChange={(value) => updateFilters({ direction: value === "all" ? null : value })}
                dir="ltr"
              />
            </div>

            <button type="button" className={workspace.action} aria-expanded={datesOpen} aria-controls="history-date-filters" onClick={() => setDatesOpen(value => !value)}>
              <CalendarDays size={16} aria-hidden="true" />{startDate && endDate ? `${startDate} – ${endDate}` : startDate ? `From ${startDate}` : endDate ? `Until ${endDate}` : "Date range"}
            </button>

            {(historyDirection !== "all" || startDate || endDate || search) && (
              <button
                type="button"
                className={workspace.action}
                onClick={() => {
                  setFilterStart("");
                  setFilterEnd("");
                  setSearchText("");
                  setDateError("");
                  setDatesOpen(false);
                  updateFilters({ direction: null, start: null, end: null, q: null });
                }}
              >
                <X size={13} />
                Reset filters
              </button>
            )}
          </div>

          <div id="history-date-filters" className={workspace.datePanel} hidden={!datesOpen} role="group" aria-label="Filter by date">
            <div className={workspace.filterField}>
              <span className={workspace.fieldLabel}>From</span>
              <CustomDatePicker value={filterStart} onChange={value => { setFilterStart(value); setDateError(""); }} placeholder="Start date" className={workspace.datePicker} />
            </div>
            <div className={workspace.filterField}>
              <span className={workspace.fieldLabel}>To</span>
              <CustomDatePicker value={filterEnd} onChange={value => { setFilterEnd(value); setDateError(""); }} placeholder="End date" className={workspace.datePicker} />
            </div>
            <button type="button" className={workspace.action} onClick={() => {
              if (filterStart && filterEnd && filterStart > filterEnd) { setDateError("The end date must be on or after the start date."); return; }
              setDateError("");
              setDatesOpen(false);
              updateFilters({ start: filterStart || null, end: filterEnd || null });
            }}>Apply dates</button>
            {dateError && <p className={workspace.dateError} role="alert">{dateError}</p>}
          </div>

          {(selectedCount > 0 || exportMessage) && (
            <div className={workspace.bulkBar}>
              <div>
                <strong>{selectedCount} selected</strong>
                <span>
                  {selectionAction === "delete"
                    ? "Rejected / archived records"
                    : reportKind === "incoming"
                      ? "Incoming · IFTI-DRA"
                      : "Outgoing · IFTI-DRA"}
                </span>
              </div>
              {exportMessage && (
                <span role={exportMessage.type === "error" ? "alert" : "status"} className={exportMessage.type === "error" ? workspace.error : workspace.status}>
                  {exportMessage.text}
                </span>
              )}
              <div className={workspace.headerActions}>
                {selectionAction === "export" && selectedCount > 0 && (
                  <button type="button" onClick={downloadBulkReport} disabled={isExporting} className={workspace.action}>
                    <Download size={14} />
                    {isExporting ? "Generating..." : "Export IFTI (.xlsx)"}
                  </button>
                )}
                {selectionAction === "delete" && selectedCount > 0 && (
                  <button type="button" onClick={deleteSelected} disabled={isDeleting} className={workspace.action} data-tone="danger">
                    <Trash2 size={14} />
                    {isDeleting ? "Deleting..." : "Delete selected"}
                  </button>
                )}
                {selectedCount > 0 && (
                  <button type="button" onClick={clearSelection} disabled={isExporting || isDeleting} className={workspace.action}>
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}

          {history.length === 0 ? (
            <div className={workspace.empty} role="status">
              <Archive size={26} aria-hidden="true" />
              <strong>{statusTabs.find(tab => tab.key === "all")?.count ? "No matching transfers" : "No transfer history yet"}</strong>
              <p>{statusTabs.find(tab => tab.key === "all")?.count ? "Try another status, customer or date range." : "Completed and closed transfers will appear here."}</p>
            </div>
          ) : (
            <>
              <TransactionTable
                rows={history}
                isPending={false}
                bankAccounts={bankAccounts}
                selectedIds={currentSelectedIds}
                onToggleRow={toggleRow}
                onToggleAll={toggleAll}
                selectionAction={selectionAction}
                defaultSelectionAction={defaultSelectionAction}
                selectedExportType={selectedExportType}
              />
            </>
          )}
          <AdminPagination currentPage={currentPage} totalCount={total} pageSize={pageSize} />
        </div>
      </div>
    </>
  );
}
