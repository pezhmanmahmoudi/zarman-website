"use client";

// components/admin/ComplianceCheckButtons.tsx
// Manual AML/CTF compliance trigger buttons for the admin KYC panel.
//
// Workflow:
//   1. Admin clicks a button.
//   2. Client POSTs to the respective Route Handler.
//   3. Handler calls vendor API, generates PDF in-memory, streams it back.
//   4. Client receives the blob and triggers a native browser download.
//   5. Nothing is stored in Supabase Storage or the database.
//
// Visibility rules:
//   AU customers  → "Run DVS" (if driver_licence or passport) + "Run AML Screening"
//   Non-AU        → "Run AML Screening" only

import React, { useState } from "react";
import { ShieldCheck, Search, Download, AlertTriangle, Loader2, CheckCircle2, Flag } from "lucide-react";
import formStyles from "@/styles/admin/AdminForms.module.css";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import styles from "@/styles/admin/ComplianceButtons.module.css";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  userId: string;
  country: string | null;
  documentType: string | null;
}

type CheckType = "dvs" | "aml";
type CheckState = "idle" | "loading" | "success" | "error";
type AmlFlag = "none" | "clear" | "review_required" | "failed";

interface CheckStatus {
  dvs: CheckState;
  aml: CheckState;
  dvsError: string | null;
  amlError: string | null;
  amlFlag: AmlFlag;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isAustralia(country: string | null): boolean {
  return ["australia", "au", "aus"].includes((country ?? "").trim().toLowerCase());
}

function isDvsCapable(documentType: string | null): boolean {
  return documentType === "driver_license" || documentType === "passport";
}

async function triggerComplianceCheck(type: CheckType, userId: string): Promise<{ error?: string; amlFlag?: AmlFlag }> {
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

  return { amlFlag };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ComplianceCheckButtons({ userId, country, documentType }: Props) {
  const [state, setState] = useState<CheckStatus>({
    dvs: "idle", aml: "idle",
    dvsError: null, amlError: null,
    amlFlag: "none",
  });

  const auCustomer  = isAustralia(country);
  const dvsCapable  = isDvsCapable(documentType);
  const showDvs     = auCustomer && dvsCapable;

  const run = async (type: CheckType) => {
    setState((prev) => ({
      ...prev,
      [type]: "loading",
      [`${type}Error`]: null,
      ...(type === "aml" ? { amlFlag: "none" as AmlFlag } : {}),
    }));

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
    }
  };

  const dvsState = state.dvs;
  const amlState = state.aml;

  return (
    <div className={styles.root}>
      <div className={styles.heading}>
        <ShieldCheck size={13} />
        Compliance Checks
      </div>

      <div className={styles.btnRow}>
        {/* ── DVS button (AU + driver_licence or passport only) ── */}
        {showDvs && (
          <div className={styles.checkGroup}>
            <button
              type="button"
              className={`${styles.btn} ${dvsState === "success" ? styles.btnSuccess : styles.btnPrimary}`}
              onClick={() => run("dvs")}
              disabled={dvsState === "loading"}
              title="Run Document Verification Service check via RapidID"
            >
              {dvsState === "loading" ? (
                <Loader2 size={13} className={styles.spinner} />
              ) : dvsState === "success" ? (
                <Download size={13} />
              ) : (
                <ShieldCheck size={13} />
              )}
              {dvsState === "loading" ? "Running DVS…" : dvsState === "success" ? "Report Downloaded" : "Run DVS"}
            </button>

            {dvsState === "error" && state.dvsError && (
              <span className={styles.errorMsg}>
                <AlertTriangle size={11} />
                {state.dvsError}
              </span>
            )}

            {dvsState === "success" && (
              <span className={styles.statusOk}>
                <CheckCircle2 size={11} />
                DVS check completed
              </span>
            )}
          </div>
        )}

        {/* ── AML button (all customers) ── */}
        <div className={styles.checkGroup}>
          <button
            type="button"
            className={`${styles.btn} ${amlState === "success" ? styles.btnSuccess : styles.btnSecondary}`}
            onClick={() => run("aml")}
            disabled={amlState === "loading"}
            title="Run PEP & sanctions screening via NameScan"
          >
            {amlState === "loading" ? (
              <Loader2 size={13} className={styles.spinner} />
            ) : amlState === "success" ? (
              <Download size={13} />
            ) : (
              <Search size={13} />
            )}
            {amlState === "loading" ? "Screening…" : amlState === "success" ? "Report Downloaded" : "Run AML Screening"}
          </button>

          {amlState === "error" && state.amlError && (
            <span className={styles.errorMsg}>
              <AlertTriangle size={11} />
              {state.amlError}
            </span>
          )}

          {amlState === "success" && state.amlFlag === "clear" && (
            <span className={styles.statusOk}>
              <CheckCircle2 size={11} />
              AML completed: no sanctions/PEP hit
            </span>
          )}

          {amlState === "success" && state.amlFlag === "review_required" && (
            <span className={styles.statusWarn}>
              <Flag size={11} />
              AML completed: potential sanctions/PEP match, review required
            </span>
          )}

          {amlState === "success" && state.amlFlag === "failed" && (
            <span className={styles.statusWarn}>
              <AlertTriangle size={11} />
              AML completed with vendor failure, review report details
            </span>
          )}

          {amlState === "success" && state.amlFlag === "none" && (
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
    </div>
  );
}
