"use client";

import { useState } from "react";
import { AdminDataTable, AdminTableCell, AdminTableDate, AdminTableIdentity, AdminTableRow } from "./ui/AdminDataTable";
import { AdminRecordDrawer } from "./ui/AdminRecordDrawer";
import { StatusBadge } from "./ui/StatusBadge";
import { KycActionButtons } from "./KycActionButtons";
import { EditableCustomerCode } from "./EditableCustomerCode";
import { formatAustralianDriverLicenceIssuer } from "@/lib/australian-driver-licence";
import { CustomerKycEvidence } from "@/components/admin/CustomerKycEvidence";
import styles from "@/styles/admin/AdminWorkspace.module.css";

export type IdentityRecord = { id: string; first_name?: string | null; last_name?: string | null; email?: string | null;
  mobile_number?: string | null; kyc_status?: string | null; customer_code?: string | null; created_at?: string | null;
  document_type?: string | null; [key: string]: unknown };
const nameOf = (user: IdentityRecord) => [user.first_name, user.last_name].filter(Boolean).join(" ") || "Unnamed customer";
const documentLabel = (type?: string | null) => type === "driver_license" ? "Driver’s licence" : type === "passport" ? "Passport" : type || "Not provided";

export function IdentityVerificationTable({ users, emptyMessage }: { users: IdentityRecord[]; emptyMessage: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = users.find(user => user.id === selectedId);
  return <>
    <AdminDataTable label="Identity verification" columns={[
      { key: "customer", label: "Customer" }, { key: "contact", label: "Contact" }, { key: "document", label: "Identity document" },
      { key: "status", label: "Status" }, { key: "joined", label: "Joined" }, { key: "actions", label: "Actions", actions: true },
    ]} empty={!users.length && <strong>{emptyMessage}</strong>}>
      {users.map(user => <AdminTableRow key={user.id}>
        <AdminTableCell kind="primary"><AdminTableIdentity name={nameOf(user)} detail={user.customer_code} href={`/admin/users?userId=${encodeURIComponent(user.id)}`} /></AdminTableCell>
        <AdminTableCell label="Contact"><bdi>{user.email || "—"}</bdi><span className={styles.detail}><bdi>{user.mobile_number}</bdi></span></AdminTableCell>
        <AdminTableCell label="Identity document">{documentLabel(user.document_type)}</AdminTableCell>
        <AdminTableCell label="Status"><StatusBadge status={user.kyc_status || null} /></AdminTableCell>
        <AdminTableCell label="Joined"><AdminTableDate value={user.created_at} /></AdminTableCell>
        <AdminTableCell kind="actions"><KycActionButtons userId={user.id} currentStatus={user.kyc_status || undefined} />
          <button type="button" className={styles.detailsToggle} aria-label={`View identity details for ${nameOf(user)}`} aria-haspopup="dialog" onClick={() => setSelectedId(user.id)}>View</button>
        </AdminTableCell>
      </AdminTableRow>)}
    </AdminDataTable>
    {selected && <AdminRecordDrawer title={nameOf(selected)} eyebrow="Identity verification" subtitle={selected.customer_code} onClose={() => setSelectedId(null)}
      footer={<KycActionButtons userId={selected.id} currentStatus={selected.kyc_status || undefined} />}>
      <StatusBadge status={selected.kyc_status || null} />
      <section className={styles.detailSection}><h3>Customer details</h3><dl className={styles.facts}>
        <div><dt>Customer code</dt><dd><EditableCustomerCode userId={selected.id} currentCode={selected.customer_code || null} /></dd></div>
        <div><dt>Date of birth</dt><dd>{String(selected.dob || "—")}</dd></div>
        <div data-wide><dt>Email</dt><dd><bdi>{selected.email || "—"}</bdi></dd></div>
        <div><dt>Phone</dt><dd><bdi>{selected.mobile_number || "—"}</bdi></dd></div>
        <div data-wide><dt>Address</dt><dd>{["address", "city", "state", "postcode", "country"].map(key => selected[key]).filter(Boolean).join(", ") || "—"}</dd></div>
      </dl></section>
      <section className={styles.detailSection}><h3>{documentLabel(selected.document_type)}</h3><dl className={styles.facts}>
        {[
          ["Document number", selected.document_type === "passport" ? selected.passport_number : selected.license_number],
          ["Card number", selected.card_number],
          ["Issuing authority", selected.state_of_issue ? formatAustralianDriverLicenceIssuer(String(selected.state_of_issue)) : null],
          ["Expiry date", selected.expiry_date],
        ].map(([label, value]) => value ? <div key={String(label)}><dt>{String(label)}</dt><dd><bdi>{String(value)}</bdi></dd></div> : null)}
      </dl></section>
      <CustomerKycEvidence key={selected.id} userId={selected.id}/>
    </AdminRecordDrawer>}
  </>;
}
