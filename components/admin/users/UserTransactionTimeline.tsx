"use client";

import React, { useMemo, useState, useTransition } from "react";
import { ArrowLeftRight, PlusCircle, Tag, Star } from "lucide-react";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import tableStyles from "@/styles/admin/AdminTable.module.css";
import formStyles from "@/styles/admin/AdminForms.module.css";
import { StatusBadge } from "@/components/admin/ui/StatusBadge";
import { TransactionApproveButton } from "@/components/admin/TransactionApproveButton";
import { createAssistedTransactionForUser, type getUserFinancialProfile } from "@/app/actions/admin.actions";

type Transactions = Awaited<ReturnType<typeof getUserFinancialProfile>>["transactions"];
type Recipients = Awaited<ReturnType<typeof getUserFinancialProfile>>["recipients"];

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

  const recipientOptions = useMemo(() => {
    return (recipients ?? []).map((r: any) => {
      const primary = r.label || r.account_name || r.full_name || "Recipient";
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
      <div className={`${cardStyles.panelHeader} ${cardStyles.panelHeaderComfort}`}>
        <h2 className={cardStyles.panelTitle}>
          <ArrowLeftRight size={18} color="var(--text-dim)" />
          Transactions Timeline
        </h2>
        <button
          type="button"
          className={formStyles.btnPrimary}
          onClick={() => {
            setStatus(null);
            setOpenAdd((v) => !v);
          }}
        >
          <PlusCircle size={16} />
          {openAdd ? "Cancel" : "Add Transaction"}
        </button>
      </div>

      {openAdd && (
        <div className={cardStyles.panelBody} style={{ borderBottom: "1px solid var(--border-soft)", paddingTop: "1rem" }}>
          <div className={formStyles.fieldRow}>
            <div className={formStyles.fieldGroup}>
              <label className={formStyles.label}>Recipient</label>
              <select className={formStyles.input} value={form.recipientId} onChange={(e) => setField("recipientId", e.target.value)}>
                <option value="">Select recipient</option>
                {recipientOptions.map((r) => (
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
              {isPending ? "Saving..." : "Create Pending Transaction"}
            </button>
            {status && (
              <span className={`${formStyles.saveStatus} ${status.type === "success" ? formStyles.saveStatusSuccess : formStyles.saveStatusError}`}>
                {status.text}
              </span>
            )}
          </div>
        </div>
      )}

      <div className={tableStyles.tableWrap}>
        <table className={tableStyles.table}>
          <thead>
            <tr>
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
                <td colSpan={10}>
                  <div className={`${cardStyles.emptyState} ${cardStyles.emptyStateCompact}`}>
                    <div className={cardStyles.emptyStateText}>
                      No transactions found for this user.
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr
                  key={tx.id}
                  className={
                    tx.status === "pending"
                      ? tableStyles.rowTintWarning
                      : tableStyles.rowTransparent
                  }
                >
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
                  <td style={{ fontSize: "0.75rem", lineHeight: 1.5 }}>
                    {(tx as any).recipients ? (
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {(tx as any).recipients.account_name || (tx as any).recipients.full_name || "—"}
                        </div>
                        <div style={{ color: "var(--text-dim)" }}>
                          {(tx as any).recipients.bank_name ||
                            ((tx as any).recipients.bank_type === "bank_melli" ? "Bank Melli" : "Other Bank")}
                        </div>
                      </div>
                    ) : <span style={{ color: "var(--text-dim)" }}>—</span>}
                  </td>
                  {/* Discounts */}
                  <td>
                    {!(tx as any).promo_code && !Number((tx as any).loyalty_discount ?? 0) ? (
                      <span style={{ color: "var(--text-dim)" }}>—</span>
                    ) : (
                      <div style={{ fontSize: "0.75rem", display: "flex", flexDirection: "column", gap: "4px" }}>
                        {(tx as any).promo_code && (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "var(--accent)" }}>
                            <Tag size={10} />
                            <span style={{ fontWeight: 700 }}>{(tx as any).promo_code}</span>
                            {Number((tx as any).discount_amount ?? 0) > 0 && (
                              <span style={{ color: "var(--success)", fontWeight: 700, marginLeft: "4px" }}>
                                −{Number((tx as any).discount_amount).toLocaleString("en-AU")} T
                              </span>
                            )}
                          </div>
                        )}
                        {Number((tx as any).loyalty_discount ?? 0) > 0 && (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "var(--warning)" }}>
                            <Star size={10} />
                            <span style={{ fontWeight: 600 }}>Loyalty</span>
                            <span style={{ fontWeight: 700, marginLeft: "4px" }}>
                              −{Number((tx as any).loyalty_discount).toLocaleString("en-AU")} T
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className={tableStyles.cellSmall} style={{ maxWidth: "160px", whiteSpace: "normal" }}>
                    {(tx as Record<string, unknown>).source_of_funds as string || <span style={{ color: "var(--text-dim, #888)" }}>—</span>}
                  </td>
                  <td className={tableStyles.cellSmall} style={{ maxWidth: "140px", whiteSpace: "normal" }}>
                    {(tx as Record<string, unknown>).reason_for_transfer as string || <span style={{ color: "var(--text-dim, #888)" }}>—</span>}
                  </td>
                  <td>
                    <StatusBadge status={tx.status} />
                  </td>
                  <td>
                    {tx.status === "pending" ? (
                      <TransactionApproveButton transactionId={tx.id} />
                    ) : (
                      <span className={`${tableStyles.cellDim} ${tableStyles.cellProcessed}`}>
                        Processed
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
