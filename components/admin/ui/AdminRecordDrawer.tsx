"use client";

import { useId, type ReactNode } from "react";
import { X } from "lucide-react";
import { AdminDialog } from "./AdminDialog";
import styles from "@/styles/admin/AdminWorkspace.module.css";

export function AdminRecordDrawer({ title, subtitle, eyebrow = "Record details", children, footer, onClose, busy = false }: {
  title: ReactNode; subtitle?: ReactNode; eyebrow?: string; children: ReactNode; footer?: ReactNode; onClose: () => void; busy?: boolean;
}) {
  const id = useId();
  return <AdminDialog open onClose={onClose} dismissible={!busy} variant="drawer-right" labelledBy={id} className={styles.drawer}>
    <header className={styles.drawerHeader}>
      <div><p className={styles.eyebrow}>{eyebrow}</p><h2 id={id}><bdi>{title}</bdi></h2>{subtitle && <span className={styles.drawerReference}>{subtitle}</span>}</div>
      <button type="button" className={styles.iconButton} onClick={onClose} disabled={busy} aria-label="Close record details" data-autofocus><X size={20} aria-hidden="true" /></button>
    </header>
    <div className={styles.drawerBody}>{children}</div>
    {footer && <footer className={styles.drawerFooter}>{footer}</footer>}
  </AdminDialog>;
}
