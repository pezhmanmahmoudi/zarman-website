"use client";

// Per-transaction compliance on the admin request page, split in two:
//   <ComplianceBadge>          one tick in the header (cleared / action needed)
//   <RequestComplianceDetails> the results grid, shown in a drawer at the bottom of the page
// Both read one shared state from useRequestCompliance. Results are remembered: opening the page
// only re-runs a check when the name changed or the screening list was replaced.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, ChevronDown, ExternalLink, Loader2, Search } from "lucide-react";
import {
  decideEcdd, recordPepDeclaration, runRequestVendorScreening,
  setRequestEscalation, setRequestFundingMethod, waiveVendorCheck,
} from "@/app/actions/compliance.actions";
import { fetchRequestCompliance } from "@/lib/compliance/client";
import { MatchReview } from "@/components/admin/compliance/MatchReview";
import { Chip, isMatch, isPending } from "@/components/admin/compliance/ScreeningChip";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";
import type { RequestComplianceView, ScreeningParty, ScreeningRecord } from "@/lib/compliance/types";
import styles from "@/styles/admin/ComplianceTable.module.css";

type ActionResult = { data?: RequestComplianceView; error?: string };

export type RequestComplianceState = {
  view: RequestComplianceView | null;
  error: string;
  apply: (result: ActionResult) => void;
  setError: (message: string) => void;
};

export function useRequestCompliance(requestId: string | undefined, version: number | undefined, enabled: boolean): RequestComplianceState {
  const [view, setView] = useState<RequestComplianceView | null>(null);
  const [error, setError] = useState("");
  const lastVersion = useRef<number | undefined>(undefined);
  const apply = useCallback((result: ActionResult) => {
    if (result.error) setError(result.error); else if (result.data) { setView(result.data); setError(""); }
  }, []);
  const load = useCallback((signal: AbortSignal) => {
    if (!requestId) return;
    fetchRequestCompliance(requestId, signal).then(result => { if (!signal.aborted) apply(result); }).catch(() => { if (!signal.aborted) setError("The compliance status could not be loaded."); });
  }, [requestId, apply]);
  // The id comes from the URL, so the first load runs alongside the request details, not after them.
  useEffect(() => {
    if (!enabled || !requestId) return;
    lastVersion.current = undefined;
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [enabled, requestId, load]);
  // Reload when an admin action moves the request to a new version; the first known version is not a change.
  useEffect(() => {
    if (!enabled || !requestId || version === undefined) return;
    const previous = lastVersion.current;
    lastVersion.current = version;
    if (previous === undefined || previous === version) return;
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [enabled, requestId, version, load]);
  return { view, error, apply, setError };
}

export const complianceNeedsAction = (state: RequestComplianceState) => !!state.error || (!!state.view && state.view.blockers.length > 0);

/** The single tick: green when cleared, amber when something needs doing. Opens the drawer. */
export function ComplianceBadge({ state, onOpen }: { state: RequestComplianceState; onOpen: () => void }) {
  const { view, error } = state;
  if (!view && !error) return <span className={`${styles.statusPill} ${styles.pillIdle}`}><Loader2 size={12} className={styles.spinner} />Compliance</span>;
  const cleared = !!view && view.blockers.length === 0 && !error;
  return (
    <button type="button" className={`${styles.statusPill} ${styles.pillButton} ${cleared ? styles.pillOk : styles.pillWarn}`} onClick={onOpen} title="Open compliance screening">
      {cleared ? <Check size={13} /> : <AlertTriangle size={13} />}
      {cleared ? "Compliance cleared" : "Compliance: action needed"}{view ? ` · ${view.category}` : ""}
    </button>
  );
}

const RELATION_OPTIONS = [
  { value: "self", label: "The customer" },
  { value: "family", label: "Close family member" },
  { value: "close_associate", label: "Close associate" },
];
const FUNDING_OPTIONS = [{ value: "bank", label: "Bank transfer" }, { value: "cash", label: "Cash (in person)" }];
const LEVEL_OPTIONS = [{ value: "", label: "None" }, { value: "B", label: "Category B" }, { value: "C", label: "Category C" }];

export function RequestComplianceDetails({ requestId, state }: { requestId: string; state: RequestComplianceState }) {
  const { view, error, apply, setError } = state;
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<"" | "declare" | "waive">("");
  const [decl, setDecl] = useState<{ isPep: boolean; relation: "self" | "family" | "close_associate"; details: string }>({ isPep: false, relation: "self", details: "" });
  const [reason, setReason] = useState("");
  const [escalation, setEscalation] = useState<{ level: "" | "B" | "C"; reason: string; touched: boolean }>({ level: "", reason: "", touched: false });

  async function act(key: string, run: () => Promise<ActionResult>) {
    setBusy(key); setError("");
    try { apply(await run()); } catch { setError("That action did not complete. Please try again."); }
    setBusy("");
  }
  const toggle = (id: string) => setOpen(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  if (!view) return error ? <span className={styles.errorMsg} role="alert"><AlertTriangle size={13} />{error}</span> : <span className={styles.meta}><Loader2 size={12} className={styles.spinner} /> Checking…</span>;

  const vendorDone = !!view.customerVendor && view.customerVendor.outcome !== "failed";
  const needsVendor = view.pepVendorRequired && !vendorDone;
  const needsDeclaration = !view.selfDeclarationRecord;
  const reviews = [view.customerSanctionsInternal, view.beneficiarySanctionsInternal, view.customerPepInternal, view.beneficiaryPepInternal, view.selfDeclarationRecord, view.customerVendor, view.beneficiaryVendor]
    .filter((record): record is ScreeningRecord => isMatch(record) && (isPending(record) || open.has(record!.id)));
  const level = escalation.touched ? escalation.level : (view.manualEscalation ?? "");
  const escalationReason = escalation.touched ? escalation.reason : (view.manualEscalationReason ?? "");
  const runVendor = (party: ScreeningParty) => {
    const name = party === "customer" ? view.customerName : view.beneficiaryName;
    if (window.confirm(`Run a paid NameScan lookup for ${name}?`)) void act(`vendor-${party}`, () => runRequestVendorScreening({ requestId, party }));
  };
  const catClass = view.category === "A" ? styles.catA : view.category === "B" ? styles.catB : styles.catC;

  return (
    <div className={styles.detailStack}>
      <div className={styles.headRow}>
        <span className={`${styles.categoryBadge} ${catClass}`} title={view.triggers.map(item => item.label).join("\n") || "No escalation triggers"}>Category {view.category}</span>
        <span className={styles.spacer} />
        <Link className={`${styles.btn} ${styles.btnSmall}`} href={`/admin/users?userId=${view.userId}`}>Customer<ExternalLink size={12} /></Link>
      </div>

      {error && <span className={styles.errorMsg} role="alert"><AlertTriangle size={13} />{error}</span>}

      <p className={styles.parties}><bdi>{view.customerName || "Customer"}</bdi>{view.beneficiaryName && <> <span aria-hidden="true">→</span> <bdi>{view.beneficiaryName}</bdi></>}</p>

      <div className={styles.grid} role="table" aria-label="Compliance results">
        <div className={styles.gridHead} role="row"><span /><span dir="auto">{view.customerName || "Customer"}</span><span dir="auto">{view.beneficiaryName || "Beneficiary"}</span></div>
        <div className={styles.gridRow} role="row">
          <span className={styles.rowLabel}>Identity</span>
          <span data-label="Customer" className={styles.party}><span className={styles.chips}>{view.dvs.applicable
            ? <span className={`${styles.chip} ${view.dvs.status === "completed" ? styles.chip_ok : styles.chip_warn}`}>{view.dvs.status === "completed" ? <Check size={12} /> : <AlertTriangle size={12} />}{view.dvs.status === "completed" ? "Verified" : "Not verified"}</span>
            : <span className={`${styles.chip} ${styles.chip_dim}`}>N/A</span>}</span></span>
          <span data-label="Beneficiary" className={styles.muted}>—</span>
        </div>
        <div className={styles.gridRow} role="row">
          <span className={styles.rowLabel}>Sanctions</span>
          <span data-label="Customer" className={styles.party}><span className={styles.chips}><Chip record={view.customerSanctionsInternal} onOpen={toggle} />{view.customerVendor && <Chip record={view.customerVendor} onOpen={toggle} label="NameScan" />}</span></span>
          <span data-label="Beneficiary" className={styles.party}><span className={styles.chips}><Chip record={view.beneficiarySanctionsInternal} onOpen={toggle} missing={view.beneficiaryName ? "Pending" : "—"} />{view.beneficiaryVendor && <Chip record={view.beneficiaryVendor} onOpen={toggle} label="NameScan" />}</span></span>
        </div>
        <div className={styles.gridRow} role="row">
          <span className={styles.rowLabel}>PEP</span>
          <span data-label="Customer" className={styles.party}><span className={styles.chips}>
            <Chip record={view.customerPepInternal} onOpen={toggle} label="Search" />
            <Chip record={view.selfDeclarationRecord} onOpen={toggle} label="Declared" missing="not asked" />
            {vendorDone || view.customerVendor?.outcome === "waived" ? <Chip record={view.customerVendor} onOpen={toggle} label="Vendor" /> : needsVendor
              ? <span className={`${styles.chip} ${styles.chip_bad}`}><AlertTriangle size={12} />Vendor required</span>
              : <span className={`${styles.chip} ${styles.chip_dim}`}>Vendor: n/a</span>}
          </span></span>
          <span data-label="Beneficiary" className={styles.party}><span className={styles.chips}><Chip record={view.beneficiaryPepInternal} onOpen={toggle} label="Search" missing={view.beneficiaryName ? "Pending" : "—"} /></span></span>
        </div>
      </div>

      {(needsDeclaration || needsVendor) && <div className={styles.actions}>
        {needsDeclaration && form !== "declare" && <button type="button" className={`${styles.btn} ${styles.btnSmall}`} onClick={() => setForm("declare")}>Record PEP answer</button>}
        {needsVendor && <>
          <button type="button" className={`${styles.btn} ${styles.btnSmall} ${styles.btnPrimary}`} disabled={!!busy} onClick={() => runVendor("customer")}>
            {busy === "vendor-customer" ? <Loader2 size={12} className={styles.spinner} /> : <Search size={12} />}Run NameScan</button>
          <button type="button" className={`${styles.btn} ${styles.btnSmall}`} onClick={() => setForm(form === "waive" ? "" : "waive")}>Waive…</button>
        </>}
      </div>}

      {form === "declare" && needsDeclaration && <div className={styles.inlineForm}>
        <div className={styles.decisionRow}>
          <label><input type="radio" checked={!decl.isPep} onChange={() => setDecl(current => ({ ...current, isPep: false }))} />No</label>
          <label><input type="radio" checked={decl.isPep} onChange={() => setDecl(current => ({ ...current, isPep: true }))} />Yes</label>
        </div>
        {decl.isPep && <>
          <SelectBox ariaLabel="Relationship" dir="ltr" value={decl.relation} onChange={value => setDecl(current => ({ ...current, relation: value as typeof decl.relation }))} labeledOptions={RELATION_OPTIONS} />
          <input className={styles.input} placeholder="Position held and country" value={decl.details} onChange={event => setDecl(current => ({ ...current, details: event.target.value }))} />
        </>}
        <div><button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={!!busy} onClick={() => void act("declare", async () => {
          const saved = await recordPepDeclaration({ userId: view.userId, isPep: decl.isPep, relation: decl.isPep ? decl.relation : null, details: decl.details });
          if (saved.error) return { error: saved.error };
          setForm("");
          return fetchRequestCompliance(requestId);
        })}>Save</button></div>
      </div>}

      {form === "waive" && needsVendor && <div className={styles.inlineForm}>
        <input className={styles.input} placeholder="Why is the vendor lookup not needed?" value={reason} onChange={event => setReason(event.target.value)} />
        <div><button type="button" className={styles.btn} disabled={!!busy || reason.trim().length < 5} onClick={() => void act("waive", async () => { const next = await waiveVendorCheck({ requestId, reason }); if (!next.error) { setForm(""); setReason(""); } return next; })}>Record waiver</button></div>
      </div>}

      {reviews.map(record => <MatchReview key={record.id} record={record} onDecided={() => void act("reload", () => fetchRequestCompliance(requestId))} />)}

      {view.category === "C" && view.ecdd.status !== "approved" && <div className={`${styles.inlineForm} ${styles.wide}`}>
        <strong className={styles.checkName}>Category C: ECDD decision{view.ecdd.status === "refused" ? " (previously refused)" : ""}</strong>
        <textarea className={styles.textarea} value={reason} onChange={event => setReason(event.target.value)} maxLength={1000} placeholder="Documents and source of funds checked; reason for the decision" aria-label="ECDD reason" />
        <div className={styles.actions}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={!!busy || reason.trim().length < 5} onClick={() => void act("ecdd", async () => { const next = await decideEcdd({ requestId, decision: "approved", reason }); if (!next.error) setReason(""); return next; })}>Approve</button>
          <button type="button" className={`${styles.btn} ${styles.btnDanger}`} disabled={!!busy || reason.trim().length < 5} onClick={() => void act("ecdd", async () => { const next = await decideEcdd({ requestId, decision: "refused", reason }); if (!next.error) setReason(""); return next; })}>Refuse</button>
        </div>
      </div>}

      {view.blockers.length > 0 && <ul className={styles.needs} aria-label="Outstanding">{view.blockers.map(item => <li key={item}>{item}</li>)}</ul>}

      <details className={styles.options}>
        <summary>Options<ChevronDown size={13} /></summary>
        <div className={styles.optionsBody}>
          <div className={styles.control}><span className={styles.controlLabel}>Funding</span>
            <SelectBox ariaLabel="Funding method" dir="ltr" value={view.fundingMethod} disabled={!!busy} onChange={value => void act("funding", () => setRequestFundingMethod({ requestId, method: value as "bank" | "cash" }))} labeledOptions={FUNDING_OPTIONS} /></div>
          <div className={styles.control}><span className={styles.controlLabel}>Raise category</span>
            <SelectBox ariaLabel="Raise category" dir="ltr" value={level} onChange={value => setEscalation(current => ({ ...current, level: value as "" | "B" | "C", touched: true }))} labeledOptions={LEVEL_OPTIONS} /></div>
          {level && <input className={`${styles.input} ${styles.wide}`} placeholder="Reason (red flag)" aria-label="Reason for raising the category" value={escalationReason} onChange={event => setEscalation(current => ({ ...current, reason: event.target.value, touched: true }))} />}
          {escalation.touched && <div className={styles.wide}><button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={!!busy || (!!level && escalationReason.trim().length < 5)} onClick={() => void act("escalate", () => setRequestEscalation({ requestId, level: level || null, reason: escalationReason }))}>Apply category</button></div>}
          <div className={styles.optionsActions}>
            <span className={styles.controlLabel}>Paid check (NameScan)</span>
            <button type="button" className={styles.btn} disabled={!!busy} onClick={() => runVendor("customer")}><Search size={14} aria-hidden="true" />Customer</button>
            {view.beneficiaryName && <button type="button" className={styles.btn} disabled={!!busy} onClick={() => runVendor("beneficiary")}><Search size={14} aria-hidden="true" />Beneficiary</button>}
          </div>
        </div>
      </details>
    </div>
  );
}
