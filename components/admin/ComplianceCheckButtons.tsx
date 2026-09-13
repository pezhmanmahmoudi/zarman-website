"use client";

import React, { useState, useTransition } from "react";
import { ShieldCheck, Search, Download, AlertTriangle, Loader2, CheckCircle2, Flag, Save } from "lucide-react";
import styles from "@/styles/admin/ComplianceButtons.module.css";
import { recordCustomerComplianceCheck, saveCustomerComplianceReview } from "@/app/actions/admin.actions";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";
import CustomDatePicker from "@/components/ui/DatePicker/CustomDatePicker";
import { AUSTRAC_ID_TYPES, AUSTRAC_ID_TYPE_OTHER, type AustracIdType } from "@/lib/compliance/austrac-id-types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  userId: string;
  country: string | null;
  documentType: string | null;
  initialDvsStatus?: string | null;
  initialDvsMethod?: string | null;
  initialDvsCheckedAt?: string | null;
  initialDvsOutcome?: string | null;
  initialAmlStatus?: string | null;
  initialAmlMethod?: string | null;
  initialAmlCheckedAt?: string | null;
  initialAmlOutcome?: string | null;
  initialAmlFlag?: AmlFlag | null;
  initialCustomerFlagged?: boolean | null;
  initialCustomerFlagReason?: string | null;
  initialCustomerNote?: string | null;
  initialAltIdType?: string | null;
  initialAltIdTypeOther?: string | null;
  initialAltIdNumber?: string | null;
  initialAltIdIssuer?: string | null;
  initialAltAddressType?: string | null;
  initialAltAddressTypeOther?: string | null;
  initialAltAddressReference?: string | null;
  initialAltAddressIssuer?: string | null;
  initialAltAddressDate?: string | null;
  onSaved?: () => void;
}

type CheckType = "dvs" | "aml";
type CheckState = "idle" | "loading" | "success" | "error";
type AmlFlag = "none" | "clear" | "review_required" | "failed";
type DvsMethod = "vendor_rapidid" | "manual_document_review" | "manual_video_call" | "manual_in_person";
type AmlMethod = "vendor_namescan" | "manual_austrac_watchlist" | "manual_internal_review";

interface CheckStatus {
  dvs: CheckState;
  aml: CheckState;
  dvsError: string | null;
  amlError: string | null;
  amlFlag: AmlFlag;
}

interface PersistedCheckInfo {
  status: string;
  method: string | null;
  checkedAt: string | null;
  outcome: string | null;
}

interface TriggerResult {
  error?: string;
  amlFlag?: AmlFlag;
  outcome?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isAustralia(country: string | null): boolean {
  return ["australia", "au", "aus"].includes((country ?? "").trim().toLowerCase());
}

function isDvsCapable(documentType: string | null): boolean {
  return documentType === "driver_license" || documentType === "passport";
}

async function triggerComplianceCheck(type: CheckType, userId: string): Promise<TriggerResult> {
  const endpoint = type === "dvs"
    ? "/api/admin/compliance/dvs"
    : "/api/admin/compliance/aml";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });

  if (!res.ok) {
    let message = `Request failed (HTTP ${res.status})`;
    try {
      const json: unknown = await res.json();
      if (json && typeof json === "object" && "message" in json) {
        message = String((json as Record<string, unknown>).message);
      }
    } catch { /* keep default */ }
    return { error: message };
  }

  const amlFlagHeader = type === "aml" ? res.headers.get("x-aml-flag") : null;
  const outcomeHeader = type === "aml"
    ? res.headers.get("x-aml-outcome")
    : res.headers.get("x-dvs-outcome");
  const amlFlag: AmlFlag =
    amlFlagHeader === "clear" ||
    amlFlagHeader === "review_required" ||
    amlFlagHeader === "failed"
      ? amlFlagHeader
      : "none";

  // Trigger browser download from the blob response.
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const tag  = document.createElement("a");
  const ts   = Date.now();
  tag.href     = url;
  tag.download = type === "dvs"
    ? `dvs-report-${userId.slice(0, 8)}-${ts}.pdf`
    : `aml-report-${userId.slice(0, 8)}-${ts}.pdf`;

  document.body.appendChild(tag);
  tag.click();
  document.body.removeChild(tag);
  // Schedule revocation after the browser has had time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 5_000);

  return { amlFlag, outcome: outcomeHeader ?? null };
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function formatMethod(method: string | null): string {
  if (!method) return "-";
  const labels: Record<string, string> = {
    vendor_rapidid: "Vendor (RapidID)",
    manual_document_review: "Manual: extra documents",
    manual_video_call: "Manual: video call",
    manual_in_person: "Manual: in person",
    vendor_namescan: "Vendor (NameScan)",
    manual_austrac_watchlist: "Manual: AUSTRAC list review",
    manual_internal_review: "Manual: internal review",
  };
  return labels[method] ?? method;
}

// AUSTRAC's own "ID type" enumeration doubles as our identity/address document
// dropdowns, so recorded values map 1:1 onto the exported IFTI-DRA report.
const AUSTRAC_ID_TYPE_OPTIONS: { value: AustracIdType; label: string }[] =
  AUSTRAC_ID_TYPES.map((value) => ({ value, label: value }));

function formatAltIdType(type: string | null): string {
  return type || "-";
}

function formatAltAddressType(type: string | null): string {
  return type || "-";
}

// ── Component ─────────────────────────────────────────────────────────────────


export function ComplianceCheckButtons({
  userId,
  country,
  documentType,
  initialDvsStatus,
  initialDvsMethod,
  initialDvsCheckedAt,
  initialDvsOutcome,
  initialAmlStatus,
  initialAmlMethod,
  initialAmlCheckedAt,
  initialAmlOutcome,
  initialAmlFlag,
  initialCustomerFlagged,
  initialCustomerFlagReason,
  initialCustomerNote,
  initialAltIdType,
  initialAltIdTypeOther,
  initialAltIdNumber,
  initialAltIdIssuer,
  initialAltAddressType,
  initialAltAddressTypeOther,
  initialAltAddressReference,
  initialAltAddressIssuer,
  initialAltAddressDate,
  onSaved,
}: Props) {
  const [state, setState] = useState<CheckStatus>({
    dvs: "idle", aml: "idle",
    dvsError: null, amlError: null,
    amlFlag: initialAmlFlag ?? "none",
  });
  const dvsCapableInitial = isDvsCapable(documentType);
  const [dvsMethod, setDvsMethod] = useState<DvsMethod>(
    (initialDvsMethod as DvsMethod) ?? (dvsCapableInitial ? "vendor_rapidid" : "manual_document_review")
  );
  const [amlMethod, setAmlMethod] = useState<AmlMethod>((initialAmlMethod as AmlMethod) ?? "vendor_namescan");
  const [dvsInfo, setDvsInfo] = useState<PersistedCheckInfo>({
    status: initialDvsStatus ?? "not_started",
    method: initialDvsMethod ?? null,
    checkedAt: initialDvsCheckedAt ?? null,
    outcome: initialDvsOutcome ?? null,
  });
  const [amlInfo, setAmlInfo] = useState<PersistedCheckInfo>({
    status: initialAmlStatus ?? "not_started",
    method: initialAmlMethod ?? null,
    checkedAt: initialAmlCheckedAt ?? null,
    outcome: initialAmlOutcome ?? null,
  });
  const [flagged, setFlagged] = useState(Boolean(initialCustomerFlagged));
  const [flagReason, setFlagReason] = useState(initialCustomerFlagReason ?? "");
  const [note, setNote] = useState(initialCustomerNote ?? "");
  const [reviewStatus, setReviewStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isReviewPending, startReviewTransition] = useTransition();

  // Alternative identity/address documents — for AU customers with no AU driver
  // licence or passport on file (e.g. Iranian passport + a bank statement).
  // Document types use AUSTRAC's own "ID type" list so they map 1:1 onto the report.
  const [altIdType, setAltIdType] = useState<AustracIdType | "">((initialAltIdType as AustracIdType) ?? "");
  const [altIdTypeOther, setAltIdTypeOther] = useState(initialAltIdTypeOther ?? "");
  const [altIdNumber, setAltIdNumber] = useState(initialAltIdNumber ?? "");
  const [altIdIssuer, setAltIdIssuer] = useState(initialAltIdIssuer ?? "");
  const [altAddressType, setAltAddressType] = useState<AustracIdType | "">((initialAltAddressType as AustracIdType) ?? "");
  const [altAddressTypeOther, setAltAddressTypeOther] = useState(initialAltAddressTypeOther ?? "");
  const [altAddressReference, setAltAddressReference] = useState(initialAltAddressReference ?? "");
  const [altAddressIssuer, setAltAddressIssuer] = useState(initialAltAddressIssuer ?? "");
  const [altAddressDate, setAltAddressDate] = useState(initialAltAddressDate ?? "");
  const [altDocsError, setAltDocsError] = useState<string | null>(null);

  const auCustomer  = isAustralia(country);
  const dvsCapable  = isDvsCapable(documentType);
  // AU customers without a supported AU document still need DVS recorded —
  // via the alternative identity/address documents form below.
  const showDvs      = auCustomer;
  const needsAltDocs = showDvs && !dvsCapable && dvsMethod === "manual_document_review";

  const markManualCheck = async (type: CheckType): Promise<boolean> => {
    const method = type === "dvs" ? dvsMethod : amlMethod;
    const outcome = type === "dvs" ? "MANUAL_COMPLETED" : "CLEAR";
    const result = await recordCustomerComplianceCheck({
      userId,
      checkType: type,
      method,
      outcome,
      amlFlag: type === "aml" ? "clear" : undefined,
    });

    if ("error" in result && result.error) {
      setState((prev) => ({
        ...prev,
        [type]: "error",
        [`${type}Error`]: result.error ?? "Unknown error.",
      }));
      return false;
    }

    const now = new Date().toISOString();
    if (type === "dvs") {
      setDvsInfo({ status: "completed", method, checkedAt: now, outcome });
    } else {
      setAmlInfo({ status: "completed", method, checkedAt: now, outcome });
      setState((prev) => ({ ...prev, amlFlag: "clear" }));
    }
    // Don't refresh here — the parent remount would wipe any other in-progress
    // selections/notes. A single refresh happens when Save Flag/Note is clicked.
    return true;
  };

  // Records DVS completion for AU customers with no AU driver licence/passport,
  // using an identity document (photo ID / proof of age / foreign passport) and
  // a residential proof (utility bill / bank statement). Also downloads the
  // compliance report PDF, since manual methods otherwise produce no report.
  const runAltDocumentDvs = async (): Promise<boolean> => {
    const idType = altIdType.trim();
    const idNumber = altIdNumber.trim();
    const addressType = altAddressType.trim();
    const addressReference = altAddressReference.trim();

    if (!idType || !idNumber || !addressType || !addressReference) {
      setAltDocsError("Identity document type/number and proof-of-address type/reference are required.");
      setState((prev) => ({ ...prev, dvs: "error", dvsError: null }));
      return false;
    }
    if (idType === AUSTRAC_ID_TYPE_OTHER && !altIdTypeOther.trim()) {
      setAltDocsError("Describe the identity document type since 'Other (provide description)' was selected.");
      setState((prev) => ({ ...prev, dvs: "error", dvsError: null }));
      return false;
    }
    if (addressType === AUSTRAC_ID_TYPE_OTHER && !altAddressTypeOther.trim()) {
      setAltDocsError("Describe the proof-of-address document type since 'Other (provide description)' was selected.");
      setState((prev) => ({ ...prev, dvs: "error", dvsError: null }));
      return false;
    }
    setAltDocsError(null);

    const res = await fetch("/api/admin/compliance/dvs-manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        altIdType: idType,
        altIdTypeOther: idType === AUSTRAC_ID_TYPE_OTHER ? altIdTypeOther.trim() : undefined,
        altIdNumber: idNumber,
        altIdIssuer: altIdIssuer.trim() || undefined,
        altAddressType: addressType,
        altAddressTypeOther: addressType === AUSTRAC_ID_TYPE_OTHER ? altAddressTypeOther.trim() : undefined,
        altAddressReference: addressReference,
        altAddressIssuer: altAddressIssuer.trim() || undefined,
        altAddressDate: altAddressDate || undefined,
      }),
    });

    if (!res.ok) {
      let message = `Request failed (HTTP ${res.status})`;
      try {
        const json: unknown = await res.json();
        if (json && typeof json === "object" && "message" in json) {
          message = String((json as Record<string, unknown>).message);
        }
      } catch { /* keep default */ }
      setState((prev) => ({ ...prev, dvs: "error", dvsError: message }));
      return false;
    }

    // Trigger browser download from the blob response.
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const tag  = document.createElement("a");
    const ts   = Date.now();
    tag.href     = url;
    tag.download = `dvs-report-manual-${userId.slice(0, 8)}-${ts}.pdf`;
    document.body.appendChild(tag);
    tag.click();
    document.body.removeChild(tag);
    setTimeout(() => URL.revokeObjectURL(url), 5_000);

    setDvsInfo({
      status: "completed",
      method: "manual_document_review",
      checkedAt: new Date().toISOString(),
      outcome: "MANUAL_COMPLETED",
    });
    return true;
  };

  const run = async (type: CheckType) => {
    setState((prev) => ({
      ...prev,
      [type]: "loading",
      [`${type}Error`]: null,
      ...(type === "aml" ? { amlFlag: "none" as AmlFlag } : {}),
    }));

    const selectedMethod = type === "dvs" ? dvsMethod : amlMethod;

    if (type === "dvs" && needsAltDocs) {
      const ok = await runAltDocumentDvs();
      setState((prev) => ({ ...prev, dvs: ok ? "success" : "error" }));
      return;
    }

    const isManual = selectedMethod.startsWith("manual_");
    if (isManual) {
      const ok = await markManualCheck(type);
      if (ok) {
        setState((prev) => ({ ...prev, [type]: "success", [`${type}Error`]: null }));
      }
      return;
    }

    const result = await triggerComplianceCheck(type, userId);

    if (result.error) {
      setState((prev) => ({
        ...prev,
        [type]: "error",
        [`${type}Error`]: result.error ?? "Unknown error.",
      }));
    } else {
      setState((prev) => ({
        ...prev,
        [type]: "success",
        [`${type}Error`]: null,
        ...(type === "aml" ? { amlFlag: result.amlFlag ?? "none" } : {}),
      }));

      const now = new Date().toISOString();
      if (type === "dvs") {
        setDvsInfo({
          status: "completed",
          method: "vendor_rapidid",
          checkedAt: now,
          outcome: result.outcome ?? "COMPLETED",
        });
      } else {
        setAmlInfo({
          status: "completed",
          method: "vendor_namescan",
          checkedAt: now,
          outcome: result.outcome ?? "COMPLETED",
        });
      }
      // Don't refresh here — see markManualCheck for rationale.
    }
  };

  const saveReview = () => {
    setReviewStatus(null);
    startReviewTransition(async () => {
      const result = await saveCustomerComplianceReview({
        userId,
        flagged,
        flagReason,
        note,
      });

      if ("error" in result && result.error) {
        setReviewStatus({ type: "error", text: result.error });
        return;
      }

      setReviewStatus({ type: "success", text: "Customer flag and note saved." });
      onSaved?.();
    });
  };

  const dvsState = state.dvs;
  const amlState = state.aml;
  const dvsCompleted = dvsInfo.status === "completed";
  const amlCompleted = amlInfo.status === "completed";
  const dvsManualSelected = dvsMethod.startsWith("manual_");
  const amlManualSelected = amlMethod.startsWith("manual_");

  return (
    <div className={styles.root}>
      <div className={styles.heading}>
        <ShieldCheck size={13} />
        Compliance Checks
      </div>

      <div className={styles.summaryGrid}>
        {showDvs && (
          <div className={styles.summaryCard}>
            <div className={styles.summaryTitle}>DVS</div>
            <div className={styles.summaryLine}><strong>Status:</strong> {dvsInfo.status}</div>
            <div className={styles.summaryLine}><strong>Method:</strong> {formatMethod(dvsInfo.method)}</div>
            <div className={styles.summaryLine}><strong>Checked:</strong> {formatDateTime(dvsInfo.checkedAt)}</div>
            {dvsInfo.method === "manual_document_review" && altIdType && (
              <>
                <div className={styles.summaryLine}><strong>Identity Doc:</strong> {formatAltIdType(altIdType)} {altIdNumber && `— ${altIdNumber}`}</div>
                <div className={styles.summaryLine}><strong>Address Doc:</strong> {formatAltAddressType(altAddressType)} {altAddressReference && `— ${altAddressReference}`}</div>
              </>
            )}
          </div>
        )}
        <div className={styles.summaryCard}>
          <div className={styles.summaryTitle}>AML / CTF</div>
          <div className={styles.summaryLine}><strong>Status:</strong> {amlInfo.status}</div>
          <div className={styles.summaryLine}><strong>Method:</strong> {formatMethod(amlInfo.method)}</div>
          <div className={styles.summaryLine}><strong>Checked:</strong> {formatDateTime(amlInfo.checkedAt)}</div>
        </div>
      </div>

      <div className={styles.btnRow}>
        {/* DVS button (AU customers — vendor check when a supported AU document is on
            file, otherwise manual verification via alternative documents) */}
        {showDvs && (
          <div className={styles.checkGroup}>
            <label className={styles.inlineLabel}>DVS method</label>
            <SelectBox
              className={styles.methodSelect}
              labeledOptions={
                dvsCapable
                  ? [
                      { value: "vendor_rapidid", label: "Vendor (RapidID)" },
                      { value: "manual_document_review", label: "Manual: extra documents" },
                      { value: "manual_video_call", label: "Manual: video call verification" },
                      { value: "manual_in_person", label: "Manual: in person verification" },
                    ]
                  : [
                      { value: "manual_document_review", label: "Manual: alternative documents (no AU licence/passport)" },
                      { value: "manual_video_call", label: "Manual: video call verification" },
                      { value: "manual_in_person", label: "Manual: in person verification" },
                    ]
              }
              value={dvsMethod}
              onChange={(val) => setDvsMethod(val as DvsMethod)}
              disabled={dvsState === "loading"}
              dir="ltr"
            />

            {needsAltDocs && !dvsCompleted && (
              <div className={styles.altDocsBlock}>
                <div className={styles.altDocsHeader}>Identity Document — ID type (1)</div>
                <SelectBox
                  className={styles.methodSelect}
                  labeledOptions={[{ value: "", label: "— Select ID type —" }, ...AUSTRAC_ID_TYPE_OPTIONS]}
                  value={altIdType}
                  onChange={(val) => setAltIdType(val as AustracIdType)}
                  disabled={dvsState === "loading"}
                  dir="ltr"
                />
                {altIdType === AUSTRAC_ID_TYPE_OTHER && (
                  <input
                    className={styles.textInput}
                    placeholder="ID type description (required for 'Other')"
                    value={altIdTypeOther}
                    onChange={(e) => setAltIdTypeOther(e.target.value)}
                    disabled={dvsState === "loading"}
                  />
                )}
                <input
                  className={styles.textInput}
                  placeholder="Document number"
                  value={altIdNumber}
                  onChange={(e) => setAltIdNumber(e.target.value)}
                  disabled={dvsState === "loading"}
                />
                <input
                  className={styles.textInput}
                  placeholder="Issuer / country (optional, e.g. Iran)"
                  value={altIdIssuer}
                  onChange={(e) => setAltIdIssuer(e.target.value)}
                  disabled={dvsState === "loading"}
                />

                <div className={styles.altDocsHeader}>Proof of Residential Address — ID type (2)</div>
                <SelectBox
                  className={styles.methodSelect}
                  labeledOptions={[{ value: "", label: "— Select ID type —" }, ...AUSTRAC_ID_TYPE_OPTIONS]}
                  value={altAddressType}
                  onChange={(val) => setAltAddressType(val as AustracIdType)}
                  disabled={dvsState === "loading"}
                  dir="ltr"
                />
                {altAddressType === AUSTRAC_ID_TYPE_OTHER && (
                  <input
                    className={styles.textInput}
                    placeholder="ID type description (required for 'Other', e.g. Utility bill)"
                    value={altAddressTypeOther}
                    onChange={(e) => setAltAddressTypeOther(e.target.value)}
                    disabled={dvsState === "loading"}
                  />
                )}
                <input
                  className={styles.textInput}
                  placeholder="Account / reference number"
                  value={altAddressReference}
                  onChange={(e) => setAltAddressReference(e.target.value)}
                  disabled={dvsState === "loading"}
                />
                <input
                  className={styles.textInput}
                  placeholder="Issuer (optional, e.g. AGL, Commonwealth Bank)"
                  value={altAddressIssuer}
                  onChange={(e) => setAltAddressIssuer(e.target.value)}
                  disabled={dvsState === "loading"}
                />
                <CustomDatePicker
                  value={altAddressDate}
                  onChange={setAltAddressDate}
                  placeholder="Document date (optional)"
                />

                {altDocsError && (
                  <span className={styles.errorMsg}>
                    <AlertTriangle size={11} />
                    {altDocsError}
                  </span>
                )}
              </div>
            )}

            <button
              type="button"
              className={`${styles.btn} ${(dvsCompleted || dvsState === "success") ? styles.btnSuccess : styles.btnPrimary}`}
              onClick={() => run("dvs")}
              disabled={dvsState === "loading" || (dvsManualSelected && dvsCompleted)}
              title="Run Document Verification Service check via RapidID"
            >
              {dvsState === "loading" ? (
                <Loader2 size={13} className={styles.spinner} />
              ) : dvsState === "success" ? (
                <Download size={13} />
              ) : (
                <ShieldCheck size={13} />
              )}
              {dvsState === "loading"
                ? "Running DVS..."
                : dvsManualSelected
                  ? (dvsCompleted ? "DVS Completed" : "Mark DVS Completed")
                  : "Run DVS"}
            </button>

            {dvsState === "error" && state.dvsError && (
              <span className={styles.errorMsg}>
                <AlertTriangle size={11} />
                {state.dvsError}
              </span>
            )}

            {(dvsState === "success" || dvsInfo.status === "completed") && (
              <span className={styles.statusOk}>
                <CheckCircle2 size={11} />
                DVS check completed
              </span>
            )}
          </div>
        )}

        {/* AML button (all customers) */}
        <div className={styles.checkGroup}>
          <label className={styles.inlineLabel}>AML method</label>
          <SelectBox
            className={styles.methodSelect}
            labeledOptions={[
              { value: "vendor_namescan", label: "Vendor (NameScan)" },
              { value: "manual_austrac_watchlist", label: "Manual: AUSTRAC list review" },
              { value: "manual_internal_review", label: "Manual: internal compliance review" },
            ]}
            value={amlMethod}
            onChange={(val) => setAmlMethod(val as AmlMethod)}
            disabled={amlState === "loading"}
            dir="ltr"
          />

          <button
            type="button"
              className={`${styles.btn} ${(amlCompleted || amlState === "success") ? styles.btnSuccess : styles.btnSecondary}`}
            onClick={() => run("aml")}
              disabled={amlState === "loading" || (amlManualSelected && amlCompleted)}
            title="Run PEP & sanctions screening via NameScan"
          >
            {amlState === "loading" ? (
              <Loader2 size={13} className={styles.spinner} />
            ) : amlState === "success" ? (
              <Download size={13} />
            ) : (
              <Search size={13} />
            )}
            {amlState === "loading"
              ? "Screening..."
              : amlManualSelected
                ? (amlCompleted ? "AML Completed" : "Mark AML Completed")
                : "Run AML Screening"}
          </button>

          {amlState === "error" && state.amlError && (
            <span className={styles.errorMsg}>
              <AlertTriangle size={11} />
              {state.amlError}
            </span>
          )}

          {(amlState === "success" || amlInfo.status === "completed") && state.amlFlag === "clear" && (
            <span className={styles.statusOk}>
              <CheckCircle2 size={11} />
              AML completed: no sanctions/PEP hit
            </span>
          )}

          {(amlState === "success" || amlInfo.status === "completed") && state.amlFlag === "review_required" && (
            <span className={styles.statusWarn}>
              <Flag size={11} />
              AML completed: potential sanctions/PEP match, review required
            </span>
          )}

          {(amlState === "success" || amlInfo.status === "completed") && state.amlFlag === "failed" && (
            <span className={styles.statusWarn}>
              <AlertTriangle size={11} />
              AML completed with vendor failure, review report details
            </span>
          )}

          {(amlState === "success" || amlInfo.status === "completed") && state.amlFlag === "none" && (
            <span className={styles.statusOk}>
              <CheckCircle2 size={11} />
              AML check completed
            </span>
          )}
        </div>
      </div>

      {/* Country context note */}
      {!auCustomer && (
        <p className={styles.note}>
          DVS not available — customer is outside Australia. AML screening applies to all jurisdictions.
        </p>
      )}
      {auCustomer && !dvsCapable && (
        <p className={styles.note}>
          No Australian driver licence or passport on file — select &quot;Manual: alternative documents&quot; above and
          record an identity document (photo ID, proof of age, foreign passport, etc.) plus a proof of residential
          address (utility bill, bank statement, etc.) to complete DVS.
        </p>
      )}

      <div className={styles.reviewBlock}>
        <div className={styles.reviewHeader}>Customer Flag and Internal Note</div>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={flagged}
            onChange={(e) => setFlagged(e.target.checked)}
          />
          Flag this customer for compliance follow-up
        </label>

        {flagged && (
          <input
            className={styles.textInput}
            placeholder="Flag reason (e.g. refused extra documents)"
            value={flagReason}
            onChange={(e) => setFlagReason(e.target.value)}
          />
        )}

        <textarea
          className={styles.noteInput}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Internal note for this customer"
          rows={4}
        />

        <button type="button" className={styles.saveBtn} onClick={saveReview} disabled={isReviewPending}>
          <Save size={13} />
          {isReviewPending ? "Saving..." : "Save Flag/Note"}
        </button>
        <p className={styles.note}>
          DVS and AML checks above save as soon as you run them. This button saves the flag/note and refreshes the page — run any checks first, then click this once at the end.
        </p>

        {reviewStatus && (
          <div className={reviewStatus.type === "success" ? styles.statusOk : styles.errorMsg}>
            {reviewStatus.text}
          </div>
        )}
      </div>
    </div>
  );
}
