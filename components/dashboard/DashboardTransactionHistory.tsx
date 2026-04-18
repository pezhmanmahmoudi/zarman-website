import React from "react";
import { History, Target, Trash2 } from "lucide-react";
import { formatToman } from "@/app/(fa)/fa/dashboard/dashboard.utils";
import styles from "@/styles/dashboard/DashboardTransactionHistory.module.css";
import cardStyles from "@/styles/dashboard/DashboardCards.module.css";

export function DashboardTransactionHistory({ transactions, totalVolume, onDeleteTransaction }: any) {
  return (
    <article className={cardStyles.panelCard}>
      <div className={cardStyles.panelHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <h2 className={cardStyles.panelTitle} style={{ margin: 0 }}>
          <History size={24} /> سوابق مالی و تراکنش‌ها
        </h2>
        
        <div className={styles.volumeBadge}>
          <Target size={18} />
          <span>حجم تبادلات تایید شده: <strong dir="ltr">{Number(totalVolume).toLocaleString("en-US")} AUD</strong></span>
        </div>
      </div>
      
      <div className={styles.tableWrap}>
        <table className={styles.historyTable}>
          <thead>
            <tr>
              <th>تاریخ ثبت</th>
              <th>نوع تراکنش</th>
              <th>مبلغ ارزی (AUD)</th>
              <th>معادل (تومان)</th>
              <th>وضعیت</th>
              <th>حذف</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 && (
              <tr>
                <td colSpan={6} className={styles.emptyTable}>هیچ سابقه تراکنشی یافت نشد.</td>
              </tr>
            )}
            {transactions.length > 0 && transactions.map((tx: any) => (
              <tr key={tx.id}>
                
                {/* 👈 تغییر جادویی تاریخ به فرمت 4 Apr 2026 */}
                <td dir="ltr" className={styles.tableDate}>
                  {new Date(tx.created_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric"
                  })}
                </td>
                
                <td>
                  <span className={tx.type === "buy_aud" ? styles.txTypeBuy : styles.txTypeSell}>
                    {tx.type === "buy_aud" ? "خرید دلار" : "فروش دلار"}
                  </span>
                </td>
                
                <td dir="ltr" className={styles.tableMoney}>${Number(tx.amount_aud).toLocaleString("en-US")}</td>
                
                <td className={styles.tableToman}>{formatToman(tx.equivalent_toman)}</td>
                
                <td>
                  <span className={
                    tx.status === "approved" ? styles.statusApproved :
                    tx.status === "rejected" ? styles.statusRejected :
                    styles.statusPending
                  }>
                    {tx.status === "approved" ? "تایید شده" :
                     tx.status === "rejected" ? "رد شده" : "در حال بررسی"}
                  </span>
                </td>
                
                <td>
                  {tx.status === "pending" ? (
                    <button 
                      onClick={() => onDeleteTransaction(tx.id)} 
                      className={styles.deleteBtn} 
                      title="لغو و حذف درخواست"
                    >
                      <Trash2 size={18} />
                    </button>
                  ) : (
                    <span className={styles.noAction}>-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}