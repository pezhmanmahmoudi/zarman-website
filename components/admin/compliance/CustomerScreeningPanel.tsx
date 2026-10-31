"use client";

// The customer's compliance result in the same compact grid as the transaction drawer:
//   Identity (DVS) · Sanctions (internal DFAT, NameScan) · PEP (search, declaration, vendor).
// Stored results are shown as they are; "Re-run" is an explicit click. Recording a missing PEP
// answer and the paid NameScan lookup appear only when needed.

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Download, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { recordPepDeclaration, runCustomerInternalScreening } from "@/app/actions/compliance.actions";
import { fetchCustomerCompliance } from "@/lib/compliance/client";
import { MatchReview } from "@/components/admin/compliance/MatchReview";
import { Chip, isMatch, isPending } from "@/components/admin/compliance/ScreeningChip";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";
import type { CustomerComplianceView, ScreeningRecord } from "@/lib/compliance/types";
import styles from "@/styles/admin/ComplianceTable.module.css";

type Dvs = { applicable: boolean; status: string; method: string; outcome: string | null; checkedAt: string | null };

const RELATION_OPTIONS = [
  { value: "self", label: "The customer" },
  { value: "family", label: "Close family member" },
  { value: "close_associate", label: "Close associate" },
];

export function CustomerScreeningPanel({ userId, dvs, onChanged }: { userId: string; dvs: Dvs; onChanged?: () => void }) {
  const [view, setView] = useState<CustomerComplianceView | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [declaring, setDeclaring] = useState(false);
  const [decl, setDecl] = useState<{ isPep: boolean; relation: "self" | "family" | "close_associate"; details: string }>({ isPep: false, relation: "self", details: "" });

  useEffect(() => {
    const controller = new AbortController();
    fetchCustomerCompliance(userId, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      if (result.error) setError(result.error); else if (result.data) setView(result.data);
    }).catch(() => { if (!controller.signal.aborted) setError("The screening status could not be loaded."); });
    return () => controller.abort();
  }, [userId]);

  const toggle = (id: string) => setOpen(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  async function rerun() {
    setBusy("internal"); setError("");
    const result = await runCustomerInternalScreening(userId);
    setBusy("");
    if (result.error) setError(result.error); else if (result.data) { setView(result.data); onChanged?.(); }
  }

  /** NameScan runs through the existing admin route, which returns the evidence PDF. */
  async function runVendor() {
    if (!window.confirm("Run a paid NameScan lookup? The evidence PDF will download.")) return;
    setBusy("vendor"); setError("");
    try {
      const res = await fetch("/api/admin/compliance/aml", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(json?.message ?? `Request failed (HTTP ${res.status})`);
      } else {
        const url = URL.createObjectURL(await res.blob());
        const link = document.createElement("a");
        link.href = url; link.download = `aml-report-${userId.slice(0, 8)}-${Date.now()}.pdf`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 5_000);
        const next = await fetchCustomerCompliance(userId);
        if (next.data) setView(next.data);
        onChanged?.();
      }
    } catch { setError("The vendor check did not complete."); }
    setBusy("");
  }

  async function saveDeclaration() {
    setBusy("declare"); setError("");
    const saved = await recordPepDeclaration({ userId, isPep: decl.isPep, relation: decl.isPep ? decl.relation : null, details: decl.details });
    if (saved.error) { setError(saved.error); setBusy(""); return; }
    setDeclaring(false);
    const result = await runCustomerInternalScreening(userId);
    setBusy("");
    if (result.error) setError(result.error); else if (result.data) setView(result.data);
  }

  if (!view) {
    return <div className={styles.headRow}><h3 className={styles.title}><ShieldCheck size={15} />Compliance</h3>
      {error ? <span className={styles.errorMsg}><AlertTriangle size={13} />{error}</span> : <span className={styles.meta}><Loader2 size={12} className={styles.spinner} /> Loading…</span>}</div>;
  }

  const pepSignal = view.pepInternal?.outcome === "potential_match" || view.selfDeclaration.isPep === true;
  const vendorDone = !!view.vendor && view.vendor.outcome !== "failed";
  const needsVendor = pepSignal && !vendorDone;
  const notRun = !view.sanctionsInternal && !view.pepInternal;
  const reviews = [view.sanctionsInternal, view.pepInternal, view.selfDeclarationRecord, view.vendor]
    .filter((record): record is ScreeningRecord => isMatch(record) && (isPending(record) || open.has(record!.id)));
  const cleared = !!view.sanctionsInternal && !!view.pepInternal && reviews.every(record => !isPending(record)) && !needsVendor && view.selfDeclaration.answered
    && view.sanctionsInternal.outcome !== "failed" && view.pepInternal.outcome !== "failed";

  return (
    <div className={styles.detailStack}>
      <div className={styles.headRow}>
        <h3 className={styles.title}><ShieldCheck size={15} />Compliance</h3>
        {!notRun && <span className={`${styles.statusPill} ${cleared ? styles.pillOk : styles.pillWarn}`}>{cleared ? <Check size={13} /> : <AlertTriangle size={13} />}{cleared ? "Cleared" : "Action needed"}</span>}
        <span className={styles.spacer} />
        <button type="button" className={`${styles.btn} ${styles.btnSmall}`} onClick={() => void rerun()} disabled={!!busy} title="Run the internal sanctions and PEP checks again">
          {busy === "internal" ? <Loader2 size={12} className={styles.spinner} /> : <RefreshCw size={12} />}{notRun ? "Run checks" : "Re-run"}
        </button>
      </div>

      {error && <span className={styles.errorMsg} role="alert"><AlertTriangle size={13} />{error}</span>}

      <div className={styles.grid} role="table" aria-label="Compliance results">
        <div className={styles.gridRow} role="row">
          <span className={styles.rowLabel}>Identity</span>
          <span className={styles.chips}>
            {dvs.applicable
              ? <span className={`${styles.chip} ${dvs.status === "completed" ? styles.chip_ok : dvs.status === "failed" ? styles.chip_bad : styles.chip_warn}`}>{dvs.status === "completed" ? <Check size={12} /> : <AlertTriangle size={12} />}{dvs.status === "completed" ? "Verified" : dvs.status === "failed" ? "Failed" : "Not verified"}</span>
              : <span className={`${styles.chip} ${styles.chip_dim}`}>N/A (outside Australia)</span>}
            {dvs.applicable && dvs.status === "completed" && dvs.method !== "-" && <span className={styles.meta}>{dvs.method}</span>}
          </span>
        </div>
        <div className={styles.gridRow} role="row">
          <span className={styles.rowLabel}>Sanctions</span>
          <span className={styles.chips}>
            <Chip record={view.sanctionsInternal} onOpen={toggle} label="DFAT" />
            {view.vendor && <Chip record={view.vendor} onOpen={toggle} label="NameScan" />}
          </span>
        </div>
        <div className={styles.gridRow} role="row">
          <span className={styles.rowLabel}>PEP</span>
          <span className={styles.chips}>
            <Chip record={view.pepInternal} onOpen={toggle} label="Search" />
            <Chip record={view.selfDeclarationRecord} onOpen={toggle} label="Declared" missing="not asked" />
            {vendorDone ? <Chip record={view.vendor} onOpen={toggle} label="Vendor" /> : needsVendor
              ? <span className={`${styles.chip} ${styles.chip_bad}`}><AlertTriangle size={12} />Vendor required</span>
              : <span className={`${styles.chip} ${styles.chip_dim}`}>Vendor: n/a</span>}
          </span>
        </div>
      </div>

      {(!view.selfDeclaration.answered || needsVendor) && <div className={styles.actions}>
        {!view.selfDeclaration.answered && !declaring && <button type="button" className={`${styles.btn} ${styles.btnSmall}`} onClick={() => setDeclaring(true)}>Record PEP answer</button>}
        {needsVendor && <button type="button" className={`${styles.btn} ${styles.btnSmall} ${styles.btnPrimary}`} disabled={!!busy} onClick={() => void runVendor()}>
          {busy === "vendor" ? <Loader2 size={12} className={styles.spinner} /> : <Download size={12} />}Run NameScan</button>}
      </div>}

      {declaring && <div className={styles.inlineForm}>
        <div className={styles.decisionRow}>
          <label><input type="radio" checked={!decl.isPep} onChange={() => setDecl(current => ({ ...current, isPep: false }))} />No</label>
          <label><input type="radio" checked={decl.isPep} onChange={() => setDecl(current => ({ ...current, isPep: true }))} />Yes</label>
        </div>
        {decl.isPep && <>
          <SelectBox ariaLabel="Relationship" dir="ltr" value={decl.relation} onChange={value => setDecl(current => ({ ...current, relation: value as typeof decl.relation }))} labeledOptions={RELATION_OPTIONS} />
          <input className={styles.input} placeholder="Position held and country" value={decl.details} onChange={event => setDecl(current => ({ ...current, details: event.target.value }))} />
        </>}
        <div><button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={!!busy} onClick={() => void saveDeclaration()}>Save</button></div>
      </div>}

      {reviews.map(record => <MatchReview key={record.id} record={record} onDecided={() => void fetchCustomerCompliance(userId).then(next => { if (next.data) setView(next.data); })} />)}

      {!needsVendor && <details className={styles.options}>
        <summary>More</summary>
        <div className={styles.optionsBody}>
          <button type="button" className={`${styles.btn} ${styles.btnSmall}`} disabled={!!busy} onClick={() => void runVendor()}>{vendorDone ? "Re-run NameScan" : "Run NameScan"}</button>
        </div>
      </details>}
    </div>
  );
}
