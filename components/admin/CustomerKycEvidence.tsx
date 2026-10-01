"use client";

import { useEffect, useState } from "react";
import { getCustomerKycEvidenceForAdmin, getCustomerKycFileForAdmin } from "@/app/actions/kyc-evidence.actions";
import { KYC_ADDRESS_DOCUMENTS, kycDocument } from "@/lib/kyc/evidence";
import styles from "@/styles/admin/AdminWorkspace.module.css";

export function CustomerKycEvidence({ userId }: { userId: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getCustomerKycEvidenceForAdmin>>>(null);
  const [status, setStatus] = useState("Loading submitted evidence…");
  const [link, setLink] = useState<{ id: string; url: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getCustomerKycEvidenceForAdmin(userId).then(result => { if(active) {setData(result);setStatus(result ? "" : "No document evidence has been submitted through the new form.");} }).catch(() => { if(active) setStatus("Could not load document evidence. Refresh to try again."); });
    return () => { active = false; };
  }, [userId]);
  useEffect(() => {
    if (!link) return;
    const timer = setTimeout(() => setLink(null), 55000);
    return () => clearTimeout(timer);
  }, [link]);
  async function prepare(id: string) {
    setBusy(id); setLink(null); setStatus("");
    try { setLink({ id, url: await getCustomerKycFileForAdmin(id) }); }
    catch { setStatus("Unable to open the document. Try again."); }
    finally { setBusy(null); }
  }
  return <section className={styles.detailSection} aria-label="Customer-submitted evidence">
    <h3>Customer-submitted documents</h3>
    <p>Unverified evidence. Check authenticity, identity, address and the required compliance checks before approving. An upload is not a successful DVS result.</p>
    {status && <p role="status">{status}</p>}
    {data && <>
      <dl className={styles.facts}>
        <div><dt>Document</dt><dd>{kycDocument(data.document_type)?.label || data.document_type}</dd></div>
        <div><dt>Submitted</dt><dd>{new Date(data.created_at).toLocaleString("en-AU")}</dd></div>
        {[ ["Document number", data.details.document_number], ["Issuing authority", data.details.document_issuer], ["Reporting category", data.details.report_type], ["Proof of address", KYC_ADDRESS_DOCUMENTS.find(item => item.value === data.details.address_type)?.label], ["Address document date", data.details.address_date], ["Consent version", data.details.consent_version] ].map(([label,value]) => value ? <div key={label}><dt>{label}</dt><dd>{String(value)}</dd></div> : null)}
      </dl>
      <ul>{data.uploads.map(file => <li key={file.id}>
        <span>{file.role === "front" ? "Identity document / front" : file.role === "back" ? "Back" : "Proof of address"}: {file.original_name}</span>{" "}
        {link && link.id === file.id ? <a href={link.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Open document (expires in 60 seconds)</a> : <button type="button" className={styles.detailsToggle} disabled={busy !== null} onClick={() => void prepare(file.id)}>{busy === file.id ? "Preparing…" : "Get secure link"}</button>}
      </li>)}</ul>
    </>}
  </section>;
}
