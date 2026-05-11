"use client";

import React from "react";
import { ArrowLeftRight } from "lucide-react";
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
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={6}>
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
