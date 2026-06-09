"use client";

import React, { useState, useTransition } from "react";
import { Pencil, Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { updateTransactionReferenceCode } from "@/app/actions/admin.actions";

interface EditableReferenceCodeProps {
  transactionId: string | number;
  currentCode: string | null;
}

export function EditableReferenceCode({ transactionId, currentCode }: EditableReferenceCodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(currentCode ?? "");
  const [displayCode, setDisplayCode] = useState(currentCode);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateTransactionReferenceCode(transactionId, value);
      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        const saved = value.trim().toUpperCase();
        setDisplayCode(saved);
        setIsEditing(false);
        router.refresh();
      }
    });
  };

  const handleCancel = () => {
    setValue(displayCode ?? "");
    setError(null);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value.toUpperCase())}
            style={{
              fontFamily: "monospace",
              fontSize: "0.8rem",
              width: "86px",
              padding: "3px 7px",
              border: "1.5px solid var(--accent)",
              borderRadius: "5px",
              background: "#fff",
              outline: "none",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
            autoFocus
            maxLength={10}
            placeholder="ZE12345"
          />
          <button
            onClick={handleSave}
            disabled={isPending}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--success, #059669)", padding: "2px" }}
            title="Save"
          >
            <Check size={14} />
          </button>
          <button
            onClick={handleCancel}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: "2px" }}
            title="Cancel"
          >
            <X size={14} />
          </button>
        </div>
        {error && (
          <div style={{ fontSize: "0.63rem", color: "#ef4444", maxWidth: "120px" }}>{error}</div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
      <span style={{ fontFamily: "monospace", fontSize: "0.8rem", fontWeight: 700, color: "var(--color-accent-primary, #2563eb)", letterSpacing: "0.5px" }}>
        {displayCode ?? "—"}
      </span>
      <button
        onClick={() => setIsEditing(true)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--text-dim, #94a3b8)",
          display: "inline-flex",
          alignItems: "center",
          gap: "3px",
          fontSize: "0.6rem",
          padding: 0,
          fontWeight: 500,
        }}
        title="Edit reference code"
      >
        <Pencil size={10} />
        Edit
      </button>
    </div>
  );
}
