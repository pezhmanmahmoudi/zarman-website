import React from "react";
import { ArrowLeftRight, Clock, DollarSign, Archive } from "lucide-react";
import {
  getPendingTransactionsWithDetails,
  getTransactionHistoryWithDetails,
} from "@/app/actions/admin.actions";
import { TransactionApproveButton } from "@/components/admin/TransactionApproveButton";
import { SendReceiptButton } from "@/components/admin/SendReceiptButton";
import shellStyles from "@/styles/admin/AdminShell.module.css";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import tableStyles from "@/styles/admin/AdminTable.module.css";

export const metadata = { title: "Transactions | Zarman Admin" };

function StatusBadge({ status }: { status: string | null }) {
  const s = (status ?? "").toLowerCase();
  if (s === "approved")
    return <span className={`${tableStyles.badge} ${tableStyles.badgeApproved}`}><span className={tableStyles.badgeDot} />Approved</span>;
  if (s === "rejected")
    return <span className={`${tableStyles.badge} ${tableStyles.badgeRejected}`}><span className={tableStyles.badgeDot} />Rejected</span>;
  if (s === "archived")
    return <span className={`${tableStyles.badge} ${tableStyles.badgeArchived}`}><span className={tableStyles.badgeDot} />Archived</span>;
  return <span className={`${tableStyles.badge} ${tableStyles.badgePending}`}><span className={tableStyles.badgeDot} />Pending</span>;
}

type TxRow = Awaited<ReturnType<typeof getPendingTransactionsWithDetails>>[number];

function RecipientCell({ recipient }: { recipient: TxRow["recipients"] }) {
  if (!recipient) return <span style={{ color: "var(--text-dim)" }}>—</span>;

  const r = recipient as any;
  if (r.direction === "aud") {
    return (
      <div style={{ fontSize: "0.68rem", lineHeight: 1.7 }}>
        <div style={{ fontWeight: 700 }}>{r.account_name ?? "—"}</div>
        {r.bank_name && <div>{r.bank_name}</div>}
        {r.bsb && <div style={{ color: "var(--text-dim)" }}>BSB {r.bsb}</div>}
        {r.account_number && <div style={{ color: "var(--text-dim)" }}>Acc {r.account_number}</div>}
      </div>
    );
  }

  const isMelli = r.bank_type === "bank_melli";
  return (
    <div style={{ fontSize: "0.68rem", lineHeight: 1.7 }}>
      <div style={{ fontWeight: 700 }}>{r.full_name ?? "—"}</div>
      <div>{isMelli ? "Bank Melli" : (r.bank_name ?? "Iranian Bank")}</div>
      {isMelli
        ? r.card_number && <div style={{ color: "var(--text-dim)" }}>Card {r.card_number}</div>
        : r.shaba_number && <div style={{ color: "var(--text-dim)" }}>Shaba {r.shaba_number}</div>
      }
    </div>
  );
}

function TxTable({
  rows,
  isPending,
}: {
  rows: TxRow[];
  isPending: boolean;
}) {
  return (
    <div className={`${tableStyles.tableWrap} ${tableStyles.tableWrapTopBorder} ${tableStyles.tableWrapTopFlat}`}>
      <table className={tableStyles.table}>
        <thead className={isPending ? undefined : tableStyles.theadTransparent}>
          <tr>
            <th>Reference</th>
            <th>Customer</th>
            <th>Date</th>
            <th>Type</th>
            <th>AUD Amount</th>
            <th>Toman</th>
            <th>Recipient</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((tx) => {
            const profile = tx.profiles as any;
            const name = profile
              ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim()
              : "—";

            return (
              <tr
                key={tx.id}
                className={isPending ? tableStyles.rowTintWarning : tableStyles.rowTransparent}
              >
                {/* Reference */}
                <td>
                  <span style={{ fontFamily: "monospace", fontSize: "0.8rem", fontWeight: 700, color: "var(--color-accent-primary)", letterSpacing: "0.5px" }}>
                    {(tx as any).reference_code ?? "—"}
                  </span>
                </td>

                {/* Customer */}
                <td>
                  <div className={tableStyles.cellStrong}>{name || "Unknown"}</div>
                  <div className={`${tableStyles.cellSmall} ${tableStyles.cellDim} ${tableStyles.cellSubtleTop}`}>
                    {profile?.email ?? "—"}
                  </div>
                </td>

                {/* Date */}
                <td className={`${tableStyles.cellMono} ${tableStyles.cellSmall} ${tableStyles.cellDim}`}>
                  {new Date(tx.created_at).toLocaleString("en-AU", {
                    day: "2-digit", month: "2-digit", year: "2-digit",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </td>

                {/* Type */}
                <td>
                  <span className={`${tableStyles.badge} ${tx.type === "buy_aud" ? tableStyles.txBuy : tableStyles.txSell}`}>
                    {tx.type === "buy_aud" ? "Buy AUD" : "Sell AUD"}
                  </span>
                </td>

                {/* AUD */}
                <td className={`${tableStyles.cellMono} ${tableStyles.cellStrong}`} dir="ltr">
                  ${Number(tx.amount_aud).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>

                {/* Toman */}
                <td className={`${tableStyles.cellMono} ${tableStyles.cellDim}`} dir="ltr">
                  {Number(tx.equivalent_toman).toLocaleString("en-AU")} T
                </td>

                {/* Recipient */}
                <td style={{ minWidth: "150px" }}>
                  <RecipientCell recipient={tx.recipients} />
                </td>

                {/* Status */}
                <td><StatusBadge status={tx.status} /></td>

                {/* Actions */}
                <td>
                  {isPending ? (
                    <TransactionApproveButton transactionId={tx.id} />
                  ) : (
                    tx.status === "approved" && (
                      <SendReceiptButton
                        transactionId={tx.id}
                        customerEmail={profile?.email ?? undefined}
                        initiallySent={(tx as any).receipt_sent === true}
                      />
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

export default async function TransactionsPage() {
  const [pending, history] = await Promise.all([
    getPendingTransactionsWithDetails(),
    getTransactionHistoryWithDetails(50),
  ]);

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
            <p className={cardStyles.sectionDesc}>
              Review pending transfers and send receipts to approved customers.
            </p>
          </div>
        </div>

        {/* Pending Queue */}
        <div className={`${cardStyles.panel} ${pending.length > 0 ? cardStyles.panelWarning : ""}`}>
          <div className={cardStyles.panelHeader}>
            <h2 className={`${cardStyles.panelTitle} ${pending.length > 0 ? cardStyles.panelTitleWarning : ""}`}>
              <Clock size={18} />
              Awaiting Action ({pending.length})
            </h2>
          </div>

          {pending.length === 0 ? (
            <div className={`${cardStyles.emptyState} ${cardStyles.emptyStateLoose}`}>
              <div className={cardStyles.emptyStateIcon}><DollarSign size={24} /></div>
              <div className={cardStyles.emptyStateText}>Queue is clear — no pending transactions.</div>
            </div>
          ) : (
            <TxTable rows={pending} isPending={true} />
          )}
        </div>

        {/* History */}
        <div className={`${cardStyles.panel} ${cardStyles.panelSoft} ${cardStyles.panelMt}`}>
          <div className={cardStyles.panelHeader}>
            <h2 className={cardStyles.panelTitle}>
              <Archive size={18} color="var(--text-dim)" />
              Recent History (Last 50)
            </h2>
          </div>

          {history.length === 0 ? (
            <div className={`${cardStyles.emptyState} ${cardStyles.emptyStateCompact} ${cardStyles.emptyStateWithTopBorder}`}>
              <div className={`${cardStyles.emptyStateText} ${cardStyles.emptyStateDim}`}>No history records found.</div>
            </div>
          ) : (
            <TxTable rows={history} isPending={false} />
          )}
        </div>
      </div>
    </>
  );
}
