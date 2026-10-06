"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, ExternalLink, Mail, X } from "lucide-react";
import { AdminRecordDrawer } from "@/components/admin/ui/AdminRecordDrawer";
import { AdminBadge, AdminDataTable, AdminTableRow, AdminTableCell, AdminTableIdentity, AdminTableDate } from "@/components/admin/ui/AdminDataTable";
import { TransactionApproveButton } from "@/components/admin/TransactionApproveButton";
import { SendReceiptButton } from "@/components/admin/SendReceiptButton";
import { RejectApprovedButton } from "@/components/admin/RejectApprovedButton";
import { EditableReferenceCode } from "@/components/admin/EditableReferenceCode";
import { EditableAmount } from "@/components/admin/EditableAmount";
import { isRequestTerminal, requestDate, requestMoney } from "@/components/requests/request-labels";
import { transactionQueueState, transactionRequest, transactionRequestHref } from "@/lib/admin-transaction-workspace";
import type { BankAccountOption, TransactionRow } from "./TransactionsManager";
import styles from "@/styles/admin/AdminWorkspace.module.css";

type SelectionAction = "export" | "delete";
type Props = {
  rows: TransactionRow[];
  isPending: boolean;
  bankAccounts: BankAccountOption[];
  selectedIds?: Set<string>;
  onToggleRow?: (id: string, checked: boolean) => void;
  onToggleAll?: (ids: string[], checked: boolean) => void;
  selectionAction?: SelectionAction | null;
  defaultSelectionAction?: SelectionAction;
  selectedExportType?: string | null;
};

function rowAction(row: TransactionRow): SelectionAction | null {
  return row.status === "approved" ? "export" : ["rejected", "archived"].includes(row.status ?? "") ? "delete" : null;
}

function recordPresentation(row: TransactionRow) {
  const request = transactionRequest(row);
  const state = transactionQueueState(row);
  const successful = request ? request.status === "completed" : row.status === "approved";
  // Customer identity follows profile corrections; the quote retains its original snapshot.
  const customerName = [row.profiles?.first_name, row.profiles?.last_name]
    .map(part => part?.trim()).filter(Boolean).join(" ");
  return {
    request, state,
    reference: request?.reference_code || row.reference_code || row.id,
    name: customerName || request?.quote.sender_snapshot?.name || "Unknown customer",
    requestHref: request ? transactionRequestHref(request.id) : null,
    fundingCurrency: request?.quote.funding_currency || (row.type === "buy_aud" ? "AUD" : "IRT"),
    recipientCurrency: request?.quote.recipient_currency || (row.type === "buy_aud" ? "IRT" : "AUD"),
    funding: request?.quote.funding_total ?? Number(row.type === "buy_aud" ? row.amount_aud : row.equivalent_toman),
    recipientAmount: request?.quote.recipient_amount ?? Number(row.type === "buy_aud" ? row.equivalent_toman : row.amount_aud),
    tone: state.stage === "closed" ? successful ? "success" as const : row.status === "archived" ? "closed" as const : "rejected" as const : state.stage,
  };
}

function TransferStatus({ row }: { row: TransactionRow }) {
  const { state, tone } = recordPresentation(row);
  return <AdminBadge tone={tone}>{state.label}</AdminBadge>;
}

function RecipientDetails({ row }: { row: TransactionRow }) {
  const request = transactionRequest(row);
  const recipient = request?.quote.recipient_snapshot ?? row.recipients;
  const paymentLink = request?.quote.payment_link ?? row.payment_link ?? row.reason_for_transfer?.match(/لینک پرداخت:\s*(\S+)/)?.[1];
  const safeLink = paymentLink && /^https?:\/\//i.test(paymentLink) ? paymentLink : null;
  const field = (key: string) => recipient && typeof recipient === "object" && key in recipient
    ? String((recipient as Record<string, unknown>)[key] ?? "") : "";
  const details = [
    ["Recipient", field("account_name") || field("full_name") || field("label")],
    ["Bank", field("bank_name") || (field("bank_type") === "bank_melli" ? "Bank Melli" : "")],
    ["Bank city", field("bank_city")], ["BSB", field("bsb")], ["Account number", field("account_number")],
    ["Shaba / IBAN", field("shaba_number") || field("iban")], ["Card number", field("card_number")],
  ].filter(([, value]) => value);
  return <section className={styles.detailSection}>
    <h3>Destination</h3>
    <dl className={styles.facts}>{details.map(([label, value]) => <div key={label} data-wide={label === "Shaba / IBAN" || undefined}>
      <dt>{label}</dt><dd><bdi>{value}</bdi></dd>
    </div>)}</dl>
    {safeLink && <a href={safeLink} className={styles.action} target="_blank" rel="noopener noreferrer">Payment link<ExternalLink size={14} aria-hidden="true" /></a>}
    {!details.length && !safeLink && <p className={styles.description}>No destination details recorded.</p>}
  </section>;
}

function TransactionDetails({ row, bankAccounts, onClose }: { row: TransactionRow; bankAccounts: BankAccountOption[]; onClose: () => void }) {
  const { request, name, reference, requestHref, state, funding, fundingCurrency, recipientAmount, recipientCurrency } = recordPresentation(row);
  const email = request?.quote.sender_snapshot?.email || row.profiles?.email;
  return <AdminRecordDrawer title={name} subtitle={<bdi>{reference}</bdi>} eyebrow="Transaction details" onClose={onClose}
    footer={(requestHref || row.status === "pending") && <>
      {requestHref ? <Link className={`${styles.action} ${styles.primaryAction}`} href={requestHref}>{state.next}</Link>
        : <TransactionApproveButton transactionId={row.id} transactionAmountToman={Number(row.equivalent_toman)} transactionType={row.type} bankAccounts={bankAccounts} />}
    </>}>
      <div className={styles.detailStatus}><TransferStatus row={row} /><time dateTime={row.created_at}>{requestDate(row.created_at, "en")} · Sydney</time></div>
      <section className={styles.detailSection} aria-label="Transfer amounts">
        <dl className={styles.amountSummary}>
          <div><dt>Customer pays</dt><dd>{request ? requestMoney(funding, fundingCurrency, "en") : <><EditableAmount transactionId={row.id} field={row.type === "buy_aud" ? "amount_aud" : "equivalent_toman"} currentValue={funding} /><span className={styles.currency}>{fundingCurrency === "IRT" ? "Toman" : fundingCurrency}</span></>}</dd></div>
          <div><dt>Recipient gets</dt><dd>{request ? requestMoney(recipientAmount, recipientCurrency, "en") : <><EditableAmount transactionId={row.id} field={row.type === "buy_aud" ? "equivalent_toman" : "amount_aud"} currentValue={recipientAmount} /><span className={styles.currency}>{recipientCurrency === "IRT" ? "Toman" : recipientCurrency}</span></>}</dd></div>
        </dl>
        {request?.funding_status === "partial" && <p className={styles.description}>{requestMoney(request.funding_received, fundingCurrency, "en")} received so far.</p>}
      </section>
      <RecipientDetails row={row} />
      <section className={styles.detailSection}>
        <h3>Record details</h3>
        <dl className={styles.facts}>
          <div><dt>Reference</dt><dd>{request ? <bdi>{reference}</bdi> : <EditableReferenceCode transactionId={row.id} currentCode={row.reference_code ?? null} />}</dd></div>
          <div><dt>Source</dt><dd>{request ? "Customer request" : "Manual transaction"}</dd></div>
          <div><dt>Company trade</dt><dd>{row.type === "buy_aud" ? "Buy AUD" : "Sell AUD"}</dd></div>
          {row.profiles?.customer_code && <div><dt>Customer code</dt><dd><bdi>{row.profiles.customer_code}</bdi></dd></div>}
          {email && <div data-wide><dt>Email</dt><dd><bdi>{email}</bdi></dd></div>}
        </dl>
        <Link className={styles.textLink} href={`/admin/users?userId=${encodeURIComponent(row.user_id)}`}>View customer profile</Link>
      </section>
      {request?.status === "completed" && <section className={styles.detailSection}>
        <h3>Receipt</h3>
        <a className={styles.action} href={`/api/requests/${request.id}/receipt`} target="_blank" rel="noopener noreferrer"><Download size={15} aria-hidden="true" />Download receipt</a>
      </section>}
  </AdminRecordDrawer>;
}

/** One table pattern for active work and history; editing stays in a focused dialog. */
export function TransactionTable({ rows, isPending, bankAccounts, selectedIds = new Set(), onToggleRow, onToggleAll,
  selectionAction = null, defaultSelectionAction = "export", selectedExportType = null }: Props) {
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const openRow = rows.find(row => String(row.id) === openRowId);
  const activeAction = selectionAction ?? defaultSelectionAction;
  const eligible = rows.filter(row => rowAction(row) === activeAction && (activeAction !== "export" || !selectedExportType || row.type === selectedExportType));
  const eligibleIds = eligible.map(row => String(row.id));
  const allChecked = eligibleIds.length > 0 && eligibleIds.every(id => selectedIds.has(id));
  const someChecked = !allChecked && eligibleIds.some(id => selectedIds.has(id));
  const selectAll = <label className={styles.checkTarget}><input type="checkbox"
    aria-label={`Select all ${activeAction === "export" ? "approved" : "rejected or archived"} rows on this page`}
    checked={allChecked} ref={element => { if (element) element.indeterminate = someChecked; }}
    disabled={!eligibleIds.length} onChange={event => onToggleAll?.(eligibleIds, event.target.checked)} /></label>;

  return <>
    <AdminDataTable label={isPending ? "Active transaction queue" : "Transaction history"} selection={!isPending ? selectAll : undefined} columns={[
      ...(!isPending ? [{ key: "select", label: "Select transfer", selection: true }] : []),
      { key: "customer", label: "Customer" }, { key: "pays", label: "Customer pays", align: "end" },
      { key: "gets", label: "Recipient gets", align: "end" }, { key: "status", label: "Status" },
      { key: "date", label: <>{isPending ? "Due / created" : "Created"}<span className={styles.timeZone}>Sydney time</span></> },
      { key: "actions", label: "Actions", actions: true },
    ]}>{rows.map(row => {
          const { request, state, reference, name, requestHref, fundingCurrency, recipientCurrency, funding, recipientAmount } = recordPresentation(row);
          const id = String(row.id);
          const selectable = !isPending && rowAction(row) !== null && (!selectionAction || rowAction(row) === selectionAction)
            && (rowAction(row) !== "export" || !selectedExportType || row.type === selectedExportType);
          const due = isPending ? request?.handling_due_at : null;
          return <AdminTableRow key={id} data-selected={selectedIds.has(id) || undefined}>
            {!isPending && <AdminTableCell kind="selection"><label className={styles.checkTarget}><input type="checkbox" aria-label={`Select transaction ${reference}`} checked={selectedIds.has(id)} disabled={!selectable} onChange={event => onToggleRow?.(id, event.target.checked)} /></label></AdminTableCell>}
            <AdminTableCell kind="primary"><AdminTableIdentity name={name} href={`/admin/users?userId=${encodeURIComponent(row.user_id)}`} detail={<><bdi>{reference}</bdi>{request?.service_tier === "priority" && <span className={styles.priority}>Priority</span>}</>} /></AdminTableCell>
            <AdminTableCell label="Customer pays" align="right"><strong dir="ltr">{requestMoney(funding, fundingCurrency, "en")}</strong></AdminTableCell>
            <AdminTableCell label="Recipient gets" align="right"><span dir="ltr">{requestMoney(recipientAmount, recipientCurrency, "en")}</span></AdminTableCell>
            <AdminTableCell label="Status"><TransferStatus row={row} />{request?.funding_status === "partial" && <span className={styles.detail}>{requestMoney(request.funding_received, fundingCurrency, "en")} received</span>}</AdminTableCell>
            <AdminTableCell label="Sydney time"><AdminTableDate value={due || row.created_at} time prefix={due ? "Due " : ""} /></AdminTableCell>
            <AdminTableCell kind="actions">
              {isPending && requestHref && <Link className={styles.action} href={requestHref}>{state.next}</Link>}
              {!request && row.status === "pending" && <TransactionApproveButton transactionId={row.id} transactionAmountToman={Number(row.equivalent_toman)} transactionType={row.type} bankAccounts={bankAccounts} />}
              {!request && row.status === "approved" && <><SendReceiptButton transactionId={row.id} customerEmail={row.profiles?.email ?? undefined} initiallySent={row.receipt_sent === true} /><RejectApprovedButton transactionId={row.id} /></>}
              {request && requestHref && <>
                <Link className={styles.action} href={`${requestHref}?intent=email#request-conversation`} title="Write a customer email"><Mail size={14} aria-hidden="true" />Email</Link>
                {!isRequestTerminal(request.status) && !["processing", "reconciliation"].includes(request.status) && <Link className={`${styles.action} ${styles.rejectAction}`} href={`${requestHref}?intent=reject`}><X size={14} aria-hidden="true" />Reject</Link>}
              </>}
              <button type="button" className={styles.detailsToggle} aria-label={`View details for ${reference}`} aria-haspopup="dialog" onClick={() => setOpenRowId(id)}>View</button>
            </AdminTableCell>
          </AdminTableRow>;
        })}</AdminDataTable>
    {openRow && <TransactionDetails key={openRow.id} row={openRow} bankAccounts={bankAccounts} onClose={() => setOpenRowId(null)} />}
  </>;
}
