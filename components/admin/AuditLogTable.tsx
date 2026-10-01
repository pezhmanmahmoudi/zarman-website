"use client";

import { useState } from "react";
import { AdminBadge, AdminDataTable, AdminTableCell, AdminTableDate, AdminTableIdentity, AdminTableRow } from "./ui/AdminDataTable";
import { AdminRecordDrawer } from "./ui/AdminRecordDrawer";
import styles from "@/styles/admin/AdminWorkspace.module.css";

export type AuditRecord = { id: string; created_at: string; action: string; actor_email: string | null; actor_is_admin?: boolean | null;
  target_type: string | null; target_id: string | null; old_value?: unknown; new_value?: unknown };
function actionLabel(action: string) { return action.replaceAll("_", " ").toLowerCase().replace(/^./, letter => letter.toUpperCase()); }
function AuditAction({ action }: { action: string }) {
  const normalized = action.toUpperCase();
  return <AdminBadge tone={normalized.includes("APPROV") ? "success" : normalized.includes("REJECT") || normalized.includes("DELETE") ? "rejected" : "closed"}>{actionLabel(action)}</AdminBadge>;
}
export function AuditLogTable({ logs, total }: { logs: AuditRecord[]; total: number }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = logs.find(log => log.id === selectedId);
  return <>
    <AdminDataTable label="Audit log" columns={[
      { key: "actor", label: "Actor" }, { key: "action", label: "Action" }, { key: "target", label: "Record" },
      { key: "date", label: <>Date<span className={styles.timeZone}>Sydney time</span></> }, { key: "details", label: "Actions", actions: true },
    ]} empty={!logs.length && <strong>{total ? "No audit entries on this page. Choose another page below." : "No audit log entries yet."}</strong>}>
      {logs.map(log => <AdminTableRow key={log.id}>
        <AdminTableCell kind="primary"><AdminTableIdentity name={log.actor_email || "System"} detail={log.actor_is_admin ? "Administrator" : log.actor_email ? "User" : "Automated action"} /></AdminTableCell>
        <AdminTableCell label="Action"><AuditAction action={log.action} /></AdminTableCell>
        <AdminTableCell label="Record">{log.target_type?.replaceAll("_", " ") || "—"}<span className={styles.detail}><bdi title={log.target_id || undefined}>{log.target_id ? log.target_id.slice(0, 12) + (log.target_id.length > 12 ? "…" : "") : "—"}</bdi></span></AdminTableCell>
        <AdminTableCell label="Sydney time"><AdminTableDate value={log.created_at} time /></AdminTableCell>
        <AdminTableCell kind="actions"><button type="button" className={styles.detailsToggle} aria-label={`View audit entry ${log.id}`} aria-haspopup="dialog" onClick={() => setSelectedId(log.id)}>View changes</button></AdminTableCell>
      </AdminTableRow>)}
    </AdminDataTable>
    {selected && <AdminRecordDrawer title={actionLabel(selected.action)} eyebrow="Audit entry" subtitle={<AdminTableDate value={selected.created_at} time />} onClose={() => setSelectedId(null)}>
      <section className={styles.detailSection}><h3>Record</h3><dl className={styles.facts}>
        <div data-wide><dt>Actor</dt><dd><bdi>{selected.actor_email || "System"}</bdi>{selected.actor_is_admin && " · Administrator"}</dd></div>
        <div><dt>Record type</dt><dd>{selected.target_type || "—"}</dd></div>
        <div data-wide><dt>Record ID</dt><dd><bdi>{selected.target_id || "—"}</bdi></dd></div>
        <div data-wide><dt>Audit ID</dt><dd><bdi>{selected.id}</bdi></dd></div>
      </dl></section>
      <section className={styles.detailSection}><h3>Before</h3><pre className={styles.jsonValue}>{selected.old_value == null ? "No previous value recorded." : JSON.stringify(selected.old_value, null, 2)}</pre></section>
      <section className={styles.detailSection}><h3>After</h3><pre className={styles.jsonValue}>{selected.new_value == null ? "No new value recorded." : JSON.stringify(selected.new_value, null, 2)}</pre></section>
    </AdminRecordDrawer>}
  </>;
}
