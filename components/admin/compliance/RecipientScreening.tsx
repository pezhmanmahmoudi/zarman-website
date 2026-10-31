"use client";

// Result of the internal sanctions + PEP screens for one saved recipient. Shows the outcome only;
// a match opens its review in place.

import { useState } from "react";
import { MatchReview } from "@/components/admin/compliance/MatchReview";
import { Chip, isPending } from "@/components/admin/compliance/ScreeningChip";
import type { RecipientCompliance } from "@/lib/compliance/request-compliance";
import styles from "@/styles/admin/ComplianceTable.module.css";

export function RecipientScreening({ result, loading, onChanged }: { result?: RecipientCompliance; loading: boolean; onChanged: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!result) return <div className={styles.chips}><span className={`${styles.chip} ${styles.chip_dim}`}>{loading ? "Screening…" : "Not screened"}</span></div>;
  const records = [result.sanctions, result.pep].filter(record => record && (isPending(record) || record.id === open));
  return (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      <div className={styles.chips}>
        <Chip record={result.sanctions} onOpen={id => setOpen(open === id ? null : id)} label="Sanctions" />
        <Chip record={result.pep} onOpen={id => setOpen(open === id ? null : id)} label="PEP" />
      </div>
      {records.map(record => record && <MatchReview key={record.id} record={record} onDecided={onChanged} />)}
    </div>
  );
}
