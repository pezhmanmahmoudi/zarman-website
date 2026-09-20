"use client";
import { useState } from "react";
import { ArrowUpRight, ArrowDownLeft, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import type { Transaction } from "@/app/[locale]/dashboard/dashboard.types";
import { requestDate, requestMoney } from "@/components/requests/request-labels";
import { useLocale } from "@/context/LocaleContext";
import styles from "@/styles/dashboard/DashboardHome.module.css";

export function DashboardTransactionHistory({ transactions, onDeleteTransaction }: {
  transactions: Transaction[]; onDeleteTransaction: (id: string | number) => void;
}) {
  const locale = useLocale(), fa = locale === "fa";
  const [page,setPage] = useState(1);
  const pages = Math.max(1,Math.ceil(transactions.length/10)), current = Math.min(page,pages);
  const visible = transactions.slice((current-1)*10,current*10);
  const labels = { approved: fa ? "تکمیل‌شده" : "Completed", pending: fa ? "در حال بررسی" : "Under review", rejected: fa ? "رد شده" : "Declined", cancelled: fa ? "لغو شده" : "Cancelled" };
  return <article className={styles.card}>
    <header className={styles.cardHeader}><h2>{fa ? "سوابق تراکنش‌ها" : "Transaction records"}</h2></header>
    {visible.map(tx => <div className={styles.activityRow} key={tx.id}>
      <span className={styles.activityIcon}>{tx.type === "buy_aud" ? <ArrowUpRight size={18}/> : <ArrowDownLeft size={18}/>}</span>
      <div><div className={styles.activityName}>{tx.recipients?.label || tx.recipients?.full_name || tx.recipients?.account_name || tx.reference_code || (fa ? "انتقال وجه" : "Money transfer")}</div>
        <div className={styles.activityMeta}><bdi>{tx.reference_code || "—"}</bdi><time dir="ltr" dateTime={tx.created_at}>{requestDate(tx.created_at,locale)}</time></div>
        <span className={styles.status} data-tone={tx.status === "approved" ? "complete" : "neutral"}>{labels[tx.status]}</span>
      </div>
      <div className={styles.activityAmount}><bdi data-private-value>{requestMoney(tx.amount_aud,"AUD",locale)}</bdi><span className={styles.status} data-private-value>{requestMoney(tx.equivalent_toman,"IRT",locale)}</span>
        {tx.status === "pending" && <button className={styles.textLink} onClick={() => onDeleteTransaction(tx.id)} aria-label={`${fa ? "لغو درخواست" : "Cancel request"} ${tx.reference_code||""}`}><Trash2 size={13}/>{fa ? "لغو" : "Cancel"}</button>}
      </div>
    </div>)}
    {pages>1 && <div className={styles.more}><button className={styles.secondary} onClick={() => setPage(current-1)} disabled={current===1} aria-label={fa ? "صفحه قبل" : "Previous page"}><ChevronLeft size={15}/></button><span className={styles.count}>{current} / {pages}</span><button className={styles.secondary} onClick={() => setPage(current+1)} disabled={current===pages} aria-label={fa ? "صفحه بعد" : "Next page"}><ChevronRight size={15}/></button></div>}
  </article>;
}
