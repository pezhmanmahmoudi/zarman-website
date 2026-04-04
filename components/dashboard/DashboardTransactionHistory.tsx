import React from "react";
import { History } from "lucide-react";
import { formatAUD, formatToman } from "@/app/fa/dashboard/dashboard.utils";
import styles from "@/styles/dashboard/DashboardTransactionHistory.module.css";
import cardStyles from "@/styles/dashboard/DashboardCards.module.css";
import { Transaction } from "@/app/fa/dashboard/dashboard.types";

export function DashboardTransactionHistory({ transactions }: { transactions: Transaction[] }) {
  return (
    <article className={cardStyles.panelCard}>
      <h2 className={cardStyles.panelTitle}><History size={24} /> سوابق مالی و تراکنش‌ها</h2>
      <div className={styles.tableWrap}>
        <table className={styles.historyTable}>
          <thead><tr><th>تاریخ ثبت</th><th>نوع تراکنش</th><th>مبلغ ارزی (AUD)</th><th>معادل (تومان)</th></tr></thead>
          <tbody>
            {transactions.length === 0 ? <tr><td colSpan={4} className={styles.emptyTable}>هیچ سابقه تراکنشی یافت نشد.</td></tr> :
              transactions.map((tx) => (
                <tr key={tx.id}>
                  <td dir="ltr" className={styles.tableDate}>{new Date(tx.created_at).toLocaleDateString("fa-IR")}</td>
                  <td><span className={tx.type === "buy_aud" ? styles.txTypeBuy : styles.txTypeSell}>{tx.type === "buy_aud" ? "خرید دلار" : "فروش دلار"}</span></td>
                  <td dir="ltr" className={styles.tableMoney}>{formatAUD(tx.amount_aud)}</td>
                  <td className={styles.tableMoney}>{formatToman(tx.equivalent_toman)}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </article>
  );
}