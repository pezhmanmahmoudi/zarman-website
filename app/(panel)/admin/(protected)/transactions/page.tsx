import React from "react";
import { ArrowLeftRight, Archive, Clock, ArrowRight, DollarSign } from "lucide-react";
import { getPendingTransactions, getTransactionHistory } from "@/app/actions/admin.actions";
// باگ Import برطرف شد تا دقیقاً با نام کامپوننت شما همخوانی داشته باشد
import { TransactionApproveButton } from "@/components/admin/TransactionApproveButton"; 
import shellStyles from "@/styles/admin/AdminShell.module.css";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import tableStyles from "@/styles/admin/AdminTable.module.css";

export const metadata = { title: "Transactions | Zarman Admin" };

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className={`${tableStyles.badge} ${tableStyles.badgePending}`}>Pending</span>;
  
  const s = status.toLowerCase();
  if (s === "approved")
    return (
      <span className={`${tableStyles.badge} ${tableStyles.badgeApproved}`}>
        <span className={tableStyles.badgeDot} />
        Approved
      </span>
    );
  if (s === "rejected")
    return (
      <span className={`${tableStyles.badge} ${tableStyles.badgeRejected}`}>
        <span className={tableStyles.badgeDot} />
        Rejected
      </span>
    );
  if (s === "archived")
    return (
      <span className={`${tableStyles.badge} ${tableStyles.badgeArchived}`}>
        <span className={tableStyles.badgeDot} />
        Archived
      </span>
    );
    
  return (
    <span className={`${tableStyles.badge} ${tableStyles.badgePending}`}>
      <span className={tableStyles.badgeDot} />
      Pending
    </span>
  );
}

export default async function TransactionsPage() {
  // استفاده از توابع اصلاح‌شده با لیمیت ۵۰
  const [pending, history] = await Promise.all([
    getPendingTransactions(),
    getTransactionHistory(50),
  ]);

  const renderTxRow = (tx: any, isHistory: boolean) => {
    const profile = tx.profiles as any;
    const name = profile
      ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim()
      : "—";
      
    return (
      <tr key={tx.id} className={!isHistory ? tableStyles.rowTintWarning : tableStyles.rowTransparent}>
        <td>
          <div className={tableStyles.cellStrong}>
            {name || "Unknown User"}
          </div>
          <div className={`${tableStyles.cellSmall} ${tableStyles.cellDim} ${tableStyles.cellSubtleTop}`}>
            {profile?.email ?? "—"}
          </div>
        </td>
        <td className={`${tableStyles.cellMono} ${tableStyles.cellSmall} ${tableStyles.cellDim}`}>
          {new Date(tx.created_at).toLocaleString("en-AU", { 
            day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" 
          })}
        </td>
        <td>
          <span className={`${tableStyles.badge} ${tx.type === "buy_aud" ? tableStyles.txBuy : tableStyles.txSell}`}>
            {tx.type === "buy_aud" ? "Buy AUD" : "Sell AUD"}
          </span>
        </td>
        {/* ستون مبالغ با استایل Mono و خوانایی بالا */}
        <td className={`${tableStyles.cellMono} ${tableStyles.cellStrong}`} dir="ltr">
          ${Number(tx.amount_aud).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
        <td className={`${tableStyles.cellMono} ${tableStyles.cellDim}`} dir="ltr">
          {Number(tx.equivalent_toman).toLocaleString("en-AU")} T
        </td>
        <td>{StatusBadge({ status: tx.status })}</td>
        {!isHistory && (
          <td>
            {/* اگر کامپوننت دکمه‌های Reject/Archive هم دارید می‌توانید به جای این قرار دهید */}
            <TransactionApproveButton transactionId={tx.id} />
          </td>
        )}
      </tr>
    );
  };

  return (
    <>
      <div className={shellStyles.topBar}>
        <span className={shellStyles.pageTitle}>Transactions Queue</span>
        {pending.length > 0 && (
          <div className={shellStyles.topBarActions}>
            <span className={`${tableStyles.badge} ${tableStyles.badgePending} ${tableStyles.badgeCompact}`}>
              {pending.length} Pending Approval
            </span>
          </div>
        )}
      </div>

      <div className={shellStyles.pageContent}>
        {/* Header Section */}
        <div className={`${cardStyles.sectionHeader} ${cardStyles.sectionHeaderMd}`}>
          <div>
            <h1 className={`${cardStyles.sectionTitle} ${cardStyles.sectionTitleWithIcon}`}>
              <span className={cardStyles.sectionTitleIconAccent}>
                <ArrowLeftRight size={24} strokeWidth={2.5} />
              </span>
              Transaction Processing
            </h1>
            <p className={cardStyles.sectionDesc}>
              Review and process pending financial transfers. Always verify bank receipts before approving a transaction.
            </p>
          </div>
        </div>

        {/* 1. Pending Queue (Active Area) */}
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
              <div className={cardStyles.emptyStateText}>
                No pending transactions. Queue is clear!
              </div>
            </div>
          ) : (
            <div className={`${tableStyles.tableWrap} ${tableStyles.tableWrapTopBorder} ${tableStyles.tableWrapTopFlat}`}>
              <table className={tableStyles.table}>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Date & Time</th>
                    <th>Type</th>
                    <th>Amount (AUD)</th>
                    <th>Equivalent (Toman)</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((tx) => renderTxRow(tx, false))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 2. Transaction History Panel (با لیمیت 50) */}
        <div className={`${cardStyles.panel} ${cardStyles.panelSoft} ${cardStyles.panelMt}`}>
          <div className={cardStyles.panelHeader}>
            <h2 className={cardStyles.panelTitle}>
              <Archive size={18} color="var(--text-dim)" />
              Recent History (Last 50 records)
            </h2>
          </div>
          
          {history.length === 0 ? (
            <div className={`${cardStyles.emptyState} ${cardStyles.emptyStateCompact} ${cardStyles.emptyStateWithTopBorder}`}>
              <div className={`${cardStyles.emptyStateText} ${cardStyles.emptyStateDim}`}>
                No history records found.
              </div>
            </div>
          ) : (
            <div className={`${tableStyles.tableWrap} ${tableStyles.tableWrapTopBorder} ${tableStyles.tableWrapTopFlat}`}>
              <table className={tableStyles.table}>
                <thead className={tableStyles.theadTransparent}>
                  <tr>
                    <th>Customer</th>
                    <th>Date & Time</th>
                    <th>Type</th>
                    <th>Amount (AUD)</th>
                    <th>Equivalent (Toman)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((tx) => renderTxRow(tx, true))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* بخش Footer برای راهنمای Pagination */}
          {history.length >= 50 && (
            <div className={tableStyles.paginationFooter}>
               <button className={tableStyles.paginationBtn} disabled>
                 Previous
               </button>
               <span className={tableStyles.paginationNote}>
                 Showing top 50 records
               </span>
               <button className={tableStyles.paginationBtn}>
                 Next
               </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}