"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Archive, ArrowLeftRight, Clock, DollarSign, Download, LinkIcon, Trash2, X } from "lucide-react";
import { bulkDeleteTransactions } from "@/app/actions/admin.actions";
import { TransactionApproveButton } from "@/components/admin/TransactionApproveButton";
import { SendReceiptButton } from "@/components/admin/SendReceiptButton";
import { RejectApprovedButton } from "@/components/admin/RejectApprovedButton";
import { EditableReferenceCode } from "@/components/admin/EditableReferenceCode";
import { EditableAmount } from "@/components/admin/EditableAmount";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";
import CustomDatePicker from "@/components/ui/DatePicker/CustomDatePicker";
import shellStyles from "@/styles/admin/AdminShell.module.css";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import tableStyles from "@/styles/admin/AdminTable.module.css";

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

function StatusBadge({ status }: { status: string | null }) {
  const s = (status ?? "").toLowerCase();
  if (s === "approved") {
    return (
      <span className={`${tableStyles.badge} ${tableStyles.badgeApproved}`}>
        <span className={tableStyles.badgeDot} />
        Approved
      </span>
    );
  }
  if (s === "rejected") {
    return (
      <span className={`${tableStyles.badge} ${tableStyles.badgeRejected}`}>
        <span className={tableStyles.badgeDot} />
        Rejected
      </span>
    );
  }
  if (s === "archived") {
    return (
      <span className={`${tableStyles.badge} ${tableStyles.badgeArchived}`}>
        <span className={tableStyles.badgeDot} />
        Archived
      </span>
    );
  }
  return (
    <span className={`${tableStyles.badge} ${tableStyles.badgePending}`}>
      <span className={tableStyles.badgeDot} />
      Pending
    </span>
  );
}

function getPaymentLink(paymentLink?: string | null, reason?: string | null): string | null {
  if (paymentLink) return paymentLink;
  if (!reason) return null;
  const m = reason.match(/لینک پرداخت:\s*(\S+)/);
  return m ? m[1] : null;
}

function RecipientCell({
  recipient,
  paymentLink,
  reasonForTransfer,
}: {
  recipient: TransactionRow["recipients"];
  paymentLink?: string | null;
  reasonForTransfer?: string | null;
}) {
  const normalizedRecipient = Array.isArray(recipient)
    ? (recipient.find(Boolean) ?? null)
    : (recipient ?? null);

  const link = getPaymentLink(paymentLink, reasonForTransfer);
  if (!normalizedRecipient && link) {
    return (
      <div style={{ fontSize: "0.68rem", lineHeight: 1.7 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", fontWeight: 700, color: "var(--accent, #2563eb)" }}>
          <LinkIcon size={11} />
          Payment Link
        </div>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--text-dim)", fontSize: "0.63rem", textDecoration: "underline", fontWeight: 600 }}
        >
          Open payment link
        </a>
      </div>
    );
  }

  if (!normalizedRecipient) return <span style={{ color: "var(--text-dim)" }}>-</span>;

  const r = normalizedRecipient as TransactionRow["recipients"];
  const recipientTitle = r?.account_name ?? r?.full_name ?? r?.label ?? "-";
  if (r?.direction === "aud") {
    return (
      <div style={{ fontSize: "0.68rem", lineHeight: 1.7 }}>
        <div style={{ fontWeight: 700 }}>{recipientTitle}</div>
        {r.bank_name && <div>{r.bank_name}</div>}
        {r.bsb && <div style={{ color: "var(--text-dim)" }}>BSB {r.bsb}</div>}
        {r.account_number && <div style={{ color: "var(--text-dim)" }}>Acc {r.account_number}</div>}
      </div>
    );
  }

  const isMelli = r?.bank_type === "bank_melli";
  return (
    <div style={{ fontSize: "0.68rem", lineHeight: 1.7 }}>
      <div style={{ fontWeight: 700 }}>{recipientTitle}</div>
      <div>{isMelli ? "Bank Melli" : (r?.bank_name ?? "Iranian Bank")}</div>
      {isMelli
        ? r?.card_number && <div style={{ color: "var(--text-dim)" }}>Card {r.card_number}</div>
        : r?.shaba_number && <div style={{ color: "var(--text-dim)" }}>Shaba {r.shaba_number}</div>}
    </div>
  );
}

function parseFileName(contentDisposition: string | null): string {
  if (!contentDisposition) return "AML.Report.AustracOutgoing.xlsx";
  const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1]);

  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (plainMatch?.[1]) return plainMatch[1];
  return "AML.Report.AustracOutgoing.xlsx";
}

function TxTable({
  rows,
  isPending,
  bankAccounts,
  selectedIds,
  onToggleRow,
  onToggleAll,
  selectionAction,
  defaultSelectionAction,
}: {
  rows: TransactionRow[];
  isPending: boolean;
  bankAccounts: BankAccountOption[];
  selectedIds: Set<string>;
  onToggleRow: (id: string, checked: boolean) => void;
  onToggleAll: (ids: string[], checked: boolean) => void;
  selectionAction: SelectionAction | null;
  defaultSelectionAction: SelectionAction;
}) {
  const getRowAction = (row: TransactionRow): SelectionAction | null => {
    const status = (row.status ?? "").toLowerCase();
    if (status === "approved") return "export";
    if (status === "rejected" || status === "archived") return "delete";
    return null;
  };
  const activeAction = selectionAction ?? defaultSelectionAction;
  const eligibleIds = useMemo(
    () => rows.filter((row) => !isPending && getRowAction(row) === activeAction).map((row) => String(row.id)),
    [activeAction, isPending, rows],
  );

  const allChecked = eligibleIds.length > 0 && eligibleIds.every((id) => selectedIds.has(id));

  return (
    <div className={`${tableStyles.tableWrap} ${tableStyles.tableWrapTopBorder} ${tableStyles.tableWrapTopFlat}`}>
      <table className={tableStyles.table}>
        <thead className={isPending ? undefined : tableStyles.theadTransparent}>
          <tr>
            <th>
              <input
                type="checkbox"
                aria-label={`Select all ${activeAction === "export" ? "approved" : "rejected or archived"} rows on this page`}
                checked={allChecked}
                disabled={eligibleIds.length === 0}
                onChange={(e) => onToggleAll(eligibleIds, e.target.checked)}
              />
            </th>
            <th>Reference</th>
            <th>Customer</th>
            <th>Date</th>
            <th>Type</th>
            <th>AUD ($)</th>
            <th>Toman (IRT)</th>
            <th>Recipient</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((tx) => {
            const profile = tx.profiles;
            const name = profile ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() : "-";
            const customerCode = profile?.customer_code;
            const rowId = String(tx.id);
            const rowAction = getRowAction(tx);
            const isSelectable = !isPending && rowAction !== null && (!selectionAction || rowAction === selectionAction);

            return (
              <tr key={rowId} className={isPending ? tableStyles.rowTintWarning : tableStyles.rowTransparent}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select transaction ${tx.reference_code ?? rowId}`}
                    checked={selectedIds.has(rowId)}
                    disabled={!isSelectable}
                    onChange={(e) => onToggleRow(rowId, e.target.checked)}
                  />
                </td>
                <td>
                  <EditableReferenceCode transactionId={tx.id} currentCode={tx.reference_code ?? null} />
                </td>
                <td>
                  <Link href={`/admin/users?userId=${tx.user_id}`} style={{ color: "inherit", textDecoration: "none" }}>
                    <div className={tableStyles.cellStrong} style={{ color: "var(--accent, #2563eb)" }}>
                      {name || "Unknown"}
                    </div>
                    <div className={`${tableStyles.cellSmall} ${tableStyles.cellDim} ${tableStyles.cellSubtleTop}`}>
                      {profile?.email ?? "-"}
                    </div>
                    {customerCode && (
                      <div style={{ fontSize: "0.65rem", color: "var(--text-dim)", fontFamily: "monospace", marginTop: "2px" }}>
                        ({customerCode})
                      </div>
                    )}
                  </Link>
                </td>
                <td className={`${tableStyles.cellMono} ${tableStyles.cellSmall} ${tableStyles.cellDim}`}>
                  {new Date(tx.created_at).toLocaleString("en-AU", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td>
                  <span className={`${tableStyles.badge} ${tx.type === "buy_aud" ? tableStyles.txBuy : tableStyles.txSell}`}>
                    {tx.type === "buy_aud" ? "Buy AUD" : "Sell AUD"}
                  </span>
                </td>
                <td dir="ltr">
                  <EditableAmount
                    transactionId={tx.id}
                    field="amount_aud"
                    currentValue={Number(tx.amount_aud)}
                    placeholder="e.g. 2254"
                  />
                </td>
                <td dir="ltr">
                  <EditableAmount
                    transactionId={tx.id}
                    field="equivalent_toman"
                    currentValue={Number(tx.equivalent_toman)}
                    placeholder="e.g. 279496000"
                  />
                </td>
                <td style={{ minWidth: "150px" }}>
                  <RecipientCell
                    recipient={tx.recipients}
                    paymentLink={tx.payment_link ?? null}
                    reasonForTransfer={tx.reason_for_transfer ?? null}
                  />
                </td>
                <td>
                  <StatusBadge status={tx.status} />
                </td>
                <td>
                  {isPending ? (
                    <TransactionApproveButton transactionId={tx.id} bankAccounts={bankAccounts || []} />
                  ) : (
                    tx.status === "approved" && (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <SendReceiptButton
                          transactionId={tx.id}
                          customerEmail={profile?.email ?? undefined}
                          initiallySent={tx.receipt_sent === true}
                        />
                        <RejectApprovedButton transactionId={tx.id} />
                      </div>
                    )
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function TransactionsManager({
  pending,
  history,
  total,
  currentPage,
  pageSize,
  historyStatus,
  historyDirection,
  startDate,
  endDate,
  statusTabs,
  bankAccounts,
}: TransactionsManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [filterStart, setFilterStart] = useState(startDate);
  const [filterEnd, setFilterEnd] = useState(endDate);
  const [exportMessage, setExportMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const selectedCount = selectedIds.size;
  const selectedRows = history.filter((row) => selectedIds.has(String(row.id)));
  const selectionAction: SelectionAction | null = selectedRows.length === 0
    ? null
    : (selectedRows[0].status ?? "").toLowerCase() === "approved"
      ? "export"
      : "delete";
  const defaultSelectionAction: SelectionAction =
    historyStatus === "rejected" || historyStatus === "archived" ? "delete" : "export";

  const updateFilters = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    params.set("page", "1");
    setSelectedIds(new Set());
    router.push(`${pathname}?${params.toString()}`);
  };

  const statusHref = (status: HistoryStatusFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    if (status === "all") params.delete("status");
    else params.set("status", status);
    params.set("page", "1");
    return `${pathname}?${params.toString()}`;
  };

  const toggleRow = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAll = (ids: string[], checked: boolean) => {
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
    setSelectedIds(new Set());
    setExportMessage(null);
  };

  const downloadBulkReport = async () => {
    if (selectedIds.size === 0 || selectionAction !== "export") {
      setExportMessage({ type: "error", text: "Select at least one approved transaction first." });
      return;
    }

    try {
      setIsExporting(true);
      setExportMessage(null);

      const response = await fetch("/api/admin/reports/ifti-dra-outgoing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionIds: Array.from(selectedIds) }),
      });

      if (!response.ok) {
        let message = "Failed to generate IFDA report.";
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

      setExportMessage({ type: "success", text: `IFDA report generated for ${selectedIds.size} transaction(s).` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected export error.";
      setExportMessage({ type: "error", text: message });
    } finally {
      setIsExporting(false);
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0 || selectionAction !== "delete") return;
    if (!window.confirm(`Permanently delete ${selectedIds.size} selected transaction(s)? This cannot be undone.`)) return;

    try {
      setIsDeleting(true);
      setExportMessage(null);
      const result = await bulkDeleteTransactions(Array.from(selectedIds));
      if ("error" in result && result.error) {
        setExportMessage({ type: "error", text: result.error });
        return;
      }
      const deletedCount = "deletedCount" in result ? result.deletedCount : selectedIds.size;
      clearSelection();
      setExportMessage({ type: "success", text: `${deletedCount} transaction(s) deleted.` });
      router.refresh();
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
        {pending.length > 0 && (
          <span className={`${tableStyles.badge} ${tableStyles.badgePending} ${tableStyles.badgeCompact}`}>
            {pending.length} Pending
          </span>
        )}
      </div>

      <div className={shellStyles.pageContent}>
        <div className={`${cardStyles.sectionHeader} ${cardStyles.sectionHeaderMd}`}>
          <div>
            <h1 className={`${cardStyles.sectionTitle} ${cardStyles.sectionTitleWithIcon}`}>
              <span className={cardStyles.sectionTitleIconAccent}>
                <ArrowLeftRight size={24} strokeWidth={2.5} />
              </span>
              Transaction Processing
            </h1>
            <p className={cardStyles.sectionDesc}>Review pending transfers and send receipts to approved customers.</p>
          </div>
        </div>

        <div className={`${cardStyles.panel} ${pending.length > 0 ? cardStyles.panelWarning : ""}`}>
          <div className={cardStyles.panelHeader}>
            <h2 className={`${cardStyles.panelTitle} ${pending.length > 0 ? cardStyles.panelTitleWarning : ""}`}>
              <Clock size={18} />
              Awaiting Action ({pending.length})
            </h2>
          </div>

          {pending.length === 0 ? (
            <div className={`${cardStyles.emptyState} ${cardStyles.emptyStateLoose}`}>
              <div className={cardStyles.emptyStateIcon}>
                <DollarSign size={24} />
              </div>
              <div className={cardStyles.emptyStateText}>Queue is clear - no pending transactions.</div>
            </div>
          ) : (
            <TxTable
              rows={pending}
              isPending={true}
              bankAccounts={bankAccounts}
              selectedIds={selectedIds}
              onToggleRow={toggleRow}
              onToggleAll={toggleAll}
              selectionAction={selectionAction}
              defaultSelectionAction={defaultSelectionAction}
            />
          )}
        </div>

        <div className={`${cardStyles.panel} ${cardStyles.panelSoft} ${cardStyles.panelMt}`}>
          {/* Tab bar */}
          <div className={tableStyles.historyTabBar}>
            <div className={tableStyles.historyTabBarLeft}>
              <Archive size={15} />
              <span>Transaction History</span>
              <span className={tableStyles.historyTotalCount}>{total.toLocaleString()} records</span>
            </div>
            <nav className={tableStyles.historyTabs} aria-label="Transaction status filter">
              {statusTabs.map((tab) => {
                const isActive = historyStatus === tab.key;
                return (
                  <Link
                    key={tab.key}
                    href={statusHref(tab.key)}
                    className={`${tableStyles.historyTab} ${isActive ? tableStyles.historyTabActive : ""}`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {tab.label}
                    <span className={`${tableStyles.historyTabCount} ${isActive ? tableStyles.historyTabCountActive : ""}`}>
                      {tab.count.toLocaleString()}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Filter bar */}
          <div className={tableStyles.historyFilters} aria-label="Transaction history filters">
            <div className={tableStyles.historyFilterGroup}>
              <span className={tableStyles.historyFilterLabel}>Direction</span>
              <SelectBox
                labeledOptions={[
                  { label: "All types", value: "all" },
                  { label: "Buy AUD", value: "outgoing" },
                  { label: "Sell AUD", value: "incoming" },
                ]}
                value={historyDirection}
                onChange={(value) => updateFilters({ direction: value === "all" ? null : value })}
                dir="ltr"
                className={tableStyles.historyFilterSelect}
              />
            </div>

            <div className={tableStyles.historyFilterDivider} aria-hidden="true" />

            <div className={tableStyles.historyFilterGroup}>
              <span className={tableStyles.historyFilterLabel}>Date range</span>
              <div className={tableStyles.historyDateRange}>
                <CustomDatePicker value={filterStart} onChange={setFilterStart} placeholder="From" className={tableStyles.historyDatePicker} />
                <span className={tableStyles.historyDateRangeSep} aria-hidden="true">→</span>
                <CustomDatePicker value={filterEnd} onChange={setFilterEnd} placeholder="To" className={tableStyles.historyDatePicker} />
                <button
                  type="button"
                  className={`${tableStyles.btnAction} ${tableStyles.historyApplyBtn}`}
                  onClick={() => updateFilters({ start: filterStart || null, end: filterEnd || null })}
                >
                  Apply
                </button>
              </div>
            </div>

            {(historyDirection !== "all" || startDate || endDate) && (
              <button
                type="button"
                className={tableStyles.historyResetBtn}
                onClick={() => {
                  setFilterStart("");
                  setFilterEnd("");
                  updateFilters({ direction: null, start: null, end: null });
                }}
              >
                <X size={13} />
                Reset filters
              </button>
            )}
          </div>

          {(selectedCount > 0 || exportMessage) && (
            <div className={tableStyles.bulkActionBar} role="status">
              <div>
                <strong>{selectedCount} selected</strong>
                <span>{selectionAction === "delete" ? "Rejected/archived records" : "Approved records for AUSTRAC IFDA"}</span>
              </div>
              {exportMessage && (
                <span className={exportMessage.type === "error" ? tableStyles.bulkMessageError : tableStyles.bulkMessageSuccess}>
                  {exportMessage.text}
                </span>
              )}
              <div className={tableStyles.bulkActions}>
                {selectionAction === "export" && selectedCount > 0 && (
                  <button type="button" onClick={downloadBulkReport} disabled={isExporting} className={`${tableStyles.btnAction} ${tableStyles.btnApprove}`}>
                    <Download size={14} />
                    {isExporting ? "Generating..." : "Export IFDA (.xlsx)"}
                  </button>
                )}
                {selectionAction === "delete" && selectedCount > 0 && (
                  <button type="button" onClick={deleteSelected} disabled={isDeleting} className={`${tableStyles.btnAction} ${tableStyles.btnReject}`}>
                    <Trash2 size={14} />
                    {isDeleting ? "Deleting..." : "Delete selected"}
                  </button>
                )}
                {selectedCount > 0 && (
                  <button type="button" onClick={clearSelection} disabled={isExporting || isDeleting} className={`${tableStyles.btnAction} ${tableStyles.btnArchive}`}>
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}

          {history.length === 0 ? (
            <div className={`${cardStyles.emptyState} ${cardStyles.emptyStateCompact} ${cardStyles.emptyStateWithTopBorder}`}>
              <div className={`${cardStyles.emptyStateText} ${cardStyles.emptyStateDim}`}>No history records found.</div>
            </div>
          ) : (
            <>
              <TxTable
                rows={history}
                isPending={false}
                bankAccounts={bankAccounts}
                selectedIds={selectedIds}
                onToggleRow={toggleRow}
                onToggleAll={toggleAll}
                selectionAction={selectionAction}
                defaultSelectionAction={defaultSelectionAction}
              />
              <AdminPagination currentPage={currentPage} totalCount={total} pageSize={pageSize} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
