"use client";

// Shows the matches behind a "potential match" / PEP self-declaration and records the
// admin's decision (false positive with a reason, or confirmed match). Decisions are written
// to the audit log by the server action.

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { decideScreening } from "@/app/actions/compliance.actions";
import type { ScreeningRecord } from "@/lib/compliance/types";
import styles from "@/styles/admin/ComplianceTable.module.css";

const DOB_LABEL = { match: "DOB matches", mismatch: "DOB differs", unknown: "DOB not comparable" } as const;

export function MatchList({ record }: { record: ScreeningRecord }) {
  if (!record.matches.length) return <p className={styles.sub}>No match details were stored{record.note ? `: ${record.note}` : "."}</p>;
  return (
    <ul className={styles.matchList}>
      {record.matches.map(match => (
        <li key={`${match.reference}-${match.matchedName}`} className={styles.match}>
          <div className={styles.matchTop}>
            <span className={styles.matchName} dir="auto">{match.listedName}</span>
            {match.percent > 0 && <span className={`${styles.percent} ${match.strength === "possible" ? styles.percentSoft : ""}`}>{match.percent}% · {match.strength}</span>}
          </div>
          <div className={styles.meta}>
            {match.matchedName !== match.listedName && <>Matched alias “{match.matchedName}” · </>}
            {match.entryType ? `${match.entryType} · ` : ""}{DOB_LABEL[match.dob]}{match.listedDob ? ` (listed: ${match.listedDob})` : ""} · Ref {match.reference}
          </div>
          <dl className={styles.detailGrid}>
            {Object.entries(match.details).filter(([, value]) => value).map(([label, value]) => (
              <div key={label} style={{ display: "contents" }}><dt>{label}</dt><dd dir="auto">{value}</dd></div>
            ))}
          </dl>
        </li>
      ))}
    </ul>
  );
}

export function MatchReview({ record, onDecided }: { record: ScreeningRecord; onDecided: () => void }) {
  const [decision, setDecision] = useState<"false_positive" | "confirmed_match">("false_positive");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const decided = record.decision === "false_positive" || record.decision === "confirmed_match";
  const isDeclaration = record.outcome === "declared_yes";

  async function submit() {
    setBusy(true); setError("");
    const result = await decideScreening({ screeningId: record.id, decision, reason });
    setBusy(false);
    if (result.error) { setError(result.error); return; }
    setReason("");
    onDecided();
  }

  return (
    <div className={styles.review}>
      <div className={styles.reviewHead}>
        <strong dir="auto">{record.subject_name}</strong>
        <span className={styles.meta}>{new Date(record.performed_at).toLocaleString()}</span>
      </div>
      <MatchList record={record} />

      {decided ? (
        <div className={styles.decided}>
          {record.decision === "false_positive"
            ? <span className={`${styles.status} ${styles.ok}`}><CheckCircle2 size={13} />{isDeclaration ? "Reviewed: not treated as a PEP" : "Cleared as false positive"}</span>
            : <span className={`${styles.status} ${styles.bad}`}><ShieldAlert size={13} />{isDeclaration ? "Confirmed PEP: ECDD required" : "CONFIRMED match"}</span>}
          <div className={styles.meta}>{record.decision_reason} · {record.decided_at ? new Date(record.decided_at).toLocaleString() : ""}</div>
        </div>
      ) : (
        <div className={styles.decision}>
          <div className={styles.decisionRow}>
            <label><input type="radio" name={`d-${record.id}`} checked={decision === "false_positive"} onChange={() => setDecision("false_positive")} disabled={busy} />{isDeclaration ? "Not a PEP / acceptable" : "False positive: different person"}</label>
            <label><input type="radio" name={`d-${record.id}`} checked={decision === "confirmed_match"} onChange={() => setDecision("confirmed_match")} disabled={busy} />{isDeclaration ? "Confirmed PEP" : "Confirmed match: block"}</label>
          </div>
          <textarea className={styles.textarea} value={reason} onChange={event => setReason(event.target.value)} maxLength={1000} disabled={busy}
            placeholder="Reason (required, kept in the audit log): what evidence did you check?" aria-label="Decision reason" />
          {error && <span className={styles.errorMsg}><AlertTriangle size={13} />{error}</span>}
          <div>
            <button type="button" className={`${styles.btn} ${decision === "confirmed_match" ? styles.btnDanger : styles.btnPrimary}`} onClick={() => void submit()} disabled={busy || reason.trim().length < 5}>
              {busy ? <Loader2 size={13} className={styles.spinner} /> : null}Record decision
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
