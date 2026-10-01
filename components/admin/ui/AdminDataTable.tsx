import type { ComponentPropsWithoutRef, ReactNode } from "react";
import Link from "next/link";
import base from "@/styles/admin/AdminTable.module.css";
import styles from "@/styles/admin/AdminWorkspace.module.css";

export type AdminColumn = { key: string; label: ReactNode; align?: "end"; selection?: boolean; actions?: boolean };

/** Shared semantic table. The same cells become labeled cards on narrow screens. */
export function AdminDataTable({ label, columns, children, selection, empty }: {
  label: string; columns: AdminColumn[]; children: ReactNode; selection?: ReactNode; empty?: ReactNode;
}) {
  if (empty) return <div className={styles.empty} role="status">{empty}</div>;
  return <div className={styles.dataViewport}>
    {selection && <div className={styles.mobileSelection}>{selection}<span>Select page</span></div>}
    <div className={`${base.tableWrap} ${styles.tableScroll}`} role="region" aria-label={label} tabIndex={0}>
      <table className={`${base.table} ${styles.table}`} role="table">
        <thead role="rowgroup"><tr role="row">{columns.map(column => <th key={column.key} scope="col" className={column.selection ? styles.selectionCell : column.align === "end" ? styles.moneyHeading : undefined}>
          {column.actions || column.selection ? <span className={styles.srOnly}>{column.label}</span> : column.label}
          {column.selection && selection}
        </th>)}</tr></thead>
        <tbody role="rowgroup">{children}</tbody>
      </table>
    </div>
  </div>;
}

export function AdminTableRow({ className = "", ...props }: ComponentPropsWithoutRef<"tr">) {
  return <tr role="row" className={`${styles.recordRow} ${className}`.trim()} {...props} />;
}

export function AdminTableCell({ label, kind, align, children, className = "", ...props }: ComponentPropsWithoutRef<"td"> & {
  label?: string; kind?: "primary" | "actions" | "selection"; align?: "left" | "center" | "right" | "justify" | "char";
}) {
  const cell = kind === "primary" ? styles.identityCell : kind === "actions" ? styles.actionsCell : kind === "selection" ? styles.selectionCell : align === "right" ? styles.numberCell : styles.dataCell;
  return <td role="cell" className={`${cell} ${className}`.trim()} data-kind={kind} {...props}>
    {label && kind !== "primary" && kind !== "actions" && kind !== "selection" && <span className={styles.mobileLabel}>{label}</span>}
    {kind === "actions" ? <div className={styles.rowActions}>{children}</div> : children}
  </td>;
}

export function AdminTableIdentity({ name, detail, href }: { name: ReactNode; detail?: ReactNode; href?: string }) {
  const title = <strong><bdi>{name}</bdi></strong>;
  return <>{href ? <Link href={href} className={styles.customer}>{title}</Link> : <span className={styles.customer}>{title}</span>}
    {detail && <div className={styles.identityMeta}>{detail}</div>}
  </>;
}

export function AdminBadge({ children, tone = "closed" }: { children: ReactNode; tone?: "review" | "funding" | "ready" | "success" | "rejected" | "closed" | "waiting" | "refund" }) {
  return <span className={styles.status} data-stage={tone}><span aria-hidden="true" />{children}</span>;
}

const dateFormat = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Sydney" });
const timeFormat = new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit", timeZone: "Australia/Sydney" });
export function AdminTableDate({ value, time = false, prefix = "" }: { value?: string | null; time?: boolean; prefix?: string }) {
  if (!value || Number.isNaN(new Date(value).getTime())) return <span>—</span>;
  const date = new Date(value);
  return <time dateTime={value} dir="ltr"><span>{prefix}{dateFormat.format(date)}</span>{time && <span className={styles.meta}>{timeFormat.format(date)}</span>}</time>;
}
