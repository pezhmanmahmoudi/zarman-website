"use client";

import { useState } from "react";
import { CheckCircle2, FileUp } from "lucide-react";
import { uploadCustomerKycEvidence } from "@/app/actions/kyc-evidence.actions";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";
import CustomDatePicker from "@/components/ui/DatePicker/CustomDatePicker";
import { DashboardLottieScene } from "@/components/dashboard/DashboardLottieScene";
import { dashboardInputClass } from "@/components/dashboard/dashboard-ui";
import { KYC_ID_DOCUMENTS, KYC_ADDRESS_DOCUMENTS, KYC_FILE_ACCEPT, isIranCountry, kycDocument, requiredKycUploads, validateKycFile, type KycEvidenceDraft, type KycUploadRole } from "@/lib/kyc/evidence";
import styles from "@/styles/dashboard/KycDocumentEvidence.module.css";
import flow from "@/styles/dashboard/DashboardProfileFlow.module.css";
import { useLocale } from "@/context/LocaleContext";

type Props = {
  country?: string;
  documentType: string; onDocumentTypeChange: (value: string) => void;
  evidence: KycEvidenceDraft; onChange: (value: KycEvidenceDraft) => void;
  errors: Record<string, string>; disabled: boolean; motionEnabled: boolean;
  onBusyChange: (busy: boolean) => void; children?: React.ReactNode;
};

export function KycDocumentEvidence({ country, documentType, onDocumentTypeChange, evidence, onChange, errors, disabled, motionEnabled, onBusyChange, children }: Props) {
  const locale = useLocale();
  const [busy, setBusy] = useState<KycUploadRole | null>(null);
  const [uploadErrors, setUploadErrors] = useState<Partial<Record<KycUploadRole, string>>>({});
  const [documentSelection, setDocumentSelection] = useState(0);
  const [addressSelection, setAddressSelection] = useState(0);
  const doc = kycDocument(documentType);
  const iranResident = isIranCountry(country);
  const documentOptions = iranResident ? [{value:"foreign_passport",label:"Iranian passport"}] : KYC_ID_DOCUMENTS.map(({value,label}) => ({value,label}));
  const addressDoc = KYC_ADDRESS_DOCUMENTS.find(item => item.value === evidence.addressType);
  const locked = disabled || busy !== null;
  const error = (key: string) => errors[key] ? <p id={`kyc-${key}-error`} role="alert" className={styles.error}>{errors[key]}</p> : null;

  async function upload(role: KycUploadRole, file?: File) {
    if (!file || locked) return;
    const invalid = validateKycFile(file);
    if (invalid) { setUploadErrors(previous => ({ ...previous, [role]: invalid })); return; }
    setBusy(role); onBusyChange(true);
    setUploadErrors(previous => ({ ...previous, [role]: "" }));
    try {
      const saved = await uploadCustomerKycEvidence({ file, role, documentType, addressType: evidence.addressType });
      if ("error" in saved) throw new Error(saved.error);
      onChange({ ...evidence, [role]: saved });
    } catch (cause) {
      setUploadErrors(previous => ({ ...previous, [role]: cause instanceof Error ? cause.message : "Upload failed. Please try again." }));
    } finally { setBusy(null); onBusyChange(false); }
  }

  function fileSlot(role: KycUploadRole, required = true) {
    const title = role === "source_of_funds" ? "Source of funds" : role === "address" ? "Proof of residential address" : role === "back" ? "Back of alternative identity document" : documentType === "certified_copy" ? "Certified copies" : documentType.includes("passport") ? iranResident ? "Iranian passport photo page" : "Foreign passport photo page" : doc?.back ? "Front of alternative identity document" : "Alternative identity document";
    const saved = evidence[role];
    const message = uploadErrors[role] || errors[`evidence-${role}`];
    const scene = busy === role ? "document-upload" : saved && !uploadErrors[role] ? "document-upload-success" : "document-upload-idle";
    return <section key={role} className={styles.upload} aria-busy={busy === role}>
      <div className={styles.uploadHeading}>
        <span className={styles.animation}>
          <DashboardLottieScene key={`${documentType}-${documentSelection}-${role}-${role === "address" ? `${evidence.addressType}-${addressSelection}` : ""}-${saved?.id ?? "empty"}`} name={scene} size={scene === "document-upload-success" ? 96 : 80} motionEnabled={motionEnabled}/>
        </span>
        <div><h3>{title} <span className={styles.required}>{required ? "Required" : "Optional"}</span></h3><p>{role === "source_of_funds" ? "Provide supporting evidence only if our team has requested it. Do not include primary identity document images or Australian tax file numbers." : role === "address" ? "Show your full name, current residential address, issuer and issue date." : doc?.back ? "Upload this side in full, including all four corners." : "Upload the full supporting document, with all details clearly visible."}</p></div>
      </div>
      <label className={styles.fileButton} aria-disabled={locked || (role === "address" && !addressDoc)}>
        <FileUp size={18} aria-hidden="true"/>{busy === role ? "Uploading securely…" : saved ? "Replace file" : "Choose file"}
        <input type="file" accept={KYC_FILE_ACCEPT} aria-label={`Upload ${title.toLowerCase()}`} disabled={locked || (role === "address" && !addressDoc)} onChange={event => { void upload(role, event.target.files?.[0]); event.target.value = ""; }}/>
      </label>
      <p className={styles.fileHint}>JPG, PNG or PDF · Up to 4 MB per file</p>
      {saved && <p className={styles.saved} role="status"><CheckCircle2 size={16} aria-hidden="true"/><span>{saved.name} — uploaded</span></p>}
      {message && <div className={styles.uploadError} role="alert"><DashboardLottieScene name="warning" size={36} motionEnabled={motionEnabled}/><p className={styles.error}>{message}</p></div>}
    </section>;
  }

  return <section className={styles.root} aria-label="Required verification documents">
    <div><label className={styles.label}>Identity document</label><SelectBox value={documentType} onChange={value => {
      setDocumentSelection(previous => previous + 1);
      if (value !== documentType) { setUploadErrors({}); onDocumentTypeChange(value); }
    }} labeledOptions={documentOptions} placeholder="Choose an identity document" dir="ltr" disabled={locked || iranResident} className={flow.control}/>{error("docType")}</div>
    <aside className={styles.guidance} aria-label="Identity verification guidance">
      <DashboardLottieScene name="announcement" size={44} motionEnabled={motionEnabled}/>
      <div>
        <p className={styles.note}>Before providing your information, read our <a href={`/${locale}/legal/privacy-policy`} target="_blank" rel="noopener noreferrer" className={styles.link}>Privacy Policy</a> and <a href={`/${locale}/legal/dvs-notice`} target="_blank" rel="noopener noreferrer" className={styles.link}>Verification Notice</a>.</p>
        <p className={styles.note}>{doc?.textOnly ? "Enter the details shown on your identity document. Do not upload a photo or scan of your Australian passport, driver's licence or Medicare card." : "Alternative verification documents are reviewed by our team. Provide clear, readable copies. Do not upload Australian tax file numbers (TFNs). For documents not in English, contact support about an accredited English translation."}</p>
        {iranResident && <p className={styles.note}>Residents of Iran must provide a current Iranian passport. Enter its number and expiry date, and upload a clear copy of the page showing your photo and personal details.</p>}
      </div>
    </aside>
    {doc && <>
      {children}
      {doc.profileType === "none" && <div className={styles.fields}>
        <div><label htmlFor="kyc-document-number" className={styles.label}>{iranResident ? "Iranian passport number" : documentType === "medicare" ? "Medicare card number" : "Document / registration number"}</label><input id="kyc-document-number" className={dashboardInputClass} value={evidence.documentNumber} maxLength={documentType === "medicare" ? 10 : 200} inputMode={documentType === "medicare" ? "numeric" : undefined} disabled={locked} onChange={event => onChange({...evidence, documentNumber:event.target.value})} aria-invalid={!!errors.documentNumber}/>{error("documentNumber")}</div>
        {!doc.textOnly && <div><label htmlFor="kyc-document-issuer" className={styles.label}>{iranResident ? "Issuing country" : "Issuing country and authority"}</label><input id="kyc-document-issuer" className={dashboardInputClass} value={evidence.documentIssuer} maxLength={200} readOnly={iranResident} disabled={locked} onChange={event => onChange({...evidence, documentIssuer:event.target.value})} aria-invalid={!!errors.documentIssuer}/>{error("documentIssuer")}</div>}
      </div>}
      {documentType === "medicare" && <div className={styles.fields}>
        <div><label htmlFor="kyc-medicare-irn" className={styles.label}>Individual reference number (beside your name)</label><input id="kyc-medicare-irn" className={dashboardInputClass} value={evidence.medicareIRN || ""} maxLength={1} inputMode="numeric" disabled={locked} onChange={event => onChange({...evidence,medicareIRN:event.target.value})} aria-invalid={!!errors.medicareIRN}/>{error("medicareIRN")}</div>
        <div><label className={styles.label}>Medicare card colour</label><SelectBox value={evidence.medicareColour || ""} labeledOptions={[{value:"green",label:"Green"},{value:"blue",label:"Blue"},{value:"yellow",label:"Yellow"}]} placeholder="Choose card colour" dir="ltr" disabled={locked} className={flow.control} onChange={value => onChange({...evidence,medicareColour:value,medicareExpiry:""})}/>{error("medicareColour")}</div>
        <div><label htmlFor="kyc-medicare-expiry" className={styles.label}>Valid to {evidence.medicareColour === "green" ? "(month and year)" : "(day, month and year)"}</label><input id="kyc-medicare-expiry" type={evidence.medicareColour === "green" ? "month" : "date"} className={dashboardInputClass} value={evidence.medicareExpiry || ""} disabled={locked || !evidence.medicareColour} onChange={event => onChange({...evidence,medicareExpiry:event.target.value})} aria-invalid={!!errors.medicareExpiry}/>{error("medicareExpiry")}</div>
      </div>}
      {error("identityUpload")}
      {doc.back && <p className={styles.instruction}>Both the front and back are required. Upload a separate file for each side.</p>}
      {!doc.textOnly && <div className={styles.files}>{requiredKycUploads(documentType).filter(role => role !== "address").map(role => fileSlot(role))}</div>}
      {doc.address && <section className={styles.address} aria-label="Proof of address">
        <h3>Additional proof of residential address</h3>
        <p className={styles.note}>This document type also requires separate proof of your current residential address. A PO box is not a residential address.</p>
        <div className={styles.fields}>
          <div><label className={styles.label}>Proof of address document</label><SelectBox value={evidence.addressType} onChange={value => {
            setAddressSelection(previous => previous + 1);
            if (value !== evidence.addressType) {
              setUploadErrors(previous => ({ ...previous, address: "" }));
              onChange({...evidence,addressType:value,address:undefined,addressDate:""});
            }
          }} labeledOptions={KYC_ADDRESS_DOCUMENTS.map(({value,label}) => ({value,label}))} placeholder="Choose proof of address" dir="ltr" disabled={locked} className={flow.control}/>{error("addressType")}</div>
          <div><label className={styles.label}>Document issue date</label><CustomDatePicker value={evidence.addressDate} onChange={value => onChange({...evidence,addressDate:value})} disabled={locked || !addressDoc} className={flow.control}/>{error("addressDate")}</div>
        </div>
        {addressDoc && <p className={styles.note}>Use a {addressDoc.label.toLowerCase()} issued within the last {addressDoc.maxAgeDays} days. The name and address must match your account details.</p>}
        {fileSlot("address")}
      </section>}
      <details className={styles.address}>
        <summary>Source of funds — supporting documents if requested</summary>
        {fileSlot("source_of_funds", false)}
      </details>
    </>}
    <p className={styles.note}>Cannot provide a listed document? <a className={styles.link} href="https://wa.me/61497851631?text=I%20need%20help%20with%20an%20alternative%20identity%20verification%20process." target="_blank" rel="noopener noreferrer">Contact Zarman support</a> for an alternative verification assessment. Do not select a different document type to bypass these requirements.</p>
  </section>;
}
