"use client";

import { useMemo, useState } from "react";
import { CheckCheck, Search } from "lucide-react";
import { matchesTransactionSearch, sortTransactionQueue, transactionQueueState } from "@/lib/admin-transaction-workspace";
import { TransactionTable } from "./TransactionTable";
import type { BankAccountOption, TransactionRow } from "./TransactionsManager";
import styles from "@/styles/admin/AdminWorkspace.module.css";

const filters = [
  ["all", "All active"], ["review", "Review"], ["funding", "Check payment"],
  ["ready", "To complete"], ["waiting", "Waiting for customer"], ["refund", "Refunds"],
] as const;

export function TransactionQueue({ rows, bankAccounts }: { rows: TransactionRow[]; bankAccounts: BankAccountOption[] }) {
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const sorted = useMemo(() => sortTransactionQueue(rows), [rows]);
  const visible = sorted.filter(row => (filter === "all" || transactionQueueState(row).stage === filter) && matchesTransactionSearch(row, search));

  return <section className={styles.panel} aria-label="Active transactions">
    <div className={styles.toolbar}>
      <div className={styles.filters} role="group" aria-label="Filter active transactions">
        {filters.map(([key, label]) => {
          const count = key === "all" ? rows.length : rows.filter(row => transactionQueueState(row).stage === key).length;
          return <button key={key} type="button" aria-pressed={key === filter} onClick={() => setFilter(key)}>{label}<span>{count}</span></button>;
        })}
      </div>
      <span className={styles.recordCount}>{visible.length.toLocaleString("en-AU")} active</span>
    </div>
    <div className={styles.historyControls}>
      <label className={styles.search}><Search size={16} aria-hidden="true" /><span className={styles.srOnly}>Search active transactions</span>
        <input type="search" placeholder="Search customer, reference or recipient" value={search} onChange={event => setSearch(event.target.value)} />
      </label>
    </div>
    {visible.length > 0 ? <TransactionTable rows={visible} isPending bankAccounts={bankAccounts} /> : <div className={styles.empty} role="status"><CheckCheck size={26} aria-hidden="true" />
      <strong>{rows.length ? "No matching transactions" : "You're all caught up"}</strong>
      <p>{rows.length ? "Try another stage or search term." : "New requests and manual transactions will appear here."}</p>
      {!!rows.length && <button type="button" className={styles.action} onClick={() => { setFilter("all"); setSearch(""); }}>Clear filters</button>}
    </div>}
  </section>;
}
