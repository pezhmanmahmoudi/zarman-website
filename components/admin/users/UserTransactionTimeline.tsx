"use client";

import React, { useMemo, useState, useTransition } from "react";
import { ArrowLeftRight, Plus, Pencil, Trash2, X } from "lucide-react";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import styles from "@/styles/admin/AdminWorkspace.module.css";
import { AdminDataTable, AdminTableRow, AdminTableCell, AdminTableIdentity, AdminTableDate, AdminBadge } from "@/components/admin/ui/AdminDataTable";
import { AdminRecordDrawer } from "@/components/admin/ui/AdminRecordDrawer";
import formStyles from "@/styles/admin/AdminForms.module.css";
import { StatusBadge } from "@/components/admin/ui/StatusBadge";
import { TransactionApproveButton } from "@/components/admin/TransactionApproveButton";
import {
  createAssistedTransactionForUser,
  deleteAssistedTransactionForUser,
  updateAssistedTransactionForUser,
  type getUserFinancialProfile,
} from "@/app/actions/admin.actions";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";
import CustomDatePicker from "@/components/ui/DatePicker/CustomDatePicker";

type Transactions = Awaited<ReturnType<typeof getUserFinancialProfile>>["transactions"];
type Recipients = Awaited<ReturnType<typeof getUserFinancialProfile>>["recipients"];
type RecipientOption = { id: string; label: string };

interface UserTransactionTimelineProps {
  userId?: string;
  transactions: Transactions;
  recipients: Recipients;
  bankAccounts?: React.ComponentProps<typeof TransactionApproveButton>["bankAccounts"];
  onTransactionCreated?: () => void;
}

export function UserTransactionTimeline({ userId, transactions, recipients, bankAccounts = [], onTransactionCreated }: UserTransactionTimelineProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = transactions.find((tx: Transactions[number]) => tx.id === selectedId);
  const [openAdd, setOpenAdd] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [editForm, setEditForm] = useState({
    recipientId: "",
    type: "buy_aud",
    amountAud: "",
    equivalentToman: "",
    sourceOfFunds: "",
    reasonForTransfer: "",
    paymentLink: "",
    referenceCode: "",
    status: "pending",
    createdAt: "",
  });

  const recipientOptions = useMemo<RecipientOption[]>(() => {
    return (recipients ?? []).map((r: Recipients[number]) => {
      const recipientLabel = typeof r.label === "string" ? r.label.trim() : "";
      if (recipientLabel) {
        return {
          id: String(r.id),
          label: recipientLabel,
        };
      }

      const primary = r.account_name || r.full_name || "Recipient";
      const secondary = r.direction === "aud"
        ? (r.bank_name || r.account_number || "AUD account")
        : (r.bank_type === "bank_melli" ? "Bank Melli" : (r.bank_name || "IRT account"));
      return {
        id: String(r.id),
        label: `${primary} - ${secondary}`,
      };
    });
  }, [recipients]);

  const editingTx = useMemo(
    () => transactions.find((tx: Transactions[number]) => String(tx.id) === editingId) ?? null,
    [transactions, editingId],
  );

  const [form, setForm] = useState({
    recipientId: "",
    type: "buy_aud",
    amountAud: "",
    equivalentToman: "",
    appliedRate: "",
    sourceOfFunds: "",
    reasonForTransfer: "",
    paymentLink: "",
    createdAt: "",
  });

  const setField = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const setEditField = (key: string, value: string) => setEditForm((prev) => ({ ...prev, [key]: value }));

  const normalizeRecipient = (value: Recipients[number] | Recipients | undefined) => {
    if (Array.isArray(value)) return value.find(Boolean) ?? null;
    return value ?? null;
  };

  const resolveRecipientLabel = (tx: Transactions[number]) => {
    const rec = normalizeRecipient(tx.recipients);
    if (rec) return rec.label || rec.account_name || rec.full_name || "—";
    if (tx.payment_link) return "Payment Link";
    return "—";
  };

  const startEditRow = (tx: Transactions[number]) => {
    const rec = normalizeRecipient(tx.recipients);
    setStatus(null);
    setOpenAdd(false);
    setEditingId(String(tx.id));
    // Extract date-only (YYYY-MM-DD) from created_at for the date picker
    const createdAtDate = tx.created_at ? new Date(tx.created_at) : new Date();
    const dateOnly = createdAtDate.toISOString().slice(0, 10);
    setEditForm({
      recipientId: tx.payment_link
        ? "__payment_link__"
        : String(tx.recipient_id ?? rec?.id ?? ""),
      type: String(tx.type || "buy_aud"),
      amountAud: String(tx.amount_aud ?? ""),
      equivalentToman: String(tx.equivalent_toman ?? ""),
      sourceOfFunds: String(tx.source_of_funds ?? ""),
      reasonForTransfer: String(tx.reason_for_transfer ?? ""),
      paymentLink: String(tx.payment_link ?? ""),
      referenceCode: String(tx.reference_code ?? ""),
      status: String(tx.status || "pending"),
      createdAt: dateOnly,
    });
  };

  const cancelEditRow = () => {
    setEditingId(null);
  };

  const saveEditedRow = () => {
    if (!userId || !editingId) {
      setStatus({ type: "error", text: "Missing customer context." });
      return;
    }
    if (!editForm.createdAt) {
      setStatus({ type: "error", text: "Date is required." });
      return;
    }

    setStatus(null);
    startTransition(async () => {
      const isSpecialRecipient =
        editForm.recipientId === "__intl_payment__" || editForm.recipientId === "__payment_link__";
      const resolvedRecipientId = isSpecialRecipient ? "" : editForm.recipientId;
      const resolvedPaymentLink = editForm.recipientId === "__payment_link__"
        ? (editForm.paymentLink || "https://payment.link")
        : (editForm.recipientId === "__intl_payment__" ? "" : editForm.paymentLink);
      const res = await updateAssistedTransactionForUser({
        transactionId: editingId,
        userId,
        recipientId: resolvedRecipientId,
        type: editForm.type as "buy_aud" | "sell_aud",
        amount_aud: Number(editForm.amountAud || 0),
        equivalent_toman: Number(editForm.equivalentToman || 0),
        source_of_funds: editForm.sourceOfFunds || undefined,
        reason_for_transfer: editForm.reasonForTransfer || undefined,
        payment_link: resolvedPaymentLink || undefined,
        reference_code: editForm.referenceCode,
        status: editForm.status as "pending" | "approved" | "rejected" | "archived" | "cancelled",
        created_at: editForm.createdAt || undefined,
      });

      if ("error" in res && res.error) {
        setStatus({ type: "error", text: res.error });
        return;
      }

      setStatus({ type: "success", text: "Transaction row updated." });
      setEditingId(null);
      onTransactionCreated?.();
    });
  };

  const deleteRow = (transactionId: string) => {
    if (!userId) {
      setStatus({ type: "error", text: "Missing customer context." });
      return;
    }

    const ok = window.confirm("Delete this transaction permanently? This cannot be undone.");
    if (!ok) return;

    setStatus(null);
    startTransition(async () => {
      const res = await deleteAssistedTransactionForUser({ transactionId, userId });

      if ("error" in res && res.error) {
        setStatus({ type: "error", text: res.error });
        return;
      }

      setStatus({ type: "success", text: "Transaction deleted permanently." });
      setEditingId((prev) => (prev === transactionId ? null : prev));
      onTransactionCreated?.();
    });
  };

  const submitAdd = () => {
    if (!userId) {
      setStatus({ type: "error", text: "Missing customer context." });
      return;
    }
    if (!form.createdAt) {
      setStatus({ type: "error", text: "Date is required." });
      return;
    }
    setStatus(null);
    startTransition(async () => {
      const isSpecialRecipient =
        form.recipientId === "__intl_payment__" || form.recipientId === "__payment_link__";
      const res = await createAssistedTransactionForUser({
        userId,
        recipientId: isSpecialRecipient ? "" : form.recipientId,
        type: form.type as "buy_aud" | "sell_aud",
        amount_aud: Number(form.amountAud || 0),
        equivalent_toman: Number(form.equivalentToman || 0),
        applied_rate: form.appliedRate ? Number(form.appliedRate) : undefined,
        source_of_funds: form.sourceOfFunds || undefined,
        reason_for_transfer: form.reasonForTransfer || undefined,
        payment_link:
          form.recipientId === "__payment_link__"
            ? (form.paymentLink || "https://payment.link")
            : (form.paymentLink || undefined),
        created_at: form.createdAt || undefined,
      });

      if ("error" in res && res.error) {
        setStatus({ type: "error", text: res.error });
        return;
      }

      setStatus({ type: "success", text: "Pending transaction created for this customer." });
      setForm({
        recipientId: "",
        type: "buy_aud",
        amountAud: "",
        equivalentToman: "",
        appliedRate: "",
        sourceOfFunds: "",
        reasonForTransfer: "",
        paymentLink: "",
        createdAt: "",
      });
      setOpenAdd(false);
      onTransactionCreated?.();
    });
  };

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <h2 className={styles.panelTitle}>
          <ArrowLeftRight size={18} color="var(--text-dim)" />
          Transactions Timeline
        </h2>
        <div className={styles.headerActions}>
          <span
            className={styles.recordCount}
          >
            {transactions.length} {transactions.length === 1 ? "record" : "records"}
          </span>
          <button
            type="button"
            className={openAdd ? formStyles.btnSecondary : formStyles.btnPrimary}
            onClick={() => {
              setStatus(null);
              setEditingId(null);
              setOpenAdd((v) => !v);
            }}
          >
            {openAdd ? <X size={14} /> : <Plus size={14} />}
            {openAdd ? "Cancel" : "Add Transaction"}
          </button>
        </div>
      </div>

      {status && (
        <div className={cardStyles.statusBanner}>
          <span className={`${formStyles.saveStatus} ${status.type === "success" ? formStyles.saveStatusSuccess : formStyles.saveStatusError}`}>
            {status.text}
          </span>
        </div>
      )}

      {editingId && editingTx && (
        <div className={cardStyles.panelBodyForm}>
          <div className={cardStyles.formInset}>
            <div className={formStyles.fieldRow}>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Reference Code</label>
                <input
                  className={formStyles.input}
                  value={editForm.referenceCode}
                  onChange={(e) => setEditField("referenceCode", e.target.value.toUpperCase())}
                  placeholder="ZE12345"
                />
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Date</label>
                <CustomDatePicker
                  value={editForm.createdAt}
                  onChange={(val) => setEditField("createdAt", val)}
                  placeholder="dd/mm/yyyy"
                />
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Type</label>
                <SelectBox
                  className={formStyles.input}
                  labeledOptions={[
                    { value: "buy_aud", label: "Buy AUD" },
                    { value: "sell_aud", label: "Sell AUD" },
                  ]}
                  value={editForm.type}
                  onChange={(val) => setEditField("type", val)}
                />
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Recipient</label>
                <SelectBox
                  className={formStyles.input}
                  labeledOptions={[
                    { value: "", label: "Select recipient" },
                    { value: "__intl_payment__", label: "International Payment" },
                    { value: "__payment_link__", label: "Payment Link" },
                    ...recipientOptions.map((r: RecipientOption) => ({ value: r.id, label: r.label })),
                  ]}
                  value={editForm.recipientId}
                  onChange={(val) => setEditField("recipientId", val)}
                />
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>AUD Amount</label>
                <input type="number" step="0.01" className={formStyles.input} value={editForm.amountAud} onChange={(e) => setEditField("amountAud", e.target.value)} />
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Equivalent Toman</label>
                <input type="number" step="1" className={formStyles.input} value={editForm.equivalentToman} onChange={(e) => setEditField("equivalentToman", e.target.value)} />
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Source of Funds</label>
                <input className={formStyles.input} value={editForm.sourceOfFunds} onChange={(e) => setEditField("sourceOfFunds", e.target.value)} />
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Reason for Transfer</label>
                <input className={formStyles.input} value={editForm.reasonForTransfer} onChange={(e) => setEditField("reasonForTransfer", e.target.value)} />
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Status</label>
                <SelectBox
                  className={formStyles.input}
                  labeledOptions={[
                    { value: "pending", label: "Pending" },
                    { value: "approved", label: "Approved" },
                    { value: "rejected", label: "Rejected" },
                    { value: "archived", label: "Archived" },
                    { value: "cancelled", label: "Cancelled" },
                  ]}
                  value={editForm.status}
                  onChange={(val) => setEditField("status", val)}
                />
              </div>
            </div>

            <div className={formStyles.formActions}>
              <button type="button" className={formStyles.btnPrimary} onClick={saveEditedRow} disabled={isPending}>
                {isPending ? "Saving..." : "Save Changes"}
              </button>
              <button type="button" className={formStyles.btnSecondary} onClick={cancelEditRow} disabled={isPending}>
                Cancel Editing
              </button>
            </div>
          </div>
        </div>
      )}

      {openAdd && (
        <div className={cardStyles.panelBodyForm}>
          <div className={cardStyles.formInset}>
            <div className={formStyles.fieldRow}>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Date</label>
                <CustomDatePicker
                  value={form.createdAt}
                  onChange={(val) => setField("createdAt", val)}
                  placeholder="dd/mm/yyyy"
                />
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Type</label>
              <SelectBox
                className={formStyles.input}
                labeledOptions={[
                  { value: "buy_aud", label: "Buy AUD" },
                  { value: "sell_aud", label: "Sell AUD" },
                ]}
                value={form.type}
                onChange={(val) => setField("type", val)}
              />
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Recipient</label>
              <SelectBox
                className={formStyles.input}
                labeledOptions={[
                  { value: "", label: "Select recipient" },
                  { value: "__intl_payment__", label: "International Payment" },
                  { value: "__payment_link__", label: "Payment Link" },
                  ...recipientOptions.map((r: RecipientOption) => ({ value: r.id, label: r.label })),
                ]}
                value={form.recipientId}
                onChange={(val) => setField("recipientId", val)}
              />
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>AUD Amount</label>
                <input type="number" step="0.01" className={formStyles.input} value={form.amountAud} onChange={(e) => setField("amountAud", e.target.value)} />
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Equivalent Toman</label>
                <input type="number" step="1" className={formStyles.input} value={form.equivalentToman} onChange={(e) => setField("equivalentToman", e.target.value)} />
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Rate (Toman / AUD)</label>
                <input type="number" step="1" className={formStyles.input} value={form.appliedRate} onChange={(e) => setField("appliedRate", e.target.value)} placeholder="e.g. 42000" />
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Source of Funds</label>
                <input className={formStyles.input} value={form.sourceOfFunds} onChange={(e) => setField("sourceOfFunds", e.target.value)} />
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Reason for Transfer</label>
                <input className={formStyles.input} value={form.reasonForTransfer} onChange={(e) => setField("reasonForTransfer", e.target.value)} />
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Payment Link (optional)</label>
                <input className={formStyles.input} value={form.paymentLink} onChange={(e) => setField("paymentLink", e.target.value)} placeholder="https://..." />
              </div>
            </div>

            <div className={formStyles.formActions}>
              <button type="button" className={formStyles.btnPrimary} onClick={submitAdd} disabled={isPending}>
                {isPending ? "Saving..." : "Save Transaction"}
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminDataTable label="Customer transactions" columns={[
        { key: "reference", label: "Transfer / recipient" }, { key: "type", label: "Type" },
        { key: "aud", label: "AUD amount", align: "end" }, { key: "toman", label: "Toman amount", align: "end" },
        { key: "status", label: "Status" }, { key: "date", label: "Created (Sydney)" }, { key: "actions", label: "Actions", actions: true },
      ]} empty={!transactions.length && "No transactions found for this customer."}>
        {transactions.map((tx: Transactions[number]) => <AdminTableRow key={tx.id}>
          <AdminTableCell kind="primary"><AdminTableIdentity name={resolveRecipientLabel(tx)} detail={<bdi>{tx.reference_code || tx.id}</bdi>} /></AdminTableCell>
          <AdminTableCell label="Type"><AdminBadge tone={tx.type === "buy_aud" ? "review" : "success"}>{tx.type === "buy_aud" ? "Buy AUD" : "Sell AUD"}</AdminBadge></AdminTableCell>
          <AdminTableCell label="AUD amount" align="right"><strong dir="ltr">{Number(tx.amount_aud).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AUD</strong></AdminTableCell>
          <AdminTableCell label="Toman amount" align="right"><span dir="ltr">{Number(tx.equivalent_toman).toLocaleString("en-AU")} Toman</span></AdminTableCell>
          <AdminTableCell label="Status"><StatusBadge status={tx.status} /></AdminTableCell>
          <AdminTableCell label="Created (Sydney)"><AdminTableDate value={tx.created_at} time /></AdminTableCell>
          <AdminTableCell kind="actions">
            <button type="button" className={styles.action} onClick={() => startEditRow(tx)} disabled={isPending}><Pencil size={14} aria-hidden="true" />Edit</button>
            {editingId === String(tx.id) && <button type="button" className={styles.action} onClick={cancelEditRow} disabled={isPending}>Cancel edit</button>}
            <button type="button" className={styles.action} data-tone="danger" onClick={() => deleteRow(String(tx.id))} disabled={isPending}><Trash2 size={14} aria-hidden="true" />Delete</button>
            {tx.status === "pending" && <TransactionApproveButton transactionId={tx.id} transactionAmountToman={Number(tx.equivalent_toman)} transactionType={String(tx.type ?? "buy_aud")} bankAccounts={bankAccounts} />}
            <button type="button" className={styles.detailsToggle} aria-haspopup="dialog" onClick={() => setSelectedId(tx.id)} aria-label={"View transaction " + (tx.reference_code || tx.id)}>View</button>
          </AdminTableCell>
        </AdminTableRow>)}
      </AdminDataTable>
      {selected && <AdminRecordDrawer title={resolveRecipientLabel(selected)} subtitle={selected.reference_code || selected.id} eyebrow="Customer transaction" onClose={() => setSelectedId(null)}>
        <section className={styles.detailSection}><h3>Transfer details</h3><dl className={styles.facts}>
          {[["Source of funds", selected.source_of_funds], ["Reason for transfer", selected.reason_for_transfer], ["Promotion", selected.promo_code],
            ["Promotion discount", Number(selected.discount_amount ?? 0).toLocaleString("en-AU") + " Toman"],
            ["Loyalty discount", Number(selected.loyalty_discount ?? 0).toLocaleString("en-AU") + " Toman"],
          ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd><bdi>{value || "—"}</bdi></dd></div>)}
        </dl></section>
      </AdminRecordDrawer>}
    </div>
  );
}
