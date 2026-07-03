"use client";

import React, { useMemo, useState, useTransition } from "react";
import { ArrowLeftRight, Plus, Tag, Star, Pencil, Trash2, Save, X } from "lucide-react";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import tableStyles from "@/styles/admin/AdminTable.module.css";
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
  bankAccounts?: any[];
  onTransactionCreated?: () => void;
}

export function UserTransactionTimeline({ userId, transactions, recipients, bankAccounts = [], onTransactionCreated }: UserTransactionTimelineProps) {
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
    return (recipients ?? []).map((r: any) => {
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

  const normalizeRecipient = (value: any) => {
    if (Array.isArray(value)) return value.find(Boolean) ?? null;
    return value ?? null;
  };

  const resolveRecipientLabel = (tx: Transactions[number]) => {
    const rec = normalizeRecipient((tx as any).recipients);
    if (rec) return rec.label || rec.account_name || rec.full_name || "—";
    if ((tx as any).payment_link) return "Payment Link";
    return "—";
  };

  const startEditRow = (tx: Transactions[number]) => {
    const rec = normalizeRecipient((tx as any).recipients);
    setStatus(null);
    setEditingId(String(tx.id));
    // Extract date-only (YYYY-MM-DD) from created_at for the date picker
    const createdAtDate = tx.created_at ? new Date(tx.created_at) : new Date();
    const dateOnly = createdAtDate.toISOString().slice(0, 10);
    setEditForm({
      recipientId: (tx as any).payment_link
        ? "__payment_link__"
        : String((tx as any).recipient_id ?? rec?.id ?? ""),
      type: String(tx.type || "buy_aud"),
      amountAud: String(tx.amount_aud ?? ""),
      equivalentToman: String(tx.equivalent_toman ?? ""),
      sourceOfFunds: String((tx as any).source_of_funds ?? ""),
      reasonForTransfer: String((tx as any).reason_for_transfer ?? ""),
      paymentLink: String((tx as any).payment_link ?? ""),
      referenceCode: String((tx as any).reference_code ?? ""),
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
    <div className={cardStyles.panel}>
      <div className={cardStyles.panelHeader}>
        <h2 className={cardStyles.panelTitle}>
          <ArrowLeftRight size={18} color="var(--text-dim)" />
          Transactions Timeline
        </h2>
        <div className={cardStyles.panelHeaderControls}>
          <span
            className={`${tableStyles.badge} ${tableStyles.badgeArchived}`}
          >
            {transactions.length} {transactions.length === 1 ? "record" : "records"}
          </span>
          <button
            type="button"
            className={openAdd ? formStyles.btnSecondary : formStyles.btnPrimary}
            onClick={() => {
              setStatus(null);
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

      <div className={tableStyles.tableWrap}>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th>Reference Code</th>
              <th>Date</th>
              <th>Type</th>
              <th>AUD Amount</th>
              <th>Toman Equiv.</th>
              <th>Recipient</th>
              <th>Discounts</th>
              <th>Source of Funds</th>
              <th>Reason for Transfer</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={11}>
                  <div className={`${cardStyles.emptyState} ${cardStyles.emptyStateCompact}`}>
                    <div className={cardStyles.emptyStateText}>
                      No transactions found for this user.
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              transactions.map((tx: Transactions[number]) => (
                <tr
                  key={tx.id}
                  className={
                    tx.status === "pending"
                      ? tableStyles.rowTintWarning
                      : tableStyles.rowTransparent
                  }
                >
                  {editingId === String(tx.id) ? (
                    <>
                      <td className={`${tableStyles.cellMono} ${tableStyles.cellSmall}`}>
                        <input
                        className={`${formStyles.input} ${formStyles.inputCompactRef}`}
                          value={editForm.referenceCode}
                          onChange={(e) => setEditField("referenceCode", e.target.value.toUpperCase())}
                          placeholder="ZE12345"
                        />
                      </td>
                      <td className={`${tableStyles.cellMono} ${tableStyles.cellSmall} ${tableStyles.cellDim}`}>
                        <div className={formStyles.datePickerCompact}>
                          <CustomDatePicker
                            value={editForm.createdAt}
                            onChange={(val) => setEditField("createdAt", val)}
                          />
                        </div>
                      </td>
                      <td>
                        <SelectBox
                          className={`${formStyles.input} ${formStyles.inputCompact}`}
                          labeledOptions={[
                            { value: "buy_aud", label: "Buy AUD" },
                            { value: "sell_aud", label: "Sell AUD" },
                          ]}
                          value={editForm.type}
                          onChange={(val) => setEditField("type", val)}
                        />
                      </td>
                      <td>
                        <input type="number" step="0.01" className={`${formStyles.input} ${formStyles.inputCompact}`} value={editForm.amountAud} onChange={(e) => setEditField("amountAud", e.target.value)} />
                      </td>
                      <td>
                        <input type="number" step="1" className={`${formStyles.input} ${formStyles.inputCompact}`} value={editForm.equivalentToman} onChange={(e) => setEditField("equivalentToman", e.target.value)} />
                      </td>
                      <td>
                        <SelectBox
                          className={`${formStyles.input} ${formStyles.selectCompact}`}
                          labeledOptions={[
                            { value: "", label: "Select recipient" },
                            { value: "__intl_payment__", label: "International Payment" },
                            { value: "__payment_link__", label: "Payment Link" },
                            ...recipientOptions.map((r: RecipientOption) => ({ value: r.id, label: r.label })),
                          ]}
                          value={editForm.recipientId}
                          onChange={(val) => setEditField("recipientId", val)}
                        />
                      </td>
                      <td>
                        <span className={tableStyles.cellEmpty}>—</span>
                      </td>
                      <td>
                        <input className={`${formStyles.input} ${formStyles.inputCompactMd}`} value={editForm.sourceOfFunds} onChange={(e) => setEditField("sourceOfFunds", e.target.value)} />
                      </td>
                      <td>
                        <input className={`${formStyles.input} ${formStyles.inputCompactMd}`} value={editForm.reasonForTransfer} onChange={(e) => setEditField("reasonForTransfer", e.target.value)} />
                      </td>
                      <td>
                        <SelectBox
                          className={`${formStyles.input} ${formStyles.selectCompactStatus}`}
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
                      </td>
                      <td>
                        <div className={tableStyles.cellActionGroup}>
                          <button
                            type="button"
                            className={`${formStyles.btnPrimary} ${formStyles.btnIconOnly}`}
                            title="Save"
                            aria-label="Save"
                            onClick={saveEditedRow}
                            disabled={isPending}
                          >
                            <Save size={14} />
                          </button>
                          <button
                            type="button"
                            className={`${formStyles.btnSecondary} ${formStyles.btnIconOnly}`}
                            title="Cancel"
                            aria-label="Cancel"
                            onClick={cancelEditRow}
                            disabled={isPending}
                          >
                            <X size={14} />
                          </button>
                          <button
                            type="button"
                            className={`${formStyles.btnDanger} ${formStyles.btnIconOnly}`}
                            title="Delete"
                            aria-label="Delete"
                            onClick={() => deleteRow(String(tx.id))}
                            disabled={isPending}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                  <td className={`${tableStyles.cellMono} ${tableStyles.cellSmall}`}>
                    {(tx as any).reference_code || <span className={tableStyles.cellEmpty}>—</span>}
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
                    <span
                      className={`${tableStyles.badge} ${
                        tx.type === "buy_aud" ? tableStyles.txBuy : tableStyles.txSell
                      }`}
                    >
                      {tx.type === "buy_aud" ? "Buy AUD" : "Sell AUD"}
                    </span>
                  </td>
                  <td className={`${tableStyles.cellMono} ${tableStyles.cellStrong}`} dir="ltr">
                    ${Number(tx.amount_aud).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={`${tableStyles.cellMono} ${tableStyles.cellDim}`} dir="ltr">
                    {Number(tx.equivalent_toman).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}T
                  </td>
                  {/* Recipient */}
                  <td className={tableStyles.cellRecipient}>
                    {resolveRecipientLabel(tx) === "—"
                      ? <span className={tableStyles.cellEmpty}>—</span>
                      : <span className={tableStyles.cellStrong}>{resolveRecipientLabel(tx)}</span>}
                  </td>
                  {/* Discounts */}
                  <td>
                    {!(tx as any).promo_code && !Number((tx as any).loyalty_discount ?? 0) ? (
                      <span className={tableStyles.cellEmpty}>—</span>
                    ) : (
                      <div className={tableStyles.discountCell}>
                        {(tx as any).promo_code && (
                          <div className={tableStyles.discountPromo}>
                            <Tag size={10} />
                            <span className={tableStyles.discountPromoCode}>{(tx as any).promo_code}</span>
                            {Number((tx as any).discount_amount ?? 0) > 0 && (
                              <span className={tableStyles.discountAmount}>
                                −{Number((tx as any).discount_amount).toLocaleString("en-AU")} T
                              </span>
                            )}
                          </div>
                        )}
                        {Number((tx as any).loyalty_discount ?? 0) > 0 && (
                          <div className={tableStyles.discountLoyalty}>
                            <Star size={10} />
                            <span className={tableStyles.discountLoyaltyLabel}>Loyalty</span>
                            <span className={tableStyles.discountLoyaltyAmount}>
                              −{Number((tx as any).loyalty_discount).toLocaleString("en-AU")} T
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className={`${tableStyles.cellSmall} ${tableStyles.cellWrap}`}>
                    {(tx as Record<string, unknown>).source_of_funds as string || <span className={tableStyles.cellEmpty}>—</span>}
                  </td>
                  <td className={`${tableStyles.cellSmall} ${tableStyles.cellWrapNarrow}`}>
                    {(tx as Record<string, unknown>).reason_for_transfer as string || <span className={tableStyles.cellEmpty}>—</span>}
                  </td>
                  <td>
                    <StatusBadge status={tx.status} />
                  </td>
                  <td>
                    <div className={tableStyles.cellActionGroup}>
                      <button
                        type="button"
                        className={`${formStyles.btnSecondary} ${formStyles.btnIconOnly}`}
                        title="Edit"
                        aria-label="Edit"
                        onClick={() => startEditRow(tx)}
                        disabled={isPending}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className={`${formStyles.btnDanger} ${formStyles.btnIconOnly}`}
                        title="Delete"
                        aria-label="Delete"
                        onClick={() => deleteRow(String(tx.id))}
                        disabled={isPending}
                      >
                        <Trash2 size={14} />
                      </button>
                      {tx.status === "pending" ? (
                        <TransactionApproveButton transactionId={tx.id} bankAccounts={bankAccounts} />
                      ) : (
                        <span className={`${tableStyles.cellDim} ${tableStyles.cellProcessed}`}>
                          Processed
                        </span>
                      )}
                    </div>
                  </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
