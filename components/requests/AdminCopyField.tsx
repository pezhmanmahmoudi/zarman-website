"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import workspace from "@/styles/requests/RequestWorkspace.module.css";

export function AdminCopyButton({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  async function copy() {
    try { await navigator.clipboard.writeText(value); setState("copied"); }
    catch { setState("failed"); }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 1800);
  }
  return <button type="button" className={workspace.copyButton} data-state={state} onClick={() => void copy()} aria-label={`Copy ${label}`} title={`Copy ${label}`}>
    {state === "copied" ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
    {state !== "idle" && <span className={workspace.copyFeedback} role="status">{state === "copied" ? "Copied" : "Copy failed"}</span>}
  </button>;
}

/** One `dl` row with the value and, unless `copy` is false, a copy button. */
export function AdminCopyRow({ label, value, copyValue, copy = true, mono = false }: { label: string; value: string; copyValue?: string; copy?: boolean; mono?: boolean }) {
  return <div className={workspace.copyRow} data-mono={mono || undefined}>
    <dt>{label}</dt>
    <dd><bdi dir={mono ? "ltr" : "auto"}>{value}</bdi>{copy && <AdminCopyButton value={copyValue ?? value} label={label.toLowerCase()} />}</dd>
  </div>;
}
