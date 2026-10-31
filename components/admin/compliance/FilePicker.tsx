"use client";

// Standard admin file picker: dashed drop area with icon, file name and a hint. The native
// "Choose file / No file chosen" control is visually hidden but stays keyboard accessible.

import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import styles from "@/styles/admin/ComplianceTable.module.css";

export function FilePicker({ file, onChange, accept, hint, disabled, label }: {
  file: File | null; onChange: (file: File | null) => void; accept: string; hint: string; disabled?: boolean; label: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const choose = (next: File | null) => {
    if (next && !accept.split(",").some(ext => next.name.toLowerCase().endsWith(ext.trim().toLowerCase()))) return;
    onChange(next);
  };
  return (
    <label
      className={styles.filePicker} data-dragging={dragging || undefined} data-disabled={disabled || undefined}
      onDragOver={event => { if (!disabled) { event.preventDefault(); setDragging(true); } }}
      onDragLeave={() => setDragging(false)}
      onDrop={event => { event.preventDefault(); setDragging(false); if (!disabled) choose(event.dataTransfer.files?.[0] ?? null); }}
    >
      <FileUp size={18} aria-hidden="true" />
      <span><strong>{file ? file.name : label}</strong><small>{file ? `${(file.size / 1024).toFixed(0)} KB · click to replace` : hint}</small></span>
      <input ref={input} type="file" accept={accept} disabled={disabled} onChange={event => choose(event.target.files?.[0] ?? null)} />
    </label>
  );
}
