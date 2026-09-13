"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Download, RotateCcw } from "lucide-react";
import type { AustracTypeStatus } from "@/app/actions/report.actions";
import { revertAustracReportBatch } from "@/app/actions/report.actions";
import type { AustracReportBatchSummary, AustracReportType } from "@/lib/reporting/austrac-compliance";
import { AUSTRAC_REPORTING_BUSINESS_DAYS } from "@/lib/reporting/austrac-deadlines";
import { useAdminFeedback } from "@/components/admin/ui/useAdminFeedback";
import { AdminConfirmDialog } from "@/components/admin/ui/AdminConfirmDialog";
import { AdminToast } from "@/components/admin/ui/AdminToast";
import { reloadAdminPage } from "@/lib/admin-refresh";
import s from "@/styles/admin/AustracCompliance.module.css";

type Props = {
  outgoing: AustracTypeStatus;
  incoming: AustracTypeStatus;
  recentBatches: AustracReportBatchSummary[];
};

const TYPE_LABEL: Record<AustracReportType, string> = {
  outgoing: "Outgoing (Buy AUD)",
  incoming: "Incoming (Sell AUD)",
};

const EXPORT_ENDPOINT: Record<AustracReportType, string> = {
  outgoing: "/api/admin/reports/ifti-dra-outgoing",
  incoming: "/api/admin/reports/ifti-dra-incoming",
};

function parseFileName(contentDisposition: string | null): string {
  if (!contentDisposition) return "AML.Report.AustracIFTI.xlsx";
  const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1]);
  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1] ?? "AML.Report.AustracIFTI.xlsx";
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("en-AU", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("en-AU");
}

function urgencyLabel(daysRemaining: number): string {
  if (daysRemaining < 0) return `${Math.abs(daysRemaining)} business day${Math.abs(daysRemaining) === 1 ? "" : "s"} overdue`;
  if (daysRemaining === 0) return "Due today";
  return `${daysRemaining} business day${daysRemaining === 1 ? "" : "s"} left`;
}

function urgencyClass(urgency: string): string {
  if (urgency === "overdue") return s.urgencyOverdue;
  if (urgency === "urgent") return s.urgencyUrgent;
  if (urgency === "soon") return s.urgencySoon;
  return s.urgencyOk;
}

function SummaryCard({ status }: { status: AustracTypeStatus }) {
  const { lastBatch } = status;
  return (
    <div className={s.summaryCard}>
      <div className={s.summaryHeader}>
        <div>
          <h2 className={s.summaryTitle}>{TYPE_LABEL[status.reportType]}</h2>
          <p className={s.summaryHint}>Must be reported to AUSTRAC within {AUSTRAC_REPORTING_BUSINESS_DAYS} business days.</p>
        </div>
        <span className={s.typeBadge}>{status.reportType}</span>
      </div>

      {lastBatch ? (
        <div className={s.lastBatch}>
          <span className={s.lastBatchLabel}>Last report sent</span>
          <strong>{formatDateTime(lastBatch.createdAt)}</strong>
          <span>{lastBatch.transactionCount} transaction{lastBatch.transactionCount === 1 ? "" : "s"} · {lastBatch.submittedByEmail ?? "unknown admin"}</span>
        </div>
      ) : (
        <div className={`${s.lastBatch} ${s.lastBatchEmpty}`}>
          <span className={s.lastBatchLabel}>Last report sent</span>
          <strong>No report submitted yet</strong>
        </div>
      )}

      <div className={s.metricsRow}>
        <div className={s.metric}>
          <span className={s.metricValue}>{status.pendingCount}</span>
          <span className={s.metricLabel}>Pending</span>
        </div>
        <div className={`${s.metric} ${status.overdueCount > 0 ? s.metricOverdue : ""}`}>
          <span className={s.metricValue}>{status.overdueCount}</span>
          <span className={s.metricLabel}>Overdue</span>
        </div>
        <div className={s.metric}>
          <span className={s.metricValue}>{formatDate(status.nextDueDate)}</span>
          <span className={s.metricLabel}>Next due date</span>
        </div>
      </div>
    </div>
  );
}

function PendingQueueSection({
  status,
  onExported,
}: {
  status: AustracTypeStatus;
  onExported: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const allIds = status.pending.map((row) => row.id);
  const overdueIds = status.pending.filter((row) => row.urgency === "overdue").map((row) => row.id);

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }

  function toggleAll(ids: string[], checked: boolean) {
    setSelectedIds(checked ? new Set(ids) : new Set());
  }

  async function exportSelected() {
    if (selectedIds.size === 0) {
      setMessage({ type: "error", text: "Select at least one transaction first." });
      return;
    }
    setIsExporting(true);
    setMessage(null);
    try {
      const response = await fetch(EXPORT_ENDPOINT[status.reportType], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionIds: Array.from(selectedIds) }),
      });

      if (!response.ok) {
        let text = "Failed to generate the AUSTRAC report.";
        try {
          const json = (await response.json()) as { message?: string };
          if (json.message) text = json.message;
        } catch { /* keep fallback message */ }
        setMessage({ type: "error", text });
        return;
      }

      const blob = await response.blob();
      const fileName = parseFileName(response.headers.get("content-disposition"));
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);

      setMessage({ type: "success", text: `Report generated for ${selectedIds.size} transaction(s) and marked as reported.` });
      setSelectedIds(new Set());
      onExported();
      reloadAdminPage(900);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unexpected export error." });
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <section className={s.section}>
      <div className={s.sectionHeader}>
        <h2 className={s.sectionHeading}>{TYPE_LABEL[status.reportType]} — pending AUSTRAC report</h2>
        <div className={s.sectionActions}>
          <button type="button" onClick={() => toggleAll(overdueIds, true)} disabled={overdueIds.length === 0}>Select overdue ({overdueIds.length})</button>
          <button type="button" onClick={() => toggleAll(allIds, selectedIds.size !== allIds.length)}>
            {selectedIds.size === allIds.length && allIds.length > 0 ? "Deselect all" : "Select all"}
          </button>
          <button type="button" className={s.exportBtn} onClick={exportSelected} disabled={isExporting || selectedIds.size === 0}>
            <Download size={14} /> {isExporting ? "Generating..." : `Export selected (${selectedIds.size})`}
          </button>
        </div>
      </div>

      {message && <p className={`${s.message} ${message.type === "success" ? s.messageSuccess : s.messageError}`}>{message.text}</p>}

      {status.pending.length === 0 ? (
        <p className={s.emptyState}>No approved {status.reportType === "outgoing" ? "buy AUD" : "sell AUD"} transactions are waiting to be reported.</p>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th aria-label="Select" />
                <th>Reference</th>
                <th>Customer</th>
                <th>Amount (AUD)</th>
                <th>Approved</th>
                <th>Due date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {status.pending.map((row) => (
                <tr key={row.id}>
                  <td><input type="checkbox" checked={selectedIds.has(row.id)} onChange={(e) => toggleOne(row.id, e.target.checked)} aria-label={`Select ${row.referenceCode ?? row.id}`} /></td>
                  <td>{row.referenceCode ?? row.id.slice(0, 8)}</td>
                  <td>{row.customerName}</td>
                  <td>{row.amountAud.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td>{formatDate(row.approvedAt)}</td>
                  <td>{formatDate(row.dueDate)}</td>
                  <td><span className={`${s.urgencyBadge} ${urgencyClass(row.urgency)}`}>{urgencyLabel(row.daysRemaining)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function BatchHistorySection({ batches, onReverted }: { batches: AustracReportBatchSummary[]; onReverted: () => void }) {
  const { confirm, showToast, dialogProps, toastProps } = useAdminFeedback();
  const [isPending, startTransition] = useTransition();

  function handleRevert(batch: AustracReportBatchSummary) {
    confirm({
      title: "Revert AUSTRAC report batch",
      message: `This returns ${batch.transactionCount} transaction(s) to the pending queue. Only do this if the report was not actually submitted to AUSTRAC, or was submitted in error.`,
      confirmLabel: "Revert",
      variant: "reject",
      onConfirm: async () => {
        await new Promise<void>((resolve) => {
          startTransition(async () => {
            const result = await revertAustracReportBatch(batch.id);
            if ("error" in result) showToast({ type: "error", message: result.error });
            else { showToast({ type: "success", message: "Batch reverted." }); onReverted(); reloadAdminPage(900); }
            resolve();
          });
        });
      },
    });
  }

  return (
    <section className={s.section}>
      <AdminConfirmDialog {...dialogProps} />
      <AdminToast {...toastProps} />
      <div className={s.sectionHeader}>
        <h2 className={s.sectionHeading}>Recent AUSTRAC report submissions</h2>
      </div>
      {batches.length === 0 ? (
        <p className={s.emptyState}>No AUSTRAC reports have been generated yet.</p>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Type</th>
                <th>Period</th>
                <th>Count</th>
                <th>File</th>
                <th>Submitted by</th>
                <th>Submitted at</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id}>
                  <td><span className={s.typeBadge}>{batch.reportType}</span></td>
                  <td>{formatDate(batch.periodStart)} – {formatDate(batch.periodEnd)}</td>
                  <td>{batch.transactionCount}</td>
                  <td>{batch.fileName ?? "-"}</td>
                  <td>{batch.submittedByEmail ?? "-"}</td>
                  <td>{formatDateTime(batch.createdAt)}</td>
                  <td>
                    {batch.revertedAt ? (
                      <span className={s.revertedTag}>Reverted {formatDateTime(batch.revertedAt)}</span>
                    ) : (
                      <button type="button" onClick={() => handleRevert(batch)} disabled={isPending}><RotateCcw size={13} /> Revert</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function AustracComplianceDashboard({ outgoing, incoming, recentBatches }: Props) {
  const totalOverdue = outgoing.overdueCount + incoming.overdueCount;
  const noop = () => {};

  return (
    <div className={s.page}>
      {totalOverdue > 0 && (
        <p className={`${s.message} ${s.messageError}`}>
          <AlertTriangle size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
          {totalOverdue} transaction{totalOverdue === 1 ? " is" : "s are"} past the {AUSTRAC_REPORTING_BUSINESS_DAYS}-business-day AUSTRAC deadline. Report these as soon as possible.
        </p>
      )}
      {totalOverdue === 0 && outgoing.pendingCount === 0 && incoming.pendingCount === 0 && (
        <p className={`${s.message} ${s.messageSuccess}`}><CheckCircle2 size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} /> All approved transactions have been reported to AUSTRAC.</p>
      )}

      <div className={s.summaryGrid}>
        <SummaryCard status={outgoing} />
        <SummaryCard status={incoming} />
      </div>

      <PendingQueueSection status={outgoing} onExported={noop} />
      <PendingQueueSection status={incoming} onExported={noop} />
      <BatchHistorySection batches={recentBatches} onReverted={noop} />
    </div>
  );
}
