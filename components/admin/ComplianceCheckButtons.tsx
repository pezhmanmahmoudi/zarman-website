"use client";

import React, { useState, useTransition } from "react";
import { ShieldCheck, Search, Download, AlertTriangle, Loader2, CheckCircle2, Flag, Save } from "lucide-react";
import styles from "@/styles/admin/ComplianceButtons.module.css";
import { recordCustomerComplianceCheck, saveCustomerComplianceReview } from "@/app/actions/admin.actions";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";

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
  onSaved,
}: Props) {
  const [state, setState] = useState<CheckStatus>({
    dvs: "idle", aml: "idle",
    dvsError: null, amlError: null,
    amlFlag: initialAmlFlag ?? "none",
  });
  const [dvsMethod, setDvsMethod] = useState<DvsMethod>((initialDvsMethod as DvsMethod) ?? "vendor_rapidid");
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

  const auCustomer  = isAustralia(country);
  const dvsCapable  = isDvsCapable(documentType);
  const showDvs     = auCustomer && dvsCapable;

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
    onSaved?.();
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
      onSaved?.();
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
        {/* DVS button (AU + driver_license or passport only) */}
        {showDvs && (
          <div className={styles.checkGroup}>
            <label className={styles.inlineLabel}>DVS method</label>
            <SelectBox
              className={styles.methodSelect}
              labeledOptions={[
                { value: "vendor_rapidid", label: "Vendor (RapidID)" },
                { value: "manual_document_review", label: "Manual: extra documents" },
                { value: "manual_video_call", label: "Manual: video call verification" },
                { value: "manual_in_person", label: "Manual: in person verification" },
              ]}
              value={dvsMethod}
              onChange={(val) => setDvsMethod(val as DvsMethod)}
              disabled={dvsState === "loading"}
              dir="ltr"
            />

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
          DVS not available — no supported identity document (driver licence or passport) on file.
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

        {reviewStatus && (
          <div className={reviewStatus.type === "success" ? styles.statusOk : styles.errorMsg}>
            {reviewStatus.text}
          </div>
        )}
      </div>
    </div>
  );
}
