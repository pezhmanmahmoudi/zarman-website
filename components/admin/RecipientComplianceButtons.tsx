"use client";

// components/admin/RecipientComplianceButtons.tsx
// Manual AML/PEP & sanctions screening button for Iranian recipient cards.
//
// All Zarman recipients are Iranian (AU → Iran remittance), so only
// NameScan AML screening applies — RapidID DVS is not applicable here.
// On click: POSTs to /api/admin/compliance/recipient-aml, receives a PDF
// blob, and triggers a native browser download. Nothing is stored.

import React, { useState } from "react";
import { Search, Download, AlertTriangle, Loader2, CheckCircle2, Flag } from "lucide-react";
import styles from "@/styles/admin/ComplianceButtons.module.css";

interface Props {
  recipientId: string;
}

type CheckState = "idle" | "loading" | "success" | "error";
type AmlFlag = "none" | "clear" | "review_required" | "failed";

export function RecipientComplianceButtons({ recipientId }: Props) {
  const [checkState, setCheckState] = useState<CheckState>("idle");
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);
  const [amlFlag, setAmlFlag]       = useState<AmlFlag>("none");

  const run = async () => {
    setCheckState("loading");
    setErrorMsg(null);
    setAmlFlag("none");

    const res = await fetch("/api/admin/compliance/recipient-aml", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId }),
    });

    if (!res.ok) {
      let message = `Request failed (HTTP ${res.status})`;
      try {
        const json: unknown = await res.json();
        if (json && typeof json === "object" && "message" in json) {
          message = String((json as Record<string, unknown>).message);
        }
      } catch { /* keep default */ }
      setCheckState("error");
      setErrorMsg(message);
      return;
    }

    const amlFlagHeader = res.headers.get("x-aml-flag");
    const nextAmlFlag: AmlFlag =
      amlFlagHeader === "clear" ||
      amlFlagHeader === "review_required" ||
      amlFlagHeader === "failed"
        ? amlFlagHeader
        : "none";

    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const tag  = document.createElement("a");
    tag.href     = url;
    tag.download = `recipient-aml-${recipientId.slice(0, 8)}-${Date.now()}.pdf`;
    document.body.appendChild(tag);
    tag.click();
    document.body.removeChild(tag);
    setTimeout(() => URL.revokeObjectURL(url), 5_000);

    setAmlFlag(nextAmlFlag);
    setCheckState("success");
  };

  return (
    <div className={styles.root}>
      <div className={styles.btnRow}>
        <div className={styles.checkGroup}>
          <button
            type="button"
            className={`${styles.btn} ${checkState === "success" ? styles.btnSuccess : styles.btnSecondary}`}
            onClick={run}
            disabled={checkState === "loading"}
            title="Run PEP & sanctions screening via NameScan"
          >
            {checkState === "loading" ? (
              <Loader2 size={12} className={styles.spinner} />
            ) : checkState === "success" ? (
              <Download size={12} />
            ) : (
              <Search size={12} />
            )}
            {checkState === "loading" ? "Screening…" : checkState === "success" ? "Report Downloaded" : "Run AML Screening"}
          </button>

          {checkState === "error" && errorMsg && (
            <span className={styles.errorMsg}>
              <AlertTriangle size={10} />
              {errorMsg}
            </span>
          )}

          {checkState === "success" && amlFlag === "clear" && (
            <span className={styles.statusOk}>
              <CheckCircle2 size={10} />
              AML completed: no sanctions/PEP hit
            </span>
          )}

          {checkState === "success" && amlFlag === "review_required" && (
            <span className={styles.statusWarn}>
              <Flag size={10} />
              AML completed: potential sanctions/PEP match, review required
            </span>
          )}

          {checkState === "success" && amlFlag === "failed" && (
            <span className={styles.statusWarn}>
              <AlertTriangle size={10} />
              AML completed with vendor failure, review report details
            </span>
          )}

          {checkState === "success" && amlFlag === "none" && (
            <span className={styles.statusOk}>
              <CheckCircle2 size={10} />
              AML check completed
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
