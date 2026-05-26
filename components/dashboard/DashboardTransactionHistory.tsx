import React, { useState } from "react";
import { History, Target, Trash2, ChevronLeft, ChevronRight, Tag, Star } from "lucide-react";
import { formatToman } from "@/app/[locale]/dashboard/dashboard.utils";
import styles from "@/styles/dashboard/DashboardTransactionHistory.module.css";
import cardStyles from "@/styles/dashboard/DashboardCards.module.css";

const PAGE_SIZE = 10;

export function DashboardTransactionHistory({ transactions, totalVolume, onDeleteTransaction }: any) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(transactions.length / PAGE_SIZE));
  const paginated = transactions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const recipientName = (tx: any): string | null => {
    const r = tx.recipients;
    if (!r) return null;
    return r.label || r.full_name || r.account_name || null;
  };

  return (
    <article className={cardStyles.panelCard}>
      <div className={`${cardStyles.panelHeader} ${styles.headerWrap}`}>
        <h2 className={`${cardStyles.panelTitle} ${styles.tableTitle}`}>
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
              <th>کد مرجع</th>
              <th>تاریخ ثبت</th>
              <th>نوع تراکنش</th>
              <th>مبلغ ارزی (AUD)</th>
              <th>معادل (تومان)</th>
              <th>گیرنده</th>
              <th>تخفیف</th>
              <th>وضعیت</th>
              <th>حذف</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 && (
              <tr>
                <td colSpan={9} className={styles.emptyTable}>هیچ سابقه تراکنشی یافت نشد.</td>
              </tr>
            )}
            {paginated.map((tx: any) => (
              <tr key={tx.id}>
                <td dir="ltr" className={styles.tableRef}>
                  {tx.reference_code ?? <span className={styles.noAction}>—</span>}
                </td>
                <td dir="ltr" className={styles.tableDate}>
                  {new Date(tx.created_at).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit"
                  })}
                </td>
                
                <td>
                  <span className={tx.type === "buy_aud" ? styles.txTypeBuy : styles.txTypeSell}>
                    {tx.type === "buy_aud" ? "خرید دلار" : "فروش دلار"}
                  </span>
                </td>
                
                <td dir="ltr" className={styles.tableMoney}>${Number(tx.amount_aud).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                
                <td className={styles.tableToman}>{formatToman(tx.equivalent_toman)}</td>

                <td className={styles.recipientCell}>
                  {recipientName(tx) ?? <span className={styles.noAction}>—</span>}
                </td>

                <td>
                  {!tx.promo_code && !Number(tx.loyalty_discount ?? 0) ? (
                    <span className={styles.noAction}>—</span>
                  ) : (
                    <div className={styles.discountCell}>
                      {tx.promo_code && (
                        <span className={styles.promoRow}>
                          <Tag size={10} />
                          <span className={styles.discountType}>پرومو</span>
                          {Number(tx.discount_amount ?? 0) > 0 && (
                            <span className={styles.discountAmt}>{formatToman(Number(tx.discount_amount))}</span>
                          )}
                        </span>
                      )}
                      {Number(tx.loyalty_discount ?? 0) > 0 && (
                        <span className={styles.loyaltyRow}>
                          <Star size={10} />
                          <span className={styles.discountType}>وفاداری</span>
                          <span className={styles.discountAmt}>{formatToman(Number(tx.loyalty_discount))}</span>
                        </span>
                      )}
                    </div>
                  )}
                </td>
                
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            aria-label="صفحه قبل"
          >
            <ChevronRight size={18} />
          </button>
          <span className={styles.pageInfo}>
            {page} / {totalPages}
          </span>
          <button
            className={styles.pageBtn}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            aria-label="صفحه بعد"
          >
            <ChevronLeft size={18} />
          </button>
        </div>
      )}
    </article>
  );
}