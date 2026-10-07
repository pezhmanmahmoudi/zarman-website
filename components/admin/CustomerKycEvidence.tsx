"use client";

import { useEffect, useState } from "react";
import { getCustomerKycEvidenceForAdmin, getCustomerKycFileForAdmin } from "@/app/actions/kyc-evidence.actions";
import { KYC_ADDRESS_DOCUMENTS, isIranCountry, kycDocument } from "@/lib/kyc/evidence";
import styles from "@/styles/admin/AdminWorkspace.module.css";

export function CustomerKycEvidence({ userId }: { userId: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getCustomerKycEvidenceForAdmin>>>(null);
  const [status, setStatus] = useState("Loading submitted evidence…");
  const [link, setLink] = useState<{ id: string; url: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getCustomerKycEvidenceForAdmin(userId).then(result => { if(active) {setData(result);setStatus(result ? "" : "No identity details or supporting evidence have been submitted through the new form.");} }).catch(() => { if(active) setStatus("Could not load verification details. Refresh to try again."); });
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
    <h3>Customer-submitted identity details and evidence</h3>
    <p>Unverified information. Check identity, address and the required compliance checks before approving. Submitted details or files are not a successful verification result.</p>
    {status && <p role="status">{status}</p>}
    {data && <>
      <dl className={styles.facts}>
        <div><dt>Document</dt><dd>{data.document_type === "foreign_passport" && isIranCountry(data.details.country) && isIranCountry(data.details.document_issuer) ? "Iranian passport" : kycDocument(data.document_type)?.label || data.document_type}</dd></div>
        <div><dt>Submitted</dt><dd>{new Date(data.created_at).toLocaleString("en-AU")}</dd></div>
        {[ ["Date of birth", data.details.dob], ["Document number", data.details.document_number || data.details.license_number || data.details.passport_number], ["Licence card number", data.details.card_number], ["State of issue", data.details.state_of_issue], ["Expiry date", data.details.expiry_date], ["Issuing authority", data.details.document_issuer], ["Medicare individual reference number", data.details.medicare_irn], ["Medicare card colour", data.details.medicare_colour], ["Medicare valid to", data.details.medicare_expiry], ["Reporting category", data.details.report_type], ["Proof of address", KYC_ADDRESS_DOCUMENTS.find(item => item.value === data.details.address_type)?.label], ["Address document date", data.details.address_date], ["Verification consent", data.details.consent_dvs === true && data.details.consent_notice === true ? "Granted at submission" : "Not granted"], ["Consent version", data.details.consent_version] ].map(([label,value]) => value ? <div key={label}><dt>{label}</dt><dd>{String(value)}</dd></div> : null)}
      </dl>
      {kycDocument(data.document_type)?.textOnly && <p>The primary identity document was submitted as text details. No primary document image is required.</p>}
      {data.document_type === "medicare" && <p>Medicare details require review. The current provider integration does not perform a Medicare check; a skipped check is not identity verification.</p>}
      <ul>{data.uploads.map(file => <li key={file.id}>
        <span>{file.role === "source_of_funds" ? "Source of funds" : file.role === "front" ? data.document_type === "foreign_passport" ? "Passport photo and personal details page" : "Alternative identity document / certified copy" : file.role === "back" ? "Back of alternative document" : "Proof of address"}: {file.original_name}</span>{" "}
        {link && link.id === file.id ? <a href={link.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Open document (expires in 60 seconds)</a> : <button type="button" className={styles.detailsToggle} disabled={busy !== null} onClick={() => void prepare(file.id)}>{busy === file.id ? "Preparing…" : "Get secure link"}</button>}
      </li>)}</ul>
    </>}
  </section>;
}
