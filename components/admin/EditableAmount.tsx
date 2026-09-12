"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { updateTransactionAmount } from "@/app/actions/admin.actions";
import { AdminFieldEditor } from "@/components/admin/ui/AdminFieldEditor";
import { parseAdminAmount } from "@/lib/admin-amount-input";

interface EditableAmountProps {
  transactionId: string | number;
  field: "amount_aud" | "equivalent_toman";
  currentValue: number;
  placeholder?: string;
}

export function EditableAmount({ transactionId, field, currentValue, placeholder }: EditableAmountProps) {
  const [savedValue, setSavedValue] = useState<{ source: number; value: number } | null>(null);
  const router = useRouter();
  const displayValue = savedValue?.source === currentValue ? savedValue.value : currentValue;
  const isAud = field === "amount_aud";
  const formatted = displayValue.toLocaleString("en-AU", isAud
    ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    : undefined);

  return (
    <AdminFieldEditor
      value={String(displayValue)}
      displayValue={formatted}
      label={isAud ? "AUD amount" : "Toman amount"}
      description={`Update the ${isAud ? "Australian dollar" : "Toman"} amount for this transaction.`}
      suffix={isAud ? "AUD" : "IRT"}
      variant="amount"
      inputMode="decimal"
      placeholder={placeholder}
      onSave={async value => {
        const parsed = parseAdminAmount(value);
        if (parsed === null) throw new Error("Enter a positive amount, such as 1,250 or 1250.50.");
        const result = await updateTransactionAmount(transactionId, field, parsed);
        if ("error" in result && result.error) throw new Error(result.error);
        setSavedValue({ source: currentValue, value: parsed });
        router.refresh();
      }}
    />
  );
}
