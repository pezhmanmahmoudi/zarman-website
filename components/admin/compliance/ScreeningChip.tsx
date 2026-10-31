"use client";

// Result chip shared by the transaction panel and the customer's recipient cards.

import { AlertTriangle, Check } from "lucide-react";
import type { ScreeningRecord } from "@/lib/compliance/types";
import styles from "@/styles/admin/ComplianceTable.module.css";

type Tone = "ok" | "warn" | "bad" | "dim";

export const isMatch = (record: ScreeningRecord | null) => !!record && (record.outcome === "potential_match" || record.outcome === "declared_yes");
export const isPending = (record: ScreeningRecord | null) => isMatch(record) && (!record!.decision || record!.decision === "pending");

function describe(record: ScreeningRecord | null, missing = "Pending"): { text: string; tone: Tone } {
  if (!record) return { text: missing, tone: "dim" };
  if (record.outcome === "failed") return { text: "Failed", tone: "bad" };
  if (record.outcome === "waived") return { text: "Waived", tone: "dim" };
  if (record.outcome === "declared_no") return { text: "No", tone: "ok" };
  if (record.outcome === "clear") return { text: "Clear", tone: "ok" };
  if (isPending(record)) return { text: record.outcome === "declared_yes" ? "Yes, PEP" : `Match${record.top_score ? ` ${record.top_score}%` : ""}`, tone: "warn" };
  if (record.decision === "false_positive") return { text: "Cleared", tone: "ok" };
  return { text: record.outcome === "declared_yes" ? "PEP confirmed" : "Confirmed", tone: "bad" };
}

export function Chip({ record, onOpen, missing, label }: { record: ScreeningRecord | null; onOpen: (id: string) => void; missing?: string; label?: string }) {
  const { text, tone } = describe(record, missing);
  const className = `${styles.chip} ${styles[`chip_${tone}`]}`;
  const body = <>{tone === "ok" ? <Check size={12} aria-hidden="true" /> : tone === "dim" ? null : <AlertTriangle size={12} aria-hidden="true" />}{label ? `${label}: ` : ""}{text}</>;
  return isMatch(record)
    ? <button type="button" className={`${className} ${styles.chipButton}`} onClick={() => onOpen(record!.id)} title="Open the match details" aria-label={`${label ? `${label}: ` : ""}${text}, open the match details`}>{body}</button>
    : <span className={className}>{body}</span>;
}

