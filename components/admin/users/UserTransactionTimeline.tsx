"use client";

import React from "react";
import { ArrowLeftRight, Tag, Star } from "lucide-react";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import tableStyles from "@/styles/admin/AdminTable.module.css";
import { StatusBadge } from "@/components/admin/ui/StatusBadge";
import { TransactionApproveButton } from "@/components/admin/TransactionApproveButton";
import type { getUserFinancialProfile } from "@/app/actions/admin.actions";

type Transactions = Awaited<ReturnType<typeof getUserFinancialProfile>>["transactions"];

interface UserTransactionTimelineProps {
  transactions: Transactions;
}

export function UserTransactionTimeline({ transactions }: UserTransactionTimelineProps) {
  return (
    <div className={cardStyles.panel}>
      <div className={`${cardStyles.panelHeader} ${cardStyles.panelHeaderComfort}`}>
        <h2 className={cardStyles.panelTitle}>
          <ArrowLeftRight size={18} color="var(--text-dim)" />
          Transactions Timeline
        </h2>
      </div>
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
