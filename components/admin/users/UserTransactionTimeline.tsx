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

type Transactions = Awaited<ReturnType<typeof getUserFinancialProfile>>["transactions"];
type Recipients = Awaited<ReturnType<typeof getUserFinancialProfile>>["recipients"];
type RecipientOption = { id: string; label: string };

interface UserTransactionTimelineProps {
  userId?: string;
  transactions: Transactions;
  recipients: Recipients;
  onTransactionCreated?: () => void;
}

export function UserTransactionTimeline({ userId, transactions, recipients, onTransactionCreated }: UserTransactionTimelineProps) {
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
  });

  const setField = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const setEditField = (key: string, value: string) => setEditForm((prev) => ({ ...prev, [key]: value }));

  const startEditRow = (tx: Transactions[number]) => {
    const rec = (tx as any).recipients;
    setStatus(null);
    setEditingId(String(tx.id));
    setEditForm({
      recipientId: String((tx as any).recipient_id ?? rec?.id ?? ""),
      type: String(tx.type || "buy_aud"),
      amountAud: String(tx.amount_aud ?? ""),
      equivalentToman: String(tx.equivalent_toman ?? ""),
      sourceOfFunds: String((tx as any).source_of_funds ?? ""),
      reasonForTransfer: String((tx as any).reason_for_transfer ?? ""),
      paymentLink: String((tx as any).payment_link ?? ""),
      referenceCode: String((tx as any).reference_code ?? ""),
      status: String(tx.status || "pending"),
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

    setStatus(null);
    startTransition(async () => {
      const res = await updateAssistedTransactionForUser({
        transactionId: editingId,
        userId,
        recipientId: editForm.recipientId,
        type: editForm.type as "buy_aud" | "sell_aud",
        amount_aud: Number(editForm.amountAud || 0),
        equivalent_toman: Number(editForm.equivalentToman || 0),
        source_of_funds: editForm.sourceOfFunds || undefined,
        reason_for_transfer: editForm.reasonForTransfer || undefined,
        payment_link: editForm.paymentLink || undefined,
        reference_code: editForm.referenceCode,
        status: editForm.status as "pending" | "approved" | "rejected" | "archived" | "cancelled",
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
    setStatus(null);
    startTransition(async () => {
      const res = await createAssistedTransactionForUser({
        userId,
        recipientId: form.recipientId,
        type: form.type as "buy_aud" | "sell_aud",
        amount_aud: Number(form.amountAud || 0),
        equivalent_toman: Number(form.equivalentToman || 0),
        applied_rate: form.appliedRate ? Number(form.appliedRate) : undefined,
        source_of_funds: form.sourceOfFunds || undefined,
        reason_for_transfer: form.reasonForTransfer || undefined,
        payment_link: form.paymentLink || undefined,
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
                <label className={formStyles.label}>Recipient</label>
                <select className={formStyles.input} value={form.recipientId} onChange={(e) => setField("recipientId", e.target.value)}>
                  <option value="">Select recipient</option>
                  {recipientOptions.map((r: RecipientOption) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Type</label>
                <select className={formStyles.input} value={form.type} onChange={(e) => setField("type", e.target.value)}>
                  <option value="buy_aud">Buy AUD</option>
                  <option value="sell_aud">Sell AUD</option>
                </select>
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
              <button type="button" className={formStyles.btnPrimary} onClick={submitAdd} disabled={isPending || !form.recipientId}>
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
                        {new Date(tx.created_at).toLocaleString("en-AU", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td>
                        <select className={`${formStyles.input} ${formStyles.inputCompact}`} value={editForm.type} onChange={(e) => setEditField("type", e.target.value)}>
                          <option value="buy_aud">Buy AUD</option>
                          <option value="sell_aud">Sell AUD</option>
                        </select>
                      </td>
                      <td>
                        <input type="number" step="0.01" className={`${formStyles.input} ${formStyles.inputCompact}`} value={editForm.amountAud} onChange={(e) => setEditField("amountAud", e.target.value)} />
                      </td>
                      <td>
                        <input type="number" step="1" className={`${formStyles.input} ${formStyles.inputCompact}`} value={editForm.equivalentToman} onChange={(e) => setEditField("equivalentToman", e.target.value)} />
                      </td>
                      <td>
                        <select className={`${formStyles.input} ${formStyles.selectCompact}`} value={editForm.recipientId} onChange={(e) => setEditField("recipientId", e.target.value)}>
                          <option value="">Select recipient</option>
                          {recipientOptions.map((r: RecipientOption) => (
                            <option key={r.id} value={r.id}>{r.label}</option>
                          ))}
                        </select>
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
                        <select className={`${formStyles.input} ${formStyles.selectCompactStatus}`} value={editForm.status} onChange={(e) => setEditField("status", e.target.value)}>
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                          <option value="archived">Archived</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td>
                        <div className={tableStyles.cellActionGroup}>
                          <button
                            type="button"
                            className={`${formStyles.btnPrimary} ${formStyles.btnIconOnly}`}
                            title="Save"
                            aria-label="Save"
                            onClick={saveEditedRow}
                            disabled={isPending || !editForm.recipientId}
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
                    {(tx as any).recipients
                      ? (
                        <span className={tableStyles.cellStrong}>
                          {(tx as any).recipients.label || (tx as any).recipients.account_name || (tx as any).recipients.full_name || "—"}
                        </span>
                      )
                      : <span className={tableStyles.cellEmpty}>—</span>}
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
                        <TransactionApproveButton transactionId={tx.id} />
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
