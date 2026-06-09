"use client";

import React, { useState, useTransition } from "react";
import { Pencil, Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { updateTransactionAmount } from "@/app/actions/admin.actions";

interface EditableAmountProps {
  transactionId: string | number;
  field: "amount_aud" | "equivalent_toman";
  currentValue: number;
  /** Placeholder hint shown inside the input */
  placeholder?: string;
}

function formatAmount(field: "amount_aud" | "equivalent_toman", value: number): string {
  if (field === "amount_aud") {
    return value.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return value.toLocaleString("en-AU");
}

export function EditableAmount({
  transactionId,
  field,
  currentValue,
  placeholder,
}: EditableAmountProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputStr, setInputStr] = useState(String(currentValue));
  const [displayValue, setDisplayValue] = useState(currentValue);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSave = () => {
    const parsed = parseFloat(inputStr.replace(/,/g, ""));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter a valid positive number.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateTransactionAmount(transactionId, field, parsed);
      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        setDisplayValue(parsed);
        setIsEditing(false);
        router.refresh();
      }
    });
  };

  const handleCancel = () => {
    setInputStr(String(displayValue));
    setError(null);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <input
            type="text"
            inputMode="decimal"
            value={inputStr}
            onChange={(e) => setInputStr(e.target.value)}
            style={{
              fontFamily: "monospace",
              fontSize: "0.8rem",
              width: "100px",
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
            placeholder={placeholder}
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
          <div style={{ fontSize: "0.63rem", color: "#ef4444", maxWidth: "140px" }}>{error}</div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
      <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
        {formatAmount(field, displayValue)}
      </span>
      <button
        onClick={() => { setInputStr(String(displayValue)); setIsEditing(true); }}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          display: "flex",
          alignItems: "center",
          gap: "3px",
          color: "var(--text-dim)",
          fontSize: "0.63rem",
          width: "fit-content",
        }}
        title="Edit amount"
      >
        <Pencil size={10} />
        Edit
      </button>
    </div>
  );
}
