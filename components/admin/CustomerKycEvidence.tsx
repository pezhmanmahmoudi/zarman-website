"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getCustomerKycEvidenceForAdmin } from "@/app/actions/kyc-evidence.actions";
import { EditableCustomerCode } from "@/components/admin/EditableCustomerCode";
import { CustomerKycDocuments } from "@/components/admin/CustomerKycDocuments";
import { formatAustralianDriverLicenceIssuer } from "@/lib/australian-driver-licence";
import { KYC_ADDRESS_DOCUMENTS, isIranCountry, kycDocument } from "@/lib/kyc/evidence";
import styles from "@/styles/admin/CustomerIdentity.module.css";

type IdentityProfile = { id: string; [key: string]: unknown };
type Detail = [label: string, value: ReactNode];
const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : typeof value === "number" ? String(value) : null;
const submittedDate = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Australia/Sydney" });

export function CustomerKycEvidence({ userId, profile }: { userId: string; profile?: IdentityProfile }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getCustomerKycEvidenceForAdmin>>>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    getCustomerKycEvidenceForAdmin(userId)
      .then(result => { if (active) setData(result); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, attempt]);

  const submitted: Record<string, unknown> = data?.details ?? {};
  const profileType = text(profile?.document_type);
  const hasProfileDocument = !!profileType && profileType !== "none";
  // Keep current profile corrections; use the submission for document types the
  // legacy profile cannot represent (for example, a foreign passport).
  const submittedProfileType = data ? text(submitted.profile_document_type) ?? kycDocument(data.document_type)?.profileType ?? data.document_type : null;
  const useSubmission = !!data && (!profile || (hasProfileDocument
    ? profileType === submittedProfileType || profileType === data.document_type
    : submittedProfileType === "none"));
  const documentType = useSubmission ? data!.document_type : hasProfileDocument ? profileType : "";
  const document = kycDocument(documentType);
  const details: Record<string, unknown> = useSubmission ? submitted : {};
  const hasProfileField = (key: string) => !!profile && Object.prototype.hasOwnProperty.call(profile, key);
  const current = (key: string) => hasProfileField(key) ? text(profile![key]) : text(details[key]);
  const personal = (key: string) => hasProfileField(key) ? text(profile![key]) : text(submitted[key]);
  const primaryNumber = (key: string) => hasProfileField(key) ? text(profile![key]) : text(details[key]) ?? text(details.document_number);
  const documentLabel = documentType === "foreign_passport" && isIranCountry(details.country) && isIranCountry(details.document_issuer)
    ? "Iranian passport" : document?.label ?? documentType;
  const number = documentType === "driver_license" ? primaryNumber("license_number")
    : documentType === "passport" ? primaryNumber("passport_number")
    : text(details.document_number);
  const issuer = documentType === "driver_license"
    ? formatAustralianDriverLicenceIssuer(current("state_of_issue")) || (!hasProfileField("state_of_issue") ? text(details.document_issuer) : null)
    : text(details.document_issuer) ?? (documentType === "passport" ? "Australia" : null);
  const rows: Detail[] = profile ? [
    ["Customer code", <EditableCustomerCode key={profile.id} userId={profile.id} currentCode={text(profile.customer_code)} />],
    ["Full name", [personal("first_name"), personal("last_name")].filter(Boolean).join(" ")],
    ["Email", personal("email")],
    ["Phone", personal("mobile_number")],
    ["Date of birth", personal("dob")],
    ["Address", ["address", "city", "state", "postcode", "country"].map(personal).filter(Boolean).join(", ")],
  ] : [["Date of birth", text(submitted.dob)]];
  rows.push(["Document type", documentLabel || (loading ? "Loading…" : error ? "Unavailable" : "Not provided")]);
  if (documentType) {
    rows.push([documentType === "driver_license" ? "Licence number" : ["passport", "foreign_passport"].includes(documentType) ? "Passport number" : "Document number", number]);
    if (issuer) rows.push(["Issuing authority", issuer]);
    if (documentType === "driver_license") rows.push(["Licence card number", current("card_number")]);
    if (current("expiry_date")) rows.push(["Expiry date", current("expiry_date")]);
    const additional: Detail[] = [
      ["Medicare individual reference number", text(details.medicare_irn)],
      ["Medicare card colour", text(details.medicare_colour)],
      ["Medicare valid to", text(details.medicare_expiry)],
      ["Reporting category", text(details.report_type)],
      ["Proof of address", KYC_ADDRESS_DOCUMENTS.find(item => item.value === details.address_type)?.label],
      ["Address document date", text(details.address_date)],
    ];
    rows.push(...additional.filter(([, value]) => !!value));
  }

  return <section className={styles.identity} aria-label={profile ? "Customer identity details" : "Submitted identity document"}>
    {!profile && <h3 className={styles.heading}>Identity document</h3>}
    <dl className={styles.details}>
      {rows.map(([label, value]) => <div key={label} className={styles.detail}>
        <dt>{label}</dt><dd>{value || <span className={styles.empty}>—</span>}</dd>
      </div>)}
    </dl>
    {loading && <p className={styles.message} role="status">Loading submission details…</p>}
    {error && <div className={styles.loadError} role="alert">Could not load submission details.
      <button type="button" onClick={() => setAttempt(value => value + 1)}>Try again</button>
    </div>}
    {data && <>
      <dl className={styles.submission} aria-label="Submission and consent">
        <div><dt>Submitted <span>(Sydney)</span></dt><dd><time dateTime={data.created_at}>{submittedDate.format(new Date(data.created_at))}</time></dd></div>
        <div><dt>Verification consent</dt><dd>{submitted.consent_dvs === true && submitted.consent_notice === true ? "Granted at submission" : "Not granted"}</dd></div>
        <div><dt>Consent version</dt><dd>{text(submitted.consent_version) || "—"}</dd></div>
      </dl>
      <CustomerKycDocuments files={data.uploads} documentType={data.document_type} />
    </>}
  </section>;
}
