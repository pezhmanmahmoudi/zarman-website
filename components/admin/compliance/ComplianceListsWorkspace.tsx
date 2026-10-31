"use client";

// Admin page: the two screening lists (status + refresh) and the queue of matches waiting for review.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ChevronDown, Loader2, Upload } from "lucide-react";
import type { ComplianceOverview } from "@/app/actions/compliance.actions";
import { FilePicker } from "@/components/admin/compliance/FilePicker";
import { MatchReview } from "@/components/admin/compliance/MatchReview";
import type { ListStatus } from "@/lib/compliance/types";
import styles from "@/styles/admin/ComplianceTable.module.css";

const day = (value: string | null) => (value ? new Date(value).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—");

function Facts({ status, extra }: { status: ListStatus; extra?: string }) {
  if (!status.importId) return <span className={`${styles.chip} ${styles.chip_bad}`}><AlertTriangle size={12} />Not loaded</span>;
  return (
    <div className={styles.chips}>
      <span className={`${styles.chip} ${styles.chip_ok}`}><Check size={12} />Active</span>
      <span className={`${styles.chip} ${styles.chip_dim}`}>{status.entryCount.toLocaleString()} {extra ?? "entries"}</span>
      {status.latestControlDate && <span className={`${styles.chip} ${styles.chip_dim}`}>Control date {status.latestControlDate}</span>}
      <span className={`${styles.chip} ${styles.chip_dim}`}>Loaded {day(status.importedAt)}</span>
    </div>
  );
}

export function ComplianceListsWorkspace({ overview, error }: { overview: ComplianceOverview | null; error: string | null }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [force, setForce] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function upload() {
    if (!file) { setMessage({ ok: false, text: "Choose the .xlsx file first." }); return; }
    setBusy(true); setMessage(null);
    try {
      const form = new FormData();
      form.set("file", file);
      if (force) form.set("force", "true");
      const res = await fetch("/api/admin/compliance/dfat-upload", { method: "POST", body: form });
      const json = (await res.json().catch(() => null)) as { message?: string; rows?: number; notes?: string } | null;
      if (!res.ok) setMessage({ ok: false, text: json?.message ?? `Upload failed (HTTP ${res.status}).` });
      else {
        setMessage({ ok: true, text: `Loaded ${json?.rows?.toLocaleString()} rows. ${json?.notes ?? ""}` });
        setFile(null);
        setForce(false);
        router.refresh();
      }
    } catch { setMessage({ ok: false, text: "The upload did not complete. Try again." }); }
    setBusy(false);
  }

  if (!overview) return <div className={styles.empty}>{error ?? "Compliance lists are unavailable."}</div>;

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div className={styles.pageGrid}>
        <section className={styles.listCard} aria-labelledby="dfat-title">
          <h2 id="dfat-title" className={styles.title}>Sanctions · DFAT list</h2>
          <Facts status={overview.dfat} />
          <span className={styles.meta}>China, Russia and Pakistan listings (without an Iran link) match only on strong hits.</span>
          <div className={styles.uploadRow}>
            <FilePicker file={file} onChange={setFile} accept=".xlsx" label="Choose the DFAT .xlsx file" hint="Drop it here or click · .xlsx" disabled={busy} />
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => void upload()} disabled={busy || !file}>
              {busy ? <Loader2 size={13} className={styles.spinner} /> : <Upload size={13} />}{busy ? "Loading…" : "Update"}
            </button>
          </div>
          <label className={styles.meta} style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}><input type="checkbox" checked={force} onChange={event => setForce(event.target.checked)} disabled={busy} />Reload even if unchanged</label>
          {message && <span className={message.ok ? `${styles.status} ${styles.ok}` : styles.errorMsg} role="status">{message.ok ? <Check size={13} /> : <AlertTriangle size={13} />}{message.text}</span>}
        </section>

        <section className={styles.listCard} aria-labelledby="pep-title">
          <h2 id="pep-title" className={styles.title}>PEP · Wikidata list</h2>
          <Facts status={overview.pep} extra="names" />
          <details className={styles.options}>
            <summary>Refresh<ChevronDown size={13} /></summary>
            <code className={styles.code} style={{ marginTop: "0.4rem" }}>{"node --env-file=.env.local scripts/import-pep-wikidata.mjs --countries IR,AF,IQ,TR,AE,AZ,AM,SA,SY,LB,AU --apply"}</code>
          </details>
        </section>
      </div>

      <section aria-labelledby="queue-title" style={{ display: "grid", gap: "0.6rem" }}>
        <h2 id="queue-title" className={styles.title}>Open reviews{overview.pending.length ? ` · ${overview.pending.length}` : ""}</h2>
        {overview.pending.length === 0 && <div className={styles.empty}>Nothing to review.</div>}
        {overview.pending.map(item => (
          <div key={item.id} className={styles.queueItem}>
            <div className={styles.queueHead}>
              <span><strong dir="auto">{item.subject_name}</strong> <span className={styles.meta}>· {item.party === "customer" ? "Customer" : "Beneficiary"} · {item.method === "self_declaration" ? "Declaration" : item.check_kind === "pep" ? "PEP" : "Sanctions"}</span></span>
              {item.request_id
                ? <Link href={`/admin/transactions/requests/${item.request_id}`}>Request {item.request_reference ?? ""}</Link>
                : item.profile_id ? <Link href={`/admin/users?userId=${item.profile_id}`}>Customer</Link> : null}
            </div>
            <MatchReview record={item} onDecided={() => router.refresh()} />
          </div>
        ))}
      </section>
    </div>
  );
}
